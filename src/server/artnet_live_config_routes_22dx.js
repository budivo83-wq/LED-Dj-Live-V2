import fs from 'node:fs';
import path from 'node:path';
import { ARTNET_LIVE_DEFAULTS } from '../../shared/artnet_live_defaults.js';

export const STEP22DX_ARTNET_LIVE_CONFIG_VERSION = 'STEP22DX_ARTNET_LIVE_REAL_OUTPUT_CONFIG';

const DEFAULT_CONFIG = Object.freeze({
  ...ARTNET_LIVE_DEFAULTS
});

const ALLOWED_VISUAL_PATTERNS = Object.freeze([
  'visible-chase',
  'black',
  'blackout',
  'master',
  'master-frame',
  'master-framebus',
  'app-master',
  'performance-master'
]);

const ALLOWED_SOURCE_MODES = Object.freeze([
  'performance-master-only',
  'master-with-cache',
  'test-generator',
  'explicit-frame'
]);

const ALLOWED_TARGET_MODES = Object.freeze(['unicast', 'subnet-broadcast', 'global-broadcast']);
const ALLOWED_CALLBACK_MODES = Object.freeze(['lightweight', 'normal', 'none']);
const ALLOWED_PACKET_ORDERS = Object.freeze(['sequential', 'interleaved-v2', 'split-half']);
const ALLOWED_ARTSYNC_MODES = Object.freeze(['off', 'none', 'every-frame', 'every-n', 'every-n-frames']);
const ALLOWED_BINARY_MODES = Object.freeze(['on', 'off']);

function sanitizeConfig(input = {}) {
  const n = (v, min, max, fb) => {
    const x = Number(v);
    if (!Number.isFinite(x)) return fb;
    return Math.max(min, Math.min(max, Math.round(x)));
  };
  const s = (v, fb = '') => String(v ?? fb).trim();
  const mode = (value, allowed, fallback) => allowed.includes(s(value)) ? s(value) : fallback;
  const boolMode = (value, fallback) => ALLOWED_BINARY_MODES.includes(s(value).toLowerCase()) ? s(value).toLowerCase() : fallback;
  return {
    outputIp: s(input.outputIp || input.host, DEFAULT_CONFIG.outputIp),
    bindIp: s(input.bindIp || input.localAddress, DEFAULT_CONFIG.bindIp),
    targetMode: mode(input.targetMode, ALLOWED_TARGET_MODES, DEFAULT_CONFIG.targetMode),
    port: n(input.port, 1, 65535, DEFAULT_CONFIG.port),
    fps: n(input.fps, 1, 120, DEFAULT_CONFIG.fps),
    maxLiveFps: n(input.maxLiveFps, 1, 120, DEFAULT_CONFIG.maxLiveFps),
    bpm: n(input.bpm, 40, 240, DEFAULT_CONFIG.bpm),
    stripCount: n(input.stripCount, 1, 64, DEFAULT_CONFIG.stripCount),
    pixelsPerStrip: n(input.pixelsPerStrip, 1, 1000, DEFAULT_CONFIG.pixelsPerStrip),
    universeStart: n(input.universeStart ?? input.startUniverse, 0, 32767, DEFAULT_CONFIG.universeStart),
    pixelsPerUniverse: n(input.pixelsPerUniverse, 1, 170, DEFAULT_CONFIG.pixelsPerUniverse),
    packetPaceMs: n(input.packetPaceMs, 0, 25, DEFAULT_CONFIG.packetPaceMs),
    packetsPerBurst: n(input.packetsPerBurst, 1, 32, DEFAULT_CONFIG.packetsPerBurst),
    maxPendingBatchMs: n(input.maxPendingBatchMs, 50, 2000, DEFAULT_CONFIG.maxPendingBatchMs),
    callbackMode: mode(input.callbackMode, ALLOWED_CALLBACK_MODES, DEFAULT_CONFIG.callbackMode),
    adaptiveFrameClock: boolMode(input.adaptiveFrameClock, DEFAULT_CONFIG.adaptiveFrameClock),
    adaptiveFloorFps: n(input.adaptiveFloorFps, 1, 60, DEFAULT_CONFIG.adaptiveFloorFps),
    packetOrder: mode(input.packetOrder, ALLOWED_PACKET_ORDERS, DEFAULT_CONFIG.packetOrder),
    artSyncMode: mode(input.artSyncMode, ALLOWED_ARTSYNC_MODES, DEFAULT_CONFIG.artSyncMode),
    masterMaxAgeMs: n(input.masterMaxAgeMs, 100, 30000, DEFAULT_CONFIG.masterMaxAgeMs),
    lastGoodHoldMs: n(input.lastGoodHoldMs, 0, 60000, DEFAULT_CONFIG.lastGoodHoldMs),
    blackoutAfterHold: Boolean(input.blackoutAfterHold ?? DEFAULT_CONFIG.blackoutAfterHold),
    visualPattern: ALLOWED_VISUAL_PATTERNS.includes(s(input.visualPattern || input.pattern)) ? s(input.visualPattern || input.pattern) : DEFAULT_CONFIG.visualPattern,
    sourceMode: ALLOWED_SOURCE_MODES.includes(s(input.sourceMode)) ? s(input.sourceMode) : DEFAULT_CONFIG.sourceMode
  };
}

function readConfig(file) {
  try {
    if (!fs.existsSync(file)) return { ...DEFAULT_CONFIG };
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return sanitizeConfig({ ...DEFAULT_CONFIG, ...(parsed?.config || parsed || {}) });
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

function writeConfig(file, config) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({
    ok: true,
    version: STEP22DX_ARTNET_LIVE_CONFIG_VERSION,
    savedAt: new Date().toISOString(),
    config: sanitizeConfig(config)
  }, null, 2));
}

export function registerArtNetLiveConfigRoutes22DX(app, { expressRef, rootDir = process.cwd(), liveSender22DQ } = {}) {
  const jsonParser = expressRef?.json?.({ limit: '64kb' });
  const configFile = path.join(rootDir, 'data', 'artnet-live-config.json');

  app.get('/api/artnet/live-config', (req, res) => {
    res.json({ ok: true, version: STEP22DX_ARTNET_LIVE_CONFIG_VERSION, config: readConfig(configFile), configFile });
  });

  app.post('/api/artnet/live-config', jsonParser, (req, res) => {
    const config = sanitizeConfig(req.body || {});
    writeConfig(configFile, config);
    res.json({ ok: true, version: STEP22DX_ARTNET_LIVE_CONFIG_VERSION, saved: true, config });
  });

  app.post('/api/artnet/live-config/apply', jsonParser, (req, res) => {
    const config = sanitizeConfig(req.body || readConfig(configFile));
    writeConfig(configFile, config);
    const status = liveSender22DQ?.status?.() || null;
    res.json({ ok: true, version: STEP22DX_ARTNET_LIVE_CONFIG_VERSION, saved: true, config, senderStatus: status });
  });
}
