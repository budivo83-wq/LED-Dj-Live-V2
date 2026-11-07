export const GENERATOR_LIVE_TEST_PANEL_VERSION = 'STEP38H_GENERATOR_LIVE_TEST_PANEL';

export const GENERATOR_LIVE_TEST_ENDPOINTS = Object.freeze({
  masterStatus: '/api/artnet/master-mirror/status',
  bridgeMonitor: '/api/artnet/master-bridge/monitor',
  liveStatus: '/api/artnet/sync-live/status',
  patchReport: '/api/artnet/master-mirror/patch-report',
  masterSelfTest: '/api/artnet/master-mirror/self-test'
});

export const GENERATOR_BRIDGE_SNAPSHOT_KEY = 'budilight.generator.bridge.snapshot.v1';
export const GENERATOR_LIVE_LOCK_KEY = 'budilight.generator.live.lock.v1';
export const GENERATOR_PREVIEW_HEARTBEAT_KEY = 'budilight.generator.preview.heartbeat';

function nowWall() {
  return Date.now();
}

function safeJsonParse(text, fallback = null) {
  try {
    if (!text) return fallback;
    const parsed = JSON.parse(text);
    return parsed == null ? fallback : parsed;
  } catch {
    return fallback;
  }
}

function readStorageJson(storage, key, fallback = null) {
  try { return safeJsonParse(storage?.getItem?.(key), fallback); } catch { return fallback; }
}

function ageMs(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.max(0, nowWall() - n);
}

function ageLabel(ms) {
  if (ms == null) return 'none';
  if (ms < 900) return `${ms} ms`;
  if (ms < 9000) return `${(ms / 1000).toFixed(1)} s`;
  return `${Math.round(ms / 1000)} s`;
}

function boolText(value) {
  return value ? 'ON' : 'OFF';
}

function numberText(value, suffix = '') {
  const n = Number(value);
  if (!Number.isFinite(n)) return '--';
  if (Math.abs(n) >= 100) return `${Math.round(n)}${suffix}`;
  return `${Number(n.toFixed(2))}${suffix}`;
}

function pick(value, fallback = '') {
  return value == null || value === '' ? fallback : value;
}

function statusFromFetchError(error) {
  return { ok: false, error: String(error?.message || error || 'fetch failed') };
}

export function readGeneratorLiveLocalDiagnostics(storage = globalThis.localStorage) {
  const bridge = readStorageJson(storage, GENERATOR_BRIDGE_SNAPSHOT_KEY, null);
  const lock = readStorageJson(storage, GENERATOR_LIVE_LOCK_KEY, null);
  const preview = readStorageJson(storage, GENERATOR_PREVIEW_HEARTBEAT_KEY, null);
  const bridgeAgeMs = ageMs(bridge?.lastPublishAt || bridge?.at);
  const lockAgeMs = ageMs(lock?.at);
  const previewAgeMs = ageMs(preview?.at);
  return Object.freeze({
    bridge,
    lock,
    preview,
    age: {
      bridgeMs: bridgeAgeMs,
      lockMs: lockAgeMs,
      previewMs: previewAgeMs,
      bridge: ageLabel(bridgeAgeMs),
      lock: ageLabel(lockAgeMs),
      preview: ageLabel(previewAgeMs),
    }
  });
}

export async function fetchGeneratorLiveJson(endpoint, fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== 'function') return { ok: false, skipped: true, error: 'fetch-unavailable' };
  try {
    const response = await fetchImpl(endpoint, { cache: 'no-store' });
    const text = typeof response.text === 'function' ? await response.text() : '';
    const json = safeJsonParse(text, null) || {};
    if (!response.ok) return { ok: false, status: response.status, error: json.error || response.statusText || `HTTP ${response.status}`, ...json };
    return { ok: true, ...json };
  } catch (error) {
    return statusFromFetchError(error);
  }
}

export async function collectGeneratorLiveDiagnostics(options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const endpoints = { ...GENERATOR_LIVE_TEST_ENDPOINTS, ...(options.endpoints || {}) };
  const local = readGeneratorLiveLocalDiagnostics(options.storage || globalThis.localStorage);
  const [master, monitor, live, patch] = await Promise.all([
    fetchGeneratorLiveJson(endpoints.masterStatus, fetchImpl),
    fetchGeneratorLiveJson(endpoints.bridgeMonitor, fetchImpl),
    fetchGeneratorLiveJson(endpoints.liveStatus, fetchImpl),
    fetchGeneratorLiveJson(endpoints.patchReport, fetchImpl)
  ]);
  const diagnostics = Object.freeze({
    version: GENERATOR_LIVE_TEST_PANEL_VERSION,
    at: nowWall(),
    local,
    server: { master, monitor, live, patch },
    endpoints
  });
  return Object.freeze({ ...diagnostics, summary: summarizeGeneratorLiveChain(diagnostics) });
}

export function summarizeGeneratorLiveChain(diagnostics = {}) {
  const local = diagnostics.local || {};
  const server = diagnostics.server || {};
  const bridge = local.bridge || {};
  const lock = local.lock || {};
  const preview = local.preview || {};
  const master = server.master || server.monitor?.master || {};
  const live = server.live || server.monitor?.live || {};
  const patch = server.patch || {};
  const monitorDiagnosis = server.monitor?.diagnosis || {};

  const previewFresh = local.age?.previewMs != null && local.age.previewMs <= 2500;
  const bridgeActive = bridge.active === true || lock.active === true;
  const bridgePublishing = bridgeActive && (Number(bridge.serverSent || 0) > 0 || Number(bridge.publishedLocal || 0) > 0);
  const masterFresh = master.fresh === true;
  const masterHasFrame = master.hasFrame === true;
  const masterSource = master.latest?.source || master.source || monitorDiagnosis.source || 'unknown';
  const masterFromGenerator = /generator/i.test(masterSource);
  const liveRunning = live.running === true;
  const liveMasterSource = /master-framebus|generator-live|master/i.test(String(live.lastSummary?.frameSource || live.lastSummary?.visualPattern || live.options?.visualPattern || live.sourcePolicy?.visualPattern || monitorDiagnosis.source || ''));
  const socketReady = live.network?.socketReady === true || monitorDiagnosis.socketReady === true;
  const lastSent = live.lastSendResult?.sent === true || monitorDiagnosis.lastSent === true;
  const hasPatch = Boolean(master.hasPatch || patch.report?.hasPatch || patch.report?.ok || patch.patch);
  const routeCount = Number(master.latestPatch?.routeCount || patch.report?.routeCount || 0) || 0;
  const actualFps = Number(live.actualFps || 0) || 0;
  const serverErrors = Number(bridge.serverErrors || 0) || 0;

  let stage = 'OFF';
  let ok = false;
  let verdict = 'Generator není v live řetězci aktivní.';
  let next = 'Zapni PREVIEW pro kontrolu obrazu, potom LIVE MASTER pro publikování do MASTER mirroru.';

  if (!previewFresh && !bridgeActive && !masterHasFrame && !liveRunning) {
    stage = 'IDLE';
    verdict = 'Žádný čerstvý Preview ani MASTER frame.';
  } else if (serverErrors > 0) {
    stage = 'GENERATOR_UPLOAD_ERROR';
    verdict = `Generator bridge hlásí chyby při uploadu do server MASTER mirroru (${serverErrors}).`;
    next = pick(bridge.lastError, 'Zkontroluj, jestli běží server a endpoint /api/artnet/master-mirror/frame-bin.');
  } else if (bridgeActive && !bridgePublishing) {
    stage = 'LIVE_ARMED_NO_FRAME';
    verdict = 'Generator LIVE MASTER je zapnutý, ale ještě neposlal platný frame.';
    next = 'Zkontroluj render FPS, velikost framu 300×8 a chyby v logu Generatoru.';
  } else if (bridgeActive && !masterFresh) {
    stage = masterHasFrame ? 'MASTER_STALE' : 'NO_MASTER_FRAME';
    verdict = masterHasFrame ? 'Server MASTER mirror má frame, ale není čerstvý.' : 'Generator posílá lokálně, ale server MASTER mirror zatím nemá frame.';
    next = 'Zkontroluj Browser → Server cestu a jestli není stránka Generatoru uspaná.';
  } else if (bridgeActive && masterFresh && !masterFromGenerator) {
    stage = 'MASTER_OTHER_SOURCE';
    ok = true;
    verdict = `MASTER mirror je čerstvý, ale zdroj není Generator (${masterSource}).`;
    next = 'Jestli testuješ Generator, znovu zapni LIVE MASTER. Pokud běží Performance, je to v pořádku.';
  } else if (bridgeActive && masterFresh && !liveRunning) {
    stage = 'READY_FOR_ARTNET';
    ok = true;
    verdict = 'Generator frame je čerstvý v MASTER mirroru. ArtNet sender ještě neběží.';
    next = 'V Settings spusť SAFE MASTER LIVE. Pak sleduj socket, FPS a UDP sent.';
  } else if (bridgeActive && masterFresh && liveRunning && !socketReady) {
    stage = 'ARTNET_SOCKET_WAIT';
    verdict = 'ArtNet sender běží, ale UDP socket není ready.';
    next = 'Zkontroluj Bind IP/síťovku a dej Prime socket v Settings.';
  } else if (bridgeActive && masterFresh && liveRunning && !liveMasterSource) {
    stage = 'ARTNET_WRONG_SOURCE';
    verdict = 'ArtNet sender běží, ale pravděpodobně nečte MASTER framebus.';
    next = 'V Settings přepni source na MASTER / performance-master-only a spusť SAFE MASTER LIVE znovu.';
  } else if (bridgeActive && masterFresh && liveRunning && socketReady && !lastSent) {
    stage = 'ARTNET_NOT_SENT';
    verdict = 'ArtNet sender má socket, ale poslední frame nebyl odeslán.';
    next = pick(live.lastSendResult?.reason || monitorDiagnosis.lastReason, 'Zkontroluj target IP, route patch a sender log.');
  } else if (bridgeActive && masterFresh && liveRunning && socketReady && lastSent) {
    stage = 'GREEN';
    ok = true;
    verdict = `Generator → MASTER mirror → ArtNet sender běží. Aktuální fyzický FPS: ${numberText(actualFps)}.`;
    next = 'Když LED nesvítí, problém už bude nejspíš mimo Generator: IP, port, universe, node mapping, kabel nebo napájení.';
  } else if (previewFresh && !bridgeActive) {
    stage = 'PREVIEW_ONLY';
    ok = true;
    verdict = 'Generator preview běží, fyzický výstup není přebraný.';
    next = 'Pro fyzický test zapni LIVE MASTER a pak SAFE MASTER LIVE v Settings.';
  }

  return Object.freeze({
    ok,
    stage,
    verdict,
    next,
    previewFresh,
    bridgeActive,
    bridgePublishing,
    masterFresh,
    masterHasFrame,
    masterSource,
    masterFromGenerator,
    liveRunning,
    liveMasterSource,
    socketReady,
    lastSent,
    hasPatch,
    routeCount,
    actualFps,
    target: live.network?.outputIp || live.options?.outputIp || live.options?.host || '',
    port: live.network?.port || live.options?.port || 6454,
    bindIp: live.network?.bindIp || live.options?.bindIp || '',
    serverErrors,
    ages: { ...(local.age || {}), master: ageLabel(master.ageMs), patch: ageLabel(master.patchAgeMs) }
  });
}

export function buildGeneratorLivePanelRows(diagnostics = {}) {
  const s = diagnostics.summary || summarizeGeneratorLiveChain(diagnostics);
  const local = diagnostics.local || {};
  const server = diagnostics.server || {};
  const bridge = local.bridge || {};
  const master = server.master || server.monitor?.master || {};
  const live = server.live || server.monitor?.live || {};
  const patch = server.patch || {};
  return [
    { id: 'preview', label: 'Generator Preview', ok: s.previewFresh || s.bridgeActive, value: s.bridgeActive ? 'live armed' : (s.previewFresh ? 'preview fresh' : 'idle'), detail: `age ${s.ages?.preview || 'none'}` },
    { id: 'bridge', label: 'Live Master Bridge', ok: s.bridgePublishing || s.bridgeActive, value: s.bridgeActive ? boolText(true) : boolText(false), detail: `${Number(bridge.serverSent || 0)} server · ${Number(bridge.publishedLocal || 0)} local · err ${Number(bridge.serverErrors || 0)}` },
    { id: 'master', label: 'MASTER Mirror', ok: s.masterFresh, value: s.masterFresh ? 'fresh' : (s.masterHasFrame ? 'stale' : 'empty'), detail: `${pick(s.masterSource, 'unknown')} · age ${s.ages?.master || 'none'}` },
    { id: 'patch', label: 'ArtNet Patch', ok: s.hasPatch, value: s.hasPatch ? `${s.routeCount || patch.report?.routeCount || master.latestPatch?.routeCount || 0} routes` : 'no patch', detail: patch.report?.summary || master.latestPatch?.source || 'publish Mapping/Settings patch first' },
    { id: 'sender', label: 'ArtNet Sender', ok: s.liveRunning && s.socketReady, value: s.liveRunning ? `RUN ${numberText(s.actualFps)} fps` : 'stopped', detail: `${pick(s.bindIp, 'auto')} → ${pick(s.target, 'target?')}:${pick(s.port, 6454)}` },
    { id: 'udp', label: 'UDP Result', ok: s.lastSent, value: s.lastSent ? 'sent' : 'not sent', detail: live.lastSendResult?.reason || live.lastError || 'waiting for live sender' }
  ];
}

export function buildGeneratorLivePanelView(diagnostics = {}) {
  const summary = diagnostics.summary || summarizeGeneratorLiveChain(diagnostics);
  return Object.freeze({
    version: GENERATOR_LIVE_TEST_PANEL_VERSION,
    summary,
    rows: buildGeneratorLivePanelRows({ ...diagnostics, summary }),
    headline: `${summary.stage}${summary.ok ? ' · OK' : ''}`,
    verdict: summary.verdict,
    next: summary.next
  });
}

export async function runGeneratorMasterSelfTest(options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const endpoint = options.endpoint || GENERATOR_LIVE_TEST_ENDPOINTS.masterSelfTest;
  if (typeof fetchImpl !== 'function') return { ok: false, error: 'fetch-unavailable' };
  const body = {
    stripCount: Number(options.stripCount || 8) || 8,
    pixelsPerStrip: Number(options.pixelsPerStrip || 300) || 300,
    frameId: Number(options.frameId || Math.floor(Date.now() / 1000)) || 1
  };
  try {
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify(body)
    });
    const text = typeof response.text === 'function' ? await response.text() : '';
    const json = safeJsonParse(text, {}) || {};
    if (!response.ok) return { ok: false, status: response.status, error: json.error || response.statusText || `HTTP ${response.status}`, ...json };
    return { ok: true, ...json };
  } catch (error) {
    return statusFromFetchError(error);
  }
}
