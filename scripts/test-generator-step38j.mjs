import assert from 'node:assert/strict';
import {
  GENERATOR_OUTPUT_TRUTH_PANEL_VERSION,
  normalizeGeneratorOutputTruth,
  buildGeneratorOutputTruthView,
  buildGeneratorOutputTruthHints,
  buildGeneratorOutputTruthRouteRows,
  formatGeneratorOutputTruthText
} from '../public/runtime/generator_output_truth_panel.js';

const now = Date.now();
const greenDiagnostics = {
  local: {
    bridge: { active: true, serverSent: 12, publishedLocal: 12, serverErrors: 0, lastPublishAt: now, lastFrameBusId: 77 },
    lock: { active: true },
    age: { showOs: '500 ms', preview: '220 ms', bridgeMs: 80 }
  },
  server: {
    master: {
      ok: true,
      hasFrame: true,
      fresh: true,
      ageMs: 24,
      latest: { source: 'generator-live-master-frame', frameId: 101, width: 300, height: 8, byteLength: 7200 },
      latestPatch: { routeCount: 16, source: 'safe-8x300' }
    },
    monitor: { ok: true, diagnosis: { source: 'master-framebus', socketReady: true, lastSent: true } },
    live: {
      ok: true,
      running: true,
      armed: true,
      actualFps: 59.7,
      generatedFps: 60,
      sentFrameCount: 120,
      skippedFrameCount: 1,
      packetCount: 1920,
      byteCount: 1040000,
      lastSendAt: now - 33,
      lastSummary: { frameSource: 'master-framebus' },
      sourcePolicy: { sourceMode: 'performance-master-only', visualPattern: 'master-framebus' },
      lastSendResult: { sent: true, reason: 'ok' },
      network: { socketReady: true, outputIp: '10.0.1.36', bindIp: '10.0.1.27', port: 6454, targetMode: 'unicast', socketBindIp: '10.0.1.27' }
    },
    patch: {
      ok: true,
      patch: { source: 'safe-8x300', width: 300, height: 8, totalPixels: 2400, publishedAt: now - 5000 },
      report: {
        ok: true,
        hasPatch: true,
        width: 300,
        height: 8,
        routeCount: 16,
        summary: '8 strips · 16 universes · 16 route parts',
        strips: [
          { stripIndex: 0, pixels: 300, universes: 'U0:0-169 | U1:0-129', summary: 'S0 · 300px · U0:0-169 | U1:0-129' }
        ],
        universes: [
          { universe: 0, pixels: 170, stripCount: 1, strips: [0], target: '10.0.1.36', targetPort: 6454, ranges: 'S0:0-169', summary: '10.0.1.36:6454 · U0 · 170px · strips 0 · S0:0-169' },
          { universe: 1, pixels: 130, stripCount: 1, strips: [0], target: '10.0.1.36', targetPort: 6454, ranges: 'S0:0-129', summary: '10.0.1.36:6454 · U1 · 130px · strips 0 · S0:0-129' }
        ]
      }
    }
  },
  summary: {
    ok: true,
    stage: 'GREEN',
    verdict: 'Generator → MASTER mirror → ArtNet sender běží.',
    next: 'Když LED nesvítí, problém je mimo Generator.',
    masterFresh: true,
    masterHasFrame: true,
    masterSource: 'generator-live-master-frame',
    masterFromGenerator: true,
    liveRunning: true,
    liveMasterSource: true,
    socketReady: true,
    lastSent: true,
    hasPatch: true,
    routeCount: 16,
    actualFps: 59.7,
    target: '10.0.1.36',
    port: 6454,
    bindIp: '10.0.1.27',
    ages: { showOs: '500 ms', preview: '220 ms', master: '24 ms' }
  }
};

const truth = normalizeGeneratorOutputTruth(greenDiagnostics);
assert.equal(truth.version, GENERATOR_OUTPUT_TRUTH_PANEL_VERSION);
assert.equal(truth.green, true);
assert.equal(truth.network.portStandard, true);
assert.equal(truth.network.bindIp, '10.0.1.27');
assert.equal(truth.routes.routeCount, 16);
assert.equal(truth.routes.universeCount, 2);
assert.equal(truth.source.masterFromGenerator, true);

const view = buildGeneratorOutputTruthView(greenDiagnostics);
assert.equal(view.headline, 'OUTPUT GREEN');
assert.ok(view.cards.some((card) => card.id === 'network' && card.ok === true));
assert.ok(view.cards.some((card) => card.id === 'udp' && card.value === 'SENT'));
assert.equal(buildGeneratorOutputTruthRouteRows(greenDiagnostics).length, 2);
assert.ok(buildGeneratorOutputTruthHints(greenDiagnostics).some((hint) => hint.level === 'ok'));
assert.match(formatGeneratorOutputTruthText(greenDiagnostics), /NETWORK: bind 10\.0\.1\.27 -> 10\.0\.1\.36:6454/);

const blockedDiagnostics = {
  server: {
    master: { ok: true, hasFrame: true, fresh: false, ageMs: 7000, latest: { source: 'generator-live-master-frame' } },
    live: {
      ok: true,
      running: true,
      actualFps: 0,
      lastSummary: { frameSource: 'fallback-test' },
      lastSendResult: { sent: false, reason: 'socket-not-ready' },
      network: { socketReady: false, outputIp: '', bindIp: '', port: 4048 }
    },
    patch: { ok: true, report: { ok: false, hasPatch: false, routeCount: 0, summary: 'No Art-Net patch published on server yet.' } }
  },
  summary: {
    ok: false,
    stage: 'ARTNET_SOCKET_WAIT',
    verdict: 'ArtNet sender běží, ale UDP socket není ready.',
    next: 'Zkontroluj Bind IP/síťovku.',
    masterFresh: false,
    masterHasFrame: true,
    masterSource: 'generator-live-master-frame',
    masterFromGenerator: true,
    liveRunning: true,
    socketReady: false,
    lastSent: false,
    hasPatch: false,
    routeCount: 0,
    actualFps: 0,
    target: '',
    port: 4048,
    bindIp: '',
    ages: { master: '7.0 s' }
  }
};
const blocked = normalizeGeneratorOutputTruth(blockedDiagnostics);
assert.equal(blocked.green, false);
assert.equal(blocked.network.portStandard, false);
assert.equal(blocked.patch.hasPatch, false);
const hints = buildGeneratorOutputTruthHints(blockedDiagnostics).map((hint) => hint.text).join('\n');
assert.match(hints, /ArtNet patch není publikovaný/);
assert.match(hints, /Port je 4048/);
assert.match(hints, /UDP socket není ready/);
assert.match(formatGeneratorOutputTruthText(blockedDiagnostics), /PATCH: NO PATCH/);

console.log('PASS generator STEP38J output truth merge');
