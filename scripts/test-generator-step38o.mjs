import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  GENERATOR_TRANSITION_VERSION,
  readGeneratorTransitionConfig,
  saveGeneratorTransitionConfig,
  createGeneratorTransitionRuntime,
  captureServerMasterFrame,
  armGeneratorTakeoverTransition,
  armGeneratorReleaseTransition,
  applyGeneratorTransitionFrame,
  formatGeneratorTransitionStatus,
  buildGeneratorTransitionReport
} from '../public/runtime/generator_transition.js';

assert.equal(GENERATOR_TRANSITION_VERSION, 'STEP38O_GENERATOR_PERFORMANCE_CROSSFADE');

const storageMap = new Map();
const storage = {
  getItem: (key) => storageMap.get(key) || null,
  setItem: (key, value) => storageMap.set(key, String(value))
};
let cfg = readGeneratorTransitionConfig(storage);
assert.equal(cfg.takeoverMs, 900);
cfg = saveGeneratorTransitionConfig({ takeoverMs: 500, releaseMs: 1200, curve: 'ease' }, storage);
assert.equal(cfg.takeoverMs, 500);
assert.equal(cfg.releaseMs, 1200);
assert.equal(cfg.curve, 'ease');
assert.equal(readGeneratorTransitionConfig(storage).takeoverMs, 500);

const sourceFrame = new Uint8Array(300 * 8 * 3).fill(10);
const fakeFetch = async () => ({
  ok: true,
  status: 200,
  headers: { get: (name) => ({ 'X-LED-Source': 'performance-framebus-artnet-master', 'X-LED-Frame-Id': '42', 'X-LED-Age-Ms': '12', 'X-LED-Published-At': '1800000000000' }[name] || '') },
  arrayBuffer: async () => sourceFrame.buffer.slice(0)
});

const captured = await captureServerMasterFrame({ fetchImpl: fakeFetch, width: 300, height: 8 });
assert.equal(captured.ok, true);
assert.equal(captured.source, 'performance-framebus-artnet-master');
assert.equal(captured.frame.byteLength, 7200);

let runtime = createGeneratorTransitionRuntime({ width: 300, height: 8, curve: 'linear' });
runtime = await armGeneratorTakeoverTransition(runtime, { durationMs: 1000, curve: 'linear', fetchImpl: fakeFetch, width: 300, height: 8, storage });
assert.equal(runtime.phase, 'takeover');
assert.equal(runtime.active, true);
assert.equal(runtime.sourceFrameId, 42);

const genFrame = new Uint8Array(300 * 8 * 3).fill(110);
const rendered = { frame: genFrame, width: 300, height: 8, meta: { renderMs: 1, beat: 1 } };
let applied = applyGeneratorTransitionFrame(rendered, { ...runtime, startAt: 0, durationMs: 1000, curve: 'linear' }, 500, { storage });
assert.equal(applied.rendered.frame[0], 60, 'takeover should mix captured Performance frame with Generator frame at 50%');
assert.equal(Math.round(applied.mix * 100), 50);

applied = applyGeneratorTransitionFrame(rendered, { ...runtime, startAt: 0, durationMs: 1000, curve: 'linear' }, 1000, { storage });
assert.equal(applied.done, true);
assert.equal(applied.rendered.frame[0], 110);

runtime = armGeneratorReleaseTransition(runtime, { durationMs: 1000, curve: 'linear', width: 300, height: 8, storage });
assert.equal(runtime.phase, 'release');
applied = applyGeneratorTransitionFrame(rendered, { ...runtime, startAt: 0, durationMs: 1000, curve: 'linear' }, 500, { storage });
assert.equal(applied.rendered.frame[0], 55, 'release should fade Generator toward blackout before unlocking');
applied = applyGeneratorTransitionFrame(rendered, { ...runtime, startAt: 0, durationMs: 1000, curve: 'linear' }, 1000, { storage });
assert.equal(applied.rendered.frame[0], 0);

assert.ok(formatGeneratorTransitionStatus(runtime, cfg).includes('RELEASE'));
assert.ok(buildGeneratorTransitionReport(runtime, cfg).includes('Generator Transition STEP38O'));

const generatorJs = readFileSync(join(process.cwd(), 'public/generator.js'), 'utf8');
const generatorHtml = readFileSync(join(process.cwd(), 'public/generator.html'), 'utf8');
assert.ok(generatorJs.includes('armGeneratorTakeoverTransition'), 'generator page must arm transition before LIVE takeover');
assert.ok(generatorJs.includes('applyGeneratorTransitionFrame'), 'generator page must apply transition frames in the render loop');
assert.ok(generatorJs.includes('pendingReleaseMode'), 'generator page must keep generator live until release fade publishes final frame');
assert.ok(generatorHtml.includes('generatorTransitionTakeover'), 'Generator UI must expose takeover fade control');
assert.ok(generatorHtml.includes('generatorTransitionRelease'), 'Generator UI must expose release fade control');
assert.ok(generatorHtml.includes('generatorTransitionStatus'), 'Generator UI must expose transition status');

console.log('PASS generator STEP38O transition guard');
