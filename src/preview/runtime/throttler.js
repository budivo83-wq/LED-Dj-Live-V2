function nowMs() {
  return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
}

export function createPreviewThrottler(targetFps = 20) {
  let fps = Math.max(1, Number(targetFps) || 20);
  let frameMs = 1000 / fps;
  let lastAt = 0;
  let dropped = 0;

  return {
    setFps(nextFps) {
      fps = Math.max(1, Number(nextFps) || fps);
      frameMs = 1000 / fps;
    },
    shouldPresent(now = nowMs()) {
      if (lastAt <= 0) {
        lastAt = now;
        return true;
      }
      const dt = now - lastAt;
      if (dt < frameMs) {
        dropped += 1;
        return false;
      }
      lastAt = now;
      return true;
    },
    getStats() {
      return {
        fps,
        frameMs,
        lastAt,
        dropped
      };
    }
  };
}
