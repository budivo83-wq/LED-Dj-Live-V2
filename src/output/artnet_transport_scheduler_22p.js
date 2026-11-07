import { buildDefaultEightStripUniverseMap } from './artnet_core.js';
import { createArtNetSenderEngine } from './artnet_sender_engine.js';
import { createArtnetUdpTransport } from './artnet_udp_transport.js';
import { createArtNetFrameSyncMonitor22T } from './artnet_frame_sync_monitor_22t.js';
import { ARTNET_LIVE_DEFAULTS } from '../../shared/artnet_live_defaults.js';

function clampInt(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function normalizeRgb(frame) {
  const src = frame?.rgb || frame?.frame || frame?.payload || frame;
  if (src instanceof Uint8Array) return src;
  if (Array.isArray(src)) return Uint8Array.from(src.map((v) => clampInt(v, 0, 0, 255)));
  return new Uint8Array(0);
}

export function createArtNetTransportScheduler22P(options = {}) {
  const config = {
    host: String(options.host || options.ip || process.env.LED_ARTNET_TARGET_IP || ARTNET_LIVE_DEFAULTS.outputIp),
    port: clampInt(options.port || process.env.LED_ARTNET_TARGET_PORT, ARTNET_LIVE_DEFAULTS.port, 1, 65535),
    bindIp: String(options.bindIp || options.localAddress || process.env.LED_ARTNET_BIND_IP || '').trim(),
    fps: clampInt(options.fps || process.env.LED_ARTNET_FPS, ARTNET_LIVE_DEFAULTS.fps, 1, 120),
    stripCount: clampInt(options.stripCount || process.env.LED_ARTNET_STRIP_COUNT, 8, 1, 64),
    pixelsPerStrip: clampInt(options.pixelsPerStrip || process.env.LED_ARTNET_PIXELS_PER_STRIP, 300, 1, 4096),
    pixelsPerUniverse: clampInt(options.pixelsPerUniverse || process.env.LED_ARTNET_PIXELS_PER_UNIVERSE, ARTNET_LIVE_DEFAULTS.pixelsPerUniverse, 1, 170),
    startUniverse: clampInt(options.startUniverse || process.env.LED_ARTNET_START_UNIVERSE, ARTNET_LIVE_DEFAULTS.universeStart, 0, 32767),
    artSync: options.artSync !== false,
    dryRun: options.dryRun !== false
  };

  const liveConfirmPhrase = 'ARTNET LIVE WRITE';
  let liveWriteArmed = options.liveWriteArmed === true && config.dryRun === false;
  let liveWriteArmedAt = liveWriteArmed ? Date.now() : 0;
  let lastSafetyAction = Object.freeze({ action: 'boot', dryRun: config.dryRun, liveWriteArmed, at: Date.now() });

  const universeMap = buildDefaultEightStripUniverseMap({
    stripCount: config.stripCount,
    pixelsPerStrip: config.pixelsPerStrip,
    pixelsPerUniverse: config.pixelsPerUniverse,
    startUniverse: config.startUniverse,
    outputIp: config.host,
    enabled: true
  });

  const udp = options.transport || createArtnetUdpTransport({ host: config.host, port: config.port, bindIp: config.bindIp });
  const txLog = [];
  const txLogEnabled = options.txLog === true || process.env.LED_ARTNET_TX_LOG === '1';
  let txLogSampleCountdown = 0;
  const frameSyncMonitor22T = createArtNetFrameSyncMonitor22T({
    expectedUniverses: universeMap.universeCount,
    fps: config.fps,
    artSync: config.artSync
  });

  const sender = createArtNetSenderEngine({
    universeMap,
    fps: config.fps,
    artSync: config.artSync,
    target: { host: config.host, port: config.port },
    sendPacket: (packet, meta = {}) => {
      const host = meta.host || config.host;
      const port = meta.port || config.port;
      if (txLogEnabled || txLogSampleCountdown <= 0) {
        const record = {
          at: Date.now(),
          universe: meta.universe,
          opCode: meta.opCode,
          bytes: packet?.byteLength || packet?.length || 0,
          host,
          port,
          dryRun: config.dryRun
        };
        txLog.push(record);
        if (txLog.length > 16) txLog.shift();
        txLogSampleCountdown = txLogEnabled ? 0 : 120;
      } else {
        txLogSampleCountdown -= 1;
      }
      if (!config.dryRun && liveWriteArmed) {
        if (!udp.isConnected?.()) udp.connect?.();
        udp.send(packet, host, port);
      }
    }
  });

  let lastValidation = null;
  let lastResult = null;

  function validateFrame(frame = {}) {
    const rgb = normalizeRgb(frame);
    const expectedPixels = universeMap.totalPixels;
    const expectedBytes = expectedPixels * 3;
    const ok = rgb.length === expectedBytes;
    lastValidation = Object.freeze({
      ok,
      protocol: 'artnet',
      expectedPixels,
      expectedBytes,
      actualBytes: rgb.length,
      universeCount: universeMap.universeCount,
      reason: ok ? 'ok' : 'ARTNET_FRAME_SIZE_MISMATCH'
    });
    return lastValidation;
  }

  function sendFrame(frame = {}, sendOptions = {}) {
    const validation = validateFrame(frame);
    if (!validation.ok && sendOptions.force !== true) {
      lastResult = Object.freeze({ ok: false, blocked: true, validation });
      frameSyncMonitor22T.recordFrame({ validation, result: lastResult, dryRun: config.dryRun, liveWriteArmed });
      return lastResult;
    }
    lastResult = sender.sendFrame({ rgb: normalizeRgb(frame) });
    frameSyncMonitor22T.recordFrame({ validation, result: lastResult, dryRun: config.dryRun, liveWriteArmed });
    return lastResult;
  }

  function buildTestFrame(pattern = 'segment-markers') {
    const rgb = new Uint8Array(universeMap.totalPixels * 3);
    for (let strip = 0; strip < universeMap.stripCount; strip += 1) {
      const base = strip * universeMap.pixelsPerStrip * 3;
      for (let px = 0; px < universeMap.pixelsPerStrip; px += 1) {
        const i = base + px * 3;
        if (pattern === 'all-red') rgb[i] = 96;
        else if (pattern === 'all-green') rgb[i + 1] = 96;
        else if (pattern === 'all-blue') rgb[i + 2] = 96;
        else if (px < 10) {
          rgb[i] = strip % 3 === 0 ? 120 : 0;
          rgb[i + 1] = strip % 3 === 1 ? 120 : 0;
          rgb[i + 2] = strip % 3 === 2 ? 120 : 0;
        }
      }
    }
    return rgb;
  }

  return Object.freeze({
    getStatus() {
      return Object.freeze({
        ok: true,
        version: 'step22p-artnet-transport-scheduler',
        config,
        universeMap,
        dryRun: config.dryRun,
        liveWriteArmed,
        liveWriteArmedAt,
        liveConfirmPhrase,
        liveWriteAllowed: config.dryRun === false && liveWriteArmed === true,
        lastSafetyAction,
        lastValidation,
        lastResult,
        sender: sender.getStats(),
        udp: udp.getStats?.() || null,
        frameSync22T: frameSyncMonitor22T.getSnapshot(),
        txLog: Object.freeze([...txLog])
      });
    },
    validateFrame,
    sendFrame,
    sendTestFrame(pattern = 'segment-markers') {
      return sendFrame({ rgb: buildTestFrame(pattern) }, { force: false });
    },
    buildTestFrame,
    setDryRun(value = true, reason = 'manual') {
      config.dryRun = value !== false;
      if (config.dryRun) {
        liveWriteArmed = false;
        liveWriteArmedAt = 0;
        udp.disconnect?.();
      }
      lastSafetyAction = Object.freeze({ action: 'set-dry-run', dryRun: config.dryRun, liveWriteArmed, reason: String(reason || 'manual'), at: Date.now() });
      return this.getStatus();
    },
    armLiveWrite(request = {}) {
      // STEP22FZ: operator build no longer requires the typed confirmation phrase.
      // The UI still validates the 8x300 frame and keeps PANIC blackout available,
      // but enabling ArtNet from Settings must actually enable live write immediately.
      const phrase = String(request.confirm || request.phrase || '').trim();
      const noPhraseProvided = !('confirm' in Object(request || {})) && !('phrase' in Object(request || {}));
      const preflight = validateFrame({ rgb: buildTestFrame('segment-markers') });
      if (!noPhraseProvided && phrase && phrase !== liveConfirmPhrase) {
        config.dryRun = true;
        liveWriteArmed = false;
        liveWriteArmedAt = 0;
        lastSafetyAction = Object.freeze({ action: 'arm-live-denied', reason: 'CONFIRM_PHRASE_REQUIRED', expectedConfirm: liveConfirmPhrase, at: Date.now() });
        return Object.freeze({ ok: false, armed: false, dryRun: config.dryRun, reason: 'CONFIRM_PHRASE_REQUIRED', expectedConfirm: liveConfirmPhrase, preflight, status: this.getStatus() });
      }
      if (!preflight.ok) {
        config.dryRun = true;
        liveWriteArmed = false;
        liveWriteArmedAt = 0;
        lastSafetyAction = Object.freeze({ action: 'arm-live-denied', reason: 'PREFLIGHT_FAILED', preflight, at: Date.now() });
        return Object.freeze({ ok: false, armed: false, dryRun: config.dryRun, reason: 'PREFLIGHT_FAILED', preflight, status: this.getStatus() });
      }
      if (!String(config.bindIp || '').trim()) {
        config.dryRun = true;
        liveWriteArmed = false;
        liveWriteArmedAt = 0;
        lastSafetyAction = Object.freeze({ action: 'arm-live-denied', reason: 'BIND_IP_REQUIRED_NO_AUTO_ROUTE', preflight, at: Date.now() });
        return Object.freeze({ ok: false, armed: false, dryRun: config.dryRun, reason: 'BIND_IP_REQUIRED_NO_AUTO_ROUTE', preflight, status: this.getStatus() });
      }
      config.dryRun = false;
      liveWriteArmed = true;
      liveWriteArmedAt = Date.now();
      lastSafetyAction = Object.freeze({ action: 'arm-live', dryRun: config.dryRun, liveWriteArmed, preflight, at: liveWriteArmedAt });
      return Object.freeze({ ok: true, armed: true, dryRun: config.dryRun, preflight, status: this.getStatus() });
    },
    panicBlackout(reason = 'manual-panic') {
      const wasLive = config.dryRun === false && liveWriteArmed === true;
      let blackoutResult = null;
      if (wasLive) {
        const rgb = new Uint8Array(universeMap.totalPixels * 3);
        blackoutResult = sendFrame({ rgb }, { force: true });
      }
      config.dryRun = true;
      liveWriteArmed = false;
      liveWriteArmedAt = 0;
      udp.disconnect?.();
      lastSafetyAction = Object.freeze({ action: 'panic-blackout', reason: String(reason || 'manual-panic'), wasLive, blackoutResult, at: Date.now() });
      return Object.freeze({ ok: true, dryRun: config.dryRun, armed: liveWriteArmed, wasLive, blackoutResult, status: this.getStatus() });
    },
    connect() { return config.dryRun || !liveWriteArmed ? true : udp.connect?.(); },
    disconnect() { return udp.disconnect?.(); },
    poll() { return config.dryRun || !liveWriteArmed ? false : udp.broadcastPoll?.(); },
    getFrameSyncMonitor22T() { return frameSyncMonitor22T.getSnapshot(); },
    resetFrameSyncMonitor22T(reason = 'api-reset') { return frameSyncMonitor22T.reset(reason); },
    getDiscoveredNodes() { return udp.getDiscoveredNodes?.() || Object.freeze([]); }
  });
}
