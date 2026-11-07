import dgram from 'dgram';
import { buildDefaultEightStripUniverseMap } from './artnet_core.js';
import { artnetMasterFrameStore22EJ } from './artnet_master_frame_store_22ej.js';

export const STEP22GN_ARTNET_LIVE_INPUT_VERSION = 'STEP22GN_ARTNET_LIVE_INPUT_TO_MASTER_FRAMEBUS';

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function isArtNetPacket(buf) {
  return buf && buf.length >= 10
    && buf[0] === 0x41 && buf[1] === 0x72 && buf[2] === 0x74 && buf[3] === 0x2d
    && buf[4] === 0x4e && buf[5] === 0x65 && buf[6] === 0x74 && buf[7] === 0x00;
}

function parseArtDmx(buf) {
  if (!isArtNetPacket(buf) || buf.length < 18) return null;
  const opLo = buf[8];
  const opHi = buf[9];
  if (opLo !== 0x00 || opHi !== 0x50) return null; // OpDmx, little endian 0x5000
  const sequence = buf[12] || 0;
  const physical = buf[13] || 0;
  const universe = (buf[14] | (buf[15] << 8)) & 0x7fff;
  const length = ((buf[16] << 8) | buf[17]) & 0xffff;
  if (length <= 0 || length > 512 || buf.length < 18 + length) return null;
  return Object.freeze({ sequence, physical, universe, dmx: new Uint8Array(buf.subarray(18, 18 + length)) });
}

export function createArtNetLiveInput22GN(options = {}) {
  const state = {
    socket: null,
    running: false,
    startedAt: null,
    lastPacketAt: null,
    lastPublishAt: null,
    frameId: 0,
    packetCount: 0,
    ignoredCount: 0,
    publishCount: 0,
    errorCount: 0,
    lastError: null,
    lastRemote: null,
    universeHits: {},
    options: {
      bindIp: String(options.bindIp ?? process.env.LED_ARTNET_INPUT_BIND_IP ?? process.env.LED_ARTNET_BIND_IP ?? '').trim(),
      port: clampInt(options.port ?? process.env.LED_ARTNET_INPUT_PORT ?? 6454, 1, 65535, 6454),
      stripCount: clampInt(options.stripCount ?? process.env.LED_ARTNET_STRIP_COUNT ?? 8, 1, 64, 8),
      pixelsPerStrip: clampInt(options.pixelsPerStrip ?? process.env.LED_ARTNET_PIXELS_PER_STRIP ?? 300, 1, 2000, 300),
      pixelsPerUniverse: clampInt(options.pixelsPerUniverse ?? process.env.LED_ARTNET_PIXELS_PER_UNIVERSE ?? 170, 1, 170, 170),
      startUniverse: clampInt(options.startUniverse ?? options.universeStart ?? process.env.LED_ARTNET_START_UNIVERSE ?? 0, 0, 32767, 0),
      frameTimeoutMs: clampInt(options.frameTimeoutMs ?? process.env.LED_ARTNET_INPUT_FRAME_TIMEOUT_MS ?? 40, 5, 1000, 40),
      publishPartial: String(options.publishPartial ?? process.env.LED_ARTNET_INPUT_PUBLISH_PARTIAL ?? '1') !== '0',
      sourceName: String(options.sourceName || 'artnet-live-input-22gn')
    },
    pending: null,
    timer: null
  };

  function expectedBytes() {
    return state.options.stripCount * state.options.pixelsPerStrip * 3;
  }

  function universeMap() {
    return buildDefaultEightStripUniverseMap({
      stripCount: state.options.stripCount,
      pixelsPerStrip: state.options.pixelsPerStrip,
      pixelsPerUniverse: state.options.pixelsPerUniverse,
      startUniverse: state.options.startUniverse,
      outputIp: 'live-input'
    });
  }

  function resetPending() {
    const map = universeMap();
    state.pending = {
      frame: new Uint8Array(expectedBytes()),
      seen: new Set(),
      mapByUniverse: new Map(map.universes.map((entry) => [entry.universe, entry])),
      expectedUniverseCount: map.universeCount,
      createdAt: Date.now(),
      lastAt: 0
    };
  }

  function scheduleFlush() {
    if (state.timer) clearTimeout(state.timer);
    state.timer = setTimeout(() => flushPending('timeout'), state.options.frameTimeoutMs);
    state.timer.unref?.();
  }

  function flushPending(reason = 'complete') {
    if (!state.pending || state.pending.seen.size <= 0) return null;
    if (state.timer) {
      clearTimeout(state.timer);
      state.timer = null;
    }
    const complete = state.pending.seen.size >= state.pending.expectedUniverseCount;
    if (!complete && !state.options.publishPartial) return null;
    state.frameId += 1;
    const now = Date.now();
    const result = artnetMasterFrameStore22EJ.publish({
      frame: state.pending.frame,
      frameId: state.frameId,
      source: `${state.options.sourceName}:${reason}${complete ? ':complete' : ':partial'}`,
      stripCount: state.options.stripCount,
      pixelsPerStrip: state.options.pixelsPerStrip,
      format: 'rgb8',
      colorOrder: 'rgb'
    });
    state.publishCount += 1;
    state.lastPublishAt = now;
    resetPending();
    return result;
  }

  function acceptPacket(packet, rinfo = {}) {
    if (!state.pending) resetPending();
    // Some ArtNet tools label universes as 1-16 while the ArtNet wire value can be expected here as 0-15.
    // Keep the normal exact mapping first, then accept a safe 1-based fallback so live input does not stay silent.
    const exactEntry = state.pending.mapByUniverse.get(packet.universe);
    const oneBasedFallbackEntry = !exactEntry && state.options.startUniverse === 0
      ? state.pending.mapByUniverse.get(packet.universe - 1)
      : null;
    const entry = exactEntry || oneBasedFallbackEntry;
    if (!entry) {
      state.ignoredCount += 1;
      return;
    }
    const acceptedUniverse = entry.universe;
    const globalPixelStart = entry.strip * state.options.pixelsPerStrip + entry.startPixel;
    const byteStart = globalPixelStart * 3;
    const maxBytes = entry.length * 3;
    const copy = packet.dmx.subarray(0, Math.min(maxBytes, packet.dmx.length));
    state.pending.frame.set(copy, byteStart);
    state.pending.seen.add(acceptedUniverse);
    state.pending.lastAt = Date.now();
    const hitKey = exactEntry ? String(packet.universe) : `${packet.universe}->${acceptedUniverse}`;
    state.universeHits[hitKey] = (state.universeHits[hitKey] || 0) + 1;
    state.packetCount += 1;
    state.lastPacketAt = state.pending.lastAt;
    state.lastRemote = `${rinfo.address || '?'}:${rinfo.port || '?'}`;
    if (state.pending.seen.size >= state.pending.expectedUniverseCount) flushPending('complete');
    else scheduleFlush();
  }

  function start(nextOptions = {}) {
    if (state.running) return status();
    state.options = { ...state.options, ...Object.fromEntries(Object.entries(nextOptions).filter(([, v]) => v !== undefined && v !== null && v !== '')) };
    state.options.port = clampInt(state.options.port, 1, 65535, 6454);
    state.options.stripCount = clampInt(state.options.stripCount, 1, 64, 8);
    state.options.pixelsPerStrip = clampInt(state.options.pixelsPerStrip, 1, 2000, 300);
    state.options.pixelsPerUniverse = clampInt(state.options.pixelsPerUniverse, 1, 170, 170);
    state.options.startUniverse = clampInt(state.options.startUniverse ?? state.options.universeStart, 0, 32767, 0);
    resetPending();
    const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    state.socket = socket;
    socket.on('message', (msg, rinfo) => {
      try {
        const packet = parseArtDmx(msg);
        if (!packet) {
          state.ignoredCount += 1;
          return;
        }
        acceptPacket(packet, rinfo);
      } catch (error) {
        state.errorCount += 1;
        state.lastError = error?.message || String(error);
      }
    });
    socket.on('error', (error) => {
      state.errorCount += 1;
      state.lastError = error?.message || String(error);
      try { socket.close(); } catch {}
      state.running = false;
    });
    socket.bind(state.options.port, state.options.bindIp || undefined, () => {
      state.running = true;
      state.startedAt = Date.now();
      state.lastError = null;
      try { socket.setBroadcast(true); } catch {}
      console.log(`[artnet-live-input-22gn] listening ${state.options.bindIp || '0.0.0.0'}:${state.options.port} universes ${state.options.startUniverse}-${state.options.startUniverse + universeMap().universeCount - 1}`);
    });
    return status();
  }

  function stop() {
    if (state.timer) {
      clearTimeout(state.timer);
      state.timer = null;
    }
    try { state.socket?.close(); } catch {}
    state.socket = null;
    state.running = false;
    return status();
  }

  function status() {
    const now = Date.now();
    const map = universeMap();
    const pendingSeen = state.pending?.seen?.size || 0;
    return Object.freeze({
      ok: true,
      version: STEP22GN_ARTNET_LIVE_INPUT_VERSION,
      running: state.running,
      startedAt: state.startedAt,
      bindIp: state.options.bindIp || '0.0.0.0',
      port: state.options.port,
      stripCount: state.options.stripCount,
      pixelsPerStrip: state.options.pixelsPerStrip,
      pixelsPerUniverse: state.options.pixelsPerUniverse,
      startUniverse: state.options.startUniverse,
      universeRange: `${state.options.startUniverse}-${state.options.startUniverse + map.universeCount - 1}`,
      expectedUniverses: map.universeCount,
      expectedBytes: expectedBytes(),
      pendingUniverses: pendingSeen,
      packetCount: state.packetCount,
      ignoredCount: state.ignoredCount,
      publishCount: state.publishCount,
      errorCount: state.errorCount,
      lastError: state.lastError,
      lastRemote: state.lastRemote,
      lastPacketAgeMs: state.lastPacketAt ? now - state.lastPacketAt : null,
      lastPublishAgeMs: state.lastPublishAt ? now - state.lastPublishAt : null,
      universeHits: state.universeHits
    });
  }

  return Object.freeze({ start, stop, status });
}
