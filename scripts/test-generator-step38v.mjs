import assert from 'node:assert/strict';
import {
  GENERATOR_BEAT_INTELLIGENCE_VERSION,
  normalizeGeneratorBeatConfig,
  readGeneratorBeatConfig,
  saveGeneratorBeatConfig,
  createGeneratorBeatRuntime,
  tapGeneratorBeat,
  markGeneratorBeatDrop,
  resetGeneratorBeatPhrase,
  applyGeneratorBeatIntelligence,
  writeGeneratorBeatSnapshot,
  formatGeneratorBeatStatus,
  buildGeneratorBeatReport
} from '../public/runtime/generator_beat_intelligence.js';
import { renderGeneratorFrame, normalizeGeneratorPatch, GENERATOR_ENGINE_VERSION } from '../public/runtime/generator_engine.js';
import { createDefaultGeneratorGraph, updateGeneratorGraphNode } from '../public/runtime/generator_graph.js';
import { normalizeMidiMessage, findGeneratorMidiAction, resetGeneratorMidiMappings } from '../public/runtime/generator_midi_apc.js';

function energy(frame) {
  return Array.from(frame || []).reduce((sum, value) => sum + value, 0);
}

function makeStorage() {
  const map = new Map();
  return {
    getItem: (key) => map.has(key) ? map.get(key) : null,
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: (key) => { map.delete(key); }
  };
}

assert.match(GENERATOR_BEAT_INTELLIGENCE_VERSION, /STEP38V/);
assert.match(GENERATOR_ENGINE_VERSION, /STEP38V/);

const config = normalizeGeneratorBeatConfig({ enabled: true, phraseBeats: 32, accentAmount: 0.7, dropHoldBeats: 12 });
assert.equal(config.phraseBeats, 32);
assert.equal(config.dropHoldBeats, 12);
assert.ok(config.accentAmount > 0.6);

const storage = makeStorage();
const saved = saveGeneratorBeatConfig(config, storage);
const loaded = readGeneratorBeatConfig(storage);
assert.equal(saved.phraseBeats, loaded.phraseBeats);
assert.equal(loaded.enabled, true);

let runtime = createGeneratorBeatRuntime();
runtime = tapGeneratorBeat(runtime, { nowWall: 1000, beat: 4, bpm: 145 });
runtime = tapGeneratorBeat(runtime, { nowWall: 1500, beat: 5, bpm: 145 });
assert.ok(runtime.suggestedBpm > 115 && runtime.suggestedBpm < 125, 'tap tempo suggests roughly 120 BPM');
runtime = resetGeneratorBeatPhrase(runtime, { beat: 16, nowWall: 1800 });
assert.equal(runtime.phraseAnchorBeat, 16);
runtime = markGeneratorBeatDrop(runtime, config, { beat: 20, nowWall: 2000 });
assert.ok(runtime.dropUntilBeat > 20);

const baseValues = { energy: 0.4, density: 0.4, speed: 0.4, colorShift: 0.4, feedback: 0.4, warp: 0.4, pulse: 0.4, shimmer: 0.4 };
const beatResult = applyGeneratorBeatIntelligence(runtime, config, baseValues, { beat: 20.01, bpm: 120, time: 8 });
assert.ok(beatResult.meta.dropActive, 'drop marker creates active drop accent');
assert.ok(beatResult.values.pulse > baseValues.pulse, 'beat intelligence raises pulse');
assert.ok(beatResult.values.shimmer > baseValues.shimmer, 'beat intelligence raises shimmer');
assert.ok(formatGeneratorBeatStatus(beatResult.meta, config).includes('DROP'));
assert.ok(buildGeneratorBeatReport(beatResult.runtime, config, beatResult.meta).includes('Generator Beat Intelligence'));
const snap = writeGeneratorBeatSnapshot(beatResult.runtime, beatResult.meta, storage);
assert.equal(snap.meta.dropActive, true);

let graph = createDefaultGeneratorGraph();
graph = updateGeneratorGraphNode(graph, 'audioPulseField', { enabled: true, mix: 1, intensity: 1 });
const noAccent = renderGeneratorFrame({
  patch: normalizeGeneratorPatch({ energy: 0.45, density: 0.45, pulse: 0.45, shimmer: 0.45, modules: { audioPulseField: true } }),
  graph,
  time: 1,
  beat: 8,
  bpm: 120,
  width: 80,
  height: 8
});
const withAccent = renderGeneratorFrame({
  patch: normalizeGeneratorPatch({ energy: 0.45, density: 0.45, pulse: 0.45, shimmer: 0.45, modules: { audioPulseField: true }, beatContext: { enabled: true, accent: 1, dropAccent: 1, phraseAccent: 1 } }),
  graph,
  time: 1,
  beat: 8,
  bpm: 120,
  width: 80,
  height: 8
});
assert.ok(energy(withAccent.frame) > energy(noAccent.frame), 'beat context visibly boosts engine output');

const midiConfig = { ...resetGeneratorMidiMappings(storage), enabled: true };
const tapMsg = normalizeMidiMessage([0x90, 60, 127]);
const dropMsg = normalizeMidiMessage([0x90, 62, 127]);
assert.equal(findGeneratorMidiAction(tapMsg, midiConfig).action, 'beat-tap');
assert.equal(findGeneratorMidiAction(dropMsg, midiConfig).action, 'beat-drop-mark');

console.log(`${GENERATOR_BEAT_INTELLIGENCE_VERSION}: PASS`);
