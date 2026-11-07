export const GENERATOR_MIDI_APC_VERSION = 'STEP38S_GENERATOR_MIDI_APC_CONTROL';
export const GENERATOR_MIDI_CONFIG_KEY = 'budilight.generator.midi.config.v1';
export const GENERATOR_MIDI_SNAPSHOT_KEY = 'budilight.generator.midi.snapshot.v1';

function safeJsonParse(text, fallback = null) {
  try { return JSON.parse(text || ''); } catch { return fallback; }
}

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value, min, max, fallback = min) {
  const n = safeNumber(value, fallback);
  return Math.max(min, Math.min(max, n));
}

function clone(value, fallback = {}) {
  try { return JSON.parse(JSON.stringify(value)); } catch { return fallback; }
}

const DEFAULT_MAPPINGS = Object.freeze([
  // APC40 / APC style device knobs. These are intentionally duplicated with common fader CCs.
  Object.freeze({ id: 'cc16-macro1', type: 'cc', channel: 'any', number: 16, action: 'macro:0', label: 'M1 Energy' }),
  Object.freeze({ id: 'cc17-macro2', type: 'cc', channel: 'any', number: 17, action: 'macro:1', label: 'M2 Density' }),
  Object.freeze({ id: 'cc18-macro3', type: 'cc', channel: 'any', number: 18, action: 'macro:2', label: 'M3 Speed' }),
  Object.freeze({ id: 'cc19-macro4', type: 'cc', channel: 'any', number: 19, action: 'macro:3', label: 'M4 Color' }),
  Object.freeze({ id: 'cc20-macro5', type: 'cc', channel: 'any', number: 20, action: 'macro:4', label: 'M5 Feedback' }),
  Object.freeze({ id: 'cc21-macro6', type: 'cc', channel: 'any', number: 21, action: 'macro:5', label: 'M6 Warp' }),
  Object.freeze({ id: 'cc22-macro7', type: 'cc', channel: 'any', number: 22, action: 'macro:6', label: 'M7 Pulse' }),
  Object.freeze({ id: 'cc23-macro8', type: 'cc', channel: 'any', number: 23, action: 'macro:7', label: 'M8 Shimmer' }),
  Object.freeze({ id: 'cc48-macro1', type: 'cc', channel: 'any', number: 48, action: 'macro:0', label: 'M1 Energy alt fader' }),
  Object.freeze({ id: 'cc49-macro2', type: 'cc', channel: 'any', number: 49, action: 'macro:1', label: 'M2 Density alt fader' }),
  Object.freeze({ id: 'cc50-macro3', type: 'cc', channel: 'any', number: 50, action: 'macro:2', label: 'M3 Speed alt fader' }),
  Object.freeze({ id: 'cc51-macro4', type: 'cc', channel: 'any', number: 51, action: 'macro:3', label: 'M4 Color alt fader' }),
  Object.freeze({ id: 'cc52-macro5', type: 'cc', channel: 'any', number: 52, action: 'macro:4', label: 'M5 Feedback alt fader' }),
  Object.freeze({ id: 'cc53-macro6', type: 'cc', channel: 'any', number: 53, action: 'macro:5', label: 'M6 Warp alt fader' }),
  Object.freeze({ id: 'cc54-macro7', type: 'cc', channel: 'any', number: 54, action: 'macro:6', label: 'M7 Pulse alt fader' }),
  Object.freeze({ id: 'cc55-macro8', type: 'cc', channel: 'any', number: 55, action: 'macro:7', label: 'M8 Shimmer alt fader' }),
  Object.freeze({ id: 'n36-ambient', type: 'note', channel: 'any', number: 36, action: 'mode:ambient', label: 'Ambient mode' }),
  Object.freeze({ id: 'n37-build', type: 'note', channel: 'any', number: 37, action: 'mode:build', label: 'Build mode' }),
  Object.freeze({ id: 'n38-groove', type: 'note', channel: 'any', number: 38, action: 'mode:groove', label: 'Groove mode' }),
  Object.freeze({ id: 'n39-drop', type: 'note', channel: 'any', number: 39, action: 'mode:drop', label: 'Drop mode' }),
  Object.freeze({ id: 'n40-break', type: 'note', channel: 'any', number: 40, action: 'mode:break', label: 'Break mode' }),
  Object.freeze({ id: 'n41-chaos', type: 'note', channel: 'any', number: 41, action: 'mode:psy-chaos', label: 'Psy Chaos mode' }),
  Object.freeze({ id: 'n42-after', type: 'note', channel: 'any', number: 42, action: 'mode:afterhours', label: 'Afterhours mode' }),
  Object.freeze({ id: 'n48-build-now', type: 'note', channel: 'any', number: 48, action: 'build-now', label: 'Build now' }),
  Object.freeze({ id: 'n49-drop-now', type: 'note', channel: 'any', number: 49, action: 'drop-now', label: 'Drop now' }),
  Object.freeze({ id: 'n50-morph-build', type: 'note', channel: 'any', number: 50, action: 'morph:music:build', label: 'Morph to Build' }),
  Object.freeze({ id: 'n51-morph-drop', type: 'note', channel: 'any', number: 51, action: 'morph:music:drop', label: 'Morph to Drop' }),
  Object.freeze({ id: 'n52-blackout', type: 'note', channel: 'any', number: 52, action: 'blackout', label: 'Blackout frame' }),
  Object.freeze({ id: 'n53-panic', type: 'note', channel: 'any', number: 53, action: 'panic-release', label: 'Panic release' }),
  Object.freeze({ id: 'n54-live', type: 'note', channel: 'any', number: 54, action: 'live-toggle', label: 'LIVE toggle' }),
  Object.freeze({ id: 'n55-preview', type: 'note', channel: 'any', number: 55, action: 'preview-toggle', label: 'PREVIEW toggle' }),
  Object.freeze({ id: 'n56-journey-start', type: 'note', channel: 'any', number: 56, action: 'journey-start', label: 'Journey start' }),
  Object.freeze({ id: 'n57-journey-stop', type: 'note', channel: 'any', number: 57, action: 'journey-stop', label: 'Journey stop' }),
  Object.freeze({ id: 'n58-small-mutation', type: 'note', channel: 'any', number: 58, action: 'small-mutation', label: 'Small mutation' }),
  Object.freeze({ id: 'n59-scene-calm', type: 'note', channel: 'any', number: 59, action: 'safe-scene:safe-calm-plasma', label: 'Safe Calm scene' }),
  Object.freeze({ id: 'n60-beat-tap', type: 'note', channel: 'any', number: 60, action: 'beat-tap', label: 'Beat tap' }),
  Object.freeze({ id: 'n61-phrase-reset', type: 'note', channel: 'any', number: 61, action: 'beat-phrase-reset', label: 'Beat phrase reset' }),
  Object.freeze({ id: 'n62-drop-mark', type: 'note', channel: 'any', number: 62, action: 'beat-drop-mark', label: 'Beat drop mark' })
]);

const ACTION_LABELS = Object.freeze({
  'macro:0': 'Macro 1 · Energy',
  'macro:1': 'Macro 2 · Density',
  'macro:2': 'Macro 3 · Speed',
  'macro:3': 'Macro 4 · Color',
  'macro:4': 'Macro 5 · Feedback',
  'macro:5': 'Macro 6 · Warp',
  'macro:6': 'Macro 7 · Pulse',
  'macro:7': 'Macro 8 · Shimmer',
  'mode:ambient': 'Mode · Ambient',
  'mode:build': 'Mode · Build',
  'mode:groove': 'Mode · Groove',
  'mode:drop': 'Mode · Drop',
  'mode:break': 'Mode · Break',
  'mode:psy-chaos': 'Mode · Psy Chaos',
  'mode:afterhours': 'Mode · Afterhours',
  'build-now': 'Build now',
  'drop-now': 'Drop now',
  'morph:music:build': 'Morph · Build',
  'morph:music:drop': 'Morph · Drop',
  'blackout': 'Blackout frame',
  'panic-release': 'Panic release',
  'live-toggle': 'LIVE toggle',
  'preview-toggle': 'PREVIEW toggle',
  'journey-start': 'Journey start',
  'journey-stop': 'Journey stop',
  'small-mutation': 'Small mutation',
  'safe-scene:safe-calm-plasma': 'Safe Scene · Calm Plasma',
  'beat-tap': 'Beat · Tap',
  'beat-phrase-reset': 'Beat · Phrase reset',
  'beat-drop-mark': 'Beat · Drop mark'
});

export function listGeneratorMidiActions() {
  return Object.entries(ACTION_LABELS).map(([id, label]) => ({ id, label }));
}

export function listGeneratorMidiDefaultMappings() {
  return DEFAULT_MAPPINGS.map((item) => clone(item, item));
}

export function normalizeGeneratorMidiMapping(input = {}, index = 0) {
  const type = ['cc', 'note'].includes(String(input.type || '')) ? String(input.type) : 'note';
  const action = String(input.action || 'small-mutation');
  return Object.freeze({
    id: String(input.id || `${type}-${input.number ?? index}-${action}`).slice(0, 96),
    type,
    channel: input.channel === 'any' ? 'any' : clamp(input.channel, 1, 16, 1),
    number: clamp(input.number, 0, 127, 0),
    action,
    label: String(input.label || ACTION_LABELS[action] || action).slice(0, 120)
  });
}

export function normalizeGeneratorMidiConfig(input = {}) {
  const mappings = Array.isArray(input.mappings) && input.mappings.length
    ? input.mappings.slice(0, 96).map(normalizeGeneratorMidiMapping)
    : listGeneratorMidiDefaultMappings().map(normalizeGeneratorMidiMapping);
  return Object.freeze({
    version: GENERATOR_MIDI_APC_VERSION,
    enabled: input.enabled === true,
    inputId: String(input.inputId || 'auto').slice(0, 160),
    channel: input.channel === 'any' ? 'any' : clamp(input.channel, 1, 16, 1),
    softTakeover: input.softTakeover !== false,
    noteOffIgnored: input.noteOffIgnored !== false,
    learnAction: String(input.learnAction || '').slice(0, 120),
    lastInputName: String(input.lastInputName || '').slice(0, 160),
    mappings
  });
}

export function readGeneratorMidiConfig(storage = globalThis.localStorage) {
  const raw = (() => { try { return storage.getItem(GENERATOR_MIDI_CONFIG_KEY); } catch { return ''; } })();
  return normalizeGeneratorMidiConfig(safeJsonParse(raw, {}));
}

export function saveGeneratorMidiConfig(input = {}, storage = globalThis.localStorage) {
  const config = normalizeGeneratorMidiConfig(input);
  try { storage.setItem(GENERATOR_MIDI_CONFIG_KEY, JSON.stringify(config)); } catch {}
  return config;
}

export function resetGeneratorMidiMappings(storage = globalThis.localStorage) {
  const config = saveGeneratorMidiConfig({ mappings: listGeneratorMidiDefaultMappings(), enabled: false, inputId: 'auto', channel: 'any' }, storage);
  return config;
}

export function createGeneratorMidiRuntime() {
  return Object.seal({
    supported: false,
    access: false,
    connected: false,
    enabled: false,
    inputId: 'auto',
    inputName: '',
    messageCount: 0,
    mappedCount: 0,
    ignoredCount: 0,
    learnedCount: 0,
    lastMessage: null,
    lastAction: '',
    error: '',
    inputs: []
  });
}

export function normalizeMidiMessage(data = []) {
  const bytes = Array.from(data || []).map((value) => clamp(value, 0, 255, 0));
  const status = bytes[0] || 0;
  const command = status & 0xF0;
  const channel = (status & 0x0F) + 1;
  const number = clamp(bytes[1], 0, 127, 0);
  const value = clamp(bytes[2], 0, 127, 0);
  const type = command === 0xB0 ? 'cc' : (command === 0x90 || command === 0x80 ? 'note' : 'other');
  const noteOff = command === 0x80 || (command === 0x90 && value <= 0);
  return Object.freeze({
    raw: bytes.slice(0, 3),
    status,
    command,
    channel,
    type,
    number,
    value,
    norm: type === 'cc' ? value / 127 : (noteOff ? 0 : Math.max(1, value) / 127),
    noteOff,
    key: `${type}:${channel}:${number}`,
    anyKey: `${type}:any:${number}`
  });
}

export function midiMessageMatchesMapping(message = {}, mapping = {}, config = {}) {
  if (!message || !mapping) return false;
  if (message.type !== mapping.type) return false;
  if (Number(message.number) !== Number(mapping.number)) return false;
  const channel = config.channel === 'any' ? mapping.channel : config.channel;
  if (channel !== 'any' && Number(message.channel) !== Number(channel)) return false;
  if (mapping.channel !== 'any' && Number(message.channel) !== Number(mapping.channel)) return false;
  return true;
}

export function findGeneratorMidiAction(messageInput = {}, configInput = {}) {
  const message = messageInput?.raw ? normalizeMidiMessage(messageInput.raw) : messageInput;
  const config = normalizeGeneratorMidiConfig(configInput);
  if (!config.enabled) return { ok: false, reason: 'midi-disabled', message, mapping: null, action: null };
  if (message.type === 'other') return { ok: false, reason: 'unsupported-message', message, mapping: null, action: null };
  if (message.noteOff && config.noteOffIgnored !== false) return { ok: false, reason: 'note-off-ignored', message, mapping: null, action: null };
  const mapping = config.mappings.find((item) => midiMessageMatchesMapping(message, item, config));
  if (!mapping) return { ok: false, reason: 'unmapped', message, mapping: null, action: null };
  return { ok: true, reason: 'mapped', message, mapping, action: mapping.action, value: message.norm };
}

export function learnGeneratorMidiMapping(configInput = {}, action = '', messageInput = {}) {
  const config = normalizeGeneratorMidiConfig(configInput);
  const message = messageInput?.raw ? normalizeMidiMessage(messageInput.raw) : messageInput;
  const resolvedAction = String(action || config.learnAction || '').trim();
  if (!resolvedAction) return { ok: false, reason: 'no-learn-action', config };
  if (!['cc', 'note'].includes(message.type)) return { ok: false, reason: 'unsupported-message', config };
  const id = `${message.type}${message.number}-ch${message.channel}-${resolvedAction.replace(/[^a-z0-9:_-]+/gi, '-')}`.slice(0, 96);
  const nextMapping = normalizeGeneratorMidiMapping({
    id,
    type: message.type,
    channel: config.channel === 'any' ? 'any' : message.channel,
    number: message.number,
    action: resolvedAction,
    label: ACTION_LABELS[resolvedAction] || resolvedAction
  });
  const filtered = config.mappings.filter((item) => item.action !== resolvedAction && !(item.type === nextMapping.type && item.number === nextMapping.number && item.channel === nextMapping.channel));
  const next = normalizeGeneratorMidiConfig({ ...config, learnAction: '', mappings: [nextMapping, ...filtered].slice(0, 96) });
  return { ok: true, reason: 'learned', config: next, mapping: nextMapping };
}

export function summarizeGeneratorMidiMappings(configInput = {}, limit = 10) {
  const config = normalizeGeneratorMidiConfig(configInput);
  return config.mappings.slice(0, limit).map((item) => `${item.type.toUpperCase()} ${item.channel === 'any' ? 'ANY' : `CH${item.channel}`} #${item.number} → ${ACTION_LABELS[item.action] || item.action}`);
}

export function buildGeneratorMidiSnapshot(runtimeInput = {}, configInput = {}) {
  const runtime = { ...createGeneratorMidiRuntime(), ...(runtimeInput || {}) };
  const config = normalizeGeneratorMidiConfig(configInput);
  const snapshot = Object.freeze({
    version: GENERATOR_MIDI_APC_VERSION,
    at: Date.now(),
    supported: runtime.supported === true,
    access: runtime.access === true,
    connected: runtime.connected === true,
    enabled: config.enabled === true,
    inputId: config.inputId,
    inputName: runtime.inputName || config.lastInputName || '',
    inputs: Array.isArray(runtime.inputs) ? runtime.inputs.slice(0, 16) : [],
    messageCount: Number(runtime.messageCount || 0),
    mappedCount: Number(runtime.mappedCount || 0),
    ignoredCount: Number(runtime.ignoredCount || 0),
    learnedCount: Number(runtime.learnedCount || 0),
    lastMessage: runtime.lastMessage || null,
    lastAction: runtime.lastAction || '',
    learnAction: config.learnAction || '',
    error: runtime.error || '',
    mappingSummary: summarizeGeneratorMidiMappings(config, 12)
  });
  try { globalThis.localStorage?.setItem?.(GENERATOR_MIDI_SNAPSHOT_KEY, JSON.stringify(snapshot)); } catch {}
  return snapshot;
}

export function formatGeneratorMidiMessage(message = {}) {
  if (!message || !message.type) return '--';
  if (message.type === 'other') return `OTHER ${message.raw?.join?.(' ') || ''}`.trim();
  return `${message.type.toUpperCase()} CH${message.channel} #${message.number} v${message.value}`;
}

export function formatGeneratorMidiReport(runtimeInput = {}, configInput = {}) {
  const snapshot = buildGeneratorMidiSnapshot(runtimeInput, configInput);
  return [
    `Generator MIDI APC report · ${GENERATOR_MIDI_APC_VERSION}`,
    `Enabled: ${snapshot.enabled ? 'YES' : 'NO'}`,
    `Web MIDI supported: ${snapshot.supported ? 'YES' : 'NO'}`,
    `Access: ${snapshot.access ? 'YES' : 'NO'}`,
    `Connected: ${snapshot.connected ? 'YES' : 'NO'}`,
    `Input: ${snapshot.inputName || snapshot.inputId || '--'}`,
    `Messages: ${snapshot.messageCount} · mapped ${snapshot.mappedCount} · ignored ${snapshot.ignoredCount} · learned ${snapshot.learnedCount}`,
    `Last message: ${formatGeneratorMidiMessage(snapshot.lastMessage)}`,
    `Last action: ${ACTION_LABELS[snapshot.lastAction] || snapshot.lastAction || '--'}`,
    `Learn: ${snapshot.learnAction || 'OFF'}`,
    `Mappings:`,
    ...snapshot.mappingSummary.map((line) => `- ${line}`)
  ].join('\n');
}
