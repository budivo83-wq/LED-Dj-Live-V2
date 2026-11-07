import dgram from 'dgram';
import { buildArtnetDryRunFrame, buildStep22DoPlan } from './artnet_live_tx_22do.js';
import { buildSyncClockPlan, buildSyncClockSnapshot, buildDeterministicEventPlan } from './sync_clock_22dp.js';
import { artnetMasterFrameStore22EJ, STEP22EJ_ARTNET_MASTER_FRAME_VERSION } from './artnet_master_frame_store_22ej.js';
import { ARTNET_LIVE_DEFAULTS, withArtnetLiveDefaults } from '../../shared/artnet_live_defaults.js';
import { serverOutputRegistry37BC } from '../server/server_output_registry_37bc.js';

const STEP37BC_ARTNET_SERVER_OWNER = 'artnet-sync-live-sender-22dq';
function assertValidArtNetIp37CN(ip, label = 'ip') {
  const value = String(ip || '').trim();
  if (!value) return;
  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(value)) throw new Error(`${label}_INVALID_IPV4_${value}`);
  const parts = value.split('.').map((x) => Number(x));
  if (parts.some((x) => !Number.isInteger(x) || x < 0 || x > 255)) throw new Error(`${label}_INVALID_IPV4_${value}`);
}


export const STEP22DQ_ARTNET_SYNC_LIVE_VERSION = 'STEP22NW_WORKER_CLOCK_MASTER_DRIVEN_60';
export const STEP22ED_REAL_LIVE_FEATURE_VERSION = 'STEP22ED_REAL_CONTINUOUS_LIVE_TX';
export const STEP22EE_BROADCAST_TX_FEATURE_VERSION = 'STEP22EE_BROADCAST_TARGET_MODE_TX';
export const STEP22EF_UDP_SEND_CALLBACK_VERSION = 'STEP22EF_UDP_SEND_CALLBACK_CONFIRM';
export const STEP22EG_SAFE_LIVE_FREEZE_GUARD_VERSION = 'STEP22EG_SAFE_LIVE_FREEZE_GUARD';
export const STEP22EH_ULTRA_SAFE_LIVE_LOOP_VERSION = 'STEP22EH_ULTRA_SAFE_LIGHTWEIGHT_LIVE_LOOP';
export const STEP22EJ_MASTER_FRAMEBUS_ARTNET_VERSION = STEP22EJ_ARTNET_MASTER_FRAME_VERSION;
export const STEP22ER_PACKET_PACER_VERSION = 'STEP22ER_PACKET_PACER_STABLE_SENDER';
export const STEP22ES_ARTSYNC_LATCH_VERSION = 'STEP22ES_ARTSYNC_LATCH_CONTROL';
export const STEP22ET_BACKPRESSURE_GUARD_VERSION = 'STEP22ET_BACKPRESSURE_GUARD_ADAPTIVE_SKIP';
export const STEP22EU_FRAME_CLOCK_VERSION = 'STEP22EU_DETERMINISTIC_FRAME_CLOCK_LAST_GOOD_CACHE';
export const STEP22EV_LIVE_PROFILER_VERSION = 'STEP22EV_LIVE_JITTER_LATENCY_PROFILER_PACKET_ORDER';
export const STEP22EW_LONG_RUN_TEST_VERSION = 'STEP22EW_LONG_RUN_STABILITY_TEST_REPORT';
export const STEP22EX_STABILITY_GATE_VERSION = 'STEP22EX_LIVE_STABILITY_GATE_EXPORT';
export const STEP22EY_REPORT_EXPORT_VERSION = 'STEP22EY_LIVE_REPORT_EXPORT_CHECKLIST';
export const STEP22EZ_REPORT_COMPARE_VERSION = 'STEP22EZ_LIVE_REPORT_COMPARE_SCOREBOARD';
export const STEP22FA_BEST_SETTINGS_VERSION = 'STEP22FA_BEST_REPORT_SETTINGS_APPLIER';
export const STEP22FB_AUTO_LOAD_BEST_SETTINGS_VERSION = 'STEP22FB_AUTO_LOAD_BEST_LIVE_PRESET';
export const STEP22FC_LIVE_PROFILE_MANAGER_VERSION = 'STEP22FC_LIVE_PROFILE_MANAGER';
export const STEP22FD_LIVE_READINESS_DASHBOARD_VERSION = 'STEP22FD_LIVE_READINESS_DASHBOARD';
export const STEP22FE_GUIDED_LIVE_RUN_VERSION = 'STEP22FE_GUIDED_LIVE_RUN_SEQUENCE';
export const STEP22FF_LIVE_PREFLIGHT_VERSION = 'STEP22FF_LIVE_PREFLIGHT_GATE';
export const STEP22FG_FIELD_DECISION_VERSION = 'STEP22FG_FIELD_TEST_DECISION_PANEL';
export const STEP37BZ_BACKEND_WRITER_GUARD_VERSION = 'STEP37BZ_BACKEND_WRITER_GUARD';


function summarizePacketTargets37CK(packets = [], fallbackIp = '', fallbackPort = 6454) {
  const map = new Map();
  for (const packet of packets || []) {
    const host = String(packet?.targetIp || packet?.host || fallbackIp || '').trim() || 'default';
    const port = clampInt(packet?.targetPort ?? packet?.port ?? fallbackPort, 1, 65535, fallbackPort || 6454);
    const key = `${host}:${port}`;
    const row = map.get(key) || { host, port, packets: 0, universes: [] };
    row.packets += 1;
    if (packet?.universe != null && row.universes.length < 48) row.universes.push(packet.universe);
    map.set(key, row);
  }
  return [...map.values()].sort((a, b) => String(a.host).localeCompare(String(b.host)) || a.port - b.port);
}

function latestPatch37CK(framePatch = null, optionPatch = null) {
  return framePatch || optionPatch || artnetMasterFrameStore22EJ.getLatestPatch?.() || null;
}

function resolveFrameDimensions37CS({ frame = null, patch = null, options = {}, fallbackStripCount = 8, fallbackPixelsPerStrip = 300 } = {}) {
  const patchWidth = clampInt(patch?.width ?? patch?.pixelsPerStrip, 1, 20000, 0);
  const patchHeight = clampInt(patch?.height ?? patch?.stripCount, 1, 256, 0);
  const width = clampInt(frame?.width ?? frame?.pixelsPerStrip ?? patchWidth ?? options.width ?? options.pixelsPerStrip, 1, 20000, fallbackPixelsPerStrip);
  const height = clampInt(frame?.height ?? frame?.stripCount ?? patchHeight ?? options.height ?? options.stripCount, 1, 256, fallbackStripCount);
  return { width, height, stripCount: height, pixelsPerStrip: width, patchWidth, patchHeight };
}

function analyzeStripBrightness37CS({ frame = null, packets = [], patch = null, width = 300, height = 8 } = {}) {
  const pixelsPerStrip = clampInt(width, 1, 20000, 300);
  const stripCount = clampInt(height, 1, 256, 8);
  const bytes = frame instanceof Uint8Array ? frame : new Uint8Array(frame || []);
  const strips = [];
  for (let strip = 0; strip < stripCount; strip += 1) {
    const start = strip * pixelsPerStrip * 3;
    const end = Math.min(bytes.length, start + pixelsPerStrip * 3);
    let sum = 0;
    let max = 0;
    let samples = 0;
    for (let i = start; i + 2 < end; i += 3) {
      const v = (Number(bytes[i] || 0) + Number(bytes[i + 1] || 0) + Number(bytes[i + 2] || 0)) / 3;
      sum += v;
      max = Math.max(max, v);
      samples += 1;
    }
    strips.push({ strip: strip + 1, sourceAvg: samples ? Number((sum / samples).toFixed(2)) : 0, sourceMax: Number(max.toFixed(2)), outputAvg: 0, outputMax: 0, outputSamples: 0, routeGain: null, routes: 0 });
  }
  const routeByUniverse = new Map();
  for (const route of Array.isArray(patch?.routes) ? patch.routes : []) {
    const universeSize = clampInt(route.universeSize ?? patch?.pixelsPerUniverse ?? patch?.universeSize, 1, 170, 170);
    const rawStart = clampInt(route.startAddress, 0, 2000000, 0);
    const normalizedUniverse = clampInt(route.universe, 0, 63999, 0) + Math.floor(rawStart / universeSize);
    const startAddress = rawStart % universeSize;
    const key = `${String(route.outputIp || route.targetIp || route.host || '')}:${clampInt(route.port || route.targetPort, 1, 65535, 6454)}:${normalizedUniverse}`;
    const list = routeByUniverse.get(key) || [];
    list.push({ route, startAddress, pixelCount: clampInt(route.pixelCount, 1, 65535, 1) });
    routeByUniverse.set(key, list);
    const si = clampInt(route.stripIndex, 0, 255, 0);
    if (strips[si]) {
      const b = Number(route.brightness ?? 1) || 1;
      const w = Number(route.whiteLimit ?? 1) || 1;
      const gain = Math.max(0, Math.min(1, b)) * Math.max(0, Math.min(1, w));
      strips[si].routeGain = strips[si].routeGain == null ? gain : Math.min(strips[si].routeGain, gain);
      strips[si].routes += 1;
    }
  }
  const packetSums = strips.map(() => ({ sum: 0, max: 0, samples: 0 }));
  for (const packet of packets || []) {
    if (!packet || packet.opCode !== 'OpDmx' || !(packet.packet instanceof Uint8Array)) continue;
    const key = `${String(packet.targetIp || packet.host || '')}:${clampInt(packet.targetPort || packet.port, 1, 65535, 6454)}:${clampInt(packet.universe, 0, 63999, 0)}`;
    const routes = routeByUniverse.get(key) || routeByUniverse.get(`:${clampInt(packet.targetPort || packet.port, 1, 65535, 6454)}:${clampInt(packet.universe, 0, 63999, 0)}`) || [];
    const payload = packet.packet;
    for (const item of routes) {
      const si = clampInt(item.route.stripIndex, 0, 255, 0);
      const bucket = packetSums[si];
      if (!bucket) continue;
      const start = 18 + item.startAddress * 3;
      const end = Math.min(payload.length, start + item.pixelCount * 3);
      for (let i = start; i + 2 < end; i += 3) {
        const v = (Number(payload[i] || 0) + Number(payload[i + 1] || 0) + Number(payload[i + 2] || 0)) / 3;
        bucket.sum += v;
        bucket.max = Math.max(bucket.max, v);
        bucket.samples += 1;
      }
    }
  }
  for (let i = 0; i < strips.length; i += 1) {
    const b = packetSums[i];
    strips[i].outputSamples = b.samples;
    strips[i].outputAvg = b.samples ? Number((b.sum / b.samples).toFixed(2)) : 0;
    strips[i].outputMax = Number(b.max.toFixed(2));
    if (strips[i].routeGain != null) strips[i].routeGain = Number(strips[i].routeGain.toFixed(3));
  }
  const first8 = strips.slice(0, 8).filter((s) => s.outputSamples > 0 || s.sourceAvg > 0);
  const after8 = strips.slice(8).filter((s) => s.outputSamples > 0 || s.sourceAvg > 0);
  const avg = (arr, key) => arr.length ? arr.reduce((sum, x) => sum + Number(x[key] || 0), 0) / arr.length : 0;
  const first8Out = avg(first8, 'outputAvg');
  const after8Out = avg(after8, 'outputAvg');
  const warnings = [];
  if (after8.length && first8Out > 0 && after8Out / first8Out >= 1.35) warnings.push(`OUTPUT_BRIGHTNESS_SPLIT: strips 9+ avg ${after8Out.toFixed(1)} vs first8 ${first8Out.toFixed(1)}`);
  if (after8.length && stripCount <= 8) warnings.push('FRAME_DIMENSION_MISMATCH: patch/hardware seems to use more than 8 strips, but live frame options are 8 high.');
  const lowGain = strips.filter((s) => s.routeGain != null && s.routeGain < 0.98);
  if (lowGain.length) warnings.push(`ROUTE_GAIN_NOT_NEUTRAL: ${lowGain.map((s) => `S${s.strip}=${s.routeGain}`).join(', ')}`);
  const noOutput = strips.filter((s) => s.routes > 0 && s.outputSamples === 0).map((s) => `S${s.strip}`);
  if (noOutput.length) warnings.push(`PATCH_ROUTE_NO_OUTPUT_SAMPLES: ${noOutput.join(', ')}`);
  return {
    version: 'STEP37CS_STRIP_OUTPUT_BRIGHTNESS_TRACE',
    width: pixelsPerStrip,
    height: stripCount,
    frameBytes: bytes.length,
    packetCount: Array.isArray(packets) ? packets.length : 0,
    first8OutputAvg: Number(first8Out.toFixed(2)),
    after8OutputAvg: Number(after8Out.toFixed(2)),
    after8VsFirst8Ratio: first8Out > 0 && after8Out > 0 ? Number((after8Out / first8Out).toFixed(3)) : null,
    warnings,
    strips
  };
}
function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function clampByte(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(255, Math.round(n)));
}


function isIpv4(value) {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(String(value || '').trim());
}

function subnetBroadcastFromIp(value) {
  const ip = String(value || '').trim();
  if (!isIpv4(ip)) return '255.255.255.255';
  const parts = ip.split('.').map((x) => Math.max(0, Math.min(255, Number(x) || 0)));
  return `${parts[0]}.${parts[1]}.${parts[2]}.255`;
}

function resolveTargetAddress(options = {}, stateOptions = {}) {
  const targetMode = String(options.targetMode || stateOptions.targetMode || 'unicast').trim();
  const bindIp = String(options.bindIp || options.localAddress || stateOptions.bindIp || stateOptions.localAddress || '').trim();
  const configured = String(options.outputIp || options.host || stateOptions.outputIp || stateOptions.host || '2.1.1.30').trim();
  if (targetMode === 'global-broadcast') return { targetIp: '255.255.255.255', targetMode, broadcast: true, configuredOutputIp: configured };
  if (targetMode === 'subnet-broadcast') return { targetIp: subnetBroadcastFromIp(bindIp), targetMode, broadcast: true, configuredOutputIp: configured };
  if (configured.endsWith('.255') || configured === '255.255.255.255') return { targetIp: configured, targetMode: 'broadcast-ip', broadcast: true, configuredOutputIp: configured };
  return { targetIp: configured, targetMode: 'unicast', broadcast: false, configuredOutputIp: configured };
}

function makeBlackFrame({ stripCount = 8, pixelsPerStrip = 300 } = {}) {
  return new Uint8Array(clampInt(stripCount, 1, 64, 8) * clampInt(pixelsPerStrip, 1, 1000, 300) * 3);
}

const MASTER_FRAME_SOURCE_PATTERNS = Object.freeze([
  'master',
  'master-frame',
  'master-framebus',
  'app-master',
  'performance-master'
]);

const EXPLICIT_GENERATOR_PATTERNS = Object.freeze([
  'visible-chase'
]);


const BACKEND_WRITER_FORBIDDEN_SOURCES_37BZ = Object.freeze([
  'visible-chase',
  'test-generator',
  'fallback',
  'startup-fallback',
  'preview',
  'debug',
  'probe',
  'gallery',
  'thumbnail'
]);

function backendWriterGuard37BZ(state, frameOptions = {}, context = 'send-one') {
  const visualPattern = String(frameOptions.visualPattern || frameOptions.pattern || state.options?.visualPattern || '').toLowerCase();
  const sourceMode = String(frameOptions.sourceMode || state.options?.sourceMode || '').toLowerCase();
  const frameClockSource = String(frameOptions.frameClockSource || '').toLowerCase();
  const source = String(frameOptions.source || frameOptions.writer || frameOptions.owner || '').toLowerCase();
  const isUdpLive = state.mode === 'udp-armed' && state.running === true;
  const isMasterLive = isUdpLive
    && state.masterDriven?.enabled === true
    && String(state.options?.visualPattern || '').toLowerCase() === 'master-framebus';
  const hasExplicitRgb = frameOptions.rgb instanceof Uint8Array || frameOptions.frame instanceof Uint8Array || Array.isArray(frameOptions.rgb) || Array.isArray(frameOptions.frame);
  const explicitOperator = frameOptions.operatorIntent === true || frameOptions.operatorIntent === 'true' || frameOptions.allowBackendWriter === true || frameOptions.allowBackendWriter === 'true';
  const isMasterFrame = frameOptions.masterFrameSnapshot?.frame instanceof Uint8Array
    || frameOptions.frameClockSource === 'master-live-fresh'
    || frameOptions.frameClockSource === 'master-ws-event-direct-fastpath'
    || frameOptions.frameClockSource === 'master-ws-event-direct';
  const haystack = `${visualPattern} ${sourceMode} ${frameClockSource} ${source}`;
  const forbidden = BACKEND_WRITER_FORBIDDEN_SOURCES_37BZ.find((token) => haystack.includes(token));

  if (!isUdpLive) return { ok: true, allowed: true, reason: 'not-live-udp' };
  if (context === 'master-event' || isMasterFrame) return { ok: true, allowed: true, reason: 'master-frame-event' };
  if (explicitOperator && (visualPattern === 'blackout' || visualPattern === 'black' || hasExplicitRgb)) return { ok: true, allowed: true, reason: 'explicit-operator-frame' };
  if (isMasterLive) {
    if (forbidden) return { ok: false, allowed: false, reason: 'backend-writer-forbidden-source', forbidden, context, visualPattern, sourceMode, frameClockSource, source };
    if (sourceMode === 'test-generator' || visualPattern === 'visible-chase') return { ok: false, allowed: false, reason: 'backend-generator-blocked-during-master-live', context, visualPattern, sourceMode };
    if (!hasExplicitRgb && !isMasterFrame && !explicitOperator) return { ok: false, allowed: false, reason: 'backend-autonomous-frame-blocked-during-master-live', context, visualPattern, sourceMode };
  }
  return { ok: true, allowed: true, reason: 'allowed' };
}

const SOURCE_MODES = Object.freeze([
  'performance-master-only',
  'master-with-cache',
  'test-generator',
  'explicit-frame'
]);

function wantsMasterFrameSource(value) {
  return MASTER_FRAME_SOURCE_PATTERNS.includes(String(value || '').trim());
}

function normalizeVisualPattern(value, fallback = 'master-framebus') {
  const pattern = String(value || '').trim();
  if (wantsMasterFrameSource(pattern)) return pattern;
  if (pattern === 'black' || pattern === 'blackout') return pattern;
  if (EXPLICIT_GENERATOR_PATTERNS.includes(pattern)) return pattern;
  return fallback;
}

function normalizeSourceMode(value, fallback = 'performance-master-only') {
  const mode = String(value || '').trim();
  return SOURCE_MODES.includes(mode) ? mode : fallback;
}

function resolveSourcePolicy(frameOptions = {}, stateOptions = {}) {
  const sourceMode = normalizeSourceMode(frameOptions.sourceMode || stateOptions.sourceMode, 'performance-master-only');
  const visualPattern = normalizeVisualPattern(frameOptions.visualPattern || frameOptions.pattern || stateOptions.visualPattern, 'master-framebus');
  const wantsMaster = wantsMasterFrameSource(visualPattern);
  return Object.freeze({
    sourceMode,
    visualPattern,
    wantsMaster,
    allowMasterCache: sourceMode === 'master-with-cache',
    allowSyntheticGenerator: sourceMode === 'test-generator',
    allowExplicitFrame: sourceMode === 'explicit-frame' || sourceMode === 'test-generator' || !wantsMaster
  });
}



function missingExplicitArtDmxTargets37CP(packets = []) {
  const missing = [];
  for (const packet of packets || []) {
    if (!packet || packet.universe == null) continue;
    const host = String(packet.targetIp || packet.host || '').trim();
    if (!host) missing.push({ universe: packet.universe, bytes: Number(packet.packetBytes || packet.packet?.length || 0) });
  }
  return missing;
}

function requireExplicitPacketTargets37CP(packets = [], { required = true, context = 'artnet-live' } = {}) {
  if (!required) return { ok: true, missing: [] };
  const missing = missingExplicitArtDmxTargets37CP(packets);
  if (!missing.length) return { ok: true, missing };
  return {
    ok: false,
    blocked: true,
    reason: 'ARTNET_PACKET_TARGET_MISSING_EXPLICIT_SLOT_IP',
    context,
    missingCount: missing.length,
    missing: missing.slice(0, 16),
    note: 'Live ArtNet neposílá fallback na default IP. Každý ArtDmx packet musí vzniknout ze zapnutého Mapping/MultiOut slotu s vyplněnou IP.'
  };
}

function rememberUdpTruth37CP(state, detail = {}) {
  if (!state) return;
  const now = Date.now();
  const targets = Array.isArray(detail.packetTargets) ? detail.packetTargets : [];
  const row = Object.freeze({
    at: now,
    bindIp: String(detail.bindIp || state.socketBindIp || state.options?.bindIp || state.options?.localAddress || '').trim(),
    socketAddress: detail.socketAddress || state.socketAddressSnapshot || null,
    targetIp: String(detail.targetIp || '').trim(),
    targetPort: Number(detail.targetPort || state.options?.port || 6454) || 6454,
    packetCount: Number(detail.packetCount || 0) || 0,
    bytes: Number(detail.bytes || 0) || 0,
    packetTargets: targets.slice(0, 12)
  });
  if (!Array.isArray(state.udpTruthLog37CP)) state.udpTruthLog37CP = [];
  state.udpTruthLog37CP.push(row);
  while (state.udpTruthLog37CP.length > 16) state.udpTruthLog37CP.shift();
  state.lastUdpTruth37CP = row;
}

function summarizePackets(packets = []) {
  let artDmxCount = 0;
  let bytes = 0;
  let universeMin = null;
  let universeMax = null;
  const universeSet = new Set();
  for (const packet of packets) {
    if (!packet) continue;
    bytes += Number(packet.packetBytes || packet.packet?.length || 0);
    if (packet.universe == null) continue;
    const universe = Number(packet.universe);
    if (!Number.isFinite(universe)) continue;
    artDmxCount += 1;
    universeSet.add(universe);
    universeMin = universeMin == null ? universe : Math.min(universeMin, universe);
    universeMax = universeMax == null ? universe : Math.max(universeMax, universe);
  }
  const missing = [];
  if (artDmxCount > 0 && universeMin != null && universeMax != null) {
    for (let u = universeMin; u <= universeMax; u += 1) {
      if (!universeSet.has(u)) missing.push(u);
    }
  }
  return Object.freeze({
    packetCount: packets.length,
    artDmxCount,
    artSyncCount: Math.max(0, packets.length - artDmxCount),
    universeMin,
    universeMax,
    missingUniverses: missing,
    bytes
  });
}

function reorderArtDmxPacketsForLive(packets = [], order = 'sequential') {
  const mode = String(order || 'sequential').trim().toLowerCase();
  if (mode !== 'interleaved-v2' && mode !== 'split-half') return packets;
  const art = packets.filter((p) => p && p.universe != null);
  const other = packets.filter((p) => !p || p.universe == null);
  if (art.length < 4) return packets;
  const sorted = [...art].sort((a, b) => Number(a.universe) - Number(b.universe));
  const half = Math.ceil(sorted.length / 2);
  const out = [];
  for (let i = 0; i < half; i += 1) {
    if (sorted[i]) out.push(sorted[i]);
    if (sorted[i + half]) out.push(sorted[i + half]);
  }
  return [...out, ...other];
}

function newLiveProfilerState() {
  return {
    version: STEP22EV_LIVE_PROFILER_VERSION,
    enabled: true,
    resetAt: Date.now(),
    targetIntervalMs: 0,
    tickSamples: 0,
    sendSamples: 0,
    batchSamples: 0,
    lastTickAt: 0,
    lastSendAt: 0,
    tickIntervalMs: { min: null, max: 0, avg: 0, last: null, jitterMaxMs: 0, jitterAvgMs: 0 },
    tickDurationMs: { min: null, max: 0, avg: 0, last: null },
    sendIntervalMs: { min: null, max: 0, avg: 0, last: null, jitterMaxMs: 0, jitterAvgMs: 0 },
    batchLatencyMs: { min: null, max: 0, avg: 0, last: null },
    packetOrder: 'sequential',
    phasesMs: {
      resolveFrame: { min: null, max: 0, avg: 0, last: null },
      buildFrame: { min: null, max: 0, avg: 0, last: null },
      reorderPackets: { min: null, max: 0, avg: 0, last: null },
      summarizePackets: { min: null, max: 0, avg: 0, last: null },
      queueSend: { min: null, max: 0, avg: 0, last: null }
    }
  };
}

function newLongRunState() {
  return {
    version: STEP22EW_LONG_RUN_TEST_VERSION,
    enabled: false,
    startedAt: 0,
    plannedDurationMs: 0,
    endAt: 0,
    remainingMs: 0,
    completed: false,
    stoppedReason: null,
    startCounters: null,
    report: null
  };
}

function buildLongRunReport(state, reason = 'snapshot') {
  const now = Date.now();
  const start = state.longRun?.startCounters || {};
  const elapsedMs = state.longRun?.startedAt ? Math.max(0, now - state.longRun.startedAt) : 0;
  const sentFrames = Math.max(0, Number(state.sentFrameCount || 0) - Number(start.sentFrameCount || 0));
  const skippedFrames = Math.max(0, Number(state.skippedFrameCount || 0) - Number(start.skippedFrameCount || 0));
  const packets = Math.max(0, Number(state.packetCount || 0) - Number(start.packetCount || 0));
  const bytes = Math.max(0, Number(state.byteCount || 0) - Number(start.byteCount || 0));
  const errors = Math.max(0, Number(state.udpPacketCallbackErrorCount || 0) - Number(start.udpPacketCallbackErrorCount || 0));
  const callbacks = Math.max(0, Number(state.udpPacketCallbackCount || 0) - Number(start.udpPacketCallbackCount || 0));
  const totalFrames = sentFrames + skippedFrames;
  return {
    version: STEP22EW_LONG_RUN_TEST_VERSION,
    reason,
    elapsedMs,
    elapsedSec: Number((elapsedMs / 1000).toFixed(2)),
    plannedDurationMs: Number(state.longRun?.plannedDurationMs || 0),
    sentFrames,
    skippedFrames,
    skipRatePct: totalFrames ? Number(((skippedFrames / totalFrames) * 100).toFixed(2)) : 0,
    packets,
    bytes,
    udpCallbacksOk: callbacks,
    udpCallbackErrors: errors,
    effectiveFps: state.frameClock?.effectiveFps || 0,
    actualFps: elapsedMs ? Number((sentFrames / (elapsedMs / 1000)).toFixed(2)) : 0,
    maxTickDurationMs: state.maxTickDurationMs || 0,
    lastTickDurationMs: state.lastTickDurationMs || 0,
    lateTicks: state.frameClock?.lateTicks || 0,
    maxLatenessMs: state.frameClock?.maxLatenessMs || 0,
    adaptiveFpsDrops: state.frameClock?.adaptiveFpsDrops || 0,
    backpressureSkips: state.backpressure?.maxConsecutiveSkips || 0,
    droppedStaleBatches: state.backpressure?.droppedStaleBatches || 0,
    jitterAvgMs: state.liveProfiler?.tickIntervalMs?.jitterAvgMs || 0,
    jitterMaxMs: state.liveProfiler?.tickIntervalMs?.jitterMaxMs || 0,
    batchLatencyAvgMs: state.liveProfiler?.batchLatencyMs?.avg || 0,
    batchLatencyMaxMs: state.liveProfiler?.batchLatencyMs?.max || 0,
    packetOrder: state.liveProfiler?.packetOrder || state.options?.packetOrder || 'sequential',
    lastError: state.lastError || null,
    lastSendReason: state.lastSendResult?.reason || null
  };
}


function buildStabilityGate(state, source = 'manual') {
  const report = state.longRun?.report || buildLongRunReport(state, source);
  const issues = [];
  const warnings = [];
  let score = 100;
  const skipRate = Number(report.skipRatePct || 0);
  const jitterMax = Number(report.jitterMaxMs || 0);
  const jitterAvg = Number(report.jitterAvgMs || 0);
  const batchMax = Number(report.batchLatencyMaxMs || 0);
  const udpErrors = Number(report.udpCallbackErrors || 0);
  const lateTicks = Number(report.lateTicks || 0);
  const adaptiveDrops = Number(report.adaptiveFpsDrops || 0);
  const pendingMs = Number(state.backpressure?.lastPendingMs || 0);
  if (udpErrors > 0) { score -= 35; issues.push(`UDP callback errors: ${udpErrors}`); }
  if (skipRate > 10) { score -= 25; issues.push(`High skip rate: ${skipRate}%`); }
  else if (skipRate > 3) { score -= 12; warnings.push(`Elevated skip rate: ${skipRate}%`); }
  if (jitterMax > 120) { score -= 18; issues.push(`High max jitter: ${jitterMax}ms`); }
  else if (jitterMax > 60) { score -= 8; warnings.push(`Noticeable max jitter: ${jitterMax}ms`); }
  if (jitterAvg > 30) { score -= 12; warnings.push(`High average jitter: ${jitterAvg}ms`); }
  if (batchMax > 500) { score -= 18; issues.push(`High batch latency: ${batchMax}ms`); }
  else if (batchMax > 250) { score -= 8; warnings.push(`Elevated batch latency: ${batchMax}ms`); }
  if (lateTicks > 10) { score -= 10; warnings.push(`Late ticks: ${lateTicks}`); }
  if (adaptiveDrops > 0) { score -= Math.min(20, adaptiveDrops * 4); warnings.push(`Adaptive FPS drops: ${adaptiveDrops}`); }
  if (pendingMs > Number(state.backpressure?.maxPendingBatchMs || 350)) { score -= 10; warnings.push(`Pending batch currently ${pendingMs}ms`); }
  score = Math.max(0, Math.min(100, Math.round(score)));
  const verdict = score >= 88 && issues.length === 0 ? 'PASS_LIVE_READY' : (score >= 70 && issues.length === 0 ? 'WARN_TEST_MORE' : 'FAIL_FIX_BEFORE_LIVE');
  const next = verdict === 'PASS_LIVE_READY'
    ? 'Můžeš zkusit delší test nebo pomalu zvedat FPS / snižovat packet pace.'
    : (verdict === 'WARN_TEST_MORE'
      ? 'Nech delší LONG RUN, porovnej sequential vs interleaved a drž FPS níž.'
      : 'Nezvedat FPS. Nejprve řeš UDP chyby, skipy, jitter nebo batch latency.');
  return {
    ok: verdict !== 'FAIL_FIX_BEFORE_LIVE',
    version: STEP22EX_STABILITY_GATE_VERSION,
    generatedAt: Date.now(),
    source,
    verdict,
    score,
    issues,
    warnings,
    next,
    thresholds: {
      passScore: 88,
      warnScore: 70,
      skipRateWarnPct: 3,
      skipRateFailPct: 10,
      jitterMaxWarnMs: 60,
      jitterMaxFailMs: 120,
      batchLatencyWarnMs: 250,
      batchLatencyFailMs: 500
    },
    report,
    snapshot: {
      running: state.running,
      effectiveFps: state.frameClock?.effectiveFps || 0,
      requestedFps: state.frameClock?.requestedFps || 0,
      packetOrder: state.options?.packetOrder || 'sequential',
      packetPaceMs: state.options?.packetPaceMs ?? 0,
      packetsPerBurst: state.options?.packetsPerBurst ?? 1,
      target: resolveTargetAddress({}, state.options),
      lastSendResult: state.lastSendResult,
      backpressure: { ...state.backpressure },
      profiler: { ...state.liveProfiler }
    }
  };
}

function addStat(box, value) {
  const v = Number(value);
  if (!Number.isFinite(v)) return;
  const samples = Number(box.samples || 0) + 1;
  box.samples = samples;
  box.last = Number(v.toFixed(2));
  box.min = box.min == null ? box.last : Math.min(box.min, box.last);
  box.max = Math.max(Number(box.max || 0), box.last);
  box.avg = Number((((Number(box.avg || 0) * (samples - 1)) + v) / samples).toFixed(2));
}

function addIntervalStat(box, interval, target) {
  addStat(box, interval);
  const diff = Math.abs(Number(interval) - Number(target || interval));
  const jitterSamples = Number(box.jitterSamples || 0) + 1;
  box.jitterSamples = jitterSamples;
  box.jitterMaxMs = Math.max(Number(box.jitterMaxMs || 0), Number(diff.toFixed(2)));
  box.jitterAvgMs = Number((((Number(box.jitterAvgMs || 0) * (jitterSamples - 1)) + diff) / jitterSamples).toFixed(2));
}

function makeVisibleLivePattern({ stripCount = 8, pixelsPerStrip = 300, frameIndex = 0, bpm = 145 } = {}) {
  const strips = clampInt(stripCount, 1, 64, 8);
  const pixels = clampInt(pixelsPerStrip, 1, 1000, 300);
  const out = new Uint8Array(strips * pixels * 3);
  const speed = Math.max(1, Math.round(Number(bpm || 145) / 30));
  const head = (Math.floor(frameIndex * speed) % pixels + pixels) % pixels;
  const tail = Math.max(12, Math.round(pixels * 0.055));
  for (let s = 0; s < strips; s += 1) {
    const stripPhase = Math.floor((s / Math.max(1, strips)) * pixels);
    const localHead = (head + stripPhase) % pixels;
    const baseHue = (s * 37 + frameIndex * 2) % 256;
    for (let x = 0; x < pixels; x += 1) {
      const dist = Math.min((x - localHead + pixels) % pixels, (localHead - x + pixels) % pixels);
      const hit = dist <= tail;
      const edge = x === 0 || x === pixels - 1 || x === 149 || x === 150;
      let r = 0, g = 0, b = 0;
      if (hit) {
        const power = Math.max(0, 1 - dist / Math.max(1, tail));
        r = clampByte(30 + power * (180 + (baseHue % 60)));
        g = clampByte(20 + power * (90 + ((baseHue + 80) % 90)));
        b = clampByte(45 + power * (130 + ((baseHue + 150) % 70)));
      }
      if (edge && ((Math.floor(frameIndex / 15) + s) % 2 === 0)) {
        r = Math.max(r, 80); g = Math.max(g, 80); b = Math.max(b, 80);
      }
      const i = (s * pixels + x) * 3;
      out[i] = r; out[i + 1] = g; out[i + 2] = b;
    }
  }
  return out;
}

function buildMasterFrameInfo(latestMaster, fallback = null) {
  if (!latestMaster) return fallback || null;
  return {
    frameId: latestMaster.frameId,
    ageMs: latestMaster.ageMs,
    byteLength: latestMaster.byteLength,
    source: latestMaster.source,
    adaptedForOutput: latestMaster.adaptedForOutput
  };
}

function buildFastClockSnapshot(options = {}) {
  const bpm = clampInt(options.bpm, 40, 240, 145);
  const fps = clampInt(options.fps, 1, 120, 60);
  const beatsPerBar = clampInt(options.beatsPerBar, 1, 16, 4);
  const phraseBeats = clampInt(options.phraseBeats, 4, 1024, 256);
  const nowMs = Number(options.nowMs ?? Date.now()) || Date.now();
  const clockStartMs = Number(options.clockStartMs ?? nowMs) || nowMs;
  const beatMs = 60000 / bpm;
  const frameMs = 1000 / fps;
  const elapsedMs = Math.max(0, nowMs - clockStartMs);
  const frameIndex = Math.floor(elapsedMs / frameMs);
  const beatFloat = elapsedMs / beatMs;
  const beatIndex = Math.floor(beatFloat);
  return {
    frameIndex,
    sequence: (frameIndex % 255) + 1,
    beatIndex,
    beatInBar: beatIndex % beatsPerBar,
    beatInPhrase: beatIndex % phraseBeats,
    beatPhase: beatFloat - beatIndex
  };
}

function buildFastDeterministicEvents(snapshot) {
  const isBarStart = snapshot.beatInBar === 0 && snapshot.beatPhase < 0.08;
  const isDropWindow = snapshot.beatInPhrase >= 256 - 16;
  return {
    suggestedVisualIntensity: isDropWindow ? 'high' : isBarStart ? 'accent' : 'normal'
  };
}

function buildStep22DqFrameFast(options = {}) {
  const stripCount = clampInt(options.stripCount, 1, 64, 8);
  const pixelsPerStrip = clampInt(options.pixelsPerStrip, 1, 1000, 300);
  const bpm = clampInt(options.bpm, 40, 240, 145);
  const frameIndex = clampInt(options.frameIndex ?? options.frameCount ?? 0, 0, 2147483647, 0);
  const sourcePolicy = resolveSourcePolicy(options, options);
  const visualPattern = sourcePolicy.visualPattern;
  const artSyncMode = String(options.artSyncMode || options.syncMode || 'every-frame').trim().toLowerCase();
  const artSyncEveryN = clampInt(options.artSyncEveryN, 1, 64, 4);
  const artSyncEnabled = options.artSync === false || artSyncMode === 'off' || artSyncMode === 'none'
    ? false
    : (artSyncMode === 'every-n' || artSyncMode === 'every-n-frames'
      ? (frameIndex % artSyncEveryN === 0)
      : true);
  const wantsMaster = sourcePolicy.wantsMaster;
  const hasExplicitFrame = options.rgb || options.frame;
  const latestMaster = options.masterFrameSnapshot?.frame ? options.masterFrameSnapshot : null;
  const masterFallback = wantsMaster && !latestMaster && !hasExplicitFrame;
  const usesBlackPattern = visualPattern === 'black' || visualPattern === 'blackout';
  const usesSyntheticPattern = sourcePolicy.allowSyntheticGenerator && EXPLICIT_GENERATOR_PATTERNS.includes(visualPattern);
  const rgb = options.rgb
    || options.frame
    || latestMaster?.frame
    || (usesBlackPattern || masterFallback
      ? makeBlackFrame({ stripCount, pixelsPerStrip })
      : (usesSyntheticPattern
        ? makeVisibleLivePattern({ stripCount, pixelsPerStrip, frameIndex, bpm })
        : makeBlackFrame({ stripCount, pixelsPerStrip })));
  const frameSource = latestMaster
    ? 'master-framebus'
    : (options.frameClockSource === 'master-live-fresh'
      ? 'master-framebus'
      : (options.frameClockSource
        || (masterFallback
          ? 'master-framebus-missing-blackout'
          : (hasExplicitFrame ? 'explicit-frame' : (usesBlackPattern ? 'explicit-blackout' : (usesSyntheticPattern ? 'explicit-visible-chase' : 'blackout-default'))))));
  const patchWidth = clampInt(options.width ?? options.artnetPatch?.width ?? latestMaster?.artnetPatch?.width, 1, 65535, pixelsPerStrip);
  const patchHeight = clampInt(options.height ?? options.artnetPatch?.height ?? latestMaster?.artnetPatch?.height, 1, 65535, stripCount);
  const snapshot = buildFastClockSnapshot({ ...options, frameIndex });
  const events = buildFastDeterministicEvents(snapshot);
  const dry = buildArtnetDryRunFrame({
    ...options,
    rgb,
    artnetPatch: latestPatch37CK(options.artnetPatch, latestMaster?.artnetPatch),
    width: patchWidth,
    height: patchHeight,
    stripCount,
    pixelsPerStrip,
    sequence: snapshot.sequence,
    artSync: artSyncEnabled,
    fastPath: true,
    includeMap: false,
    requireExplicitPatch: options.requireExplicitPatch === true
  });
  return {
    packets: dry.packets,
    summary: {
      ...dry.summary,
      frameIndex: snapshot.frameIndex,
      sequence: snapshot.sequence,
      beatIndex: snapshot.beatIndex,
      beatInPhrase: snapshot.beatInPhrase,
      suggestedVisualIntensity: events.suggestedVisualIntensity,
      visualPattern,
      sourceMode: sourcePolicy.sourceMode,
      artSyncMode,
      artSyncEveryN,
      artSyncEnabled,
      frameSource,
      masterFrame: buildMasterFrameInfo(latestMaster, options.masterFrameInfo || null)
    }
  };
}

export function buildStep22DqLivePlan(options = {}) {
  const bpm = clampInt(options.bpm, 40, 240, 145);
  const fps = clampInt(options.fps, 1, 120, 60);
  const stripCount = clampInt(options.stripCount, 1, 64, 8);
  const pixelsPerStrip = clampInt(options.pixelsPerStrip, 1, 1000, 300);
  const pixelsPerUniverse = clampInt(options.pixelsPerUniverse, 1, 170, 170);
  const outputIp = String(options.outputIp || options.host || '2.1.1.30');
  const bindIp = String(options.bindIp || options.localAddress || '');
  const artnet = buildStep22DoPlan({ ...options, bpm, fps, stripCount, pixelsPerStrip, pixelsPerUniverse, outputIp });
  const clock = buildSyncClockSnapshot({ ...options, bpm, fps, stripCount, pixelsPerStrip, pixelsPerUniverse });
  return Object.freeze({
    ok: true,
    version: STEP22DQ_ARTNET_SYNC_LIVE_VERSION,
    mode: 'artnet-sync-live-plan',
    armedRequired: true,
    sendModes: Object.freeze(['dry-run', 'udp-armed']),
    defaultMode: 'dry-run',
    clock,
    network: Object.freeze({ bindIp, outputIp, bindRequiredForReliableWindowsRouting: true, targetModes: Object.freeze(['unicast','subnet-broadcast','global-broadcast']), subnetBroadcast: subnetBroadcastFromIp(bindIp) }),
    artnet,
    liveRules: Object.freeze([
      'Live ArtNet sender uses the STEP22DP clock as frame/beat authority.',
      'Frame sequence comes from clock snapshot, not from browser render timing.',
      'UDP sending is blocked unless armed=true is provided explicitly.',
      'Dry-run is safe and builds all universe packets without touching the network.',
      'For real UDP on Windows, set bindIp/localAddress to the NIC IP that is on the ArtNet network.'
    ])
  });
}

export function buildStep22DqFrame(options = {}) {
  const stripCount = clampInt(options.stripCount, 1, 64, 8);
  const pixelsPerStrip = clampInt(options.pixelsPerStrip, 1, 1000, 300);
  const fps = clampInt(options.fps, 1, 120, 60);
  const bpm = clampInt(options.bpm, 40, 240, 145);
  const syncClockPlan = options.syncClockPlan || buildSyncClockPlan({ ...options, fps, bpm, stripCount, pixelsPerStrip });
  const snapshot = options.syncClockSnapshot || buildSyncClockSnapshot({ ...options, fps, bpm, stripCount, pixelsPerStrip, syncClockPlan });
  const events = options.deterministicEvents || buildDeterministicEventPlan({ ...options, fps, bpm, stripCount, pixelsPerStrip, syncClockPlan, syncClockSnapshot: snapshot });
  const frameIndex = clampInt(options.frameIndex ?? options.frameCount ?? 0, 0, 2147483647, 0);
  const sourcePolicy = resolveSourcePolicy(options, options);
  const visualPattern = sourcePolicy.visualPattern;
  const artSyncMode = String(options.artSyncMode || options.syncMode || 'every-frame').trim().toLowerCase();
  const artSyncEveryN = clampInt(options.artSyncEveryN, 1, 64, 4);
  const artSyncEnabled = options.artSync === false || artSyncMode === 'off' || artSyncMode === 'none'
    ? false
    : (artSyncMode === 'every-n' || artSyncMode === 'every-n-frames'
      ? (frameIndex % artSyncEveryN === 0)
      : true);
  const wantsMaster = sourcePolicy.wantsMaster;
  const hasExplicitFrame = options.rgb || options.frame;
  const latestMasterFromClock = options.masterFrameSnapshot && options.masterFrameSnapshot.frame
    ? options.masterFrameSnapshot
    : null;
  // STEP22ME: resolveFrameClockPayload already injects the fresh master frame
  // into options.rgb. Do not query the master store a second time on every
  // ArtNet tick; that extra lookup + clone pressure showed up as jitter when
  // Performance preview was mounted.
  const latestMaster = latestMasterFromClock || (wantsMaster && !hasExplicitFrame ? artnetMasterFrameStore22EJ.getLatest({
    stripCount,
    pixelsPerStrip,
    maxAgeMs: clampInt(options.masterMaxAgeMs, 100, 30000, 1500)
  }) : null);
  const masterFallback = wantsMaster && !latestMaster && !hasExplicitFrame;
  const usesBlackPattern = visualPattern === 'black' || visualPattern === 'blackout';
  const usesSyntheticPattern = sourcePolicy.allowSyntheticGenerator && EXPLICIT_GENERATOR_PATTERNS.includes(visualPattern);
  const rgb = options.rgb
    || options.frame
    || latestMaster?.frame
    || (usesBlackPattern || masterFallback
      ? makeBlackFrame({ stripCount, pixelsPerStrip })
      : (usesSyntheticPattern
        ? makeVisibleLivePattern({ stripCount, pixelsPerStrip, frameIndex, bpm })
        : makeBlackFrame({ stripCount, pixelsPerStrip })));
  const frameSource = latestMaster
    ? 'master-framebus'
    : (options.frameClockSource === 'master-live-fresh'
      ? 'master-framebus'
      : (options.frameClockSource
        || (masterFallback
          ? 'master-framebus-missing-blackout'
          : (hasExplicitFrame
            ? 'explicit-frame'
            : (usesBlackPattern
              ? 'explicit-blackout'
              : (usesSyntheticPattern ? 'explicit-visible-chase' : 'blackout-default'))))));
  const patchWidth = clampInt(options.width ?? options.artnetPatch?.width ?? latestMaster?.artnetPatch?.width, 1, 65535, pixelsPerStrip);
  const patchHeight = clampInt(options.height ?? options.artnetPatch?.height ?? latestMaster?.artnetPatch?.height, 1, 65535, stripCount);
  const dry = buildArtnetDryRunFrame({
    ...options,
    rgb,
    artnetPatch: latestPatch37CK(options.artnetPatch, latestMaster?.artnetPatch),
    width: patchWidth,
    height: patchHeight,
    stripCount,
    pixelsPerStrip,
    sequence: snapshot.frame.sequence,
    artSync: artSyncEnabled,
    requireExplicitPatch: options.requireExplicitPatch === true
  });
  return Object.freeze({
    ok: true,
    version: STEP22DQ_ARTNET_SYNC_LIVE_VERSION,
    mode: 'artnet-sync-frame',
    snapshot,
    events: events.events,
    map: dry.map,
    summary: Object.freeze({
      ...dry.summary,
      frameIndex: snapshot.frame.frameIndex,
      sequence: snapshot.frame.sequence,
      beatIndex: snapshot.beat.beatIndex,
      beatInPhrase: snapshot.beat.beatInPhrase,
      suggestedVisualIntensity: events.events.suggestedVisualIntensity,
       visualPattern,
      sourceMode: sourcePolicy.sourceMode,
      artSyncMode,
      artSyncEveryN,
      artSyncEnabled,
      frameSource,
       masterFrame: buildMasterFrameInfo(latestMaster, options.masterFrameInfo || null)
     }),
     packets: dry.packets
  });
}

export function createStep22DqLiveSender(defaults = {}) {
  const liveDefaults = withArtnetLiveDefaults(defaults);
  const state = {
    running: false,
    armed: false,
    mode: 'dry-run',
    startedAt: 0,
    lastFrameAt: 0,
    frameCount: 0,
    packetCount: 0,
    byteCount: 0,
    lastError: null,
    lastSummary: null,
    sentFrameCount: 0,
    skippedFrameCount: 0,
    lastSendAt: 0,
    lastSendResult: null,
    lastPacketSummary: null,
    udpPacketCallbackCount: 0,
    udpPacketCallbackErrorCount: 0,
    lastUdpCallbackAt: 0,
    lastUdpCallbackError: null,
    lastUdpBatch: null,
    lastStartKind: 'idle',
    backpressure: { enabled: true, maxPendingBatchMs: 250, consecutiveSkips: 0, maxConsecutiveSkips: 0, lastSkipAt: 0, lastSkipReason: null, lastPendingMs: 0, droppedStaleBatches: 0, adaptiveFpsDropCount: 0 },
    pacer: { enabled: false, packetPaceMs: 0, packetsPerBurst: 1, activeBatchId: null, queuedPackets: 0, sentPackets: 0, pendingPackets: 0, completedBatches: 0, cancelledBatches: 0, lastCompleteAt: 0 },
    socketAddressSnapshot: null,
    lastDetailedSendResultAt: 0,
    watchdog: { enabled: true, staleAfterMs: 1500, stale: false, lastCheckAt: 0 },
    frameClock: { enabled: true, requestedFps: ARTNET_LIVE_DEFAULTS.fps, maxEffectiveFps: ARTNET_LIVE_DEFAULTS.maxLiveFps, effectiveFps: ARTNET_LIVE_DEFAULTS.maxLiveFps, sendIntervalMs: 16, nextDueAt: 0, lastTickAt: 0, expectedFrameIndex: 0, lateTicks: 0, maxLatenessMs: 0, lastLatenessMs: 0, lastGoodHoldMs: 5000, lastGoodFrameAt: 0, lastGoodFrameId: null, lastGoodSource: null, cacheHitCount: 0, cacheMissCount: 0, blackoutAfterHold: false, adaptiveEnabled: ARTNET_LIVE_DEFAULTS.adaptiveFrameClock !== 'off', adaptiveFpsDrops: 0, adaptiveFpsRecovers: 0, adaptiveFloorFps: ARTNET_LIVE_DEFAULTS.adaptiveFloorFps, stableTicks: 0, lastRecoverAt: 0, age: { masterMs: null, cacheMs: null, outputMs: null } },
    masterDriven: { enabled: true, lastTriggerAt: 0, triggerCount: 0, sentCount: 0, skippedCount: 0, duplicateFrameSkips: 0, minGapSkips: 0, notReadySkips: 0, lastFrameId: null, lastReason: null, lastAgeMs: null, windowStartedAt: 0, windowSent: 0, actualFps: 0 },
    backendWriterGuard37BZ: { version: STEP37BZ_BACKEND_WRITER_GUARD_VERSION, blockedCount: 0, allowedCount: 0, lastDecision: null },
    udpTruthLog37CP: [],
    lastUdpTruth37CP: null,
    liveProfiler: newLiveProfilerState(),
    longRun: newLongRunState(),
    timer: null,
    stopTimer: null,
    startInProgress: false,
    maxLiveFps: ARTNET_LIVE_DEFAULTS.maxLiveFps,
    tickBusy: false,
    callbackMode: ARTNET_LIVE_DEFAULTS.callbackMode,
    lastTickDurationMs: 0,
    maxTickDurationMs: 0,
    lastFrameBuildMs: 0,
    recentSentWindow: { startedAt: 0, sent: 0, actualFps: 0, lastIntervalMs: null, minIntervalMs: null, maxIntervalMs: 0 },
    udpHotpath37DN: { version: '37DN_UDP_HOTPATH_DIAG', batchCount: 0, packetCount: 0, lastPath: null, lastBatchMs: 0, maxBatchMs: 0, slowBatchCount: 0, lastPacketCount: 0, lastCallbackMode: null, lastAt: 0 },
    socket: null,
    socketReady: false,
    socketBindIp: '',
    socketBindStartedAt: 0,
    options: { ...liveDefaults, localAddress: '', diagnosticsEveryN: 10, fullLiveProfiling: false }
  };

  function status() {
    return {
      ok: true,
      version: STEP22DQ_ARTNET_SYNC_LIVE_VERSION,
      running: state.running,
      armed: state.armed,
      mode: state.mode,
      startedAt: state.startedAt || null,
      uptimeMs: state.running ? Math.max(0, Date.now() - state.startedAt) : 0,
      // STEP22MG: actualFps is now a recent 1s physical-output window.
      // Lifetime average can hide visible stalls, so expose it separately.
      actualFps: state.running ? Number((state.recentSentWindow.actualFps || 0).toFixed(2)) : 0,
      lifetimeActualFps: state.running && state.startedAt ? Number((state.sentFrameCount / Math.max(0.001, (Date.now() - state.startedAt) / 1000)).toFixed(2)) : 0,
      generatedFps: state.running && state.startedAt ? Number((state.frameCount / Math.max(0.001, (Date.now() - state.startedAt) / 1000)).toFixed(2)) : 0,
      frameCount: state.frameCount,
      packetCount: state.packetCount,
      byteCount: state.byteCount,
      lastFrameAt: state.lastFrameAt || null,
      lastError: state.lastError,
      lastSummary: state.lastSummary,
      sentFrameCount: state.sentFrameCount,
      skippedFrameCount: state.skippedFrameCount,
      skipRatePct: (state.sentFrameCount + state.skippedFrameCount) > 0 ? Number(((state.skippedFrameCount / Math.max(1, state.sentFrameCount + state.skippedFrameCount)) * 100).toFixed(2)) : 0,
      lastSendAt: state.lastSendAt || null,
      lastSendResult: state.lastSendResult,
      lastPacketSummary: state.lastPacketSummary,
      udpPacketCallbackCount: state.udpPacketCallbackCount,
      udpPacketCallbackErrorCount: state.udpPacketCallbackErrorCount,
      lastUdpCallbackAt: state.lastUdpCallbackAt || null,
      lastUdpCallbackError: state.lastUdpCallbackError,
      lastUdpBatch: state.lastUdpBatch,
      lastStartKind: state.lastStartKind,
      pacer: { ...state.pacer },
      backpressure: { ...state.backpressure },
      startInProgress: state.startInProgress,
      maxLiveFps: state.maxLiveFps,
      callbackMode: state.callbackMode,
      tickBusy: state.tickBusy,
      lastTickDurationMs: state.lastTickDurationMs,
      maxTickDurationMs: state.maxTickDurationMs,
      lastFrameBuildMs: state.lastFrameBuildMs,
      recentSentWindow: { ...state.recentSentWindow },
      udpHotpath37DN: { ...state.udpHotpath37DN },
      watchdog: { ...state.watchdog, stale: state.running && state.lastSendAt ? (Date.now() - state.lastSendAt > state.watchdog.staleAfterMs) : false },
      frameClock: { ...state.frameClock, age: { ...state.frameClock.age } },
      masterDriven: { ...state.masterDriven },
      backendWriterGuard37BZ: { ...state.backendWriterGuard37BZ },
      liveProfiler: { ...state.liveProfiler },
      longRun: { ...state.longRun, remainingMs: state.longRun.enabled && state.longRun.endAt ? Math.max(0, state.longRun.endAt - Date.now()) : 0, report: state.longRun.report ? { ...state.longRun.report } : null },
      options: state.options,
      sourcePolicy: {
        sourceMode: normalizeSourceMode(state.options.sourceMode, 'performance-master-only'),
        visualPattern: normalizeVisualPattern(state.options.visualPattern, 'master-framebus')
      },
      network: { bindIp: state.options.bindIp || state.options.localAddress || '', outputIp: state.options.outputIp || state.options.host || '2.1.1.30', targetMode: state.options.targetMode || 'unicast', resolvedTarget: resolveTargetAddress({}, state.options), port: state.options.port || 6454, socketReady: state.socketReady, socketBindIp: state.socketBindIp, socketBindStartedAt: state.socketBindStartedAt || null, socketAddress: (() => { try { return state.socket?.address?.() || null; } catch { return null; } })() },
      udpTruth37CP: { last: state.lastUdpTruth37CP || null, recent: Object.freeze([...(state.udpTruthLog37CP || [])]) }
    };
  }

  function stop() {
    if (state.mode === 'udp-armed') serverOutputRegistry37BC.release({ owner: STEP37BC_ARTNET_SERVER_OWNER, reason: 'artnet-live-stop' });
    if (state.timer) clearTimeout(state.timer);
    if (state.timer) clearInterval(state.timer);
    state.timer = null;
    if (state.stopTimer) clearTimeout(state.stopTimer);
    state.stopTimer = null;
    state.startInProgress = false;
    state.tickBusy = false;
    if (state.socket) state.socket.close();
    state.socket = null;
    state.socketReady = false;
    if (state.lastUdpBatch && state.lastUdpBatch.callbackDone === false) {
      state.lastUdpBatch.cancelled = true;
      state.pacer.cancelledBatches += 1;
    }
    state.lastUdpBatch = null;
    state.pacer.activeBatchId = null;
    state.pacer.pendingPackets = 0;
    state.backpressure.consecutiveSkips = 0;
    state.backpressure.lastPendingMs = 0;
    state.socketBindIp = '';
    state.socketBindStartedAt = 0;
    state.running = false;
    if (state.longRun.enabled && !state.longRun.completed) {
      state.longRun.completed = true;
      state.longRun.enabled = false;
      state.longRun.stoppedReason = state.lastError ? 'stopped-error' : 'stopped-manual';
      state.longRun.report = buildLongRunReport(state, state.longRun.stoppedReason);
    }
    state.watchdog.stale = false;
    return status();
  }

  function primeSocket(options = {}) {
    const bindIp = String(options.bindIp || options.localAddress || state.options.bindIp || state.options.localAddress || '').trim();
    if (state.socket && state.socketBindIp === bindIp) return status();
    if (state.socket) state.socket.close();
    state.socketAddressSnapshot = null;
    state.socket = dgram.createSocket('udp4');
    state.socketReady = false;
    state.lastUdpBatch = null;
    state.socketBindIp = bindIp;
    state.socketBindStartedAt = Date.now();
    state.socket.on('error', (error) => {
      state.socketReady = false;
      state.lastError = error?.message || String(error);
      state.lastSendResult = { sent: false, reason: 'socket-error', error: state.lastError, bindIp };
      state.lastUdpCallbackError = state.lastError;
    });
    state.socket.on('listening', () => {
      state.socketReady = true;
      try { state.socket.setBroadcast(true); } catch {}
      try { state.socketAddressSnapshot = state.socket?.address?.() || null; } catch { state.socketAddressSnapshot = null; }
      state.lastSendResult = { sent: false, reason: 'socket-ready', bindIp, broadcastEnabled: true, socketAddress: state.socketAddressSnapshot };
    });
    if (!bindIp) throw new Error('BIND_IP_REQUIRED_NO_AUTO_SOCKET_BIND');
    assertValidArtNetIp37CN(bindIp, 'BIND_IP');
    state.socket.bind({ address: bindIp, port: 0, exclusive: false });
    return status();
  }


  function markUdpHotpath37DN({ path = 'unknown', startedAt = Date.now(), packetCount = 0, callbackMode = '', errorCount = 0 } = {}) {
    const now = Date.now();
    const elapsed = Math.max(0, now - Number(startedAt || now));
    const stats = state.udpHotpath37DN || (state.udpHotpath37DN = { version: '37DN_UDP_HOTPATH_DIAG' });
    stats.version = '37DN_UDP_HOTPATH_DIAG';
    stats.batchCount = Number(stats.batchCount || 0) + 1;
    stats.packetCount = Number(stats.packetCount || 0) + Math.max(0, Number(packetCount || 0));
    stats.lastPath = path;
    stats.lastBatchMs = elapsed;
    stats.maxBatchMs = Math.max(Number(stats.maxBatchMs || 0), elapsed);
    stats.lastPacketCount = Math.max(0, Number(packetCount || 0));
    stats.lastCallbackMode = String(callbackMode || '');
    stats.lastAt = now;
    stats.errorCount = Number(stats.errorCount || 0) + Math.max(0, Number(errorCount || 0));
    if (elapsed > 8) stats.slowBatchCount = Number(stats.slowBatchCount || 0) + 1;
  }

  function resetUdpHotpath37DN() {
    state.udpHotpath37DN = { version: '37DN_UDP_HOTPATH_DIAG', batchCount: 0, packetCount: 0, lastPath: null, lastBatchMs: 0, maxBatchMs: 0, slowBatchCount: 0, lastPacketCount: 0, lastCallbackMode: null, lastAt: 0, errorCount: 0 };
  }

  function resolvePacerOptions(frameOptions = {}) {
    const packetPaceMs = clampInt(frameOptions.packetPaceMs ?? state.options.packetPaceMs, 0, 25, 0);
    const packetsPerBurst = clampInt(frameOptions.packetsPerBurst ?? state.options.packetsPerBurst, 1, 32, 1);
    return { packetPaceMs, packetsPerBurst, enabled: packetPaceMs > 0 };
  }

  function sendUdpBatchPackets({ batch, packets, targetPort, targetIp, callbackMode }) {
    const hotpathStartedAt37DN = Date.now();
    const pacer = resolvePacerOptions({ packetPaceMs: batch.packetPaceMs, packetsPerBurst: batch.packetsPerBurst });
    state.pacer.enabled = pacer.enabled;
    state.pacer.packetPaceMs = pacer.packetPaceMs;
    state.pacer.packetsPerBurst = pacer.packetsPerBurst;
    state.pacer.activeBatchId = batch.id;
    state.pacer.queuedPackets = packets.length;
    state.pacer.sentPackets = 0;
    state.pacer.pendingPackets = packets.length;
    // STEP22MG: send all ArtDmx packets for one frame in one tight burst by
    // default. Splitting a frame through setImmediate looked CPU-friendly, but
    // on real strips it creates per-universe skew: part of the strip receives
    // frame N and the rest follows on the next event-loop slice. That reads as
    // lag/stutter even when average FPS is high.
    const smoothYieldBurstSize = Math.max(2, Math.min(32, Number(state.options?.smoothYieldBurstSize || 32)));
    const useSmoothYield = String(state.options?.smoothYield || 'off').toLowerCase() === 'on'
      && !pacer.enabled
      && (callbackMode === 'none' || callbackMode === 'lightweight')
      && packets.length > smoothYieldBurstSize;

    // STEP37AF: absolute UDP hot path for the normal live mode. In callbackMode
    // none/lightweight with no pacer/smooth-yield we do not need per-packet
    // callback bookkeeping, closures, or artificial pending-batch state. Send
    // the whole ArtNet frame in one tight loop, mark the batch complete
    // immediately, and rely on the socket-level error handler for real network
    // failures. This removes a surprising amount of short-lived allocation from
    // the 60 FPS path.
    if (!pacer.enabled && !useSmoothYield && (callbackMode === 'none' || callbackMode === 'lightweight')) {
      let okCount = 0;
      let errorCount = 0;
      let lastError = null;
      const sock = state.socket;
      const ready = Boolean(sock && state.socketReady);
      for (let i = 0; i < packets.length; i += 1) {
        const packet = packets[i];
        if (!ready) {
          errorCount += 1;
          lastError = new Error('pacer-cancelled-or-socket-closed');
          continue;
        }
        try {
          assertValidArtNetIp37CN(packet.targetIp || packet.host || targetIp, 'PACKET_TARGET_IP');
          // STEP37CI MULTIOUT: the hot path must respect per-packet targets.
          // The old ultra-fast branch always sent to targetIp/targetPort, which
          // made a compiled multi-output ArtNet patch look valid but physically
          // still transmit everything to the single default node.
          sock.send(
            packet.packet,
            Number(packet.targetPort || packet.port || targetPort),
            String(packet.targetIp || packet.host || targetIp)
          );
          okCount += 1;
        } catch (error) {
          errorCount += 1;
          lastError = error;
        }
      }
      const completedAt = Date.now();
      batch.callbackOk += okCount;
      batch.callbackError += errorCount;
      batch.callbackDone = true;
      batch.completedAt = completedAt;
      if (lastError) {
        batch.lastError = lastError?.message || String(lastError);
        state.lastUdpCallbackError = batch.lastError;
        state.lastError = batch.lastError;
      }
      state.pacer.sentPackets = okCount;
      state.pacer.pendingPackets = 0;
      state.pacer.activeBatchId = null;
      state.pacer.completedBatches += 1;
      state.pacer.lastCompleteAt = completedAt;
      state.udpPacketCallbackCount += okCount;
      state.udpPacketCallbackErrorCount += errorCount;
      state.lastUdpCallbackAt = completedAt;
      addStat(state.liveProfiler.batchLatencyMs, completedAt - batch.queuedAt);
      state.liveProfiler.batchSamples += 1;
      markUdpHotpath37DN({ path: 'tight-burst', startedAt: hotpathStartedAt37DN, packetCount: packets.length, callbackMode, errorCount });
      return;
    }

    const markPacket = (error) => {
      if (batch.cancelled) return;
      if (error) {
        batch.callbackError += 1;
        batch.lastError = error?.message || String(error);
        state.udpPacketCallbackErrorCount += 1;
        state.lastUdpCallbackError = batch.lastError;
        state.lastError = batch.lastError;
      } else {
        batch.callbackOk += 1;
        state.udpPacketCallbackCount += 1;
      }
      state.lastUdpCallbackAt = Date.now();
      state.pacer.pendingPackets = Math.max(0, batch.queuedPackets - (batch.callbackOk + batch.callbackError));
      if ((batch.callbackOk + batch.callbackError) >= batch.queuedPackets) {
        batch.callbackDone = true;
        batch.completedAt = Date.now();
        state.pacer.activeBatchId = null;
        state.pacer.pendingPackets = 0;
        state.pacer.completedBatches += 1;
        state.pacer.lastCompleteAt = batch.completedAt;
        addStat(state.liveProfiler.batchLatencyMs, batch.completedAt - batch.queuedAt);
        state.liveProfiler.batchSamples += 1;
        markUdpHotpath37DN({ path: 'callback', startedAt: hotpathStartedAt37DN, packetCount: packets.length, callbackMode, errorCount: batch.callbackError });
      }
    };

    const completeLightweightBatch = ({ okCount = 0, errorCount = 0, lastError = null } = {}) => {
      batch.callbackOk += okCount;
      batch.callbackError += errorCount;
      batch.callbackDone = true;
      batch.completedAt = Date.now();
      if (lastError) {
        batch.lastError = lastError?.message || String(lastError);
        state.lastUdpCallbackError = batch.lastError;
        state.lastError = batch.lastError;
      }
      state.udpPacketCallbackCount += okCount;
      state.udpPacketCallbackErrorCount += errorCount;
      state.lastUdpCallbackAt = batch.completedAt;
      state.pacer.activeBatchId = null;
      state.pacer.pendingPackets = 0;
      state.pacer.completedBatches += 1;
      state.pacer.lastCompleteAt = batch.completedAt;
      addStat(state.liveProfiler.batchLatencyMs, batch.completedAt - batch.queuedAt);
      state.liveProfiler.batchSamples += 1;
      markUdpHotpath37DN({ path: batch.smoothYield ? 'smooth-yield' : 'lightweight-complete', startedAt: hotpathStartedAt37DN, packetCount: packets.length, callbackMode, errorCount });
    };

    const firePacket = (packet) => {
      if (batch.cancelled || !state.socket || !state.socketReady) {
        markPacket(new Error('pacer-cancelled-or-socket-closed'));
        return;
      }
      state.pacer.sentPackets += 1;
      // STEP22MD FASTPATH: for continuous ArtNet live, waiting for every UDP
      // callback can make the next frame think the previous batch is still
      // pending. In lightweight/none mode we fire-and-forget and rely on the
      // socket error handler for real network errors. This removes artificial
      // backpressure jitter at 8×300 / ~16 universes / 60 FPS.
      if (callbackMode === 'none' || callbackMode === 'lightweight') {
        try { assertValidArtNetIp37CN(packet.targetIp || packet.host || targetIp, 'PACKET_TARGET_IP'); state.socket.send(packet.packet, Number(packet.targetPort || packet.port || targetPort), String(packet.targetIp || packet.host || targetIp)); }
        catch (error) { markPacket(error); }
      } else {
        try { assertValidArtNetIp37CN(packet.targetIp || packet.host || targetIp, 'PACKET_TARGET_IP'); } catch (error) { markPacket(error); return; }
        state.socket.send(packet.packet, Number(packet.targetPort || packet.port || targetPort), String(packet.targetIp || packet.host || targetIp), (error) => markPacket(error));
      }
    };

    if (useSmoothYield) {
      batch.paced = true;
      batch.callbackDone = false;
      batch.smoothYield = true;
      state.pacer.enabled = true;
      state.pacer.packetPaceMs = 0;
      state.pacer.packetsPerBurst = smoothYieldBurstSize;
      let index = 0;
      let okCount = 0;
      let errorCount = 0;
      let lastError = null;
      const burst = () => {
        if (batch.cancelled) {
          batch.callbackDone = true;
          state.pacer.activeBatchId = null;
          state.pacer.pendingPackets = 0;
          return;
        }
        const end = Math.min(index + smoothYieldBurstSize, packets.length);
        for (; index < end; index += 1) {
          const packet = packets[index];
          if (!state.socket || !state.socketReady) {
            errorCount += 1;
            lastError = new Error('pacer-cancelled-or-socket-closed');
            continue;
          }
          state.pacer.sentPackets += 1;
          try {
            state.socket.send(packet.packet, Number(packet.targetPort || packet.port || targetPort), String(packet.targetIp || packet.host || targetIp));
            okCount += 1;
          } catch (error) {
            errorCount += 1;
            lastError = error;
          }
        }
        state.pacer.pendingPackets = Math.max(0, packets.length - index);
        if (index < packets.length) {
          setImmediate(burst);
          return;
        }
        completeLightweightBatch({ okCount, errorCount, lastError });
      };
      burst();
      return;
    }


    if (!pacer.enabled) {
      for (const packet of packets) firePacket(packet);
      if (!(callbackMode === 'callback' || callbackMode === 'full')) {
        markUdpHotpath37DN({ path: 'fire-loop', startedAt: hotpathStartedAt37DN, packetCount: packets.length, callbackMode, errorCount: 0 });
      }
      return;
    }

    batch.paced = true;
    batch.callbackDone = false;
    let index = 0;
    const burst = () => {
      if (batch.cancelled) {
        batch.callbackDone = true;
        state.pacer.activeBatchId = null;
        state.pacer.pendingPackets = 0;
        return;
      }
      for (let n = 0; n < pacer.packetsPerBurst && index < packets.length; n += 1, index += 1) {
        firePacket(packets[index]);
      }
      if (index < packets.length) setTimeout(burst, pacer.packetPaceMs);
    };
    burst();
  }

  function resolveFrameClockPayload(frameOptions = {}) {
    const patchForDimensions37CS = latestPatch37CK(frameOptions.artnetPatch, null);
    const dims37CS = resolveFrameDimensions37CS({ patch: patchForDimensions37CS, options: { ...state.options, ...frameOptions }, fallbackStripCount: 8, fallbackPixelsPerStrip: 300 });
    const stripCount = clampInt(dims37CS.stripCount, 1, 64, 8);
    const pixelsPerStrip = clampInt(dims37CS.pixelsPerStrip, 1, 1000, 300);
    const sourcePolicy = resolveSourcePolicy(frameOptions, state.options);
    const visualPattern = sourcePolicy.visualPattern;
    if (!sourcePolicy.wantsMaster || frameOptions.rgb || frameOptions.frame) {
      return { ...frameOptions, sourceMode: sourcePolicy.sourceMode, visualPattern };
    }
    const maxAgeMs = clampInt(frameOptions.masterMaxAgeMs ?? state.options.masterMaxAgeMs, 100, 30000, 1500);
    const holdMs = clampInt(frameOptions.lastGoodHoldMs ?? state.options.lastGoodHoldMs, 0, 60000, state.frameClock.lastGoodHoldMs || 5000);
    const latest = artnetMasterFrameStore22EJ.getLatest({ stripCount, pixelsPerStrip, maxAgeMs });
    const now = Date.now();
    state.frameClock.lastGoodHoldMs = holdMs;
    if (latest?.frame) {
      // STEP22ME: keep the immutable store frame reference instead of cloning
      // 7200 bytes every tick; the master store publishes a fresh Uint8Array per
      // accepted browser frame, so this is safe and reduces GC spikes.
      state.frameClock.lastGoodFrame = latest.frame;
      state.frameClock.lastGoodFrameAt = now;
      state.frameClock.lastGoodFrameId = latest.frameId;
      state.frameClock.lastGoodSource = latest.source || 'master-framebus';
      state.frameClock.age.masterMs = latest.ageMs ?? 0;
      state.frameClock.age.cacheMs = 0;
      return { ...frameOptions, rgb: latest.frame, artnetPatch: latest.artnetPatch || frameOptions.artnetPatch || null, sourceMode: sourcePolicy.sourceMode, visualPattern, frameClockSource: 'master-live-fresh', masterFrameInfo: buildMasterFrameInfo(latest), masterFrameSnapshot: latest, masterMaxAgeMs: maxAgeMs };
    }
    const cacheAgeMs = state.frameClock.lastGoodFrameAt ? now - state.frameClock.lastGoodFrameAt : null;
    state.frameClock.age.masterMs = null;
    state.frameClock.age.cacheMs = cacheAgeMs;
    if (sourcePolicy.allowMasterCache && state.frameClock.lastGoodFrame && cacheAgeMs != null && cacheAgeMs <= holdMs) {
      state.frameClock.cacheHitCount += 1;
      return { ...frameOptions, rgb: state.frameClock.lastGoodFrame, artnetPatch: frameOptions.artnetPatch || null, sourceMode: sourcePolicy.sourceMode, visualPattern, frameClockSource: 'last-good-master-cache', masterFrameInfo: state.frameClock.lastGoodFrameId ? buildMasterFrameInfo({ frameId: state.frameClock.lastGoodFrameId, ageMs: cacheAgeMs, byteLength: state.frameClock.lastGoodFrame?.byteLength || 0, source: state.frameClock.lastGoodSource || 'last-good-master-cache', adaptedForOutput: true }) : null, masterMaxAgeMs: maxAgeMs };
    }
    state.frameClock.cacheMissCount += 1;
    return {
      ...frameOptions,
      rgb: makeBlackFrame({ stripCount, pixelsPerStrip }),
      sourceMode: sourcePolicy.sourceMode,
      visualPattern,
      frameClockSource: sourcePolicy.allowMasterCache && state.frameClock.blackoutAfterHold === true ? 'last-good-expired-blackout' : 'master-source-missing-blackout',
      masterMaxAgeMs: maxAgeMs
    };
  }


  function sendMasterFrameFastPath(directFrame, frameOptions = {}) {
    // STEP22NW: WS -> ArtNet direct fast path. The browser already rendered the
    // authoritative frame; do not run the generic live-frame resolver/clock
    // planner/summary builder for every WS event. Build packets directly from
    // the incoming RGB buffer and queue UDP immediately. This lowers Node hot
    // path work and reduces the 25 FPS stair-step caused by server-side CPU/GC
    // pressure at 8x300 / ~16 universes.
    if (!directFrame || !(directFrame.frame instanceof Uint8Array)) return null;
    const t0 = Date.now();
    const resolvedPatch37CS = latestPatch37CK(directFrame.artnetPatch, frameOptions.artnetPatch);
    const dims37CS = resolveFrameDimensions37CS({ frame: directFrame, patch: resolvedPatch37CS, options: { ...state.options, ...frameOptions }, fallbackStripCount: 8, fallbackPixelsPerStrip: 300 });
    const stripCount = clampInt(dims37CS.stripCount, 1, 64, 8);
    const pixelsPerStrip = clampInt(dims37CS.pixelsPerStrip, 1, 1000, 300);
    const targetPort = clampInt(frameOptions.port ?? state.options.port, 1, 65535, 6454);
    const resolvedTarget = resolveTargetAddress(frameOptions, state.options);
    const targetIp = resolvedTarget.targetIp;
    const artSyncMode = String(frameOptions.artSyncMode || state.options.artSyncMode || 'every-frame').trim().toLowerCase();
    const artSyncEveryN = clampInt(frameOptions.artSyncEveryN ?? state.options.artSyncEveryN, 1, 64, 4);
    const artSyncEnabled = artSyncMode === 'off' || artSyncMode === 'none'
      ? false
      : (artSyncMode === 'every-n' || artSyncMode === 'every-n-frames'
        ? ((state.frameCount % artSyncEveryN) === 0)
        : true);
    const sequence = ((Number(directFrame.frameId || 0) || state.frameCount || 0) % 255) + 1;
    const frameWidth37CS = dims37CS.width;
    const frameHeight37CS = dims37CS.height;
    const dry = buildArtnetDryRunFrame({
      ...state.options,
      rgb: directFrame.frame,
      artnetPatch: resolvedPatch37CS,
      width: frameWidth37CS,
      height: frameHeight37CS,
      stripCount,
      pixelsPerStrip,
      outputIp: targetIp,
      sequence,
      artSync: artSyncEnabled,
      fastPath: true,
      includeMap: false,
      requireExplicitPatch: frameOptions.requireExplicitPatch ?? state.options.requireExplicitPatch ?? true
    });
    const packets = dry.packets || [];
    if (!packets.length && (frameOptions.requireExplicitPatch ?? state.options.requireExplicitPatch ?? true)) {
      state.skippedFrameCount += 1;
      state.lastSendResult = { sent: false, reason: 'no-explicit-artnet-patch-targets-fastpath', targetIp, targetPort, packetTargets: [], note: 'ArtNet is armed but no enabled Mapping strip has an explicit ArtNet IP.' };
      return { ok: false, sent: false, blocked: true, reason: state.lastSendResult.reason, lastSendResult: state.lastSendResult };
    }
    const packetTargets = summarizePacketTargets37CK(packets, targetIp, targetPort);
    const explicitTargetCheck37CP = requireExplicitPacketTargets37CP(packets, { required: state.mode === 'udp-armed' && (frameOptions.requireExplicitPatch ?? state.options.requireExplicitPatch ?? true), context: 'master-ws-fastpath' });
    if (!explicitTargetCheck37CP.ok) {
      state.skippedFrameCount += 1;
      state.lastSendResult = { sent: false, ...explicitTargetCheck37CP, targetIp, targetPort, packetTargets };
      return { ok: false, sent: false, blocked: true, reason: explicitTargetCheck37CP.reason, lastSendResult: state.lastSendResult };
    }
    if (!state.socket) primeSocket(frameOptions);
    if (!state.socketReady) {
      state.skippedFrameCount += 1;
      state.lastSendResult = { sent: false, reason: 'socket-not-ready-yet-fastpath', targetIp, targetPort, packetTargets, bindIp: String(frameOptions.bindIp || frameOptions.localAddress || state.options.bindIp || state.options.localAddress || '').trim() };
      return { ok: false, sent: false, socketReady: false, reason: 'socket-not-ready-yet-fastpath', lastSendResult: state.lastSendResult };
    }
    const queueNow = Date.now();
    const batchId = state.frameCount + 1;
    // STEP22OB: avoid reduce/object reads on every 60 FPS master frame. Packet
    // sizes are stable for a given ArtNet patch/layout; refresh diagnostics only
    // when the packet count changes.
    let packetBytes = Number(state.fastPathCachedPacketBytes || 0);
    if (!packetBytes || Number(state.fastPathCachedPacketCount || 0) !== packets.length) {
      packetBytes = packets.length ? packets.reduce((sum, p) => sum + Number(p.packetBytes || p.packet?.byteLength || 0), 0) : 0;
      state.fastPathCachedPacketBytes = packetBytes;
      state.fastPathCachedPacketCount = packets.length;
    }
    const batch = { id: batchId, queuedAt: queueNow, targetIp, targetPort, packetTargets, targetMode: resolvedTarget.targetMode, broadcast: resolvedTarget.broadcast, queuedPackets: packets.length, callbackOk: 0, callbackError: 0, callbackDone: false, lastError: null };
    state.lastUdpBatch = batch;
    const callbackMode = String(frameOptions.callbackMode || state.callbackMode || 'none');
    const pacerOptions = resolvePacerOptions(frameOptions);
    batch.callbackMode = callbackMode;
    batch.packetPaceMs = pacerOptions.packetPaceMs;
    batch.packetsPerBurst = pacerOptions.packetsPerBurst;
    batch.paced = pacerOptions.enabled;
    sendUdpBatchPackets({ batch, packets, targetPort, targetIp, callbackMode });
    rememberUdpTruth37CP(state, { targetIp, targetPort, packetTargets, bindIp: state.socketBindIp || '', socketAddress: state.socketAddressSnapshot, packetCount: packets.length, bytes: packetBytes });

    state.sentFrameCount += 1;
    state.frameCount += 1;
    state.packetCount += packets.length;
    state.byteCount += packetBytes;
    state.lastFrameBuildMs = Date.now() - t0;
    const sendNow = Date.now();
    if (!state.recentSentWindow.startedAt || sendNow - state.recentSentWindow.startedAt >= 1000) {
      const elapsed = state.recentSentWindow.startedAt ? Math.max(1, sendNow - state.recentSentWindow.startedAt) : 1000;
      state.recentSentWindow.actualFps = Number((state.recentSentWindow.sent * 1000 / elapsed).toFixed(2));
      state.recentSentWindow.startedAt = sendNow;
      state.recentSentWindow.sent = 0;
      state.recentSentWindow.minIntervalMs = null;
      state.recentSentWindow.maxIntervalMs = 0;
    }
    state.recentSentWindow.sent += 1;
    if (state.liveProfiler.lastSendAt) {
      const sendInterval = sendNow - state.liveProfiler.lastSendAt;
      state.recentSentWindow.lastIntervalMs = sendInterval;
      state.recentSentWindow.minIntervalMs = state.recentSentWindow.minIntervalMs == null ? sendInterval : Math.min(state.recentSentWindow.minIntervalMs, sendInterval);
      state.recentSentWindow.maxIntervalMs = Math.max(state.recentSentWindow.maxIntervalMs || 0, sendInterval);
    }
    state.liveProfiler.lastSendAt = sendNow;
    state.lastSendAt = sendNow;
    state.lastFrameAt = sendNow;
    // STEP22OB: full per-frame summary objects are useful for diagnostics, but
    // they allocate and call buildMasterFrameInfo() on the hot path. Refresh at
    // most 4×/s while keeping counters live.
    const refreshFastSummary = !state.fastPathLastSummaryAt || sendNow - state.fastPathLastSummaryAt > 250;
    if (refreshFastSummary) {
      state.fastPathLastSummaryAt = sendNow;
      state.lastSummary = {
      frameSource: 'master-framebus',
      frameClockSource: 'master-ws-event-direct-fastpath',
      visualPattern: 'master-framebus',
      sourceMode: 'performance-master-only',
      artSyncMode,
      artSyncEveryN,
      artSyncEnabled,
      sequence,
      masterFrame: buildMasterFrameInfo(directFrame, null)
    };
    state.lastPacketSummary = {
      packetCount: packets.length,
      artDmxCount: Math.max(0, packets.length - (artSyncEnabled ? 1 : 0)),
      artSyncCount: artSyncEnabled ? 1 : 0,
      universeMin: dry.summary?.firstUniverse ?? null,
      universeMax: dry.summary?.lastUniverse ?? null,
      missingUniverses: [],
      bytes: packetBytes
    };
    }
    const stripBrightnessTrace37CS = analyzeStripBrightness37CS({ frame: directFrame.frame, packets, patch: resolvedPatch37CS, width: frameWidth37CS, height: frameHeight37CS });
    state.lastSendResult = { sent: true, reason: 'udp-queued-master-ws-fastpath', targetIp, targetPort, packetTargets, packetCount: packets.length, bytes: packetBytes, batchId, stripBrightnessTrace37CS };
    return {
      ok: true,
      version: STEP22DQ_ARTNET_SYNC_LIVE_VERSION,
      sent: true,
      socketReady: true,
      sentFrameCount: state.sentFrameCount,
      skippedFrameCount: state.skippedFrameCount,
      lastSendResult: state.lastSendResult,
      packetSummary: state.lastPacketSummary,
      summary: state.lastSummary
    };
  }

  function sendOneFrame(frameOptions = {}) {
    const guard = backendWriterGuard37BZ(state, frameOptions, 'send-one');
    state.backendWriterGuard37BZ.lastDecision = { ...guard, at: Date.now() };
    if (!guard.allowed) {
      state.backendWriterGuard37BZ.blockedCount += 1;
      state.skippedFrameCount += 1;
      state.lastSendResult = { sent: false, blocked: true, reason: guard.reason, backendWriterGuard37BZ: guard };
      return { ok: false, sent: false, blocked: true, reason: guard.reason, backendWriterGuard37BZ: guard };
    }
    state.backendWriterGuard37BZ.allowedCount += 1;
    const frameBuildStart = Date.now();
    const diagnosticsEveryN = clampInt(state.options.diagnosticsEveryN, 1, 120, 10);
    const profileThisFrame = state.options.fullLiveProfiling === true || state.frameCount % diagnosticsEveryN === 0;
    const resolveStart = profileThisFrame ? frameBuildStart : 0;
    const resolvedFrameOptions = resolveFrameClockPayload(frameOptions);
    if (profileThisFrame) addStat(state.liveProfiler.phasesMs.resolveFrame, Date.now() - resolveStart);
    const buildPlanStart = profileThisFrame ? Date.now() : 0;
    const frame = buildStep22DqFrameFast({ ...state.options, frameIndex: state.frameCount, ...resolvedFrameOptions });
    if (profileThisFrame) addStat(state.liveProfiler.phasesMs.buildFrame, Date.now() - buildPlanStart);
    const outputSummary = { ...(frame.summary || {}), frameClockSource: resolvedFrameOptions.frameClockSource || frame.summary?.frameClockSource || null };
    const targetPort = clampInt(resolvedFrameOptions.port ?? state.options.port, 1, 65535, 6454);
    const resolvedTarget = resolveTargetAddress(resolvedFrameOptions, state.options);
    const targetIp = resolvedTarget.targetIp;
    const packetOrderMode = String(resolvedFrameOptions.packetOrder ?? state.options.packetOrder ?? 'sequential');
    const reorderStart = profileThisFrame ? Date.now() : 0;
    const orderedPackets = packetOrderMode === 'sequential' ? frame.packets : reorderArtDmxPacketsForLive(frame.packets, packetOrderMode);
    const packetTargets = summarizePacketTargets37CK(orderedPackets, targetIp, targetPort);
    const explicitTargetCheck37CP = requireExplicitPacketTargets37CP(orderedPackets, { required: state.mode === 'udp-armed' && (resolvedFrameOptions.requireExplicitPatch ?? state.options.requireExplicitPatch ?? true), context: 'send-frame' });
    if (!explicitTargetCheck37CP.ok) {
      state.skippedFrameCount += 1;
      state.lastSendResult = { sent: false, ...explicitTargetCheck37CP, targetIp, targetPort, packetTargets };
      return { ok: false, sent: false, blocked: true, reason: explicitTargetCheck37CP.reason, lastSendResult: state.lastSendResult };
    }
    if (!orderedPackets.length && (resolvedFrameOptions.requireExplicitPatch ?? state.options.requireExplicitPatch ?? true)) {
      state.skippedFrameCount += 1;
      state.lastSendResult = { sent: false, reason: 'no-explicit-artnet-patch-targets', targetIp, targetPort, packetTargets: [], note: 'ArtNet is armed but no enabled Mapping strip has an explicit ArtNet IP.' };
      return { ok: false, sent: false, blocked: true, reason: state.lastSendResult.reason, lastSendResult: state.lastSendResult };
    }
    if (profileThisFrame) addStat(state.liveProfiler.phasesMs.reorderPackets, Date.now() - reorderStart);
    state.liveProfiler.packetOrder = packetOrderMode;
    const summarizeStart = profileThisFrame ? Date.now() : 0;
    const shouldRefreshPacketSummary = !state.lastPacketSummary || profileThisFrame;
    const packetSummary = shouldRefreshPacketSummary ? summarizePackets(orderedPackets) : state.lastPacketSummary;
    if (profileThisFrame) addStat(state.liveProfiler.phasesMs.summarizePackets, Date.now() - summarizeStart);
    if (shouldRefreshPacketSummary) state.lastPacketSummary = packetSummary;
    const effectiveMode = resolvedFrameOptions.mode === 'udp-armed' ? 'udp-armed' : (resolvedFrameOptions.mode === 'dry-run' ? 'dry-run' : state.mode);
    const effectiveArmed = resolvedFrameOptions.armed === true || resolvedFrameOptions.armed === 'true' || state.armed;
    if (effectiveMode === 'udp-armed') {
      if (!effectiveArmed) throw new Error('ArtNet UDP send blocked: sender is not armed. Use armed=true.');
      const routeWrite = serverOutputRegistry37BC.canWrite({ owner: STEP37BC_ARTNET_SERVER_OWNER, kind: 'artnet-udp', acquireIfFree: true });
      if (!routeWrite.allowed) {
        state.skippedFrameCount += 1;
        state.lastSendResult = { sent: false, reason: 'server-output-route-denied', registry: routeWrite.status };
        return { ok: false, sent: false, blocked: true, reason: 'server-output-route-denied', serverOutputRegistry37BC: routeWrite.status };
      }
      if (!state.socket) primeSocket(resolvedFrameOptions);
      if (state.socketReady) {
        const queueStart = profileThisFrame ? Date.now() : 0;
        const queueNow = Date.now();
        // STEP22NR: avoid extra wall-clock/string work on every live master frame.
        // A monotonically increasing numeric batch id is enough for diagnostics,
        // and keeps the ArtNet event path lighter under 25-60 FPS load.
        const batchId = state.frameCount + 1;
        const batch = { id: batchId, queuedAt: queueNow, targetIp, targetPort, packetTargets, targetMode: resolvedTarget.targetMode, broadcast: resolvedTarget.broadcast, queuedPackets: orderedPackets.length, callbackOk: 0, callbackError: 0, callbackDone: false, lastError: null };
        state.lastUdpBatch = batch;
        const callbackMode = String(resolvedFrameOptions.callbackMode || state.callbackMode || 'none');
        const pacerOptions = resolvePacerOptions(resolvedFrameOptions);
        batch.callbackMode = callbackMode;
        batch.packetPaceMs = pacerOptions.packetPaceMs;
        batch.packetsPerBurst = pacerOptions.packetsPerBurst;
        batch.paced = pacerOptions.enabled;
        sendUdpBatchPackets({ batch, packets: orderedPackets, targetPort, targetIp, callbackMode });
        rememberUdpTruth37CP(state, { targetIp, targetPort, packetTargets, bindIp: state.socketBindIp || '', socketAddress: state.socketAddressSnapshot, packetCount: orderedPackets.length, bytes: packetSummary.bytes });
        if (profileThisFrame) addStat(state.liveProfiler.phasesMs.queueSend, Date.now() - queueStart);
        state.sentFrameCount += 1;
        const sendNow = Date.now();
        if (!state.recentSentWindow.startedAt || sendNow - state.recentSentWindow.startedAt >= 1000) {
          const elapsed = state.recentSentWindow.startedAt ? Math.max(1, sendNow - state.recentSentWindow.startedAt) : 1000;
          state.recentSentWindow.actualFps = Number((state.recentSentWindow.sent * 1000 / elapsed).toFixed(2));
          state.recentSentWindow.startedAt = sendNow;
          state.recentSentWindow.sent = 0;
          state.recentSentWindow.minIntervalMs = null;
          state.recentSentWindow.maxIntervalMs = 0;
        }
        state.recentSentWindow.sent += 1;
        if (state.liveProfiler.lastSendAt) {
          const sendInterval = sendNow - state.liveProfiler.lastSendAt;
          state.recentSentWindow.lastIntervalMs = sendInterval;
          state.recentSentWindow.minIntervalMs = state.recentSentWindow.minIntervalMs == null ? sendInterval : Math.min(state.recentSentWindow.minIntervalMs, sendInterval);
          state.recentSentWindow.maxIntervalMs = Math.max(state.recentSentWindow.maxIntervalMs || 0, sendInterval);
          addIntervalStat(state.liveProfiler.sendIntervalMs, sendInterval, state.liveProfiler.targetIntervalMs || state.frameClock.sendIntervalMs); state.liveProfiler.sendSamples += 1;
        }
        state.liveProfiler.lastSendAt = sendNow;
        state.lastSendAt = sendNow;
        const detailedResult = profileThisFrame || !state.lastDetailedSendResultAt || sendNow - state.lastDetailedSendResultAt >= 1000;
        if (detailedResult) state.lastDetailedSendResultAt = sendNow;
        state.lastSendResult = detailedResult
          ? { sent: true, reason: 'udp-queued', targetIp, targetPort, packetTargets, targetMode: resolvedTarget.targetMode, broadcast: resolvedTarget.broadcast, configuredOutputIp: resolvedTarget.configuredOutputIp, bindIp: state.socketBindIp || '', socketAddress: state.socketAddressSnapshot, packetCount: orderedPackets.length, bytes: packetSummary.bytes, packetSummary, batchId, pacer: { ...state.pacer } }
          : { sent: true, reason: 'udp-queued-fast', targetIp, targetPort, packetTargets, packetCount: orderedPackets.length, bytes: packetSummary.bytes, batchId };
      } else {
        state.skippedFrameCount += 1;
        state.lastSendResult = { sent: false, reason: 'socket-not-ready-yet', targetIp, targetPort, packetTargets, bindIp: String(resolvedFrameOptions.bindIp || resolvedFrameOptions.localAddress || state.options.bindIp || state.options.localAddress || '').trim() };
      }
    } else {
      state.lastSendResult = { sent: false, reason: 'dry-run', targetIp, targetPort, packetTargets, targetMode: resolvedTarget.targetMode, broadcast: resolvedTarget.broadcast, configuredOutputIp: resolvedTarget.configuredOutputIp, packetSummary };
    }
    state.lastFrameBuildMs = Date.now() - frameBuildStart;
    state.frameCount += 1;
    state.packetCount += orderedPackets.length;
    state.byteCount += packetSummary.bytes || orderedPackets.reduce((sum, p) => sum + p.packetBytes, 0);
    state.lastFrameAt = Date.now();
    state.lastSummary = outputSummary;
    return {
      ok: true,
      version: STEP22DQ_ARTNET_SYNC_LIVE_VERSION,
      sent: effectiveMode === 'udp-armed' && state.socketReady,
      socketReady: state.socketReady,
      dryRun: effectiveMode !== 'udp-armed',
      sentFrameCount: state.sentFrameCount,
      skippedFrameCount: state.skippedFrameCount,
      skipRatePct: (state.sentFrameCount + state.skippedFrameCount) > 0 ? Number(((state.skippedFrameCount / Math.max(1, state.sentFrameCount + state.skippedFrameCount)) * 100).toFixed(2)) : 0,
      lastSendResult: state.lastSendResult,
      target: { host: targetIp, port: targetPort, targetMode: resolvedTarget.targetMode, broadcast: resolvedTarget.broadcast, configuredOutputIp: resolvedTarget.configuredOutputIp, bindIp: String(resolvedFrameOptions.bindIp || resolvedFrameOptions.localAddress || state.options.bindIp || state.options.localAddress || '').trim() },
      packetSummary,
      summary: outputSummary
    };
  }

  function start(options = {}) {
    if (state.startInProgress) {
      return { ...status(), ok: false, blocked: true, reason: 'start-already-in-progress' };
    }
    if (state.running) stop();
    state.startInProgress = true;
    try {
      state.options = { ...state.options, ...options };
      const requestedBindIp37CN = String(state.options.bindIp || state.options.localAddress || '').trim();
      const requestedOutputIp37CN = String(state.options.outputIp || state.options.host || '').trim();
      if (state.mode === 'udp-armed' || options.mode === 'udp-armed') {
        if (!requestedBindIp37CN) throw new Error('BIND_IP_REQUIRED_NO_AUTO_WINDOWS_ROUTE');
        assertValidArtNetIp37CN(requestedBindIp37CN, 'BIND_IP');
        assertValidArtNetIp37CN(requestedOutputIp37CN, 'OUTPUT_IP');
      }
      state.options.visualPattern = normalizeVisualPattern(state.options.visualPattern, 'master-framebus');
      state.options.sourceMode = normalizeSourceMode(state.options.sourceMode, 'performance-master-only');
      state.mode = options.mode === 'udp-armed' ? 'udp-armed' : 'dry-run';
      state.armed = options.armed === true || options.armed === 'true';
      state.options.requireExplicitPatch = options.requireExplicitPatch !== false;
      if (state.mode === 'udp-armed' && !state.armed) throw new Error('Refusing to start UDP ArtNet without armed=true.');
      if (state.mode === 'udp-armed' && state.options.requireExplicitPatch) {
        const patch = latestPatch37CK(options.artnetPatch, null);
        const routeCount = Array.isArray(patch?.routes) ? patch.routes.filter((route) => {
          const target = String(route?.outputIp || route?.targetIp || route?.host || '').trim();
          return target && target.toLowerCase() !== 'default' && route?.enabled !== false;
        }).length : 0;
        if (!routeCount) {
          state.lastError = 'NO_EXPLICIT_ARTNET_PATCH_TARGETS';
          state.lastSendResult = { sent: false, blocked: true, reason: state.lastError, note: 'No enabled Mapping strip has an explicit ArtNet IP.' };
          return { ...status(), ok: false, blocked: true, reason: state.lastError, lastSendResult: state.lastSendResult };
        }
      }
      if (state.mode === 'udp-armed') {
        const routeLease = serverOutputRegistry37BC.acquire({ owner: STEP37BC_ARTNET_SERVER_OWNER, kind: 'artnet-udp' });
        if (!routeLease.allowed) {
          state.lastError = `SERVER_OUTPUT_ROUTE_DENIED:${routeLease.reason || 'unknown'}:${routeLease.activeOwner || 'none'}`;
          return { ...status(), ok: false, blocked: true, reason: state.lastError, serverOutputRegistry37BC: routeLease.status };
        }
      }
      state.running = true;
      state.startedAt = Date.now();
      state.frameCount = 0;
      state.packetCount = 0;
      state.masterDriven = { enabled: String(options.masterDriven ?? state.options.masterDriven ?? 'on').toLowerCase() !== 'off', lastTriggerAt: 0, triggerCount: 0, sentCount: 0, skippedCount: 0, duplicateFrameSkips: 0, minGapSkips: 0, notReadySkips: 0, lastFrameId: null, lastReason: null, lastAgeMs: null, windowStartedAt: 0, windowSent: 0, actualFps: 0 };
      state.byteCount = 0;
      state.lastError = null;
      state.sentFrameCount = 0;
      state.skippedFrameCount = 0;
      state.lastSendAt = 0;
      state.lastSendResult = null;
      state.udpPacketCallbackCount = 0;
      state.udpPacketCallbackErrorCount = 0;
      state.lastUdpCallbackAt = 0;
      state.lastUdpCallbackError = null;
      state.lastUdpBatch = null;
      state.recentSentWindow = { startedAt: 0, sent: 0, actualFps: 0, lastIntervalMs: null, minIntervalMs: null, maxIntervalMs: 0 };
      resetUdpHotpath37DN();
      state.pacer.activeBatchId = null;
      state.pacer.pendingPackets = 0;
      state.lastTickDurationMs = 0;
      state.maxTickDurationMs = 0;
      state.lastStartKind = options.durationMs ? 'timed-test-burst' : 'continuous-live';
      const requestedFps = clampInt(state.options.fps, 1, 120, 60);
      const ultraSafe = options.ultraSafe === true || options.ultraSafe === 'true' || String(options.liveLoop || '').toLowerCase() === 'ultra-safe';
      const safeMax = ultraSafe ? clampInt(state.options.maxLiveFps ?? options.maxLiveFps, 1, 30, 15) : clampInt(state.options.maxLiveFps ?? options.maxLiveFps, 1, 60, 60);
      state.maxLiveFps = safeMax;
      state.callbackMode = String(options.callbackMode || state.options.callbackMode || 'none');
      state.options.packetPaceMs = clampInt(options.packetPaceMs ?? state.options.packetPaceMs, 0, 25, 0);
      state.options.packetsPerBurst = clampInt(options.packetsPerBurst ?? state.options.packetsPerBurst, 1, 32, 32);
      state.options.maxPendingBatchMs = clampInt(options.maxPendingBatchMs ?? state.options.maxPendingBatchMs, 20, 2000, ultraSafe ? 180 : 80);
      state.options.packetOrder = String(options.packetOrder || state.options.packetOrder || 'sequential');
      state.options.artSyncMode = String(options.artSyncMode || state.options.artSyncMode || 'every-frame');
      state.options.artSyncEveryN = clampInt(options.artSyncEveryN ?? state.options.artSyncEveryN, 1, 120, 1);
      state.liveProfiler = newLiveProfilerState();
      state.liveProfiler.packetOrder = state.options.packetOrder;
      const longRunDurationMs = clampInt(options.longRunDurationMs ?? options.durationMs ?? 0, 0, 21600000, 0);
      state.longRun = newLongRunState();
      if (longRunDurationMs > 0) {
        state.longRun.enabled = true;
        state.longRun.startedAt = Date.now();
        state.longRun.plannedDurationMs = longRunDurationMs;
        state.longRun.endAt = state.longRun.startedAt + longRunDurationMs;
        state.longRun.startCounters = {
          sentFrameCount: state.sentFrameCount,
          skippedFrameCount: state.skippedFrameCount,
          packetCount: state.packetCount,
          byteCount: state.byteCount,
          udpPacketCallbackCount: state.udpPacketCallbackCount,
          udpPacketCallbackErrorCount: state.udpPacketCallbackErrorCount
        };
      }
      state.backpressure.enabled = String(options.backpressure || state.options.backpressure || 'on').toLowerCase() !== 'off';
      state.backpressure.maxPendingBatchMs = state.options.maxPendingBatchMs;
      state.backpressure.consecutiveSkips = 0;
      state.backpressure.maxConsecutiveSkips = 0;
      state.backpressure.lastSkipAt = 0;
      state.backpressure.lastSkipReason = null;
      state.backpressure.lastPendingMs = 0;
      state.backpressure.droppedStaleBatches = 0;
      state.backpressure.adaptiveFpsDropCount = 0;
      const fps = state.mode === 'udp-armed' ? Math.min(requestedFps, safeMax) : Math.min(requestedFps, 60);
      state.options.effectiveFps = fps;
      state.frameClock.requestedFps = requestedFps;
      state.frameClock.maxEffectiveFps = fps;
      state.frameClock.effectiveFps = fps;
      state.frameClock.sendIntervalMs = Math.max(8, 1000 / fps);
      state.liveProfiler.targetIntervalMs = state.frameClock.sendIntervalMs;
      state.frameClock.nextDueAt = Date.now() + state.frameClock.sendIntervalMs;
      state.frameClock.expectedFrameIndex = 0;
      state.frameClock.lateTicks = 0;
      state.frameClock.maxLatenessMs = 0;
      state.frameClock.lastLatenessMs = 0;
      state.frameClock.stableTicks = 0;
      state.frameClock.lastRecoverAt = 0;
      state.frameClock.cacheHitCount = 0;
      state.frameClock.cacheMissCount = 0;
      // STEP22NV: in master-driven mode the browser already paces incoming
      // Performance frames. The server must not adaptively ratchet the ArtNet
      // sender down to 30/25 FPS because of transient UDP batch/backpressure
      // diagnostics; that is exactly the visible stair-step the operator sees.
      // Keep adaptive recovery only for the old autonomous server timer mode.
      const masterDrivenRequested = String(options.masterDriven ?? state.options.masterDriven ?? 'on').toLowerCase() !== 'off';
      state.masterDriven.enabled = masterDrivenRequested;
      state.masterDriven.windowStartedAt = 0;
      state.masterDriven.windowSent = 0;
      state.masterDriven.actualFps = 0;
      state.frameClock.adaptiveEnabled = !masterDrivenRequested && String(options.adaptiveFrameClock ?? state.options.adaptiveFrameClock ?? ARTNET_LIVE_DEFAULTS.adaptiveFrameClock).toLowerCase() !== 'off';
      state.frameClock.adaptiveFloorFps = clampInt(options.adaptiveFloorFps ?? state.options.adaptiveFloorFps, 1, 60, ARTNET_LIVE_DEFAULTS.adaptiveFloorFps);
      state.frameClock.blackoutAfterHold = String(options.blackoutAfterHold ?? state.options.blackoutAfterHold ?? 'off').toLowerCase() === 'on';
      state.options.ultraSafe = ultraSafe;
      state.options.liveLoop = ultraSafe ? 'ultra-safe-setTimeout' : 'safe-setTimeout';
      let intervalMs = state.frameClock.sendIntervalMs;
      if (state.mode === 'udp-armed') primeSocket(state.options);
      const tick = () => {
        if (!state.running) return;
        if (state.tickBusy) {
          state.skippedFrameCount += 1;
          state.lastSendResult = { sent: false, reason: 'tick-still-busy-skip' };
          return;
        }
        state.tickBusy = true;
        const t0 = Date.now();
        if (state.liveProfiler.lastTickAt) { addIntervalStat(state.liveProfiler.tickIntervalMs, t0 - state.liveProfiler.lastTickAt, intervalMs); state.liveProfiler.tickSamples += 1; }
        state.liveProfiler.lastTickAt = t0;
        state.frameClock.lastTickAt = t0;
        const lateness = Math.max(0, t0 - (state.frameClock.nextDueAt || t0));
        state.frameClock.lastLatenessMs = lateness;
        state.frameClock.maxLatenessMs = Math.max(state.frameClock.maxLatenessMs || 0, lateness);
        if (lateness > intervalMs * 1.5) state.frameClock.lateTicks += 1;
        try {
          const b = state.lastUdpBatch;
          const pendingMs = b && !b.callbackDone ? (Date.now() - b.queuedAt) : 0;
          state.backpressure.lastPendingMs = pendingMs;
          const maxPendingMs = clampInt(state.options.maxPendingBatchMs, 50, 2000, ultraSafe ? 350 : 250);
          state.backpressure.maxPendingBatchMs = maxPendingMs;
          if (state.mode === 'udp-armed' && b && !b.callbackDone && pendingMs < maxPendingMs) {
            state.skippedFrameCount += 1;
            state.backpressure.consecutiveSkips += 1;
            state.backpressure.maxConsecutiveSkips = Math.max(state.backpressure.maxConsecutiveSkips, state.backpressure.consecutiveSkips);
            state.backpressure.lastSkipAt = Date.now();
            state.backpressure.lastSkipReason = 'previous-udp-batch-still-pending';
            state.frameClock.stableTicks = 0;
            if (state.frameClock.adaptiveEnabled && state.backpressure.consecutiveSkips >= 3 && state.frameClock.effectiveFps > state.frameClock.adaptiveFloorFps) {
              state.frameClock.effectiveFps = Math.max(state.frameClock.adaptiveFloorFps, Math.floor(state.frameClock.effectiveFps * 0.75));
              intervalMs = Math.max(8, 1000 / state.frameClock.effectiveFps);
              state.frameClock.sendIntervalMs = intervalMs;
              state.liveProfiler.targetIntervalMs = intervalMs;
              state.frameClock.adaptiveFpsDrops += 1;
              state.backpressure.adaptiveFpsDropCount += 1;
              state.options.effectiveFps = state.frameClock.effectiveFps;
            }
            state.lastSendResult = { sent: false, reason: 'previous-udp-batch-still-pending', previousBatchId: b.id, pendingMs, maxPendingBatchMs: maxPendingMs, pacer: { ...state.pacer }, backpressure: { ...state.backpressure } };
          } else {
            if (state.mode === 'udp-armed' && b && !b.callbackDone && pendingMs >= maxPendingMs) {
              b.cancelled = true;
              b.callbackDone = true;
              state.pacer.activeBatchId = null;
              state.pacer.pendingPackets = 0;
              state.backpressure.droppedStaleBatches += 1;
              state.backpressure.lastSkipReason = 'stale-batch-dropped';
            }
            state.backpressure.consecutiveSkips = 0;
            sendOneFrame({ callbackMode: state.callbackMode });
            state.frameClock.stableTicks += 1;
            const nowStable = Date.now();
            const recoverCooldownMs = 1200;
            const stableTicksNeeded = Math.max(12, Math.round(state.frameClock.maxEffectiveFps / 3));
            if (state.frameClock.adaptiveEnabled
              && state.frameClock.effectiveFps < state.frameClock.maxEffectiveFps
              && state.frameClock.stableTicks >= stableTicksNeeded
              && nowStable - Number(state.backpressure.lastSkipAt || 0) >= recoverCooldownMs
              && nowStable - Number(state.frameClock.lastRecoverAt || 0) >= recoverCooldownMs) {
              const nextEffectiveFps = Math.min(
                state.frameClock.maxEffectiveFps,
                Math.max(
                  state.frameClock.effectiveFps + 2,
                  Math.ceil(state.frameClock.effectiveFps * 1.15)
                )
              );
              if (nextEffectiveFps > state.frameClock.effectiveFps) {
                state.frameClock.effectiveFps = nextEffectiveFps;
                intervalMs = Math.max(8, 1000 / state.frameClock.effectiveFps);
                state.frameClock.sendIntervalMs = intervalMs;
                state.liveProfiler.targetIntervalMs = intervalMs;
                state.frameClock.lastRecoverAt = nowStable;
                state.frameClock.adaptiveFpsRecovers += 1;
                state.options.effectiveFps = state.frameClock.effectiveFps;
                state.frameClock.stableTicks = 0;
              }
            }
          }
        } catch (error) {
          state.lastError = error.message;
          stop();
        } finally {
          const dt = Date.now() - t0;
          state.lastTickDurationMs = dt;
          addStat(state.liveProfiler.tickDurationMs, dt);
          state.maxTickDurationMs = Math.max(state.maxTickDurationMs || 0, dt);
          state.tickBusy = false;
          if (dt > (ultraSafe ? 250 : 500)) {
            state.lastError = `LIVE_TICK_TOO_SLOW_${dt}ms_STOPPED`;
            stop();
          } else if (state.running) {
            // STEP22ME: smoother frame pacing. Keep the deterministic clock when
            // only slightly late, but resync instead of queuing catch-up bursts
            // after UI/page-transition stalls. This avoids visible packet rhythm
            // bunching on ArtNet nodes.
            const nowAfterTick = Date.now();
            const previousDue = state.frameClock.nextDueAt || nowAfterTick;
            let nextDue = previousDue + intervalMs;
            if (nowAfterTick - nextDue > intervalMs * 2) nextDue = nowAfterTick + intervalMs;
            state.frameClock.nextDueAt = nextDue;
            state.timer = setTimeout(tick, Math.max(0, nextDue - nowAfterTick));
          }
        }
      };
      if (longRunDurationMs > 0) {
        state.stopTimer = setTimeout(() => {
          if (state.running) {
            state.longRun.completed = true;
            state.longRun.enabled = false;
            state.longRun.stoppedReason = 'completed-duration';
            state.longRun.report = buildLongRunReport(state, 'completed-duration');
            stop();
          }
        }, longRunDurationMs);
      }
      if (state.masterDriven.enabled && state.mode === 'udp-armed' && String(state.options.visualPattern || '').toLowerCase() === 'master-framebus') {
        state.lastSendResult = { sent: false, reason: 'master-driven-waiting-for-frame', note: 'ArtNet send is triggered directly by each incoming Performance master frame instead of a second server timer.' };
      } else if (options.sendImmediately !== false) {
        const delayMs = state.mode === 'udp-armed' ? clampInt(options.firstFrameDelayMs, 0, 1500, 50) : 0;
        if (delayMs > 0) setTimeout(() => { if (state.running) tick(); }, delayMs);
        else tick();
      }
      return status();
    } finally {
      state.startInProgress = false;
    }
  }
  function markMasterDrivenSent(now = Date.now()) {
    if (!state.masterDriven.windowStartedAt || now - state.masterDriven.windowStartedAt >= 1000) {
      const elapsed = state.masterDriven.windowStartedAt ? Math.max(1, now - state.masterDriven.windowStartedAt) : 1000;
      state.masterDriven.actualFps = Number((state.masterDriven.windowSent * 1000 / elapsed).toFixed(2));
      state.masterDriven.windowStartedAt = now;
      state.masterDriven.windowSent = 0;
    }
    state.masterDriven.windowSent += 1;
  }

  function sendLatestMasterEvent(trigger = {}) {
    state.masterDriven.triggerCount += 1;
    state.masterDriven.lastTriggerAt = Date.now();
    if (!state.masterDriven.enabled || !state.running || state.mode !== 'udp-armed') {
      state.masterDriven.skippedCount += 1;
      state.masterDriven.lastReason = 'not-running-or-disabled';
      return { ok: false, sent: false, reason: state.masterDriven.lastReason, masterDriven: { ...state.masterDriven } };
    }
    const eventGuard = backendWriterGuard37BZ(state, { frameClockSource: 'master-ws-event-direct-fastpath', masterFrameSnapshot: trigger.latest || trigger.masterFrameSnapshot || null }, 'master-event');
    state.backendWriterGuard37BZ.lastDecision = { ...eventGuard, at: Date.now() };
    if (!eventGuard.allowed) {
      state.masterDriven.skippedCount += 1;
      state.backendWriterGuard37BZ.blockedCount += 1;
      state.masterDriven.lastReason = eventGuard.reason;
      return { ok: false, sent: false, blocked: true, reason: eventGuard.reason, backendWriterGuard37BZ: eventGuard, masterDriven: { ...state.masterDriven } };
    }
    state.backendWriterGuard37BZ.allowedCount += 1;
    const routeWrite = serverOutputRegistry37BC.canWrite({ owner: STEP37BC_ARTNET_SERVER_OWNER, kind: 'artnet-udp', acquireIfFree: true });
    if (!routeWrite.allowed) {
      state.masterDriven.skippedCount += 1;
      state.masterDriven.lastReason = 'server-output-route-denied';
      state.lastError = 'SERVER_OUTPUT_ROUTE_DENIED';
      return { ok: false, sent: false, reason: state.masterDriven.lastReason, serverOutputRegistry37BC: routeWrite.status, masterDriven: { ...state.masterDriven } };
    }
    if (!state.socket || !state.socketReady) {
      state.masterDriven.skippedCount += 1;
      state.masterDriven.notReadySkips += 1;
      state.masterDriven.lastReason = 'socket-not-ready';
      if (!state.socket) primeSocket(state.options);
      return { ok: false, sent: false, reason: state.masterDriven.lastReason, masterDriven: { ...state.masterDriven } };
    }
    const frameId = Number(trigger.frameId || trigger.latest?.frameId || 0);
    if (frameId > 0 && state.masterDriven.lastFrameId === frameId) {
      state.masterDriven.skippedCount += 1;
      state.masterDriven.duplicateFrameSkips += 1;
      state.masterDriven.lastReason = 'duplicate-master-frame';
      return { ok: false, sent: false, reason: state.masterDriven.lastReason, masterDriven: { ...state.masterDriven } };
    }
    const now = Date.now();
    const maxFps = clampInt(state.options.maxLiveFps ?? state.maxLiveFps, 1, 120, 60);
    if (maxFps < 60) {
      state.maxLiveFps = 60;
      state.options.maxLiveFps = 60;
      state.frameClock.maxEffectiveFps = Math.max(Number(state.frameClock.maxEffectiveFps || 0), 60);
      state.frameClock.effectiveFps = Math.max(Number(state.frameClock.effectiveFps || 0), 60);
      state.frameClock.sendIntervalMs = 1000 / 60;
    }
    const directFrame = trigger.latest && trigger.latest.frame ? trigger.latest : (trigger.masterFrameSnapshot && trigger.masterFrameSnapshot.frame ? trigger.masterFrameSnapshot : null);
    // STEP22NI: do not pace twice. The browser/master mirror already sends one
    // packet per accepted Performance frame. A second min-gap gate here can turn
    // natural rAF jitter into visible dropped frames. Keep duplicate frameId
    // protection above, but allow each unique live frame through immediately.
    const minGapMs = 0;
    try {
      const result = directFrame?.frame instanceof Uint8Array
        ? sendMasterFrameFastPath(directFrame, {
            callbackMode: state.callbackMode,
            frameClockSource: 'master-ws-event-direct-fastpath',
            artnetPatch: directFrame?.artnetPatch || undefined,
            stripCount: directFrame?.stripCount || state.options.stripCount,
            pixelsPerStrip: directFrame?.pixelsPerStrip || state.options.pixelsPerStrip,
            width: directFrame?.width || directFrame?.pixelsPerStrip || state.options.width,
            height: directFrame?.height || directFrame?.stripCount || state.options.height
          })
        : sendOneFrame({
            callbackMode: state.callbackMode,
            frameClockSource: 'master-ws-event-direct',
            masterFrameSnapshot: directFrame || undefined,
            rgb: directFrame?.frame,
            artnetPatch: directFrame?.artnetPatch || undefined,
            stripCount: directFrame?.stripCount || state.options.stripCount,
            pixelsPerStrip: directFrame?.pixelsPerStrip || state.options.pixelsPerStrip,
            width: directFrame?.width || directFrame?.pixelsPerStrip || state.options.width,
            height: directFrame?.height || directFrame?.stripCount || state.options.height
          });
      state.masterDriven.sentCount += 1;
      markMasterDrivenSent(Date.now());
      if (frameId > 0) state.masterDriven.lastFrameId = frameId;
      state.masterDriven.lastAgeMs = Number(trigger.ageMs || trigger.latest?.ageMs || 0);
      state.masterDriven.lastReason = 'sent-master-event-frame';
      return { ...result, masterDriven: { ...state.masterDriven } };
    } catch (error) {
      state.masterDriven.skippedCount += 1;
      state.masterDriven.lastReason = error?.message || String(error);
      state.lastError = state.masterDriven.lastReason;
      return { ok: false, sent: false, reason: state.masterDriven.lastReason, masterDriven: { ...state.masterDriven } };
    }
  }


  function blackout(options = {}) {
    return sendOneFrame({
      ...options,
      visualPattern: 'blackout',
      pattern: 'blackout',
      operatorIntent: true,
      source: options.source || 'operator-blackout',
      rgb: makeBlackFrame({
        stripCount: options.stripCount || state.options.stripCount,
        pixelsPerStrip: options.pixelsPerStrip || state.options.pixelsPerStrip
      })
    });
  }

  function longRunReport() {
    if (state.longRun.enabled) state.longRun.report = buildLongRunReport(state, 'running-snapshot');
    else if (!state.longRun.report) state.longRun.report = buildLongRunReport(state, 'manual-snapshot');
    return { ok: true, version: STEP22EW_LONG_RUN_TEST_VERSION, running: state.running, longRun: { ...state.longRun, remainingMs: state.longRun.enabled && state.longRun.endAt ? Math.max(0, state.longRun.endAt - Date.now()) : 0, report: state.longRun.report ? { ...state.longRun.report } : null } };
  }

  function stabilityGate() {
    if (state.longRun.enabled) state.longRun.report = buildLongRunReport(state, 'running-gate-snapshot');
    else if (!state.longRun.report) state.longRun.report = buildLongRunReport(state, 'manual-gate-snapshot');
    return buildStabilityGate(state, state.longRun.enabled ? 'running' : 'last-report');
  }

  function resetProfiler() {
    state.liveProfiler = newLiveProfilerState();
    state.liveProfiler.targetIntervalMs = state.frameClock.sendIntervalMs || 0;
    state.liveProfiler.packetOrder = String(state.options.packetOrder || 'sequential');
    return status();
  }

  function watchdog() {
    const now = Date.now();
    state.watchdog.lastCheckAt = now;
    state.watchdog.stale = state.running && state.lastSendAt ? (now - state.lastSendAt > state.watchdog.staleAfterMs) : false;
    return {
      ok: !state.watchdog.stale,
      version: STEP22DQ_ARTNET_SYNC_LIVE_VERSION,
      stale: state.watchdog.stale,
      running: state.running,
      lastSendAt: state.lastSendAt || null,
      ageMs: state.lastSendAt ? now - state.lastSendAt : null,
      lastSendResult: state.lastSendResult,
      lastPacketSummary: state.lastPacketSummary
    };
  }

  return { status, start, stop, sendOneFrame, sendLatestMasterEvent, primeSocket, blackout, watchdog, resetProfiler, longRunReport, stabilityGate };
}
