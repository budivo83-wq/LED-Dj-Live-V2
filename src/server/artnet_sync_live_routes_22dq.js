import fs from 'fs';
import path from 'path';
import { ARTNET_LIVE_DEFAULTS } from '../../shared/artnet_live_defaults.js';
import { freezeUniqueList } from './live_output_common.js';
import {
  buildStep22DqFrame,
  buildStep22DqLivePlan,
  STEP22DQ_ARTNET_SYNC_LIVE_VERSION,
  STEP22EX_STABILITY_GATE_VERSION,
  STEP22EY_REPORT_EXPORT_VERSION,
  STEP22EZ_REPORT_COMPARE_VERSION,
  STEP22FA_BEST_SETTINGS_VERSION,
  STEP22FB_AUTO_LOAD_BEST_SETTINGS_VERSION,
  STEP22FC_LIVE_PROFILE_MANAGER_VERSION,
  STEP22FD_LIVE_READINESS_DASHBOARD_VERSION,
  STEP22FE_GUIDED_LIVE_RUN_VERSION,
  STEP22FF_LIVE_PREFLIGHT_VERSION,
  STEP22FG_FIELD_DECISION_VERSION
} from '../output/artnet_sync_live_sender_22dq.js';

function safeFileStamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function reportsDirPath() {
  return path.resolve(process.cwd(), 'data', 'reports');
}

function readJsonFileSafe(filePath) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
  catch { return null; }
}

function bestSettingsPresetPath() {
  return path.resolve(process.cwd(), 'data', 'step22fa-best-live-settings.json');
}

function liveProfilesPath() {
  return path.resolve(process.cwd(), 'data', 'step22fc-live-profiles.json');
}

function cleanProfileName(name) {
  const cleaned = String(name || '').trim().replace(/[^a-zA-Z0-9_. -]/g, '_').slice(0, 64);
  return cleaned || 'default-live-profile';
}

function readLiveProfilesStore() {
  const filePath = liveProfilesPath();
  const payload = fs.existsSync(filePath) ? readJsonFileSafe(filePath) : null;
  const profiles = payload && typeof payload.profiles === 'object' && payload.profiles ? payload.profiles : {};
  return {
    ok: true,
    version: STEP22FC_LIVE_PROFILE_MANAGER_VERSION,
    file: path.relative(process.cwd(), filePath),
    updatedAt: payload?.updatedAt || null,
    activeProfile: payload?.activeProfile || null,
    profiles
  };
}

function profileSettingsFromBody(body = {}) {
  const allowed = [
    'outputIp','targetMode','bindIp','port','fps','stripCount','pixelsPerStrip','universeStart','pixelsPerUniverse',
    'packetPaceMs','packetsPerBurst','packetOrder','artSyncMode','artSyncEveryN','backpressure','lastGoodHoldMs',
    'adaptiveFrameClock','adaptiveFloorFps','blackoutAfterHold','maxPendingBatchMs','visualPattern','sourceMode','longRunMinutes'
  ];
  const settings = {};
  const source = body.settings && typeof body.settings === 'object' ? body.settings : body;
  for (const key of allowed) if (source[key] != null) settings[key] = source[key];
  return settings;
}

function writeLiveProfilesStore(store) {
  const outPath = liveProfilesPath();
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify({ ...store, updatedAt: new Date().toISOString() }, null, 2));
  return path.relative(process.cwd(), outPath);
}

function listLiveProfiles() {
  const store = readLiveProfilesStore();
  const rows = Object.entries(store.profiles).map(([name, profile]) => ({
    name,
    savedAt: profile.savedAt || null,
    note: profile.note || '',
    source: profile.source || 'manual',
    settings: profile.settings || {}
  })).sort((a,b) => String(b.savedAt || '').localeCompare(String(a.savedAt || '')) || a.name.localeCompare(b.name));
  return { ...store, profiles: rows, count: rows.length };
}

function saveLiveProfile(body = {}) {
  const name = cleanProfileName(body.name || body.profileName || body.settings?.profileName);
  const store = readLiveProfilesStore();
  const settings = profileSettingsFromBody(body);
  if (!Object.keys(settings).length) {
    return { ok: false, version: STEP22FC_LIVE_PROFILE_MANAGER_VERSION, reason: 'EMPTY_SETTINGS', message: 'No profile settings received.' };
  }
  store.profiles[name] = {
    name,
    savedAt: new Date().toISOString(),
    note: String(body.note || '').slice(0, 1000),
    source: String(body.source || 'manual-safe-live').slice(0, 120),
    settings
  };
  store.activeProfile = name;
  const file = writeLiveProfilesStore(store);
  return { ok: true, version: STEP22FC_LIVE_PROFILE_MANAGER_VERSION, file, activeProfile: name, profile: store.profiles[name], count: Object.keys(store.profiles).length };
}

function loadLiveProfile(name) {
  const clean = cleanProfileName(name);
  const store = readLiveProfilesStore();
  const profile = store.profiles[clean];
  if (!profile) return { ok: false, version: STEP22FC_LIVE_PROFILE_MANAGER_VERSION, reason: 'PROFILE_NOT_FOUND', message: `Profile not found: ${clean}`, activeProfile: store.activeProfile, available: Object.keys(store.profiles) };
  store.activeProfile = clean;
  const file = writeLiveProfilesStore(store);
  return { ok: true, version: STEP22FC_LIVE_PROFILE_MANAGER_VERSION, file, activeProfile: clean, profile };
}

function deleteLiveProfile(name) {
  const clean = cleanProfileName(name);
  const store = readLiveProfilesStore();
  if (!store.profiles[clean]) return { ok: false, version: STEP22FC_LIVE_PROFILE_MANAGER_VERSION, reason: 'PROFILE_NOT_FOUND', message: `Profile not found: ${clean}` };
  delete store.profiles[clean];
  if (store.activeProfile === clean) store.activeProfile = Object.keys(store.profiles)[0] || null;
  const file = writeLiveProfilesStore(store);
  return { ok: true, version: STEP22FC_LIVE_PROFILE_MANAGER_VERSION, file, deleted: clean, activeProfile: store.activeProfile, count: Object.keys(store.profiles).length };
}

function readSavedBestSettingsPreset() {
  const filePath = bestSettingsPresetPath();
  if (!fs.existsSync(filePath)) {
    return {
      ok: false,
      version: STEP22FB_AUTO_LOAD_BEST_SETTINGS_VERSION,
      reason: 'NO_SAVED_PRESET',
      message: 'No saved best live preset found yet. Use SAVE BEST SETTINGS after exporting at least one long-run report.',
      file: path.relative(process.cwd(), filePath)
    };
  }
  const payload = readJsonFileSafe(filePath);
  if (!payload || !payload.settings) {
    return {
      ok: false,
      version: STEP22FB_AUTO_LOAD_BEST_SETTINGS_VERSION,
      reason: 'INVALID_SAVED_PRESET',
      message: 'Saved best live preset exists but does not contain valid settings.',
      file: path.relative(process.cwd(), filePath)
    };
  }
  return {
    ok: true,
    version: STEP22FB_AUTO_LOAD_BEST_SETTINGS_VERSION,
    file: path.relative(process.cwd(), filePath),
    savedAt: payload.savedAt || null,
    best: payload.best || null,
    settings: payload.settings,
    warnings: payload.warnings || [],
    next: 'Preset loaded. Review values, then PRIME SOCKET and SAFE MASTER LIVE.'
  };
}


function extractReportRow(payload, fileName = '') {
  const report = payload?.longRun?.longRun?.report || payload?.longRun?.report || payload?.report?.longRun?.longRun?.report || null;
  const gate = payload?.stabilityGate || payload?.report?.stabilityGate || null;
  const status = payload?.status || payload?.report?.status || null;
  const opts = status?.options || {};
  const score = Number(gate?.score ?? 0);
  const skipRatePct = Number(report?.skipRatePct ?? 999);
  const jitterMaxMs = Number(report?.jitterMaxMs ?? 999);
  const batchLatencyMaxMs = Number(report?.batchLatencyMaxMs ?? 999);
  const udpCallbackErrors = Number(report?.udpCallbackErrors ?? 999);
  const actualFps = Number(report?.actualFps ?? 0);
  const adaptiveFpsDrops = Number(report?.adaptiveFpsDrops ?? 0);
  return {
    fileName,
    generatedAt: payload?.generatedAt || null,
    verdict: gate?.verdict || 'UNKNOWN',
    score,
    rankScore: Number((score - skipRatePct * 1.2 - jitterMaxMs * 0.08 - batchLatencyMaxMs * 0.03 - udpCallbackErrors * 10 - adaptiveFpsDrops * 2).toFixed(2)),
    elapsedSec: Number(report?.elapsedSec ?? 0),
    actualFps,
    targetFps: Number(opts?.fps ?? report?.effectiveFps ?? 0),
    packetOrder: report?.packetOrder || opts?.packetOrder || '-',
    packetPaceMs: Number(opts?.packetPaceMs ?? 0),
    packetsPerBurst: Number(opts?.packetsPerBurst ?? 0),
    artSyncMode: opts?.artSyncMode || '-',
    outputIp: opts?.outputIp || '',
    targetMode: opts?.targetMode || 'unicast',
    bindIp: opts?.bindIp || '',
    port: Number(opts?.port ?? 6454),
    stripCount: Number(opts?.stripCount ?? 8),
    pixelsPerStrip: Number(opts?.pixelsPerStrip ?? 300),
    universeStart: Number(opts?.universeStart ?? 0),
    pixelsPerUniverse: Number(opts?.pixelsPerUniverse ?? 170),
    backpressure: opts?.backpressure || 'on',
    lastGoodHoldMs: Number(opts?.lastGoodHoldMs ?? 5000),
    adaptiveFrameClock: opts?.adaptiveFrameClock || ARTNET_LIVE_DEFAULTS.adaptiveFrameClock,
    adaptiveFloorFps: Number(opts?.adaptiveFloorFps ?? ARTNET_LIVE_DEFAULTS.adaptiveFloorFps),
    blackoutAfterHold: opts?.blackoutAfterHold || 'off',
    maxPendingBatchMs: Number(opts?.maxPendingBatchMs ?? ARTNET_LIVE_DEFAULTS.maxPendingBatchMs),
    skipRatePct,
    skippedFrames: Number(report?.skippedFrames ?? 0),
    sentFrames: Number(report?.sentFrames ?? 0),
    jitterAvgMs: Number(report?.jitterAvgMs ?? 0),
    jitterMaxMs,
    batchLatencyAvgMs: Number(report?.batchLatencyAvgMs ?? 0),
    batchLatencyMaxMs,
    udpCallbackErrors,
    lateTicks: Number(report?.lateTicks ?? 0),
    adaptiveFpsDrops,
    lastSendReason: report?.lastSendReason || '-',
    note: payload?.note || ''
  };
}

function listSavedReportRows(limit = 24) {
  const dir = reportsDirPath();
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir)
    .filter((name) => /^step22e[yz]-live-report-|^step22ey-live-report-/.test(name) && name.endsWith('.json'))
    .map((name) => ({ name, path: path.join(dir, name), stat: fs.statSync(path.join(dir, name)) }))
    .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs)
    .slice(0, Math.max(1, Math.min(100, Number(limit) || 24)));
  return files.map((f) => {
    const payload = readJsonFileSafe(f.path);
    if (!payload) return null;
    return extractReportRow(payload, f.name);
  }).filter(Boolean);
}

function compareReportRows(rows) {
  const sorted = [...rows].sort((a, b) => b.rankScore - a.rankScore || b.score - a.score || a.skipRatePct - b.skipRatePct || a.jitterMaxMs - b.jitterMaxMs);
  const best = sorted[0] || null;
  const baseline = sorted[sorted.length - 1] || null;
  const recommendations = [];
  if (best) {
    recommendations.push(`Best candidate: ${best.fileName} (${best.verdict}, score ${best.score}/100, rank ${best.rankScore})`);
    recommendations.push(`Try these live settings first: FPS ${best.targetFps || best.actualFps}, packet pace ${best.packetPaceMs}ms, burst ${best.packetsPerBurst}, order ${best.packetOrder}, ArtSync ${best.artSyncMode}`);
    if (best.skipRatePct > 3) recommendations.push('Skip rate is still elevated; lower FPS or increase Packet pace ms.');
    if (best.jitterMaxMs > 60) recommendations.push('Max jitter is still visible-risk; test interleaved-v2 and keep browser/preview load lower.');
    if (best.udpCallbackErrors > 0) recommendations.push('UDP callback errors present; verify target IP, NIC binding, Wi-Fi/Ethernet path and node load.');
  } else {
    recommendations.push('No saved reports yet. Run LONG RUN TEST, then EXPORT REPORT at least twice with different packet settings.');
  }
  return { ok: true, version: STEP22EZ_REPORT_COMPARE_VERSION, count: sorted.length, best, worst: baseline, rows: sorted, recommendations };
}

function buildBestSettingsPayload(rows) {
  const compared = compareReportRows(rows);
  const best = compared.best;
  if (!best) {
    return {
      ok: false,
      version: STEP22FA_BEST_SETTINGS_VERSION,
      reason: 'NO_REPORTS',
      message: 'No exported long-run reports found. Run LONG RUN TEST, then EXPORT REPORT first.',
      compare: compared
    };
  }
  const settings = {
    outputIp: best.outputIp || '2.1.1.30',
    targetMode: best.targetMode || 'unicast',
    bindIp: best.bindIp || '',
    port: best.port || 6454,
    fps: best.targetFps || best.actualFps || 10,
    stripCount: best.stripCount || 8,
    pixelsPerStrip: best.pixelsPerStrip || 300,
    universeStart: best.universeStart ?? 0,
    pixelsPerUniverse: best.pixelsPerUniverse || 170,
    packetPaceMs: best.packetPaceMs ?? 2,
    packetsPerBurst: best.packetsPerBurst || 1,
    packetOrder: best.packetOrder || 'sequential',
    artSyncMode: best.artSyncMode || 'off',
    backpressure: best.backpressure || 'on',
    lastGoodHoldMs: best.lastGoodHoldMs || 5000,
    adaptiveFrameClock: best.adaptiveFrameClock || ARTNET_LIVE_DEFAULTS.adaptiveFrameClock,
    adaptiveFloorFps: best.adaptiveFloorFps || ARTNET_LIVE_DEFAULTS.adaptiveFloorFps,
    blackoutAfterHold: best.blackoutAfterHold || 'off',
    maxPendingBatchMs: best.maxPendingBatchMs || ARTNET_LIVE_DEFAULTS.maxPendingBatchMs
  };
  const warnings = [];
  if (best.verdict !== 'PASS_LIVE_READY') warnings.push(`Best report verdict is ${best.verdict}, not PASS_LIVE_READY; apply as a safer starting point, not as final proof.`);
  if (best.skipRatePct > 3) warnings.push('Best report still has elevated skip rate; consider lowering FPS or raising packet pace.');
  if (best.jitterMaxMs > 60) warnings.push('Best report still has high max jitter; compare sequential/interleaved again on real LEDs.');
  return {
    ok: true,
    version: STEP22FA_BEST_SETTINGS_VERSION,
    best,
    settings,
    warnings,
    compare: compared,
    next: 'Apply these values in Safe Live, save config, then run a fresh LONG RUN TEST to verify.'
  };
}


function latestReportSummary(limit = 24) {
  const rows = listSavedReportRows(limit);
  return rows[0] || null;
}

function buildLiveReadinessDashboard(status = {}) {
  const master = (() => {
    try { return artnetMasterFrameStore22EJ.status ? artnetMasterFrameStore22EJ.status() : artnetMasterFrameStore22EJ.getStatus?.(); }
    catch { return null; }
  })();
  const reports = listSavedReportRows(24);
  const compare = compareReportRows(reports);
  const bestPreset = readSavedBestSettingsPreset();
  const profiles = listLiveProfiles();
  const latestReport = reports[0] || null;
  const issues = [];
  const warnings = [];
  const next = [];

  if (!status.network?.socketReady) warnings.push('UDP socket není připravený; před live dej Připravit socket.');
  if ((status.options?.visualPattern || '') === 'master-framebus') {
    if (!master?.hasFrame) issues.push('Server zatím nemá MASTER frame z Performance stránky.');
    else if (!master?.fresh) warnings.push(`MASTER frame je stale (${master.ageMs ?? '?'} ms).`);
  }
  if (!bestPreset?.ok) warnings.push('Není uložený best preset; po prvním dobrém long-runu použij SAVE BEST SETTINGS.');
  if (!profiles.count) warnings.push('Není uložený žádný live profil; ulož si aspoň Wi‑Fi safe / Ethernet safe profil.');
  if (!reports.length) warnings.push('Zatím nejsou uložené long-run reporty pro porovnání.');
  if (latestReport?.verdict && latestReport.verdict !== 'PASS_LIVE_READY') warnings.push(`Poslední report nemá PASS (${latestReport.verdict}).`);
  if (Number(status.skippedFrameCount || 0) > 0 && status.running) warnings.push(`Aktuální běh má skipy: ${status.skippedFrameCount}.`);
  if (Number(status.udpPacketCallbackErrorCount || 0) > 0) issues.push(`UDP callback chyby: ${status.udpPacketCallbackErrorCount}.`);

  if (issues.length) next.push('Nejdřív oprav RED položky, pak teprve zvedej FPS.');
  if (!reports.length) next.push('Spusť 5min LONG RUN TEST na 10–15 FPS a exportuj report.');
  else if (compare.best?.settings) next.push(`Otestuj nejlepší známé nastavení: ${compare.best.settings.fps || '?'} FPS, pace ${compare.best.settings.packetPaceMs ?? '?'} ms, burst ${compare.best.settings.packetsPerBurst ?? '?'}, ${compare.best.settings.packetOrder || 'order?'}.`);
  if (!profiles.count) next.push('Ulož ověřený profil přes SAVE PROFILE.');

  let score = 100;
  score -= issues.length * 35;
  score -= warnings.length * 8;
  if (latestReport?.score != null) score = Math.round((score + Number(latestReport.score)) / 2);
  score = Math.max(0, Math.min(100, score));
  const verdict = issues.length ? 'BLOCKED' : (score >= 85 ? 'READY_TO_TEST_LIVE' : (score >= 65 ? 'TEST_LOW_FPS_FIRST' : 'NEEDS_MORE_VALIDATION'));

  return {
    ok: true,
    version: STEP22FD_LIVE_READINESS_DASHBOARD_VERSION,
    generatedAt: new Date().toISOString(),
    verdict,
    score,
    issues,
    warnings,
    next,
    status: {
      running: !!status.running,
      fps: status.options?.fps ?? null,
      target: status.network?.resolvedTarget || status.network?.outputIp || null,
      bind: status.network?.socketBindIp || status.network?.bindIp || null,
      socketReady: !!status.network?.socketReady,
      packetOrder: status.options?.packetOrder || null,
      artSyncMode: status.options?.artSyncMode || null,
      skippedFrameCount: status.skippedFrameCount || 0,
      udpErrors: status.udpPacketCallbackErrorCount || 0
    },
    master: master ? { hasFrame: !!master.hasFrame, fresh: !!master.fresh, ageMs: master.ageMs ?? null, latest: master.latest || null } : null,
    reports: { count: reports.length, latest: latestReport, best: compare.best || null },
    preset: { savedBest: !!bestPreset?.ok, source: bestPreset?.source || bestPreset?.file || null },
    profiles: { count: profiles.count, activeProfile: profiles.activeProfile || null, names: (profiles.profiles || []).map((p) => p.name).slice(0, 20) }
  };
}


function buildGuidedLiveRunPlan(status = {}) {
  const readiness = buildLiveReadinessDashboard(status);
  const options = status.options || {};
  const reports = listSavedReportRows(24);
  const compare = compareReportRows(reports);
  const best = compare.best || null;
  const currentFps = Number(options.fps || 10);
  const safeFps = Math.max(5, Math.min(15, best?.targetFps || currentFps || 10));
  const targetFps = readiness.verdict === 'READY_TO_TEST_LIVE' ? Math.min(30, Math.max(safeFps, currentFps || 15)) : safeFps;
  const packetPaceMs = best?.packetPaceMs ?? options.packetPaceMs ?? 2;
  const packetsPerBurst = best?.packetsPerBurst ?? options.packetsPerBurst ?? 1;
  const packetOrder = best?.packetOrder || options.packetOrder || 'sequential';
  const artSyncMode = best?.artSyncMode || options.artSyncMode || 'every-frame';

  const blockers = [];
  if (readiness.issues?.length) blockers.push(...readiness.issues);
  if (!status.network?.socketReady) blockers.push('Socket není připravený: nejdřív PRIME SOCKET.');

  const steps = [
    { id: '01-open-performance', label: 'Otevři Performance index.html', action: 'Měj otevřenou Performance stránku, aby server dostával MASTER frame.', required: true, done: readiness.master?.fresh === true },
    { id: '02-prime-socket', label: 'Připrav UDP socket', action: 'Klikni Připravit socket a ověř, že SOCKET je READY.', required: true, done: !!status.network?.socketReady },
    { id: '03-self-test', label: 'MASTER self-test / SEND ONE', action: 'Pošli jeden MASTER self-test frame nebo SEND ONE MASTER FRAME a ověř PACKETS/UNIVERSES/BYTES.', required: true, done: !!status.lastPacketSummary?.packetCount || !!status.lastSendResult?.packetSummary?.packetCount },
    { id: '04-strip-scan', label: 'Strip/universe scan', action: 'Projeď AUTO STRIP SCAN nebo AUTO RANGE SCAN a zapiš, co fyzicky svítí.', required: true, done: false },
    { id: '05-safe-long-run', label: '5min low-FPS long run', action: `Nastav ${targetFps} FPS, pace ${packetPaceMs} ms, burst ${packetsPerBurst}, order ${packetOrder}, ArtSync ${artSyncMode}; spusť LONG RUN TEST.`, required: true, done: !!reports.length },
    { id: '06-export-gate', label: 'Export + stability gate', action: 'Po doběhu dej STABILITY GATE a EXPORT REPORT.', required: true, done: latestReportSummary(24)?.verdict === 'PASS_LIVE_READY' },
    { id: '07-compare-save', label: 'Compare/save preset', action: 'Dej COMPARE REPORTS, APPLY BEST SETTINGS, potom SAVE BEST SETTINGS a SAVE PROFILE.', required: false, done: !!readiness.preset?.savedBest && Number(readiness.profiles?.count || 0) > 0 }
  ];

  const nextStep = steps.find((step) => !step.done) || steps[steps.length - 1];
  return {
    ok: true,
    version: STEP22FE_GUIDED_LIVE_RUN_VERSION,
    generatedAt: new Date().toISOString(),
    blocked: blockers.length > 0,
    blockers,
    readiness: { verdict: readiness.verdict, score: readiness.score, issues: readiness.issues, warnings: readiness.warnings },
    recommendedSettings: {
      fps: targetFps,
      packetPaceMs,
      packetsPerBurst,
      packetOrder,
      artSyncMode,
      backpressure: options.backpressure || 'on',
      lastGoodHoldMs: options.lastGoodHoldMs || 5000,
      adaptiveFrameClock: options.adaptiveFrameClock || ARTNET_LIVE_DEFAULTS.adaptiveFrameClock,
      adaptiveFloorFps: options.adaptiveFloorFps || ARTNET_LIVE_DEFAULTS.adaptiveFloorFps,
      longRunMinutes: 5
    },
    nextStep,
    steps,
    summary: blockers.length ? `BLOCKED: ${blockers.join(' | ')}` : `NEXT: ${nextStep.label} — ${nextStep.action}`
  };
}

function buildLivePreflightGate(status = {}) {
  const readiness = buildLiveReadinessDashboard(status);
  const guided = buildGuidedLiveRunPlan(status);
  const opts = status.options || {};
  const net = status.network || {};
  const master = readiness.master || null;
  const latestReport = readiness.reports?.latest || null;
  const best = readiness.reports?.best || null;
  const checks = [];
  const add = (id, label, state, detail = '', severity = 'blocker') => {
    checks.push({ id, label, state, ok: state === 'PASS', detail, severity });
  };

  const target = String(net.resolvedTarget || net.outputIp || opts.outputIp || '').trim();
  const bind = String(net.socketBindIp || net.bindIp || opts.bindIp || '').trim();
  const port = Number(net.port || opts.port || 6454);
  const fps = Number(opts.fps || 0);
  const universeStart = Number(opts.universeStart ?? 0);
  const stripCount = Number(opts.stripCount ?? 8);
  const pixelsPerStrip = Number(opts.pixelsPerStrip ?? 300);
  const pixelsPerUniverse = Number(opts.pixelsPerUniverse ?? 170);
  const universeCount = Math.max(1, Math.ceil((stripCount * pixelsPerStrip) / pixelsPerUniverse));
  const universeEnd = universeStart + universeCount - 1;
  const packetPaceMs = Number(opts.packetPaceMs ?? 2);
  const packetsPerBurst = Number(opts.packetsPerBurst ?? 1);
  const packetOrder = String(opts.packetOrder || 'sequential');
  const artSyncMode = String(opts.artSyncMode || 'off');

  add('socket-ready', 'UDP socket prepared', net.socketReady ? 'PASS' : 'FAIL', net.socketReady ? `socket ready on ${bind || 'default'} → ${target || '?'}:${port}` : 'Klikni PRIME SOCKET / Připravit socket před live.', 'blocker');
  add('target-ip', 'Target IP selected', target ? 'PASS' : 'FAIL', target ? `target=${target}:${port}` : 'Chybí output IP / target.', 'blocker');
  add('master-frame', 'MASTER frame fresh', master?.fresh ? 'PASS' : (master?.hasFrame ? 'WARN' : 'FAIL'), master?.fresh ? `MASTER age ${master.ageMs ?? '?'} ms` : (master?.hasFrame ? `MASTER stale ${master.ageMs ?? '?'} ms` : 'Otevři Performance index.html nebo dej MASTER self-test frame.'), master?.hasFrame ? 'warning' : 'blocker');
  add('universe-range', 'Universe range sane', universeCount > 0 && universeEnd <= 32767 ? 'PASS' : 'FAIL', `range ${universeStart}–${universeEnd}, count=${universeCount}, ${stripCount}×${pixelsPerStrip}px / ${pixelsPerUniverse}px`, 'blocker');
  add('pacer-safe', 'Packet pacer safe', packetPaceMs >= 1 && packetsPerBurst <= 2 ? 'PASS' : 'WARN', `pace=${packetPaceMs}ms, burst=${packetsPerBurst}`, 'warning');
  add('fps-safe', 'Initial FPS safe', fps > 0 && fps <= 30 ? 'PASS' : 'WARN', `fps=${fps || '?'}; pro první reálný test doporučeno 10–15`, 'warning');
  add('backpressure', 'Backpressure guard enabled', String(opts.backpressure || 'on') === 'on' ? 'PASS' : 'WARN', `backpressure=${opts.backpressure || 'on'}`, 'warning');
  add('last-good-cache', 'Last good cache configured', Number(opts.lastGoodHoldMs || 0) >= 1000 ? 'PASS' : 'WARN', `lastGoodHoldMs=${opts.lastGoodHoldMs ?? '?'}`, 'warning');
  add('readiness-score', 'Readiness score acceptable', readiness.score >= 65 ? 'PASS' : 'WARN', `${readiness.verdict} ${readiness.score}/100`, 'warning');
  add('report-history', 'At least one exported report', readiness.reports?.count > 0 ? 'PASS' : 'WARN', readiness.reports?.count ? `reports=${readiness.reports.count}, latest=${latestReport?.verdict || 'UNKNOWN'}, best=${best?.verdict || 'UNKNOWN'}` : 'Zatím bez reportů; po prvním long-runu exportuj report.', 'warning');
  add('profile-saved', 'Live profile available', readiness.profiles?.count > 0 ? 'PASS' : 'WARN', readiness.profiles?.count ? `profiles=${readiness.profiles.count}, active=${readiness.profiles.activeProfile || '-'}` : 'Ulož si ověřený profil přes SAVE PROFILE.', 'warning');

  const blockers = checks.filter((c) => c.state === 'FAIL' && c.severity === 'blocker');
  const warnings = checks.filter((c) => c.state === 'WARN' || (c.state === 'FAIL' && c.severity !== 'blocker'));
  const passCount = checks.filter((c) => c.state === 'PASS').length;
  const score = Math.max(0, Math.min(100, Math.round((passCount / checks.length) * 100 - blockers.length * 20 - warnings.length * 3)));
  const verdict = blockers.length ? 'PREFLIGHT_BLOCKED' : (warnings.length ? 'PREFLIGHT_WARN_SAFE_LOW_FPS' : 'PREFLIGHT_PASS');
  const recommended = {
    fps: Math.max(5, Math.min(15, Number(guided.recommendedSettings?.fps || fps || 10))),
    packetPaceMs: Math.max(1, Number(guided.recommendedSettings?.packetPaceMs ?? packetPaceMs ?? 2)),
    packetsPerBurst: Math.max(1, Math.min(2, Number(guided.recommendedSettings?.packetsPerBurst ?? packetsPerBurst ?? 1))),
    packetOrder: guided.recommendedSettings?.packetOrder || packetOrder || 'sequential',
    artSyncMode: guided.recommendedSettings?.artSyncMode || artSyncMode || 'off',
    longRunMinutes: 5,
    universeStart,
    universeEnd,
    universeCount,
    target,
    bind,
    port
  };
  const next = blockers.length
    ? ['Nezapínej SAFE MASTER LIVE. Vyřeš blocker položky: ' + blockers.map((b) => b.label).join(', ')]
    : [
        `Můžeš spustit první bezpečný live test: ${recommended.fps} FPS, pace ${recommended.packetPaceMs} ms, burst ${recommended.packetsPerBurst}, ${recommended.packetOrder}.`,
        'Po testu spusť STABILITY GATE a EXPORT REPORT.'
      ];
  return {
    ok: true,
    version: STEP22FF_LIVE_PREFLIGHT_VERSION,
    generatedAt: new Date().toISOString(),
    verdict,
    score,
    blocked: blockers.length > 0,
    checks,
    blockers,
    warnings,
    recommended,
    readiness: { verdict: readiness.verdict, score: readiness.score, issues: readiness.issues, warnings: readiness.warnings },
    guided: { blocked: guided.blocked, nextStep: guided.nextStep, summary: guided.summary },
    next,
    summary: `${verdict} ${score}/100 · PASS ${passCount}/${checks.length} · blockers ${blockers.length} · warnings ${warnings.length}`
  };
}


function buildFieldTestDecision(status = {}) {
  const preflight = buildLivePreflightGate(status);
  const readiness = buildLiveReadinessDashboard(status);
  const guided = buildGuidedLiveRunPlan(status);
  const opts = status.options || {};
  const net = status.network || {};
  const blockers = [];
  const warnings = [];

  if (preflight.blocked) blockers.push(...(preflight.blockers || []).map((b) => b.label || b.id));
  if (!net.socketReady) blockers.push('UDP socket not primed');
  if (String(opts.visualPattern || 'master-framebus') === 'master-framebus' && readiness.master?.fresh !== true) blockers.push('MASTER frame is not fresh');
  if (Number(status.udpPacketCallbackErrorCount || 0) > 0) blockers.push('UDP callback errors are present');
  if (Number(opts.fps || 0) > 30) warnings.push('FPS is above safe first-test range');
  if (Number(opts.packetPaceMs ?? 2) < 1) warnings.push('Packet pace is too aggressive');
  if (String(opts.backpressure || 'on') !== 'on') warnings.push('Backpressure guard is disabled');
  if (readiness.reports?.latest?.jitterMaxMs > 60) warnings.push('Last saved report had noticeable max jitter');

  const recommended = preflight.recommended || guided.recommendedSettings || {};
  const decision = blockers.length ? 'NO_GO_FIX_BLOCKERS' : (warnings.length ? 'GO_LOW_FPS_WATCH_CLOSELY' : 'GO_SAFE_TEST');
  const runOrder = blockers.length ? [
    'Do not start SAFE MASTER LIVE yet.',
    'Fix the listed blockers, then run LIVE PREFLIGHT again.',
    'Only continue after FIELD DECISION changes to GO_LOW_FPS_WATCH_CLOSELY or GO_SAFE_TEST.'
  ] : [
    `Set FPS ${recommended.fps || 10}, packet pace ${recommended.packetPaceMs ?? 2} ms, burst ${recommended.packetsPerBurst || 1}, order ${recommended.packetOrder || 'sequential'}, ArtSync ${recommended.artSyncMode || 'every-frame'}.`,
    'Send ONE MASTER FRAME and visually verify that the node reacts.',
    'Run AUTO STRIP SCAN / RANGE SCAN and write down physical strip order.',
    'Start LONG RUN TEST for 5 minutes.',
    'After it stops, run STABILITY GATE, EXPORT REPORT, COMPARE REPORTS, then SAVE BEST SETTINGS / SAVE PROFILE.'
  ];
  return {
    ok: true,
    version: STEP22FG_FIELD_DECISION_VERSION,
    generatedAt: new Date().toISOString(),
    decision,
    blocked: blockers.length > 0,
    blockers: freezeUniqueList(blockers),
    warnings: freezeUniqueList(warnings),
    recommended,
    runOrder,
    preflight: { verdict: preflight.verdict, score: preflight.score, summary: preflight.summary },
    readiness: { verdict: readiness.verdict, score: readiness.score },
    guided: { blocked: guided.blocked, nextStep: guided.nextStep, summary: guided.summary },
    summary: blockers.length ? `NO-GO: ${freezeUniqueList(blockers).join(' | ')}` : `GO: ${decision}; start with ${recommended.fps || 10} FPS and export a new report.`
  };
}

function buildMasterTruthSmoke(status = {}) {
  const options = status.options || {};
  const network = status.network || {};
  const master = (() => {
    try { return artnetMasterFrameStore22EJ.status ? artnetMasterFrameStore22EJ.status() : artnetMasterFrameStore22EJ.getStatus?.(); }
    catch { return null; }
  })();
  const checks = [];
  const add = (id, ok, detail, severity = 'fail') => checks.push({ id, ok: !!ok, detail, severity });

  const requestedFps = Number(options.fps || 0);
  const maxLiveFps = Number(options.maxLiveFps || status.maxLiveFps || 0);
  const actualFps = Number(status.actualFps || 0);
  const skipCount = Number(status.skippedFrameCount || 0);
  const udpErrors = Number(status.udpPacketCallbackErrorCount || 0);
  const packetPaceMs = Number(options.packetPaceMs ?? ARTNET_LIVE_DEFAULTS.packetPaceMs);
  const adaptiveFrameClock = String(options.adaptiveFrameClock || ARTNET_LIVE_DEFAULTS.adaptiveFrameClock).toLowerCase();
  const artSyncMode = String(options.artSyncMode || ARTNET_LIVE_DEFAULTS.artSyncMode).toLowerCase();

  add('socket-ready', network.socketReady === true, network.socketReady ? 'UDP socket ready.' : 'UDP socket not primed.');
  add('master-fresh', master?.fresh === true, master?.fresh ? `MASTER fresh (${master.ageMs ?? 0} ms).` : `MASTER stale/missing (${master?.ageMs ?? 'n/a'} ms).`);
  add('fps-target', requestedFps >= ARTNET_LIVE_DEFAULTS.fps, `Requested FPS ${requestedFps || 0}.`);
  add('fps-cap', maxLiveFps >= ARTNET_LIVE_DEFAULTS.maxLiveFps, `Max live FPS ${maxLiveFps || 0}.`);
  add('packet-pace', packetPaceMs === ARTNET_LIVE_DEFAULTS.packetPaceMs, `Packet pace ${packetPaceMs} ms.`, 'warn');
  add('adaptive-off', adaptiveFrameClock === ARTNET_LIVE_DEFAULTS.adaptiveFrameClock, `Adaptive frame clock ${adaptiveFrameClock || '-'}.`);
  add('artsync-off', artSyncMode === ARTNET_LIVE_DEFAULTS.artSyncMode, `ArtSync ${artSyncMode || '-'}.`, 'warn');
  add('udp-errors', udpErrors === 0, `UDP callback errors ${udpErrors}.`);
  if (status.running) {
    add('actual-fps', actualFps >= ARTNET_LIVE_DEFAULTS.fps * 0.84, `Actual FPS ${actualFps || 0}.`, 'warn');
    add('skip-count', skipCount === 0, `Skipped frames ${skipCount}.`, 'warn');
  } else {
    add('actual-fps', true, 'Live sender idle; FPS check will arm after start.', 'warn');
  }

  const failCount = checks.filter((item) => !item.ok && item.severity !== 'warn').length;
  const warnCount = checks.filter((item) => !item.ok && item.severity === 'warn').length;
  const verdict = failCount > 0 ? 'FAIL' : (warnCount > 0 ? 'WARN' : 'PASS');
  const summary = failCount > 0
    ? `TRUTH SMOKE FAIL | ${checks.filter((item) => !item.ok && item.severity !== 'warn').map((item) => item.id).join(', ')}`
    : (warnCount > 0
      ? `TRUTH SMOKE WARN | ${checks.filter((item) => !item.ok && item.severity === 'warn').map((item) => item.id).join(', ')}`
      : 'TRUTH SMOKE PASS | Performance -> MASTER -> ArtNet path looks aligned');

  return {
    ok: true,
    version: STEP22FG_FIELD_DECISION_VERSION,
    verdict,
    summary,
    running: !!status.running,
    checks
  };
}


function buildMarkdownReport({ gate, longRun, status }) {
  const report = longRun?.longRun?.report || null;
  const lines = [];
  lines.push('# BudiLight ArtNet Live Stability Report');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Version: ${STEP22EY_REPORT_EXPORT_VERSION}`);
  lines.push('');
  lines.push('## Verdict');
  lines.push(`- Verdict: ${gate?.verdict || '-'}`);
  lines.push(`- Score: ${gate?.score ?? '-'} / 100`);
  lines.push(`- Next: ${gate?.next || '-'}`);
  lines.push(`- Issues: ${(gate?.issues || []).join('; ') || 'none'}`);
  lines.push(`- Warnings: ${(gate?.warnings || []).join('; ') || 'none'}`);
  lines.push('');
  lines.push('## Long run summary');
  if (report) {
    lines.push(`- Reason: ${report.reason || '-'}`);
    lines.push(`- Elapsed: ${report.elapsedSec ?? '-'} s`);
    lines.push(`- Sent frames: ${report.sentFrames ?? '-'}`);
    lines.push(`- Skipped frames: ${report.skippedFrames ?? '-'} (${report.skipRatePct ?? '-'} %)`);
    lines.push(`- Actual FPS: ${report.actualFps ?? '-'}`);
    lines.push(`- Packets: ${report.packets ?? '-'}`);
    lines.push(`- UDP errors: ${report.udpCallbackErrors ?? '-'}`);
    lines.push(`- Jitter avg/max: ${report.jitterAvgMs ?? '-'} / ${report.jitterMaxMs ?? '-'} ms`);
    lines.push(`- Batch latency avg/max: ${report.batchLatencyAvgMs ?? '-'} / ${report.batchLatencyMaxMs ?? '-'} ms`);
    lines.push(`- Late ticks: ${report.lateTicks ?? '-'}`);
    lines.push(`- Adaptive FPS drops: ${report.adaptiveFpsDrops ?? '-'}`);
    lines.push(`- Last send reason: ${report.lastSendReason || '-'}`);
  } else {
    lines.push('- No long-run report captured yet.');
  }
  lines.push('');
  lines.push('## Current output settings');
  const opts = status?.options || {};
  for (const key of ['outputIp','targetMode','bindIp','fps','stripCount','pixelsPerStrip','universeStart','pixelsPerUniverse','packetPaceMs','packetsPerBurst','packetOrder','artSyncMode','backpressure','lastGoodHoldMs','adaptiveFrameClock','adaptiveFloorFps']) {
    if (opts[key] != null) lines.push(`- ${key}: ${opts[key]}`);
  }
  lines.push('');
  lines.push('## Field checklist');
  lines.push('- [ ] Performance page open and MASTER mirror fresh');
  lines.push('- [ ] Target node IP verified');
  lines.push('- [ ] Universe range matches physical node mapping');
  lines.push('- [ ] Strip scan visually matches expected strip order');
  lines.push('- [ ] Pixel probe confirms direction and RGB order');
  lines.push('- [ ] Long run completed without visible LED freeze');
  lines.push('- [ ] Stability gate result recorded');
  lines.push('');
  return lines.join('\n');
}

export function registerArtNetSyncLiveRoutes22DQ(app, { expressRef, liveSender22DQ } = {}) {
  const jsonParser = expressRef?.json?.({ limit: '12mb' });

  app.get('/api/artnet/sync-live/plan', (req, res) => {
    try { res.json(buildStep22DqLivePlan(req.query || {})); }
    catch (error) { res.status(400).json({ ok: false, version: STEP22DQ_ARTNET_SYNC_LIVE_VERSION, error: error.message }); }
  });

  app.get('/api/artnet/sync-live/status', (req, res) => {
    try { res.json(liveSender22DQ.status()); }
    catch (error) { res.status(500).json({ ok: false, version: STEP22DQ_ARTNET_SYNC_LIVE_VERSION, error: error.message }); }
  });

  app.post('/api/artnet/sync-live/frame', jsonParser, (req, res) => {
    try {
      const body = req.body || {};
      const frame = buildStep22DqFrame({ ...body, rgb: body.rgb || body.frame || body.payload });
      res.json({
        ok: true,
        version: STEP22DQ_ARTNET_SYNC_LIVE_VERSION,
        summary: frame.summary,
        events: frame.events,
        map: frame.map,
        packetPreview: frame.packets.slice(0, 3).map((packet) => ({
          universe: packet.universe ?? null,
          opCode: packet.opCode,
          packetBytes: packet.packetBytes,
          firstBytes: Array.from(packet.packet.slice(0, 18)).map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join(' ')
        }))
      });
    } catch (error) {
      res.status(400).json({ ok: false, version: STEP22DQ_ARTNET_SYNC_LIVE_VERSION, error: error.message });
    }
  });

  app.post('/api/artnet/sync-live/prime-socket', jsonParser, (req, res) => {
    try { res.json(liveSender22DQ.primeSocket(req.body || {})); }
    catch (error) { res.status(400).json({ ok: false, version: STEP22DQ_ARTNET_SYNC_LIVE_VERSION, error: error.message }); }
  });

  app.post('/api/artnet/sync-live/start', jsonParser, (req, res) => {
    try { res.json(liveSender22DQ.start(req.body || {})); }
    catch (error) { res.status(400).json({ ok: false, version: STEP22DQ_ARTNET_SYNC_LIVE_VERSION, error: error.message }); }
  });

  app.post('/api/artnet/sync-live/stop', jsonParser, (req, res) => {
    try { res.json(liveSender22DQ.stop()); }
    catch (error) { res.status(500).json({ ok: false, version: STEP22DQ_ARTNET_SYNC_LIVE_VERSION, error: error.message }); }
  });

  app.post('/api/artnet/sync-live/send-one', jsonParser, (req, res) => {
    try { res.json(liveSender22DQ.sendOneFrame(req.body || {})); }
    catch (error) { res.status(400).json({ ok: false, version: STEP22DQ_ARTNET_SYNC_LIVE_VERSION, error: error.message }); }
  });
  app.get('/api/artnet/sync-live/watchdog', (req, res) => {
    try { res.json(liveSender22DQ.watchdog()); }
    catch (error) { res.status(500).json({ ok: false, version: STEP22DQ_ARTNET_SYNC_LIVE_VERSION, error: error.message }); }
  });

  app.post('/api/artnet/sync-live/blackout', jsonParser, (req, res) => {
    try { res.json(liveSender22DQ.blackout(req.body || {})); }
    catch (error) { res.status(400).json({ ok: false, version: STEP22DQ_ARTNET_SYNC_LIVE_VERSION, error: error.message }); }
  });

  app.post('/api/artnet/sync-live/reset-profiler', jsonParser, (req, res) => {
    try { res.json(liveSender22DQ.resetProfiler()); }
    catch (error) { res.status(500).json({ ok: false, version: STEP22DQ_ARTNET_SYNC_LIVE_VERSION, error: error.message }); }
  });

  app.get('/api/artnet/sync-live/long-run-report', (req, res) => {
    try { res.json(liveSender22DQ.longRunReport()); }
    catch (error) { res.status(500).json({ ok: false, version: STEP22DQ_ARTNET_SYNC_LIVE_VERSION, error: error.message }); }
  });

  app.get('/api/artnet/sync-live/stability-gate', (req, res) => {
    try { res.json(liveSender22DQ.stabilityGate()); }
    catch (error) { res.status(500).json({ ok: false, version: STEP22EX_STABILITY_GATE_VERSION, error: error.message }); }
  });


  app.post('/api/artnet/sync-live/export-report', jsonParser, (req, res) => {
    try {
      const body = req.body || {};
      const longRun = liveSender22DQ.longRunReport();
      const gate = liveSender22DQ.stabilityGate();
      const status = liveSender22DQ.status();
      const payload = {
        ok: true,
        version: STEP22EY_REPORT_EXPORT_VERSION,
        generatedAt: new Date().toISOString(),
        note: String(body.note || '').slice(0, 2000),
        operator: String(body.operator || '').slice(0, 120),
        longRun,
        stabilityGate: gate,
        status
      };
      const reportsDir = path.resolve(process.cwd(), 'data', 'reports');
      fs.mkdirSync(reportsDir, { recursive: true });
      const base = `step22ey-live-report-${safeFileStamp()}`;
      const jsonPath = path.join(reportsDir, `${base}.json`);
      const mdPath = path.join(reportsDir, `${base}.md`);
      const markdown = buildMarkdownReport({ gate, longRun, status });
      fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2));
      fs.writeFileSync(mdPath, markdown);
      res.json({ ok: true, version: STEP22EY_REPORT_EXPORT_VERSION, files: { json: path.relative(process.cwd(), jsonPath), markdown: path.relative(process.cwd(), mdPath) }, report: payload, markdown });
    } catch (error) {
      res.status(500).json({ ok: false, version: STEP22EY_REPORT_EXPORT_VERSION, error: error.message });
    }
  });


  app.get('/api/artnet/sync-live/reports', (req, res) => {
    try {
      const limit = Math.max(1, Math.min(100, Number(req.query?.limit) || 24));
      const rows = listSavedReportRows(limit);
      res.json({ ok: true, version: STEP22EZ_REPORT_COMPARE_VERSION, count: rows.length, rows });
    } catch (error) {
      res.status(500).json({ ok: false, version: STEP22EZ_REPORT_COMPARE_VERSION, error: error.message });
    }
  });

  app.get('/api/artnet/sync-live/compare-reports', (req, res) => {
    try {
      const limit = Math.max(1, Math.min(100, Number(req.query?.limit) || 24));
      res.json(compareReportRows(listSavedReportRows(limit)));
    } catch (error) {
      res.status(500).json({ ok: false, version: STEP22EZ_REPORT_COMPARE_VERSION, error: error.message });
    }
  });

  app.get('/api/artnet/sync-live/best-settings', (req, res) => {
    try {
      const limit = Math.max(1, Math.min(100, Number(req.query?.limit) || 24));
      res.json(buildBestSettingsPayload(listSavedReportRows(limit)));
    } catch (error) {
      res.status(500).json({ ok: false, version: STEP22FA_BEST_SETTINGS_VERSION, error: error.message });
    }
  });


  app.get('/api/artnet/sync-live/saved-best-settings', (req, res) => {
    try {
      const payload = readSavedBestSettingsPreset();
      res.status(payload.ok ? 200 : 404).json(payload);
    } catch (error) {
      res.status(500).json({ ok: false, version: STEP22FB_AUTO_LOAD_BEST_SETTINGS_VERSION, error: error.message });
    }
  });


  app.get('/api/artnet/sync-live/profiles', (req, res) => {
    try { res.json(listLiveProfiles()); }
    catch (error) { res.status(500).json({ ok: false, version: STEP22FC_LIVE_PROFILE_MANAGER_VERSION, error: error.message }); }
  });

  app.get('/api/artnet/sync-live/profile', (req, res) => {
    try {
      const name = req.query?.name || readLiveProfilesStore().activeProfile || 'default-live-profile';
      const payload = loadLiveProfile(name);
      res.status(payload.ok ? 200 : 404).json(payload);
    } catch (error) { res.status(500).json({ ok: false, version: STEP22FC_LIVE_PROFILE_MANAGER_VERSION, error: error.message }); }
  });

  app.post('/api/artnet/sync-live/save-profile', jsonParser, (req, res) => {
    try {
      const payload = saveLiveProfile(req.body || {});
      res.status(payload.ok ? 200 : 400).json(payload);
    } catch (error) { res.status(500).json({ ok: false, version: STEP22FC_LIVE_PROFILE_MANAGER_VERSION, error: error.message }); }
  });

  app.post('/api/artnet/sync-live/delete-profile', jsonParser, (req, res) => {
    try {
      const payload = deleteLiveProfile(req.body?.name || req.body?.profileName || '');
      res.status(payload.ok ? 200 : 404).json(payload);
    } catch (error) { res.status(500).json({ ok: false, version: STEP22FC_LIVE_PROFILE_MANAGER_VERSION, error: error.message }); }
  });


  app.get('/api/artnet/sync-live/readiness', (req, res) => {
    try {
      res.json(buildLiveReadinessDashboard(liveSender22DQ.status()));
    } catch (error) {
      res.status(500).json({ ok: false, version: STEP22FD_LIVE_READINESS_DASHBOARD_VERSION, error: error.message });
    }
  });



  app.get('/api/artnet/sync-live/guided-run', (req, res) => {
    try {
      res.json(buildGuidedLiveRunPlan(liveSender22DQ.status()));
    } catch (error) {
      res.status(500).json({ ok: false, version: STEP22FE_GUIDED_LIVE_RUN_VERSION, error: error.message });
    }
  });


  app.get('/api/artnet/sync-live/preflight', (req, res) => {
    try {
      res.json(buildLivePreflightGate(liveSender22DQ.status()));
    } catch (error) {
      res.status(500).json({ ok: false, version: STEP22FF_LIVE_PREFLIGHT_VERSION, error: error.message });
    }
  });

  app.get('/api/artnet/sync-live/field-decision', (req, res) => {
    try {
      res.json(buildFieldTestDecision(liveSender22DQ.status()));
    } catch (error) {
      res.status(500).json({ ok: false, version: STEP22FG_FIELD_DECISION_VERSION, error: error.message });
    }
  });

  app.get('/api/artnet/sync-live/truth-smoke', (req, res) => {
    try {
      res.json(buildMasterTruthSmoke(liveSender22DQ.status()));
    } catch (error) {
      res.status(500).json({ ok: false, version: STEP22FG_FIELD_DECISION_VERSION, error: error.message });
    }
  });

  app.post('/api/artnet/sync-live/save-best-settings', jsonParser, (req, res) => {
    try {
      const limit = Math.max(1, Math.min(100, Number(req.body?.limit) || 24));
      const payload = buildBestSettingsPayload(listSavedReportRows(limit));
      if (!payload.ok) return res.status(404).json(payload);
      const outPath = bestSettingsPresetPath();
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, JSON.stringify({ ...payload, savedAt: new Date().toISOString() }, null, 2));
      res.json({ ...payload, file: path.relative(process.cwd(), outPath) });
    } catch (error) {
      res.status(500).json({ ok: false, version: STEP22FA_BEST_SETTINGS_VERSION, error: error.message });
    }
  });

}
