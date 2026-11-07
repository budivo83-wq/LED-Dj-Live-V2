import { createSerialOutputAdapter } from './adapters/serial/index.js';
import { createArtnetOutputAdapter } from './adapters/artnet/index.js';
import { createArtNetTransportScheduler22P } from './artnet_transport_scheduler_22p.js';
import { buildStep22COutputConfig, listStep22COutputProfiles } from './output_profiles_22c.js';

export function normalizeOutputMode22C(value) {
  const mode = String(value || 'preview').toLowerCase().trim();
  if (mode === 'raw' || mode === 'raw_serial' || mode === 'serial' || mode === 'usb') return 'serial';
  if (mode === 'blx' || mode === 'blx_serial' || mode === 'blx_udp') return 'blx';
  if (mode === 'artnet' || mode === 'art-net' || mode === 'udp') return 'artnet';
  if (mode === 'preview' || mode === 'none' || mode === 'off' || mode === 'null') return 'preview';
  return 'preview';
}


function createArtNetSchedulerAdapter22Q(options = {}) {
  const fpsLimit = Math.max(1, Number(options.fpsLimit || options.fps || 44) || 44);
  const injectedScheduler = options.scheduler && typeof options.scheduler === 'object' && typeof options.scheduler.getStatus === 'function' ? options.scheduler : null;
  const scheduler = injectedScheduler || createArtNetTransportScheduler22P({
    host: options.host || options.targetIp || options.map?.outputIp || '2.1.1.30',
    port: options.port || options.targetPort || 6454,
    fps: fpsLimit,
    stripCount: options.stripCount || options.map?.stripCount || 8,
    pixelsPerStrip: options.pixelsPerStrip || options.map?.pixelsPerStrip || 300,
    pixelsPerUniverse: options.pixelsPerUniverse || options.map?.pixelsPerUniverse || 170,
    startUniverse: options.startUniverse ?? options.map?.startUniverse ?? 0,
    artSync: options.artSync !== false,
    dryRun: options.dryRun !== false
  });

  let started = false;
  let queued = null;
  let pushed = 0;
  let sent = 0;
  let dropped = 0;
  let lastAt = 0;
  let lastDecision = 'init';
  let lastResult = null;

  function now() {
    return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
  }

  function normalizeFrame(frame = {}) {
    const rgb = frame.rgb || frame.frame || frame.payload || frame.data?.rgb || frame.data || [];
    return { rgb, frameId: frame.frameId ?? frame.id ?? 0, timestamp: frame.timestamp || Date.now() };
  }

  return {
    start() {
      started = true;
      scheduler.connect?.();
      lastDecision = 'started';
      return true;
    },
    stop() {
      started = false;
      queued = null;
      scheduler.disconnect?.();
      lastDecision = 'stopped';
      return true;
    },
    pushFrame(frame = {}) {
      pushed += 1;
      const normalized = normalizeFrame(frame);
      const validation = scheduler.validateFrame?.(normalized);
      if (validation && validation.ok === false) {
        dropped += 1;
        lastResult = { ok: false, blocked: true, validation };
        lastDecision = `drop:${validation.reason || 'artnet_scheduler_rejected'}`;
        queued = null;
        return false;
      }
      queued = normalized;
      lastDecision = 'queued-latest';
      return true;
    },
    processOne() {
      if (!started || !queued) return false;
      const frame = queued;
      queued = null;
      lastResult = scheduler.sendFrame(frame);
      lastAt = now();
      if (lastResult?.ok === false) {
        dropped += 1;
        lastDecision = `drop:${lastResult?.validation?.reason || lastResult?.reason || 'artnet_scheduler_rejected'}`;
        return false;
      }
      sent += 1;
      lastDecision = 'sent:artnet-scheduler-22p';
      return true;
    },
    discoverNodes() {
      return scheduler.poll?.() || false;
    },
    getDiscoveredNodes(maxAgeMs = 30000) {
      return scheduler.getDiscoveredNodes?.(maxAgeMs) || [];
    },
    setTarget() {
      // STEP22Q keeps target immutable inside the profile to avoid hidden runtime remapping.
      return scheduler.getStatus().config;
    },
    getStatus() {
      const status = scheduler.getStatus();
      return {
        name: 'artnet-scheduler-22q',
        started,
        running: started,
        queued: queued ? 1 : 0,
        pushed,
        processed: sent,
        sent,
        dropped,
        lastAt,
        lastDecision,
        lastResult,
        scheduler: status,
        transport: status.udp || null,
        universeCount: status.universeMap?.universeCount || 0,
        artSync: status.config?.artSync !== false,
        dryRun: status.dryRun === true
      };
    }
  };
}

function nowMs() {
  return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
}

function normalizeEnabled(list) {
  return new Set((Array.isArray(list) ? list : []).map(normalizeOutputMode22C).filter((mode) => mode !== 'preview'));
}

function createStep22CAdapterRegistry(config = {}) {
  const adapters = {};
  if (config.serial) adapters.serial = createSerialOutputAdapter(config.serial || {});
  if (config.artnet) {
    adapters.artnet = config.artnet.useScheduler22P === true || config.artnet.scheduler === 'step22p'
      ? createArtNetSchedulerAdapter22Q(config.artnet || {})
      : createArtnetOutputAdapter(config.artnet || {});
  }
  // BLX is intentionally not auto-imported here because its serial transport may
  // require optional native dependencies. STEP22C keeps BLX as a profile target,
  // but STEP22D should load it only when the user actively selects BLX.

  function getAdapter(mode) {
    const key = normalizeOutputMode22C(mode);
    return adapters[key] || null;
  }

  return {
    getAdapter,
    start(mode) {
      const adapter = getAdapter(mode);
      if (!adapter) return false;
      adapter.start();
      return true;
    },
    stop(mode) {
      const adapter = getAdapter(mode);
      if (!adapter) return false;
      adapter.stop();
      return true;
    },
    pushFrame(mode, frame) {
      const adapter = getAdapter(mode);
      if (!adapter) return false;
      return adapter.pushFrame(frame);
    },
    tick(mode) {
      const adapter = getAdapter(mode);
      if (adapter) adapter.processOne();
    },
    getAllStatus() {
      return Object.fromEntries(Object.entries(adapters).map(([key, adapter]) => [key, adapter.getStatus()]));
    }
  };
}

export function createOutputManager22C(inputConfig = {}) {
  let config = buildStep22COutputConfig(inputConfig);
  let registry = createStep22CAdapterRegistry(config.adapters || {});
  let enabled = normalizeEnabled(config.enabled);
  let active = normalizeOutputMode22C(config.active || config.mode || 'serial');
  let started = false;
  let pushed = 0;
  let dropped = 0;
  let profileSwitches = 0;
  let lastFrameId = 0;
  let lastAt = 0;
  let lastDecision = 'init';

  function hasAdapter(mode) {
    return Boolean(registry.getAdapter(normalizeOutputMode22C(mode)));
  }

  function setEnabled(mode, value = true) {
    const key = normalizeOutputMode22C(mode);
    if (key === 'preview' || !hasAdapter(key)) return false;
    if (value) {
      enabled.add(key);
      if (started) registry.start(key);
    } else {
      enabled.delete(key);
      registry.stop(key);
      if (active === key) active = 'preview';
    }
    return true;
  }

  function setActive(mode) {
    const key = normalizeOutputMode22C(mode);
    if (key === 'preview') {
      active = key;
      return active;
    }
    if (!hasAdapter(key)) return active;
    active = key;
    enabled.add(key);
    if (started) registry.start(key);
    return active;
  }

  function start() {
    started = true;
    for (const mode of enabled) registry.start(mode);
    if (active !== 'preview') registry.start(active);
    lastDecision = 'started';
  }

  function stop() {
    for (const mode of Array.from(enabled)) registry.stop(mode);
    if (active !== 'preview') registry.stop(active);
    started = false;
    lastDecision = 'stopped';
  }

  function applyProfile(profileId, overrides = {}) {
    const wasStarted = started;
    if (started) stop();
    config = buildStep22COutputConfig({ profile: profileId, overrides });
    registry = createStep22CAdapterRegistry(config.adapters || {});
    enabled = normalizeEnabled(config.enabled);
    active = normalizeOutputMode22C(config.active);
    profileSwitches += 1;
    lastDecision = `profile:${config.id}`;
    if (wasStarted) start();
    return getStatus();
  }

  function sendFrame(frame, options = {}) {
    if (options.profile || options.profileId) applyProfile(options.profile || options.profileId, options.overrides || {});
    if (options.mode || options.transport || options.output) setActive(options.mode || options.transport || options.output);
    if (!started) start();

    lastFrameId = Number(frame?.frameId ?? lastFrameId);
    lastAt = nowMs();

    if (active === 'preview') {
      pushed += 1;
      lastDecision = 'preview-only';
      return { ok: true, output: 'preview', previewOnly: true };
    }

    const ok = registry.pushFrame(active, frame);
    registry.tick(active);
    if (ok === false) {
      dropped += 1;
      lastDecision = `drop:${active}`;
      return { ok: false, output: active, reason: 'adapter_rejected_frame' };
    }

    pushed += 1;
    lastDecision = `sent:${active}`;
    return { ok: true, output: active, profile: config.id };
  }

  function tick() {
    if (!started) return;
    for (const mode of enabled) registry.tick(mode);
    if (active !== 'preview' && !enabled.has(active)) registry.tick(active);
  }

  function getStatus() {
    return {
      version: 'STEP22C_OUTPUT_MANAGER_RUNTIME_PROFILES',
      profile: config.id,
      profileLabel: config.label,
      totalPixels: config.totalPixels,
      strips: config.strips,
      pixelsPerStrip: config.pixelsPerStrip,
      fps: config.fps,
      active,
      enabled: Array.from(enabled),
      started,
      pushed,
      dropped,
      profileSwitches,
      lastFrameId,
      lastAt,
      lastDecision,
      profiles: listStep22COutputProfiles(),
      adapters: registry.getAllStatus()
    };
  }

  return {
    start,
    stop,
    tick,
    sendFrame,
    setActive,
    setEnabled,
    applyProfile,
    getStatus,
    getAdapter: (mode) => registry.getAdapter(normalizeOutputMode22C(mode))
  };
}
