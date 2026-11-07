import { normalizeGeneratorPatch, GENERATOR_DEFAULT_PATCH } from './generator_engine.js';
import { createDefaultGeneratorGraph, normalizeGeneratorGraph, updateGeneratorGraphNode, graphToModuleFlags } from './generator_graph.js';
import { createDefaultGeneratorCurves, normalizeGeneratorCurves, patchValuesToMacros } from './generator_curves.js';
import { loadGeneratorState, saveGeneratorState } from './generator_bridge.js';

export const GENERATOR_SHOWOS_BRIDGE_VERSION = 'STEP38G_SHOWOS_TO_GENERATOR_BRIDGE';
export const SHOWOS_PERFORMANCE_BRIDGE_KEY = 'budilight.performance.bridge.pro';
export const SHOWOS_INTENT_KEY = 'budilight.showos.intent';
export const GENERATOR_SHOWOS_AUTO_KEY = 'budilight.generator.showos.autoFollow.v1';
export const GENERATOR_SHOWOS_SNAPSHOT_KEY = 'budilight.generator.showos.snapshot.v1';

const WORLD_PROFILES = [
  { match: /forge|reactor|industrial|peak/i, profile: { family: 'forge', colorShift: 0.06, energy: 0.10, density: 0.10, warp: 0.02, shimmer: 0.08, nodes: { grid: 0.78, scanline: 0.72, particles: 0.64, plasma: 0.54, tunnel: 0.72, kaleido: 0.24 } } },
  { match: /alien|cyber|synthetic|crystal|hive|quantum|glitch/i, profile: { family: 'alien', colorShift: 0.58, energy: 0.04, density: 0.08, warp: 0.22, shimmer: 0.16, nodes: { kaleido: 0.82, colorFlow: 0.92, particles: 0.74, tunnel: 0.82, grid: 0.62 } } },
  { match: /forest|moss|organic|jungle|grove|root|living/i, profile: { family: 'organic', colorShift: 0.34, energy: -0.04, density: -0.04, warp: 0.12, shimmer: 0.04, nodes: { plasma: 0.94, colorFlow: 0.72, grid: 0.30, particles: 0.44, scanline: 0.26, tunnel: 0.42 } } },
  { match: /deep|space|void|cosmic|afterhours|ambient|stellar/i, profile: { family: 'cosmic', colorShift: 0.66, energy: -0.12, density: -0.16, warp: 0.10, shimmer: -0.02, nodes: { plasma: 0.64, tunnel: 0.58, colorFlow: 0.88, grid: 0.18, particles: 0.26, scanline: 0.18, kaleido: 0.36 } } },
  { match: /tribal|ritual|cave|temple/i, profile: { family: 'ritual', colorShift: 0.13, energy: 0.02, density: 0.06, warp: 0.06, shimmer: 0.06, nodes: { tunnel: 0.76, grid: 0.54, particles: 0.52, gate: 0.48, scanline: 0.44, plasma: 0.60 } } }
];

const WEATHER_PROFILES = {
  Calm: { energy: -0.08, chaos: -0.10, density: -0.06, speed: -0.04, shimmer: -0.08, gate: false, pulseMode: 'lfo' },
  Mist: { energy: -0.12, chaos: -0.04, density: -0.12, speed: -0.10, shimmer: -0.10, gate: false, pulseMode: 'lfo' },
  Storm: { energy: 0.18, chaos: 0.16, density: 0.12, speed: 0.18, shimmer: 0.22, gate: true, pulseMode: 'beat' },
  Electrical: { energy: 0.10, chaos: 0.22, density: 0.08, speed: 0.14, shimmer: 0.26, gate: true, pulseMode: 'beat' },
  Ritual: { energy: 0.06, chaos: 0.04, density: 0.10, speed: -0.02, shimmer: 0.08, gate: true, pulseMode: 'beat' },
  Solar: { energy: 0.14, chaos: -0.04, density: 0.06, speed: 0.06, shimmer: 0.08, gate: false, pulseMode: 'lfo' },
  Void: { energy: -0.18, chaos: 0.08, density: -0.18, speed: -0.14, shimmer: -0.12, gate: false, pulseMode: 'manual' }
};

function clamp01(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(1, n));
}

function clamp100(value, fallback = 50) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, n));
}

function safeParseJson(text, fallback = null) {
  try { return JSON.parse(text || ''); } catch { return fallback; }
}

function pct(value, fallback = 50) {
  return clamp100(value, fallback) / 100;
}

function asText(value, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function profileForWorld(payload = {}) {
  const haystack = [payload.targetWorld, payload.currentWorld, payload.targetUniverse, payload.universeTone, payload.storyPhase].filter(Boolean).join(' ');
  return WORLD_PROFILES.find((item) => item.match.test(haystack))?.profile || WORLD_PROFILES[0].profile;
}

function profileForWeather(payload = {}) {
  const raw = asText(payload.targetWeather || payload.weather, 'Calm');
  return WEATHER_PROFILES[raw] || WEATHER_PROFILES[Object.keys(WEATHER_PROFILES).find((name) => name.toLowerCase() === raw.toLowerCase())] || WEATHER_PROFILES.Calm;
}

function phaseProfile(payload = {}) {
  const phase = asText(payload.storyPhase || payload.phase, 'BUILD').toUpperCase();
  if (/DROP|PEAK|IMPACT/.test(phase)) return { phase, energy: 0.14, density: 0.10, speed: 0.12, pulse: 0.24, gate: true, division: 2, output: 1.0 };
  if (/TENSION|BUILD|FORGE|RAMP/.test(phase)) return { phase, energy: 0.08, density: 0.08, speed: 0.08, pulse: 0.18, gate: true, division: 4, output: 0.96 };
  if (/RECOVERY|BREAK|CALM|AFTER|AMBIENT|DEEP/.test(phase)) return { phase, energy: -0.14, density: -0.16, speed: -0.12, pulse: -0.10, gate: false, division: 16, output: 0.72 };
  if (/GROOVE|FLOW|RITUAL/.test(phase)) return { phase, energy: 0.02, density: 0.04, speed: 0.02, pulse: 0.08, gate: true, division: 8, output: 0.88 };
  return { phase, energy: 0, density: 0, speed: 0, pulse: 0, gate: false, division: 8, output: 0.86 };
}

function withNode(graph, id, patch) {
  return updateGeneratorGraphNode(graph, id, patch);
}

function setLane(curves, id, patch) {
  const normalized = normalizeGeneratorCurves(curves);
  return normalizeGeneratorCurves({
    ...normalized,
    lanes: normalized.lanes.map((lane) => lane.id === id ? { ...lane, ...patch } : lane)
  });
}

function blendValue(current, target, amount = 1) {
  const a = clamp01(amount, 1);
  return clamp01(clamp01(current, target) * (1 - a) + clamp01(target, current) * a, target);
}

export function normalizeShowOsBridgePayload(input = {}) {
  const payload = input && typeof input === 'object' ? input : {};
  const authority = payload.authority && typeof payload.authority === 'object' ? payload.authority : {};
  const limits = authority.limits && typeof authority.limits === 'object' ? authority.limits : {};
  return {
    version: GENERATOR_SHOWOS_BRIDGE_VERSION,
    source: asText(payload.source || payload.rendererIntent || 'show-os-bridge'),
    targetWorld: asText(payload.targetWorld || payload.world || payload.currentWorld, 'Forge Reactor'),
    targetUniverse: asText(payload.targetUniverse || payload.universe, 'Forge Universe'),
    targetWeather: asText(payload.targetWeather || payload.weather, 'Calm'),
    universeTone: asText(payload.universeTone, ''),
    storyPhase: asText(payload.storyPhase || payload.phase, 'BUILD'),
    storyStep: asText(payload.storyStep, ''),
    energy: Math.min(clamp100(limits.energy, 100), clamp100(payload.energy, 62)),
    chaos: Math.min(clamp100(limits.chaos, 100), clamp100(payload.chaos, 34)),
    density: Math.min(clamp100(limits.density, 100), clamp100(payload.density, 48)),
    motion: Math.min(clamp100(limits.motion, 100), clamp100(payload.motion, 56)),
    authority: {
      mode: asText(authority.mode, 'ASSIST'),
      autoApply: Boolean(authority.autoApply),
      operatorLock: Boolean(authority.operatorLock),
      limits
    },
    t: Number(payload.t || Date.now()) || Date.now()
  };
}

export function mapShowOsBridgeToGeneratorState(payloadInput = {}, currentState = {}, options = {}) {
  const payload = normalizeShowOsBridgePayload(payloadInput);
  const currentPatch = normalizeGeneratorPatch({ ...GENERATOR_DEFAULT_PATCH, ...(currentState.patch || {}) });
  let graph = normalizeGeneratorGraph(currentState.graph || currentPatch.graph || createDefaultGeneratorGraph());
  let curves = normalizeGeneratorCurves(currentState.curves || createDefaultGeneratorCurves());
  const world = profileForWorld(payload);
  const weather = profileForWeather(payload);
  const phase = phaseProfile(payload);
  const influence = clamp01(options.influence, payload.authority.operatorLock ? 0.35 : 0.78);
  const chaos = pct(payload.chaos, 34);
  const energy = clamp01(pct(payload.energy, 62) + world.energy + weather.energy + phase.energy, currentPatch.energy);
  const density = clamp01(pct(payload.density, 48) + world.density + weather.density + phase.density + chaos * 0.05, currentPatch.density);
  const speed = clamp01(pct(payload.motion, 56) + weather.speed + phase.speed + chaos * 0.08, currentPatch.speed);
  const feedback = clamp01(chaos * 0.54 + pct(payload.density, 48) * 0.18 + (payload.authority.operatorLock ? -0.12 : 0), currentPatch.feedback);
  const warp = clamp01(pct(payload.motion, 56) * 0.42 + chaos * 0.28 + world.warp, currentPatch.warp);
  const pulse = clamp01(pct(payload.energy, 62) * 0.42 + phase.pulse + (weather.gate ? 0.14 : 0), currentPatch.pulse);
  const shimmer = clamp01(chaos * 0.32 + pct(payload.energy, 62) * 0.20 + world.shimmer + weather.shimmer, currentPatch.shimmer);
  const colorShift = clamp01(world.colorShift + chaos * 0.035 + (weather === WEATHER_PROFILES.Solar ? 0.04 : 0), currentPatch.colorShift);
  const output = clamp01(phase.output ?? 0.86, 0.86);
  const targetPatch = normalizeGeneratorPatch({
    ...currentPatch,
    name: `SHOW OS · ${payload.targetWorld}`.slice(0, 64),
    energy,
    density,
    speed,
    colorShift,
    feedback,
    warp,
    pulse,
    shimmer
  });
  const blendedPatch = normalizeGeneratorPatch({
    ...currentPatch,
    name: targetPatch.name,
    energy: blendValue(currentPatch.energy, targetPatch.energy, influence),
    density: blendValue(currentPatch.density, targetPatch.density, influence),
    speed: blendValue(currentPatch.speed, targetPatch.speed, influence),
    colorShift: blendValue(currentPatch.colorShift, targetPatch.colorShift, Math.min(1, influence * 0.75)),
    feedback: blendValue(currentPatch.feedback, targetPatch.feedback, influence),
    warp: blendValue(currentPatch.warp, targetPatch.warp, influence),
    pulse: blendValue(currentPatch.pulse, targetPatch.pulse, influence),
    shimmer: blendValue(currentPatch.shimmer, targetPatch.shimmer, influence)
  });

  const nodeWeights = world.nodes || {};
  for (const [id, weight] of Object.entries(nodeWeights)) {
    graph = withNode(graph, id, { enabled: weight > 0.06, mix: blendValue(graph.nodes?.find((n) => n.id === id)?.mix, weight, influence), intensity: blendValue(graph.nodes?.find((n) => n.id === id)?.intensity, weight, influence) });
  }
  graph = withNode(graph, 'gate', { enabled: Boolean(weather.gate || phase.gate), mix: clamp01(0.30 + chaos * 0.56 + (phase.gate ? 0.16 : 0)), intensity: clamp01(0.32 + pct(payload.energy, 62) * 0.48) });
  graph = withNode(graph, 'output', { enabled: true, mix: output, intensity: clamp01(0.70 + energy * 0.30) });
  graph = withNode(graph, 'colorFlow', { enabled: true, mix: clamp01(0.58 + energy * 0.24 + shimmer * 0.12), intensity: clamp01(0.64 + density * 0.18) });
  graph = withNode(graph, 'particles', { enabled: density > 0.18 || shimmer > 0.18, mix: clamp01(0.20 + density * 0.42 + shimmer * 0.30), intensity: clamp01(0.24 + energy * 0.34 + chaos * 0.24) });
  graph = normalizeGeneratorGraph(graph);

  const lanePatch = {
    energy: { value: blendedPatch.energy, mode: phase.phase.includes('RECOVERY') || phase.phase.includes('AFTER') ? 'lfo' : 'manual', smooth: 0.30, depth: 0.16 },
    density: { value: blendedPatch.density, mode: payload.authority.operatorLock ? 'manual' : 'lfo', smooth: 0.36, depth: 0.12, rate: 0.018 },
    speed: { value: blendedPatch.speed, mode: 'manual', smooth: 0.34, depth: 0.10 },
    colorShift: { value: blendedPatch.colorShift, mode: 'lfo', smooth: 0.22, depth: 0.34, rate: world.family === 'cosmic' ? 0.018 : 0.036 },
    feedback: { value: blendedPatch.feedback, mode: chaos > 0.52 ? 'random' : 'manual', smooth: 0.46, depth: chaos > 0.52 ? 0.20 : 0.08, rate: 0.45 + chaos * 1.2 },
    warp: { value: blendedPatch.warp, mode: 'lfo', smooth: 0.28, depth: 0.18 + chaos * 0.12, rate: 0.024 + speed * 0.04 },
    pulse: { value: blendedPatch.pulse, mode: weather.pulseMode || 'beat', smooth: phase.gate ? 0.08 : 0.18, depth: phase.gate ? 0.62 : 0.32, division: phase.division || 8 },
    shimmer: { value: blendedPatch.shimmer, mode: weather.gate || chaos > 0.45 ? 'random' : 'manual', smooth: 0.42, depth: clamp01(0.10 + chaos * 0.30), rate: 0.6 + chaos * 3.2 }
  };
  for (const [id, patch] of Object.entries(lanePatch)) curves = setLane(curves, id, patch);
  curves = normalizeGeneratorCurves(curves);
  const patch = normalizeGeneratorPatch({ ...blendedPatch, macros: patchValuesToMacros(blendedPatch), modules: graphToModuleFlags(graph), graph });
  return {
    version: GENERATOR_SHOWOS_BRIDGE_VERSION,
    patch,
    graph,
    curves,
    summary: {
      targetWorld: payload.targetWorld,
      targetUniverse: payload.targetUniverse,
      targetWeather: payload.targetWeather,
      storyPhase: payload.storyPhase,
      worldFamily: world.family,
      influence,
      operatorLock: payload.authority.operatorLock,
      autoApply: payload.authority.autoApply,
      graphLabel: (graph.nodes || []).filter((node) => node.enabled !== false).map((node) => node.id).join(' → '),
      values: { energy: patch.energy, density: patch.density, speed: patch.speed, colorShift: patch.colorShift, feedback: patch.feedback, warp: patch.warp, pulse: patch.pulse, shimmer: patch.shimmer }
    },
    payload
  };
}

export function readShowOsBridgePayload(storage = globalThis.localStorage) {
  const performancePayload = safeParseJson(storage?.getItem?.(SHOWOS_PERFORMANCE_BRIDGE_KEY), null);
  if (performancePayload && typeof performancePayload === 'object') return normalizeShowOsBridgePayload(performancePayload);
  const intentPayload = safeParseJson(storage?.getItem?.(SHOWOS_INTENT_KEY), null);
  if (intentPayload && typeof intentPayload === 'object') return normalizeShowOsBridgePayload(intentPayload);
  return null;
}

export function isGeneratorShowOsAutoFollowEnabled(storage = globalThis.localStorage) {
  try { return storage.getItem(GENERATOR_SHOWOS_AUTO_KEY) === '1'; } catch { return false; }
}

export function setGeneratorShowOsAutoFollowEnabled(enabled, storage = globalThis.localStorage) {
  try { storage.setItem(GENERATOR_SHOWOS_AUTO_KEY, enabled ? '1' : '0'); } catch {}
  return Boolean(enabled);
}

export function writeGeneratorShowOsSnapshot(snapshot = {}, storage = globalThis.localStorage) {
  const safe = { version: GENERATOR_SHOWOS_BRIDGE_VERSION, ...snapshot, at: Date.now() };
  try { storage.setItem(GENERATOR_SHOWOS_SNAPSHOT_KEY, JSON.stringify(safe)); } catch {}
  try { globalThis.window?.parent?.postMessage?.({ type: 'led-generator-showos-bridge', detail: safe }, '*'); } catch {}
  return safe;
}

export function applyShowOsBridgeToGeneratorStorage(storage = globalThis.localStorage, options = {}) {
  const payload = readShowOsBridgePayload(storage);
  if (!payload) return { ok: false, reason: 'no-showos-bridge-payload' };
  const current = loadGeneratorState(storage);
  const mapped = mapShowOsBridgeToGeneratorState(payload, current, options);
  saveGeneratorState({ ...current, patch: mapped.patch, graph: mapped.graph, curves: mapped.curves, mode: current.mode === 'live' ? 'preview' : current.mode }, storage);
  const snapshot = writeGeneratorShowOsSnapshot({ ok: true, source: 'storage-apply', summary: mapped.summary, payload: mapped.payload }, storage);
  return { ok: true, mapped, snapshot };
}
