import assert from 'node:assert/strict';
import { renderGeneratorFrame, normalizeGeneratorPatch } from '../public/runtime/generator_engine.js';
import {
  GENERATOR_GRAPH_VERSION,
  listGeneratorNodeCatalog,
  createDefaultGeneratorGraph,
  normalizeGeneratorGraph,
  graphToRenderPlan,
  graphToModuleFlags,
  addGeneratorGraphNode,
  duplicateGeneratorGraphNode,
  deleteGeneratorGraphNode,
  soloGeneratorGraphNode,
  clearGeneratorGraphSolo,
  buildGeneratorGraphUiReport,
  summarizeGeneratorGraph
} from '../public/runtime/generator_graph.js';

function energy(frame) {
  return frame.reduce((sum, value) => sum + value, 0);
}

const catalog = listGeneratorNodeCatalog();
assert.ok(catalog.length >= 8, 'node catalog exposes addable templates');
assert.ok(catalog.some((item) => item.category === 'SOURCE' && item.templateId === 'plasma'), 'source node template exists');
assert.ok(catalog.some((item) => item.category === 'FX' && item.templateId === 'gate'), 'fx node template exists');

let graph = createDefaultGeneratorGraph();
const startSummary = summarizeGeneratorGraph(graph);
assert.equal(graph.version, GENERATOR_GRAPH_VERSION);
assert.ok(startSummary.total >= 9, 'default graph visible nodes exist');

graph = addGeneratorGraphNode(graph, 'plasma', { forceDuplicate: true, mix: 0.6, intensity: 0.6 });
let duplicated = graph.nodes.filter((node) => node.moduleId === 'plasma' && node.deleted !== true);
assert.ok(duplicated.length >= 2, 'add node can create a plasma instance');
const customId = duplicated.find((node) => node.id !== 'plasma').id;
let plan = graphToRenderPlan(graph);
assert.ok(plan.byId[customId], 'custom node is in render plan');
assert.ok(plan.moduleWeights.plasma > plan.byId.plasma.weight, 'custom duplicate contributes to base module weight');

const patch = normalizeGeneratorPatch({ width: 300, height: 8, energy: 0.7, density: 0.62, modules: graphToModuleFlags(graph), graph });
const frameWithDuplicate = renderGeneratorFrame({ patch, graph, time: 3.4, beat: 8.2 }).frame;
assert.ok(energy(frameWithDuplicate) > 0, 'graph with duplicate renders visible frame');

graph = duplicateGeneratorGraphNode(graph, 'gate');
assert.ok(graph.nodes.some((node) => node.id.startsWith('gate-copy') && node.moduleId === 'gate'), 'duplicate action creates custom copy');

graph = soloGeneratorGraphNode(graph, customId);
let visibleActive = graph.nodes.filter((node) => node.deleted !== true && node.enabled !== false && node.id !== 'output');
assert.deepEqual(visibleActive.map((node) => node.id), [customId], 'solo leaves only selected non-output node active');

graph = clearGeneratorGraphSolo(graph);
assert.ok(summarizeGeneratorGraph(graph).active > visibleActive.length, 'clear solo re-enables visible nodes');

graph = deleteGeneratorGraphNode(graph, customId);
assert.equal(graph.nodes.some((node) => node.id === customId), false, 'delete removes custom node');

graph = deleteGeneratorGraphNode(graph, 'plasma');
const deletedCore = normalizeGeneratorGraph(graph).nodes.find((node) => node.id === 'plasma');
assert.equal(deletedCore.deleted, true, 'delete core node persists as hidden/deleted');
assert.equal(graphToModuleFlags(graph).plasma, false, 'deleted core module flag is false when no enabled plasma node remains');

graph = addGeneratorGraphNode(graph, 'plasma');
assert.equal(normalizeGeneratorGraph(graph).nodes.find((node) => node.id === 'plasma').deleted, false, 'adding deleted core template restores core node');

const report = buildGeneratorGraphUiReport(graph);
assert.match(report, /STEP38/);
assert.match(report, /Flow:/);
assert.match(report, /plasma/);

console.log(`${GENERATOR_GRAPH_VERSION}: PASS`);
