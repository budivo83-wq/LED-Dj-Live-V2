import { GENERATOR_DEFAULT_PATCH, normalizeGeneratorPatch } from './generator_engine.js';
import { createDefaultGeneratorGraph, normalizeGeneratorGraph, updateGeneratorGraphNode, graphToModuleFlags } from './generator_graph.js';
import { createDefaultGeneratorCurves, normalizeGeneratorCurves, patchValuesToMacros } from './generator_curves.js';
import { findGeneratorPreset, normalizeGeneratorPresetBank } from './generator_presets.js';
import { applyGeneratorMusicMode, getGeneratorMusicMode, listGeneratorMusicModes, normalizeGeneratorMusicModeId } from './generator_music_modes.js';

export const GENERATOR_SCENE_MORPH_VERSION = 'STEP38Q_GENERATOR_SCENE_MORPH';
export const GENERATOR_SCENE_MORPH_CONFIG_KEY = 'budilight.generator.sceneMorph.config.v1';
export const GENERATOR_SCENE_MORPH_SNAPSHOT_KEY = 'budilight.generator.sceneMorph.snapshot.v1';

const PATCH_KEYS = Object.freeze(['energy', 'density', 'speed', 'colorShift', 'feedback', 'warp', 'pulse', 'shimmer']);
const CURVE_KEYS = Object.freeze(['value', 'rate', 'depth', 'smooth']);

function clamp01(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(1, n));
}

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function safeJsonParse(text, fallback = null) {
  try { return JSON.parse(text || ''); } catch { return fallback; }
}

function clone(value, fallback = {}) {
  try { return JSON.parse(JSON.stringify(value)); } catch { return fallback; }
}

function lerp(a, b, t) {
  return safeNumber(a, 0) + (safeNumber(b, 0) - safeNumber(a, 0)) * clamp01(t, 0);
}

function ease(t, curve = 'smooth') {
  const x = clamp01(t, 0);
  if (curve === 'linear') return x;
  if (curve === 'ease-in') return x * x;
  if (curve === 'ease-out') return 1 - Math.pow(1 - x, 2);
  if (curve === 'ease-in-out' || curve === 'ease') return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
  return x * x * (3 - 2 * x);
}

function graphNodeMap(graph) {
  return new Map(normalizeGeneratorGraph(graph).nodes.map((node) => [node.id, node]));
}

function mergeNodeIds(a, b) {
  const ids = new Set();
  for (const node of normalizeGeneratorGraph(a).nodes) ids.add(node.id);
  for (const node of normalizeGeneratorGraph(b).nodes) ids.add(node.id);
  return Array.from(ids);
}

function blendGraph(fromGraph, toGraph, tRaw) {
  const t = clamp01(tRaw, 0);
  const fromMap = graphNodeMap(fromGraph || createDefaultGeneratorGraph());
  const toMap = graphNodeMap(toGraph || createDefaultGeneratorGraph());
  let graph = normalizeGeneratorGraph(fromGraph || createDefaultGeneratorGraph());
  for (const id of mergeNodeIds(fromGraph, toGraph)) {
    const a = fromMap.get(id) || toMap.get(id);
    const b = toMap.get(id) || fromMap.get(id);
    if (!a || !b) continue;
    const enabled = Boolean((a.enabled !== false && t < 0.98) || (b.enabled !== false && t > 0.02));
    graph = updateGeneratorGraphNode(graph, id, {
      enabled: b.locked ? true : enabled,
      mix: clamp01(lerp(a.mix, b.mix, t), b.mix ?? a.mix ?? 0.65),
      intensity: clamp01(lerp(a.intensity, b.intensity, t), b.intensity ?? a.intensity ?? 0.7),
      order: Math.round(lerp(a.order, b.order, t)),
      name: b.name || a.name,
      type: b.type || a.type,
      description: b.description || a.description
    });
  }
  return normalizeGeneratorGraph(graph);
}

function curveLaneMap(curves) {
  return new Map(normalizeGeneratorCurves(curves || createDefaultGeneratorCurves()).lanes.map((lane) => [lane.id, lane]));
}

function blendCurves(fromCurves, toCurves, tRaw) {
  const t = clamp01(tRaw, 0);
  const from = curveLaneMap(fromCurves || createDefaultGeneratorCurves());
  const to = curveLaneMap(toCurves || createDefaultGeneratorCurves());
  const base = normalizeGeneratorCurves(fromCurves || createDefaultGeneratorCurves());
  return normalizeGeneratorCurves({
    ...base,
    lanes: base.lanes.map((lane) => {
      const a = from.get(lane.id) || lane;
      const b = to.get(lane.id) || a;
      const next = { ...a };
      for (const key of CURVE_KEYS) next[key] = lerp(a[key], b[key], t);
      next.mode = t < 0.55 ? (a.mode || 'manual') : (b.mode || a.mode || 'manual');
      next.division = Math.round(lerp(a.division || 4, b.division || a.division || 4, t));
      next.label = b.label || a.label || lane.label;
      return next;
    })
  });
}

function blendPatch(fromPatch, toPatch, tRaw, graph) {
  const t = clamp01(tRaw, 0);
  const a = normalizeGeneratorPatch({ ...GENERATOR_DEFAULT_PATCH, ...(fromPatch || {}) });
  const b = normalizeGeneratorPatch({ ...GENERATOR_DEFAULT_PATCH, ...(toPatch || {}) });
  const next = { ...a };
  for (const key of PATCH_KEYS) next[key] = clamp01(lerp(a[key], b[key], t), b[key] ?? a[key] ?? 0.5);
  next.width = safeNumber(b.width, a.width || 300);
  next.height = safeNumber(b.height, a.height || 8);
  next.bpm = lerp(a.bpm || 145, b.bpm || a.bpm || 145, t);
  next.name = t < 0.98 ? `${a.name || 'Scene'} → ${b.name || 'Target'}` : (b.name || a.name || 'Morphed Scene');
  next.musicMode = t < 0.5 ? (a.musicMode || 'manual') : (b.musicMode || a.musicMode || 'manual');
  next.modules = graphToModuleFlags(graph);
  next.graph = graph;
  next.macros = patchValuesToMacros(next);
  return normalizeGeneratorPatch(next);
}

function normalizeState(state = {}) {
  const graph = normalizeGeneratorGraph(state.graph || createDefaultGeneratorGraph());
  const patch = normalizeGeneratorPatch({ ...GENERATOR_DEFAULT_PATCH, ...(state.patch || {}), modules: graphToModuleFlags(graph), graph });
  const curves = normalizeGeneratorCurves(state.curves || createDefaultGeneratorCurves());
  return { patch: { ...patch, macros: patchValuesToMacros(patch) }, graph, curves };
}

export function normalizeGeneratorSceneMorphConfig(input = {}) {
  const durationBeats = Math.max(1, Math.min(256, safeNumber(input.durationBeats, 16)));
  const durationSeconds = Math.max(0.1, Math.min(30, safeNumber(input.durationSeconds, 0)));
  const useBeats = input.timeMode !== 'seconds';
  const curve = ['smooth', 'ease', 'ease-in', 'ease-out', 'ease-in-out', 'linear'].includes(String(input.curve || '')) ? String(input.curve) : 'smooth';
  const targetId = String(input.targetId || 'music:build').slice(0, 96);
  return Object.freeze({
    version: GENERATOR_SCENE_MORPH_VERSION,
    targetId,
    durationBeats,
    durationSeconds,
    timeMode: useBeats ? 'beats' : 'seconds',
    curve,
    commitOnDone: input.commitOnDone !== false,
    keepMusicRuntime: input.keepMusicRuntime !== false
  });
}

export function readGeneratorSceneMorphConfig(storage = globalThis.localStorage) {
  const raw = (() => { try { return storage.getItem(GENERATOR_SCENE_MORPH_CONFIG_KEY); } catch { return ''; } })();
  return normalizeGeneratorSceneMorphConfig(safeJsonParse(raw, {}));
}

export function saveGeneratorSceneMorphConfig(input = {}, storage = globalThis.localStorage) {
  const config = normalizeGeneratorSceneMorphConfig(input);
  try { storage.setItem(GENERATOR_SCENE_MORPH_CONFIG_KEY, JSON.stringify(config)); } catch {}
  return config;
}

export function listGeneratorSceneMorphTargets(presetBank = {}, includeModes = true) {
  const bank = normalizeGeneratorPresetBank(presetBank || {});
  const presetTargets = [...(bank.custom || []), ...(bank.factory || [])].map((preset) => ({
    id: `preset:${preset.id}`,
    type: 'preset',
    name: preset.name,
    detail: preset.id.startsWith('factory-') ? 'factory preset' : 'custom preset'
  }));
  const modeTargets = includeModes ? listGeneratorMusicModes().filter((mode) => mode.id !== 'manual').map((mode) => ({
    id: `music:${mode.id}`,
    type: 'music',
    name: mode.name,
    detail: mode.intent
  })) : [];
  return [...modeTargets, ...presetTargets];
}

export function resolveGeneratorSceneMorphTarget(targetId = '', context = {}) {
  const id = String(targetId || '').trim();
  const current = normalizeState(context.current || context);
  if (id.startsWith('preset:')) {
    const presetId = id.slice('preset:'.length);
    const preset = findGeneratorPreset(context.presetBank || {}, presetId);
    if (!preset) return null;
    return Object.freeze({
      id,
      type: 'preset',
      name: preset.name,
      state: normalizeState(preset),
      detail: preset.id
    });
  }
  const modeId = normalizeGeneratorMusicModeId(id.startsWith('music:') ? id.slice('music:'.length) : id);
  const mode = getGeneratorMusicMode(modeId);
  if (!mode || modeId === 'manual') return null;
  const result = applyGeneratorMusicMode(modeId, current);
  return Object.freeze({
    id: `music:${modeId}`,
    type: 'music',
    name: mode.name,
    state: normalizeState(result),
    detail: mode.intent
  });
}

export function createGeneratorSceneMorphRuntime() {
  return Object.seal({
    active: false,
    done: false,
    source: null,
    target: null,
    config: normalizeGeneratorSceneMorphConfig(),
    startedAt: 0,
    startedBeat: 0,
    progress: 0,
    eased: 0,
    lastFrameAt: 0,
    committed: false,
    error: ''
  });
}

export function armGeneratorSceneMorph(runtime = createGeneratorSceneMorphRuntime(), context = {}, configInput = {}) {
  const config = normalizeGeneratorSceneMorphConfig(configInput);
  const source = normalizeState(context.current || context);
  const target = resolveGeneratorSceneMorphTarget(config.targetId, { ...context, current: source });
  if (!target) {
    return { runtime: { ...runtime, active: false, done: false, error: `target-not-found:${config.targetId}` }, ok: false, reason: 'target-not-found' };
  }
  const now = safeNumber(context.now, 0);
  const beat = safeNumber(context.beat, 0);
  const nextRuntime = {
    active: true,
    done: false,
    source,
    target,
    config,
    startedAt: now,
    startedBeat: beat,
    progress: 0,
    eased: 0,
    lastFrameAt: now,
    committed: false,
    error: ''
  };
  writeGeneratorSceneMorphSnapshot(nextRuntime, context.storage);
  return { runtime: nextRuntime, ok: true, target };
}

function computeProgress(runtime, context = {}) {
  const cfg = normalizeGeneratorSceneMorphConfig(runtime.config || {});
  if (cfg.timeMode === 'seconds') {
    const elapsed = Math.max(0, safeNumber(context.time, 0) - safeNumber(runtime.startedAt, 0));
    return clamp01(elapsed / Math.max(0.1, cfg.durationSeconds), 0);
  }
  const beat = safeNumber(context.beat, runtime.startedBeat || 0);
  const elapsedBeats = Math.max(0, beat - safeNumber(runtime.startedBeat, beat));
  return clamp01(elapsedBeats / Math.max(1, cfg.durationBeats), 0);
}

export function applyGeneratorSceneMorph(runtime = createGeneratorSceneMorphRuntime(), liveState = {}, context = {}) {
  if (!runtime?.active || runtime.done || !runtime.source || !runtime.target?.state) {
    return { runtime, state: normalizeState(liveState), active: false, done: Boolean(runtime?.done) };
  }
  const progress = computeProgress(runtime, context);
  const eased = ease(progress, runtime.config?.curve || 'smooth');
  const graph = blendGraph(runtime.source.graph, runtime.target.state.graph, eased);
  const patch = blendPatch(runtime.source.patch, runtime.target.state.patch, eased, graph);
  const curves = blendCurves(runtime.source.curves, runtime.target.state.curves, eased);
  const done = progress >= 0.999;
  const nextRuntime = { ...runtime, progress, eased, done, active: !done, lastFrameAt: safeNumber(context.now, runtime.lastFrameAt) };
  if (done && runtime.config?.commitOnDone !== false) {
    nextRuntime.committed = true;
  }
  if (context.writeSnapshot !== false) writeGeneratorSceneMorphSnapshot(nextRuntime, context.storage);
  return {
    runtime: nextRuntime,
    state: done && runtime.config?.commitOnDone !== false ? clone(runtime.target.state, { patch, graph, curves }) : { patch, graph, curves },
    active: !done,
    done,
    target: runtime.target,
    progress,
    eased
  };
}

export function cancelGeneratorSceneMorph(runtime = createGeneratorSceneMorphRuntime(), storage = globalThis.localStorage) {
  const next = { ...runtime, active: false, done: false, error: 'cancelled', progress: 0, eased: 0 };
  writeGeneratorSceneMorphSnapshot(next, storage);
  return next;
}

export function writeGeneratorSceneMorphSnapshot(runtime = {}, storage = globalThis.localStorage) {
  const target = runtime.target || null;
  const snapshot = {
    version: GENERATOR_SCENE_MORPH_VERSION,
    active: Boolean(runtime.active),
    done: Boolean(runtime.done),
    targetId: target?.id || runtime.config?.targetId || '',
    targetName: target?.name || '',
    progress: clamp01(runtime.progress, 0),
    eased: clamp01(runtime.eased, 0),
    curve: runtime.config?.curve || 'smooth',
    timeMode: runtime.config?.timeMode || 'beats',
    durationBeats: runtime.config?.durationBeats || 16,
    durationSeconds: runtime.config?.durationSeconds || 0,
    error: runtime.error || '',
    updatedAt: Date.now()
  };
  try { storage?.setItem?.(GENERATOR_SCENE_MORPH_SNAPSHOT_KEY, JSON.stringify(snapshot)); } catch {}
  return snapshot;
}

export function buildGeneratorSceneMorphStatus(runtime = {}, config = {}) {
  const cfg = normalizeGeneratorSceneMorphConfig(config || runtime.config || {});
  const pct = Math.round(clamp01(runtime.progress, 0) * 100);
  if (runtime.error && !runtime.active) return `ERROR · ${runtime.error}`;
  if (runtime.active) return `MORPH ${pct}% → ${runtime.target?.name || cfg.targetId}`;
  if (runtime.done) return `DONE → ${runtime.target?.name || cfg.targetId}`;
  return `ARMED → ${cfg.targetId} · ${cfg.timeMode === 'seconds' ? `${cfg.durationSeconds}s` : `${cfg.durationBeats} beats`} · ${cfg.curve}`;
}

export function buildGeneratorSceneMorphReport(runtime = {}, config = {}) {
  const cfg = normalizeGeneratorSceneMorphConfig(config || runtime.config || {});
  return [
    `Generator Scene Morph ${GENERATOR_SCENE_MORPH_VERSION}`,
    `Target: ${runtime.target?.name || cfg.targetId}`,
    `Active: ${runtime.active ? 'YES' : 'NO'}`,
    `Done: ${runtime.done ? 'YES' : 'NO'}`,
    `Progress: ${Math.round(clamp01(runtime.progress, 0) * 100)}%`,
    `Eased: ${Math.round(clamp01(runtime.eased, 0) * 100)}%`,
    `Mode: ${cfg.timeMode}`,
    `Duration: ${cfg.timeMode === 'seconds' ? `${cfg.durationSeconds}s` : `${cfg.durationBeats} beats`}`,
    `Curve: ${cfg.curve}`,
    `Commit: ${cfg.commitOnDone !== false ? 'YES' : 'NO'}`,
    runtime.error ? `Error: ${runtime.error}` : ''
  ].filter(Boolean).join('\n');
}
