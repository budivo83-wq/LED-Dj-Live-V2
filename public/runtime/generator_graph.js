export const GENERATOR_GRAPH_VERSION = 'STEP38U_GENERATOR_SHADER_MODULES';

export const GENERATOR_NODE_TYPES = Object.freeze(['source', 'modifier', 'color', 'fx', 'output']);

export const GENERATOR_MODULES = Object.freeze([
  { id: 'plasma', name: 'Plasma Field', type: 'source', description: 'měkká tekutá vrstva pro základní pohyb', defaultMix: 0.68, defaultIntensity: 0.82 },
  { id: 'tunnel', name: 'Psy Tunnel', type: 'source', description: 'hloubkový tunel přes úhel a radius', defaultMix: 0.82, defaultIntensity: 0.88 },
  { id: 'grid', name: 'Beat Grid', type: 'modifier', description: 'geometrická síť pro rytmické členění', defaultMix: 0.48, defaultIntensity: 0.58 },
  { id: 'particles', name: 'Spark Particles', type: 'modifier', description: 'jemné perkusivní jiskry', defaultMix: 0.54, defaultIntensity: 0.66 },
  { id: 'kaleido', name: 'Soft Kaleido Warp', type: 'modifier', description: 'měkké zrcadlení a ohýbání souřadnic', defaultMix: 0.38, defaultIntensity: 0.42 },
  { id: 'colorFlow', name: 'Color Flow', type: 'color', description: 'barevný drift podle pole, úhlu a času', defaultMix: 0.72, defaultIntensity: 0.76 },
  { id: 'gate', name: 'Beat Gate', type: 'fx', description: 'beatově seká intenzitu bez přepisu výstupu', defaultMix: 0.42, defaultIntensity: 0.58 },
  { id: 'scanline', name: 'Scanline Shimmer', type: 'fx', description: 'jemné řádkové třpytky a pohyb detailu', defaultMix: 0.34, defaultIntensity: 0.44 },
  { id: 'liquidGlass', name: 'Liquid Glass', type: 'source', description: 'tekuté čočkování a hladké lomové vlny', defaultMix: 0.52, defaultIntensity: 0.62, defaultEnabled: false },
  { id: 'electricVeins', name: 'Electric Veins', type: 'fx', description: 'tenké elektrické žíly reagující na energii a shimmer', defaultMix: 0.46, defaultIntensity: 0.58, defaultEnabled: false },
  { id: 'fractalSnake', name: 'Fractal Snake', type: 'source', description: 'hadovitý fraktální proud přes délku stripů', defaultMix: 0.50, defaultIntensity: 0.64, defaultEnabled: false },
  { id: 'solarWind', name: 'Solar Wind', type: 'modifier', description: 'směrový proud částic a měkký vítr v ose pásků', defaultMix: 0.48, defaultIntensity: 0.60, defaultEnabled: false },
  { id: 'digitalRain', name: 'Digital Rain', type: 'fx', description: 'vertikální digitální déšť pro rytmické rozbití obrazu', defaultMix: 0.44, defaultIntensity: 0.56, defaultEnabled: false },
  { id: 'magneticParticles', name: 'Magnetic Particles', type: 'modifier', description: 'částice přitahované k pohyblivým magnetickým pólům', defaultMix: 0.50, defaultIntensity: 0.64, defaultEnabled: false },
  { id: 'neonOrganism', name: 'Neon Organism', type: 'source', description: 'organické pulzující buňky a měkké neonové jádro', defaultMix: 0.54, defaultIntensity: 0.66, defaultEnabled: false },
  { id: 'audioPulseField', name: 'Audio Pulse Field', type: 'fx', description: 'beatové kruhové pulzy připravené pro budoucí audio/MIDI energii', defaultMix: 0.42, defaultIntensity: 0.58, defaultEnabled: false },
  { id: 'output', name: 'Master Output', type: 'output', description: 'finální master fader pro celý generator frame', defaultMix: 1, defaultIntensity: 1, locked: true }
]);


export const GENERATOR_NODE_CATALOG = Object.freeze([
  { templateId: 'plasma', moduleId: 'plasma', label: 'Plasma Field', type: 'source', category: 'SOURCE', description: 'měkká tekutá vrstva pro základní pohyb' },
  { templateId: 'tunnel', moduleId: 'tunnel', label: 'Psy Tunnel', type: 'source', category: 'SOURCE', description: 'hloubkový tunel přes úhel a radius' },
  { templateId: 'liquidGlass', moduleId: 'liquidGlass', label: 'Liquid Glass', type: 'source', category: 'SOURCE', description: 'tekuté čočkování a hladké lomové vlny' },
  { templateId: 'fractalSnake', moduleId: 'fractalSnake', label: 'Fractal Snake', type: 'source', category: 'SOURCE', description: 'hadovitý fraktální proud přes délku stripů' },
  { templateId: 'neonOrganism', moduleId: 'neonOrganism', label: 'Neon Organism', type: 'source', category: 'SOURCE', description: 'organické pulzující buňky a měkké neonové jádro' },
  { templateId: 'grid', moduleId: 'grid', label: 'Beat Grid', type: 'modifier', category: 'MODIFIER', description: 'geometrická síť pro rytmické členění' },
  { templateId: 'particles', moduleId: 'particles', label: 'Spark Particles', type: 'modifier', category: 'MODIFIER', description: 'jemné perkusivní jiskry' },
  { templateId: 'kaleido', moduleId: 'kaleido', label: 'Soft Kaleido Warp', type: 'modifier', category: 'MODIFIER', description: 'měkké zrcadlení a ohýbání souřadnic' },
  { templateId: 'solarWind', moduleId: 'solarWind', label: 'Solar Wind', type: 'modifier', category: 'MODIFIER', description: 'směrový proud částic a měkký vítr v ose pásků' },
  { templateId: 'magneticParticles', moduleId: 'magneticParticles', label: 'Magnetic Particles', type: 'modifier', category: 'MODIFIER', description: 'částice přitahované k pohyblivým magnetickým pólům' },
  { templateId: 'colorFlow', moduleId: 'colorFlow', label: 'Color Flow', type: 'color', category: 'COLOR', description: 'barevný drift podle pole, úhlu a času' },
  { templateId: 'gate', moduleId: 'gate', label: 'Beat Gate', type: 'fx', category: 'FX', description: 'beatově seká intenzitu bez přepisu výstupu' },
  { templateId: 'scanline', moduleId: 'scanline', label: 'Scanline Shimmer', type: 'fx', category: 'FX', description: 'jemné řádkové třpytky a pohyb detailu' },
  { templateId: 'electricVeins', moduleId: 'electricVeins', label: 'Electric Veins', type: 'fx', category: 'FX', description: 'tenké elektrické žíly reagující na energii a shimmer' },
  { templateId: 'digitalRain', moduleId: 'digitalRain', label: 'Digital Rain', type: 'fx', category: 'FX', description: 'vertikální digitální déšť pro rytmické rozbití obrazu' },
  { templateId: 'audioPulseField', moduleId: 'audioPulseField', label: 'Audio Pulse Field', type: 'fx', category: 'FX', description: 'beatové kruhové pulzy připravené pro budoucí audio/MIDI energii' }
]);

function clamp01(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(1, n));
}

function clampOrder(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(999, Math.trunc(n)));
}

function normalizeType(type, fallback = 'modifier') {
  const text = String(type || '').trim();
  return GENERATOR_NODE_TYPES.includes(text) ? text : fallback;
}

function moduleFor(id) {
  return GENERATOR_MODULES.find((module) => module.id === id) || null;
}

function catalogFor(templateId) {
  const id = String(templateId || '').trim();
  return GENERATOR_NODE_CATALOG.find((item) => item.templateId === id || item.moduleId === id) || null;
}

function normalizeNodeId(value, fallback = 'node') {
  return String(value || fallback).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48) || fallback;
}

function makeUniqueNodeId(nodes, base) {
  const cleanBase = normalizeNodeId(base, 'node');
  const used = new Set((Array.isArray(nodes) ? nodes : []).map((node) => String(node?.id || '')));
  if (!used.has(cleanBase)) return cleanBase;
  for (let index = 2; index < 999; index += 1) {
    const candidate = `${cleanBase}-${index}`;
    if (!used.has(candidate)) return candidate;
  }
  return `${cleanBase}-${Date.now().toString(36).slice(-5)}`;
}

export function listGeneratorNodeCatalog() {
  return GENERATOR_NODE_CATALOG.map((item) => ({ ...item }));
}

export function normalizeGeneratorNode(input = {}, fallbackIndex = 0) {
  const module = moduleFor(input.id) || moduleFor(input.moduleId) || null;
  const id = normalizeNodeId(input.id || module?.id || `node-${fallbackIndex + 1}`, `node-${fallbackIndex + 1}`);
  const moduleId = normalizeNodeId(input.moduleId || module?.id || id, id);
  const baseModule = moduleFor(moduleId) || module;
  const type = normalizeType(input.type || baseModule?.type || module?.type, baseModule?.type || module?.type || 'modifier');
  const locked = Boolean(input.locked || baseModule?.locked || module?.locked || id === 'output');
  const defaultMix = clamp01(baseModule?.defaultMix ?? module?.defaultMix, 0.65);
  const defaultIntensity = clamp01(baseModule?.defaultIntensity ?? module?.defaultIntensity, 0.7);
  const deleted = locked ? false : input.deleted === true;
  return {
    id,
    moduleId,
    name: String(input.name || baseModule?.name || module?.name || id).slice(0, 64),
    type,
    enabled: deleted ? false : (locked ? true : input.enabled !== false),
    locked,
    deleted,
    mix: clamp01(input.mix, defaultMix),
    intensity: clamp01(input.intensity, defaultIntensity),
    order: clampOrder(input.order, fallbackIndex),
    description: String(input.description || baseModule?.description || module?.description || '').slice(0, 180)
  };
}

export function createDefaultGeneratorGraph() {
  return normalizeGeneratorGraph({
    version: GENERATOR_GRAPH_VERSION,
    nodes: GENERATOR_MODULES.map((module, index) => ({
      id: module.id,
      name: module.name,
      type: module.type,
      enabled: module.id !== 'gate' && module.defaultEnabled !== false,
      locked: Boolean(module.locked),
      mix: module.defaultMix,
      intensity: module.defaultIntensity,
      order: index,
      description: module.description
    }))
  });
}

export function normalizeGeneratorGraph(input = {}) {
  const sourceNodes = Array.isArray(input.nodes) ? input.nodes : [];
  const byId = new Map(sourceNodes.map((node, index) => [String(node?.id || `node-${index}`), node || {}]));
  const nodes = GENERATOR_MODULES.map((module, index) => normalizeGeneratorNode({
    ...module,
    ...(byId.get(module.id) || {}),
    id: module.id,
    locked: Boolean(module.locked || byId.get(module.id)?.locked)
  }, index));
  const customNodes = sourceNodes
    .filter((node) => node?.id && !GENERATOR_MODULES.some((module) => module.id === node.id))
    .map((node, index) => normalizeGeneratorNode(node, nodes.length + index));
  const merged = [...nodes, ...customNodes]
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
    .map((node, index) => ({ ...node, order: index }));
  return {
    version: GENERATOR_GRAPH_VERSION,
    nodes: merged,
    updatedAt: Number(input.updatedAt || Date.now())
  };
}

export function graphToModuleFlags(graph) {
  const normalized = normalizeGeneratorGraph(graph);
  const flags = Object.create(null);
  for (const module of GENERATOR_MODULES) flags[module.id] = module.id === 'output';
  for (const node of normalized.nodes) {
    const enabled = node.deleted !== true && node.enabled !== false;
    flags[node.id] = enabled;
    if (moduleFor(node.moduleId)) flags[node.moduleId] = Boolean(flags[node.moduleId] || enabled);
  }
  return flags;
}

export function graphToRenderPlan(graph) {
  const normalized = normalizeGeneratorGraph(graph);
  const nodes = normalized.nodes
    .filter((node) => node.deleted !== true)
    .slice()
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
  const byId = Object.create(null);
  const moduleWeights = Object.create(null);
  const stages = Object.fromEntries(GENERATOR_NODE_TYPES.map((type) => [type, []]));
  for (const node of nodes) {
    const enabled = node.enabled !== false;
    const weight = enabled ? clamp01(node.mix, 0.65) * clamp01(node.intensity, 0.7) : 0;
    const moduleId = moduleFor(node.moduleId) ? node.moduleId : node.id;
    const planned = { ...node, moduleId, enabled, weight };
    byId[node.id] = planned;
    moduleWeights[moduleId] = clamp01((moduleWeights[moduleId] || 0) + weight, 0);
    if (stages[planned.type]) stages[planned.type].push(planned);
  }
  return {
    version: GENERATOR_GRAPH_VERSION,
    nodes,
    byId,
    moduleWeights,
    stages,
    output: byId.output || normalizeGeneratorNode({ id: 'output', moduleId: 'output', type: 'output', enabled: true, mix: 1, intensity: 1 }, nodes.length)
  };
}

export function updateGeneratorGraphNode(graph, id, patch = {}) {
  const normalized = normalizeGeneratorGraph(graph);
  return normalizeGeneratorGraph({
    ...normalized,
    nodes: normalized.nodes.map((node) => node.id === id ? { ...node, ...patch, id: node.id, locked: node.locked } : node),
    updatedAt: Date.now()
  });
}

export function reorderGeneratorGraphNode(graph, id, direction = 0) {
  const nodes = normalizeGeneratorGraph(graph).nodes.slice().sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
  const index = nodes.findIndex((node) => node.id === id);
  const swapIndex = index + Math.sign(Number(direction) || 0);
  if (index < 0 || swapIndex < 0 || swapIndex >= nodes.length) return normalizeGeneratorGraph({ nodes });
  const copy = nodes.slice();
  const temp = copy[index];
  copy[index] = copy[swapIndex];
  copy[swapIndex] = temp;
  return normalizeGeneratorGraph({ nodes: copy.map((node, order) => ({ ...node, order })), updatedAt: Date.now() });
}


export function addGeneratorGraphNode(graph, templateId, options = {}) {
  const normalized = normalizeGeneratorGraph(graph);
  const catalog = catalogFor(templateId) || catalogFor(options.moduleId) || GENERATOR_NODE_CATALOG[0];
  const nodes = normalized.nodes.slice();
  const moduleId = catalog.moduleId;
  const existingCore = nodes.find((node) => node.id === moduleId && node.deleted === true);
  if (existingCore && options.forceDuplicate !== true) {
    return normalizeGeneratorGraph({
      ...normalized,
      nodes: nodes.map((node) => node.id === existingCore.id ? { ...node, deleted: false, enabled: true } : node),
      updatedAt: Date.now()
    });
  }
  const order = Math.min(998, Math.max(0, Number.isFinite(Number(options.order)) ? Number(options.order) : nodes.length));
  const idBase = options.id || `${moduleId}-node`;
  const id = makeUniqueNodeId(nodes, idBase);
  const node = normalizeGeneratorNode({
    id,
    moduleId,
    name: options.name || `${catalog.label} ${id.replace(`${moduleId}-`, '').replace('node-', '')}`,
    type: catalog.type,
    enabled: options.enabled !== false,
    mix: options.mix ?? moduleFor(moduleId)?.defaultMix ?? 0.65,
    intensity: options.intensity ?? moduleFor(moduleId)?.defaultIntensity ?? 0.7,
    order,
    description: options.description || catalog.description
  }, nodes.length);
  const shifted = nodes.map((item) => ({ ...item, order: Number(item.order || 0) >= order ? Number(item.order || 0) + 1 : Number(item.order || 0) }));
  return normalizeGeneratorGraph({ ...normalized, nodes: [...shifted, node], updatedAt: Date.now() });
}

export function duplicateGeneratorGraphNode(graph, id) {
  const normalized = normalizeGeneratorGraph(graph);
  const source = normalized.nodes.find((node) => node.id === id && node.deleted !== true);
  if (!source || source.id === 'output') return normalized;
  return addGeneratorGraphNode(normalized, source.moduleId || source.id, {
    forceDuplicate: true,
    id: `${source.moduleId || source.id}-copy`,
    name: `${source.name || source.id} copy`,
    enabled: source.enabled !== false,
    mix: source.mix,
    intensity: source.intensity,
    order: Number(source.order || 0) + 1,
    description: source.description
  });
}

export function deleteGeneratorGraphNode(graph, id) {
  const normalized = normalizeGeneratorGraph(graph);
  const nodes = normalized.nodes.slice();
  const target = nodes.find((node) => node.id === id);
  if (!target || target.locked) return normalized;
  const isCore = GENERATOR_MODULES.some((module) => module.id === id);
  const next = isCore
    ? nodes.map((node) => node.id === id ? { ...node, deleted: true, enabled: false } : node)
    : nodes.filter((node) => node.id !== id);
  return normalizeGeneratorGraph({ ...normalized, nodes: next.map((node, order) => ({ ...node, order })), updatedAt: Date.now() });
}

export function soloGeneratorGraphNode(graph, id) {
  const normalized = normalizeGeneratorGraph(graph);
  return normalizeGeneratorGraph({
    ...normalized,
    nodes: normalized.nodes.map((node) => {
      if (node.locked || node.id === 'output') return { ...node, enabled: true };
      if (node.deleted === true) return node;
      return { ...node, enabled: node.id === id };
    }),
    updatedAt: Date.now()
  });
}

export function clearGeneratorGraphSolo(graph) {
  const normalized = normalizeGeneratorGraph(graph);
  return normalizeGeneratorGraph({
    ...normalized,
    nodes: normalized.nodes.map((node) => node.deleted === true ? node : { ...node, enabled: true }),
    updatedAt: Date.now()
  });
}

export function buildGeneratorGraphUiReport(graph) {
  const normalized = normalizeGeneratorGraph(graph);
  const visible = normalized.nodes.filter((node) => node.deleted !== true);
  const summary = summarizeGeneratorGraph(normalized);
  const lines = [
    `Generator Node Graph UI ${GENERATOR_GRAPH_VERSION}`,
    `Nodes: ${summary.active}/${summary.total} active`,
    `Stages: source=${summary.stages.source} modifier=${summary.stages.modifier} color=${summary.stages.color} fx=${summary.stages.fx} output=${summary.stages.output}`,
    `Flow: ${summary.label || 'empty'}`,
    ''
  ];
  for (const node of visible) {
    lines.push(`${String(node.order).padStart(2, '0')} · ${node.enabled !== false ? 'ON ' : 'OFF'} · ${node.type} · ${node.id} -> ${node.moduleId || node.id} · mix=${Math.round(node.mix * 100)}% intensity=${Math.round(node.intensity * 100)}%`);
  }
  return lines.join('\n');
}

export function summarizeGeneratorGraph(graph) {
  const normalized = normalizeGeneratorGraph(graph);
  const visible = normalized.nodes.filter((node) => node.deleted !== true);
  const active = visible.filter((node) => node.enabled !== false);
  return {
    total: visible.length,
    active: active.length,
    hidden: normalized.nodes.length - visible.length,
    stages: Object.fromEntries(GENERATOR_NODE_TYPES.map((type) => [type, active.filter((node) => node.type === type).length])),
    label: active.map((node) => node.id).join(' → ')
  };
}
