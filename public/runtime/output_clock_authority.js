// STEP 13AR: Output Clock Authority
// One small authority owns physical output timing. Gallery, preview, WebGL and UI
// clocks may run slower/faster, but they must not rewrite or drag this clock.

function finiteNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clampNumber(value, min, max, fallback) {
  const n = finiteNumber(value, fallback);
  return Math.min(max, Math.max(min, n));
}

export function createOutputClockAuthority({ performanceRef = performance, runtimeProfile = {} } = {}) {
  const authority = globalThis?.__ledRuntimeModeAuthority?.get?.() || {};
  const outputPriority = authority.outputPriority === true;
  const maxCatchupTicks = Math.max(1, Math.round(Number(runtimeProfile?.outputClockMaxCatchupTicks || (outputPriority ? 1 : 2))));
  const hardResyncMs = Math.max(100, Number(runtimeProfile?.outputClockHardResyncMs || (outputPriority ? 750 : 500)));
  const driftWarnMs = Math.max(1, Number(runtimeProfile?.outputClockDriftWarnMs || (outputPriority ? 35 : 22)));

  let nextAt = 0;
  let lastTargetMs = 0;
  let tickCount = 0;
  let resyncCount = 0;
  let lateCount = 0;
  let maxDriftMs = 0;
  let lastDriftMs = 0;
  let lastDelayMs = 0;
  let lastScheduledAt = 0;
  let lastTickAt = 0;

  function normalizeTargetMs(targetMs) {
    return clampNumber(targetMs, 1000 / 120, 1000, outputPriority ? 20 : 16.6667);
  }

  function reset(now = performanceRef.now()) {
    nextAt = Number(now) || 0;
    lastTargetMs = 0;
    lastDelayMs = 0;
    lastDriftMs = 0;
    lastScheduledAt = nextAt;
  }

  function plan(now = performanceRef.now(), targetMs = 16.6667) {
    const at = Number(now) || 0;
    const frameMs = normalizeTargetMs(targetMs);

    if (!nextAt || Math.abs(frameMs - lastTargetMs) > 0.25) {
      nextAt = at + frameMs;
      lastTargetMs = frameMs;
      resyncCount += 1;
    }

    const scheduledAt = nextAt;
    let driftMs = Math.max(0, at - scheduledAt);

    if (driftMs > hardResyncMs) {
      nextAt = at + frameMs;
      resyncCount += 1;
      driftMs = 0;
    }

    const delayMs = Math.max(0, nextAt - at);
    lastScheduledAt = nextAt;
    lastDelayMs = delayMs;
    lastDriftMs = driftMs;
    if (driftMs > maxDriftMs) maxDriftMs = driftMs;
    if (driftMs > driftWarnMs) lateCount += 1;

    return {
      delayMs,
      scheduledAt: nextAt,
      targetMs: frameMs,
      driftMs,
      fps: 1000 / frameMs
    };
  }

  function complete(now = performanceRef.now(), targetMs = 16.6667) {
    const at = Number(now) || 0;
    const frameMs = normalizeTargetMs(targetMs);
    const scheduledAt = lastScheduledAt || nextAt || at;
    const driftMs = Math.max(0, at - scheduledAt);
    const missedTicks = driftMs > frameMs ? Math.floor(driftMs / frameMs) : 0;
    const catchupTicks = Math.min(maxCatchupTicks, missedTicks);

    nextAt = scheduledAt + frameMs * (1 + catchupTicks);
    if (nextAt < at) nextAt = at + frameMs;

    tickCount += 1;
    lastTickAt = at;
    lastDriftMs = driftMs;
    lastTargetMs = frameMs;
    if (driftMs > maxDriftMs) maxDriftMs = driftMs;
    if (driftMs > driftWarnMs) lateCount += 1;

    return {
      targetMs: frameMs,
      fps: 1000 / frameMs,
      driftMs,
      missedTicks,
      catchupTicks,
      nextAt
    };
  }

  function getStats() {
    return {
      authority: "output-clock-13AR",
      tickCount,
      resyncCount,
      lateCount,
      lastTargetMs: Number(lastTargetMs.toFixed(3)),
      targetFps: lastTargetMs > 0 ? Number((1000 / lastTargetMs).toFixed(2)) : 0,
      lastDelayMs: Number(lastDelayMs.toFixed(2)),
      lastDriftMs: Number(lastDriftMs.toFixed(2)),
      maxDriftMs: Number(maxDriftMs.toFixed(2)),
      lastTickAt: Math.round(lastTickAt || 0),
      nextAt: Math.round(nextAt || 0)
    };
  }

  reset();
  return { reset, plan, complete, getStats };
}
