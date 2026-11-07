export const GENERATOR_CURVES_VERSION = 'STEP38E_GENERATOR_CURVES_MACROS_SMOOTHING';

const CURVE_MIN = 0;
const CURVE_MAX = 1;

function clamp01(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(CURVE_MIN, Math.min(CURVE_MAX, n));
}

function clampRate(value, fallback = 0.08) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0.005, Math.min(24, n));
}

function clampSmooth(value, fallback = 0.18) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(0.98, n));
}

function clampDivision(value, fallback = 4) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const allowed = [1, 2, 4, 8, 16, 32];
  return allowed.reduce((best, item) => Math.abs(item - n) < Math.abs(best - n) ? item : best, fallback);
}

function fract(value) {
  return value - Math.floor(value);
}

function smoothstep(edge0, edge1, value) {
  const t = clamp01((value - edge0) / Math.max(1e-6, edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function hash1(value, seed = 0) {
  return fract(Math.sin(value * 127.1 + seed * 311.7 + 13.37) * 43758.5453123);
}

export const GENERATOR_CURVE_LANE_DEFAULTS = Object.freeze([
  { id: 'energy', label: 'Energy', mode: 'manual', value: 0.72, rate: 0.08, depth: 0.20, smooth: 0.22, division: 4 },
  { id: 'density', label: 'Density', mode: 'manual', value: 0.62, rate: 0.05, depth: 0.18, smooth: 0.26, division: 8 },
  { id: 'speed', label: 'Speed', mode: 'manual', value: 0.54, rate: 0.035, depth: 0.16, smooth: 0.30, division: 16 },
  { id: 'colorShift', label: 'Color', mode: 'lfo', value: 0.36, rate: 0.04, depth: 0.42, smooth: 0.16, division: 8 },
  { id: 'feedback', label: 'Feedback', mode: 'manual', value: 0.28, rate: 0.05, depth: 0.16, smooth: 0.32, division: 8 },
  { id: 'warp', label: 'Warp', mode: 'lfo', value: 0.44, rate: 0.03, depth: 0.28, smooth: 0.22, division: 16 },
  { id: 'pulse', label: 'Pulse', mode: 'beat', value: 0.50, rate: 0.20, depth: 0.52, smooth: 0.10, division: 4 },
  { id: 'shimmer', label: 'Shimmer', mode: 'random', value: 0.30, rate: 1.50, depth: 0.24, smooth: 0.42, division: 8 }
]);

export const GENERATOR_MACRO_DEFAULTS = Object.freeze([
  { id: 'macro0', index: 0, label: 'Energy', target: 'energy', value: 0.72 },
  { id: 'macro1', index: 1, label: 'Density', target: 'density', value: 0.62 },
  { id: 'macro2', index: 2, label: 'Speed', target: 'speed', value: 0.54 },
  { id: 'macro3', index: 3, label: 'Color', target: 'colorShift', value: 0.36 },
  { id: 'macro4', index: 4, label: 'Feedback', target: 'feedback', value: 0.28 },
  { id: 'macro5', index: 5, label: 'Warp', target: 'warp', value: 0.44 },
  { id: 'macro6', index: 6, label: 'Pulse', target: 'pulse', value: 0.50 },
  { id: 'macro7', index: 7, label: 'Shimmer', target: 'shimmer', value: 0.30 }
]);

export function normalizeGeneratorCurveLane(input = {}, fallback = {}) {
  const mode = ['manual', 'lfo', 'beat', 'random'].includes(input.mode) ? input.mode : (fallback.mode || 'manual');
  return {
    ...fallback,
    ...input,
    id: String(input.id || fallback.id || '').trim(),
    label: String(input.label || fallback.label || input.id || fallback.id || 'Lane'),
    mode,
    value: clamp01(input.value, fallback.value ?? 0.5),
    rate: clampRate(input.rate, fallback.rate ?? 0.08),
    depth: clamp01(input.depth, fallback.depth ?? 0.2),
    smooth: clampSmooth(input.smooth, fallback.smooth ?? 0.2),
    division: clampDivision(input.division, fallback.division ?? 4)
  };
}

export function createDefaultGeneratorCurves() {
  return {
    version: GENERATOR_CURVES_VERSION,
    lanes: GENERATOR_CURVE_LANE_DEFAULTS.map((lane) => normalizeGeneratorCurveLane(lane, lane))
  };
}

export function normalizeGeneratorCurves(input = {}) {
  // Curves are normalized at control/storage boundaries and then reused by
  // both hot-path evaluators on every animation frame.
  if (input?.version === GENERATOR_CURVES_VERSION
    && Array.isArray(input.lanes)
    && input.lanes.length === GENERATOR_CURVE_LANE_DEFAULTS.length) return input;
  const byId = new Map((Array.isArray(input.lanes) ? input.lanes : []).map((lane) => [String(lane.id || ''), lane]));
  return {
    version: GENERATOR_CURVES_VERSION,
    lanes: GENERATOR_CURVE_LANE_DEFAULTS.map((fallback) => normalizeGeneratorCurveLane(byId.get(fallback.id) || fallback, fallback))
  };
}

export function createGeneratorCurveRuntime(initial = {}) {
  return {
    version: GENERATOR_CURVES_VERSION,
    lastAt: 0,
    values: { ...(initial.values || {}) },
    targets: { ...(initial.targets || {}) }
  };
}

function evaluateLane(lane, timeSeconds = 0, context = {}) {
  const base = clamp01(lane.value, 0.5);
  const depth = clamp01(lane.depth, 0);
  const rate = clampRate(lane.rate, 0.08);
  const phase = base * Math.PI * 2;
  if (lane.mode === 'lfo') {
    const wave = 0.5 + 0.5 * Math.sin(timeSeconds * Math.PI * 2 * rate + phase);
    return clamp01(base * (1 - depth) + wave * depth, base);
  }
  if (lane.mode === 'beat') {
    const bpm = Number(context.bpm || 145) || 145;
    const beat = Number(context.beat ?? (timeSeconds * bpm / 60)) || 0;
    const division = clampDivision(lane.division, 4);
    const phaseBeat = fract(beat / division);
    const pulse = 1 - smoothstep(0.04, 0.68, phaseBeat);
    return clamp01(base * (1 - depth) + pulse * depth, base);
  }
  if (lane.mode === 'random') {
    const step = Math.floor(timeSeconds * rate);
    const frac = fract(timeSeconds * rate);
    const a = hash1(step, lane.id.length + base * 17);
    const b = hash1(step + 1, lane.id.length + base * 17);
    const walk = a + (b - a) * smoothstep(0, 1, frac);
    return clamp01(base * (1 - depth) + walk * depth, base);
  }
  return base;
}

export function evaluateGeneratorCurves(curves, timeSeconds = 0, context = {}) {
  const normalized = normalizeGeneratorCurves(curves);
  const out = {};
  for (const lane of normalized.lanes) out[lane.id] = evaluateLane(lane, timeSeconds, context);
  return out;
}

export function smoothGeneratorCurveValues(curves, targetValues = {}, runtime = createGeneratorCurveRuntime(), timeSeconds = 0) {
  const normalized = normalizeGeneratorCurves(curves);
  const lastAt = Number(runtime.lastAt || 0);
  const dt = Math.max(0, Math.min(0.25, lastAt > 0 ? timeSeconds - lastAt : 0));
  const out = {};
  for (const lane of normalized.lanes) {
    const target = clamp01(targetValues[lane.id], lane.value);
    const prev = runtime.values[lane.id] == null ? target : clamp01(runtime.values[lane.id], target);
    const smooth = clampSmooth(lane.smooth, 0.2);
    const follow = smooth <= 0 ? 1 : Math.max(0.02, Math.min(1, 1 - Math.pow(smooth, Math.max(1, dt * 60))));
    const next = prev + (target - prev) * follow;
    out[lane.id] = clamp01(next, target);
    runtime.values[lane.id] = out[lane.id];
    runtime.targets[lane.id] = target;
  }
  runtime.lastAt = timeSeconds;
  return out;
}

export function macrosToPatchValues(macros = []) {
  const values = {};
  for (const macro of GENERATOR_MACRO_DEFAULTS) {
    values[macro.target] = clamp01(macros[macro.index], macro.value);
  }
  return values;
}

export function patchValuesToMacros(patch = {}) {
  return GENERATOR_MACRO_DEFAULTS.map((macro) => clamp01(patch[macro.target], macro.value));
}
