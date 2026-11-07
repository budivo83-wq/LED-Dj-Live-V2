import assert from 'node:assert/strict';
import { renderGeneratorFrame, normalizeGeneratorPatch, GENERATOR_ENGINE_VERSION } from '../public/runtime/generator_engine.js';
import {
  GENERATOR_GRAPH_VERSION,
  listGeneratorNodeCatalog,
  createDefaultGeneratorGraph,
  normalizeGeneratorGraph,
  graphToRenderPlan,
  graphToModuleFlags,
  updateGeneratorGraphNode,
  addGeneratorGraphNode,
  buildGeneratorGraphUiReport
} from '../public/runtime/generator_graph.js';
import { createFactoryGeneratorPresets } from '../public/runtime/generator_presets.js';

function energy(frame) {
  return frame.reduce((sum, value) => sum + value, 0);
}

const expectedModules = [
  'liquidGlass',
  'electricVeins',
  'fractalSnake',
  'solarWind',
  'digitalRain',
  'magneticParticles',
  'neonOrganism',
  'audioPulseField'
];

const catalog = listGeneratorNodeCatalog();
for (const id of expectedModules) {
  assert.ok(catalog.some((item) => item.templateId === id && item.moduleId === id), `${id} is addable from node catalog`);
}
assert.ok(catalog.filter((item) => item.category === 'SOURCE').length >= 5, 'new source modules are exposed');
assert.ok(catalog.filter((item) => item.category === 'FX').length >= 5, 'new fx modules are exposed');

let graph = createDefaultGeneratorGraph();
const normalized = normalizeGeneratorGraph(graph);
for (const id of expectedModules) {
  const node = normalized.nodes.find((item) => item.id === id);
  assert.ok(node, `${id} default node exists for safe restore`);
  assert.equal(node.enabled, false, `${id} is disabled by default so old patches stay stable`);
}

const basePatch = normalizeGeneratorPatch({ width: 300, height: 8, graph, modules: graphToModuleFlags(graph) });
const baseFrame = renderGeneratorFrame({ patch: basePatch, graph, time: 9.4, beat: 21.2 }).frame;
assert.ok(energy(baseFrame) > 0, 'base generator still renders visible output');

for (const id of expectedModules) {
  const activeGraph = updateGeneratorGraphNode(graph, id, { enabled: true, mix: 1, intensity: 1 });
  const plan = graphToRenderPlan(activeGraph);
  assert.ok(plan.moduleWeights[id] > 0.7, `${id} contributes to render plan`);
  const patch = normalizeGeneratorPatch({ width: 300, height: 8, energy: 0.78, density: 0.72, speed: 0.58, shimmer: 0.62, graph: activeGraph, modules: graphToModuleFlags(activeGraph) });
  const frame = renderGeneratorFrame({ patch, graph: activeGraph, time: 10.7, beat: 32.5 }).frame;
  assert.equal(frame.length, 300 * 8 * 3, `${id} renders 300x8 RGB frame`);
  assert.ok(energy(frame) > 0, `${id} produces visible output`);
}

let added = addGeneratorGraphNode(graph, 'liquidGlass', { forceDuplicate: true, mix: 0.8, intensity: 0.8 });
assert.ok(added.nodes.some((node) => node.moduleId === 'liquidGlass' && node.id !== 'liquidGlass'), 'new shader modules can be duplicated as custom nodes');
assert.match(buildGeneratorGraphUiReport(added), /Liquid Glass|liquidGlass/);
assert.match(GENERATOR_GRAPH_VERSION, /STEP38U/);
assert.match(GENERATOR_ENGINE_VERSION, /STEP38[UV]/);

const factory = createFactoryGeneratorPresets();
assert.ok(factory.some((preset) => preset.id === 'factory-liquid-glass-organism'), 'Liquid Glass factory preset exists');
assert.ok(factory.some((preset) => preset.id === 'factory-electric-veins-drop'), 'Electric Veins factory preset exists');
assert.ok(factory.some((preset) => preset.id === 'factory-solar-magnetic-snake'), 'Solar/Magnetic/Snake factory preset exists');

console.log(`${GENERATOR_GRAPH_VERSION}: PASS`);
