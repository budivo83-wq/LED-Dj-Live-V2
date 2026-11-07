import { beatStartedAtValue, bpmValue } from "./core/math.js";

export function createBpmEngine(deps) {
  const {
    state,
    getBeatStartedAt,
    setBeatStartedAt,
    getLastBeatResetId,
    setLastBeatResetId,
    getLastTap,
    setLastTap,
    syncControls,
    commitState
  } = deps;
  let tapHistory = [];

  function adjustBpm(delta) {
    state.bpm = bpmValue(state.bpm + delta);
    syncControls();
    commitState();
  }

  function tapBpm() {
    const now = performance.now();
    const lastTap = getLastTap();
    if (!lastTap || now - lastTap > 2200) tapHistory = [];
    if (lastTap) {
      const delta = now - lastTap;
      if (delta > 250 && delta < 2000) {
        tapHistory.push(delta);
        if (tapHistory.length > 4) tapHistory.shift();
        const sorted = tapHistory.slice().sort((a, b) => a - b);
        const trimmed = sorted.length >= 3 ? sorted.slice(0, sorted.length - 1) : sorted;
        const averageDelta = trimmed.reduce((sum, value) => sum + value, 0) / Math.max(1, trimmed.length);
        const tappedBpm = bpmValue(60000 / averageDelta);
        const currentBpm = bpmValue(state.bpm);
        const bpmDelta = tappedBpm - currentBpm;
        const blendedBpm = tapHistory.length >= 3
          ? currentBpm + bpmDelta * 0.72
          : currentBpm + bpmDelta * 0.5;
        state.bpm = bpmValue(blendedBpm);
        syncControls();
        commitState();
      }
    }
    setLastTap(now);
  }

  function resetBeat() {
    state.beat.resetId = (state.beat.resetId || 0) + 1;
    state.beat.startedAt = Date.now();
    setBeatStartedAt(performance.now());
    setLastBeatResetId(state.beat.resetId);
    commitState();
  }

  function syncBeatToNearestDownbeat(groupBeats = 16) {
    const safeGroupBeats = Math.max(1, Number(groupBeats) || 16);
    const currentBeat = getBeatPosition();
    const snappedBeat = Math.max(0, Math.round(currentBeat / safeGroupBeats) * safeGroupBeats);
    const beatMs = 60000 / Math.max(1, Number(state.bpm) || 120);
    const startedAtPerf = performance.now() - snappedBeat * beatMs;
    const startedAtWall = Date.now() - snappedBeat * beatMs;
    state.beat.resetId = (state.beat.resetId || 0) + 1;
    state.beat.startedAt = startedAtWall;
    setBeatStartedAt(startedAtPerf);
    setLastBeatResetId(state.beat.resetId);
    commitState();
    return snappedBeat;
  }

  function ensureBeatClock() {
    const startedAtWall = beatStartedAtValue(state.beat.startedAt);
    state.beat.startedAt = startedAtWall;

    // STEP37N: Keep the global beat transport continuous across page changes.
    // Older builds restored state.beat.startedAt but left the runtime clock
    // beatStartedAt at performance.now(), so returning to Performance restarted
    // the beat/sequencer from zero. Convert the persisted wall-clock timestamp
    // back into the current performance.now() domain on every boot.
    const elapsedMs = Math.max(0, Date.now() - startedAtWall);
    setBeatStartedAt(performance.now() - elapsedMs);
    setLastBeatResetId(state.beat.resetId || 0);
  }

  function getBeatPosition() {
    const beatStartedAt = getBeatStartedAt();
    return Math.max(0, ((performance.now() - beatStartedAt) / 1000) * (state.bpm / 60));
  }

  function seekBeatPosition(targetBeat = 0) {
    const beat = Math.max(0, Number(targetBeat) || 0);
    const beatMs = 60000 / Math.max(1, Number(state.bpm) || 120);
    const startedAtPerf = performance.now() - beat * beatMs;
    const startedAtWall = Date.now() - beat * beatMs;
    state.beat.resetId = (state.beat.resetId || 0) + 1;
    state.beat.startedAt = startedAtWall;
    setBeatStartedAt(startedAtPerf);
    setLastBeatResetId(state.beat.resetId);
    commitState();
    return beat;
  }

  return {
    adjustBpm,
    tapBpm,
    resetBeat,
    syncBeatToNearestDownbeat,
    ensureBeatClock,
    getBeatPosition,
    seekBeatPosition
  };
}

