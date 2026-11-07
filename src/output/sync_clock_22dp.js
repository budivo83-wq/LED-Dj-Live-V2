import { artnetFrameBudget } from './artnet_live_tx_22do.js';

export const STEP22DP_SYNC_CLOCK_VERSION = 'STEP22DP_NODE_SYNC_CLOCK';

export function buildSyncClockPlan(options = {}) {
  const bpm = clampNumber(options.bpm, 40, 240, 145);
  const fps = clampInt(options.fps, 1, 120, 60);
  const beatsPerBar = clampInt(options.beatsPerBar, 1, 16, 4);
  const phraseBeats = clampInt(options.phraseBeats, 4, 1024, 256);
  const nowMs = clampNumber(options.nowMs ?? Date.now(), 0, Number.MAX_SAFE_INTEGER, Date.now());
  const clockStartMs = clampNumber(options.clockStartMs ?? nowMs, 0, Number.MAX_SAFE_INTEGER, nowMs);
  const beatMs = 60000 / bpm;
  const frameMs = 1000 / fps;
  const framesPerBeat = fps * beatMs / 1000;
  const framesPerBar = framesPerBeat * beatsPerBar;
  const framesPerPhrase = framesPerBeat * phraseBeats;
  const budget = artnetFrameBudget({
    stripCount: clampInt(options.stripCount, 1, 64, 8),
    pixelsPerStrip: clampInt(options.pixelsPerStrip, 1, 1000, 300),
    pixelsPerUniverse: clampInt(options.pixelsPerUniverse, 1, 170, 170),
    fps,
    artSync: options.artSync !== false
  });
  return Object.freeze({
    ok: true,
    version: STEP22DP_SYNC_CLOCK_VERSION,
    mode: 'node-sync-clock-plan',
    clock: Object.freeze({
      bpm,
      fps,
      beatMs: round3(beatMs),
      frameMs: round3(frameMs),
      beatsPerBar,
      phraseBeats,
      framesPerBeat: round3(framesPerBeat),
      framesPerBar: round3(framesPerBar),
      framesPerPhrase: round3(framesPerPhrase),
      clockStartMs,
      nowMs
    }),
    artnet: budget,
    rules: Object.freeze([
      'One server-side monotonic clock is the authority for preview, raw serial test stream and ArtNet TX.',
      'Frame number is derived from elapsed time, not from setInterval call count; this prevents drift.',
      'Beat and phrase phase are derived from BPM and elapsed time so DROP/RESYNC events can stay deterministic.',
      'ArtSync should be emitted after all universe packets for the same frame number.'
    ])
  });
}

export function buildSyncClockSnapshot(options = {}) {
  const precomputedPlan = options.syncClockPlan?.clock && options.syncClockPlan?.artnet
    ? options.syncClockPlan
    : null;
  const plan = precomputedPlan || buildSyncClockPlan(options);
  const nowMs = clampNumber(options.nowMs ?? Date.now(), 0, Number.MAX_SAFE_INTEGER, Date.now());
  const elapsedMs = Math.max(0, nowMs - plan.clock.clockStartMs);
  const frameIndex = Math.floor(elapsedMs / plan.clock.frameMs);
  const beatFloat = elapsedMs / plan.clock.beatMs;
  const beatIndex = Math.floor(beatFloat);
  const beatPhase = beatFloat - beatIndex;
  const barIndex = Math.floor(beatIndex / plan.clock.beatsPerBar);
  const beatInBar = beatIndex % plan.clock.beatsPerBar;
  const phraseIndex = Math.floor(beatIndex / plan.clock.phraseBeats);
  const beatInPhrase = beatIndex % plan.clock.phraseBeats;
  const sequence = (frameIndex % 255) + 1;
  const nextFrameDueMs = plan.clock.clockStartMs + ((frameIndex + 1) * plan.clock.frameMs);
  const nextBeatDueMs = plan.clock.clockStartMs + ((beatIndex + 1) * plan.clock.beatMs);
  return Object.freeze({
    ok: true,
    version: STEP22DP_SYNC_CLOCK_VERSION,
    mode: 'node-sync-clock-snapshot',
    nowMs,
    elapsedMs: round3(elapsedMs),
    frame: Object.freeze({
      frameIndex,
      sequence,
      nextFrameDueMs: round3(nextFrameDueMs),
      msUntilNextFrame: round3(Math.max(0, nextFrameDueMs - nowMs))
    }),
    beat: Object.freeze({
      bpm: plan.clock.bpm,
      beatIndex,
      beatPhase: round4(beatPhase),
      beatInBar,
      barIndex,
      beatInPhrase,
      phraseIndex,
      phraseBeats: plan.clock.phraseBeats,
      nextBeatDueMs: round3(nextBeatDueMs),
      msUntilNextBeat: round3(Math.max(0, nextBeatDueMs - nowMs))
    }),
    transport: Object.freeze({
      fps: plan.clock.fps,
      packetsPerFrame: plan.artnet.packetsPerFrame,
      packetsPerSecond: plan.artnet.packetsPerSecond,
      sequence,
      artSync: plan.artnet.artSync
    })
  });
}

export function buildDeterministicEventPlan(options = {}) {
  const snapshot = options.syncClockSnapshot?.beat && options.syncClockSnapshot?.frame
    ? options.syncClockSnapshot
    : buildSyncClockSnapshot(options);
  const phraseBeats = snapshot.beat.phraseBeats;
  const beatInPhrase = snapshot.beat.beatInPhrase;
  const isBarStart = snapshot.beat.beatInBar === 0 && snapshot.beat.beatPhase < 0.08;
  const isPhraseStart = beatInPhrase === 0 && snapshot.beat.beatPhase < 0.08;
  const isDropWindow = beatInPhrase >= phraseBeats - 16;
  const isDropStart = beatInPhrase === phraseBeats - 16 && snapshot.beat.beatPhase < 0.08;
  const isResyncSafePoint = isPhraseStart || isBarStart;
  return Object.freeze({
    ok: true,
    version: STEP22DP_SYNC_CLOCK_VERSION,
    mode: 'deterministic-event-plan',
    snapshot,
    events: Object.freeze({
      isBarStart,
      isPhraseStart,
      isDropWindow,
      isDropStart,
      isResyncSafePoint,
      suggestedVisualIntensity: isDropWindow ? 'high' : isBarStart ? 'accent' : 'normal'
    })
  });
}

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function round3(n) { return Math.round(Number(n) * 1000) / 1000; }
function round4(n) { return Math.round(Number(n) * 10000) / 10000; }
