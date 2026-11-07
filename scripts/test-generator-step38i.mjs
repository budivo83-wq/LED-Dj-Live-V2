import assert from 'node:assert/strict';
import {
  applyGeneratorSafeScene,
  listGeneratorSafeScenes,
  createBlackoutGeneratorFrame,
  createGeneratorLiveMetricsRuntime,
  updateGeneratorLiveMetrics,
  summarizeGeneratorLiveMetrics,
  storeGeneratorLiveFps,
  getStoredGeneratorLiveFps,
  GENERATOR_LIVE_OPS_VERSION
} from '../public/runtime/generator_live_ops.js';
import { renderGeneratorFrame } from '../public/runtime/generator_engine.js';
import { graphToModuleFlags } from '../public/runtime/generator_graph.js';

function sum(frame) {
  return frame.reduce((acc, v) => acc + v, 0);
}

const scenes = listGeneratorSafeScenes();
assert.equal(GENERATOR_LIVE_OPS_VERSION, 'STEP38M_GENERATOR_USES_SETTINGS_OUTPUT_FPS');
assert.ok(scenes.length >= 6, 'safe scene bank should expose multiple scenes');
assert.ok(scenes.some((scene) => scene.id === 'safe-blackout'), 'blackout scene missing');

const calm = applyGeneratorSafeScene('safe-calm', {});
assert.equal(calm.sceneId, 'safe-calm');
assert.equal(calm.patch.name, 'Safe Calm Plasma');
assert.equal(graphToModuleFlags(calm.graph).gate, false, 'calm scene should not enable gate');
const calmFrame = renderGeneratorFrame({ patch: calm.patch, graph: calm.graph, time: 1.5, beat: 4 });
assert.equal(calmFrame.frame.byteLength, 300 * 8 * 3);
assert.ok(sum(calmFrame.frame) > 0, 'calm scene should render non-black frame');

const drop = applyGeneratorSafeScene('safe-drop', calm);
assert.equal(drop.sceneId, 'safe-drop');
assert.equal(graphToModuleFlags(drop.graph).gate, true, 'drop scene should enable gate');
assert.ok(drop.patch.energy > calm.patch.energy, 'drop should be higher energy than calm');

const diagnostic = applyGeneratorSafeScene('safe-diagnostic', drop);
assert.equal(graphToModuleFlags(diagnostic.graph).grid, true, 'diagnostic should enable grid');
assert.equal(graphToModuleFlags(diagnostic.graph).tunnel, false, 'diagnostic should disable tunnel');

const blackout = createBlackoutGeneratorFrame(300, 8, { test: true });
assert.equal(blackout.frame.byteLength, 300 * 8 * 3);
assert.equal(sum(blackout.frame), 0, 'blackout frame must be fully black');
assert.equal(blackout.meta.blackout, true);

const blackScene = applyGeneratorSafeScene('safe-blackout', drop);
assert.equal(blackScene.patch.energy, 0);
const blackSceneFrame = renderGeneratorFrame({ patch: blackScene.patch, graph: blackScene.graph, time: 2, beat: 0 });
assert.equal(sum(blackSceneFrame.frame), 0, 'blackout scene render should be fully black');

let metrics = createGeneratorLiveMetricsRuntime();
metrics = updateGeneratorLiveMetrics(metrics, { renderMs: 3.4, publishMs: 0.8, bridge: { lastServerMs: 5.2, droppedByFps: 2, serverErrors: 0 } });
metrics = updateGeneratorLiveMetrics(metrics, { renderMs: 4.0, publishMs: 1.2, bridge: { lastServerMs: 5.8, droppedByFps: 3, serverErrors: 0 } });
const summary = summarizeGeneratorLiveMetrics(metrics);
assert.equal(summary.status, 'GOOD');
assert.match(summary.render, /\d+\.\d \/ \d+\.\d/);
assert.equal(summary.drops, '3');

metrics = updateGeneratorLiveMetrics(metrics, { renderMs: 30, publishMs: 12, bridge: { lastServerMs: 50, droppedByFps: 3, serverErrors: 1 } });
assert.equal(summarizeGeneratorLiveMetrics(metrics).status, 'HOT');

const memoryStorage = new Map();
const storage = {
  getItem: (key) => memoryStorage.get(key) || '',
  setItem: (key, value) => memoryStorage.set(key, String(value))
};
assert.equal(storeGeneratorLiveFps(144, storage), 60);
assert.equal(getStoredGeneratorLiveFps(storage), 60);
assert.equal(storeGeneratorLiveFps(30, storage), 30);
assert.equal(getStoredGeneratorLiveFps(storage), 30);

console.log('PASS generator STEP38I live operator polish');
