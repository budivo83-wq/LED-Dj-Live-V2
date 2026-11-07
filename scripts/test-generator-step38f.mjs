import assert from 'node:assert/strict';
import { renderGeneratorFrame, normalizeGeneratorPatch } from '../public/runtime/generator_engine.js';
import {
  createDefaultGeneratorGraph,
  normalizeGeneratorGraph,
  graphToRenderPlan,
  graphToModuleFlags,
  updateGeneratorGraphNode,
  reorderGeneratorGraphNode,
  summarizeGeneratorGraph,
  GENERATOR_GRAPH_VERSION,
  GENERATOR_NODE_TYPES
} from '../public/runtime/generator_graph.js';
import { createDefaultGeneratorCurves } from '../public/runtime/generator_curves.js';
import {
  loadGeneratorPresetBank,
  saveGeneratorPresetSnapshot,
  findGeneratorPreset,
  GENERATOR_PRESETS_VERSION
} from '../public/runtime/generator_presets.js';

function makeMemoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => map.has(key) ? map.get(key) : null,
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key)
  };
}

function frameEnergy(frame) {
  return frame.reduce((sum, value) => sum + value, 0);
}

assert.deepEqual(GENERATOR_NODE_TYPES, ['source', 'modifier', 'color', 'fx', 'output']);
let graph = createDefaultGeneratorGraph();
assert.equal(graph.version, GENERATOR_GRAPH_VERSION);
assert.ok(graph.nodes.length >= 9, 'node graph should include source/modifier/color/fx/output nodes');
assert.ok(graph.nodes.some((node) => node.type === 'source'));
assert.ok(graph.nodes.some((node) => node.type === 'modifier'));
assert.ok(graph.nodes.some((node) => node.type === 'color'));
assert.ok(graph.nodes.some((node) => node.type === 'fx'));
assert.ok(graph.nodes.some((node) => node.type === 'output'));

const summary = summarizeGeneratorGraph(graph);
assert.ok(summary.active > 0);
assert.ok(summary.stages.source >= 1);
assert.ok(summary.label.includes('plasma'));

const plan = graphToRenderPlan(graph);
assert.equal(plan.version, GENERATOR_GRAPH_VERSION);
assert.ok(plan.byId.plasma.weight > 0);
assert.ok(plan.byId.output.weight > 0);

const patch = normalizeGeneratorPatch({ width: 300, height: 8, energy: 0.72, density: 0.62, shimmer: 0.4, modules: graphToModuleFlags(graph), graph });
const rendered = renderGeneratorFrame({ patch, graph, time: 11.1, bpm: 145, beat: 22.2 });
assert.equal(rendered.frame.byteLength, 300 * 8 * 3);
assert.equal(rendered.meta.graphVersion, GENERATOR_GRAPH_VERSION);
assert.ok(frameEnergy(rendered.frame) > 0, 'default graph should render visible frame');

const dimGraph = updateGeneratorGraphNode(graph, 'output', { mix: 0.1, intensity: 0.1 });
const dimRendered = renderGeneratorFrame({ patch: normalizeGeneratorPatch({ ...patch, modules: graphToModuleFlags(dimGraph), graph: dimGraph }), graph: dimGraph, time: 11.1, bpm: 145, beat: 22.2 });
assert.ok(frameEnergy(dimRendered.frame) < frameEnergy(rendered.frame), 'output node mix/intensity should lower brightness');

const sourceMuted = ['plasma', 'tunnel', 'grid', 'particles'].reduce((g, id) => updateGeneratorGraphNode(g, id, { enabled: false }), graph);
const mutedRendered = renderGeneratorFrame({ patch: normalizeGeneratorPatch({ ...patch, modules: graphToModuleFlags(sourceMuted), graph: sourceMuted }), graph: sourceMuted, time: 11.1, bpm: 145, beat: 22.2 });
assert.ok(frameEnergy(mutedRendered.frame) < frameEnergy(rendered.frame) * 0.25, 'muting major nodes should strongly reduce frame energy');

const reordered = reorderGeneratorGraphNode(graph, 'output', -1);
assert.notDeepEqual(reordered.nodes.map((node) => node.id), graph.nodes.map((node) => node.id), 'node order should change');
assert.equal(normalizeGeneratorGraph({ nodes: [{ id: 'bad', type: 'nonsense', mix: 99, intensity: -1 }] }).nodes.some((node) => node.id === 'bad'), true);

const storage = makeMemoryStorage();
let bank = loadGeneratorPresetBank(storage);
assert.equal(bank.version, GENERATOR_PRESETS_VERSION);
assert.ok(bank.factory.every((preset) => preset.graph?.version === GENERATOR_GRAPH_VERSION));
const curves = createDefaultGeneratorCurves();
const saved = saveGeneratorPresetSnapshot(bank, { name: 'QA Node Graph Preset', patch, graph: dimGraph, curves }, storage);
bank = saved.bank;
const found = findGeneratorPreset(bank, saved.preset.id);
assert.ok(found);
assert.equal(found.graph.version, GENERATOR_GRAPH_VERSION);
assert.ok(found.graph.nodes.find((node) => node.id === 'output').mix <= 0.11);

console.log('Generator STEP38F guard passed (node graph, render plan, graph-driven brightness, preset persistence).');
