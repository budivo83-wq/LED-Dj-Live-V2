export function createThumbQueueController(deps) {
  const {
    thumbCache,
    readThumbFromSession,
    writeThumbToSession,
    imageHasVisibleColor,
    captureVisibleThumbnail,
    thumbCacheKey,
    drawThumbFromCache,
    renderAnimationThumb,
    renderPaletteThumb,
    getCurrentSessionId,
    windowRef = window
  } = deps;

  const runtimeProfile = windowRef.RUNTIME_PROFILE || {};
  const authority = windowRef.__ledRuntimeModeAuthority?.get?.() || {};
  const mode = String(authority.mode || runtimeProfile.mode || (runtimeProfile.raspi ? "raspi-safe" : "normal")).toLowerCase();
  const thumbsEnabled = authority.thumbsEnabled !== false && runtimeProfile.runtimeThumbRender !== false && runtimeProfile.thumbsEnabled !== false;
  const constrained = mode !== "normal";
  const baseMaxPerPump = Math.max(1, Number(runtimeProfile.thumbQueueMaxPerPump || 1));
  const baseMinGapMs = Math.max(16, Number(runtimeProfile.thumbQueueMinGapMs || (constrained ? 90 : 34)));
  const baseIdleTimeoutMs = Math.max(80, Number(runtimeProfile.thumbQueueIdleTimeoutMs || (constrained ? 260 : 140)));
  const baseMaxQueue = Math.max(24, Number(runtimeProfile.thumbQueueMax || (constrained ? 96 : 192)));
  let maxPerPump = baseMaxPerPump;
  let minGapMs = baseMinGapMs;
  let idleTimeoutMs = baseIdleTimeoutMs;
  let maxQueue = baseMaxQueue;
  let adaptiveThumbLevel = 0;

  function applyAdaptiveThumbSoftState(event) {
    const detail = event?.detail || windowRef.__ledAdaptiveSoftState || null;
    const active = detail?.active === true;
    const level = Math.max(0, Math.min(3, Number(detail?.appliedLevel || 0)));
    adaptiveThumbLevel = active ? level : 0;

    // Output stays untouched. This only slows thumbnail background work.
    const gapFactor = [1, 1.35, 1.85, 2.6][adaptiveThumbLevel] || 1;
    const idleFactor = [1, 1.2, 1.45, 1.8][adaptiveThumbLevel] || 1;
    maxPerPump = 1;
    minGapMs = Math.round(baseMinGapMs * gapFactor);
    idleTimeoutMs = Math.round(baseIdleTimeoutMs * idleFactor);
    maxQueue = baseMaxQueue;
    stats.adaptiveLevel = adaptiveThumbLevel;
    stats.minGapMs = minGapMs;
    stats.idleTimeoutMs = idleTimeoutMs;
    stats.maxPerPump = maxPerPump;
    publishStats();
  }

  try {
    windowRef.addEventListener?.("led-adaptive-soft-state", applyAdaptiveThumbSoftState);
  } catch {
    // diagnostics only
  }

  const thumbRenderQueue = [];
  const pendingSessionThumbWrites = new Map();
  let pendingSessionThumbTimer = null;

  function isLivePerformanceActive() {
    try {
      if (windowRef.__ledOutputPipelineStatus?.enabled === true) return true;
      if (windowRef.__ledLatestRuntimeDetail?.enabled === true) return true;
      return Boolean(windowRef.document?.body?.classList?.contains("performance-page-active"));
    } catch {
      return false;
    }
  }

  function liveHardSleepEnabled37DM() {
    // STEP37DM: while a real live output is enabled, runtime thumbnail rendering
    // is non-critical and can wait. Cached/session thumbnails still draw
    // immediately; only expensive canvas render/preload work is parked.
    try {
      if (runtimeProfile.thumbQueueLiveHardSleep === false) return false;
      if (windowRef.__ledOutputPipelineStatus?.enabled === true) return true;
      if (windowRef.__ledLatestRuntimeDetail?.enabled === true) return true;
      if (windowRef.__ledOutputConsumerGate?.outputEnabled === true) return true;
    } catch {}
    return false;
  }

  function liveHardSleepDelay37DM() {
    return Math.max(900, Number(runtimeProfile.thumbQueueLiveHardSleepMs || 1600));
  }

  function flushPendingSessionThumbWrites() {
    pendingSessionThumbTimer = null;
    const batch = Array.from(pendingSessionThumbWrites.entries()).slice(0, 12);
    batch.forEach(([key, imageData]) => {
      pendingSessionThumbWrites.delete(key);
      try { writeThumbToSession(key, imageData); } catch {}
    });
    if (pendingSessionThumbWrites.size) schedulePendingSessionThumbFlush(350);
  }

  function runtimeLoopRegistry37CE() {
    try { return windowRef.__budilightRuntimeLoopRegistry37CE || null; }
    catch { return null; }
  }

  function managedThumbTimeout37DH(name, fn, delayMs, opts = {}) {
    const loops = runtimeLoopRegistry37CE();
    if (loops?.timeout) return loops.timeout(`thumb-queue:${name}`, fn, delayMs, { group: 'thumb-queue', ...opts });
    return windowRef.setTimeout(fn, Math.max(0, Number(delayMs) || 0));
  }

  function clearManagedThumbTimeout37DH(id) {
    try { runtimeLoopRegistry37CE()?.clear?.(id); } catch {}
    try { windowRef.clearTimeout?.(id); } catch {}
  }

  function schedulePendingSessionThumbFlush(delayMs = 900) {
    if (pendingSessionThumbTimer) return;
    pendingSessionThumbTimer = managedThumbTimeout37DH('session-write-flush', flushPendingSessionThumbWrites, delayMs, { liveFactor: 1.5, hiddenFactor: 3, maxMs: 5000 });
  }

  function writeThumbToSessionDeferred(key, imageData) {
    if (!key || !imageData) return;
    if (isLivePerformanceActive()) {
      pendingSessionThumbWrites.set(key, imageData);
      schedulePendingSessionThumbFlush(Math.max(700, Number(runtimeProfile.thumbSessionWriteLiveDelayMs || 1200)));
      return;
    }
    if (pendingSessionThumbWrites.size) flushPendingSessionThumbWrites();
    writeThumbToSession(key, imageData);
  }

  const thumbRenderStatus = new Map();
  const queuedKeys = new Set();
  let thumbRenderScheduled = false;
  let activeRender = false;
  let lastPumpAt = 0;
  let lastStatsAt = 0;
  const stats = {
    version: "37DV_SELECTOR_THUMBS_LIVE_SAFE",
    queued: 0,
    rendered: 0,
    cacheHits: 0,
    sessionHits: 0,
    cacheMiss: 0,
    droppedDuplicate: 0,
    droppedStale: 0,
    droppedOverflow: 0,
    failed: 0,
    pumps: 0,
    active: false,
    queueLength: 0,
    lastRenderMs: 0,
    lastPumpMs: 0,
    lastKey: "",
    maxPerPump,
    minGapMs,
    idleTimeoutMs,
    maxQueue,
    mode,
    thumbsEnabled,
    adaptiveLevel: 0,
    liveHardSleep: false,
    liveHardSleepMs: 0,
    liveHardSleepSkips: 0,
    liveDroppedOverflow: 0,
    liveSuspendedRuntime: 0,
    liveSuspendDrawnMissing: 0
  };

  function publishStats() {
    stats.active = activeRender || thumbRenderScheduled;
    stats.queueLength = thumbRenderQueue.length;
    windowRef.__ledThumbQueueStats = { ...stats };
    const now = performance.now?.() || Date.now();
    if (now - lastStatsAt > 500) {
      lastStatsAt = now;
      try {
        windowRef.dispatchEvent?.(new CustomEvent("led-thumb-queue-stats", { detail: { ...stats } }));
      } catch {}
    }
  }

  function queueThumbRender(task) {
    if (!thumbsEnabled) {
      stats.droppedStale += task ? 1 : 0;
      publishStats();
      return;
    }
    if (task) {
      const key = thumbCacheKey(task);
      if (!key) return;

      const cached = thumbCache.get(key);
      if (cached) {
        stats.cacheHits += 1;
        thumbRenderStatus.set(key, "ready");
        task.canvas && drawThumbFromCache(task.canvas, cached);
        publishStats();
        return;
      }

      const sessionCached = readThumbFromSession(key);
      if (sessionCached && imageHasVisibleColor(sessionCached)) {
        stats.sessionHits += 1;
        thumbCache.set(key, sessionCached);
        thumbRenderStatus.set(key, "ready");
        task.canvas && drawThumbFromCache(task.canvas, sessionCached);
        publishStats();
        return;
      }

      if (task.allowRuntimeRender === false) {
        stats.cacheMiss += 1;
        task.canvas && drawMissingThumb(task.canvas, key);
        thumbRenderStatus.set(key, "cache-miss");
        publishStats();
        return;
      }
      if (!thumbsEnabled) {
        stats.cacheMiss += 1;
        task.canvas && drawMissingThumb(task.canvas, key);
        thumbRenderStatus.set(key, "disabled");
        publishStats();
        return;
      }

      // STEP37DN: live output has absolute priority. When ArtNet/serial output
      // is active, do not even build a runtime thumbnail backlog. Cached/session
      // thumbs still draw above; misses get a cheap placeholder and are retried
      // naturally after live output is stopped or the gallery is reopened.
      if (liveHardSleepEnabled37DM() && task.forceRuntimeRender !== true) {
        stats.cacheMiss += 1;
        stats.liveSuspendedRuntime += 1;
        task.canvas && drawMissingThumb(task.canvas, key);
        if (task.canvas) stats.liveSuspendDrawnMissing += 1;
        thumbRenderStatus.set(key, "live-suspended");
        stats.liveHardSleep = true;
        stats.liveHardSleepMs = liveHardSleepDelay37DM();
        publishStats();
        return;
      }

      if (thumbRenderStatus.get(key) === "pending" || queuedKeys.has(key)) {
        stats.droppedDuplicate += 1;
        publishStats();
        return;
      }

      const liveHardSleep = liveHardSleepEnabled37DM();
      const effectiveMaxQueue = liveHardSleep ? Math.max(12, Math.min(maxQueue, Number(runtimeProfile.thumbQueueLiveMax || 48))) : maxQueue;
      while (thumbRenderQueue.length >= effectiveMaxQueue) {
        const dropped = thumbRenderQueue.shift();
        const droppedKey = dropped ? thumbCacheKey(dropped) : "";
        if (droppedKey) {
          queuedKeys.delete(droppedKey);
          thumbRenderStatus.delete(droppedKey);
        }
        stats.droppedOverflow += 1;
        if (liveHardSleep) stats.liveDroppedOverflow += 1;
      }

      thumbRenderStatus.set(key, "pending");
      queuedKeys.add(key);
      thumbRenderQueue.push({ ...task, queuedAt: performance.now?.() || Date.now(), key });
      stats.queued += 1;
    }

    schedulePump();
    publishStats();
  }

  function schedulePump(delayMs = 0) {
    if (thumbRenderScheduled || activeRender) return;
    thumbRenderScheduled = true;

    const run = (deadline) => processThumbRenderQueue(deadline);
    const now = performance.now?.() || Date.now();
    const hasForcedSelectorThumb37DV = thumbRenderQueue.some((task) => task?.forceRuntimeRender === true);
    if (liveHardSleepEnabled37DM() && thumbRenderQueue.length && !hasForcedSelectorThumb37DV) {
      const sleepMs = liveHardSleepDelay37DM();
      stats.liveHardSleep = true;
      stats.liveHardSleepMs = sleepMs;
      stats.liveHardSleepSkips += 1;
      publishStats();
      managedThumbTimeout37DH('live-hard-sleep', () => {
        thumbRenderScheduled = false;
        if (thumbRenderQueue.length) schedulePump(sleepMs);
        else publishStats();
      }, sleepMs, { group: 'thumb-queue', managed: false, maxMs: sleepMs });
      return;
    }
    stats.liveHardSleep = false;
    stats.liveHardSleepMs = 0;
    const liveOutput = isLivePerformanceActive();
    const liveReliefMs = liveOutput ? Math.max(260, Number(runtimeProfile.thumbQueueLiveMinGapMs || 420)) : 0;
    const gap = Math.max(delayMs, liveReliefMs, minGapMs - Math.max(0, now - lastPumpAt));
    stats.liveOutputRelief = liveOutput;
    stats.liveMinGapMs = liveReliefMs;

    const scheduleIdle = () => {
      if (windowRef.requestIdleCallback) {
        windowRef.requestIdleCallback(run, { timeout: idleTimeoutMs });
      } else {
        managedThumbTimeout37DH('pump-fallback', () => run({ timeRemaining: () => constrained || isLivePerformanceActive() ? 4 : 8 }), Math.max(16, gap || 16), { liveFactor: 1.4, hiddenFactor: 3, maxMs: 4000 });
      }
    };

    if (gap > 4) managedThumbTimeout37DH('pump-gap', scheduleIdle, gap, { liveFactor: 1.25, hiddenFactor: 3, maxMs: 4000 });
    else scheduleIdle();
  }

  function processThumbRenderQueue(deadline) {
    thumbRenderScheduled = false;
    if (activeRender) {
      schedulePump(minGapMs);
      return;
    }

    const pumpStartedAt = performance.now?.() || Date.now();
    lastPumpAt = pumpStartedAt;
    stats.pumps += 1;
    stats.liveHardSleep = false;

    let processed = 0;
    const runNext = () => {
      const timeLeft = typeof deadline?.timeRemaining === "function" ? deadline.timeRemaining() : (constrained ? 4 : 8);
      if (processed >= maxPerPump || (processed > 0 && timeLeft < (constrained ? 3 : 2))) {
        stats.lastPumpMs = Math.max(0, (performance.now?.() || Date.now()) - pumpStartedAt);
        if (thumbRenderQueue.length) schedulePump(minGapMs);
        publishStats();
        return;
      }

            const forcedIndex37DV = liveHardSleepEnabled37DM()
        ? thumbRenderQueue.findIndex((candidate) => candidate?.forceRuntimeRender === true)
        : -1;
      const task = forcedIndex37DV >= 0
        ? thumbRenderQueue.splice(forcedIndex37DV, 1)[0]
        : thumbRenderQueue.shift();
      if (!task) {
        stats.lastPumpMs = Math.max(0, (performance.now?.() || Date.now()) - pumpStartedAt);
        publishStats();
        return;
      }

      const key = task.key || thumbCacheKey(task);
      if (key) queuedKeys.delete(key);

      if (!task?.canvas || task.sessionId !== getCurrentSessionId()) {
        if (key) thumbRenderStatus.delete(key);
        stats.droppedStale += 1;
        processed += 1;
        runNext();
        return;
      }

      const cached = thumbCache.get(key);
      if (cached) {
        drawThumbFromCache(task.canvas, cached);
        thumbRenderStatus.set(key, "ready");
        stats.cacheHits += 1;
        processed += 1;
        runNext();
        return;
      }

      activeRender = true;
      const renderStartedAt = performance.now?.() || Date.now();
      stats.lastKey = key || "";

      const renderer = task.kind === "anim"
        ? renderAnimationThumb(task.canvas, task.layer, task.file, task.folder, task.sourcePath)
        : renderPaletteThumb(task.canvas, task.file, task.folder, task.sourcePath);

      Promise.resolve(renderer).then(() => {
        const imageData = captureVisibleThumbnail(task.canvas, key);
        if (imageData) {
          thumbCache.set(key, imageData);
          writeThumbToSessionDeferred(key, imageData);
          thumbRenderStatus.set(key, "ready");
        } else {
          thumbRenderStatus.delete(key);
          stats.failed += 1;
        }
        stats.rendered += 1;
      }).catch(() => {
        thumbRenderStatus.delete(key);
        stats.failed += 1;
      }).finally(() => {
        activeRender = false;
        stats.lastRenderMs = Math.max(0, (performance.now?.() || Date.now()) - renderStartedAt);
        processed += 1;
        stats.lastPumpMs = Math.max(0, (performance.now?.() || Date.now()) - pumpStartedAt);
        publishStats();
        if (processed < maxPerPump) runNext();
        else if (thumbRenderQueue.length) schedulePump(minGapMs);
      });
    };

    runNext();
  }

  function drawMissingThumb(canvas, key = "") {
    const context = canvas?.getContext?.("2d");
    if (!context) return;
    const width = canvas.width || 72;
    const height = canvas.height || 40;

    // STEP22MN: never leave picker tiles as black boxes. If runtime thumbnail
    // generation is disabled or the boot cache is empty, draw a deterministic
    // colorful diagnostic placeholder so the operator still sees a visual tile.
    const seed = hashText(key || "thumb-missing");
    const hueA = seed % 360;
    const hueB = (hueA + 135) % 360;
    const gradient = context.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, `hsl(${hueA} 82% 34%)`);
    gradient.addColorStop(0.55, `hsl(${(hueA + 55) % 360} 75% 24%)`);
    gradient.addColorStop(1, `hsl(${hueB} 86% 38%)`);
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
    context.globalAlpha = 0.35;
    context.fillStyle = "#ffffff";
    for (let x = -height; x < width; x += 14) {
      context.fillRect(x + (seed % 11), 0, 4, height);
    }
    context.globalAlpha = 1;
    context.strokeStyle = "rgba(255,255,255,.48)";
    context.strokeRect(0.5, 0.5, width - 1, height - 1);
  }

  function hashText(text) {
    let hash = 2166136261;
    const value = String(text || "");
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  return {
    queueThumbRender,
    processThumbRenderQueue,
    getThumbQueueStats: () => ({ ...stats, queueLength: thumbRenderQueue.length, active: activeRender || thumbRenderScheduled })
  };
}
