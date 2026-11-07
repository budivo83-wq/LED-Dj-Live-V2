import { listGeneratorSceneMorphTargets, normalizeGeneratorSceneMorphConfig } from './generator_scene_morph.js';

export const GENERATOR_JOURNEY_TIMELINE_VERSION = 'STEP38R_GENERATOR_JOURNEY_TIMELINE';
export const GENERATOR_JOURNEY_CONFIG_KEY = 'budilight.generator.journey.config.v1';
export const GENERATOR_JOURNEY_SNAPSHOT_KEY = 'budilight.generator.journey.snapshot.v1';

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value, min, max, fallback = min) {
  const n = safeNumber(value, fallback);
  return Math.max(min, Math.min(max, n));
}

function safeJsonParse(text, fallback = null) {
  try { return JSON.parse(text || ''); } catch { return fallback; }
}

function clone(value, fallback = {}) {
  try { return JSON.parse(JSON.stringify(value)); } catch { return fallback; }
}

const JOURNEY_PRESETS = Object.freeze([
  Object.freeze({
    id: 'psy-trip',
    name: 'Psy Trip · Calm → Build → Drop → Chaos',
    description: 'Hudební evoluce pro psy / techno: pozvolný náběh, drop, break, chaos a noční dojezd.',
    steps: Object.freeze([
      Object.freeze({ id: 'psy-calm', label: 'Calm entry', targetId: 'music:ambient', durationBeats: 16, holdBeats: 16, curve: 'smooth' }),
      Object.freeze({ id: 'psy-build', label: 'Build tunnel', targetId: 'music:build', durationBeats: 32, holdBeats: 8, curve: 'ease-in' }),
      Object.freeze({ id: 'psy-drop', label: 'Drop gate', targetId: 'music:drop', durationBeats: 8, holdBeats: 24, curve: 'ease-out' }),
      Object.freeze({ id: 'psy-break', label: 'Break breath', targetId: 'music:break', durationBeats: 16, holdBeats: 12, curve: 'smooth' }),
      Object.freeze({ id: 'psy-chaos', label: 'Psy chaos', targetId: 'music:psy-chaos', durationBeats: 16, holdBeats: 24, curve: 'ease' }),
      Object.freeze({ id: 'psy-after', label: 'Afterhours release', targetId: 'music:afterhours', durationBeats: 32, holdBeats: 16, curve: 'smooth' })
    ])
  }),
  Object.freeze({
    id: 'techno-groove',
    name: 'Techno Groove · Pulse Journey',
    description: 'Stabilnější taneční cesta s groove fází, dropem a kontrolovaným návratem.',
    steps: Object.freeze([
      Object.freeze({ id: 'tech-start', label: 'Dark start', targetId: 'music:afterhours', durationBeats: 16, holdBeats: 8, curve: 'smooth' }),
      Object.freeze({ id: 'tech-groove', label: 'Groove lock', targetId: 'music:groove', durationBeats: 16, holdBeats: 32, curve: 'smooth' }),
      Object.freeze({ id: 'tech-build', label: 'Long build', targetId: 'music:build', durationBeats: 32, holdBeats: 8, curve: 'ease-in' }),
      Object.freeze({ id: 'tech-drop', label: 'Pulse drop', targetId: 'music:drop', durationBeats: 8, holdBeats: 24, curve: 'ease-out' }),
      Object.freeze({ id: 'tech-groove-back', label: 'Back to groove', targetId: 'music:groove', durationBeats: 16, holdBeats: 32, curve: 'smooth' })
    ])
  }),
  Object.freeze({
    id: 'safe-demo',
    name: 'Safe Demo · Preview Friendly',
    description: 'Mírnější testovací cesta bez dlouhého tvrdého dropu. Dobré pro první kontrolu LED.',
    steps: Object.freeze([
      Object.freeze({ id: 'demo-ambient', label: 'Soft ambient', targetId: 'music:ambient', durationBeats: 8, holdBeats: 8, curve: 'smooth' }),
      Object.freeze({ id: 'demo-build', label: 'Small build', targetId: 'music:build', durationBeats: 12, holdBeats: 8, curve: 'smooth' }),
      Object.freeze({ id: 'demo-groove', label: 'Groove pulse', targetId: 'music:groove', durationBeats: 12, holdBeats: 12, curve: 'smooth' }),
      Object.freeze({ id: 'demo-after', label: 'Soft release', targetId: 'music:afterhours', durationBeats: 12, holdBeats: 8, curve: 'smooth' })
    ])
  })
]);

export function listGeneratorJourneyPresets() {
  return JOURNEY_PRESETS.map((preset) => clone(preset, preset));
}

export function getGeneratorJourneyPreset(id = 'psy-trip') {
  const journeyId = String(id || 'psy-trip');
  return clone(JOURNEY_PRESETS.find((preset) => preset.id === journeyId) || JOURNEY_PRESETS[0], JOURNEY_PRESETS[0]);
}

export function normalizeGeneratorJourneyStep(input = {}, index = 0) {
  const targetId = String(input.targetId || (index % 2 ? 'music:build' : 'music:ambient')).slice(0, 120);
  return Object.freeze({
    id: String(input.id || `step-${index + 1}`).slice(0, 64),
    label: String(input.label || `Step ${index + 1}`).slice(0, 80),
    targetId,
    durationBeats: clamp(input.durationBeats, 1, 256, 16),
    holdBeats: clamp(input.holdBeats, 0, 256, 8),
    curve: ['smooth', 'ease', 'ease-in', 'ease-out', 'ease-in-out', 'linear'].includes(String(input.curve || '')) ? String(input.curve) : 'smooth'
  });
}

export function normalizeGeneratorJourneyConfig(input = {}) {
  const preset = getGeneratorJourneyPreset(input.journeyId || input.id || 'psy-trip');
  const rawSteps = Array.isArray(input.steps) && input.steps.length ? input.steps : preset.steps;
  const steps = rawSteps.slice(0, 32).map(normalizeGeneratorJourneyStep);
  return Object.freeze({
    version: GENERATOR_JOURNEY_TIMELINE_VERSION,
    journeyId: String(input.journeyId || preset.id || 'psy-trip').slice(0, 80),
    name: String(input.name || preset.name || 'Generator Journey').slice(0, 120),
    description: String(input.description || preset.description || '').slice(0, 260),
    loop: input.loop === true,
    autoPreview: input.autoPreview !== false,
    commitOnStepDone: input.commitOnStepDone !== false,
    keepMusicRuntime: input.keepMusicRuntime !== false,
    steps
  });
}

export function readGeneratorJourneyConfig(storage = globalThis.localStorage) {
  const raw = (() => { try { return storage.getItem(GENERATOR_JOURNEY_CONFIG_KEY); } catch { return ''; } })();
  return normalizeGeneratorJourneyConfig(safeJsonParse(raw, {}));
}

export function saveGeneratorJourneyConfig(input = {}, storage = globalThis.localStorage) {
  const config = normalizeGeneratorJourneyConfig(input);
  try { storage.setItem(GENERATOR_JOURNEY_CONFIG_KEY, JSON.stringify(config)); } catch {}
  return config;
}

export function createGeneratorJourneyRuntime() {
  return Object.seal({
    active: false,
    done: false,
    phase: 'idle',
    journeyId: '',
    currentIndex: 0,
    currentStep: null,
    startedBeat: 0,
    stepStartedBeat: 0,
    holdUntilBeat: 0,
    loops: 0,
    progress: 0,
    lastAction: null,
    lastTransitionKey: '',
    error: ''
  });
}

export function armGeneratorJourney(runtime = createGeneratorJourneyRuntime(), configInput = {}, context = {}) {
  const config = normalizeGeneratorJourneyConfig(configInput);
  const beat = safeNumber(context.beat, 0);
  const next = {
    ...runtime,
    active: true,
    done: false,
    phase: 'need-morph',
    journeyId: config.journeyId,
    currentIndex: 0,
    currentStep: config.steps[0] || null,
    startedBeat: beat,
    stepStartedBeat: beat,
    holdUntilBeat: beat,
    loops: 0,
    progress: 0,
    lastAction: null,
    lastTransitionKey: '',
    error: ''
  };
  return { runtime: next, action: config.steps[0] ? { type: 'arm-morph', step: config.steps[0], index: 0 } : null, ok: Boolean(config.steps[0]) };
}

export function stopGeneratorJourney(runtime = createGeneratorJourneyRuntime(), reason = 'operator-stop', storage = globalThis.localStorage) {
  const next = { ...runtime, active: false, done: runtime.done === true, phase: 'idle', lastAction: { type: 'stop', reason, at: Date.now() }, error: reason === 'done' ? '' : String(reason || 'stopped') };
  writeGeneratorJourneySnapshot(next, storage);
  return next;
}

function stepProgress(runtime, config, beat) {
  const total = Math.max(1, config.steps.reduce((sum, step) => sum + safeNumber(step.durationBeats, 0) + safeNumber(step.holdBeats, 0), 0));
  const elapsed = Math.max(0, safeNumber(beat, 0) - safeNumber(runtime.startedBeat, 0));
  return Math.max(0, Math.min(1, elapsed / total));
}

export function tickGeneratorJourney(runtime = createGeneratorJourneyRuntime(), configInput = {}, context = {}) {
  const config = normalizeGeneratorJourneyConfig(configInput);
  if (!runtime?.active) return { runtime, action: null };
  const beat = safeNumber(context.beat, 0);
  const sceneMorphActive = context.sceneMorphActive === true;
  const sceneMorphDone = context.sceneMorphDone === true;
  let next = { ...runtime, currentStep: config.steps[runtime.currentIndex] || runtime.currentStep, progress: stepProgress(runtime, config, beat) };
  let action = null;

  if (!next.currentStep) {
    next = { ...next, active: false, done: true, phase: 'done', error: '' };
    return { runtime: next, action: { type: 'done' } };
  }

  if (next.phase === 'need-morph' && !sceneMorphActive) {
    action = { type: 'arm-morph', step: next.currentStep, index: next.currentIndex };
    next = { ...next, phase: 'morph', stepStartedBeat: beat, lastAction: action, lastTransitionKey: `${next.currentIndex}:${next.currentStep.targetId}:${beat.toFixed(3)}` };
    return { runtime: next, action };
  }

  if (next.phase === 'morph' && sceneMorphDone && !sceneMorphActive) {
    const holdBeats = Math.max(0, safeNumber(next.currentStep.holdBeats, 0));
    next = { ...next, phase: 'hold', holdUntilBeat: beat + holdBeats, stepStartedBeat: beat, lastAction: { type: 'hold', step: next.currentStep, untilBeat: beat + holdBeats } };
    if (holdBeats <= 0) next = { ...next, holdUntilBeat: beat };
  }

  if (next.phase === 'hold' && beat >= safeNumber(next.holdUntilBeat, beat)) {
    let nextIndex = Number(next.currentIndex || 0) + 1;
    let loops = Number(next.loops || 0);
    if (nextIndex >= config.steps.length) {
      if (config.loop) {
        nextIndex = 0;
        loops += 1;
      } else {
        next = { ...next, active: false, done: true, phase: 'done', progress: 1, loops, lastAction: { type: 'done' }, error: '' };
        return { runtime: next, action: { type: 'done' } };
      }
    }
    const step = config.steps[nextIndex];
    next = { ...next, currentIndex: nextIndex, currentStep: step, loops, phase: 'need-morph', lastAction: { type: 'advance', step, index: nextIndex } };
    action = { type: 'arm-morph', step, index: nextIndex };
    return { runtime: next, action };
  }

  return { runtime: next, action: null };
}

export function buildGeneratorJourneyMorphConfig(step = {}, journeyConfig = {}) {
  return normalizeGeneratorSceneMorphConfig({
    targetId: step.targetId || 'music:build',
    durationBeats: step.durationBeats || 16,
    timeMode: 'beats',
    curve: step.curve || 'smooth',
    commitOnDone: journeyConfig.commitOnStepDone !== false,
    keepMusicRuntime: journeyConfig.keepMusicRuntime !== false
  });
}

export function validateGeneratorJourneyTargets(configInput = {}, presetBank = {}) {
  const config = normalizeGeneratorJourneyConfig(configInput);
  const validIds = new Set(listGeneratorSceneMorphTargets(presetBank, true).map((target) => target.id));
  return config.steps.map((step, index) => ({
    index,
    id: step.id,
    label: step.label,
    targetId: step.targetId,
    ok: validIds.has(step.targetId)
  }));
}

export function buildGeneratorJourneyStatus(runtime = createGeneratorJourneyRuntime(), configInput = {}) {
  const config = normalizeGeneratorJourneyConfig(configInput);
  if (!runtime?.active && runtime?.done) return 'DONE';
  if (!runtime?.active) return 'IDLE';
  const step = config.steps[runtime.currentIndex] || runtime.currentStep || {};
  const idx = Math.min(config.steps.length, Number(runtime.currentIndex || 0) + 1);
  const pct = Math.round((Number(runtime.progress || 0)) * 100);
  if (runtime.phase === 'hold') return `HOLD ${idx}/${config.steps.length} · ${step.label || step.targetId} · ${pct}%`;
  if (runtime.phase === 'morph') return `MORPH ${idx}/${config.steps.length} · ${step.label || step.targetId} · ${pct}%`;
  return `${String(runtime.phase || 'RUN').toUpperCase()} ${idx}/${config.steps.length} · ${step.label || step.targetId}`;
}

export function buildGeneratorJourneyReport(runtime = createGeneratorJourneyRuntime(), configInput = {}) {
  const config = normalizeGeneratorJourneyConfig(configInput);
  const lines = [
    `Generator Journey Timeline ${GENERATOR_JOURNEY_TIMELINE_VERSION}`,
    `Journey: ${config.name} (${config.journeyId})`,
    `State: ${buildGeneratorJourneyStatus(runtime, config)}`,
    `Loop: ${config.loop ? 'ON' : 'OFF'} · autoPreview: ${config.autoPreview ? 'ON' : 'OFF'} · commit: ${config.commitOnStepDone ? 'ON' : 'OFF'}`,
    `Current: ${Number(runtime.currentIndex || 0) + 1}/${config.steps.length} · phase=${runtime.phase || 'idle'} · loops=${runtime.loops || 0}`,
    'Steps:'
  ];
  for (const [index, step] of config.steps.entries()) {
    const marker = index === Number(runtime.currentIndex || 0) && runtime.active ? '→' : ' ';
    lines.push(`${marker} ${index + 1}. ${step.label} · ${step.targetId} · morph ${step.durationBeats}b · hold ${step.holdBeats}b · ${step.curve}`);
  }
  if (runtime.error) lines.push(`Error: ${runtime.error}`);
  return lines.join('\n');
}

export function writeGeneratorJourneySnapshot(runtime = createGeneratorJourneyRuntime(), storage = globalThis.localStorage) {
  const snapshot = {
    version: GENERATOR_JOURNEY_TIMELINE_VERSION,
    active: runtime.active === true,
    done: runtime.done === true,
    phase: runtime.phase || 'idle',
    journeyId: runtime.journeyId || '',
    currentIndex: Number(runtime.currentIndex || 0),
    currentStep: runtime.currentStep || null,
    progress: Number(runtime.progress || 0),
    loops: Number(runtime.loops || 0),
    error: runtime.error || '',
    updatedAt: Date.now()
  };
  try { storage.setItem(GENERATOR_JOURNEY_SNAPSHOT_KEY, JSON.stringify(snapshot)); } catch {}
  return snapshot;
}
