import { createOutputManager22C, normalizeOutputMode22C } from './output_manager_22c.js';
import { createFrameInspector22E, expectedRawSerialPacketBytes } from './frame_inspector_22e.js';
import { resolveStep22DProfile } from '../server/output_profile_routes_22d.js';

function nowMs() {
  return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
}

function numberOr(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getRgbLength(frame = {}) {
  const rgb = frame.rgb ?? frame.frame ?? frame.payload ?? frame.data?.rgb ?? frame.pixels ?? frame.data ?? [];
  if (Buffer.isBuffer(rgb) || rgb instanceof Uint8Array || Array.isArray(rgb)) return rgb.length;
  return 0;
}

function getFramePixels(frame = {}, fallback = 160) {
  const explicit = frame.pixelCount ?? frame.pixels ?? frame.meta?.pixelCount ?? frame.meta?.pixels;
  if (Number.isFinite(Number(explicit))) return Math.max(1, Math.floor(Number(explicit)));
  const len = getRgbLength(frame);
  if (len > 0) return Math.max(1, Math.ceil(len / 3));
  return fallback;
}

function normalizeRoutePolicy(policy = {}) {
  return {
    allowPreview: policy.allowPreview !== false,
    allowSerial: policy.allowSerial !== false,
    allowArtnet: policy.allowArtnet !== false,
    allowBlx: policy.allowBlx === true,
    preferPreviewWhenUnsafe: policy.preferPreviewWhenUnsafe !== false,
    strictPixelCount: policy.strictPixelCount !== false,
    autoStart: policy.autoStart !== false
  };
}

function buildProfileHealth(profile = {}) {
  const active = normalizeOutputMode22C(profile.active || profile.settings?.active || 'preview');
  const warnings = [...(profile.warnings || [])];
  if (active === 'blx') warnings.push('BLX is not used as automatic live route in STEP22F. Keep RAW serial or ArtNet as the main path.');
  if (profile.id === 'ESP32_4x300_RAW_SERIAL') warnings.push('4x300 RAW serial requires 3Mbaud and a matching receiver. Validate 4x40 first.');
  return { active, warnings };
}

export function createOutputRouter22F(options = {}) {
  const packets = [];
  const packetHistoryLimit = Math.max(1, Number(options.packetHistoryLimit || 12));
  const policy = normalizeRoutePolicy(options.policy || {});
  let profileId = options.profile || options.profileId || 'ESP32_4x40_RAW_SERIAL';
  let resolved = resolveStep22DProfile(profileId, options.overrides || {});
  const expectedPixels = numberOr(resolved.totalPixels, 160);
  const inspector = options.inspector || createFrameInspector22E({ expectedPixels });

  const manager = options.manager || createOutputManager22C({
    profile: profileId,
    overrides: options.overrides || {},
    adapters: {
      serial: {
        writer: options.serialWriter || options.writer,
        serialController: options.serialController,
        onPacket(packet, meta) {
          const copy = Buffer.from(packet);
          packets.push({
            at: nowMs(),
            bytes: copy.length,
            pixels: meta?.pixels || 0,
            firstBytes: Array.from(copy.slice(0, 12)).map((value) => value.toString(16).padStart(2, '0')).join(' ')
          });
          while (packets.length > packetHistoryLimit) packets.shift();
          inspector.observePacket(copy, meta?.pixels || expectedPixels);
          if (typeof options.onSerialPacket === 'function') options.onSerialPacket(copy, meta);
        }
      },
      artnet: options.artnet || {}
    }
  });

  let routedFrames = 0;
  let blockedFrames = 0;
  let previewFrames = 0;
  let lastDecision = 'init';
  let lastRoute = normalizeOutputMode22C(resolved.active);
  let lastError = '';
  let lastFrameAt = 0;

  function setProfile(nextProfileId = 'ESP32_4x40_RAW_SERIAL', overrides = {}) {
    profileId = String(nextProfileId || 'ESP32_4x40_RAW_SERIAL');
    resolved = resolveStep22DProfile(profileId, overrides);
    manager.applyProfile(profileId, overrides);
    lastRoute = normalizeOutputMode22C(resolved.active);
    lastDecision = `profile:${profileId}`;
    return getStatus();
  }

  function chooseRoute(frame = {}, request = {}) {
    const requested = request.output || request.transport || request.mode;
    const candidate = normalizeOutputMode22C(requested || resolved.active || 'preview');
    const route = candidate === 'blx' && !policy.allowBlx ? 'preview' : candidate;
    const framePixels = getFramePixels(frame, numberOr(resolved.totalPixels, 160));
    const expected = numberOr(resolved.totalPixels, framePixels);
    const health = buildProfileHealth(resolved);
    const reasons = [];

    if (route === 'serial' && !policy.allowSerial) reasons.push('SERIAL_DISABLED_BY_POLICY');
    if (route === 'artnet' && !policy.allowArtnet) reasons.push('ARTNET_DISABLED_BY_POLICY');
    if (route === 'preview' && !policy.allowPreview) reasons.push('PREVIEW_DISABLED_BY_POLICY');
    if (candidate === 'blx' && !policy.allowBlx) reasons.push('BLX_NOT_AUTO_ENABLED_STEP22F');
    if (policy.strictPixelCount && route === 'serial' && framePixels !== expected) reasons.push(`PIXEL_COUNT_MISMATCH:${framePixels}!=${expected}`);

    const safe = reasons.length === 0;
    const output = safe ? route : (policy.preferPreviewWhenUnsafe && policy.allowPreview ? 'preview' : 'blocked');
    return {
      safe,
      output,
      requested: candidate,
      expectedPixels: expected,
      framePixels,
      expectedSerialPacketBytes: expectedRawSerialPacketBytes(expected),
      profile: resolved.id,
      profileWarnings: health.warnings,
      reasons
    };
  }

  function routeFrame(frame = {}, request = {}) {
    inspector.observeInput(frame);
    inspector.observeRender(frame);
    const decision = chooseRoute(frame, request);
    lastFrameAt = nowMs();

    if (decision.output === 'blocked') {
      blockedFrames += 1;
      lastDecision = `blocked:${decision.reasons.join(',')}`;
      lastError = lastDecision;
      const result = { ok: false, output: 'blocked', decision };
      inspector.observeOutput(result, frame);
      return result;
    }

    if (decision.output === 'preview') previewFrames += 1;
    if (policy.autoStart) manager.start();
    const result = manager.sendFrame(frame, {
      mode: decision.output
    });
    routedFrames += result.ok === false ? 0 : 1;
    blockedFrames += result.ok === false ? 1 : 0;
    lastRoute = decision.output;
    lastDecision = result.ok === false ? `drop:${decision.output}` : `route:${decision.output}`;
    lastError = result.ok === false ? result.reason || 'route_failed' : '';
    inspector.observeOutput(result, frame);
    return { ...result, decision };
  }

  function getStatus() {
    const managerStatus = manager.getStatus();
    return {
      ok: true,
      version: 'STEP22F_OUTPUT_ROUTER_SAFE_ROUTE_POLICY',
      profile: resolved.id,
      profileLabel: resolved.label,
      active: lastRoute,
      policy,
      routedFrames,
      blockedFrames,
      previewFrames,
      lastDecision,
      lastError,
      lastFrameAgeMs: lastFrameAt ? Math.round(nowMs() - lastFrameAt) : null,
      expected: {
        pixels: numberOr(resolved.totalPixels, 160),
        strips: numberOr(resolved.strips, 4),
        pixelsPerStrip: numberOr(resolved.pixelsPerStrip, 40),
        serialPacketBytes: expectedRawSerialPacketBytes(numberOr(resolved.totalPixels, 160)),
        packetFormat: resolved.settings?.packetFormat || null
      },
      settings: resolved.settings,
      warnings: [...(resolved.warnings || []), ...buildProfileHealth(resolved).warnings],
      packetHistory: [...packets],
      manager: managerStatus,
      diagnostics: inspector.getSnapshot(managerStatus)
    };
  }

  return {
    routeFrame,
    chooseRoute,
    setProfile,
    start: () => manager.start(),
    stop: () => manager.stop(),
    tick: () => manager.tick(),
    getStatus,
    getManager: () => manager,
    getInspector: () => inspector
  };
}
