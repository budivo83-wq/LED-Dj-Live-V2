import { startFpsMeter } from './topbar.js';
import { applyAppearance, sanitizeAppearance } from './appearance.js';
import { applyFullscreenPreference, syncFullscreenButtonLabel, toggleFullscreen } from './fullscreen.js';
import { ARTNET_LIVE_DEFAULTS } from './core/artnet_live_defaults.js';
import { compileArtNetPatchFromMappingV2, finalizeArtNetPatch, mappingV2ToLegacyExport } from './runtime/mapping_v2.js';
import { LEGACY_MAPPING_STORAGE_KEY, loadMappingV2, saveMappingV2 } from './runtime/mapping_v2_store.js';


function managedSettingsInterval37CG(name, fn, baseMs, opts = {}) {
  try {
    const reg = window.__budilightRuntimeLoopRegistry37CE;
    if (reg && typeof reg.adaptiveInterval === 'function') {
      return reg.adaptiveInterval(name, fn, baseMs, Object.assign({ group: 'settings', liveFactor: 4, hiddenFactor: 4, maxMs: 10000, skipWhenHidden: true }, opts || {}));
    }
  } catch {}
  return setInterval(fn, Math.max(1, Number(baseMs) || 1));
}

const SETTINGS_KEY = 'led-engine-settings-v1';
const FPS_DEFAULTS_60_MIGRATION_KEY = 'led-engine-fps-defaults-60-v1';
const SERIAL_KEY = 'led-engine-serial-v1';
const ROUTER_KEY = 'led-engine-parallel-output-router-v1';
const ARTNET_MASTER_PATCH_STORAGE_KEY = 'led-engine-artnet-master-patch-v1';
const ARTNET_MULTIOUT_STORAGE_KEY = 'led-engine-artnet-multiout-v1';
const ARTNET_SYNC_LIVE_API = Object.freeze({
  config: '/api/artnet/live-config',
  primeSocket: '/api/artnet/sync-live/prime-socket',
  start: '/api/artnet/sync-live/start',
  stop: '/api/artnet/sync-live/stop',
  sendOne: '/api/artnet/sync-live/send-one',
  status: '/api/artnet/sync-live/status',
  truthSmoke: '/api/artnet/sync-live/truth-smoke',
  masterStatus: '/api/artnet/master-mirror/status',
  schedulerValidate: '/api/artnet-scheduler/22p/validate',
  discovery: '/api/artnet/debug/discovery',
  nodes: '/api/artnet/debug/nodes'
});

const defaults = {
  fps: ARTNET_LIVE_DEFAULTS.fps,
  previewFps: 60,
  layerPreviewFps: 60,
  gamma: 2.2,
  contrast: 1.35,
  brightnessLimit: 1,
  theme: 'dark',
  fullscreenPreferred: false,
  routerSerialEnabled: false,
  routerArtnetEnabled: false,
  routerUsbDmxEnabled: false,
  outputMode: 'preview',
  serialPort: '',
  serialBaud: 1000000,
  serialFps: 60,
  shaderPreviewFps: 60,
  serialProtocol: 'aa_len_rgb',
  targetIp: ARTNET_LIVE_DEFAULTS.outputIp,
  bindIp: ARTNET_LIVE_DEFAULTS.bindIp,
  networkAdapter: ARTNET_LIVE_DEFAULTS.bindIp,
  targetMode: ARTNET_LIVE_DEFAULTS.targetMode,
  artnetPort: ARTNET_LIVE_DEFAULTS.port,
  universe: 0,
  pixelsPerUniverse: ARTNET_LIVE_DEFAULTS.pixelsPerUniverse,
  net: 0,
  subnet: 0,
  artnetMirrorFps: ARTNET_LIVE_DEFAULTS.fps,
  maxLiveFps: ARTNET_LIVE_DEFAULTS.maxLiveFps,
  packetPaceMs: ARTNET_LIVE_DEFAULTS.packetPaceMs,
  packetsPerBurst: ARTNET_LIVE_DEFAULTS.packetsPerBurst,
  maxPendingBatchMs: ARTNET_LIVE_DEFAULTS.maxPendingBatchMs,
  callbackMode: ARTNET_LIVE_DEFAULTS.callbackMode,
  adaptiveFrameClock: ARTNET_LIVE_DEFAULTS.adaptiveFrameClock,
  adaptiveFloorFps: ARTNET_LIVE_DEFAULTS.adaptiveFloorFps,
  packetOrder: ARTNET_LIVE_DEFAULTS.packetOrder,
  artSyncMode: ARTNET_LIVE_DEFAULTS.artSyncMode,
  masterMaxAgeMs: ARTNET_LIVE_DEFAULTS.masterMaxAgeMs,
  lastGoodHoldMs: ARTNET_LIVE_DEFAULTS.lastGoodHoldMs,
  blackoutAfterHold: ARTNET_LIVE_DEFAULTS.blackoutAfterHold,
  artnetEnabled: false,
  artnetMultiOutEnabled: false,
  artnetMultiOutDefaultIp: '',
  artnetMultiOutRoutes: '',
  raspiMode: false,
  runtimePreset: 'normal-pc',
  adaptiveFpsMode: 'off',
  adaptiveApplyMode: 'soft-ui'
};

const $ = (id) => document.getElementById(id);
const qsa = (sel) => Array.from(document.querySelectorAll(sel));
const jsonHeaders = { 'Content-Type': 'application/json' };
const state = { ...defaults };
let healthTimer = null;
let serialStatusTimer = null;
let shellViewActive37BQ = true;
const settingsPerf37BQ = {
  version: 'STEP37BQ_SETTINGS_ACTIVE_REFRESH_GATE',
  active: true,
  healthSkipped: 0,
  serialSkipped: 0,
  lastHealthAt: 0,
  lastSerialAt: 0
};
try { window.__budilightSettingsPerf37BQ = settingsPerf37BQ; } catch {}

function isShellViewActive37BQ() {
  return shellViewActive37BQ !== false;
}

function onShellViewActive37BQ(message) {
  const data = message?.data || {};
  if (!data || data.type !== 'led-shell-view-active') return;
  shellViewActive37BQ = data.active !== false;
  settingsPerf37BQ.active = shellViewActive37BQ;
  settingsPerf37BQ.updatedAt = Date.now();
  if (shellViewActive37BQ) {
    // Refresh once on return, but keep it async so cached page activation stays cheap.
    setTimeout(() => {
      try { refreshSerialStatus(); } catch {}
      try { refreshHealth(); } catch {}
    }, 0);
  }
}
try { window.addEventListener('message', onShellViewActive37BQ); } catch {}

const controls = Object.fromEntries(Object.keys(defaults).map((id) => [id, $(id)]));
const ui = {
  save: $('saveSettings'),
  rescue: $('rescueResetOutputState'),
  serialRefresh: $('serialRefresh'),
  serialConnect: $('serialConnect'),
  serialDisconnect: $('serialDisconnect'),
  serialOutput: $('serialOutput'),
  serialStatus: $('serialStatus'),
  artnetOutput: $('artnetOutput'),
  artnetStart: $('artnetStart'),
  artnetStop: $('artnetStop'),
  artnetDiscover: $('artnetDiscover'),
  artnetValidate: $('artnetValidate'),
  artnetSendRed: $('artnetSendRed'),
  artnetSendGreen: $('artnetSendGreen'),
  artnetSendBlue: $('artnetSendBlue'),
  artnetSendBlackout: $('artnetSendBlackout'),
  artnetNodesRefresh: $('artnetNodesRefresh'),
  artnetPresetSafe: $('artnetPresetSafe'),
  artnetPresetFast: $('artnetPresetFast'),
  artnetPresetAggressive: $('artnetPresetAggressive'),
  artnetStatus: $('artnetStatus'),
  artnetLiveMetrics: $('artnetLiveMetrics'),
  artnetPatchReport: $('artnetPatchReport'),
  artnetNodes: $('artnetNodes'),
  networkAdapter: $('networkAdapter'),
  bindIp: $('bindIp'),
  artnetMultiOutStatus: $('artnetMultiOutStatus'),
  artnetMultiOutSeed8x300: $('artnetMultiOutSeed8x300'),
  artnetMultiOutAddSplit: $('artnetMultiOutAddSplit'),
  artnetMultiOutClear: $('artnetMultiOutClear'),
  artnetMultiOutApply: $('artnetMultiOutApply'),
  artnetMultiOutApplyStart: $('artnetMultiOutApplyStart'),
  artnetSafe8x300Reset: $('artnetSafe8x300Reset'),
  artnetMultiOutSlotPanel: $('artnetMultiOutSlotPanel'),
  artnetPortWarning: $('artnetPortWarning'),
  artnetTruthPanel38A: $('artnetTruthPanel38A'),
  routerStatus: $('routerStatus'),
  health: $('liveOutputHealth'),
  outputState: $('outputState'),
  outputDetail: $('outputDetail'),
  fpsValue: $('fpsValue'),
  menuBtn: $('menuBtn'),
  centerMenu: $('centerMenuStrip'),
  menuFullscreen: $('menuFullscreenBtn'),
  menuQuit: $('menuQuitBtn'),
  deviceMessage: $('deviceMessage'),
  runtimeStatus: $('runtimeModeStatus'),
  runtimeHint: $('runtimePresetHint'),
  gammaValue: $('gammaValue'),
  contrastValue: $('contrastValue'),
  limitValue: $('limitValue'),
  globalOutputStatus37CT: $('globalOutputCorrectionStatus37CT'),
  resetGlobalOutputCorrection37CT: $('resetGlobalOutputCorrection37CT'),
  logout: $('logoutButton'),
  reboot: $('rebootButton'),
  shutdown: $('shutdownButton'),
  networkAdapter: $('networkAdapter')
};

function safeJsonParse(raw, fallback = {}) {
  try { return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
}

function readStored() {
  const storedSettings = safeJsonParse(localStorage.getItem(SETTINGS_KEY));
  if (storedSettings.previewFps == null) {
    const legacyPreview = Number(localStorage.getItem('budilightLivePreviewFpsCap') || localStorage.getItem('budilightShellLivePreviewFpsCap') || 0);
    if (Number.isFinite(legacyPreview) && legacyPreview > 0) storedSettings.previewFps = legacyPreview;
  }
  if (storedSettings.layerPreviewFps == null) {
    const legacyGap = Number(localStorage.getItem('budilightShellLiveRawPreviewGapMs') || localStorage.getItem('budilightLiveRawPreviewGapMs') || 0);
    if (Number.isFinite(legacyGap) && legacyGap > 0) {
      storedSettings.layerPreviewFps = Math.max(1, Math.min(60, Math.round(1000 / legacyGap)));
    }
  }
  return {
    ...storedSettings,
    ...safeJsonParse(localStorage.getItem(SERIAL_KEY)),
    ...safeJsonParse(localStorage.getItem(ROUTER_KEY))
  };
}

function writeStored() {
  const settings = { ...state, savedAt: new Date().toISOString() };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  const previewFps = Math.max(1, Math.min(60, Number(state.previewFps || 60)));
  const layerPreviewFps = Math.max(1, Math.min(60, Number(state.layerPreviewFps || defaults.layerPreviewFps || 60)));
  localStorage.setItem('budilightLivePreviewFpsCap', String(previewFps));
  localStorage.setItem('budilightShellLivePreviewFpsCap', String(previewFps));
  localStorage.setItem('budilightShellLiveMonitorRenderFps', String(previewFps));
  try {
    const shaderPreviewFps = Math.max(1, Math.min(60, Number(state.shaderPreviewFps || 60)));
    window.__budilightPreviewFpsCap37DZ = previewFps;
    window.dispatchEvent(new CustomEvent('budilight-preview-fps-changed', { detail: { previewFps, shaderPreviewFps } }));
    if ('BroadcastChannel' in window) {
      const ch = new BroadcastChannel('budilight-settings');
      ch.postMessage({ type: 'preview-fps', previewFps, shaderPreviewFps, source: 'settings-37dz' });
      ch.close();
    }
  } catch {}
  const rawPreviewGapMs = Math.max(50, Math.round(1000 / layerPreviewFps));
  localStorage.setItem('budilightShellLiveRawPreviewGapMs', String(rawPreviewGapMs));
  localStorage.setItem('budilightLiveRawPreviewGapMs', String(rawPreviewGapMs));
  localStorage.setItem(SERIAL_KEY, JSON.stringify({
    serialPort: state.serialPort,
    serialBaud: state.serialBaud,
    serialFps: state.serialFps,
    serialProtocol: state.serialProtocol
  }));
  localStorage.setItem(ROUTER_KEY, JSON.stringify({
    routerSerialEnabled: state.routerSerialEnabled,
    routerArtnetEnabled: state.routerArtnetEnabled,
    routerUsbDmxEnabled: state.routerUsbDmxEnabled,
    artnetEnabled: state.artnetEnabled
  }));
}

function toBool(value) {
  return value === true || value === 'true' || value === '1' || value === 1;
}

function readControlValue(el, fallback) {
  if (!el) return fallback;
  if (el.type === 'checkbox') return el.checked;
  if (el.tagName === 'SELECT' && (el.value === 'true' || el.value === 'false')) return el.value === 'true';
  if (el.type === 'number') return Number(el.value || fallback || 0);
  return el.value ?? fallback;
}

function setControlValue(el, value) {
  if (!el) return;
  if (el.type === 'checkbox') el.checked = toBool(value);
  else el.value = String(value ?? '');
}

function clampGlobalCorrection37CT() {
  state.brightnessLimit = Math.max(0.05, Math.min(1, Number(state.brightnessLimit ?? defaults.brightnessLimit) || defaults.brightnessLimit));
  state.gamma = Math.max(1, Math.min(3.5, Number(state.gamma ?? defaults.gamma) || defaults.gamma));
  state.contrast = Math.max(0.5, Math.min(2.5, Number(state.contrast ?? defaults.contrast) || defaults.contrast));
}

function collectStateFromDom() {
  Object.entries(controls).forEach(([id, el]) => {
    state[id] = readControlValue(el, state[id]);
  });
  state.routerSerialEnabled = toBool(state.routerSerialEnabled);
  state.routerArtnetEnabled = toBool(state.routerArtnetEnabled || state.artnetEnabled);
  state.artnetEnabled = toBool(state.artnetEnabled || state.routerArtnetEnabled);
  state.previewFps = Math.max(1, Math.min(60, Math.round(Number(state.previewFps || defaults.previewFps || 60))));
  state.layerPreviewFps = Math.max(1, Math.min(60, Math.round(Number(state.layerPreviewFps || defaults.layerPreviewFps || 60))));
  state.shaderPreviewFps = Math.max(1, Math.min(60, Math.round(Number(state.shaderPreviewFps || 60))));
  clampGlobalCorrection37CT();
  state.routerUsbDmxEnabled = false;
  state.networkAdapter = String(state.networkAdapter || '').trim();
  state.bindIp = String(state.bindIp || '').trim();
  if (state.networkAdapter && state.networkAdapter !== state.bindIp) state.bindIp = state.networkAdapter;
  if (state.bindIp && state.networkAdapter !== state.bindIp) state.networkAdapter = state.bindIp;
  state.outputMode = state.routerArtnetEnabled ? 'artnet' : (state.routerSerialEnabled ? 'serial' : 'preview');
}

function applyStateToDom() {
  state.networkAdapter = String(state.bindIp || state.networkAdapter || '').trim();
  clampGlobalCorrection37CT();
  Object.entries(controls).forEach(([id, el]) => setControlValue(el, state[id]));
  if (ui.gammaValue) ui.gammaValue.textContent = Number(state.gamma || 1).toFixed(1);
  if (ui.contrastValue) ui.contrastValue.textContent = Number(state.contrast || 1).toFixed(2);
  if (ui.limitValue) ui.limitValue.textContent = `${Math.round(Number(state.brightnessLimit || 1) * 100)}%`;
  if (ui.globalOutputStatus37CT) ui.globalOutputStatus37CT.textContent = `ACTIVE GLOBAL: brightness ${Math.round(Number(state.brightnessLimit || 1) * 100)} % / gamma ${Number(state.gamma || 1).toFixed(1)} / contrast ${Number(state.contrast || 1).toFixed(2)}. Tyto hodnoty používá původní SETTINGS cesta.`;
  if (ui.networkAdapter && state.bindIp) ui.networkAdapter.value = state.bindIp;
  if (ui.serialOutput) ui.serialOutput.textContent = state.routerSerialEnabled ? 'OUTPUT ON' : 'OUTPUT OFF';
  if (ui.artnetOutput) ui.artnetOutput.textContent = state.routerArtnetEnabled ? 'ARTNET OUTPUT ON' : 'ARTNET OUTPUT OFF';
  renderRouterStatus();
  renderMultiOutStatus();
  renderArtnetPortWarning38A();
  renderOutputTruthPanel38A();
}

function renderRouterStatus(extra = '') {
  const lines = [
    `ROUTER: ${state.routerSerialEnabled || state.routerArtnetEnabled ? 'LIVE READY' : 'preview only'}`,
    `SERIAL: ${state.routerSerialEnabled ? 'ON' : 'OFF'} · ${state.serialPort || 'no port'} · ${state.serialBaud} baud · ${state.serialFps} FPS`,
    `ARTNET: ${state.routerArtnetEnabled ? 'ON' : 'OFF'} · target ${state.targetIp}:${state.artnetPort} · bind ${state.bindIp || 'AUTO/BLOCKED'} · U${state.universe}`, 
    `USB-DMX: prepared / OFF`
  ];
  if (extra) lines.push(extra);
  if (ui.routerStatus) ui.routerStatus.textContent = lines.join('\n');
  if (ui.outputState) ui.outputState.textContent = state.routerSerialEnabled || state.routerArtnetEnabled ? 'ON' : 'OFF';
  if (ui.outputDetail) ui.outputDetail.textContent = [state.routerArtnetEnabled && 'ARTNET', state.routerSerialEnabled && 'SER'].filter(Boolean).join(' | ') || 'preview';
}


function renderArtnetPortWarning38A() {
  const port = Math.max(1, Math.min(65535, Math.trunc(Number(state.artnetPort || ARTNET_STANDARD_PORT38A) || ARTNET_STANDARD_PORT38A)));
  const warning = ui.artnetPortWarning;
  if (!warning) return;
  const isStandard = port === ARTNET_STANDARD_PORT38A;
  warning.textContent = isStandard
    ? 'OK: standardní Art-Net port 6454.'
    : `VAROVÁNÍ: aktuální port je ${port}. Většina Art-Net nodů / ArtNetominator očekává 6454. Pokud node neposlouchá na ${port}, neuvidíš žádná data.`;
  warning.classList.toggle('artnet-port-warning-bad', !isStandard);
}

function renderOutputTruthPanel38A(extra = {}) {
  const routes = parseMultiOutRoutes();
  const port = Math.max(1, Math.min(65535, Math.trunc(Number(state.artnetPort || ARTNET_STANDARD_PORT38A) || ARTNET_STANDARD_PORT38A)));
  const lines = [
    'OUTPUT TRUTH STEP38A',
    `MODE: ${state.routerArtnetEnabled || state.artnetEnabled ? 'ARTNET ARMED' : 'not armed'} | source performance-master-only`,
    `PORT: ${port}${port === ARTNET_STANDARD_PORT38A ? ' standard' : ' NON-STANDARD'}`,
    `BIND: ${state.bindIp || state.networkAdapter || 'AUTO/BLOCKED'} | TARGET: ${state.targetIp || '-'} | U start ${state.universe || 0}`,
    `MULTI OUT: ${toBool(state.artnetMultiOutEnabled) ? 'ON' : 'OFF'} | routes ${routes.length}`,
    routes.length ? routes.slice(0, 20).map((r) => `S${r.stripIndex + 1} ${r.sourcePixelOffset}-${r.sourcePixelOffset + r.pixelCount - 1} -> ${r.outputIp}:${r.targetPort || port} U${r.universe} @${r.startAddress}`).join('\n') : 'ROUTES: none - ArtNet start must stay blocked until explicit targets exist.'
  ];
  if (extra.liveLine) lines.push(String(extra.liveLine));
  if (extra.patchLine) lines.push(String(extra.patchLine));
  if (ui.artnetTruthPanel38A) ui.artnetTruthPanel38A.textContent = lines.join('\n');
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, { cache: 'no-store', ...options });
  const text = await response.text();
  const data = safeJsonParse(text, { ok: response.ok, raw: text });
  if (!response.ok) {
    throw new Error(data.error || data.message || `${response.status} ${response.statusText}`);
  }
  if (data.ok === false) {
    throw new Error(data.error || data.message || data.reason || data.validation?.reason || data.preflight?.reason || `API returned ok=false on HTTP ${response.status}`);
  }
  return data;
}

function setStatus(el, text) {
  if (el) el.textContent = text;
}

function readRuntimePerfSnapshot() {
  try {
    return window.__ledTelemetryStore?.getSnapshot?.()?.perf || {};
  } catch {
    return {};
  }
}

function buildArtnetFpsVerdict({ requestedFps = 0, effectiveFps = 0, outputFps = 0, renderFps = 0, mirrorFps = 0, status = null } = {}) {
  const requested = Math.max(0, Number(requestedFps) || 0);
  const effective = Math.max(0, Number(effectiveFps) || 0);
  const output = Math.max(0, Number(outputFps) || 0);
  const render = Math.max(0, Number(renderFps) || 0);
  const mirror = Math.max(0, Number(mirrorFps) || 0);
  const pendingMs = Math.max(0, Number(status?.backpressure?.lastPendingMs || 0));
  const skipReason = String(status?.backpressure?.lastSkipReason || status?.lastSendResult?.reason || '').trim();
  const adaptiveOn = String(status?.options?.adaptiveFrameClock || '').toLowerCase() !== 'off';
  const recoverCount = Math.max(0, Number(status?.frameClock?.adaptiveFpsRecovers || 0));
  const dropCount = Math.max(0, Number(status?.frameClock?.adaptiveFpsDrops || 0));

  if (requested <= 0) return 'VERDICT: waiting for FPS data';
  if (effective > 0 && effective <= requested * 0.75 && adaptiveOn) {
    return `VERDICT: LIMITED BY BACKPRESSURE | effective FPS reduced below target${dropCount > 0 ? ` | drops ${dropCount}` : ''}${recoverCount > 0 ? ` | recovers ${recoverCount}` : ''}${pendingMs > 0 ? ` | pending ${pendingMs} ms` : ''}`;
  }
  if (skipReason === 'previous-udp-batch-still-pending' || pendingMs >= Math.max(50, Number(status?.backpressure?.maxPendingBatchMs || 120) * 0.5)) {
    return `VERDICT: LIMITED BY UDP QUEUE | previous batch still pending${pendingMs > 0 ? ` | pending ${pendingMs} ms` : ''}`;
  }
  if (mirror > 0 && mirror < requested * 0.85) {
    return `VERDICT: LIMITED BY MASTER MIRROR | mirror FPS ${mirror} below requested ${requested}`;
  }
  if (render > 0 && render < requested * 0.7 && render < mirror * 0.85) {
    return `VERDICT: LIMITED BY RENDER/PREVIEW | render FPS ${render} below mirror ${mirror || requested}`;
  }
  if (output > 0 && output < effective * 0.8) {
    return `VERDICT: LIMITED AFTER BUILD | output FPS ${output} below effective ${effective}`;
  }
  if (output > 0 && requested > 0 && output >= requested * 0.85) {
    return `VERDICT: AT TARGET | output FPS ${output} near requested ${requested}`;
  }
  return `VERDICT: MIXED LIMIT | req ${requested} | eff ${effective} | out ${output} | render ${render} | mirror ${mirror}`;
}

async function loadArtnetLiveConfig() {
  try {
    const data = await fetchJson(ARTNET_SYNC_LIVE_API.config);
    const cfg = data?.config || {};
    if (cfg.outputIp) state.targetIp = cfg.outputIp;
    if (cfg.bindIp != null) { state.bindIp = String(cfg.bindIp || ''); state.networkAdapter = state.bindIp; }
    if (cfg.targetMode) state.targetMode = cfg.targetMode;
    if (cfg.port) state.artnetPort = Number(cfg.port);
    if (cfg.fps) state.fps = Number(cfg.fps);
    if (cfg.universeStart != null) state.universe = Number(cfg.universeStart);
    if (cfg.pixelsPerUniverse != null) state.pixelsPerUniverse = Number(cfg.pixelsPerUniverse);
    if (cfg.maxLiveFps != null) state.maxLiveFps = Number(cfg.maxLiveFps);
    if (cfg.packetPaceMs != null) state.packetPaceMs = Number(cfg.packetPaceMs);
    if (cfg.packetsPerBurst != null) state.packetsPerBurst = Number(cfg.packetsPerBurst);
    if (cfg.maxPendingBatchMs != null) state.maxPendingBatchMs = Number(cfg.maxPendingBatchMs);
    if (cfg.callbackMode) state.callbackMode = String(cfg.callbackMode);
    if (cfg.adaptiveFrameClock) state.adaptiveFrameClock = String(cfg.adaptiveFrameClock);
    if (cfg.adaptiveFloorFps != null) state.adaptiveFloorFps = Number(cfg.adaptiveFloorFps);
    if (cfg.packetOrder) state.packetOrder = String(cfg.packetOrder);
    if (cfg.artSyncMode) state.artSyncMode = String(cfg.artSyncMode);
    if (cfg.masterMaxAgeMs != null) state.masterMaxAgeMs = Number(cfg.masterMaxAgeMs);
    if (cfg.lastGoodHoldMs != null) state.lastGoodHoldMs = Number(cfg.lastGoodHoldMs);
    if (cfg.blackoutAfterHold != null) state.blackoutAfterHold = Boolean(cfg.blackoutAfterHold);
    syncArtNetTargetIpIntoMapping(state.targetIp, state.artnetPort);
  } catch {}
}


const artnetInterfacesState37CM = { loaded: false, interfaces: [] };
function assertValidArtnetIp37CN(ip, label = 'IP') {
  const value = String(ip || '').trim();
  if (!value) return;
  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(value)) throw new Error(`${label}_INVALID_IPV4: ${value}`);
  const parts = value.split('.').map((x) => Number(x));
  if (parts.some((x) => !Number.isInteger(x) || x < 0 || x > 255)) throw new Error(`${label}_INVALID_IPV4: ${value}`);
}


function sameIpv4Subnet37CM(a, b) {
  const ap = String(a || '').split('.').map(Number);
  const bp = String(b || '').split('.').map(Number);
  return ap.length === 4 && bp.length === 4 && ap.slice(0, 3).every((v, i) => Number.isFinite(v) && v === bp[i]);
}

function chooseBestBindIp37CM(targetIp = '') {
  const items = artnetInterfacesState37CM.interfaces || [];
  const explicit = String(state.bindIp || state.networkAdapter || '').trim();
  if (explicit && items.some((it) => it.address === explicit)) return explicit;
  const sameSubnet = items.find((it) => sameIpv4Subnet37CM(it.address, targetIp));
  if (sameSubnet) return sameSubnet.address;
  const ten = items.find((it) => String(it.address || '').startsWith('10.'));
  if (ten) return ten.address;
  const hinted = items.find((it) => it.artnetHint);
  if (hinted) return hinted.address;
  return items[0]?.address || '';
}

function renderNetworkAdapters37CM() {
  const select = ui.networkAdapter || $('networkAdapter');
  if (!select) return;
  const current = String(state.bindIp || state.networkAdapter || '').trim();
  const rows = artnetInterfacesState37CM.interfaces || [];
  select.innerHTML = '';
  const auto = document.createElement('option');
  auto.value = '';
  auto.textContent = rows.length ? 'AUTO / nezvoleno - START zablokuje kvůli Windows routing' : 'Žádná IPv4 síťovka nenalezena';
  select.appendChild(auto);
  for (const it of rows) {
    const opt = document.createElement('option');
    opt.value = it.address;
    opt.textContent = `${it.name} · ${it.address}${it.cidr ? ` · ${it.cidr}` : ''}`;
    select.appendChild(opt);
  }
  select.value = current && rows.some((it) => it.address === current) ? current : '';
}

async function refreshNetworkAdapters37CM({ autoPick = false } = {}) {
  try {
    const data = await fetchJson('/api/artnet/network/interfaces');
    artnetInterfacesState37CM.loaded = true;
    artnetInterfacesState37CM.interfaces = Array.isArray(data.interfaces) ? data.interfaces : [];
    if (autoPick && !String(state.bindIp || '').trim()) {
      const picked = chooseBestBindIp37CM(state.targetIp);
      if (picked) {
        state.bindIp = picked;
        state.networkAdapter = picked;
        writeStored();
        await saveArtnetConfig().catch(() => null);
      }
    }
    renderNetworkAdapters37CM();
    applyStateToDom();
    return artnetInterfacesState37CM.interfaces;
  } catch (error) {
    artnetInterfacesState37CM.loaded = true;
    artnetInterfacesState37CM.interfaces = [];
    renderNetworkAdapters37CM();
    setStatus(ui.artnetStatus, `NETWORK CARD LIST ERROR: ${error.message}`);
    return [];
  }
}

async function requireExplicitBindIp37CM() {
  collectStateFromDom();
  if (!artnetInterfacesState37CM.loaded) await refreshNetworkAdapters37CM({ autoPick: false });
  const interfaces = artnetInterfacesState37CM.interfaces || [];
  const bindIp = String(state.bindIp || state.networkAdapter || '').trim();
  const targetIp = String(state.targetIp || '').trim();
  assertValidArtnetIp37CN(targetIp, 'TARGET_IP');
  assertValidArtnetIp37CN(bindIp, 'BIND_IP');
  if (!bindIp) throw new Error('BIND_IP_REQUIRED: ruční výběr NETWORK CARD / BIND IP je povinný. AUTO je vypnuté, aby Windows nemohly vybrat jinou síťovku než tu, kterou chceš použít.');
  if (interfaces.length && !interfaces.some((it) => it.address === bindIp)) throw new Error(`BIND_IP_NOT_FOUND: ${bindIp} není aktuální IPv4 adresa žádné síťovky.`);
  state.bindIp = bindIp;
  state.networkAdapter = bindIp;
  applyStateToDom();
  writeStored();
  return bindIp;
}

function buildArtnetConfigFromState() {
  collectStateFromDom();
  return {
    outputIp: String(state.targetIp || ARTNET_LIVE_DEFAULTS.outputIp).trim(),
    bindIp: String(state.bindIp || state.networkAdapter || '').trim(),
    localAddress: String(state.bindIp || state.networkAdapter || '').trim(),
    targetMode: String(state.targetMode || ARTNET_LIVE_DEFAULTS.targetMode),
    port: Number(state.artnetPort || ARTNET_LIVE_DEFAULTS.port),
    fps: Number(state.fps || ARTNET_LIVE_DEFAULTS.fps),
    maxLiveFps: Number(state.maxLiveFps || ARTNET_LIVE_DEFAULTS.maxLiveFps),
    bpm: ARTNET_LIVE_DEFAULTS.bpm,
    stripCount: 8,
    pixelsPerStrip: 300,
    universeStart: Number(state.universe || 0),
    pixelsPerUniverse: Number(state.pixelsPerUniverse || ARTNET_LIVE_DEFAULTS.pixelsPerUniverse),
    packetPaceMs: Number(state.packetPaceMs || ARTNET_LIVE_DEFAULTS.packetPaceMs),
    packetsPerBurst: Number(state.packetsPerBurst || ARTNET_LIVE_DEFAULTS.packetsPerBurst),
    maxPendingBatchMs: Number(state.maxPendingBatchMs || ARTNET_LIVE_DEFAULTS.maxPendingBatchMs),
    callbackMode: String(state.callbackMode || ARTNET_LIVE_DEFAULTS.callbackMode),
    adaptiveFrameClock: String(state.adaptiveFrameClock || ARTNET_LIVE_DEFAULTS.adaptiveFrameClock),
    adaptiveFloorFps: Number(state.adaptiveFloorFps || ARTNET_LIVE_DEFAULTS.adaptiveFloorFps),
    packetOrder: String(state.packetOrder || ARTNET_LIVE_DEFAULTS.packetOrder),
    artSyncMode: String(state.artSyncMode || ARTNET_LIVE_DEFAULTS.artSyncMode),
    masterMaxAgeMs: Number(state.masterMaxAgeMs || ARTNET_LIVE_DEFAULTS.masterMaxAgeMs),
    lastGoodHoldMs: Number(state.lastGoodHoldMs || ARTNET_LIVE_DEFAULTS.lastGoodHoldMs),
    blackoutAfterHold: toBool(state.blackoutAfterHold ?? ARTNET_LIVE_DEFAULTS.blackoutAfterHold),
    visualPattern: 'master-framebus',
    sourceMode: 'performance-master-only'
  };
}

async function saveArtnetConfig() {
  const config = buildArtnetConfigFromState();
  await fetchJson(ARTNET_SYNC_LIVE_API.config, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(config)
  });
  return config;
}

function syncArtNetTargetIpIntoMapping(targetIp = state.targetIp, targetPort = state.artnetPort) {
  const ip = String(targetIp || '').trim();
  const port = Math.max(1, Math.min(65535, Math.trunc(Number(targetPort || state.artnetPort || ARTNET_STANDARD_PORT38A) || ARTNET_STANDARD_PORT38A)));
  if (!ip) return null;

  try {
    const rawMultiOut = String(state.artnetMultiOutRoutes || '').trim();
    const parsedMultiOut = safeJsonParse(rawMultiOut, []);
    const currentRoutes = Array.isArray(parsedMultiOut) ? parsedMultiOut : (Array.isArray(parsedMultiOut.routes) ? parsedMultiOut.routes : []);
    const mapping = loadMappingV2(localStorage);
    const segments = Array.isArray(mapping?.segments) ? mapping.segments : [];
    const nextSegments = segments.map((segment) => {
      if (String(segment?.physical?.output || '').toLowerCase() !== 'artnet') return segment;
      return {
        ...segment,
        physical: {
          ...segment.physical,
          outputIp: ip,
          targetIp: ip,
          artnetPort: port,
          targetPort: port
        }
      };
    });
    const nextMapping = { ...mapping, segments: nextSegments };
    saveMappingV2(nextMapping, localStorage);
    try {
      localStorage.setItem(LEGACY_MAPPING_STORAGE_KEY, JSON.stringify(mappingV2ToLegacyExport(nextMapping)));
    } catch {}
    if (currentRoutes.length) {
      state.artnetMultiOutEnabled = true;
      state.artnetMultiOutRoutes = JSON.stringify(currentRoutes.map((route) => ({
        enabled: route.enabled !== false,
        strip: route.stripIndex,
        from: route.sourcePixelOffset,
        count: route.pixelCount,
        ip,
        port,
        universe: route.universe,
        startAddress: route.startAddress,
        universeSize: route.universeSize,
        direction: route.direction,
        colorOrder: route.colorOrder
      })), null, 2);
      const routesEl = $('artnetMultiOutRoutes');
      if (routesEl && document.activeElement !== routesEl) routesEl.value = state.artnetMultiOutRoutes;
    }
    try { localStorage.removeItem('led-engine-artnet-master-patch-v1'); } catch {}
    state.artnetMultiOutDefaultIp = ip;
    state.artnetPort = port;
    saveMultiOutConfig();
    return nextMapping;
  } catch (error) {
    console.warn('Failed to sync ArtNet target IP into mapping', error);
    return null;
  }
}

const ARTNET_PRESETS = Object.freeze({
  safe: Object.freeze({
    artnetMirrorFps: 30,
    fps: 60,
    maxLiveFps: 30,
    packetPaceMs: 1,
    packetsPerBurst: 8,
    maxPendingBatchMs: 180,
    callbackMode: 'none',
    packetOrder: 'sequential',
    artSyncMode: 'off',
    adaptiveFrameClock: 'off',
    adaptiveFloorFps: 12,
    masterMaxAgeMs: 2500,
    lastGoodHoldMs: 0,
    blackoutAfterHold: true
  }),
  fast: Object.freeze({
    artnetMirrorFps: 60,
    fps: 60,
    maxLiveFps: 60,
    packetPaceMs: 0,
    packetsPerBurst: 32,
    maxPendingBatchMs: 80,
    callbackMode: 'none',
    packetOrder: 'sequential',
    artSyncMode: 'off',
    adaptiveFrameClock: 'off',
    adaptiveFloorFps: 24,
    masterMaxAgeMs: 2500,
    lastGoodHoldMs: 0,
    blackoutAfterHold: true
  }),
  aggressive: Object.freeze({
    artnetMirrorFps: 60,
    fps: 60,
    maxLiveFps: 60,
    packetPaceMs: 0,
    packetsPerBurst: 32,
    maxPendingBatchMs: 60,
    callbackMode: 'none',
    packetOrder: 'sequential',
    artSyncMode: 'off',
    adaptiveFrameClock: 'off',
    adaptiveFloorFps: 30,
    masterMaxAgeMs: 2500,
    lastGoodHoldMs: 0,
    blackoutAfterHold: true
  })
});

async function applyArtnetPreset(name) {
  const preset = ARTNET_PRESETS[String(name || '').toLowerCase()];
  if (!preset) return;
  Object.assign(state, preset);
  writeStored();
  applyStateToDom();
  try {
    localStorage.setItem('budilightArtNetMasterMirrorFps22EJ', String(Math.max(1, Math.min(60, Number(state.artnetMirrorFps || 60)))));
    if (window.__setBudilightArtNetMasterMirror22EJ) window.__setBudilightArtNetMasterMirror22EJ(true, Number(state.artnetMirrorFps || 60));
  } catch {}
  await saveArtnetConfig().catch(() => null);
  await refreshHealth().catch(() => null);
  setStatus(ui.artnetStatus, `ARTNET PRESET ${String(name || '').toUpperCase()} APPLIED`);
}

function buildSolidFrame(rgb) {
  const color = Array.isArray(rgb) ? rgb : [0, 0, 0];
  const r = Math.max(0, Math.min(255, Number(color[0]) || 0));
  const g = Math.max(0, Math.min(255, Number(color[1]) || 0));
  const b = Math.max(0, Math.min(255, Number(color[2]) || 0));
  const totalPixels = 8 * 300;
  const frame = new Array(totalPixels * 3);
  for (let i = 0; i < frame.length; i += 3) { frame[i] = r; frame[i + 1] = g; frame[i + 2] = b; }
  return frame;
}

async function saveSettings() {
  collectStateFromDom();
  syncArtNetTargetIpIntoMapping(state.targetIp, state.artnetPort);
  writeStored();
  await saveArtnetConfig().catch(() => null);
  await publishSavedArtnetPatch().catch(() => null);
  applyStateToDom();
  await saveRuntimeProfile().catch(() => null);
  setStatus(ui.deviceMessage, 'SETTINGS SAVED');
}

async function saveRuntimeProfile() {
  const payload = {
    raspi: toBool(state.raspiMode),
    adaptiveFpsMode: state.adaptiveFpsMode || 'off',
    runtimePreset: state.runtimePreset || (toBool(state.raspiMode) ? 'raspi-stable' : 'normal-pc'),
    persist: true
  };
  return fetchJson('/api/runtime/profile', { method: 'POST', headers: jsonHeaders, body: JSON.stringify(payload) });
}

async function refreshSerialPorts() {
  try {
    const data = await fetchJson('/api/serial/ports');
    const ports = Array.isArray(data.ports) ? data.ports : [];
    const selects = [$('serialPort'), $('blxSerialPort')].filter(Boolean);
    selects.forEach((select) => {
      const current = select.value || state.serialPort || '';
      select.innerHTML = '';
      const empty = document.createElement('option');
      empty.value = '';
      empty.textContent = ports.length ? 'Vyber port' : 'Žádný port nenalezen';
      select.appendChild(empty);
      ports.forEach((port) => {
        const path = port.path || port.comName || port.name || String(port);
        const option = document.createElement('option');
        option.value = path;
        option.textContent = [path, port.manufacturer].filter(Boolean).join(' · ');
        select.appendChild(option);
      });
      if (current) select.value = current;
    });
    setStatus(ui.serialStatus, `PORTS: ${ports.length}`);
  } catch (error) {
    setStatus(ui.serialStatus, `PORT REFRESH ERROR: ${error.message}`);
  }
}

async function refreshSerialStatus() {
  try {
    const data = await fetchJson('/api/serial/status');
    const open = data.open === true || data.isOpen === true;
    const port = data.path || data.port || state.serialPort || 'no port';
    setStatus(ui.serialStatus, `${open ? 'SERIAL OPEN' : 'SERIAL CLOSED'} · ${port}`);
    return data;
  } catch (error) {
    setStatus(ui.serialStatus, `SERIAL STATUS ERROR: ${error.message}`);
    return null;
  }
}

async function connectSerial() {
  collectStateFromDom();
  writeStored();
  try {
    await fetchJson('/api/serial/open', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ path: state.serialPort, baudRate: Number(state.serialBaud || 1000000) })
    });
    state.routerSerialEnabled = true;
    applyStateToDom();
    await refreshSerialStatus();
  } catch (error) {
    setStatus(ui.serialStatus, `CONNECT ERROR: ${error.message}`);
  }
}

async function disconnectSerial() {
  try { await fetchJson('/api/serial/close', { method: 'POST' }); }
  catch (error) { setStatus(ui.serialStatus, `DISCONNECT ERROR: ${error.message}`); }
  await refreshSerialStatus();
}

async function toggleSerialOutput() {
  collectStateFromDom();
  state.routerSerialEnabled = !state.routerSerialEnabled;
  writeStored();
  applyStateToDom();
  setStatus(ui.serialStatus, state.routerSerialEnabled ? 'SERIAL OUTPUT ENABLED' : 'SERIAL OUTPUT DISABLED');
}


const MULTIOUT_SLOT_COUNT = 16;
const ARTNET_STANDARD_PORT38A = 6454;
let multiOutSlotUiBuilt = false;

function normalizeRouteForEditor(route = {}, index = 0) {
  return {
    enabled: route.enabled !== false,
    strip: Math.max(0, Math.trunc(Number(route.stripIndex ?? route.strip ?? index) || 0)),
    from: Math.max(0, Math.trunc(Number(route.sourcePixelOffset ?? route.from ?? route.pixelStart ?? 0) || 0)),
    count: Math.max(1, Math.trunc(Number(route.pixelCount ?? route.count ?? route.length ?? 300) || 300)),
    ip: String(route.outputIp || route.targetIp || route.ip || route.host || state.artnetMultiOutDefaultIp || state.targetIp || '').trim(),
    port: Math.max(1, Math.min(65535, Math.trunc(Number(route.targetPort || route.port || state.artnetPort || 6454) || 6454))),
    universe: Math.max(0, Math.trunc(Number(route.universe ?? route.startUniverse ?? index) || 0)),
    startAddress: Math.max(0, Math.trunc(Number(route.startAddress ?? route.address ?? 0) || 0)),
    universeSize: Math.max(1, Math.min(170, Math.trunc(Number(route.universeSize ?? state.pixelsPerUniverse ?? 170) || 170))),
    direction: String(route.direction || 'forward').toLowerCase() === 'reverse' ? 'reverse' : 'forward',
    colorOrder: String(route.colorOrder || 'RGB').toUpperCase()
  };
}

function slotInput(id) { return $(`artnetMultiOut_${id}`); }

function buildMultiOutSlotUi() {
  const panel = ui.artnetMultiOutSlotPanel;
  if (!panel || multiOutSlotUiBuilt) return;
  const rows = [];
  for (let i = 0; i < MULTIOUT_SLOT_COUNT; i += 1) {
    rows.push(`
      <div class="multiout-slot" data-slot="${i}">
        <div class="multiout-slot-head">
          <span>ARTNET ${i + 1}</span>
          <label><input id="artnetMultiOut_slot${i}_enabled" type="checkbox" /> ENABLE</label>
        </div>
        <div class="multiout-slot-grid">
          <label>IP<input id="artnetMultiOut_slot${i}_ip" type="text" placeholder="2.1.1.${30 + i}" /></label>
          <label>PORT<input id="artnetMultiOut_slot${i}_port" type="number" min="1" max="65535" step="1" value="6454" /></label>
          <label>STRIP<input id="artnetMultiOut_slot${i}_strip" type="number" min="0" step="1" value="${i}" /></label>
          <label>FROM PX<input id="artnetMultiOut_slot${i}_from" type="number" min="0" step="1" value="0" /></label>
          <label>COUNT<input id="artnetMultiOut_slot${i}_count" type="number" min="1" step="1" value="300" /></label>
          <label>UNIVERSE<input id="artnetMultiOut_slot${i}_universe" type="number" min="0" step="1" value="${i * 2}" /></label>
          <label>START ADDR<input id="artnetMultiOut_slot${i}_startAddress" type="number" min="0" max="169" step="1" value="0" /></label>
          <label>U SIZE<input id="artnetMultiOut_slot${i}_universeSize" type="number" min="1" max="170" step="1" value="170" /></label>
          <label>DIR<select id="artnetMultiOut_slot${i}_direction"><option value="forward">forward</option><option value="reverse">reverse</option></select></label>
          <label>ORDER<select id="artnetMultiOut_slot${i}_colorOrder"><option>RGB</option><option>GRB</option><option>BRG</option><option>RBG</option><option>BGR</option><option>GBR</option></select></label>
        </div>
      </div>`);
  }
  panel.innerHTML = rows.join('');
  panel.querySelectorAll('input,select').forEach((el) => {
    el.addEventListener('input', () => { collectMultiOutSlotsToState(); saveMultiOutConfig(); });
    el.addEventListener('change', () => { collectMultiOutSlotsToState(); saveMultiOutConfig(); });
  });
  multiOutSlotUiBuilt = true;
}

function renderMultiOutSlotEditor() {
  buildMultiOutSlotUi();
  if (!ui.artnetMultiOutSlotPanel) return;
  const routes = parseMultiOutRoutes();
  for (let i = 0; i < MULTIOUT_SLOT_COUNT; i += 1) {
    const r = normalizeRouteForEditor(routes[i] || { strip: i, universe: i * 2, ip: state.artnetMultiOutDefaultIp || state.targetIp || '' }, i);
    const prefix = `slot${i}`;
    const enabled = slotInput(`${prefix}_enabled`); if (enabled) enabled.checked = i < routes.length && r.enabled !== false;
    const map = { ip: r.ip, port: r.port, strip: r.strip, from: r.from, count: r.count, universe: r.universe, startAddress: r.startAddress, universeSize: r.universeSize, direction: r.direction, colorOrder: r.colorOrder };
    for (const [key, value] of Object.entries(map)) {
      const el = slotInput(`${prefix}_${key}`);
      if (el && document.activeElement !== el) el.value = String(value ?? '');
    }
  }
}

function collectMultiOutSlotsToState() {
  const routes = [];
  for (let i = 0; i < MULTIOUT_SLOT_COUNT; i += 1) {
    const prefix = `slot${i}`;
    const enabled = slotInput(`${prefix}_enabled`);
    if (!enabled?.checked) continue;
    const get = (name, fallback = '') => slotInput(`${prefix}_${name}`)?.value ?? fallback;
    const route = normalizeRouteForEditor({
      strip: get('strip', i),
      from: get('from', 0),
      count: get('count', 300),
      ip: get('ip', state.artnetMultiOutDefaultIp || state.targetIp || ''),
      port: get('port', state.artnetPort || 6454),
      universe: get('universe', i * 2),
      startAddress: get('startAddress', 0),
      universeSize: get('universeSize', state.pixelsPerUniverse || 170),
      direction: get('direction', 'forward'),
      colorOrder: get('colorOrder', 'RGB')
    }, i);
    if (route.ip) routes.push(route);
  }
  state.artnetMultiOutRoutes = JSON.stringify(routes.map((r) => ({
    enabled: r.enabled,
    strip: r.strip,
    from: r.from,
    count: r.count,
    ip: r.ip,
    port: r.port,
    universe: r.universe,
    startAddress: r.startAddress,
    universeSize: r.universeSize,
    direction: r.direction,
    colorOrder: r.colorOrder
  })), null, 2);
  state.artnetMultiOutEnabled = routes.length > 0 || toBool(state.artnetMultiOutEnabled);
  const routesEl = $('artnetMultiOutRoutes');
  if (routesEl && document.activeElement !== routesEl) routesEl.value = state.artnetMultiOutRoutes;
  return routes;
}


function parseMultiOutRoutes() {
  const enabled = toBool(state.artnetMultiOutEnabled);
  const raw = String(state.artnetMultiOutRoutes || '').trim();
  if (!enabled || !raw) return [];
  const parsed = safeJsonParse(raw, []);
  const list = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.routes) ? parsed.routes : []);
  return list.map((r, index) => ({
    id: String(r.id || `multi_${index + 1}`),
    enabled: r.enabled !== false,
    stripIndex: Math.max(0, Math.trunc(Number(r.stripIndex ?? r.strip ?? 0) || 0)),
    sourcePixelOffset: Math.max(0, Math.trunc(Number(r.sourcePixelOffset ?? r.from ?? r.pixelStart ?? 0) || 0)),
    pixelCount: Math.max(1, Math.trunc(Number(r.pixelCount ?? r.count ?? r.length ?? 1) || 1)),
    outputIp: String(r.outputIp || r.targetIp || r.ip || r.host || state.artnetMultiOutDefaultIp || state.targetIp || '').trim(),
    targetPort: Math.max(1, Math.min(65535, Math.trunc(Number(r.targetPort || r.port || state.artnetPort || 6454) || 6454))),
    universe: Math.max(0, Math.trunc(Number(r.universe ?? r.startUniverse ?? 0) || 0)),
    startAddress: Math.max(0, Math.trunc(Number(r.startAddress ?? r.address ?? 0) || 0)),
    universeSize: Math.max(1, Math.min(170, Math.trunc(Number(r.universeSize ?? state.pixelsPerUniverse ?? 170) || 170))),
    direction: String(r.direction || 'forward').toLowerCase() === 'reverse' ? 'reverse' : 'forward',
    colorOrder: String(r.colorOrder || 'RGB').toUpperCase(),
    brightness: Number.isFinite(Number(r.brightness)) ? Math.max(0, Math.min(1, Number(r.brightness))) : 1,
    gamma: Number.isFinite(Number(r.gamma)) ? Math.max(0.1, Math.min(5, Number(r.gamma))) : 1,
    contrast: Number.isFinite(Number(r.contrast)) ? Math.max(0, Math.min(3, Number(r.contrast))) : 1,
    whiteLimit: Number.isFinite(Number(r.whiteLimit)) ? Math.max(0, Math.min(1, Number(r.whiteLimit))) : 1
  })).filter((r) => r.outputIp && r.pixelCount > 0 && r.enabled !== false);
}

function applyMultiOutRoutesToPatch(patch) {
  const routes = parseMultiOutRoutes();
  if (!routes.length) return patch;
  const width = Number(patch?.width || 300);
  const height = Number(patch?.height || 8);
  return finalizeArtNetPatch({
    ...patch,
    patchSource: 'settings-multiout-route-table',
    width,
    height,
    totalPixels: width * height,
    routes: routes.map((r) => ({
      segmentId: r.id,
      parentSegmentId: `strip_${r.stripIndex + 1}`,
      stripIndex: r.stripIndex,
      universe: r.universe,
      startAddress: r.startAddress,
      sourcePixelOffset: r.sourcePixelOffset,
      pixelCount: r.pixelCount,
      universeSize: r.universeSize,
      physicalPixelCount: Math.max(r.sourcePixelOffset + r.pixelCount, width),
      direction: r.direction,
      colorOrder: r.colorOrder,
      brightness: r.brightness,
      gamma: r.gamma,
      contrast: r.contrast,
      whiteLimit: r.whiteLimit,
      outputIp: r.outputIp,
      targetIp: r.outputIp,
      targetPort: r.targetPort,
      port: r.targetPort,
      enabled: true,
      forceBlack: false
    }))
  }, { patchSource: 'settings-multiout-route-table' });
}

function renderMultiOutStatus() {
  const routes = parseMultiOutRoutes();
  const lines = [
    `MULTI OUT: ${toBool(state.artnetMultiOutEnabled) ? 'ON' : 'OFF'} · routes ${routes.length}`,
    routes.length ? routes.map((r) => `S${r.stripIndex + 1} ${r.sourcePixelOffset}-${r.sourcePixelOffset + r.pixelCount - 1} → ${r.outputIp}:${r.targetPort || 6454} U${r.universe} @${r.startAddress} ${r.direction || 'forward'} ${r.colorOrder || 'RGB'}`).join('\n') : 'No route table active.'
  ];
  if (ui.artnetMultiOutStatus) ui.artnetMultiOutStatus.textContent = lines.join('\n');
  renderArtnetPortWarning38A();
  renderOutputTruthPanel38A();
}

function saveMultiOutConfig() {
  collectStateFromDom();
  try { localStorage.setItem(ARTNET_MULTIOUT_STORAGE_KEY, JSON.stringify({ enabled: toBool(state.artnetMultiOutEnabled), defaultIp: state.artnetMultiOutDefaultIp || '', routes: state.artnetMultiOutRoutes || '', savedAt: Date.now() })); } catch {}
  renderMultiOutStatus();
}

function loadMultiOutConfig() {
  try {
    const cfg = safeJsonParse(localStorage.getItem(ARTNET_MULTIOUT_STORAGE_KEY) || '{}', {});
    if (cfg && typeof cfg === 'object') {
      state.artnetMultiOutEnabled = toBool(cfg.enabled) || Boolean(String(cfg.routes || '').trim());
      state.artnetMultiOutDefaultIp = String(cfg.defaultIp || '');
      state.artnetMultiOutRoutes = String(cfg.routes || '');
    }
  } catch {}
}

function seedMultiOut8x300() {
  collectStateFromDom();
  const ip = String(state.artnetMultiOutDefaultIp || state.targetIp || '2.1.1.30');
  const routes = [];
  let universe = Number(state.universe || 0);
  for (let strip = 0; strip < 8; strip += 1) {
    routes.push({ strip, from: 0, count: 170, ip, universe: universe++, startAddress: 0, port: Number(state.artnetPort || ARTNET_STANDARD_PORT38A), universeSize: 170, direction: 'forward', colorOrder: 'RGB' });
    routes.push({ strip, from: 170, count: 130, ip, universe: universe++, startAddress: 0, port: Number(state.artnetPort || ARTNET_STANDARD_PORT38A), universeSize: 170, direction: 'forward', colorOrder: 'RGB' });
  }
  state.artnetMultiOutEnabled = true;
  state.artnetMultiOutDefaultIp = ip;
  state.artnetMultiOutRoutes = JSON.stringify(routes, null, 2);
  applyStateToDom(); renderMultiOutSlotEditor(); saveMultiOutConfig();
}

async function resetArtnetSafe8x300_38A() {
  collectStateFromDom();
  const ip = String(state.targetIp || state.artnetMultiOutDefaultIp || ARTNET_LIVE_DEFAULTS.outputIp || '2.1.1.30').trim();
  state.targetIp = ip;
  state.artnetPort = ARTNET_STANDARD_PORT38A;
  state.universe = 0;
  state.pixelsPerUniverse = 170;
  state.fps = 60;
  state.maxLiveFps = 60;
  state.artnetMirrorFps = 60;
  state.packetPaceMs = 0;
  state.packetsPerBurst = 32;
  state.maxPendingBatchMs = 120;
  state.callbackMode = 'none';
  state.packetOrder = 'sequential';
  state.artSyncMode = 'off';
  state.adaptiveFrameClock = 'off';
  state.adaptiveFloorFps = 24;
  state.artnetMultiOutDefaultIp = ip;
  seedMultiOut8x300();
  writeStored();
  applyStateToDom();
  try { await saveArtnetConfig(); } catch {}
  try { await publishSavedArtnetPatch(); } catch (error) { setStatus(ui.artnetStatus, `SAFE 8×300 SAVED, PATCH WARNING: ${error.message}`); return; }
  setStatus(ui.artnetStatus, 'SAFE 8×300 / 6454 SAVED. ArtNet není spuštěný; START pořád vyžaduje BIND IP a explicitní routes.');
  await refreshHealth().catch(() => null);
}

function addMultiOutSplitExample() {
  collectStateFromDom();
  const current = parseMultiOutRoutes();
  const ipA = String(state.targetIp || '2.1.1.30');
  const ipB = ipA.replace(/(\d+)$/, (m) => String(Math.min(254, Number(m) + 1))) || '2.1.1.31';
  const example = [
    { strip: 0, from: 0, count: 170, ip: ipA, universe: 0, startAddress: 0 },
    { strip: 0, from: 170, count: 130, ip: ipB, universe: 0, startAddress: 0 }
  ];
  state.artnetMultiOutEnabled = true;
  state.artnetMultiOutRoutes = JSON.stringify([...current.map((r) => ({ strip: r.stripIndex, from: r.sourcePixelOffset, count: r.pixelCount, ip: r.outputIp, universe: r.universe, startAddress: r.startAddress })), ...example], null, 2);
  applyStateToDom(); renderMultiOutSlotEditor(); saveMultiOutConfig();
}

function artnetPayload(extra = {}) {
  const config = buildArtnetConfigFromState();
  return {
    targetIp: config.outputIp,
    host: config.outputIp,
    outputIp: config.outputIp,
    bindIp: config.bindIp,
    targetMode: config.targetMode,
    port: config.port,
    universe: config.universeStart,
    startUniverse: config.universeStart,
    net: Number(state.net || 0),
    subnet: Number(state.subnet || 0),
    fps: config.fps,
    maxLiveFps: config.maxLiveFps,
    stripCount: config.stripCount,
    pixelsPerStrip: config.pixelsPerStrip,
    pixelsPerUniverse: config.pixelsPerUniverse,
    packetPaceMs: config.packetPaceMs,
    packetsPerBurst: config.packetsPerBurst,
    maxPendingBatchMs: config.maxPendingBatchMs,
    callbackMode: config.callbackMode,
    adaptiveFrameClock: config.adaptiveFrameClock,
    adaptiveFloorFps: config.adaptiveFloorFps,
    packetOrder: config.packetOrder,
    artSyncMode: config.artSyncMode,
    source: 'master-framebus',
    visualPattern: config.visualPattern,
    pattern: config.visualPattern,
    sourceMode: config.sourceMode,
    masterMaxAgeMs: config.masterMaxAgeMs,
    lastGoodHoldMs: config.lastGoodHoldMs,
    blackoutAfterHold: config.blackoutAfterHold,
    mode: 'udp-armed',
    armed: true,
    liveWrite: true,
    dryRun: false,
    requireExplicitPatch: true,
    ...extra
  };
}

async function startArtnet() {
  try { await requireExplicitBindIp37CM(); } catch (error) { setStatus(ui.artnetStatus, `ARTNET START BLOCKED: ${error.message}`); return; }
  const payload = artnetPayload();
  try {
    localStorage.setItem('budilightArtNetMasterMirror22EJ', '1');
    localStorage.setItem('budilightArtNetMasterMirrorFps22EJ', String(Math.max(1, Math.min(60, Number(state.artnetMirrorFps || payload.maxLiveFps || payload.fps || 60)))));
    if (window.__setBudilightArtNetMasterMirror22EJ) window.__setBudilightArtNetMasterMirror22EJ(true, Number(state.artnetMirrorFps || payload.maxLiveFps || payload.fps || 60));
  } catch {}
  try {
    await saveArtnetConfig();
    const patchResult = await publishSavedArtnetPatch();
    state.routerArtnetEnabled = true;
    state.artnetEnabled = true;
    writeStored();
    applyStateToDom();
    const endpoints = [ARTNET_SYNC_LIVE_API.primeSocket, ARTNET_SYNC_LIVE_API.start];
    let last = null;
    for (const url of endpoints) {
      try { last = await fetchJson(url, { method: 'POST', headers: jsonHeaders, body: JSON.stringify(payload) }); }
      catch (error) { last = { ok: false, error: error.message, url }; }
    }
    const targetLabel = patchResult?.targetCount ? `${patchResult.targetCount} explicit target routes` : `${payload.targetIp}:${payload.port}`;
    setStatus(ui.artnetStatus, `ARTNET LIVE ON · ${targetLabel}${last?.error ? ` · ${last.error}` : ''}`);
    await refreshHealth();
  } catch (error) {
    setStatus(ui.artnetStatus, `ARTNET START ERROR: ${error.message}`);
  }
}

function countExplicitArtNetPatchTargets(patch) {
  const routes = Array.isArray(patch?.routes) ? patch.routes : [];
  return routes.filter((route) => {
    const target = String(route?.outputIp || route?.targetIp || route?.ip || route?.host || '').trim();
    return target && target.toLowerCase() !== 'default' && route?.enabled !== false;
  }).length;
}

async function publishSavedArtnetPatch() {
  try {
    let patch = null;
    const storedRaw = localStorage.getItem(ARTNET_MASTER_PATCH_STORAGE_KEY);
    const stored = storedRaw ? JSON.parse(storedRaw) : null;
    if (stored?.version === 'artnet-patch-v1' && Array.isArray(stored.routes) && stored.routes.length) {
      patch = finalizeArtNetPatch(stored, { patchSource: 'settings-saved-master-patch' });
    } else {
      const mapping = loadMappingV2(localStorage);
      patch = compileArtNetPatchFromMappingV2(mapping, {
        width: Number(mapping?.virtual?.width || 1),
        height: Number(mapping?.segments?.length || mapping?.virtual?.height || 1)
      });
      localStorage.setItem(ARTNET_MASTER_PATCH_STORAGE_KEY, JSON.stringify({ ...patch, savedAt: Date.now(), savedBy: 'settings-auto-compiled-step37d' }));
    }
    if (!patch?.routes?.length) throw new Error('NO_EXPLICIT_ARTNET_TARGETS: v Mappingu není žádný zapnutý strip s vyplněnou ArtNet IP.');
    patch = applyMultiOutRoutesToPatch(patch);
    try { localStorage.setItem(ARTNET_MASTER_PATCH_STORAGE_KEY, JSON.stringify({ ...patch, savedAt: Date.now(), savedBy: 'settings-multiout-final-patch' })); } catch {}
    renderMultiOutStatus();
    for (const route of patch.routes || []) {
      const ip = String(route.outputIp || route.targetIp || route.host || '').trim();
      assertValidArtnetIp37CN(ip, 'PATCH_TARGET_IP');
    }
    const targetCount = countExplicitArtNetPatchTargets(patch);
    if (!targetCount) throw new Error('NO_EXPLICIT_ARTNET_TARGETS: v Mappingu není žádný zapnutý strip s vyplněnou ArtNet IP. ArtNet start neposílá fallback pakety.');
    await fetchJson('/api/artnet/master-mirror/patch', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ ...patch, source: 'settings-uses-canonical-master-patch-step37d' })
    });
    return { ok: true, patch, targetCount };
  } catch (error) {
    console.warn('Saved ArtNet patch publish failed', error);
    throw error;
  }
}

async function stopArtnet() {
  await fetchJson(ARTNET_SYNC_LIVE_API.stop, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({}) });
  state.routerArtnetEnabled = false;
  state.artnetEnabled = false;
  writeStored();
  applyStateToDom();
  setStatus(ui.artnetStatus, 'ARTNET LIVE OFF');
  await refreshHealth();
}

async function toggleArtnetOutput() {
  collectStateFromDom();
  if (state.routerArtnetEnabled || state.artnetEnabled) await stopArtnet();
  else await startArtnet();
}

async function validateArtnet() {
  try {
    const data = await fetchJson(ARTNET_SYNC_LIVE_API.schedulerValidate, {
      method: 'POST', headers: jsonHeaders, body: JSON.stringify(artnetPayload({ pattern: 'segment-markers' }))
    });
    const packetCount = data?.universeCount || data?.packetCount || data?.plan?.budget?.packetsPerFrame || '?';
    const bytes = data?.expectedBytes || data?.actualBytes || '?';
    setStatus(ui.artnetStatus, `VALIDATE OK · ${data?.expectedPixels || '8×300'} px · ${bytes} bytes · ${packetCount} universes`);
  } catch (error) {
    setStatus(ui.artnetStatus, `VALIDATE ERROR: ${error.message}`);
  }
}

async function sendArtnetSolid(rgb) {
  try {
    await requireExplicitBindIp37CM();
    const payload = artnetPayload({
      rgb: buildSolidFrame(rgb),
      frame: buildSolidFrame(rgb),
      source: 'settings-solid-test',
      visualPattern: 'solid',
      mode: 'udp-armed',
      armed: true
    });
    const data = await fetchJson(ARTNET_SYNC_LIVE_API.sendOne, {
      method: 'POST', headers: jsonHeaders, body: JSON.stringify(payload)
    });
    setStatus(ui.artnetStatus, `TEST FRAME SENT LIVE · rgb(${rgb.join(',')}) · ${data?.packetSummary?.packetCount || '?'} packets`);
  } catch (error) {
    setStatus(ui.artnetStatus, `TEST FRAME ERROR: ${error.message}`);
  }
}

async function discoverArtnetNodes() {
  try {
    await requireExplicitBindIp37CM();
    const data = await fetchJson('/api/artnet/network/artpoll', { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ bindIp: state.bindIp, outputIp: state.targetIp || '255.255.255.255', port: state.artnetPort || 6454, timeoutMs: 1200 }) });
    if (ui.artnetNodes) ui.artnetNodes.value = JSON.stringify(data, null, 2);
    setStatus(ui.artnetStatus, 'DISCOVERY SENT');
  } catch (error) {
    setStatus(ui.artnetStatus, `DISCOVERY ERROR: ${error.message}`);
  }
}

async function refreshArtnetNodes() {
  try {
    const data = await fetchJson(`${ARTNET_SYNC_LIVE_API.nodes}?maxAgeMs=30000`);
    if (ui.artnetNodes) ui.artnetNodes.value = JSON.stringify(data, null, 2);
  } catch (error) {
    if (ui.artnetNodes) ui.artnetNodes.value = `NODES ERROR: ${error.message}`;
  }
}

async function refreshHealthLegacy() {
  const chunks = [];
  const calls = [
    ['MASTER', ARTNET_SYNC_LIVE_API.masterStatus],
    ['PATCH', '/api/artnet/master-mirror/patch-report'],
    ['ARTNET', ARTNET_SYNC_LIVE_API.status],
    ['TRUTH', ARTNET_SYNC_LIVE_API.truthSmoke],
    ['SERIAL', '/api/serial/status']
  ];
  for (const [label, url] of calls) {
    try {
      const data = await fetchJson(url);
      if (label === 'MASTER') chunks.push(`${label}: ${data.fresh === false ? 'STALE' : 'OK'} · age ${data.ageMs ?? data.latest?.ageMs ?? '?'} ms`);
      else if (label === 'PATCH') {
        const report = data?.report || {};
        chunks.push(`${label}: ${report.hasPatch ? report.summary : 'NONE'}`);
        if (ui.artnetPatchReport) {
          ui.artnetPatchReport.textContent = report.hasPatch
            ? [
                `PATCH: ${report.summary}`,
                ...(report.strips || []).slice(0, 8).map((row) => row.summary),
                ...(report.universes || []).slice(0, 8).map((row) => row.summary)
              ].join('\n')
            : 'PATCH: none published';
          renderOutputTruthPanel38A({ patchLine: report.hasPatch ? `PATCH REPORT: ${report.summary}` : 'PATCH REPORT: none' });
        }
      }
      else if (label === 'ARTNET') chunks.push(`${label}: ${data.running || data.enabled ? 'RUNNING' : 'IDLE'} · sent ${data.sent ?? data.framesSent ?? data.stats?.sent ?? '?'}`);
      else chunks.push(`${label}: ${data.open || data.isOpen ? 'OPEN' : 'CLOSED'} · ${data.path || data.port || ''}`);
    } catch (error) {
      chunks.push(`${label}: ${error.message}`);
      if (label === 'PATCH' && ui.artnetPatchReport) ui.artnetPatchReport.textContent = `PATCH ERROR: ${error.message}`;
    }
  }
  if (ui.health) ui.health.textContent = chunks.join('\n');
}

async function refreshHealth() {
  const chunks = [];
  const calls = [
    ['MASTER', ARTNET_SYNC_LIVE_API.masterStatus],
    ['PATCH', '/api/artnet/master-mirror/patch-report'],
    ['ARTNET', ARTNET_SYNC_LIVE_API.status],
    ['SERIAL', '/api/serial/status']
  ];
  for (const [label, url] of calls) {
    try {
      const data = await fetchJson(url);
      if (label === 'MASTER') chunks.push(`${label}: ${data.fresh === false ? 'STALE' : 'OK'} | age ${data.ageMs ?? data.latest?.ageMs ?? '?'} ms`);
      else if (label === 'PATCH') {
        const report = data?.report || {};
        chunks.push(`${label}: ${report.hasPatch ? report.summary : 'NONE'}`);
        if (ui.artnetPatchReport) {
          ui.artnetPatchReport.textContent = report.hasPatch
            ? [
                `PATCH: ${report.summary}`,
                ...(report.strips || []).slice(0, 8).map((row) => row.summary),
                ...(report.universes || []).slice(0, 8).map((row) => row.summary)
              ].join('\n')
            : 'PATCH: none published';
          renderOutputTruthPanel38A({ patchLine: report.hasPatch ? `PATCH REPORT: ${report.summary}` : 'PATCH REPORT: none' });
        }
      } else if (label === 'ARTNET') {
        const perf = readRuntimePerfSnapshot();
        const renderFps = Number(perf.renderFps || 0);
        const outputFps = Number(data.actualFps ?? 0);
        const requestedFps = Number(data.frameClock?.requestedFps ?? data.options?.fps ?? 0);
        const effectiveFps = Number(data.frameClock?.effectiveFps ?? 0);
        const mirrorFps = Number(state.artnetMirrorFps || 0);
        const fpsVerdict = buildArtnetFpsVerdict({ requestedFps, effectiveFps, outputFps, renderFps, mirrorFps, status: data });
        chunks.push(`${label}: ${data.running || data.enabled ? 'RUNNING' : 'IDLE'} | eff ${data.frameClock?.effectiveFps ?? '?'} / req ${data.frameClock?.requestedFps ?? '?'} fps | sent ${data.sentFrameCount ?? '?'} | skip ${data.skippedFrameCount ?? '?'}`);
        if (ui.artnetLiveMetrics) {
          ui.artnetLiveMetrics.textContent = [
            `LIVE: ${data.running ? 'RUNNING' : 'IDLE'} | eff ${data.frameClock?.effectiveFps ?? '?'} / req ${data.frameClock?.requestedFps ?? '?'} FPS`,
            `FPS: requested ${requestedFps || '-'} | effective ${effectiveFps || '-'} | output ${outputFps || '-'} | render ${renderFps || '-'} | mirror ${mirrorFps || '-'}`,
            fpsVerdict,
            `TARGET: ${data.network?.resolvedTarget?.targetIp || data.network?.outputIp || '-'}:${data.network?.port || '-'} | bind ${data.network?.socketBindIp || data.network?.bindIp || '-'}`,
            `BATCH: sent ${data.sentFrameCount ?? 0} | skipped ${data.skippedFrameCount ?? 0} | pending ${data.backpressure?.lastPendingMs ?? 0} ms | stale ${data.backpressure?.droppedStaleBatches ?? 0}`,
            `PACER: pace ${data.pacer?.packetPaceMs ?? 0} ms | burst ${data.pacer?.packetsPerBurst ?? 0} | active ${data.pacer?.activeBatchId ? 'YES' : 'NO'}`,
            `TIMING: jitter avg/max ${data.liveProfiler?.tickIntervalMs?.jitterAvgMs ?? 0}/${data.liveProfiler?.tickIntervalMs?.jitterMaxMs ?? 0} ms | batch avg/max ${data.liveProfiler?.batchLatencyMs?.avg ?? 0}/${data.liveProfiler?.batchLatencyMs?.max ?? 0} ms`,
            `RULES: order ${data.options?.packetOrder || '-'} | ArtSync ${data.options?.artSyncMode || '-'} | adaptive ${data.options?.adaptiveFrameClock || '-'} floor ${data.options?.adaptiveFloorFps ?? '-'} | recovers ${data.frameClock?.adaptiveFpsRecovers ?? 0}`,
            `MIRROR: fps ${state.artnetMirrorFps || '-'} | master age ${data.frameClock?.age?.masterMs ?? '-'} ms | cache age ${data.frameClock?.age?.cacheMs ?? '-'} ms`,
            `LAST: ${data.lastSendResult?.reason || '-'}`
          ].join('\n');
          renderOutputTruthPanel38A({ liveLine: `LIVE STATUS: ${data.running ? 'RUNNING' : 'IDLE'} | sent ${data.sentFrameCount ?? 0} | skipped ${data.skippedFrameCount ?? 0}` });
        }
      } else if (label === 'TRUTH') {
        chunks.push(`${label}: ${data.verdict || 'UNKNOWN'} | ${data.summary || '-'}`);
        if (ui.artnetLiveMetrics) {
          ui.artnetLiveMetrics.textContent += `\nTRUTH: ${data.verdict || 'UNKNOWN'} | ${data.checks?.filter?.((item) => item.ok !== true).map?.((item) => item.id).join(', ') || 'aligned'}`;
        }
      } else {
        chunks.push(`${label}: ${data.open || data.isOpen ? 'OPEN' : 'CLOSED'} | ${data.path || data.port || ''}`);
      }
    } catch (error) {
      chunks.push(`${label}: ${error.message}`);
      if (label === 'PATCH' && ui.artnetPatchReport) ui.artnetPatchReport.textContent = `PATCH ERROR: ${error.message}`;
      if (label === 'ARTNET' && ui.artnetLiveMetrics) ui.artnetLiveMetrics.textContent = `LIVE ERROR: ${error.message}`;
    }
  }
  if (ui.health) ui.health.textContent = chunks.join('\n');
}

function resetOutputState() {
  state.routerSerialEnabled = false;
  state.routerArtnetEnabled = false;
  state.routerUsbDmxEnabled = false;
  state.artnetEnabled = false;
  state.outputMode = 'preview';
  writeStored();
  applyStateToDom();
  setStatus(ui.deviceMessage, 'OUTPUT STATE RESET');
}

async function devicePower(action) {
  try {
    await fetchJson(`/api/ops/${action}`, { method: 'POST' });
    setStatus(ui.deviceMessage, `${action.toUpperCase()} SENT`);
  } catch (error) {
    setStatus(ui.deviceMessage, `${action.toUpperCase()} ERROR: ${error.message}`);
  }
}

function resetGlobalOutputCorrection37CT() {
  state.brightnessLimit = 1;
  state.gamma = 1;
  state.contrast = 1;
  writeStored();
  applyStateToDom();
  setStatus(ui.globalOutputStatus37CT, 'GLOBAL OUTPUT CORRECTION RESET: brightness 100 % / gamma 1.0 / contrast 1.00');
}

function bind() {
  Object.entries(controls).forEach(([id, el]) => {
    el?.addEventListener('input', () => { collectStateFromDom(); writeStored(); applyStateToDom(); });
    el?.addEventListener('change', () => {
      collectStateFromDom();
      if (id === 'targetIp' || id === 'artnetPort') syncArtNetTargetIpIntoMapping(state.targetIp, state.artnetPort);
      writeStored();
      applyStateToDom();
    });
  });
  ui.networkAdapter?.addEventListener('change', async () => { state.bindIp = String(ui.networkAdapter.value || '').trim(); state.networkAdapter = state.bindIp; applyStateToDom(); writeStored(); await saveArtnetConfig().catch(() => null); });
  ui.save?.addEventListener('click', saveSettings);
  ui.rescue?.addEventListener('click', resetOutputState);
  ui.serialRefresh?.addEventListener('click', refreshSerialPorts);
  ui.serialConnect?.addEventListener('click', connectSerial);
  ui.serialDisconnect?.addEventListener('click', disconnectSerial);
  ui.serialOutput?.addEventListener('click', toggleSerialOutput);
  ui.artnetOutput?.addEventListener('click', toggleArtnetOutput);
  ui.artnetStart?.addEventListener('click', startArtnet);
  ui.artnetStop?.addEventListener('click', stopArtnet);
  ui.artnetValidate?.addEventListener('click', validateArtnet);
  ui.artnetDiscover?.addEventListener('click', discoverArtnetNodes);
  ui.artnetNodesRefresh?.addEventListener('click', refreshArtnetNodes);
  ui.artnetPresetSafe?.addEventListener('click', () => applyArtnetPreset('safe'));
  ui.artnetPresetFast?.addEventListener('click', () => applyArtnetPreset('fast'));
  ui.artnetPresetAggressive?.addEventListener('click', () => applyArtnetPreset('aggressive'));
  ui.artnetSendRed?.addEventListener('click', () => sendArtnetSolid([255, 0, 0]));
  ui.artnetSendGreen?.addEventListener('click', () => sendArtnetSolid([0, 255, 0]));
  ui.artnetSendBlue?.addEventListener('click', () => sendArtnetSolid([0, 0, 255]));
  ui.artnetSendBlackout?.addEventListener('click', () => sendArtnetSolid([0, 0, 0]));
  ui.artnetMultiOutSeed8x300?.addEventListener('click', seedMultiOut8x300);
  ui.artnetMultiOutAddSplit?.addEventListener('click', addMultiOutSplitExample);
  ui.artnetMultiOutClear?.addEventListener('click', () => { state.artnetMultiOutRoutes = ''; state.artnetMultiOutEnabled = false; applyStateToDom(); renderMultiOutSlotEditor(); saveMultiOutConfig(); });
  ui.artnetMultiOutApply?.addEventListener('click', async () => { collectMultiOutSlotsToState(); saveMultiOutConfig(); await publishSavedArtnetPatch(); await refreshHealth(); setStatus(ui.artnetStatus, 'MULTI OUT ROUTES SAVED / PATCH APPLIED'); });
  ui.artnetMultiOutApplyStart?.addEventListener('click', async () => { collectMultiOutSlotsToState(); saveMultiOutConfig(); await publishSavedArtnetPatch(); await startArtnet(); });
  ui.artnetSafe8x300Reset?.addEventListener('click', resetArtnetSafe8x300_38A);
  ui.resetGlobalOutputCorrection37CT?.addEventListener('click', resetGlobalOutputCorrection37CT);
  ui.menuBtn?.addEventListener('click', () => ui.centerMenu?.classList.toggle('open'));
  ui.menuFullscreen?.addEventListener('click', async () => { await toggleFullscreen(); syncFullscreenButtonLabel(ui.menuFullscreen); });
  ui.menuQuit?.addEventListener('click', async () => {
    ui.menuQuit.disabled = true;
    ui.menuQuit.textContent = 'UKONČUJI…';
    const body = new Blob(['{}'], { type: 'application/json' });
    let sent = false;
    try { sent = Boolean(navigator.sendBeacon?.('/api/device/quit', body)); } catch {}
    if (!sent) await fetch('/api/device/quit', { method: 'POST', body: '{}', keepalive: true, headers: { 'Content-Type': 'application/json' } }).catch(() => {});
    window.setTimeout(() => window.close(), 50);
  });
  ui.reboot?.addEventListener('click', () => devicePower('reboot'));
  ui.shutdown?.addEventListener('click', () => devicePower('shutdown'));
  qsa('[data-proxy-click]').forEach((button) => {
    button.addEventListener('click', () => $(button.dataset.proxyClick)?.click());
  });
}

async function boot() {
  Object.assign(state, defaults, readStored());
  // One-time migration for installations that already persisted the older
  // 30/20/6 FPS defaults. Future operator changes remain persistent.
  if (localStorage.getItem(FPS_DEFAULTS_60_MIGRATION_KEY) !== '1') {
    state.fps = 60;
    state.previewFps = 60;
    state.layerPreviewFps = 60;
    state.shaderPreviewFps = 60;
    state.serialFps = 60;
    state.artnetMirrorFps = 60;
    state.maxLiveFps = 60;
    localStorage.setItem(FPS_DEFAULTS_60_MIGRATION_KEY, '1');
    writeStored();
  }
  loadMultiOutConfig();
  await loadArtnetLiveConfig();
  await refreshNetworkAdapters37CM({ autoPick: false });
  try {
    const mirrorFps = Number(localStorage.getItem('budilightArtNetMasterMirrorFps22EJ') || state.artnetMirrorFps || 60);
    state.artnetMirrorFps = Number.isFinite(mirrorFps) ? Math.max(1, Math.min(60, mirrorFps)) : 60;
  } catch {}
  state.routerSerialEnabled = toBool(state.routerSerialEnabled);
  state.routerArtnetEnabled = toBool(state.routerArtnetEnabled || state.artnetEnabled);
  state.artnetEnabled = state.routerArtnetEnabled;
  applyStateToDom();
  renderMultiOutSlotEditor();
  applyAppearance(sanitizeAppearance(state.theme || 'dark'));
  applyFullscreenPreference(toBool(state.fullscreenPreferred));
  syncFullscreenButtonLabel(ui.menuFullscreen);
  bind();
  startFpsMeter?.({ fpsValue: ui.fpsValue });
  refreshSerialPorts();
  refreshSerialStatus();
  refreshHealth();
  serialStatusTimer = managedSettingsInterval37CG('settings:serial-status', () => {
    if (!isShellViewActive37BQ()) { settingsPerf37BQ.serialSkipped += 1; return; }
    settingsPerf37BQ.lastSerialAt = Date.now();
    refreshSerialStatus();
  }, 4000);
  healthTimer = managedSettingsInterval37CG('settings:health-status', () => {
    if (!isShellViewActive37BQ()) { settingsPerf37BQ.healthSkipped += 1; return; }
    settingsPerf37BQ.lastHealthAt = Date.now();
    refreshHealth();
  }, 2000);
  window.addEventListener('beforeunload', () => {
    if (healthTimer) clearInterval(healthTimer);
    if (serialStatusTimer) clearInterval(serialStatusTimer);
  });
}

boot();
