export function createFixedClock(fps = 60) {
  const frameMs = 1000 / Math.max(1, Number(fps) || 60);
  let nextAt = 0;

  function reset(now = performance.now()) {
    nextAt = now + frameMs;
  }

  function ensure(now = performance.now()) {
    if (!nextAt) reset(now);
  }

  function delay(now = performance.now()) {
    ensure(now);
    return Math.max(0, nextAt - now);
  }

  function advance(now = performance.now()) {
    ensure(now);
    if (now > nextAt + frameMs) nextAt = now + frameMs;
    else nextAt += frameMs;
    return nextAt;
  }

  function setNextAt(nextAtValue) {
    nextAt = Math.max(0, Number(nextAtValue) || 0);
    return nextAt;
  }

  function due(now = performance.now()) {
    ensure(now);
    return now >= nextAt;
  }

  return {
    frameMs,
    reset,
    ensure,
    delay,
    advance,
    due,
    setNextAt,
    peekNextAt: () => nextAt
  };
}
