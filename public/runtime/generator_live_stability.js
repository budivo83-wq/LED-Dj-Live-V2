export const GENERATOR_LIVE_STABILITY_VERSION = 'STEP38N_GENERATOR_LIVE_STABILITY_PASS';

const GENERATOR_SOURCE_RE = /generator-live-master|generator-live|generator/i;
const PERFORMANCE_SOURCE_RE = /performance-framebus|performance-master|browser-master|render-pipeline|output-owned-render|artnet-master-framebus/i;
const GENERATOR_LOCK_TTL_MS = 3500;

function nowWall() { return Date.now(); }
function nowPerf() { try { return performance.now(); } catch { return Date.now(); } }
function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}
function ageMs(value, now = nowWall()) {
  const n = Number(value || 0);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.max(0, now - n);
}
function isGeneratorSource(value = '') { return GENERATOR_SOURCE_RE.test(String(value || '').toLowerCase()); }
function isPerformanceSource(value = '') { return PERFORMANCE_SOURCE_RE.test(String(value || '').toLowerCase()); }
function numberText(value, suffix = '') {
  const n = Number(value);
  if (!Number.isFinite(n)) return '--';
  if (Math.abs(n) >= 100) return `${Math.round(n)}${suffix}`;
  return `${Number(n.toFixed(2))}${suffix}`;
}
function fpsText(value) { return Number.isFinite(Number(value)) && Number(value) > 0 ? `${Number(value).toFixed(Number(value) < 10 ? 1 : 0)} FPS` : '--'; }
function msText(value) { return Number.isFinite(Number(value)) ? `${Math.round(Number(value))} ms` : '--'; }
function boolText(value) { return value ? 'OK' : 'NO'; }
function pick(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return '';
}
function ema(previous, value, alpha = 0.18) {
  const n = Number(value);
  if (!Number.isFinite(n)) return Number(previous || 0);
  const p = Number(previous || 0);
  if (!Number.isFinite(p) || p <= 0) return n;
  return p * (1 - alpha) + n * alpha;
}

export function createGeneratorLiveStabilityRuntime() {
  return {
    version: GENERATOR_LIVE_STABILITY_VERSION,
    startedAt: nowPerf(),
    lastFrameId: 0,
    lastServerSent: 0,
    lastFrameChangedAt: 0,
    lastUpdateAt: 0,
    generatorPublishFps: 0,
    serverUploadFps: 0,
    lastFrameGapMs: 0,
    maxFrameGapMs: 0,
    staleFrames: 0,
    continuityWarnings: 0,
    lastWarning: '',
    lastMode: 'off'
  };
}

export function readGeneratorPerformanceMirrorState(root = globalThis) {
  const candidates = [];
  try { candidates.push(root?.__budilightArtNetMasterMirror22EJ); } catch {}
  try { if (root?.parent && root.parent !== root) candidates.push(root.parent.__budilightArtNetMasterMirror22EJ); } catch {}
  try { if (root?.top && root.top !== root) candidates.push(root.top.__budilightArtNetMasterMirror22EJ); } catch {}
  const state = candidates.find((item) => item && typeof item === 'object') || null;
  if (!state) return null;
  return {
    enabled: state.enabled === true,
    fps: Number(state.fps || 0) || 0,
    sent: Number(state.sent || 0) || 0,
    skipped: Number(state.skipped || 0) || 0,
    actualFps: Number(state.actualFps || 0) || 0,
    lastSkipReason: String(state.lastSkipReason || ''),
    generatorLiveSuppressed38L: Number(state.generatorLiveSuppressed38L || 0) || 0,
    generatorLiveLockAgeMs38L: Number(state.generatorLiveLockAgeMs38L || 0) || 0,
    generatorLiveLockOwner38L: String(state.generatorLiveLockOwner38L || ''),
    lastSuppressedSource: String(state.lastSuppressedSource || ''),
    lastError: String(state.lastError || '')
  };
}

export function updateGeneratorLiveStability(runtime = createGeneratorLiveStabilityRuntime(), input = {}) {
  const perfNow = clampNumber(input.nowPerf, 0, Number.MAX_SAFE_INTEGER, nowPerf());
  const bridge = input.bridge || input.diagnostics?.local?.bridge || {};
  const mode = String(input.mode || '').toLowerCase();
  const frameId = Number(bridge.frameId || 0) || 0;
  const serverSent = Number(bridge.serverSent || 0) || 0;

  if (runtime.lastUpdateAt > 0 && perfNow >= runtime.lastUpdateAt) {
    const dtSec = Math.max(0.001, (perfNow - runtime.lastUpdateAt) / 1000);
    const frameDelta = Math.max(0, frameId - Number(runtime.lastFrameId || 0));
    const serverDelta = Math.max(0, serverSent - Number(runtime.lastServerSent || 0));
    if (frameDelta > 0) runtime.generatorPublishFps = ema(runtime.generatorPublishFps, frameDelta / dtSec, 0.16);
    if (serverDelta > 0) runtime.serverUploadFps = ema(runtime.serverUploadFps, serverDelta / dtSec, 0.16);
  }

  if (frameId > 0 && frameId !== Number(runtime.lastFrameId || 0)) {
    const gap = runtime.lastFrameChangedAt > 0 ? Math.max(0, perfNow - runtime.lastFrameChangedAt) : 0;
    runtime.lastFrameGapMs = gap;
    runtime.maxFrameGapMs = Math.max(Number(runtime.maxFrameGapMs || 0), gap);
    runtime.lastFrameChangedAt = perfNow;
  } else if (mode === 'live' && frameId > 0 && runtime.lastFrameChangedAt > 0) {
    const stale = perfNow - runtime.lastFrameChangedAt;
    const targetFps = clampNumber(input.targetFps || bridge.fps, 1, 60, 60);
    const warnAfter = Math.max(450, (1000 / targetFps) * 8);
    if (stale > warnAfter) {
      runtime.staleFrames += 1;
      runtime.continuityWarnings += 1;
      runtime.lastWarning = `Generator frameId ${frameId} stojí ${Math.round(stale)} ms`;
    }
  }

  runtime.lastMode = mode || runtime.lastMode || 'off';
  runtime.lastFrameId = frameId;
  runtime.lastServerSent = serverSent;
  runtime.lastUpdateAt = perfNow;
  return runtime;
}

export function analyzeGeneratorLiveStability(input = {}) {
  const runtime = input.runtime || createGeneratorLiveStabilityRuntime();
  const diagnostics = input.diagnostics || {};
  const local = diagnostics.local || {};
  const server = diagnostics.server || {};
  const bridge = input.bridge || local.bridge || {};
  const lock = input.lock || local.lock || {};
  const master = server.master || server.monitor?.master || {};
  const live = server.live || server.monitor?.live || {};
  const patch = server.patch || {};
  const mirror = input.performanceMirror || null;
  const wallNow = clampNumber(input.nowWall, 0, Number.MAX_SAFE_INTEGER, nowWall());
  const mode = String(input.mode || '').toLowerCase();
  const targetFps = clampNumber(input.targetFps || bridge.fps || live.options?.fps || live.fps, 1, 60, 60);
  const lockAge = ageMs(lock.at, wallNow);
  const lockFresh = lock.active === true && lockAge != null && lockAge <= GENERATOR_LOCK_TTL_MS;
  const bridgeActive = bridge.active === true || lockFresh;
  const masterSource = String(pick(master.latest?.source, master.source, server.monitor?.diagnosis?.source, ''));
  const masterFromGenerator = isGeneratorSource(masterSource);
  const masterFromPerformance = isPerformanceSource(masterSource);
  const masterFresh = master.fresh === true || (Number(master.ageMs || 999999) <= 1500 && Boolean(master.latest));
  const liveRunning = live.running === true;
  const socketReady = live.network?.socketReady === true || server.monitor?.diagnosis?.socketReady === true;
  const lastSent = live.lastSendResult?.sent === true || server.monitor?.diagnosis?.lastSent === true;
  const artnetFps = clampNumber(pick(live.actualFps, live.fpsActual, server.monitor?.diagnosis?.actualFps), 0, 1000, 0);
  const routeCount = clampNumber(pick(master.latestPatch?.routeCount, patch.report?.routeCount), 0, 99999, 0);
  const arbitrationDrops = clampNumber(master.arbitrationDropCount38L, 0, 99999999, 0);
  const lastDropReason = String(master.lastArbitrationDrop38L?.reason || '');
  const mirrorMuted = Boolean(mirror && (
    /generator-live-master-owner-active-38l/.test(mirror.lastSkipReason)
    || Number(mirror.generatorLiveSuppressed38L || 0) > 0
  ));
  const serverMuted = /generator-live-master-owner-active-38l/.test(lastDropReason) || arbitrationDrops > 0;
  const performanceMuted = !bridgeActive ? false : (mirrorMuted || serverMuted || (masterFromGenerator && !masterFromPerformance));
  const generatorPublishFps = clampNumber(runtime.generatorPublishFps, 0, 1000, 0);
  const serverUploadFps = clampNumber(runtime.serverUploadFps || bridge.avgServerFps, 0, 1000, 0);
  const lastFrameGapMs = clampNumber(pick(bridge.lastFrameGapMs, runtime.lastFrameGapMs), 0, 999999, 0);
  const staleFrameMs = runtime.lastFrameChangedAt > 0 ? Math.max(0, clampNumber(input.nowPerf, 0, Number.MAX_SAFE_INTEGER, nowPerf()) - runtime.lastFrameChangedAt) : null;
  const expectedGap = 1000 / targetFps;
  const lowGeneratorFps = bridgeActive && generatorPublishFps > 0 && generatorPublishFps < targetFps * 0.72;
  const lowArtNetFps = bridgeActive && liveRunning && artnetFps > 0 && artnetFps < targetFps * 0.72;
  const staleGenerator = bridgeActive && staleFrameMs != null && staleFrameMs > Math.max(650, expectedGap * 10);
  const serverErrors = Number(bridge.serverErrors || 0) || 0;

  let state = 'STANDBY';
  let ok = true;
  let headline = 'STABILITY STANDBY';
  let verdict = 'Generator není v LIVE MASTER režimu.';
  let next = 'Zapni LIVE MASTER pro takeover kontrolu.';
  const hints = [];

  if (!bridgeActive) {
    hints.push({ level: 'ok', text: 'Generator lock není aktivní, Performance může normálně vlastnit výstup.' });
  } else if (serverErrors > 0) {
    ok = false;
    state = 'SERVER_UPLOAD_ERRORS';
    headline = 'UPLOAD ERROR';
    verdict = `Generator má ${serverErrors} chyb uploadu do MASTER mirroru.`;
    next = String(bridge.lastError || 'Zkontroluj server endpoint /api/artnet/master-mirror/frame-bin.');
  } else if (staleGenerator) {
    ok = false;
    state = 'GENERATOR_STALLED';
    headline = 'GENERATOR STALE';
    verdict = `Generator LIVE lock je aktivní, ale frame se neposunul ${Math.round(staleFrameMs)} ms.`;
    next = 'Zkontroluj, jestli není stránka Generatoru uspaná nebo blokovaná renderem.';
  } else if (!performanceMuted) {
    ok = false;
    state = 'PERFORMANCE_NOT_CONFIRMED_MUTED';
    headline = 'PERFORMANCE WATCH';
    verdict = 'Generator LIVE běží, ale ještě nemám potvrzené, že Performance master mirror je potlačený.';
    next = 'Sleduj MASTER source. Pokud zdroj přeskakuje na performance-framebus, takeover lock nefunguje správně.';
  } else if (!masterFresh || !masterFromGenerator) {
    ok = false;
    state = masterFresh ? 'MASTER_SOURCE_NOT_GENERATOR' : 'MASTER_NOT_FRESH';
    headline = masterFresh ? 'MASTER SOURCE' : 'MASTER STALE';
    verdict = masterFresh ? `MASTER mirror není z Generatoru (${masterSource || 'unknown'}).` : 'MASTER mirror nemá čerstvý generator frame.';
    next = 'Zkontroluj Generator bridge a server MASTER mirror.';
  } else if (lowGeneratorFps) {
    ok = false;
    state = 'LOW_GENERATOR_PUBLISH_FPS';
    headline = 'LOW GEN FPS';
    verdict = `Generator publikuje jen ${fpsText(generatorPublishFps)} proti cíli ${fpsText(targetFps)}.`;
    next = 'Sniž náročnost patchů, vypni field test nebo zkontroluj render ms.';
  } else if (lowArtNetFps) {
    ok = false;
    state = 'LOW_ARTNET_FPS';
    headline = 'LOW ARTNET FPS';
    verdict = `Generator dodává frame, ale ArtNet sender posílá jen ${fpsText(artnetFps)} proti cíli ${fpsText(targetFps)}.`;
    next = 'Hledej bottleneck v ArtNet senderu, síťovce nebo počtu rout.';
  } else if (bridgeActive && masterFresh && masterFromGenerator) {
    state = liveRunning && socketReady && lastSent ? 'GREEN_OUTPUT' : 'GENERATOR_OWNS_MASTER';
    headline = state === 'GREEN_OUTPUT' ? 'GREEN OUTPUT' : 'GENERATOR OWNS';
    verdict = state === 'GREEN_OUTPUT'
      ? `Generator vlastní MASTER a ArtNet posílá. Cíl ${fpsText(targetFps)}, ArtNet ${fpsText(artnetFps)}.`
      : 'Generator vlastní MASTER mirror. ArtNet sender ještě nemusí být plně odesílající.';
    next = state === 'GREEN_OUTPUT'
      ? 'Stabilita řetězce je zelená.'
      : 'Pro fyzický výstup ověř SAFE MASTER LIVE, socket ready a poslední UDP sent.';
  }

  if (bridgeActive) {
    if (performanceMuted) hints.push({ level: 'ok', text: 'Performance output je potlačený nebo MASTER source zůstává na Generatoru.' });
    else hints.push({ level: 'bad', text: 'Performance mute není potvrzený. Sleduj případné problikávání Performance framu.' });
    if (masterFromGenerator && masterFresh) hints.push({ level: 'ok', text: 'Server MASTER mirror má čerstvý Generator frame.' });
    else hints.push({ level: 'bad', text: 'Server MASTER mirror zatím nepotvrzuje čerstvý Generator frame.' });
    if (liveRunning) hints.push({ level: socketReady ? 'ok' : 'warn', text: socketReady ? 'ArtNet sender běží a socket je ready.' : 'ArtNet sender běží, ale socket ještě není ready.' });
    else hints.push({ level: 'warn', text: 'ArtNet sender neběží. Generator může vlastnit MASTER, ale LED nemusí dostávat UDP.' });
    if (lastFrameGapMs > expectedGap * 5 && generatorPublishFps > 0) hints.push({ level: 'warn', text: `Poslední mezera mezi generator framy byla ${msText(lastFrameGapMs)}.` });
  }

  const cards = [
    { label: 'Owner lock', value: bridgeActive ? 'GENERATOR' : 'released', detail: lockFresh ? `fresh ${msText(lockAge)}` : `lock ${lock.active ? 'stale' : 'off'}`, ok: bridgeActive ? lockFresh : true },
    { label: 'Performance', value: bridgeActive ? (performanceMuted ? 'MUTED' : 'WATCH') : 'allowed', detail: mirror ? `${mirror.lastSkipReason || 'mirror seen'} · suppressed ${mirror.generatorLiveSuppressed38L || 0}` : (serverMuted ? `server drops ${arbitrationDrops}` : 'no mirror stats'), ok: !bridgeActive || performanceMuted },
    { label: 'Generator publish', value: fpsText(generatorPublishFps), detail: `target ${fpsText(targetFps)} · gap ${msText(lastFrameGapMs)}`, ok: !bridgeActive || !lowGeneratorFps },
    { label: 'Server upload', value: fpsText(serverUploadFps), detail: `${bridge.serverSent || 0} sent / ${serverErrors} err`, ok: serverErrors <= 0 },
    { label: 'MASTER source', value: masterSource || '--', detail: masterFresh ? `fresh · frame #${master.latest?.frameId || '--'}` : `age ${msText(master.ageMs)}`, ok: !bridgeActive || (masterFresh && masterFromGenerator) },
    { label: 'ArtNet sender', value: liveRunning ? fpsText(artnetFps) : 'OFF', detail: `socket ${boolText(socketReady)} · UDP ${boolText(lastSent)} · routes ${routeCount}`, ok: !bridgeActive || !liveRunning || (!lowArtNetFps && socketReady) }
  ];

  return Object.freeze({
    version: GENERATOR_LIVE_STABILITY_VERSION,
    ok,
    state,
    headline,
    verdict,
    next,
    bridgeActive,
    performanceMuted,
    masterFromGenerator,
    masterFromPerformance,
    masterFresh,
    liveRunning,
    socketReady,
    lastSent,
    targetFps,
    generatorPublishFps,
    serverUploadFps,
    artnetFps,
    lastFrameGapMs,
    staleFrameMs,
    routeCount,
    cards: Object.freeze(cards),
    hints: Object.freeze(hints)
  });
}

export function buildGeneratorLiveStabilityView(input = {}) {
  const runtime = updateGeneratorLiveStability(input.runtime || createGeneratorLiveStabilityRuntime(), input);
  const analysis = analyzeGeneratorLiveStability({ ...input, runtime });
  return Object.freeze({ runtime, analysis });
}

export function formatGeneratorLiveStabilityReport(view = {}) {
  const analysis = view.analysis || view;
  const cards = Array.isArray(analysis.cards) ? analysis.cards : [];
  const hints = Array.isArray(analysis.hints) ? analysis.hints : [];
  return [
    `Generator Live Stability · ${analysis.state || 'UNKNOWN'} · ${analysis.ok ? 'OK' : 'WATCH'}`,
    `Verdict: ${analysis.verdict || '--'}`,
    `Next: ${analysis.next || '--'}`,
    '',
    ...cards.map((card) => `${card.label}: ${card.value} · ${card.detail}`),
    '',
    ...hints.map((hint) => `- ${hint.level || 'info'}: ${hint.text}`)
  ].join('\n');
}
