export const GENERATOR_BEAT_INTELLIGENCE_VERSION = 'STEP38V_GENERATOR_BEAT_INTELLIGENCE';

export const GENERATOR_BEAT_INTELLIGENCE_STORAGE_KEY = 'budilight.generator.beat.intelligence.config.v1';
export const GENERATOR_BEAT_INTELLIGENCE_SNAPSHOT_KEY = 'budilight.generator.beat.intelligence.snapshot.v1';

export const GENERATOR_BEAT_DEFAULT_CONFIG = Object.freeze({
  enabled: true,
  phraseBeats: 16,
  accentAmount: 0.46,
  dropHoldBeats: 8,
  autoPhraseReset: false,
  showBeatFlash: true
});

function clamp(value, min, max, fallback = min) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function clamp01(value, fallback = 0) {
  return clamp(value, 0, 1, fallback);
}

function fract(value) {
  return value - Math.floor(value);
}

function smoothstep(edge0, edge1, value) {
  const t = clamp01((value - edge0) / Math.max(1e-6, edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function storageGet(storage, key) {
  try { return storage?.getItem?.(key) || ''; } catch { return ''; }
}

function storageSet(storage, key, value) {
  try { storage?.setItem?.(key, value); return true; } catch { return false; }
}

export function normalizeGeneratorBeatConfig(input = {}) {
  // Config objects created by this module are immutable and already validated.
  // The beat evaluator runs on every animation frame, so avoid rebuilding the
  // same config object in that hot path.
  if (input?.version === GENERATOR_BEAT_INTELLIGENCE_VERSION && Object.isFrozen(input)) return input;
  return Object.freeze({
    version: GENERATOR_BEAT_INTELLIGENCE_VERSION,
    enabled: input.enabled !== false,
    phraseBeats: Math.max(4, Math.min(128, Math.trunc(Number(input.phraseBeats ?? GENERATOR_BEAT_DEFAULT_CONFIG.phraseBeats) || GENERATOR_BEAT_DEFAULT_CONFIG.phraseBeats))),
    accentAmount: clamp01(input.accentAmount, GENERATOR_BEAT_DEFAULT_CONFIG.accentAmount),
    dropHoldBeats: Math.max(1, Math.min(64, Math.trunc(Number(input.dropHoldBeats ?? GENERATOR_BEAT_DEFAULT_CONFIG.dropHoldBeats) || GENERATOR_BEAT_DEFAULT_CONFIG.dropHoldBeats))),
    autoPhraseReset: input.autoPhraseReset === true,
    showBeatFlash: input.showBeatFlash !== false,
    updatedAt: Number(input.updatedAt || Date.now())
  });
}

export function readGeneratorBeatConfig(storage = globalThis.localStorage) {
  try {
    const raw = storageGet(storage, GENERATOR_BEAT_INTELLIGENCE_STORAGE_KEY);
    return normalizeGeneratorBeatConfig(raw ? JSON.parse(raw) : GENERATOR_BEAT_DEFAULT_CONFIG);
  } catch {
    return normalizeGeneratorBeatConfig(GENERATOR_BEAT_DEFAULT_CONFIG);
  }
}

export function saveGeneratorBeatConfig(input = {}, storage = globalThis.localStorage) {
  const config = normalizeGeneratorBeatConfig({ ...input, updatedAt: Date.now() });
  storageSet(storage, GENERATOR_BEAT_INTELLIGENCE_STORAGE_KEY, JSON.stringify(config));
  return config;
}

export function createGeneratorBeatRuntime(input = {}, options = {}) {
  const runtime = {
    version: GENERATOR_BEAT_INTELLIGENCE_VERSION,
    phraseAnchorBeat: Number.isFinite(Number(input.phraseAnchorBeat)) ? Number(input.phraseAnchorBeat) : 0,
    lastTapWallAt: Number(input.lastTapWallAt || 0) || 0,
    lastTapIntervals: Array.isArray(input.lastTapIntervals) ? input.lastTapIntervals.slice(-6).map(Number).filter(Number.isFinite) : [],
    suggestedBpm: Number.isFinite(Number(input.suggestedBpm)) ? Number(input.suggestedBpm) : 0,
    dropUntilBeat: Number.isFinite(Number(input.dropUntilBeat)) ? Number(input.dropUntilBeat) : -Infinity,
    lastMarker: String(input.lastMarker || 'boot'),
    lastMarkerAt: Number(input.lastMarkerAt || 0) || 0,
    lastMeta: input.lastMeta || null
  };
  return options.freeze === false ? runtime : Object.freeze(runtime);
}

// The generator render loop owns this instance and updates it in place. All
// public/control-plane callers continue to receive the immutable runtime from
// createGeneratorBeatRuntime().
export function createMutableGeneratorBeatRuntime(input = {}) {
  return createGeneratorBeatRuntime(input, { freeze: false });
}

export function tapGeneratorBeat(runtime = createGeneratorBeatRuntime(), context = {}) {
  const nowWall = Number(context.nowWall || Date.now()) || Date.now();
  const interval = runtime.lastTapWallAt > 0 ? nowWall - runtime.lastTapWallAt : 0;
  let intervals = runtime.lastTapIntervals || [];
  let suggestedBpm = Number(runtime.suggestedBpm || 0) || 0;
  if (interval >= 250 && interval <= 2000) {
    intervals = [...intervals.slice(-5), interval];
    const avg = intervals.reduce((sum, value) => sum + value, 0) / Math.max(1, intervals.length);
    suggestedBpm = clamp(60000 / Math.max(1, avg), 40, 220, suggestedBpm || Number(context.bpm || 145) || 145);
  } else if (interval > 2200) {
    intervals = [];
  }
  return createGeneratorBeatRuntime({
    ...runtime,
    lastTapWallAt: nowWall,
    lastTapIntervals: intervals,
    suggestedBpm,
    lastMarker: 'tap-beat',
    lastMarkerAt: nowWall
  });
}

export function markGeneratorBeatDrop(runtime = createGeneratorBeatRuntime(), config = GENERATOR_BEAT_DEFAULT_CONFIG, context = {}) {
  const cfg = normalizeGeneratorBeatConfig(config);
  const beat = Number(context.beat || 0) || 0;
  return createGeneratorBeatRuntime({
    ...runtime,
    dropUntilBeat: beat + cfg.dropHoldBeats,
    phraseAnchorBeat: beat,
    lastMarker: 'drop',
    lastMarkerAt: Number(context.nowWall || Date.now()) || Date.now()
  });
}

export function resetGeneratorBeatPhrase(runtime = createGeneratorBeatRuntime(), context = {}) {
  const beat = Number(context.beat || 0) || 0;
  return createGeneratorBeatRuntime({
    ...runtime,
    phraseAnchorBeat: beat,
    lastMarker: 'phrase-reset',
    lastMarkerAt: Number(context.nowWall || Date.now()) || Date.now()
  });
}

export function applyGeneratorBeatIntelligence(runtime = createGeneratorBeatRuntime(), config = GENERATOR_BEAT_DEFAULT_CONFIG, values = {}, context = {}) {
  const cfg = normalizeGeneratorBeatConfig(config);
  const enabled = cfg.enabled !== false && context.enabled !== false;
  const beat = Number(context.beat || 0) || 0;
  const bpm = clamp(context.bpm, 40, 220, 145);
  const time = Number(context.time || 0) || 0;
  const initialPhraseAnchorBeat = Number(runtime.phraseAnchorBeat || 0) || 0;
  const phraseCycles = cfg.autoPhraseReset && beat >= initialPhraseAnchorBeat + cfg.phraseBeats
    ? Math.floor((beat - initialPhraseAnchorBeat) / cfg.phraseBeats)
    : 0;
  const phraseAnchorBeat = initialPhraseAnchorBeat + phraseCycles * cfg.phraseBeats;
  const phraseBeat = Math.max(0, beat - phraseAnchorBeat);
  const phraseProgress = fract(phraseBeat / Math.max(1, cfg.phraseBeats));
  const beatPhase = fract(beat);
  const barPhase = fract((beat - phraseAnchorBeat) / 4);
  const downbeatAccent = 1 - smoothstep(0.015, 0.26, beatPhase);
  const barAccent = 1 - smoothstep(0.025, 0.30, barPhase);
  const phraseAccent = 1 - smoothstep(0.018, 0.22, phraseProgress);
  const dropActive = enabled && beat < Number(runtime.dropUntilBeat || -Infinity);
  const dropProgress = dropActive ? clamp01(1 - ((Number(runtime.dropUntilBeat || beat) - beat) / Math.max(1, cfg.dropHoldBeats)), 0) : 0;
  const dropAccent = dropActive ? Math.max(0.42, downbeatAccent, barAccent * 0.75) : 0;
  const amount = enabled ? cfg.accentAmount : 0;
  const next = { ...values };
  const add = (key, value) => { next[key] = clamp01(Number(next[key] ?? values[key] ?? 0.5) + value, Number(next[key] ?? 0.5)); };
  if (enabled) {
    add('pulse', amount * (downbeatAccent * 0.16 + barAccent * 0.08 + phraseAccent * 0.05 + dropAccent * 0.18));
    add('shimmer', amount * (barAccent * 0.10 + phraseAccent * 0.08 + dropAccent * 0.18));
    add('energy', amount * (downbeatAccent * 0.05 + dropAccent * 0.14));
    add('warp', amount * (phraseAccent * 0.08 + dropAccent * 0.07));
    add('colorShift', Math.sin(time * 0.11 + phraseProgress * Math.PI * 2) * amount * 0.018 + phraseAccent * amount * 0.024);
  }
  const meta = Object.freeze({
    version: GENERATOR_BEAT_INTELLIGENCE_VERSION,
    enabled,
    bpm,
    beat,
    beatPhase,
    barPhase,
    phraseProgress,
    phraseBeats: cfg.phraseBeats,
    downbeatAccent: clamp01(downbeatAccent, 0),
    barAccent: clamp01(barAccent, 0),
    phraseAccent: clamp01(phraseAccent, 0),
    dropActive,
    dropAccent: clamp01(dropAccent, 0),
    dropProgress,
    accent: clamp01(Math.max(downbeatAccent * 0.65, barAccent * 0.72, phraseAccent * 0.58, dropAccent), 0),
    lastMarker: runtime.lastMarker || 'none',
    suggestedBpm: Number(runtime.suggestedBpm || 0) || 0
  });
  const nextMarker = phraseCycles > 0 ? 'auto-phrase-reset' : runtime.lastMarker;
  const nextRuntime = context.reuseRuntime === true && runtime && !Object.isFrozen(runtime)
    ? runtime
    : createGeneratorBeatRuntime({
      ...runtime,
      phraseAnchorBeat,
      lastMarker: nextMarker,
      lastMeta: meta
    });
  if (nextRuntime === runtime) {
    runtime.phraseAnchorBeat = phraseAnchorBeat;
    runtime.lastMarker = nextMarker;
    runtime.lastMeta = meta;
  }
  return Object.freeze({ runtime: nextRuntime, values: Object.freeze(next), meta });
}

export function writeGeneratorBeatSnapshot(runtime = createGeneratorBeatRuntime(), meta = {}, storage = globalThis.localStorage) {
  const snapshot = Object.freeze({
    version: GENERATOR_BEAT_INTELLIGENCE_VERSION,
    runtime,
    meta,
    t: Date.now()
  });
  storageSet(storage, GENERATOR_BEAT_INTELLIGENCE_SNAPSHOT_KEY, JSON.stringify(snapshot));
  return snapshot;
}

export function formatGeneratorBeatStatus(meta = {}, config = GENERATOR_BEAT_DEFAULT_CONFIG) {
  const cfg = normalizeGeneratorBeatConfig(config);
  const enabled = meta.enabled !== false && cfg.enabled !== false;
  const phrase = Number.isFinite(Number(meta.phraseProgress)) ? `${Math.round(Number(meta.phraseProgress) * 100)}%` : '--';
  const accent = Number.isFinite(Number(meta.accent)) ? `${Math.round(Number(meta.accent) * 100)}%` : '--';
  const drop = meta.dropActive ? ` · DROP ${Math.round(Number(meta.dropProgress || 0) * 100)}%` : '';
  return `${enabled ? 'ON' : 'OFF'} · beat ${Number(meta.beat || 0).toFixed(2)} · phrase ${phrase} · accent ${accent}${drop}`;
}

export function buildGeneratorBeatReport(runtime = createGeneratorBeatRuntime(), config = GENERATOR_BEAT_DEFAULT_CONFIG, meta = null) {
  const cfg = normalizeGeneratorBeatConfig(config);
  const m = meta || runtime.lastMeta || {};
  return [
    `Generator Beat Intelligence ${GENERATOR_BEAT_INTELLIGENCE_VERSION}`,
    `Enabled: ${cfg.enabled ? 'ON' : 'OFF'}`,
    `BPM: ${Number(m.bpm || 0).toFixed(2)}${Number(runtime.suggestedBpm || 0) ? ` · tap suggestion ${Number(runtime.suggestedBpm).toFixed(2)}` : ''}`,
    `Beat: ${Number(m.beat || 0).toFixed(3)}`,
    `Phrase: ${Math.round(Number(m.phraseProgress || 0) * 100)}% / ${cfg.phraseBeats} beats`,
    `Accent: beat ${Math.round(Number(m.downbeatAccent || 0) * 100)}%, bar ${Math.round(Number(m.barAccent || 0) * 100)}%, phrase ${Math.round(Number(m.phraseAccent || 0) * 100)}%, drop ${Math.round(Number(m.dropAccent || 0) * 100)}%`,
    `Drop active: ${m.dropActive ? 'YES' : 'NO'}`,
    `Last marker: ${runtime.lastMarker || 'none'}`
  ].join('\n');
}
