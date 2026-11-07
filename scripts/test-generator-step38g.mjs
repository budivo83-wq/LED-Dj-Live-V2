import assert from 'node:assert/strict';
import { renderGeneratorFrame } from '../public/runtime/generator_engine.js';
import { createDefaultGeneratorGraph, graphToModuleFlags } from '../public/runtime/generator_graph.js';
import { createDefaultGeneratorCurves } from '../public/runtime/generator_curves.js';
import { saveGeneratorState, loadGeneratorState, GENERATOR_STATE_KEY } from '../public/runtime/generator_bridge.js';
import {
  normalizeShowOsBridgePayload,
  mapShowOsBridgeToGeneratorState,
  applyShowOsBridgeToGeneratorStorage,
  setGeneratorShowOsAutoFollowEnabled,
  isGeneratorShowOsAutoFollowEnabled,
  SHOWOS_PERFORMANCE_BRIDGE_KEY,
  GENERATOR_SHOWOS_BRIDGE_VERSION
} from '../public/runtime/generator_showos_bridge.js';

function makeMemoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => map.has(key) ? map.get(key) : null,
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
    _map: map
  };
}

const raw = {
  targetWorld: 'Alien Temple',
  targetUniverse: 'Synthetic Universe',
  targetWeather: 'Electrical',
  storyPhase: 'DROP',
  energy: 90,
  chaos: 72,
  density: 78,
  motion: 86,
  authority: { mode: 'ASSIST', operatorLock: false, limits: { energy: 88, chaos: 58, density: 76, motion: 88 } },
  t: 12345
};

const payload = normalizeShowOsBridgePayload(raw);
assert.equal(payload.version, GENERATOR_SHOWOS_BRIDGE_VERSION);
assert.equal(payload.energy, 88, 'authority energy limit should clamp bridge value');
assert.equal(payload.chaos, 58, 'authority chaos limit should clamp bridge value');
assert.equal(payload.targetWorld, 'Alien Temple');

const graph = createDefaultGeneratorGraph();
const curves = createDefaultGeneratorCurves();
const mapped = mapShowOsBridgeToGeneratorState(payload, { graph, curves }, { influence: 1 });
assert.equal(mapped.version, GENERATOR_SHOWOS_BRIDGE_VERSION);
assert.ok(mapped.patch.energy > 0.75, 'DROP/Electrical should raise energy');
assert.ok(mapped.patch.warp > 0.35, 'Alien/Synthetic bridge should raise warp');
assert.ok(mapped.patch.shimmer > 0.35, 'Electrical bridge should raise shimmer');
assert.ok(mapped.graph.nodes.find((node) => node.id === 'gate').enabled, 'DROP/Electrical should enable gate node');
assert.equal(mapped.curves.lanes.find((lane) => lane.id === 'pulse').mode, 'beat', 'DROP should set pulse to beat mode');
assert.ok(mapped.summary.graphLabel.includes('gate'));

const rendered = renderGeneratorFrame({ patch: mapped.patch, graph: mapped.graph, time: 2.5, bpm: mapped.patch.bpm, beat: 8 });
assert.equal(rendered.frame.byteLength, 300 * 8 * 3);
assert.ok(rendered.frame.some((value) => value > 0), 'mapped Show OS bridge must render visible generator frame');

const storage = makeMemoryStorage();
saveGeneratorState({ patch: mapped.patch, graph: mapped.graph, curves: mapped.curves, mode: 'preview' }, storage);
storage.setItem(SHOWOS_PERFORMANCE_BRIDGE_KEY, JSON.stringify({ ...raw, targetWorld: 'Forest Sanctuary', targetUniverse: 'Organic Universe', targetWeather: 'Mist', storyPhase: 'RECOVERY', energy: 28, chaos: 18, density: 24, motion: 22 }));
const applied = applyShowOsBridgeToGeneratorStorage(storage, { influence: 1 });
assert.equal(applied.ok, true);
const stored = loadGeneratorState(storage);
assert.equal(stored.mode, 'preview');
assert.ok(stored.patch.name.includes('Forest Sanctuary'));
assert.ok(stored.patch.energy < mapped.patch.energy, 'Recovery/Mist should lower energy compared to Drop/Electrical');
assert.ok(storage.getItem(GENERATOR_STATE_KEY), 'generator state should be persisted after bridge apply');

assert.equal(isGeneratorShowOsAutoFollowEnabled(storage), false);
setGeneratorShowOsAutoFollowEnabled(true, storage);
assert.equal(isGeneratorShowOsAutoFollowEnabled(storage), true);

console.log('Generator STEP38G guard passed (Show OS payload mapping, graph/curve bridge, storage apply, auto-follow flag).');
