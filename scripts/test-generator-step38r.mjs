import assert from 'node:assert/strict';
import { loadGeneratorPresetBank } from '../public/runtime/generator_presets.js';
import {
  GENERATOR_JOURNEY_TIMELINE_VERSION,
  listGeneratorJourneyPresets,
  normalizeGeneratorJourneyConfig,
  createGeneratorJourneyRuntime,
  armGeneratorJourney,
  tickGeneratorJourney,
  buildGeneratorJourneyMorphConfig,
  validateGeneratorJourneyTargets,
  buildGeneratorJourneyStatus,
  buildGeneratorJourneyReport,
  writeGeneratorJourneySnapshot
} from '../public/runtime/generator_journey_timeline.js';

class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null; }
  setItem(key, value) { this.map.set(key, String(value)); }
  removeItem(key) { this.map.delete(key); }
}

const storage = new MemoryStorage();
const bank = loadGeneratorPresetBank(storage);
const presets = listGeneratorJourneyPresets();
assert.ok(presets.length >= 3, 'factory journeys exist');
assert.ok(presets.some((journey) => journey.id === 'psy-trip'), 'psy journey exists');

const config = normalizeGeneratorJourneyConfig({ journeyId: 'safe-demo', loop: false });
assert.equal(config.journeyId, 'safe-demo');
assert.ok(config.steps.length >= 4, 'safe demo has multiple steps');

const targetChecks = validateGeneratorJourneyTargets(config, bank);
assert.equal(targetChecks.every((item) => item.ok), true, 'all journey targets are valid scene morph targets');

let runtime = createGeneratorJourneyRuntime();
const armed = armGeneratorJourney(runtime, config, { beat: 100 });
assert.equal(armed.ok, true);
runtime = armed.runtime;
assert.equal(runtime.active, true);
assert.equal(armed.action.type, 'arm-morph');
assert.equal(armed.action.step.targetId, config.steps[0].targetId);

const morphConfig = buildGeneratorJourneyMorphConfig(armed.action.step, config);
assert.equal(morphConfig.targetId, config.steps[0].targetId);
assert.equal(morphConfig.durationBeats, config.steps[0].durationBeats);

let tick = tickGeneratorJourney(runtime, config, { beat: 101, sceneMorphActive: false, sceneMorphDone: false });
runtime = tick.runtime;
assert.equal(tick.action.type, 'arm-morph');
assert.match(buildGeneratorJourneyStatus(runtime, config), /MORPH/);

tick = tickGeneratorJourney(runtime, config, { beat: 110, sceneMorphActive: false, sceneMorphDone: true });
runtime = tick.runtime;
assert.equal(runtime.phase, 'hold');
assert.ok(runtime.holdUntilBeat >= 110, 'hold phase sets hold-until beat');

tick = tickGeneratorJourney(runtime, config, { beat: runtime.holdUntilBeat + 0.25, sceneMorphActive: false, sceneMorphDone: false });
runtime = tick.runtime;
assert.equal(tick.action.type, 'arm-morph');
assert.equal(runtime.currentIndex, 1);

const report = buildGeneratorJourneyReport(runtime, config);
assert.match(report, /STEP38R/);
assert.match(report, /Safe Demo/);
assert.match(report, /Steps:/);

const snapshot = writeGeneratorJourneySnapshot(runtime, storage);
assert.equal(snapshot.active, true);
assert.equal(snapshot.currentIndex, 1);

console.log(`${GENERATOR_JOURNEY_TIMELINE_VERSION}: PASS`);
