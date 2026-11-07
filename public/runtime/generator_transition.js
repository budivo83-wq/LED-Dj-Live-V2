export const GENERATOR_TRANSITION_VERSION = 'STEP38O_GENERATOR_PERFORMANCE_CROSSFADE';
export const GENERATOR_TRANSITION_CONFIG_KEY = 'budilight.generator.transition.v1';
export const GENERATOR_TRANSITION_STATUS_KEY = 'budilight.generator.transition.status.v1';

const DEFAULT_WIDTH = 300;
const DEFAULT_HEIGHT = 8;
const DEFAULT_TAKEOVER_MS = 900;
const DEFAULT_RELEASE_MS = 700;

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function clamp01(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(1, n));
}

function nowMs() {
  try { return performance.now(); } catch { return Date.now(); }
}

function safeJsonParse(text, fallback = {}) {
  try { return JSON.parse(text || '') || fallback; } catch { return fallback; }
}

function expectedLength(width = DEFAULT_WIDTH, height = DEFAULT_HEIGHT) {
  return Math.max(1, clampInt(width, 1, 65535, DEFAULT_WIDTH)) * Math.max(1, clampInt(height, 1, 64, DEFAULT_HEIGHT)) * 3;
}

function cloneFrame(frame) {
  if (!(frame instanceof Uint8Array)) return null;
  return new Uint8Array(frame);
}

function normalizeDurationMs(value, fallback = DEFAULT_TAKEOVER_MS) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(5000, Math.round(n)));
}

export function readGeneratorTransitionConfig(storage = globalThis.localStorage) {
  const raw = safeJsonParse(storage?.getItem?.(GENERATOR_TRANSITION_CONFIG_KEY) || '{}', {});
  return Object.freeze({
    version: GENERATOR_TRANSITION_VERSION,
    takeoverMs: normalizeDurationMs(raw.takeoverMs, DEFAULT_TAKEOVER_MS),
    releaseMs: normalizeDurationMs(raw.releaseMs, DEFAULT_RELEASE_MS),
    curve: ['linear', 'ease', 'smooth'].includes(String(raw.curve || '')) ? String(raw.curve) : 'smooth',
    capturePerformance: raw.capturePerformance !== false
  });
}

export function saveGeneratorTransitionConfig(config = {}, storage = globalThis.localStorage) {
  const next = {
    version: GENERATOR_TRANSITION_VERSION,
    takeoverMs: normalizeDurationMs(config.takeoverMs, DEFAULT_TAKEOVER_MS),
    releaseMs: normalizeDurationMs(config.releaseMs, DEFAULT_RELEASE_MS),
    curve: ['linear', 'ease', 'smooth'].includes(String(config.curve || '')) ? String(config.curve) : 'smooth',
    capturePerformance: config.capturePerformance !== false,
    updatedAt: Date.now()
  };
  try { storage?.setItem?.(GENERATOR_TRANSITION_CONFIG_KEY, JSON.stringify(next)); } catch {}
  return Object.freeze(next);
}

export function createGeneratorTransitionRuntime(config = {}) {
  return {
    version: GENERATOR_TRANSITION_VERSION,
    phase: 'idle',
    active: false,
    startAt: 0,
    durationMs: 0,
    mix: 1,
    source: '',
    sourceFrame: null,
    sourceFrameId: 0,
    sourceAgeMs: null,
    width: clampInt(config.width, 1, 65535, DEFAULT_WIDTH),
    height: clampInt(config.height, 1, 64, DEFAULT_HEIGHT),
    curve: ['linear', 'ease', 'smooth'].includes(String(config.curve || '')) ? String(config.curve) : 'smooth',
    note: 'idle',
    lastStatus: 'IDLE',
    updatedAt: Date.now()
  };
}

function publishStatus(runtime, storage = globalThis.localStorage) {
  const payload = {
    version: GENERATOR_TRANSITION_VERSION,
    phase: runtime.phase,
    active: runtime.active === true,
    mix: Number(runtime.mix || 0),
    durationMs: Number(runtime.durationMs || 0),
    source: String(runtime.source || ''),
    sourceFrameId: Number(runtime.sourceFrameId || 0),
    sourceAgeMs: runtime.sourceAgeMs == null ? null : Number(runtime.sourceAgeMs),
    note: String(runtime.note || ''),
    lastStatus: String(runtime.lastStatus || ''),
    updatedAt: Date.now()
  };
  try { globalThis.__budilightGeneratorTransition38O = payload; } catch {}
  try { storage?.setItem?.(GENERATOR_TRANSITION_STATUS_KEY, JSON.stringify(payload)); } catch {}
  return payload;
}

function easeValue(t, curve = 'smooth') {
  const x = clamp01(t, 0);
  if (curve === 'linear') return x;
  if (curve === 'ease') return x * x * (3 - 2 * x);
  // slightly softer: hold ends, faster middle
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}

function adaptFrameSize(frame, width, height) {
  const wanted = expectedLength(width, height);
  if (!(frame instanceof Uint8Array)) return null;
  if (frame.byteLength === wanted) return cloneFrame(frame);
  const out = new Uint8Array(wanted);
  out.set(frame.subarray(0, Math.min(frame.byteLength, wanted)), 0);
  return out;
}

export async function captureServerMasterFrame(options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const width = clampInt(options.width, 1, 65535, DEFAULT_WIDTH);
  const height = clampInt(options.height, 1, 64, DEFAULT_HEIGHT);
  if (typeof fetchImpl !== 'function') return Object.freeze({ ok: false, reason: 'fetch-unavailable', width, height, frame: null });
  const query = new URLSearchParams({
    maxAgeMs: String(clampInt(options.maxAgeMs, 50, 30000, 1800)),
    width: String(width),
    height: String(height),
    pixelsPerStrip: String(width),
    stripCount: String(height)
  });
  try {
    const response = await fetchImpl(`/api/artnet/master-mirror/frame-bin?${query.toString()}`, { cache: 'no-store' });
    if (!response?.ok) return Object.freeze({ ok: false, reason: `http-${response?.status || 0}`, width, height, frame: null });
    const buffer = await response.arrayBuffer();
    const frame = adaptFrameSize(new Uint8Array(buffer), width, height);
    if (!frame) return Object.freeze({ ok: false, reason: 'empty-frame', width, height, frame: null });
    return Object.freeze({
      ok: true,
      frame,
      width,
      height,
      source: response.headers?.get?.('X-LED-Source') || 'server-master-frame',
      frameId: Number(response.headers?.get?.('X-LED-Frame-Id') || 0),
      ageMs: Number(response.headers?.get?.('X-LED-Age-Ms') || 0),
      publishedAt: Number(response.headers?.get?.('X-LED-Published-At') || 0),
      reason: 'captured'
    });
  } catch (error) {
    return Object.freeze({ ok: false, reason: String(error?.message || error || 'capture-failed'), width, height, frame: null });
  }
}

export async function armGeneratorTakeoverTransition(runtime = createGeneratorTransitionRuntime(), options = {}) {
  const durationMs = normalizeDurationMs(options.durationMs, DEFAULT_TAKEOVER_MS);
  const width = clampInt(options.width, 1, 65535, runtime.width || DEFAULT_WIDTH);
  const height = clampInt(options.height, 1, 64, runtime.height || DEFAULT_HEIGHT);
  const curve = ['linear', 'ease', 'smooth'].includes(String(options.curve || '')) ? String(options.curve) : runtime.curve || 'smooth';
  let capture = { ok: false, reason: 'capture-disabled', frame: null };
  if (durationMs > 0 && options.capturePerformance !== false) {
    capture = await captureServerMasterFrame({ fetchImpl: options.fetchImpl, width, height, maxAgeMs: options.maxAgeMs || 1800 });
  }
  const next = {
    ...runtime,
    phase: durationMs > 0 ? 'takeover' : 'idle',
    active: durationMs > 0,
    startAt: nowMs(),
    durationMs,
    mix: durationMs > 0 ? 0 : 1,
    width,
    height,
    curve,
    sourceFrame: capture.ok ? capture.frame : null,
    source: capture.ok ? String(capture.source || 'captured-performance-master') : '',
    sourceFrameId: capture.ok ? Number(capture.frameId || 0) : 0,
    sourceAgeMs: capture.ok ? Number(capture.ageMs || 0) : null,
    note: durationMs > 0
      ? (capture.ok ? `takeover fade from ${capture.source || 'MASTER'} #${capture.frameId || '?'}` : `takeover fade without source frame (${capture.reason || 'no-capture'})`)
      : 'takeover cut',
    lastStatus: durationMs > 0 ? 'TAKEOVER_FADE' : 'CUT'
  };
  publishStatus(next, options.storage);
  return Object.freeze(next);
}

export function armGeneratorReleaseTransition(runtime = createGeneratorTransitionRuntime(), options = {}) {
  const durationMs = normalizeDurationMs(options.durationMs, DEFAULT_RELEASE_MS);
  const width = clampInt(options.width, 1, 65535, runtime.width || DEFAULT_WIDTH);
  const height = clampInt(options.height, 1, 64, runtime.height || DEFAULT_HEIGHT);
  const next = {
    ...runtime,
    phase: durationMs > 0 ? 'release' : 'idle',
    active: durationMs > 0,
    startAt: nowMs(),
    durationMs,
    mix: durationMs > 0 ? 1 : 0,
    width,
    height,
    curve: ['linear', 'ease', 'smooth'].includes(String(options.curve || '')) ? String(options.curve) : runtime.curve || 'smooth',
    sourceFrame: null,
    source: '',
    sourceFrameId: 0,
    sourceAgeMs: null,
    note: durationMs > 0 ? 'release fade to blackout before unlocking Performance' : 'release cut',
    lastStatus: durationMs > 0 ? 'RELEASE_FADE' : 'CUT'
  };
  publishStatus(next, options.storage);
  return Object.freeze(next);
}

function cloneRenderedWithFrame(rendered, frame, meta = {}) {
  return {
    ...rendered,
    frame,
    meta: {
      ...(rendered?.meta || {}),
      transition: true,
      ...meta
    }
  };
}

function mixFrames(sourceFrame, generatorFrame, alpha) {
  const gen = generatorFrame instanceof Uint8Array ? generatorFrame : null;
  if (!gen) return null;
  const out = new Uint8Array(gen.byteLength);
  const a = clamp01(alpha, 1);
  const b = 1 - a;
  if (sourceFrame instanceof Uint8Array && sourceFrame.byteLength === gen.byteLength) {
    for (let i = 0; i < gen.byteLength; i += 1) out[i] = Math.max(0, Math.min(255, Math.round(sourceFrame[i] * b + gen[i] * a)));
  } else {
    for (let i = 0; i < gen.byteLength; i += 1) out[i] = Math.max(0, Math.min(255, Math.round(gen[i] * a)));
  }
  return out;
}

export function applyGeneratorTransitionFrame(rendered, runtime = createGeneratorTransitionRuntime(), now = nowMs(), options = {}) {
  if (!rendered?.frame || !(rendered.frame instanceof Uint8Array)) return { rendered, runtime, done: true, mix: 1 };
  if (!runtime?.active || !runtime.durationMs || runtime.phase === 'idle') {
    publishStatus({ ...runtime, active: false, mix: 1, lastStatus: 'IDLE' }, options.storage);
    return { rendered, runtime: { ...runtime, active: false, phase: 'idle', mix: 1, lastStatus: 'IDLE' }, done: true, mix: 1 };
  }
  const current = Number.isFinite(Number(now)) ? Number(now) : nowMs();
  const startedAt = Number.isFinite(Number(runtime.startAt)) ? Number(runtime.startAt) : current;
  const elapsed = Math.max(0, current - startedAt);
  const progress = clamp01(elapsed / Math.max(1, Number(runtime.durationMs || 1)), 1);
  const eased = easeValue(progress, runtime.curve || 'smooth');
  const mix = runtime.phase === 'release' ? 1 - eased : eased;
  const frame = mixFrames(runtime.phase === 'takeover' ? runtime.sourceFrame : null, rendered.frame, mix) || rendered.frame;
  const done = progress >= 1;
  const nextRuntime = {
    ...runtime,
    active: !done,
    phase: done ? 'idle' : runtime.phase,
    mix: done ? (runtime.phase === 'release' ? 0 : 1) : mix,
    lastStatus: done ? `${String(runtime.phase || '').toUpperCase()}_DONE` : `${String(runtime.phase || '').toUpperCase()}_FADE`,
    updatedAt: Date.now()
  };
  const out = cloneRenderedWithFrame(rendered, frame, {
    transitionPhase: runtime.phase,
    transitionMix: mix,
    transitionDone: done,
    transitionSource: runtime.source || (runtime.phase === 'release' ? 'blackout' : 'none'),
    transitionVersion: GENERATOR_TRANSITION_VERSION
  });
  publishStatus(nextRuntime, options.storage);
  return { rendered: out, runtime: nextRuntime, done, mix };
}

export function formatGeneratorTransitionStatus(runtime = {}, config = {}) {
  const phase = String(runtime.phase || 'idle');
  const active = runtime.active === true;
  const mix = Math.round(clamp01(runtime.mix, phase === 'release' ? 1 : 0) * 100);
  const takeover = normalizeDurationMs(config.takeoverMs, DEFAULT_TAKEOVER_MS);
  const release = normalizeDurationMs(config.releaseMs, DEFAULT_RELEASE_MS);
  if (!active) return `IDLE · takeover ${takeover}ms · release ${release}ms`;
  const source = runtime.source ? ` · source ${runtime.source}${runtime.sourceFrameId ? ` #${runtime.sourceFrameId}` : ''}` : '';
  return `${phase.toUpperCase()} · ${mix}% generator · ${runtime.durationMs || 0}ms${source}`;
}

export function buildGeneratorTransitionReport(runtime = {}, config = {}) {
  return [
    'Generator Transition STEP38O',
    `phase: ${runtime.phase || 'idle'}`,
    `active: ${runtime.active === true}`,
    `mix: ${Math.round(clamp01(runtime.mix, 0) * 100)}%`,
    `takeoverMs: ${normalizeDurationMs(config.takeoverMs, DEFAULT_TAKEOVER_MS)}`,
    `releaseMs: ${normalizeDurationMs(config.releaseMs, DEFAULT_RELEASE_MS)}`,
    `curve: ${config.curve || runtime.curve || 'smooth'}`,
    `source: ${runtime.source || '-'}`,
    `sourceFrameId: ${runtime.sourceFrameId || 0}`,
    `note: ${runtime.note || '-'}`
  ].join('\n');
}
