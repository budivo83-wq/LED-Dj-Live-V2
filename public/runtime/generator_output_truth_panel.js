import { freezeUniqueList } from "./list_utils.js";
import { summarizeGeneratorLiveChain } from './generator_live_test_panel.js';

export const GENERATOR_OUTPUT_TRUTH_PANEL_VERSION = 'STEP38J_GENERATOR_OUTPUT_TRUTH_MERGE';
export const ARTNET_STANDARD_PORT_STEP38J = 6454;

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function safeString(value, fallback = '') {
  const text = value == null ? '' : String(value).trim();
  return text || fallback;
}

function boolText(value) {
  return value ? 'ON' : 'OFF';
}

function ageText(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n) || n < 0) return 'none';
  if (n < 1000) return `${Math.round(n)} ms`;
  if (n < 10000) return `${(n / 1000).toFixed(1)} s`;
  return `${Math.round(n / 1000)} s`;
}

function fpsText(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return '--';
  return n >= 10 ? n.toFixed(1).replace(/\.0$/, '') : n.toFixed(2);
}

function lastReason(live = {}, monitorDiagnosis = {}) {
  return safeString(
    live.lastSendResult?.reason
      || live.lastSendResult?.error
      || monitorDiagnosis.lastReason
      || live.lastError
      || live.watchdog?.stale && 'watchdog-stale'
      || '',
    'none'
  );
}

function extractPatchReport(server = {}) {
  const patch = server.patch || {};
  const master = server.master || server.monitor?.master || {};
  const report = patch.report || master.latestPatch?.report || {};
  const strips = Array.isArray(report.strips) ? report.strips : [];
  const universes = Array.isArray(report.universes) ? report.universes : [];
  const routeCount = safeNumber(report.routeCount ?? master.latestPatch?.routeCount, 0);
  return {
    ok: Boolean(report.ok || report.hasPatch || routeCount > 0),
    hasPatch: Boolean(report.hasPatch || routeCount > 0),
    routeCount,
    width: safeNumber(report.width ?? patch.patch?.width ?? master.latestPatch?.width, 0),
    height: safeNumber(report.height ?? patch.patch?.height ?? master.latestPatch?.height, 0),
    summary: safeString(report.summary || master.latestPatch?.summary, 'no patch'),
    source: safeString(patch.patch?.source || master.latestPatch?.source, 'unknown'),
    publishedAt: patch.patch?.publishedAt || master.latestPatch?.publishedAt || 0,
    strips,
    universes
  };
}

function extractNetwork(live = {}, summary = {}) {
  const network = live.network || {};
  const options = live.options || {};
  const port = safeNumber(network.port || options.port || summary.port || ARTNET_STANDARD_PORT_STEP38J, ARTNET_STANDARD_PORT_STEP38J);
  const bindIp = safeString(network.bindIp || network.socketBindIp || options.bindIp || options.localAddress || summary.bindIp, '');
  const targetIp = safeString(network.outputIp || network.resolvedTarget || options.outputIp || options.host || summary.target, '');
  return {
    port,
    portStandard: port === ARTNET_STANDARD_PORT_STEP38J,
    bindIp,
    targetIp,
    targetMode: safeString(network.targetMode || options.targetMode, 'unicast'),
    socketReady: Boolean(network.socketReady || summary.socketReady),
    socketBindIp: safeString(network.socketBindIp || bindIp, ''),
    socketAddress: network.socketAddress || null
  };
}

function extractSource(server = {}, summary = {}) {
  const master = server.master || server.monitor?.master || {};
  const live = server.live || server.monitor?.live || {};
  const liveSource = safeString(
    live.lastSummary?.frameSource
      || live.lastSummary?.visualPattern
      || live.options?.visualPattern
      || live.sourcePolicy?.visualPattern
      || '',
    ''
  );
  return {
    masterSource: safeString(summary.masterSource || master.latest?.source || master.source, 'unknown'),
    liveSource: safeString(liveSource, 'unknown'),
    sourceMode: safeString(live.sourcePolicy?.sourceMode || live.options?.sourceMode, 'unknown'),
    masterFromGenerator: Boolean(summary.masterFromGenerator)
  };
}

export function normalizeGeneratorOutputTruth(diagnostics = {}) {
  const summary = diagnostics.summary || summarizeGeneratorLiveChain(diagnostics);
  const server = diagnostics.server || {};
  const live = server.live || server.monitor?.live || {};
  const monitorDiagnosis = server.monitor?.diagnosis || {};
  const master = server.master || server.monitor?.master || {};
  const bridge = diagnostics.local?.bridge || {};
  const patch = extractPatchReport(server);
  const network = extractNetwork(live, summary);
  const source = extractSource(server, summary);
  const liveRunning = Boolean(live.running || summary.liveRunning);
  const lastSent = Boolean(summary.lastSent || live.lastSendResult?.sent === true || monitorDiagnosis.lastSent === true);
  const masterFresh = Boolean(summary.masterFresh || master.fresh === true);
  const masterHasFrame = Boolean(summary.masterHasFrame || master.hasFrame === true);
  const actualFps = safeNumber(live.actualFps || summary.actualFps, 0);
  const frameAgeMs = safeNumber(master.ageMs ?? master.latest?.ageMs ?? diagnostics.local?.age?.bridgeMs, -1);
  const sentAgeMs = live.lastSendAt ? Math.max(0, Date.now() - Number(live.lastSendAt || 0)) : null;
  const routeTargetCount = freezeUniqueList((patch.universes || []).map((row) => `${row.target || network.targetIp}:${row.targetPort || network.port}`)).length;
  const routeUniverseCount = freezeUniqueList((patch.universes || []).map((row) => `${row.target || network.targetIp}:${row.targetPort || network.port}:U${row.universe}`)).length;
  const state = summary.stage || 'UNKNOWN';
  return Object.freeze({
    version: GENERATOR_OUTPUT_TRUTH_PANEL_VERSION,
    at: Date.now(),
    state,
    ok: Boolean(summary.ok && (state === 'GREEN' || state === 'READY_FOR_ARTNET' || state === 'MASTER_OTHER_SOURCE' || state === 'PREVIEW_ONLY')),
    green: state === 'GREEN',
    verdict: summary.verdict || '',
    next: summary.next || '',
    source,
    network,
    patch,
    live: {
      running: liveRunning,
      armed: Boolean(live.armed || liveRunning),
      mode: safeString(live.mode, liveRunning ? 'running' : 'stopped'),
      actualFps,
      generatedFps: safeNumber(live.generatedFps, 0),
      lifetimeActualFps: safeNumber(live.lifetimeActualFps, 0),
      lastSent,
      lastReason: lastReason(live, monitorDiagnosis),
      sentFrameCount: safeNumber(live.sentFrameCount, 0),
      skippedFrameCount: safeNumber(live.skippedFrameCount, 0),
      packetCount: safeNumber(live.packetCount, 0),
      byteCount: safeNumber(live.byteCount, 0),
      callbackErrors: safeNumber(live.udpPacketCallbackErrorCount, 0),
      watchdogStale: Boolean(live.watchdog?.stale),
      masterDriven: live.masterDriven || {},
      backpressure: live.backpressure || {},
      pacer: live.pacer || {}
    },
    master: {
      fresh: masterFresh,
      hasFrame: masterHasFrame,
      ageMs: frameAgeMs,
      age: ageText(frameAgeMs),
      frameId: master.latest?.frameId || master.frameId || bridge.lastFrameBusId || null,
      width: master.latest?.width || master.width || patch.width || 300,
      height: master.latest?.height || master.height || patch.height || 8,
      byteLength: master.latest?.byteLength || master.byteLength || 0
    },
    routes: {
      targetCount: routeTargetCount,
      universeCount: routeUniverseCount,
      routeCount: patch.routeCount,
      strips: patch.strips,
      universes: patch.universes
    },
    ages: {
      master: ageText(frameAgeMs),
      sent: ageText(sentAgeMs),
      showOs: summary.ages?.showOs || 'none',
      preview: summary.ages?.preview || 'none'
    }
  });
}

export function buildGeneratorOutputTruthHints(truthInput = {}) {
  const truth = truthInput.version === GENERATOR_OUTPUT_TRUTH_PANEL_VERSION ? truthInput : normalizeGeneratorOutputTruth(truthInput);
  const hints = [];
  if (!truth.patch.hasPatch) hints.push({ level: 'bad', text: 'ArtNet patch není publikovaný. V Mapping/Settings nejdřív publikuj SAFE 8×300 patch.' });
  if (!truth.network.portStandard) hints.push({ level: 'warn', text: `Port je ${truth.network.port}, ne standardní 6454. ArtNetominator a většina nodů čekají 6454.` });
  if (!truth.network.bindIp && truth.live.running) hints.push({ level: 'bad', text: 'ArtNet sender běží bez jasné bind IP. Vyber konkrétní síťovku/IP a znovu prime/start.' });
  if (!truth.network.targetIp && truth.patch.routeCount <= 0) hints.push({ level: 'bad', text: 'Není vidět target IP ani MultiOut routes. Start musí zůstat blokovaný, dokud není explicitní cíl.' });
  if (truth.live.running && !truth.network.socketReady) hints.push({ level: 'bad', text: 'UDP socket není ready. Nejčastější příčina je špatná bind IP nebo síťovka.' });
  if (truth.live.running && truth.network.socketReady && !truth.live.lastSent) hints.push({ level: 'bad', text: `Socket je ready, ale poslední frame se neposlal: ${truth.live.lastReason}. Zkontroluj target IP, routy a universe mapping.` });
  if (truth.master.hasFrame && !truth.master.fresh) hints.push({ level: 'warn', text: 'MASTER frame existuje, ale je starý. Generator stránka může být uspaná nebo LIVE MASTER neposílá nové framy.' });
  if (/wrong_source|ARTNET_WRONG_SOURCE/i.test(truth.state) || (truth.live.running && !/master/i.test(truth.source.liveSource))) hints.push({ level: 'warn', text: `ArtNet sender nemusí číst MASTER framebus. Aktuální live source: ${truth.source.liveSource}.` });
  if (truth.source.masterFromGenerator === false && truth.master.fresh && /generator/i.test(truth.source.liveSource)) hints.push({ level: 'warn', text: `MASTER mirror je čerstvý, ale source není Generator: ${truth.source.masterSource}.` });
  if (truth.green) hints.push({ level: 'ok', text: 'Řetězec je zelený. Když LED nesvítí, hledej mimo Generator: IP/port/universe/node/kabel/napájení.' });
  if (!hints.length) hints.push({ level: truth.ok ? 'ok' : 'warn', text: truth.next || 'Zkontroluj LIVE chain verdikt nahoře.' });
  return hints;
}

export function buildGeneratorOutputTruthCards(truthInput = {}) {
  const truth = truthInput.version === GENERATOR_OUTPUT_TRUTH_PANEL_VERSION ? truthInput : normalizeGeneratorOutputTruth(truthInput);
  return [
    { id: 'master-source', label: 'MASTER source', value: truth.source.masterSource, detail: `${truth.master.width}×${truth.master.height} · frame #${truth.master.frameId || '?'} · age ${truth.master.age}`, ok: truth.master.fresh },
    { id: 'live-source', label: 'ArtNet source', value: truth.source.liveSource, detail: `mode ${truth.source.sourceMode} · ${truth.live.mode}`, ok: /master|generator/i.test(truth.source.liveSource) || !truth.live.running },
    { id: 'network', label: 'Network', value: `${truth.network.bindIp || 'NO BIND'} → ${truth.network.targetIp || 'routes/default'}:${truth.network.port}`, detail: `${truth.network.targetMode} · socket ${boolText(truth.network.socketReady)}${truth.network.socketBindIp ? ` · bound ${truth.network.socketBindIp}` : ''}`, ok: (!truth.live.running || truth.network.socketReady) && truth.network.portStandard },
    { id: 'patch', label: 'Patch', value: truth.patch.hasPatch ? `${truth.routes.routeCount} routes` : 'NO PATCH', detail: `${truth.patch.summary} · ${truth.routes.universeCount} universes · ${truth.routes.targetCount} targets`, ok: truth.patch.hasPatch },
    { id: 'sender', label: 'Sender', value: truth.live.running ? `${fpsText(truth.live.actualFps)} FPS` : 'STOPPED', detail: `sent ${truth.live.sentFrameCount} · skip ${truth.live.skippedFrameCount} · packets ${truth.live.packetCount}`, ok: truth.live.running && truth.network.socketReady },
    { id: 'udp', label: 'Last UDP', value: truth.live.lastSent ? 'SENT' : 'NOT SENT', detail: `${truth.live.lastReason} · age ${truth.ages.sent}`, ok: truth.live.lastSent || !truth.live.running }
  ];
}

export function buildGeneratorOutputTruthRouteRows(truthInput = {}, limit = 16) {
  const truth = truthInput.version === GENERATOR_OUTPUT_TRUTH_PANEL_VERSION ? truthInput : normalizeGeneratorOutputTruth(truthInput);
  const universes = Array.isArray(truth.routes.universes) ? truth.routes.universes : [];
  const strips = Array.isArray(truth.routes.strips) ? truth.routes.strips : [];
  const rows = [];
  for (const row of universes.slice(0, limit)) {
    rows.push({
      id: `u${row.universe}-${row.target || ''}-${row.targetPort || ''}`,
      label: `${row.target || truth.network.targetIp || 'target?'}:${row.targetPort || truth.network.port} · U${row.universe}`,
      detail: safeString(row.summary || `${row.pixels || 0}px · strips ${(row.strips || []).join(',')}`, 'universe route'),
      ok: Boolean(row.target || truth.network.targetIp)
    });
  }
  if (!rows.length) {
    for (const row of strips.slice(0, limit)) {
      rows.push({ id: `s${row.stripIndex}`, label: `S${row.stripIndex}`, detail: safeString(row.summary, `${row.pixels || 0}px`), ok: truth.patch.hasPatch });
    }
  }
  if (!rows.length) rows.push({ id: 'none', label: 'ROUTES', detail: 'No ArtNet routes available in patch report.', ok: false });
  if (universes.length > limit) rows.push({ id: 'more', label: 'MORE', detail: `${universes.length - limit} dalších universe route řádků je v Settings patch reportu.`, ok: true });
  return rows;
}

export function buildGeneratorOutputTruthView(diagnostics = {}) {
  const truth = normalizeGeneratorOutputTruth(diagnostics);
  const hints = buildGeneratorOutputTruthHints(truth);
  const cards = buildGeneratorOutputTruthCards(truth);
  const routes = buildGeneratorOutputTruthRouteRows(truth, 16);
  const headline = truth.green ? 'OUTPUT GREEN' : (truth.ok ? `OUTPUT ${truth.state}` : `OUTPUT BLOCKED · ${truth.state}`);
  return Object.freeze({
    version: GENERATOR_OUTPUT_TRUTH_PANEL_VERSION,
    truth,
    headline,
    ok: truth.green || truth.ok,
    cards,
    routes,
    hints,
    text: formatGeneratorOutputTruthText({ truth, cards, routes, hints, headline })
  });
}

export function formatGeneratorOutputTruthText(viewOrDiagnostics = {}) {
  const view = viewOrDiagnostics.truth && viewOrDiagnostics.cards ? viewOrDiagnostics : buildGeneratorOutputTruthView(viewOrDiagnostics);
  const truth = view.truth;
  const lines = [
    `GENERATOR OUTPUT TRUTH ${GENERATOR_OUTPUT_TRUTH_PANEL_VERSION}`,
    `STATE: ${truth.state} | ${truth.verdict}`,
    `MASTER: ${truth.source.masterSource} | fresh ${boolText(truth.master.fresh)} | frame ${truth.master.frameId || '?'} | age ${truth.master.age}`,
    `ARTNET SOURCE: ${truth.source.liveSource} | mode ${truth.source.sourceMode}`,
    `NETWORK: bind ${truth.network.bindIp || 'NO BIND'} -> ${truth.network.targetIp || 'routes/default'}:${truth.network.port} | socket ${boolText(truth.network.socketReady)} | targetMode ${truth.network.targetMode}`,
    `PATCH: ${truth.patch.hasPatch ? truth.patch.summary : 'NO PATCH'} | routes ${truth.routes.routeCount}`,
    `SENDER: ${truth.live.running ? 'RUNNING' : 'STOPPED'} | fps ${fpsText(truth.live.actualFps)} | sent ${truth.live.sentFrameCount} | skip ${truth.live.skippedFrameCount} | last ${truth.live.lastSent ? 'SENT' : 'NOT SENT'} (${truth.live.lastReason})`,
    'ROUTES:',
    ...view.routes.map((row) => `- ${row.label}: ${row.detail}`),
    'HINTS:',
    ...view.hints.map((hint) => `- ${hint.level.toUpperCase()}: ${hint.text}`)
  ];
  return lines.join('\n');
}
