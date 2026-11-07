import assert from 'node:assert/strict';
import {
  GENERATOR_FIELD_TEST_VERSION,
  listGeneratorFieldTests,
  listGeneratorFieldTestColors,
  normalizeGeneratorFieldTestOptions,
  createGeneratorFieldTestFrame,
  summarizeGeneratorFieldTest,
  buildGeneratorFieldTestReport
} from '../public/runtime/generator_field_tests.js';

assert.equal(GENERATOR_FIELD_TEST_VERSION, 'STEP38K_GENERATOR_FIELD_TEST_CONTROLS');
assert.ok(listGeneratorFieldTests().length >= 5, 'expected field test definitions');
assert.ok(listGeneratorFieldTestColors().length >= 5, 'expected field test colors');

const normalized = normalizeGeneratorFieldTestOptions({ type: 'universe-sweep', width: 300, height: 8, universeSize: 170, universeIndex: 15, stripIndex: 'all', intensity: 0.8 });
assert.equal(normalized.universeCount, 16);
assert.equal(normalized.universeIndex, 15);
assert.equal(normalized.stripIndex, -1);

const single = createGeneratorFieldTestFrame({ type: 'single-strip', width: 300, height: 8, stripIndex: 2, color: 'red', intensity: 1 });
assert.equal(single.frame.byteLength, 300 * 8 * 3);
assert.equal(single.meta.fieldTest, true);
assert.equal(single.meta.fieldTestType, 'single-strip');
const strip2Offset = (2 * 300 + 0) * 3;
assert.equal(single.frame[strip2Offset], 230);
assert.equal(single.frame[strip2Offset + 1], 0);
const strip1Offset = (1 * 300 + 0) * 3;
assert.equal(single.frame[strip1Offset], 0);

const probe = createGeneratorFieldTestFrame({ type: 'first-last', width: 300, height: 8, stripIndex: 0, intensity: 1 });
assert.equal(probe.frame[0], 0);
assert.equal(probe.frame[1], 230);
assert.equal(probe.frame[2], 0);
const last = (299) * 3;
assert.equal(probe.frame[last], 230);
assert.equal(probe.frame[last + 1], 0);
assert.equal(probe.frame[last + 2], 0);

const rgb = createGeneratorFieldTestFrame({ type: 'rgb-order', width: 300, height: 8, stripIndex: 0, intensity: 1 });
assert.ok(rgb.frame[0] > rgb.frame[1], 'first RGB zone should be red');
const greenOffset = Math.floor(300 * 0.30) * 3;
assert.ok(rgb.frame[greenOffset + 1] > rgb.frame[greenOffset], 'second RGB zone should be green');
const blueOffset = Math.floor(300 * 0.55) * 3;
assert.ok(rgb.frame[blueOffset + 2] > rgb.frame[blueOffset], 'third RGB zone should be blue');

const sweepA = createGeneratorFieldTestFrame({ type: 'universe-sweep', width: 300, height: 8, universeSize: 170, universeIndex: 0, intensity: 1 });
const sweepB = createGeneratorFieldTestFrame({ type: 'universe-sweep', width: 300, height: 8, universeSize: 170, universeIndex: 1, intensity: 1 });
assert.notDeepEqual(Array.from(sweepA.frame.slice(0, 30)), Array.from(sweepB.frame.slice(0, 30)), 'universe sweep should move highlighted segment');

const direction = createGeneratorFieldTestFrame({ type: 'direction-probe', width: 300, height: 8, stripIndex: 'all', phase: 0.5, intensity: 1 });
assert.equal(direction.frame.byteLength, 7200);
assert.ok(direction.frame.some((value) => value > 240), 'direction marker should contain bright pixels');

const summary = summarizeGeneratorFieldTest({ type: 'first-last', width: 300, height: 8, stripIndex: 3 });
assert.match(summary.detail, /STRIP 4/);
assert.match(summary.detail, /start green/);

const report = buildGeneratorFieldTestReport({ type: 'rgb-order', width: 300, height: 8 }, { live: true, ok: true });
assert.match(report, /FIELD TEST/);
assert.match(report, /LIVE MASTER/);
assert.match(report, /300x8 RGB/);

console.log('PASS generator STEP38K field test controls');
