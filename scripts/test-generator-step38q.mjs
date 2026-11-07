import assert from 'node:assert/strict';
import { renderGeneratorFrame } from '../public/runtime/generator_engine.js';
import { createDefaultGeneratorGraph } from '../public/runtime/generator_graph.js';
import { createDefaultGeneratorCurves } from '../public/runtime/generator_curves.js';
import { loadGeneratorPresetBank } from '../public/runtime/generator_presets.js';
import {
  GENERATOR_SCENE_MORPH_VERSION,
  createGeneratorSceneMorphRuntime,
  normalizeGeneratorSceneMorphConfig,
  listGeneratorSceneMorphTargets,
  resolveGeneratorSceneMorphTarget,
  armGeneratorSceneMorph,
  applyGeneratorSceneMorph,
  cancelGeneratorSceneMorph,
  buildGeneratorSceneMorphStatus,
  buildGeneratorSceneMorphReport
} from '../public/runtime/generator_scene_morph.js';

class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null; }
  setItem(key, value) { this.map.set(key, String(value)); }
  removeItem(key) { this.map.delete(key); }
}

const storage = new MemoryStorage();
const presetBank = loadGeneratorPresetBank(storage);
const targets = listGeneratorSceneMorphTargets(presetBank, true);
assert.ok(targets.some((item) => item.id === 'music:drop'), 'music drop target is listed');
assert.ok(targets.some((item) => item.id === 'preset:factory-psy-tunnel-starter'), 'factory preset target is listed');

const source = {
  patch: { name: 'Source Calm', width: 300, height: 8, bpm: 145, energy: 0.2, density: 0.25, speed: 0.2, colorShift: 0.2, feedback: 0.1, warp: 0.1, pulse: 0.1, shimmer: 0.1 },
  graph: createDefaultGeneratorGraph(),
  curves: createDefaultGeneratorCurves()
};

const config = normalizeGeneratorSceneMorphConfig({ targetId: 'music:drop', durationBeats: 8, curve: 'smooth', commitOnDone: true });
assert.equal(config.targetId, 'music:drop');
assert.equal(config.durationBeats, 8);

const target = resolveGeneratorSceneMorphTarget('music:drop', { current: source, presetBank });
assert.equal(target?.name, 'Drop');
assert.ok(target.state.patch.energy > source.patch.energy, 'drop target has higher energy');

let runtime = createGeneratorSceneMorphRuntime();
const armed = armGeneratorSceneMorph(runtime, { current: source, presetBank, now: 0, beat: 0, storage }, config);
assert.equal(armed.ok, true);
runtime = armed.runtime;
assert.equal(runtime.active, true);
assert.match(buildGeneratorSceneMorphStatus(runtime, config), /MORPH|ARMED/);

let mid = applyGeneratorSceneMorph(runtime, source, { time: 0, beat: 4, now: 4000, storage, writeSnapshot: false });
runtime = mid.runtime;
assert.equal(mid.active, true);
assert.ok(mid.state.patch.energy > source.patch.energy, 'mid morph raises energy');
assert.ok(mid.state.patch.energy < target.state.patch.energy + 0.01, 'mid morph stays below target energy');
const midFrame = renderGeneratorFrame({ patch: mid.state.patch, graph: mid.state.graph, time: 1.2, bpm: mid.state.patch.bpm, beat: 4 });
assert.equal(midFrame.width, 300);
assert.equal(midFrame.height, 8);
assert.equal(midFrame.frame.length, 300 * 8 * 3);

const done = applyGeneratorSceneMorph(runtime, mid.state, { time: 0, beat: 9, now: 9000, storage, writeSnapshot: true });
assert.equal(done.done, true);
assert.equal(done.runtime.done, true);
assert.equal(done.runtime.committed, true);
assert.equal(done.state.patch.musicMode, 'drop');
assert.ok(done.state.patch.energy >= target.state.patch.energy - 0.02, 'done morph reaches target energy');

const report = buildGeneratorSceneMorphReport(done.runtime, config);
assert.match(report, /STEP38Q/);
assert.match(report, /Drop|music:drop/);

const cancelled = cancelGeneratorSceneMorph(done.runtime, storage);
assert.equal(cancelled.active, false);
assert.equal(cancelled.error, 'cancelled');

console.log(`${GENERATOR_SCENE_MORPH_VERSION}: PASS`);
