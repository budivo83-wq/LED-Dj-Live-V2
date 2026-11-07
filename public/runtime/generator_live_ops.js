import { normalizeGeneratorPatch, GENERATOR_DEFAULT_PATCH } from './generator_engine.js';
import { createDefaultGeneratorGraph, normalizeGeneratorGraph, updateGeneratorGraphNode, graphToModuleFlags } from './generator_graph.js';
import { createDefaultGeneratorCurves, normalizeGeneratorCurves, patchValuesToMacros } from './generator_curves.js';
import { readGeneratorSettingsOutputFps, persistGeneratorLiveFpsFromSettings, normalizeGeneratorSettingsFps } from './generator_settings_fps.js';

export const GENERATOR_LIVE_OPS_VERSION = 'STEP38M_GENERATOR_USES_SETTINGS_OUTPUT_FPS';
export const GENERATOR_LIVE_FPS_KEY = 'budilight.generator.live.fps.v1';

function clamp01(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(1, n));
}

function clampFps(value, fallback = 60) {
  return normalizeGeneratorSettingsFps(value, fallback);
}

function clone(value) {
  try { return JSON.parse(JSON.stringify(value)); } catch { return value; }
}

function setNode(graph, id, updates) {
  return updateGeneratorGraphNode(graph, id, updates);
}

function makeCurvesFromPatch(patch, mode = 'manual', options = {}) {
  const base = createDefaultGeneratorCurves();
  const patchValues = normalizeGeneratorPatch(patch);
  const lanes = base.lanes.map((lane) => ({
    ...lane,
    value: clamp01(patchValues[lane.id], lane.value),
    mode: options[lane.id]?.mode || mode,
    depth: clamp01(options[lane.id]?.depth ?? lane.depth ?? 0, 0),
    rate: Number(options[lane.id]?.rate ?? lane.rate ?? 0.08),
    smooth: clamp01(options[lane.id]?.smooth ?? 0.72, 0.72),
    division: Number(options[lane.id]?.division ?? lane.division ?? 4)
  }));
  return normalizeGeneratorCurves({ ...base, lanes });
}

export const GENERATOR_SAFE_SCENES = Object.freeze([
  Object.freeze({ id: 'safe-calm', name: 'Safe Calm Plasma', intent: 'low-energy preview/live base' }),
  Object.freeze({ id: 'safe-build', name: 'Safe Build Tunnel', intent: 'controlled rising movement' }),
  Object.freeze({ id: 'safe-drop', name: 'Safe Drop Gate', intent: 'strong but bounded rhythmic hit' }),
  Object.freeze({ id: 'safe-afterhours', name: 'Safe Afterhours Void', intent: 'dark slow decompression' }),
  Object.freeze({ id: 'safe-diagnostic', name: 'Safe Diagnostic Grid', intent: 'visible mapping without brutal brightness' }),
  Object.freeze({ id: 'safe-blackout', name: 'Blackout Patch', intent: 'all output dark' })
]);

export function listGeneratorSafeScenes() {
  return GENERATOR_SAFE_SCENES.map((scene) => ({ ...scene }));
}

export function normalizeGeneratorSafeSceneId(id = '') {
  const value = String(id || '').trim();
  return GENERATOR_SAFE_SCENES.some((scene) => scene.id === value) ? value : GENERATOR_SAFE_SCENES[0].id;
}

export function getStoredGeneratorLiveFps(storage = globalThis.localStorage, fallback = 60) {
  try { return readGeneratorSettingsOutputFps(storage, fallback).fps; } catch { return clampFps(fallback, 60); }
}

export function storeGeneratorLiveFps(value, storage = globalThis.localStorage) {
  // STEP38M: Generator Live FPS is no longer an independent operator value
  // when Settings has a real output FPS. Keep this legacy writer useful for
  // older tests/tools that do not provide Settings storage.
  const resolved = readGeneratorSettingsOutputFps(storage, value);
  const hasSettingsAuthority = String(resolved.source || '').startsWith('settings.') || String(resolved.source || '') === 'budilightArtNetMasterMirrorFps22EJ';
  const effective = hasSettingsAuthority ? resolved : { fps: clampFps(value, 60), source: 'legacy-write', raw: value, capped: Number(value) > 60 };
  return persistGeneratorLiveFpsFromSettings(effective, storage).fps;
}

export function createBlackoutGeneratorFrame(width = 300, height = 8, meta = {}) {
  const w = Math.max(1, Math.trunc(Number(width || 300) || 300));
  const h = Math.max(1, Math.trunc(Number(height || 8) || 8));
  return {
    frame: new Uint8Array(w * h * 3),
    width: w,
    height: h,
    patch: normalizeGeneratorPatch({ ...GENERATOR_DEFAULT_PATCH, name: 'BLACKOUT', energy: 0, density: 0, speed: 0, macros: [0, 0, 0, 0, 0, 0, 0, 0], modules: { ...GENERATOR_DEFAULT_PATCH.modules, output: false } }),
    graphPlan: null,
    meta: { version: GENERATOR_LIVE_OPS_VERSION, blackout: true, time: 0, beat: 0, bpm: 145, ...meta }
  };
}

export function applyGeneratorSafeScene(sceneId, state = {}) {
  const id = normalizeGeneratorSafeSceneId(sceneId);
  let graph = normalizeGeneratorGraph(state.graph || createDefaultGeneratorGraph());
  let patch = normalizeGeneratorPatch({ ...GENERATOR_DEFAULT_PATCH, ...(state.patch || {}) });
  let curves = normalizeGeneratorCurves(state.curves || createDefaultGeneratorCurves());

  const setAll = (ids, updates) => {
    for (const nodeId of ids) graph = setNode(graph, nodeId, updates);
  };

  if (id === 'safe-calm') {
    patch = normalizeGeneratorPatch({ ...patch, name: 'Safe Calm Plasma', energy: 0.36, density: 0.34, speed: 0.22, colorShift: 0.58, feedback: 0.18, warp: 0.28, pulse: 0.20, shimmer: 0.16 });
    setAll(['plasma', 'colorFlow', 'output'], { enabled: true, mix: 0.62, intensity: 0.62 });
    setAll(['tunnel', 'grid', 'particles', 'kaleido', 'gate', 'scanline'], { enabled: false });
    curves = makeCurvesFromPatch(patch, 'lfo', { energy: { depth: 0.08, rate: 0.035 }, colorShift: { depth: 0.18, rate: 0.018 }, speed: { depth: 0.04, rate: 0.025 } });
  } else if (id === 'safe-build') {
    patch = normalizeGeneratorPatch({ ...patch, name: 'Safe Build Tunnel', energy: 0.58, density: 0.52, speed: 0.38, colorShift: 0.42, feedback: 0.24, warp: 0.38, pulse: 0.42, shimmer: 0.22 });
    setAll(['plasma', 'tunnel', 'kaleido', 'colorFlow', 'scanline', 'output'], { enabled: true });
    setAll(['grid', 'particles', 'gate'], { enabled: false });
    graph = setNode(graph, 'tunnel', { mix: 0.78, intensity: 0.72 });
    graph = setNode(graph, 'output', { mix: 0.82, intensity: 0.82 });
    curves = makeCurvesFromPatch(patch, 'lfo', { density: { depth: 0.18, rate: 0.045 }, warp: { depth: 0.12, rate: 0.035 }, pulse: { mode: 'beat', depth: 0.22, division: 8, smooth: 0.56 } });
  } else if (id === 'safe-drop') {
    patch = normalizeGeneratorPatch({ ...patch, name: 'Safe Drop Gate', energy: 0.82, density: 0.66, speed: 0.58, colorShift: 0.12, feedback: 0.24, warp: 0.48, pulse: 0.76, shimmer: 0.42 });
    setAll(['plasma', 'tunnel', 'grid', 'particles', 'kaleido', 'colorFlow', 'gate', 'scanline', 'output'], { enabled: true });
    graph = setNode(graph, 'gate', { mix: 0.58, intensity: 0.58 });
    graph = setNode(graph, 'particles', { mix: 0.48, intensity: 0.52 });
    graph = setNode(graph, 'output', { mix: 0.86, intensity: 0.86 });
    curves = makeCurvesFromPatch(patch, 'beat', { energy: { depth: 0.16, division: 4, smooth: 0.40 }, pulse: { depth: 0.30, division: 4, smooth: 0.35 }, shimmer: { mode: 'random', depth: 0.16, rate: 0.18, smooth: 0.78 } });
  } else if (id === 'safe-afterhours') {
    patch = normalizeGeneratorPatch({ ...patch, name: 'Safe Afterhours Void', energy: 0.24, density: 0.28, speed: 0.16, colorShift: 0.72, feedback: 0.34, warp: 0.22, pulse: 0.12, shimmer: 0.08 });
    setAll(['plasma', 'tunnel', 'colorFlow', 'output'], { enabled: true });
    setAll(['grid', 'particles', 'kaleido', 'gate', 'scanline'], { enabled: false });
    graph = setNode(graph, 'output', { mix: 0.52, intensity: 0.52 });
    curves = makeCurvesFromPatch(patch, 'lfo', { colorShift: { depth: 0.22, rate: 0.012 }, feedback: { depth: 0.10, rate: 0.020 }, energy: { depth: 0.06, rate: 0.022 } });
  } else if (id === 'safe-diagnostic') {
    patch = normalizeGeneratorPatch({ ...patch, name: 'Safe Diagnostic Grid', energy: 0.50, density: 0.78, speed: 0.14, colorShift: 0.30, feedback: 0.05, warp: 0.04, pulse: 0.25, shimmer: 0.10 });
    setAll(['grid', 'scanline', 'colorFlow', 'output'], { enabled: true });
    setAll(['plasma', 'tunnel', 'particles', 'kaleido', 'gate'], { enabled: false });
    graph = setNode(graph, 'grid', { mix: 0.88, intensity: 0.72 });
    graph = setNode(graph, 'output', { mix: 0.60, intensity: 0.60 });
    curves = makeCurvesFromPatch(patch, 'manual');
  } else if (id === 'safe-blackout') {
    patch = normalizeGeneratorPatch({ ...patch, name: 'Blackout Patch', energy: 0, density: 0, speed: 0, colorShift: 0, feedback: 0, warp: 0, pulse: 0, shimmer: 0, modules: { ...GENERATOR_DEFAULT_PATCH.modules, output: false }, macros: [0, 0, 0, 0, 0, 0, 0, 0] });
    graph = setNode(graph, 'output', { enabled: false, mix: 0, intensity: 0 });
    setAll(['plasma', 'tunnel', 'grid', 'particles', 'kaleido', 'colorFlow', 'gate', 'scanline'], { enabled: false, mix: 0, intensity: 0 });
    curves = makeCurvesFromPatch(patch, 'manual');
  }

  graph = normalizeGeneratorGraph(graph);
  patch = normalizeGeneratorPatch({ ...patch, modules: graphToModuleFlags(graph), graph, macros: patchValuesToMacros(patch) });
  curves = normalizeGeneratorCurves(curves);
  return Object.freeze({ sceneId: id, patch: clone(patch), graph: clone(graph), curves: clone(curves) });
}

function ema(previous, value, alpha = 0.16) {
  const n = Number(value);
  if (!Number.isFinite(n)) return Number(previous || 0);
  if (!Number.isFinite(Number(previous)) || Number(previous) <= 0) return n;
  return Number(previous) * (1 - alpha) + n * alpha;
}

export function createGeneratorLiveMetricsRuntime() {
  return {
    version: GENERATOR_LIVE_OPS_VERSION,
    frames: 0,
    publishSamples: 0,
    lastRenderMs: 0,
    avgRenderMs: 0,
    maxRenderMs: 0,
    lastPublishMs: 0,
    avgPublishMs: 0,
    lastServerMs: 0,
    avgServerMs: 0,
    droppedByFps: 0,
    serverErrors: 0,
    updatedAt: 0
  };
}

export function updateGeneratorLiveMetrics(runtime = createGeneratorLiveMetricsRuntime(), sample = {}) {
  const next = { ...runtime };
  const renderMs = Number(sample.renderMs);
  const publishMs = Number(sample.publishMs);
  const serverMs = Number(sample.serverMs ?? sample.bridge?.lastServerMs);
  next.frames += 1;
  if (Number.isFinite(renderMs)) {
    next.lastRenderMs = Math.max(0, renderMs);
    next.avgRenderMs = ema(next.avgRenderMs, next.lastRenderMs, 0.12);
    next.maxRenderMs = Math.max(Number(next.maxRenderMs || 0), next.lastRenderMs);
  }
  if (Number.isFinite(publishMs)) {
    next.publishSamples += 1;
    next.lastPublishMs = Math.max(0, publishMs);
    next.avgPublishMs = ema(next.avgPublishMs, next.lastPublishMs, 0.16);
  }
  if (Number.isFinite(serverMs)) {
    next.lastServerMs = Math.max(0, serverMs);
    next.avgServerMs = ema(next.avgServerMs, next.lastServerMs, 0.12);
  }
  if (sample.bridge) {
    next.droppedByFps = Number(sample.bridge.droppedByFps || next.droppedByFps || 0);
    next.serverErrors = Number(sample.bridge.serverErrors || next.serverErrors || 0);
  }
  next.updatedAt = Date.now();
  return next;
}

export function summarizeGeneratorLiveMetrics(runtime = {}) {
  const renderAvg = Number(runtime.avgRenderMs || 0);
  const publishAvg = Number(runtime.avgPublishMs || 0);
  const serverAvg = Number(runtime.avgServerMs || 0);
  let status = 'GOOD';
  if (renderAvg > 14 || publishAvg > 5 || serverAvg > 18) status = 'WATCH';
  if (renderAvg > 24 || publishAvg > 10 || serverAvg > 40 || Number(runtime.serverErrors || 0) > 0) status = 'HOT';
  return Object.freeze({
    status,
    render: `${renderAvg.toFixed(1)} / ${Number(runtime.maxRenderMs || 0).toFixed(1)}`,
    publish: publishAvg > 0 ? publishAvg.toFixed(1) : '--',
    server: serverAvg > 0 ? serverAvg.toFixed(1) : '--',
    drops: String(Number(runtime.droppedByFps || 0)),
    errors: String(Number(runtime.serverErrors || 0))
  });
}
