import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  readGeneratorSettingsOutputFps,
  persistGeneratorLiveFpsFromSettings,
  fetchServerArtnetOutputFps,
  GENERATOR_SETTINGS_FPS_VERSION,
  SETTINGS_STORAGE_KEY,
  ARTNET_MASTER_MIRROR_FPS_KEY,
  GENERATOR_LIVE_FPS_LEGACY_KEY
} from '../public/runtime/generator_settings_fps.js';
import { getStoredGeneratorLiveFps, storeGeneratorLiveFps } from '../public/runtime/generator_live_ops.js';

function memoryStorage(seed = {}) {
  const map = new Map(Object.entries(seed).map(([k, v]) => [k, String(v)]));
  return {
    getItem: (key) => map.has(key) ? map.get(key) : '',
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
    dump: () => Object.fromEntries(map.entries())
  };
}

assert.equal(GENERATOR_SETTINGS_FPS_VERSION, 'STEP38M_GENERATOR_USES_SETTINGS_OUTPUT_FPS');

let storage = memoryStorage({ [SETTINGS_STORAGE_KEY]: JSON.stringify({ fps: 50, artnetMirrorFps: 15 }) });
let resolved = readGeneratorSettingsOutputFps(storage, 60);
assert.equal(resolved.fps, 50, 'Generator must prefer Settings Runtime FPS over its own legacy FPS');
assert.equal(resolved.source, 'settings.fps');
assert.equal(getStoredGeneratorLiveFps(storage), 50, 'legacy getter must now follow Settings FPS');
assert.equal(storeGeneratorLiveFps(15, storage), 50, 'manual generator FPS must not override Settings FPS');
assert.equal(storage.getItem(GENERATOR_LIVE_FPS_LEGACY_KEY), '50', 'effective Settings FPS should be mirrored to legacy key for diagnostics');

storage = memoryStorage({ [SETTINGS_STORAGE_KEY]: JSON.stringify({ fps: 144, artnetMirrorFps: 30 }) });
resolved = readGeneratorSettingsOutputFps(storage, 60);
assert.equal(resolved.fps, 60, 'browser generator live loop is capped at 60 FPS');
assert.equal(resolved.capped, true);

storage = memoryStorage({ [SETTINGS_STORAGE_KEY]: JSON.stringify({ artnetMirrorFps: 45 }) });
resolved = readGeneratorSettingsOutputFps(storage, 60);
assert.equal(resolved.fps, 45, 'Generator should fall back to Settings ArtNet Mirror FPS when Runtime FPS is missing');

storage = memoryStorage({ [ARTNET_MASTER_MIRROR_FPS_KEY]: '30' });
resolved = readGeneratorSettingsOutputFps(storage, 60);
assert.equal(resolved.fps, 30, 'Generator should fall back to ArtNet master mirror FPS localStorage key');

const persisted = persistGeneratorLiveFpsFromSettings({ fps: 47, source: 'unit-test', raw: 47 }, storage);
assert.equal(persisted.fps, 47);
assert.equal(storage.getItem(GENERATOR_LIVE_FPS_LEGACY_KEY), '47');

const serverInfo = await fetchServerArtnetOutputFps(async () => ({
  ok: true,
  async json() { return { config: { fps: 55 } }; }
}), 60);
assert.equal(serverInfo.fps, 55, 'server live-config FPS should resolve for boot/live-start refresh');
assert.equal(serverInfo.source, 'server.live-config.fps');

const generatorJs = readFileSync(join(process.cwd(), 'public/generator.js'), 'utf8');
const generatorHtml = readFileSync(join(process.cwd(), 'public/generator.html'), 'utf8');
assert.ok(generatorJs.includes('refreshLiveFpsFromSettings'), 'generator page must poll Settings FPS');
assert.ok(generatorJs.includes('refreshLiveFpsFromServer'), 'generator page must refresh FPS from server live-config on boot/live start');
assert.ok(generatorJs.includes('LIVE MASTER zapnutý @ ${liveFps} FPS podle Settings'), 'live start log should expose Settings FPS takeover');
assert.ok(generatorHtml.includes('Live FPS ze Settings'), 'operator UI should show Generator Live FPS follows Settings');
assert.ok(generatorHtml.includes('generatorLiveFpsSource'), 'operator UI should show Settings FPS source');

console.log('PASS generator STEP38M settings FPS guard');
