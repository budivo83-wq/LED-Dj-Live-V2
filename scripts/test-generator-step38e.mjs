import assert from 'node:assert/strict';
import { renderGeneratorFrame, normalizeGeneratorPatch } from '../public/runtime/generator_engine.js';
import {
  createDefaultGeneratorCurves,
  evaluateGeneratorCurves,
  createGeneratorCurveRuntime,
  smoothGeneratorCurveValues,
  GENERATOR_MACRO_DEFAULTS,
  patchValuesToMacros
} from '../public/runtime/generator_curves.js';
import {
  loadGeneratorPresetBank,
  saveGeneratorPresetSnapshot,
  findGeneratorPreset,
  deleteGeneratorPreset,
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

const patch = normalizeGeneratorPatch({ width: 300, height: 8, warp: 0.7, pulse: 0.8, shimmer: 0.6 });
assert.equal(patch.width, 300);
assert.equal(patch.height, 8);
assert.equal(patch.macros.length, 8);
assert.equal(GENERATOR_MACRO_DEFAULTS.length, 8);
assert.equal(patchValuesToMacros(patch).length, 8);

const rendered = renderGeneratorFrame({ patch, time: 12.34, bpm: 145, beat: 29.8 });
assert.equal(rendered.frame.byteLength, 300 * 8 * 3);
assert.equal(rendered.width, 300);
assert.equal(rendered.height, 8);
assert.ok(rendered.frame.some((value) => value > 0), 'generator frame should contain visible pixels');

const curves = createDefaultGeneratorCurves();
assert.equal(curves.lanes.length, 8);
assert.ok(curves.lanes.some((lane) => lane.mode === 'beat'));
assert.ok(curves.lanes.some((lane) => lane.mode === 'random'));
const targets = evaluateGeneratorCurves(curves, 10, { bpm: 145, beat: 24 });
assert.equal(Object.keys(targets).length, 8);
const runtime = createGeneratorCurveRuntime();
const smooth = smoothGeneratorCurveValues(curves, targets, runtime, 10);
assert.equal(Object.keys(smooth).length, 8);
for (const value of Object.values(smooth)) assert.ok(value >= 0 && value <= 1);

const storage = makeMemoryStorage();
let bank = loadGeneratorPresetBank(storage);
assert.equal(bank.version, GENERATOR_PRESETS_VERSION);
assert.ok(bank.factory.length >= 3);
const saved = saveGeneratorPresetSnapshot(bank, { name: 'QA Custom Generator', patch, graph: null, curves }, storage);
bank = saved.bank;
assert.ok(findGeneratorPreset(bank, saved.preset.id));
bank = deleteGeneratorPreset(bank, saved.preset.id, storage);
assert.equal(bank.custom.some((preset) => preset.id === saved.preset.id), false);
assert.ok(findGeneratorPreset(bank, 'factory-psy-tunnel-starter'));

console.log('Generator STEP38E guard passed (macros, curves, smoothing, presets, frame render).');
