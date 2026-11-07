function nowMs(defaultNow = Date.now) {
  const value = defaultNow();
  return Number.isFinite(value) ? Number(value) : Date.now();
}

export function createOutputRateLimiter({ fps = 60, autoAdapt = false, minFps = 20, now = Date.now } = {}) {
  let targetFps = clampFps(fps, minFps);
  let nextAt = 0;
  let sent = 0;
  let dropped = 0;
  let adapted = 0;
  let lastDropAt = 0;
  let lastSentAt = 0;

  function intervalMs() {
    return 1000 / Math.max(1, targetFps);
  }

  function allow() {
    const t = nowMs(now);
    if (t < nextAt) {
      dropped += 1;
      lastDropAt = t;
      if (autoAdapt) adaptDown();
      return false;
    }
    sent += 1;
    lastSentAt = t;
    nextAt = t + intervalMs();
    return true;
  }

  function adaptDown() {
    const next = Math.max(Number(minFps) || 20, Math.floor(targetFps * 0.85));
    if (next < targetFps) {
      targetFps = next;
      adapted += 1;
    }
  }

  function setFps(value) {
    targetFps = clampFps(value, minFps);
    return targetFps;
  }

  function reset(t = nowMs(now)) {
    nextAt = t;
    sent = 0;
    dropped = 0;
    adapted = 0;
    lastDropAt = 0;
    lastSentAt = 0;
  }

  return Object.freeze({
    allow,
    setFps,
    reset,
    getStats: () => Object.freeze({
      fps: targetFps,
      intervalMs: Number(intervalMs().toFixed(2)),
      autoAdapt: Boolean(autoAdapt),
      minFps: Number(minFps) || 20,
      sent,
      dropped,
      adapted,
      lastDropAt,
      lastSentAt,
      nextAt
    })
  });
}

function clampFps(value, minFps = 1) {
  const n = Number(value);
  const floor = Math.max(1, Number(minFps) || 1);
  if (!Number.isFinite(n)) return Math.max(floor, 60);
  return Math.max(floor, Math.min(120, Math.round(n)));
}
