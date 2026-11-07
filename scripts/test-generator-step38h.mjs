import assert from 'node:assert/strict';
import {
  GENERATOR_LIVE_TEST_PANEL_VERSION,
  collectGeneratorLiveDiagnostics,
  summarizeGeneratorLiveChain,
  buildGeneratorLivePanelView,
  readGeneratorLiveLocalDiagnostics,
  runGeneratorMasterSelfTest
} from '../public/runtime/generator_live_test_panel.js';

function makeStorage(values = {}) {
  const map = new Map(Object.entries(values));
  return {
    getItem(key) { return map.has(key) ? map.get(key) : null; },
    setItem(key, value) { map.set(key, String(value)); },
    removeItem(key) { map.delete(key); }
  };
}

function jsonResponse(payload, ok = true, status = 200) {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'ERR',
    async text() { return JSON.stringify(payload); }
  };
}

function makeFetch(fixtures = {}) {
  return async (endpoint, options = {}) => {
    const url = String(endpoint);
    if (options.method === 'POST' && url.includes('/api/artnet/master-mirror/self-test')) return jsonResponse({ ok: true, selfTest: true, frameId: 44 });
    if (url.includes('/api/artnet/master-mirror/status')) return jsonResponse(fixtures.master);
    if (url.includes('/api/artnet/master-bridge/monitor')) return jsonResponse(fixtures.monitor);
    if (url.includes('/api/artnet/sync-live/status')) return jsonResponse(fixtures.live);
    if (url.includes('/api/artnet/master-mirror/patch-report')) return jsonResponse(fixtures.patch);
    return jsonResponse({ ok: false, error: 'missing fixture' }, false, 404);
  };
}

const now = Date.now();
const storage = makeStorage({
  'budilight.generator.bridge.snapshot.v1': JSON.stringify({ active: true, serverSent: 8, publishedLocal: 8, serverErrors: 0, lastPublishAt: now, lastPatchName: 'Test Generator' }),
  'budilight.generator.live.lock.v1': JSON.stringify({ active: true, owner: 'generator-live-master-frame-source', at: now }),
  'budilight.generator.preview.heartbeat': JSON.stringify({ at: now, detail: { fps: 60 } }),
  'budilight.generator.showos.snapshot.v1': JSON.stringify({ ok: true, at: now, summary: { targetWorld: 'Alien Temple' } })
});

const fixtures = {
  master: {
    ok: true,
    hasFrame: true,
    fresh: true,
    hasPatch: true,
    ageMs: 30,
    latest: { source: 'generator-live-master-frame', frameId: 99, width: 300, height: 8, byteLength: 7200 },
    latestPatch: { routeCount: 16, source: 'safe-8x300' }
  },
  monitor: { ok: true, diagnosis: { source: 'master-framebus', socketReady: true, lastSent: true } },
  live: {
    ok: true,
    running: true,
    actualFps: 59.8,
    lastSummary: { frameSource: 'master-framebus' },
    lastSendResult: { sent: true },
    network: { socketReady: true, outputIp: '10.0.1.36', bindIp: '10.0.1.27', port: 6454 }
  },
  patch: { ok: true, report: { ok: true, hasPatch: true, routeCount: 16, summary: '8 strips · 16 route parts' } }
};

const local = readGeneratorLiveLocalDiagnostics(storage);
assert.equal(local.bridge.active, true);
assert.equal(local.showOsSnapshot.ok, true);

const diagnostics = await collectGeneratorLiveDiagnostics({ storage, fetchImpl: makeFetch(fixtures) });
assert.equal(diagnostics.version, GENERATOR_LIVE_TEST_PANEL_VERSION);
assert.equal(diagnostics.summary.stage, 'GREEN');
assert.equal(diagnostics.summary.ok, true);
assert.equal(diagnostics.summary.masterFromGenerator, true);
assert.equal(diagnostics.summary.lastSent, true);
assert.equal(diagnostics.summary.routeCount, 16);

const view = buildGeneratorLivePanelView(diagnostics);
assert.equal(view.headline, 'GREEN · OK');
assert.ok(view.rows.some((row) => row.id === 'sender' && row.ok === true));
assert.ok(view.rows.some((row) => row.id === 'patch' && row.value.includes('16')));

const readyOnly = summarizeGeneratorLiveChain({
  local: { bridge: { active: true, serverSent: 2, publishedLocal: 2, serverErrors: 0 }, lock: { active: true }, age: {} },
  server: { master: { ok: true, hasFrame: true, fresh: true, latest: { source: 'generator-live-master-frame' } }, live: { ok: true, running: false }, patch: { ok: true, report: { hasPatch: true, routeCount: 16 } } }
});
assert.equal(readyOnly.stage, 'READY_FOR_ARTNET');
assert.equal(readyOnly.ok, true);

const selfTest = await runGeneratorMasterSelfTest({ fetchImpl: makeFetch(fixtures), stripCount: 8, pixelsPerStrip: 300 });
assert.equal(selfTest.ok, true);
assert.equal(selfTest.selfTest, true);

console.log('PASS generator STEP38H live testing panel');
