import assert from 'node:assert/strict';
import {
  GENERATOR_MIDI_APC_VERSION,
  listGeneratorMidiDefaultMappings,
  listGeneratorMidiActions,
  normalizeGeneratorMidiConfig,
  readGeneratorMidiConfig,
  saveGeneratorMidiConfig,
  resetGeneratorMidiMappings,
  createGeneratorMidiRuntime,
  normalizeMidiMessage,
  findGeneratorMidiAction,
  learnGeneratorMidiMapping,
  buildGeneratorMidiSnapshot,
  formatGeneratorMidiMessage,
  formatGeneratorMidiReport
} from '../public/runtime/generator_midi_apc.js';

class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null; }
  setItem(key, value) { this.map.set(key, String(value)); }
  removeItem(key) { this.map.delete(key); }
}

globalThis.localStorage = new MemoryStorage();
const storage = globalThis.localStorage;

const defaults = listGeneratorMidiDefaultMappings();
assert.ok(defaults.length >= 24, 'default APC/generic mappings exist');
assert.ok(defaults.some((mapping) => mapping.action === 'macro:0'), 'macro mapping exists');
assert.ok(defaults.some((mapping) => mapping.action === 'blackout'), 'blackout mapping exists');
assert.ok(listGeneratorMidiActions().some((action) => action.id === 'journey-start'), 'journey action exists');

let config = normalizeGeneratorMidiConfig({ enabled: true, channel: 'any' });
assert.equal(config.enabled, true);
assert.equal(config.channel, 'any');
assert.ok(config.mappings.some((mapping) => mapping.number === 16 && mapping.action === 'macro:0'));

let cc = normalizeMidiMessage([0xB0, 16, 64]);
assert.equal(cc.type, 'cc');
assert.equal(cc.channel, 1);
assert.equal(cc.number, 16);
assert.ok(cc.norm > 0.5 && cc.norm < 0.51, 'cc normalized value');
let found = findGeneratorMidiAction(cc, config);
assert.equal(found.ok, true);
assert.equal(found.action, 'macro:0');

const noteOn = normalizeMidiMessage([0x91, 39, 127]);
found = findGeneratorMidiAction(noteOn, config);
assert.equal(found.ok, true);
assert.equal(found.action, 'mode:drop');

const noteOff = normalizeMidiMessage([0x81, 39, 0]);
found = findGeneratorMidiAction(noteOff, config);
assert.equal(found.ok, false);
assert.equal(found.reason, 'note-off-ignored');

const channelSpecific = normalizeGeneratorMidiConfig({ enabled: true, channel: 2 });
found = findGeneratorMidiAction(normalizeMidiMessage([0xB0, 16, 100]), channelSpecific);
assert.equal(found.ok, false, 'wrong channel rejected when global channel set');
found = findGeneratorMidiAction(normalizeMidiMessage([0xB1, 16, 100]), channelSpecific);
assert.equal(found.ok, true, 'channel 2 accepted');

let learned = learnGeneratorMidiMapping(config, 'panic-release', normalizeMidiMessage([0xB2, 70, 127]));
assert.equal(learned.ok, true);
assert.equal(learned.mapping.action, 'panic-release');
assert.equal(learned.config.learnAction, '');
found = findGeneratorMidiAction(normalizeMidiMessage([0xB0, 70, 127]), learned.config);
assert.equal(found.ok, true, 'learned any channel mapping works');
assert.equal(found.action, 'panic-release');

config = saveGeneratorMidiConfig({ ...learned.config, enabled: true, inputId: 'apc-test' }, storage);
const readBack = readGeneratorMidiConfig(storage);
assert.equal(readBack.inputId, 'apc-test');
assert.equal(readBack.enabled, true);

const runtime = { ...createGeneratorMidiRuntime(), supported: true, access: true, connected: true, inputName: 'APC40 mkII', messageCount: 3, mappedCount: 2, ignoredCount: 1, lastMessage: cc, lastAction: 'macro:0', inputs: [{ id: 'a', name: 'APC40 mkII' }] };
const snapshot = buildGeneratorMidiSnapshot(runtime, readBack);
assert.equal(snapshot.connected, true);
assert.equal(snapshot.inputName, 'APC40 mkII');
assert.ok(snapshot.mappingSummary.length > 0);
assert.match(formatGeneratorMidiMessage(cc), /CC CH1 #16/);
assert.match(formatGeneratorMidiReport(runtime, readBack), /STEP38S/);
assert.match(formatGeneratorMidiReport(runtime, readBack), /APC40/);

const reset = resetGeneratorMidiMappings(storage);
assert.equal(reset.enabled, false);
assert.ok(reset.mappings.length >= 24);

console.log(`${GENERATOR_MIDI_APC_VERSION}: PASS`);
