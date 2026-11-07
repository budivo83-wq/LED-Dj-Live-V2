export const GENERATOR_SETTINGS_FPS_VERSION = 'STEP38M_GENERATOR_USES_SETTINGS_OUTPUT_FPS';
export const SETTINGS_STORAGE_KEY = 'led-engine-settings-v1';
export const ARTNET_MASTER_MIRROR_FPS_KEY = 'budilightArtNetMasterMirrorFps22EJ';
export const GENERATOR_LIVE_FPS_LEGACY_KEY = 'budilight.generator.live.fps.v1';
export const GENERATOR_LIVE_FPS_SOURCE_KEY = 'budilight.generator.live.fps.source.v1';

const DEFAULT_FPS = 60;
const MIN_FPS = 1;
const MAX_GENERATOR_LIVE_FPS = 60;

function clampFps(value, fallback = DEFAULT_FPS) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return clampFps(fallback, DEFAULT_FPS);
  return Math.max(MIN_FPS, Math.min(MAX_GENERATOR_LIVE_FPS, Math.round(n)));
}

function readJson(storage, key) {
  try {
    const raw = storage?.getItem?.(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function numeric(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function normalizeGeneratorSettingsFps(value, fallback = DEFAULT_FPS) {
  return clampFps(value, fallback);
}

export function readGeneratorSettingsOutputFps(storage = globalThis.localStorage, fallback = DEFAULT_FPS) {
  const settings = readJson(storage, SETTINGS_STORAGE_KEY) || {};
  const primary = numeric(settings.fps);
  if (primary) {
    return Object.freeze({
      fps: clampFps(primary, fallback),
      source: 'settings.fps',
      raw: primary,
      capped: primary > MAX_GENERATOR_LIVE_FPS
    });
  }

  const mirror = numeric(settings.artnetMirrorFps);
  if (mirror) {
    return Object.freeze({
      fps: clampFps(mirror, fallback),
      source: 'settings.artnetMirrorFps',
      raw: mirror,
      capped: mirror > MAX_GENERATOR_LIVE_FPS
    });
  }

  const mirrorKey = numeric(storage?.getItem?.(ARTNET_MASTER_MIRROR_FPS_KEY));
  if (mirrorKey) {
    return Object.freeze({
      fps: clampFps(mirrorKey, fallback),
      source: ARTNET_MASTER_MIRROR_FPS_KEY,
      raw: mirrorKey,
      capped: mirrorKey > MAX_GENERATOR_LIVE_FPS
    });
  }

  const legacy = numeric(storage?.getItem?.(GENERATOR_LIVE_FPS_LEGACY_KEY));
  if (legacy) {
    return Object.freeze({
      fps: clampFps(legacy, fallback),
      source: 'legacy.generator.live.fps',
      raw: legacy,
      capped: legacy > MAX_GENERATOR_LIVE_FPS
    });
  }

  return Object.freeze({
    fps: clampFps(fallback, DEFAULT_FPS),
    source: 'default',
    raw: fallback,
    capped: Number(fallback) > MAX_GENERATOR_LIVE_FPS
  });
}

export function persistGeneratorLiveFpsFromSettings(result, storage = globalThis.localStorage) {
  const resolved = result && typeof result === 'object'
    ? result
    : readGeneratorSettingsOutputFps(storage, DEFAULT_FPS);
  const fps = clampFps(resolved.fps, DEFAULT_FPS);
  try { storage?.setItem?.(GENERATOR_LIVE_FPS_LEGACY_KEY, String(fps)); } catch {}
  try { storage?.setItem?.(GENERATOR_LIVE_FPS_SOURCE_KEY, String(resolved.source || 'settings')); } catch {}
  return Object.freeze({ ...resolved, fps });
}

export async function fetchServerArtnetOutputFps(fetchImpl = globalThis.fetch, fallback = DEFAULT_FPS) {
  if (typeof fetchImpl !== 'function') return Object.freeze({ fps: clampFps(fallback, DEFAULT_FPS), source: 'server-unavailable', raw: fallback, capped: false });
  try {
    const response = await fetchImpl('/api/artnet/live-config', { cache: 'no-store' });
    if (!response?.ok) throw new Error(`HTTP ${response?.status || 0}`);
    const data = await response.json();
    const cfg = data?.config || data || {};
    const raw = numeric(cfg.fps) || numeric(cfg.artnetMirrorFps) || numeric(cfg.maxLiveFps) || fallback;
    return Object.freeze({ fps: clampFps(raw, fallback), source: 'server.live-config.fps', raw, capped: raw > MAX_GENERATOR_LIVE_FPS });
  } catch {
    return Object.freeze({ fps: clampFps(fallback, DEFAULT_FPS), source: 'server-fallback', raw: fallback, capped: Number(fallback) > MAX_GENERATOR_LIVE_FPS });
  }
}
