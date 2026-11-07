import { GENERATOR_DEFAULT_PATCH, normalizeGeneratorPatch } from './generator_engine.js';
import { createDefaultGeneratorGraph, normalizeGeneratorGraph, updateGeneratorGraphNode, graphToModuleFlags } from './generator_graph.js';
import { createDefaultGeneratorCurves, normalizeGeneratorCurves, patchValuesToMacros } from './generator_curves.js';

export const GENERATOR_MUSIC_MODES_VERSION = 'STEP38P_GENERATOR_MUSIC_MODES';
export const GENERATOR_MUSIC_MODE_KEY = 'budilight.generator.musicMode.v1';
export const GENERATOR_MUSIC_MODE_RUNTIME_KEY = 'budilight.generator.musicMode.runtimeEnabled.v1';

const MODE_IDS = Object.freeze(['manual', 'ambient', 'build', 'groove', 'drop', 'break', 'psy-chaos', 'afterhours']);

function clamp01(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(1, n));
}

function fract(value) {
  const n = Number(value) || 0;
  return n - Math.floor(n);
}

function smoothstep(edge0, edge1, value) {
  const t = clamp01((value - edge0) / Math.max(1e-6, edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function hash1(value, seed = 0) {
  return fract(Math.sin(value * 127.1 + seed * 311.7 + 23.71) * 43758.5453123);
}

function clone(value, fallback = {}) {
  try { return JSON.parse(JSON.stringify(value)); } catch { return fallback; }
}

function setNode(graph, id, updates = {}) {
  return updateGeneratorGraphNode(graph, id, updates);
}

function setAllNodes(graph, ids = [], updates = {}) {
  let next = graph;
  for (const id of ids) next = setNode(next, id, updates);
  return next;
}

function makeCurves(patch, lanes = {}) {
  const base = createDefaultGeneratorCurves();
  const values = normalizeGeneratorPatch(patch);
  return normalizeGeneratorCurves({
    ...base,
    lanes: base.lanes.map((lane) => ({
      ...lane,
      value: clamp01(values[lane.id], lane.value),
      ...(lanes[lane.id] || {})
    }))
  });
}

export const GENERATOR_MUSIC_MODES = Object.freeze([
  Object.freeze({ id: 'manual', name: 'Manual / Patch', intent: 'bez hudebního přepisování, jen aktuální makra/křivky', phraseBeats: 16, energy: 'operator' }),
  Object.freeze({ id: 'ambient', name: 'Ambient', intent: 'pomalý měkký pohyb, žádný tvrdý gate', phraseBeats: 32, energy: 'low' }),
  Object.freeze({ id: 'build', name: 'Build', intent: 'postupně roste density, pulse a warp přes frázi', phraseBeats: 32, energy: 'rising' }),
  Object.freeze({ id: 'groove', name: 'Groove', intent: 'hudební základ s beat pulzem a perkusivními jiskrami', phraseBeats: 16, energy: 'medium' }),
  Object.freeze({ id: 'drop', name: 'Drop', intent: 'silnější gate, pulse a shimmer na downbeaty', phraseBeats: 16, energy: 'high' }),
  Object.freeze({ id: 'break', name: 'Break', intent: 'nižší output, prostor pro nádech před dalším návratem', phraseBeats: 16, energy: 'low-mid' }),
  Object.freeze({ id: 'psy-chaos', name: 'Psy Chaos', intent: 'kaleido, warp, random shimmer, ale pořád clampnuté hodnoty', phraseBeats: 8, energy: 'wild' }),
  Object.freeze({ id: 'afterhours', name: 'Afterhours', intent: 'tmavý pomalý režim na konec/frázové zklidnění', phraseBeats: 32, energy: 'dark' })
]);

export function listGeneratorMusicModes() {
  return GENERATOR_MUSIC_MODES.map((mode) => ({ ...mode }));
}

export function normalizeGeneratorMusicModeId(id = '') {
  const value = String(id || '').trim();
  return MODE_IDS.includes(value) ? value : 'manual';
}

export function getGeneratorMusicMode(id = '') {
  const modeId = normalizeGeneratorMusicModeId(id);
  return GENERATOR_MUSIC_MODES.find((mode) => mode.id === modeId) || GENERATOR_MUSIC_MODES[0];
}

export function loadGeneratorMusicMode(storage = globalThis.localStorage) {
  try { return normalizeGeneratorMusicModeId(storage.getItem(GENERATOR_MUSIC_MODE_KEY) || 'manual'); } catch { return 'manual'; }
}

export function saveGeneratorMusicMode(id = 'manual', storage = globalThis.localStorage) {
  const modeId = normalizeGeneratorMusicModeId(id);
  try { storage.setItem(GENERATOR_MUSIC_MODE_KEY, modeId); } catch {}
  return modeId;
}

export function isGeneratorMusicModeRuntimeEnabled(storage = globalThis.localStorage) {
  try { return storage.getItem(GENERATOR_MUSIC_MODE_RUNTIME_KEY) !== 'false'; } catch { return true; }
}

export function setGeneratorMusicModeRuntimeEnabled(enabled = true, storage = globalThis.localStorage) {
  const value = enabled !== false;
  try { storage.setItem(GENERATOR_MUSIC_MODE_RUNTIME_KEY, value ? 'true' : 'false'); } catch {}
  return value;
}

function buildModePatch(modeId, patch) {
  const p = normalizeGeneratorPatch({ ...GENERATOR_DEFAULT_PATCH, ...(patch || {}) });
  if (modeId === 'manual') return normalizeGeneratorPatch({ ...p, name: p.name || 'Manual Generator Patch' });
  if (modeId === 'ambient') return normalizeGeneratorPatch({ ...p, name: 'Music Ambient', energy: 0.30, density: 0.30, speed: 0.18, colorShift: 0.62, feedback: 0.22, warp: 0.24, pulse: 0.14, shimmer: 0.10 });
  if (modeId === 'build') return normalizeGeneratorPatch({ ...p, name: 'Music Build', energy: 0.46, density: 0.46, speed: 0.34, colorShift: 0.40, feedback: 0.22, warp: 0.34, pulse: 0.34, shimmer: 0.20 });
  if (modeId === 'groove') return normalizeGeneratorPatch({ ...p, name: 'Music Groove', energy: 0.64, density: 0.62, speed: 0.44, colorShift: 0.32, feedback: 0.22, warp: 0.30, pulse: 0.62, shimmer: 0.32 });
  if (modeId === 'drop') return normalizeGeneratorPatch({ ...p, name: 'Music Drop', energy: 0.86, density: 0.74, speed: 0.64, colorShift: 0.16, feedback: 0.24, warp: 0.48, pulse: 0.88, shimmer: 0.58 });
  if (modeId === 'break') return normalizeGeneratorPatch({ ...p, name: 'Music Break', energy: 0.28, density: 0.38, speed: 0.18, colorShift: 0.52, feedback: 0.30, warp: 0.26, pulse: 0.08, shimmer: 0.10 });
  if (modeId === 'psy-chaos') return normalizeGeneratorPatch({ ...p, name: 'Music Psy Chaos', energy: 0.78, density: 0.84, speed: 0.68, colorShift: 0.74, feedback: 0.38, warp: 0.78, pulse: 0.72, shimmer: 0.78 });
  if (modeId === 'afterhours') return normalizeGeneratorPatch({ ...p, name: 'Music Afterhours', energy: 0.22, density: 0.24, speed: 0.14, colorShift: 0.78, feedback: 0.34, warp: 0.20, pulse: 0.08, shimmer: 0.06 });
  return p;
}

function buildModeGraph(modeId, graph) {
  let g = normalizeGeneratorGraph(graph || createDefaultGeneratorGraph());
  if (modeId === 'manual') return g;
  if (modeId === 'ambient') {
    g = setAllNodes(g, ['plasma', 'colorFlow', 'output'], { enabled: true });
    g = setAllNodes(g, ['grid', 'particles', 'gate', 'scanline'], { enabled: false });
    g = setNode(g, 'plasma', { mix: 0.90, intensity: 0.72 });
    g = setNode(g, 'tunnel', { enabled: true, mix: 0.18, intensity: 0.30 });
    g = setNode(g, 'kaleido', { enabled: true, mix: 0.18, intensity: 0.22 });
    g = setNode(g, 'output', { mix: 0.58, intensity: 0.58 });
  } else if (modeId === 'build') {
    g = setAllNodes(g, ['plasma', 'tunnel', 'kaleido', 'colorFlow', 'scanline', 'output'], { enabled: true });
    g = setAllNodes(g, ['grid', 'particles', 'gate'], { enabled: false });
    g = setNode(g, 'tunnel', { mix: 0.76, intensity: 0.72 });
    g = setNode(g, 'kaleido', { mix: 0.32, intensity: 0.40 });
    g = setNode(g, 'scanline', { mix: 0.26, intensity: 0.30 });
    g = setNode(g, 'output', { mix: 0.78, intensity: 0.78 });
  } else if (modeId === 'groove') {
    g = setAllNodes(g, ['plasma', 'tunnel', 'grid', 'particles', 'colorFlow', 'scanline', 'output'], { enabled: true });
    g = setNode(g, 'kaleido', { enabled: true, mix: 0.22, intensity: 0.24 });
    g = setNode(g, 'gate', { enabled: true, mix: 0.22, intensity: 0.32 });
    g = setNode(g, 'grid', { mix: 0.70, intensity: 0.68 });
    g = setNode(g, 'particles', { mix: 0.58, intensity: 0.62 });
    g = setNode(g, 'output', { mix: 0.82, intensity: 0.82 });
  } else if (modeId === 'drop') {
    g = setAllNodes(g, ['plasma', 'tunnel', 'grid', 'particles', 'kaleido', 'colorFlow', 'gate', 'scanline', 'output'], { enabled: true });
    g = setNode(g, 'tunnel', { mix: 0.92, intensity: 0.88 });
    g = setNode(g, 'gate', { mix: 0.68, intensity: 0.66 });
    g = setNode(g, 'scanline', { mix: 0.70, intensity: 0.64 });
    g = setNode(g, 'output', { mix: 0.92, intensity: 0.88 });
  } else if (modeId === 'break') {
    g = setAllNodes(g, ['plasma', 'tunnel', 'colorFlow', 'output'], { enabled: true });
    g = setAllNodes(g, ['grid', 'particles', 'gate', 'scanline'], { enabled: false });
    g = setNode(g, 'kaleido', { enabled: true, mix: 0.14, intensity: 0.20 });
    g = setNode(g, 'output', { mix: 0.42, intensity: 0.48 });
  } else if (modeId === 'psy-chaos') {
    g = setAllNodes(g, ['plasma', 'tunnel', 'grid', 'particles', 'kaleido', 'colorFlow', 'gate', 'scanline', 'output'], { enabled: true });
    g = setNode(g, 'kaleido', { mix: 0.82, intensity: 0.76 });
    g = setNode(g, 'particles', { mix: 0.80, intensity: 0.76 });
    g = setNode(g, 'gate', { mix: 0.44, intensity: 0.48 });
    g = setNode(g, 'output', { mix: 0.86, intensity: 0.84 });
  } else if (modeId === 'afterhours') {
    g = setAllNodes(g, ['plasma', 'tunnel', 'colorFlow', 'output'], { enabled: true });
    g = setAllNodes(g, ['grid', 'particles', 'gate', 'scanline'], { enabled: false });
    g = setNode(g, 'tunnel', { mix: 0.24, intensity: 0.32 });
    g = setNode(g, 'kaleido', { enabled: false });
    g = setNode(g, 'output', { mix: 0.38, intensity: 0.42 });
  }
  return normalizeGeneratorGraph(g);
}

function buildModeCurves(modeId, patch) {
  if (modeId === 'manual') return normalizeGeneratorCurves(createDefaultGeneratorCurves());
  if (modeId === 'ambient') return makeCurves(patch, {
    energy: { mode: 'lfo', depth: 0.07, rate: 0.018, smooth: 0.88 },
    density: { mode: 'lfo', depth: 0.06, rate: 0.014, smooth: 0.90 },
    speed: { mode: 'manual', smooth: 0.90 },
    colorShift: { mode: 'lfo', depth: 0.26, rate: 0.010, smooth: 0.78 },
    warp: { mode: 'lfo', depth: 0.10, rate: 0.016, smooth: 0.84 },
    pulse: { mode: 'manual', smooth: 0.90 },
    shimmer: { mode: 'manual', smooth: 0.92 }
  });
  if (modeId === 'build') return makeCurves(patch, {
    energy: { mode: 'lfo', depth: 0.12, rate: 0.030, smooth: 0.76 },
    density: { mode: 'lfo', depth: 0.16, rate: 0.026, smooth: 0.78 },
    warp: { mode: 'lfo', depth: 0.14, rate: 0.022, smooth: 0.78 },
    pulse: { mode: 'beat', depth: 0.24, division: 8, smooth: 0.55 },
    shimmer: { mode: 'random', depth: 0.12, rate: 0.18, smooth: 0.84 }
  });
  if (modeId === 'groove') return makeCurves(patch, {
    energy: { mode: 'beat', depth: 0.16, division: 4, smooth: 0.44 },
    pulse: { mode: 'beat', depth: 0.36, division: 4, smooth: 0.26 },
    shimmer: { mode: 'random', depth: 0.18, rate: 0.75, smooth: 0.70 },
    colorShift: { mode: 'lfo', depth: 0.16, rate: 0.035, smooth: 0.66 }
  });
  if (modeId === 'drop') return makeCurves(patch, {
    energy: { mode: 'beat', depth: 0.22, division: 4, smooth: 0.30 },
    density: { mode: 'manual', smooth: 0.62 },
    speed: { mode: 'manual', smooth: 0.60 },
    pulse: { mode: 'beat', depth: 0.52, division: 4, smooth: 0.16 },
    shimmer: { mode: 'random', depth: 0.28, rate: 1.75, smooth: 0.48 },
    warp: { mode: 'lfo', depth: 0.18, rate: 0.08, smooth: 0.58 }
  });
  if (modeId === 'break') return makeCurves(patch, {
    energy: { mode: 'lfo', depth: 0.08, rate: 0.016, smooth: 0.88 },
    colorShift: { mode: 'lfo', depth: 0.28, rate: 0.012, smooth: 0.82 },
    feedback: { mode: 'lfo', depth: 0.08, rate: 0.018, smooth: 0.86 },
    pulse: { mode: 'manual', smooth: 0.92 },
    shimmer: { mode: 'manual', smooth: 0.92 }
  });
  if (modeId === 'psy-chaos') return makeCurves(patch, {
    energy: { mode: 'beat', depth: 0.16, division: 4, smooth: 0.32 },
    density: { mode: 'random', depth: 0.18, rate: 0.33, smooth: 0.76 },
    speed: { mode: 'random', depth: 0.16, rate: 0.42, smooth: 0.70 },
    colorShift: { mode: 'random', depth: 0.60, rate: 0.24, smooth: 0.68 },
    warp: { mode: 'random', depth: 0.34, rate: 0.38, smooth: 0.62 },
    pulse: { mode: 'beat', depth: 0.42, division: 2, smooth: 0.22 },
    shimmer: { mode: 'random', depth: 0.46, rate: 2.4, smooth: 0.42 }
  });
  if (modeId === 'afterhours') return makeCurves(patch, {
    energy: { mode: 'lfo', depth: 0.04, rate: 0.010, smooth: 0.94 },
    speed: { mode: 'manual', smooth: 0.94 },
    colorShift: { mode: 'lfo', depth: 0.22, rate: 0.008, smooth: 0.88 },
    feedback: { mode: 'lfo', depth: 0.06, rate: 0.012, smooth: 0.88 },
    warp: { mode: 'lfo', depth: 0.06, rate: 0.010, smooth: 0.90 },
    pulse: { mode: 'manual', smooth: 0.96 },
    shimmer: { mode: 'manual', smooth: 0.96 }
  });
  return makeCurves(patch);
}

export function applyGeneratorMusicMode(modeId = 'manual', state = {}, options = {}) {
  const id = normalizeGeneratorMusicModeId(modeId);
  let graph = normalizeGeneratorGraph(state.graph || createDefaultGeneratorGraph());
  let patch = normalizeGeneratorPatch({ ...GENERATOR_DEFAULT_PATCH, ...(state.patch || {}) });
  let curves = normalizeGeneratorCurves(state.curves || createDefaultGeneratorCurves());
  if (id !== 'manual' || options.forceManualTemplate === true) {
    patch = buildModePatch(id, patch);
    graph = buildModeGraph(id, graph);
    curves = buildModeCurves(id, patch);
  }
  patch = normalizeGeneratorPatch({ ...patch, musicMode: id, modules: graphToModuleFlags(graph), graph, macros: patchValuesToMacros(patch) });
  return Object.freeze({
    modeId: id,
    mode: getGeneratorMusicMode(id),
    patch: clone(patch),
    graph: clone(graph),
    curves: clone(curves),
    summary: buildGeneratorMusicModeSummary(id, patch, graph, curves)
  });
}

export function applyGeneratorMusicModeRuntimeValues(modeId = 'manual', values = {}, context = {}) {
  const id = normalizeGeneratorMusicModeId(modeId);
  const mode = getGeneratorMusicMode(id);
  const enabled = context.enabled !== false && id !== 'manual';
  const bpm = Number(context.bpm || 145) || 145;
  const beat = Number(context.beat || 0) || 0;
  const time = Number(context.time || 0) || 0;
  const phraseBeats = Math.max(1, Number(mode.phraseBeats || 16) || 16);
  const phrase = fract(beat / phraseBeats);
  const bar = fract(beat / 4);
  const intelligence = context.beatIntelligence && typeof context.beatIntelligence === 'object' ? context.beatIntelligence : {};
  const downbeat = Math.max(1 - smoothstep(0.02, 0.28, fract(beat)), clamp01(intelligence.downbeatAccent, 0) * 0.95);
  const barAccent = Math.max(1 - smoothstep(0.04, 0.50, bar), clamp01(intelligence.barAccent, 0) * 0.95);
  const phraseRamp = Math.max(smoothstep(0.08, 0.96, phrase), clamp01(intelligence.phraseProgress, 0));
  const phraseAccent = clamp01(intelligence.phraseAccent, 0);
  const dropAccent = clamp01(intelligence.dropAccent, 0);
  const next = { ...values };
  const add = (key, amount) => { next[key] = clamp01(Number(next[key] ?? 0.5) + amount, Number(next[key] ?? 0.5)); };
  const setMin = (key, value) => { next[key] = Math.max(clamp01(next[key], 0), clamp01(value, 0)); };
  let accent = 0;
  let stage = enabled ? mode.name : 'Manual';

  if (enabled && intelligence.enabled !== false) {
    add('pulse', clamp01(intelligence.accent, 0) * 0.035);
    add('shimmer', phraseAccent * 0.035 + dropAccent * 0.10);
    if (dropAccent > 0.05) setMin('energy', 0.72);
  }

  if (enabled && id === 'ambient') {
    add('energy', Math.sin(time * 0.18) * 0.025);
    add('warp', Math.sin(time * 0.11 + 1.4) * 0.030);
    add('colorShift', Math.sin(time * 0.07) * 0.045);
    accent = 0.05;
  } else if (enabled && id === 'build') {
    add('energy', phraseRamp * 0.20);
    add('density', phraseRamp * 0.22);
    add('warp', phraseRamp * 0.16);
    add('pulse', phraseRamp * 0.18 + barAccent * 0.06);
    add('shimmer', phraseRamp * 0.12);
    accent = phraseRamp;
    stage = phraseRamp > 0.78 ? 'Build / almost drop' : 'Build / rising';
  } else if (enabled && id === 'groove') {
    add('pulse', downbeat * 0.16 + barAccent * 0.08);
    add('energy', downbeat * 0.07);
    add('shimmer', barAccent * 0.10);
    accent = Math.max(downbeat, barAccent * 0.7);
  } else if (enabled && id === 'drop') {
    setMin('energy', 0.78);
    setMin('pulse', 0.78);
    add('energy', downbeat * 0.10);
    add('pulse', downbeat * 0.18);
    add('shimmer', Math.max(downbeat, barAccent) * 0.22);
    add('warp', Math.sin(beat * Math.PI * 0.5) * 0.05);
    accent = Math.max(downbeat, barAccent);
  } else if (enabled && id === 'break') {
    next.energy = clamp01(Number(next.energy ?? 0.3) * 0.82, 0.24);
    next.pulse = clamp01(Number(next.pulse ?? 0.1) * 0.55, 0.05);
    add('colorShift', Math.sin(time * 0.09) * 0.035);
    add('feedback', Math.sin(time * 0.13) * 0.025);
    accent = 0.10;
  } else if (enabled && id === 'psy-chaos') {
    const phraseStep = Math.floor(beat / 4);
    const rA = hash1(phraseStep, 17);
    const rB = hash1(phraseStep + 1, 29);
    add('warp', (rA - 0.45) * 0.22 + downbeat * 0.06);
    add('shimmer', rB * 0.22 + barAccent * 0.14);
    add('colorShift', (hash1(phraseStep, 44) - 0.5) * 0.34);
    add('pulse', downbeat * 0.16);
    setMin('density', 0.68);
    accent = Math.max(rB, downbeat);
  } else if (enabled && id === 'afterhours') {
    next.energy = clamp01(Number(next.energy ?? 0.2) * 0.80 + 0.02, 0.2);
    next.shimmer = clamp01(Number(next.shimmer ?? 0.08) * 0.55, 0.05);
    add('colorShift', Math.sin(time * 0.04) * 0.040);
    add('feedback', Math.sin(time * 0.07 + 2.0) * 0.020);
    accent = 0.04;
  }

  return Object.freeze({
    values: Object.freeze({
      energy: clamp01(next.energy, values.energy ?? 0.5),
      density: clamp01(next.density, values.density ?? 0.5),
      speed: clamp01(next.speed, values.speed ?? 0.5),
      colorShift: clamp01(next.colorShift, values.colorShift ?? 0.5),
      feedback: clamp01(next.feedback, values.feedback ?? 0.5),
      warp: clamp01(next.warp, values.warp ?? 0.5),
      pulse: clamp01(next.pulse, values.pulse ?? 0.5),
      shimmer: clamp01(next.shimmer, values.shimmer ?? 0.5)
    }),
    meta: Object.freeze({
      version: GENERATOR_MUSIC_MODES_VERSION,
      id,
      name: mode.name,
      enabled,
      stage,
      bpm,
      phraseBeats,
      phrase,
      phrasePct: Math.round(phrase * 100),
      accent: clamp01(accent, 0)
    })
  });
}

export function buildGeneratorMusicModeSummary(modeId = 'manual', patch = {}, graph = {}, curves = {}) {
  const id = normalizeGeneratorMusicModeId(modeId);
  const mode = getGeneratorMusicMode(id);
  const activeNodes = normalizeGeneratorGraph(graph).nodes.filter((node) => node.enabled !== false).map((node) => node.id).join(' → ');
  const laneModes = normalizeGeneratorCurves(curves).lanes.map((lane) => `${lane.id}:${lane.mode}`).join(', ');
  const p = normalizeGeneratorPatch(patch);
  return Object.freeze({
    id,
    name: mode.name,
    intent: mode.intent,
    phraseBeats: mode.phraseBeats,
    energy: p.energy,
    density: p.density,
    pulse: p.pulse,
    shimmer: p.shimmer,
    nodes: activeNodes,
    curves: laneModes
  });
}

export function formatGeneratorMusicModeStatus(modeId = 'manual', meta = {}, runtimeEnabled = true) {
  const mode = getGeneratorMusicMode(modeId);
  if (normalizeGeneratorMusicModeId(modeId) === 'manual') return 'MANUAL · žádný hudební runtime';
  const active = runtimeEnabled !== false && meta.enabled !== false;
  const phrase = Number.isFinite(Number(meta.phrasePct)) ? `${Math.round(Number(meta.phrasePct))}%` : '--';
  const accent = Number.isFinite(Number(meta.accent)) ? `${Math.round(Number(meta.accent) * 100)}% accent` : '-- accent';
  return `${active ? 'ON' : 'OFF'} · ${mode.name} · phrase ${phrase} · ${accent}`;
}

export function buildGeneratorMusicModeReport(modeId = 'manual', meta = {}, summary = null) {
  const mode = getGeneratorMusicMode(modeId);
  const lines = [
    `Generator Music Mode ${GENERATOR_MUSIC_MODES_VERSION}`,
    `Mode: ${mode.name} (${mode.id})`,
    `Intent: ${mode.intent}`,
    `Runtime: ${meta.enabled === false ? 'OFF' : 'ON'}`,
    `Phrase: ${Math.round(Number(meta.phrasePct || 0))}% / ${Number(mode.phraseBeats || 16)} beats`,
    `Accent: ${Math.round(Number(meta.accent || 0) * 100)}%`
  ];
  if (summary) {
    lines.push(`Nodes: ${summary.nodes || '--'}`);
    lines.push(`Curves: ${summary.curves || '--'}`);
  }
  return lines.join('\n');
}
