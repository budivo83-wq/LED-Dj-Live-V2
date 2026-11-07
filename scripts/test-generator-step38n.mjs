import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  GENERATOR_LIVE_STABILITY_VERSION,
  createGeneratorLiveStabilityRuntime,
  buildGeneratorLiveStabilityView,
  formatGeneratorLiveStabilityReport,
  analyzeGeneratorLiveStability
} from '../public/runtime/generator_live_stability.js';

assert.equal(GENERATOR_LIVE_STABILITY_VERSION, 'STEP38N_GENERATOR_LIVE_STABILITY_PASS');

const nowWall = 1_800_000_000_000;
let runtime = createGeneratorLiveStabilityRuntime();
let view = buildGeneratorLiveStabilityView({
  runtime,
  mode: 'live',
  targetFps: 60,
  nowWall,
  nowPerf: 1000,
  bridge: { active: true, fps: 60, frameId: 1, serverSent: 1, serverErrors: 0, lastFrameGapMs: 16.7 },
  diagnostics: {
    local: { lock: { active: true, owner: 'generator-live-master-frame-source', at: nowWall - 20 } },
    server: {
      master: { ok: true, hasFrame: true, fresh: true, ageMs: 20, arbitrationDropCount38L: 2, latest: { source: 'generator-live-master-frame', frameId: 1 }, latestPatch: { routeCount: 16 } },
      live: { ok: true, running: true, actualFps: 59.3, network: { socketReady: true }, lastSendResult: { sent: true } },
      patch: { ok: true, report: { routeCount: 16 } }
    }
  },
  performanceMirror: { lastSkipReason: 'generator-live-master-owner-active-38l', generatorLiveSuppressed38L: 9 }
});
runtime = view.runtime;
view = buildGeneratorLiveStabilityView({
  runtime,
  mode: 'live',
  targetFps: 60,
  nowWall: nowWall + 1000,
  nowPerf: 2000,
  bridge: { active: true, fps: 60, frameId: 61, serverSent: 61, serverErrors: 0, lastFrameGapMs: 16.6 },
  diagnostics: {
    local: { lock: { active: true, owner: 'generator-live-master-frame-source', at: nowWall + 990 } },
    server: {
      master: { ok: true, hasFrame: true, fresh: true, ageMs: 18, arbitrationDropCount38L: 2, latest: { source: 'generator-live-master-frame', frameId: 61 }, latestPatch: { routeCount: 16 } },
      live: { ok: true, running: true, actualFps: 59.8, network: { socketReady: true }, lastSendResult: { sent: true } },
      patch: { ok: true, report: { routeCount: 16 } }
    }
  },
  performanceMirror: { lastSkipReason: 'generator-live-master-owner-active-38l', generatorLiveSuppressed38L: 12 }
});
assert.equal(view.analysis.state, 'GREEN_OUTPUT', 'stable generator takeover should be green when master/source/sender are aligned');
assert.equal(view.analysis.performanceMuted, true, 'performance mirror suppression must be visible in stability analysis');
assert.ok(view.analysis.generatorPublishFps > 40, 'runtime continuity should estimate generator publish FPS');
assert.ok(formatGeneratorLiveStabilityReport(view).includes('Generator Live Stability'), 'stability report should be copyable');

const fight = analyzeGeneratorLiveStability({
  runtime: view.runtime,
  mode: 'live',
  targetFps: 60,
  nowWall: nowWall + 1200,
  nowPerf: 2200,
  bridge: { active: true, fps: 60, frameId: 70, serverSent: 70, serverErrors: 0 },
  diagnostics: {
    local: { lock: { active: true, at: nowWall + 1190 } },
    server: { master: { ok: true, fresh: true, latest: { source: 'performance-framebus-artnet-master', frameId: 70 } }, live: { running: true, actualFps: 60, network: { socketReady: true }, lastSendResult: { sent: true } } }
  },
  performanceMirror: { lastSkipReason: '', generatorLiveSuppressed38L: 0 }
});
assert.equal(fight.ok, false, 'performance source should not be accepted while generator live is active');
assert.equal(fight.state, 'PERFORMANCE_NOT_CONFIRMED_MUTED');

const lowFps = analyzeGeneratorLiveStability({
  runtime: { ...view.runtime, generatorPublishFps: 18, lastFrameChangedAt: 2100 },
  mode: 'live',
  targetFps: 60,
  nowWall: nowWall + 1300,
  nowPerf: 2300,
  bridge: { active: true, fps: 60, frameId: 72, serverSent: 72, serverErrors: 0 },
  diagnostics: { local: { lock: { active: true, at: nowWall + 1290 } }, server: { master: { ok: true, fresh: true, latest: { source: 'generator-live-master-frame' }, arbitrationDropCount38L: 1 }, live: { running: true, actualFps: 58, network: { socketReady: true }, lastSendResult: { sent: true } } } },
  performanceMirror: { lastSkipReason: 'generator-live-master-owner-active-38l', generatorLiveSuppressed38L: 1 }
});
assert.equal(lowFps.state, 'LOW_GENERATOR_PUBLISH_FPS', 'low generator FPS must be diagnosed before blaming ArtNet');

const generatorJs = readFileSync(join(process.cwd(), 'public/generator.js'), 'utf8');
const generatorHtml = readFileSync(join(process.cwd(), 'public/generator.html'), 'utf8');
assert.ok(generatorJs.includes('GENERATOR_LIVE_STABILITY_VERSION'), 'generator page must import stability runtime');
assert.ok(generatorJs.includes('renderLiveStabilityPanel'), 'generator page must render stability panel');
assert.ok(generatorHtml.includes('generatorStabilityBadge'), 'generator page must expose stability badge');
assert.ok(generatorHtml.includes('Live Stability Watchdog'), 'generator page must include watchdog panel');

console.log('PASS generator STEP38N live stability guard');
