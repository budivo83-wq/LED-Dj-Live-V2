import { getRuntimeFrameAuthority } from './frame_authority.js';

export const GENERATOR_BRIDGE_VERSION = 'STEP38L_GENERATOR_TAKES_MASTER_OUTPUT_LOCK';
export const GENERATOR_STATE_KEY = 'budilight.generator.state.v1';
export const GENERATOR_LIVE_OWNER = 'generator-live-master-frame-source';
export const GENERATOR_LIVE_SOURCE = 'generator-live-master-frame';
export const GENERATOR_LIVE_LOCK_KEY = 'budilight.generator.live.lock.v1';

const DEFAULT_LIVE_FPS = 60;
const DEFAULT_WIDTH = 300;
const DEFAULT_HEIGHT = 8;
const SNAPSHOT_CACHE_MS = 200;

function nowMs() {
  try { return performance.now(); } catch { return Date.now(); }
}

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function safeJsonParse(text, fallback = {}) {
  try { return JSON.parse(text || '') || fallback; } catch { return fallback; }
}

function clonePatchSafe(patch) {
  if (!patch || typeof patch !== 'object') return {};
  try { return JSON.parse(JSON.stringify(patch)); } catch { return { name: String(patch.name || 'Generator Patch') }; }
}

function isShellViewOnly() {
  try {
    const params = new URLSearchParams(location.search || '');
    return params.get('shellView') === '1' || (window.top && window.top !== window);
  } catch { return false; }
}

function getFrameAuthority() {
  try { return getRuntimeFrameAuthority(); } catch { return window.__ledFrameAuthority || null; }
}

function normalizeRendered(rendered) {
  const frame = rendered?.frame instanceof Uint8Array ? rendered.frame : null;
  const width = clampInt(rendered?.width, 1, 65535, DEFAULT_WIDTH);
  const height = clampInt(rendered?.height, 1, 64, DEFAULT_HEIGHT);
  const expected = width * height * 3;
  if (!frame || frame.byteLength !== expected) return null;
  return { frame, width, height };
}

function setLiveLock(active, detail = {}) {
  const payload = {
    version: GENERATOR_BRIDGE_VERSION,
    owner: active ? GENERATOR_LIVE_OWNER : '',
    active: active === true,
    source: GENERATOR_LIVE_SOURCE,
    at: Date.now(),
    ...detail
  };
  // The lock is control-plane state. Keep the in-memory heartbeat every
  // frame, but do not synchronously hit localStorage/postMessage at output
  // FPS; those operations can stall the render task and create jitter.
  const heartbeat = detail.heartbeat === true;
  const persistHeartbeat = !heartbeat || Date.now() - lastLiveLockPersistAt >= 500;
  if (persistHeartbeat) {
    lastLiveLockPersistAt = Date.now();
    try { localStorage.setItem(GENERATOR_LIVE_LOCK_KEY, JSON.stringify(payload)); } catch {}
  }
  try { window.__budilightGeneratorLiveLock38D = payload; } catch {}
  return payload;
}

let lastLiveLockPersistAt = 0;

function publishBridgeSnapshot(snapshot) {
  const now = Date.now();
  if (now - lastBridgeSnapshotAt < 250) return;
  lastBridgeSnapshotAt = now;
  try { window.__budilightGeneratorBridge38D = snapshot; } catch {}
  try { localStorage.setItem('budilight.generator.bridge.snapshot.v1', JSON.stringify({ ...snapshot, recent: undefined })); } catch {}
  try { window.parent?.postMessage({ type: 'led-generator-bridge', detail: snapshot }, '*'); } catch {}
}

let lastBridgeSnapshotAt = 0;

function createInitialState(options = {}) {
  return {
    version: GENERATOR_BRIDGE_VERSION,
    active: false,
    mode: 'released',
    owner: '',
    source: GENERATOR_LIVE_SOURCE,
    shellViewOnly: isShellViewOnly(),
    directServerMirror: options.directServerMirror !== false,
    localFrameBus: options.localFrameBus !== false,
    fps: clampInt(options.fps, 1, 60, DEFAULT_LIVE_FPS),
    width: clampInt(options.width, 1, 65535, DEFAULT_WIDTH),
    height: clampInt(options.height, 1, 64, DEFAULT_HEIGHT),
    frameId: 0,
    publishedLocal: 0,
    serverSent: 0,
    serverSkipped: 0,
    serverErrors: 0,
    rejected: 0,
    droppedByFps: 0,
    lastPublishAt: 0,
    lastPublishWallAt: 0,
    lastServerAt: 0,
    lastServerWallAt: 0,
    lastFrameGapMs: 0,
    avgFrameGapMs: 0,
    lastError: '',
    lastServerStatus: '',
    lastFrameBusId: 0,
    lastByteLength: 0,
    lastRenderMs: 0,
    avgRenderMs: 0,
    lastPublishMs: 0,
    avgPublishMs: 0,
    lastServerMs: 0,
    avgServerMs: 0,
    lastPatchName: '',
    recent: []
  };
}

function pushRecent(state, type, message, extra = {}) {
  const item = { at: Date.now(), t: Math.round(nowMs()), type, message: String(message || '').slice(0, 160), ...extra };
  state.recent.push(item);
  while (state.recent.length > 24) state.recent.shift();
  return item;
}

function emaMetric(previous, value, alpha = 0.14) {
  const n = Number(value);
  if (!Number.isFinite(n)) return Number(previous || 0);
  if (!Number.isFinite(Number(previous)) || Number(previous) <= 0) return n;
  return Number(previous) * (1 - alpha) + n * alpha;
}

async function postServerMasterFrame(state, packet) {
  const serverStart = nowMs();
  if (!state.directServerMirror || typeof fetch !== 'function') return { ok: false, skipped: true, reason: 'direct-server-disabled' };
  if (state.serverInFlight) {
    state.serverSkipped += 1;
    state.pendingServerPacket = packet;
    return { ok: false, skipped: true, reason: 'server-upload-in-flight-latest-queued' };
  }
  const query = new URLSearchParams({
    source: GENERATOR_LIVE_SOURCE,
    frameId: String(packet.frameId || 0),
    stripCount: String(packet.height || DEFAULT_HEIGHT),
    pixelsPerStrip: String(packet.width || DEFAULT_WIDTH),
    width: String(packet.width || DEFAULT_WIDTH),
    height: String(packet.height || DEFAULT_HEIGHT),
    format: 'rgb8',
    colorOrder: 'rgb'
  });
  state.serverInFlight = true;
  try {
    const response = await fetch(`/api/artnet/master-mirror/frame-bin?${query.toString()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      cache: 'no-store',
      keepalive: false,
      body: packet.frame
    });
    if (!response.ok) {
      let message = response.statusText || `HTTP ${response.status}`;
      try { message = (await response.json())?.error || message; } catch {}
      throw new Error(message);
    }
    state.serverSent += 1;
    state.lastServerAt = nowMs();
    state.lastServerWallAt = Date.now();
    state.lastServerMs = Math.max(0, state.lastServerAt - serverStart);
    state.avgServerMs = emaMetric(state.avgServerMs, state.lastServerMs, 0.12);
    state.lastServerStatus = `204 master mirror accepted · ${state.lastServerMs.toFixed(1)}ms`;
    return { ok: true, status: 204 };
  } catch (error) {
    state.serverErrors += 1;
    state.lastError = String(error?.message || error || 'generator-server-master-upload-failed').slice(0, 240);
    state.lastServerStatus = state.lastError;
    pushRecent(state, 'server-error', state.lastError);
    return { ok: false, error: state.lastError };
  } finally {
    state.serverInFlight = false;
    const pending = state.pendingServerPacket;
    state.pendingServerPacket = null;
    if (pending && state.active) {
      setTimeout(() => { postServerMasterFrame(state, pending).catch(() => {}); }, 0);
    }
  }
}

export function saveGeneratorState(state, storage = globalThis.localStorage) {
  try { storage?.setItem?.(GENERATOR_STATE_KEY, JSON.stringify({ ...state, savedAt: Date.now() })); } catch {}
}

export function loadGeneratorState(storage = globalThis.localStorage) {
  try { return safeJsonParse(storage?.getItem?.(GENERATOR_STATE_KEY) || '{}', {}); } catch { return {}; }
}

export function publishGeneratorPreviewHeartbeat(detail = {}) {
  const payload = {
    type: 'budilight-generator-preview-heartbeat',
    version: GENERATOR_BRIDGE_VERSION,
    mode: 'preview',
    detail,
    at: Date.now()
  };
  try { window.__budilightGeneratorPreview38D = payload; } catch {}
  try { localStorage.setItem('budilight.generator.preview.heartbeat', JSON.stringify(payload)); } catch {}
  try { window.parent?.postMessage({ type: 'led-preview-frame', source: 'generator', detail: payload }, '*'); } catch {}
  return payload;
}

export function createGeneratorLiveBridge(options = {}) {
  const state = createInitialState(options);
  let lastSendAt = 0;
  let lastSnapshotAt = 0;
  let cachedSnapshot = null;

  function snapshot(force = true) {
    const now = Date.now();
    // Snapshot consumers are control-plane diagnostics. Reusing the most
    // recent snapshot keeps the 60 FPS publish path from allocating a full
    // state copy and recent-event slice on every frame.
    if (!force && cachedSnapshot && now - lastSnapshotAt < SNAPSHOT_CACHE_MS) return cachedSnapshot;
    const out = {
      ...state,
      serverInFlight: Boolean(state.serverInFlight),
      pendingServer: Boolean(state.pendingServerPacket),
      recent: state.recent.slice(-12)
    };
    cachedSnapshot = out;
    lastSnapshotAt = now;
    publishBridgeSnapshot(out);
    return out;
  }

  function start(startOptions = {}) {
    state.active = true;
    state.mode = 'live-master';
    state.owner = GENERATOR_LIVE_OWNER;
    state.width = clampInt(startOptions.width ?? state.width, 1, 65535, DEFAULT_WIDTH);
    state.height = clampInt(startOptions.height ?? state.height, 1, 64, DEFAULT_HEIGHT);
    state.fps = clampInt(startOptions.fps ?? state.fps, 1, 60, DEFAULT_LIVE_FPS);
    state.directServerMirror = startOptions.directServerMirror !== false;
    state.localFrameBus = startOptions.localFrameBus !== false;
    state.lastError = '';
    lastSendAt = 0;
    state.lastFrameGapMs = 0;
    state.avgFrameGapMs = 0;
    state.lastPublishWallAt = Date.now();
    setLiveLock(true, { width: state.width, height: state.height, fps: state.fps, directServerMirror: state.directServerMirror, lastPublishWallAt: state.lastPublishWallAt });
    pushRecent(state, 'start', `Generator LIVE MASTER started ${state.width}x${state.height}@${state.fps}`);
    return snapshot(true);
  }

  function stop(reason = 'released') {
    state.active = false;
    state.mode = 'released';
    state.owner = '';
    state.pendingServerPacket = null;
    setLiveLock(false, { reason });
    pushRecent(state, 'stop', reason);
    return snapshot(true);
  }

  function publish(rendered, context = {}) {
    const publishStart = nowMs();
    if (!state.active) return { ok: false, skipped: true, reason: 'generator-live-not-active', snapshot: snapshot() };
    const normalized = normalizeRendered(rendered);
    if (!normalized) {
      state.rejected += 1;
      state.lastError = 'invalid-generator-frame-size';
      return { ok: false, skipped: false, reason: state.lastError, snapshot: snapshot() };
    }
    const now = nowMs();
    const minGap = 1000 / Math.max(1, state.fps || DEFAULT_LIVE_FPS);
    if (lastSendAt && now - lastSendAt < minGap * 0.72) {
      state.droppedByFps += 1;
      return { ok: false, skipped: true, reason: 'generator-live-fps-gate', snapshot: state };
    }
    state.lastFrameGapMs = lastSendAt ? Math.max(0, now - lastSendAt) : 0;
    if (state.lastFrameGapMs > 0) state.avgFrameGapMs = emaMetric(state.avgFrameGapMs, state.lastFrameGapMs, 0.10);
    lastSendAt = now;
    state.frameId += 1;
    state.lastPublishAt = now;
    state.lastPublishWallAt = Date.now();
    setLiveLock(true, { width: state.width, height: state.height, fps: state.fps, directServerMirror: state.directServerMirror, frameId: state.frameId, heartbeat: true, lastPublishWallAt: state.lastPublishWallAt, lastFrameGapMs: state.lastFrameGapMs });
    state.lastRenderMs = Math.max(0, Number(rendered?.meta?.renderMs || context.renderMs || 0) || 0);
    state.avgRenderMs = emaMetric(state.avgRenderMs, state.lastRenderMs, 0.12);
    state.lastByteLength = normalized.frame.byteLength;
    state.lastPatchName = String(context.patch?.name || rendered?.patch?.name || 'Generator Patch');
    const packet = {
      frame: normalized.frame,
      width: normalized.width,
      height: normalized.height,
      frameId: state.frameId,
      source: GENERATOR_LIVE_SOURCE,
      meta: {
        generatorBridgeVersion: GENERATOR_BRIDGE_VERSION,
        owner: GENERATOR_LIVE_OWNER,
        mode: 'live-master',
        outputEnabled: true,
        patchName: state.lastPatchName,
        beat: Number(rendered?.meta?.beat || context.beat || 0),
        bpm: Number(rendered?.meta?.bpm || context.bpm || 0)
      }
    };

    if (state.localFrameBus) {
      try {
        const authority = getFrameAuthority();
        const fbPacket = authority?.publishFrame?.({
          frame: packet.frame,
          width: packet.width,
          height: packet.height,
          source: GENERATOR_LIVE_SOURCE,
          outputEnabled: true,
          renderMs: Number(rendered?.meta?.renderMs || context.renderMs || 0),
          meta: packet.meta
        });
        if (fbPacket) {
          state.publishedLocal += 1;
          state.lastFrameBusId = Number(fbPacket.frameId || 0);
        }
      } catch (error) {
        state.lastError = String(error?.message || error || 'generator-local-framebus-publish-failed').slice(0, 240);
        pushRecent(state, 'framebus-error', state.lastError);
      }
    }

    state.lastPublishMs = Math.max(0, nowMs() - publishStart);
    state.avgPublishMs = emaMetric(state.avgPublishMs, state.lastPublishMs, 0.16);
    postServerMasterFrame(state, packet).then(() => snapshot(false)).catch(() => snapshot(false));
    return { ok: true, skipped: false, packet, snapshot: snapshot(false), publishMs: state.lastPublishMs };
  }

  function setOptions(next = {}) {
    if (next.fps != null) state.fps = clampInt(next.fps, 1, 60, state.fps || DEFAULT_LIVE_FPS);
    if (next.width != null) state.width = clampInt(next.width, 1, 65535, state.width || DEFAULT_WIDTH);
    if (next.height != null) state.height = clampInt(next.height, 1, 64, state.height || DEFAULT_HEIGHT);
    if (next.directServerMirror != null) state.directServerMirror = next.directServerMirror !== false;
    if (next.localFrameBus != null) state.localFrameBus = next.localFrameBus !== false;
    return snapshot(true);
  }

  return Object.freeze({ version: GENERATOR_BRIDGE_VERSION, start, stop, publish, setOptions, snapshot });
}
