import { GENERATOR_DEFAULT_PATCH, normalizeGeneratorPatch } from './generator_engine.js';
import { createDefaultGeneratorGraph, normalizeGeneratorGraph, updateGeneratorGraphNode } from './generator_graph.js';
import { createDefaultGeneratorCurves, normalizeGeneratorCurves, patchValuesToMacros } from './generator_curves.js';

export const GENERATOR_PRESETS_VERSION = 'STEP38U_GENERATOR_PRESET_BANK_SHADER_MODULES';
export const GENERATOR_PRESET_BANK_KEY = 'budilight.generator.presetBank.v1';
export const GENERATOR_ACTIVE_PRESET_KEY = 'budilight.generator.activePreset.v1';

function safeJsonParse(text, fallback = null) {
  try { return JSON.parse(text || ''); } catch { return fallback; }
}

function cloneJson(value, fallback = {}) {
  try { return JSON.parse(JSON.stringify(value)); } catch { return fallback; }
}

function makePresetId(prefix = 'preset') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function normalizePreset(input = {}, fallbackIndex = 0) {
  const patch = normalizeGeneratorPatch({ ...GENERATOR_DEFAULT_PATCH, ...(input.patch || {}) });
  const graph = normalizeGeneratorGraph(input.graph && typeof input.graph === 'object' ? cloneJson(input.graph, createDefaultGeneratorGraph()) : createDefaultGeneratorGraph());
  const curves = normalizeGeneratorCurves(input.curves || createDefaultGeneratorCurves());
  const id = String(input.id || makePresetId(`preset-${fallbackIndex + 1}`));
  return {
    id,
    version: GENERATOR_PRESETS_VERSION,
    name: String(input.name || patch.name || `Patch ${fallbackIndex + 1}`).slice(0, 64),
    createdAt: Number(input.createdAt || Date.now()),
    updatedAt: Number(input.updatedAt || Date.now()),
    patch: { ...patch, macros: patchValuesToMacros(patch) },
    graph,
    curves
  };
}

export function createFactoryGeneratorPresets() {
  const baseGraph = createDefaultGeneratorGraph();
  const baseCurves = createDefaultGeneratorCurves();
  const base = normalizeGeneratorPatch({ ...GENERATOR_DEFAULT_PATCH, macros: patchValuesToMacros(GENERATOR_DEFAULT_PATCH) });
  const graphWith = (patches = {}) => Object.entries(patches).reduce((graph, [id, nodePatch]) => updateGeneratorGraphNode(graph, id, nodePatch), baseGraph);
  const mk = (id, name, patchPatch, curvePatch = {}, graphPatch = {}) => normalizePreset({
    id,
    name,
    createdAt: 0,
    updatedAt: 0,
    patch: normalizeGeneratorPatch({ ...base, name, ...patchPatch }),
    graph: graphWith(graphPatch),
    curves: {
      ...baseCurves,
      lanes: baseCurves.lanes.map((lane) => ({ ...lane, ...(curvePatch[lane.id] || {}) }))
    }
  });
  return [
    mk('factory-psy-tunnel-starter', 'Psy Tunnel Starter', { energy: 0.72, density: 0.62, speed: 0.54, colorShift: 0.36, feedback: 0.28, warp: 0.44, pulse: 0.50, shimmer: 0.30 }, {}, {
      plasma: { mix: 0.56, intensity: 0.72 },
      tunnel: { mix: 0.94, intensity: 0.92 },
      kaleido: { mix: 0.36, intensity: 0.44 },
      gate: { enabled: false },
      output: { mix: 1, intensity: 1 }
    }),
    mk('factory-deep-breathing-plasma', 'Deep Breathing Plasma', { energy: 0.45, density: 0.38, speed: 0.22, colorShift: 0.58, feedback: 0.42, warp: 0.62, pulse: 0.25, shimmer: 0.16 }, { energy: { mode: 'lfo', rate: 0.018, depth: 0.28 }, colorShift: { mode: 'lfo', rate: 0.022, depth: 0.55 }, pulse: { mode: 'manual', value: 0.25 } }, {
      plasma: { mix: 0.92, intensity: 0.82 },
      tunnel: { mix: 0.24, intensity: 0.42 },
      grid: { enabled: false },
      particles: { mix: 0.16, intensity: 0.30 },
      scanline: { mix: 0.18, intensity: 0.24 }
    }),
    mk('factory-percussive-grid-spark', 'Percussive Grid Spark', { energy: 0.82, density: 0.78, speed: 0.64, colorShift: 0.18, feedback: 0.18, warp: 0.32, pulse: 0.82, shimmer: 0.66 }, { pulse: { mode: 'beat', division: 4, depth: 0.72, smooth: 0.08 }, shimmer: { mode: 'random', rate: 3.5, depth: 0.44 } }, {
      plasma: { mix: 0.32, intensity: 0.55 },
      tunnel: { mix: 0.58, intensity: 0.62 },
      grid: { mix: 0.88, intensity: 0.86 },
      particles: { mix: 0.96, intensity: 0.90 },
      gate: { enabled: true, mix: 0.76, intensity: 0.70 },
      scanline: { mix: 0.72, intensity: 0.68 }
    }),
    mk('factory-liquid-glass-organism', 'Liquid Glass Organism', { energy: 0.62, density: 0.55, speed: 0.34, colorShift: 0.48, feedback: 0.34, warp: 0.70, pulse: 0.42, shimmer: 0.38 }, { warp: { mode: 'lfo', rate: 0.032, depth: 0.44 }, colorShift: { mode: 'lfo', rate: 0.024, depth: 0.35 }, shimmer: { mode: 'manual', value: 0.38 } }, {
      plasma: { mix: 0.56, intensity: 0.70 },
      tunnel: { mix: 0.18, intensity: 0.30 },
      liquidGlass: { enabled: true, mix: 0.84, intensity: 0.78 },
      neonOrganism: { enabled: true, mix: 0.72, intensity: 0.76 },
      colorFlow: { mix: 0.86, intensity: 0.82 },
      gate: { enabled: false },
      scanline: { mix: 0.22, intensity: 0.28 }
    }),
    mk('factory-electric-veins-drop', 'Electric Veins Drop', { energy: 0.90, density: 0.82, speed: 0.74, colorShift: 0.68, feedback: 0.22, warp: 0.48, pulse: 0.92, shimmer: 0.86 }, { pulse: { mode: 'beat', division: 4, depth: 0.82, smooth: 0.04 }, shimmer: { mode: 'random', rate: 5.0, depth: 0.48 }, energy: { mode: 'beat', division: 1, depth: 0.35, smooth: 0.06 } }, {
      plasma: { mix: 0.24, intensity: 0.42 },
      tunnel: { mix: 0.70, intensity: 0.78 },
      grid: { mix: 0.50, intensity: 0.66 },
      electricVeins: { enabled: true, mix: 0.92, intensity: 0.88 },
      digitalRain: { enabled: true, mix: 0.46, intensity: 0.54 },
      audioPulseField: { enabled: true, mix: 0.74, intensity: 0.82 },
      gate: { enabled: true, mix: 0.86, intensity: 0.82 },
      scanline: { mix: 0.62, intensity: 0.70 }
    }),
    mk('factory-solar-magnetic-snake', 'Solar Magnetic Snake', { energy: 0.74, density: 0.70, speed: 0.62, colorShift: 0.12, feedback: 0.30, warp: 0.58, pulse: 0.58, shimmer: 0.54 }, { speed: { mode: 'lfo', rate: 0.035, depth: 0.34 }, density: { mode: 'lfo', rate: 0.018, depth: 0.28 }, pulse: { mode: 'beat', division: 8, depth: 0.42, smooth: 0.12 } }, {
      plasma: { mix: 0.26, intensity: 0.48 },
      tunnel: { mix: 0.34, intensity: 0.52 },
      fractalSnake: { enabled: true, mix: 0.88, intensity: 0.82 },
      solarWind: { enabled: true, mix: 0.78, intensity: 0.74 },
      magneticParticles: { enabled: true, mix: 0.82, intensity: 0.80 },
      colorFlow: { mix: 0.76, intensity: 0.82 },
      gate: { enabled: false },
      scanline: { mix: 0.30, intensity: 0.38 }
    })
  ];
}

export function normalizeGeneratorPresetBank(input = {}) {
  const factory = createFactoryGeneratorPresets();
  const custom = Array.isArray(input.custom) ? input.custom.map((preset, index) => normalizePreset(preset, index)).filter(Boolean) : [];
  return {
    version: GENERATOR_PRESETS_VERSION,
    factory,
    custom,
    updatedAt: Number(input.updatedAt || Date.now())
  };
}

export function loadGeneratorPresetBank(storage = globalThis.localStorage) {
  const raw = (() => { try { return storage.getItem(GENERATOR_PRESET_BANK_KEY); } catch { return ''; } })();
  return normalizeGeneratorPresetBank(safeJsonParse(raw, {}));
}

export function saveGeneratorPresetBank(bank, storage = globalThis.localStorage) {
  const normalized = normalizeGeneratorPresetBank({ ...bank, updatedAt: Date.now() });
  try {
    storage.setItem(GENERATOR_PRESET_BANK_KEY, JSON.stringify({
      version: normalized.version,
      custom: normalized.custom,
      updatedAt: normalized.updatedAt
    }));
  } catch {}
  return normalized;
}

export function saveGeneratorPresetSnapshot(bank, snapshot = {}, storage = globalThis.localStorage) {
  const normalizedBank = normalizeGeneratorPresetBank(bank);
  const preset = normalizePreset({
    id: makePresetId('custom'),
    name: snapshot.name || snapshot.patch?.name || `Generator ${new Date().toLocaleTimeString()}`,
    patch: snapshot.patch,
    graph: snapshot.graph,
    curves: snapshot.curves,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }, normalizedBank.custom.length);
  normalizedBank.custom.unshift(preset);
  while (normalizedBank.custom.length > 30) normalizedBank.custom.pop();
  return { bank: saveGeneratorPresetBank(normalizedBank, storage), preset };
}

export function findGeneratorPreset(bank, id) {
  const normalized = normalizeGeneratorPresetBank(bank);
  return [...normalized.custom, ...normalized.factory].find((preset) => preset.id === id) || normalized.factory[0] || null;
}

export function deleteGeneratorPreset(bank, id, storage = globalThis.localStorage) {
  const normalized = normalizeGeneratorPresetBank(bank);
  normalized.custom = normalized.custom.filter((preset) => preset.id !== id);
  return saveGeneratorPresetBank(normalized, storage);
}

export function rememberActiveGeneratorPreset(id, storage = globalThis.localStorage) {
  try { storage.setItem(GENERATOR_ACTIVE_PRESET_KEY, String(id || '')); } catch {}
}

export function loadActiveGeneratorPreset(storage = globalThis.localStorage) {
  try { return storage.getItem(GENERATOR_ACTIVE_PRESET_KEY) || ''; } catch { return ''; }
}
