import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderGeneratorFrame } from '../public/runtime/generator_engine.js';
import { graphToModuleFlags } from '../public/runtime/generator_graph.js';
import {
  GENERATOR_MUSIC_MODES_VERSION,
  listGeneratorMusicModes,
  normalizeGeneratorMusicModeId,
  applyGeneratorMusicMode,
  applyGeneratorMusicModeRuntimeValues,
  createGeneratorMusicModeRuntimeBuffer,
  buildGeneratorMusicModeSummary,
  formatGeneratorMusicModeStatus,
  buildGeneratorMusicModeReport,
  loadGeneratorMusicMode,
  saveGeneratorMusicMode,
  isGeneratorMusicModeRuntimeEnabled,
  setGeneratorMusicModeRuntimeEnabled
} from '../public/runtime/generator_music_modes.js';

assert.equal(GENERATOR_MUSIC_MODES_VERSION, 'STEP38P_GENERATOR_MUSIC_MODES');
const modes = listGeneratorMusicModes();
assert.ok(modes.length >= 8, 'music modes should include manual plus real show modes');
assert.deepEqual(modes.map((m) => m.id).slice(0, 4), ['manual', 'ambient', 'build', 'groove']);
assert.equal(normalizeGeneratorMusicModeId('wat'), 'manual');
assert.equal(normalizeGeneratorMusicModeId('drop'), 'drop');

const storageMap = new Map();
const storage = {
  getItem: (key) => storageMap.get(key) || null,
  setItem: (key, value) => storageMap.set(key, String(value))
};
assert.equal(loadGeneratorMusicMode(storage), 'manual');
assert.equal(saveGeneratorMusicMode('psy-chaos', storage), 'psy-chaos');
assert.equal(loadGeneratorMusicMode(storage), 'psy-chaos');
assert.equal(isGeneratorMusicModeRuntimeEnabled(storage), true);
assert.equal(setGeneratorMusicModeRuntimeEnabled(false, storage), false);
assert.equal(isGeneratorMusicModeRuntimeEnabled(storage), false);

const ambient = applyGeneratorMusicMode('ambient', {});
assert.equal(ambient.modeId, 'ambient');
assert.ok(ambient.patch.energy < 0.4, 'ambient should be low energy');
assert.equal(ambient.graph.nodes.find((n) => n.id === 'gate').enabled, false, 'ambient gate should be disabled');
assert.ok(ambient.curves.lanes.find((lane) => lane.id === 'colorShift').mode === 'lfo', 'ambient should drift color');

const build = applyGeneratorMusicMode('build', ambient);
const buildBase = Object.fromEntries(build.curves.lanes.map((lane) => [lane.id, lane.value]));
const buildStart = applyGeneratorMusicModeRuntimeValues('build', buildBase, { enabled: true, beat: 1, bpm: 145, time: 0.2 });
const buildEnd = applyGeneratorMusicModeRuntimeValues('build', buildBase, { enabled: true, beat: 31, bpm: 145, time: 12 });
assert.ok(buildEnd.values.energy > buildStart.values.energy, 'build runtime should raise energy through phrase');
assert.ok(buildEnd.values.density > buildStart.values.density, 'build runtime should raise density through phrase');
assert.ok(buildEnd.meta.stage.includes('Build'));

const drop = applyGeneratorMusicMode('drop', build);
assert.equal(drop.graph.nodes.find((n) => n.id === 'gate').enabled, true, 'drop should enable gate');
const dropValues = Object.fromEntries(drop.curves.lanes.map((lane) => [lane.id, lane.value]));
const dropAccent = applyGeneratorMusicModeRuntimeValues('drop', dropValues, { enabled: true, beat: 8.02, bpm: 145, time: 5 });
assert.ok(dropAccent.values.pulse >= 0.78, 'drop runtime should keep strong pulse');
assert.ok(dropAccent.values.shimmer > dropValues.shimmer, 'drop downbeat should add shimmer');

const manualValues = { energy: 0.2, density: 0.3, speed: 0.4, colorShift: 0.5, feedback: 0.1, warp: 0.2, pulse: 0.3, shimmer: 0.4 };
const manual = applyGeneratorMusicModeRuntimeValues('manual', manualValues, { enabled: true, beat: 99, bpm: 145, time: 99 });
assert.deepEqual(manual.values, manualValues, 'manual runtime must not rewrite operator values');
const runtimeBuffer = createGeneratorMusicModeRuntimeBuffer();
const buffered = applyGeneratorMusicModeRuntimeValues('build', buildBase, { enabled: true, beat: 8, bpm: 145, time: 3, runtimeBuffer });
assert.equal(buffered.values, runtimeBuffer.values, 'runtime buffer should reuse Music Mode values object');

const summary = buildGeneratorMusicModeSummary('psy-chaos', drop.patch, drop.graph, drop.curves);
assert.ok(summary.nodes.includes('gate'));
assert.ok(summary.curves.includes('pulse:beat'));
assert.ok(formatGeneratorMusicModeStatus('drop', dropAccent.meta, true).includes('Drop'));
assert.ok(buildGeneratorMusicModeReport('drop', dropAccent.meta, summary).includes('Generator Music Mode STEP38P'));

const rendered = renderGeneratorFrame({ patch: drop.patch, graph: drop.graph, time: 1.5, bpm: drop.patch.bpm, beat: 3.5 });
assert.equal(rendered.frame.length, 300 * 8 * 3);
assert.ok(rendered.frame.some((value) => value > 0), 'music mode graph should render visible output');
assert.equal(graphToModuleFlags(drop.graph).gate, true);

const generatorJs = readFileSync(join(process.cwd(), 'public/generator.js'), 'utf8');
const generatorHtml = readFileSync(join(process.cwd(), 'public/generator.html'), 'utf8');
assert.ok(generatorJs.includes('applyGeneratorMusicModeRuntimeValues'), 'generator draw loop must use music mode runtime modulation');
assert.ok(generatorJs.includes('generatorDropNow'), 'generator UI must bind DROP NOW');
assert.ok(generatorHtml.includes('generatorMusicModeSelect'), 'Generator UI must expose music mode select');
assert.ok(generatorHtml.includes('generatorMusicModeRuntime'), 'Generator UI must expose music runtime toggle');
assert.ok(generatorHtml.includes('DROP NOW'), 'Generator UI must expose direct drop action');

console.log('PASS generator STEP38P music modes guard');
