export function createOutputPipeline(deps) {
  const {
    getNow,
    isEnabled,
    getTargetFps,
    getPauseUntil,
    setPauseUntil,
    sendFrame,
    onMetrics
  } = deps;

  let queuedFrame = null;
  let queuedMeta = null;
  let queuedAt = 0;
  let timerId = 0;
  let schedulerActive = false;
  let nextWakeAt = 0;
  let sending = false;
  let nextAt = 0;
  let overloadCount = 0;
  let lastWindowAt = 0;
  let windowSent = 0;
  let windowDropped = 0;
  let lastSentFps = 0;
  let lastDroppedFps = 0;
  let windowLate = 0;
  let lastLateFps = 0;
  let lastPublishedAt = 0;
  let lastPublishedSent = 0;
  let lastPublishedDropped = 0;
  let lastPublishedHealth = "";
  let lastPublishedPressure = "";
  let lastPublishedError = "";
  let lastPublishedLateFrames = 0;
  const publishIntervalMs = Math.max(
    120,
    Number(globalThis?.RUNTIME_PROFILE?.outputPipelineStatsMs || 250)
  );

  const metrics = {
    version: "37BV-monotonic-scheduler",
    sent: 0,
    dropped: 0,
    replacedPending: 0,
    droppedDisabled: 0,
    droppedError: 0,
    lastLatencyMs: 0,
    lastSendMs: 0,
    maxSendMs: 0,
    maxLatencyMs: 0,
    avgSendMs: 0,
    avgLatencyMs: 0,
    pausedMs: 0,
    queueDepth: 0,
    sending: false,
    timerArmed: false,
    schedulerActive: false,
    schedulerDelayMs: 0,
    overloadCount: 0,
    targetFps: 0,
    intervalMs: 0,
    nextInMs: 0,
    pauseRemainingMs: 0,
    lastError: null,
    sentFps: 0,
    droppedFps: 0,
    lateFrames: 0,
    lateFps: 0,
    lateByMs: 0,
    maxLateByMs: 0,
    avgLateByMs: 0,
    sourceFrameId: 0,
    sourceFrameSource: "--",
    sourceFrameAgeMs: 0,
    renderToOutputMs: 0,
    queueWaitMs: 0,
    serialDispatchMs: 0,
    estimatedEndToEndMs: 0,
    windowDropped: 0,
    windowLate: 0,
    windowDropRatio: 0,
    frameDropCounterVersion: "13BU-Z-frame-drop-counter",
    health: "IDLE",
    pressure: "LOW"
  };

  function snapshotMetrics() {
    updateLiveMetrics();
    return { ...metrics };
  }

  let sendSamples = 0;
  let latencySamples = 0;
  let lateSamples = 0;

  function updateRollingAverage(currentAvg, count, value) {
    const nextCount = Math.max(1, count + 1);
    return currentAvg + (value - currentAvg) / nextCount;
  }

  function updateWindowRates() {
    const now = getNow();
    if (!lastWindowAt) {
      lastWindowAt = now;
      return;
    }
    const elapsed = Math.max(1, now - lastWindowAt);
    if (elapsed < 750) return;
    lastSentFps = windowSent * 1000 / elapsed;
    lastDroppedFps = windowDropped * 1000 / elapsed;
    lastLateFps = windowLate * 1000 / elapsed;
    metrics.windowDropped = windowDropped;
    metrics.windowLate = windowLate;
    const totalWindow = Math.max(1, windowSent + windowDropped);
    metrics.windowDropRatio = Number((windowDropped / totalWindow).toFixed(4));
    windowSent = 0;
    windowDropped = 0;
    windowLate = 0;
    lastWindowAt = now;
  }

  function updateLiveMetrics() {
    const now = getNow();
    const targetFps = Math.max(1, Number(getTargetFps?.() || 30));
    const interval = 1000 / targetFps;
    metrics.queueDepth = queuedFrame ? 1 : 0;
    metrics.sending = Boolean(sending);
    metrics.timerArmed = Boolean(timerId);
    metrics.schedulerActive = Boolean(schedulerActive);
    metrics.schedulerDelayMs = Number(Math.max(0, nextWakeAt - now).toFixed(2));
    metrics.overloadCount = overloadCount;
    metrics.targetFps = targetFps;
    metrics.intervalMs = Number(interval.toFixed(2));
    metrics.nextInMs = Math.max(0, Math.round(nextAt - now));
    metrics.pauseRemainingMs = Math.max(0, Math.round(Number(getPauseUntil?.() || 0) - now));
    metrics.sentFps = Number(lastSentFps.toFixed(2));
    metrics.droppedFps = Number(lastDroppedFps.toFixed(2));
    metrics.lateFps = Number(lastLateFps.toFixed(2));

    const late = metrics.nextInMs === 0 && metrics.queueDepth > 0 && sending;
    if (!isEnabled()) metrics.health = "OFF";
    else if (metrics.lastError) metrics.health = "ERROR";
    else if (overloadCount >= 3 || metrics.pausedMs > 0 || metrics.droppedFps > 3) metrics.health = "PRESSURE";
    else if (metrics.sent > 0 || metrics.queueDepth > 0) metrics.health = late ? "BUSY" : "OK";
    else metrics.health = "IDLE";

    if (metrics.droppedFps > targetFps * 0.5 || overloadCount >= 5) metrics.pressure = "HIGH";
    else if (metrics.droppedFps > 0 || overloadCount >= 2 || metrics.queueDepth > 0 && sending) metrics.pressure = "MED";
    else metrics.pressure = "LOW";

    try {
      window.__ledOutputPipelineStats = { ...metrics };
    } catch {}
  }

  // STEP37AX: metrics events wake adaptive/debug listeners. Keep globals and
  // callback current, but slow CustomEvent while live output owns the frame path.
  const LIVE_METRICS_EVENT_MIN_MS_37AX = 700;
  let lastLiveMetricsEventAt37AX = 0;
  function isLiveOutputLocked37AX() {
    try {
      const lock = window.__budilightOutputLock37AP;
      if (lock?.active === true) return true;
      const mirror = window.__budilightArtNetMasterMirror22EJ;
      if (mirror?.enabled === true || mirror?.lastStatus?.ok === true) return true;
      const serial = window.__budilightLiveSerialMirror22CR || window.__budilightLiveSerialAppMirror22CR;
      if (serial?.enabled === true || serial?.lastStatus?.ok === true) return true;
    } catch {}
    return false;
  }
  function shouldEmitMetricsDomEvent37AX(force = false) {
    if (force) return true;
    if (!isLiveOutputLocked37AX()) return true;
    const now = getNow();
    if (now - lastLiveMetricsEventAt37AX < LIVE_METRICS_EVENT_MIN_MS_37AX) return false;
    lastLiveMetricsEventAt37AX = now;
    try {
      window.__budilightOutputMetricsEventGovernor37AX = {
        version: "STEP37AX_OUTPUT_METRICS_EVENT_GOVERNOR",
        live: true,
        minIntervalMs: LIVE_METRICS_EVENT_MIN_MS_37AX,
        lastEventAt: lastLiveMetricsEventAt37AX,
        updatedAt: now
      };
    } catch {}
    return true;
  }

  function emitMetrics(options = {}) {
    updateWindowRates();
    const snapshot = snapshotMetrics();
    const now = getNow();
    snapshot.sentDelta = Math.max(0, Number(snapshot.sent || 0) - lastPublishedSent);
    snapshot.droppedDelta = Math.max(0, Number(snapshot.dropped || 0) - lastPublishedDropped);
    const important = options.force === true
      || snapshot.droppedDelta > 0
      || Number(snapshot.lateFrames || 0) > lastPublishedLateFrames
      || String(snapshot.health || "") !== lastPublishedHealth
      || String(snapshot.pressure || "") !== lastPublishedPressure
      || String(snapshot.lastError || "") !== lastPublishedError;
    if (!important && now - lastPublishedAt < publishIntervalMs) return snapshot;
    lastPublishedAt = now;
    lastPublishedSent = Number(snapshot.sent || 0);
    lastPublishedDropped = Number(snapshot.dropped || 0);
    lastPublishedHealth = String(snapshot.health || "");
    lastPublishedPressure = String(snapshot.pressure || "");
    lastPublishedError = String(snapshot.lastError || "");
    lastPublishedLateFrames = Number(snapshot.lateFrames || 0);
    if (shouldEmitMetricsDomEvent37AX(options.force === true || important === true)) {
      try {
        window.dispatchEvent?.(new CustomEvent("led-output-pipeline-stats", { detail: snapshot }));
      } catch {}
    }
    onMetrics?.(snapshot);
    return snapshot;
  }

  function enqueue(frame) {
    const packet = frame instanceof Uint8Array
      ? { frame }
      : (frame && frame.frame instanceof Uint8Array ? frame : null);
    if (!packet?.frame?.length) return;
    if (!isEnabled()) {
      metrics.dropped += 1;
      metrics.droppedDisabled += 1;
      windowDropped += 1;
      emitMetrics({ force: true });
      return;
    }

    // Single-slot latest-frame queue: keep newest, drop previous pending frame.
    if (queuedFrame) {
      metrics.dropped += 1;
      metrics.replacedPending += 1;
      windowDropped += 1;
    }
    // Authoritative frame packets already own an immutable Uint8Array. Keep a
    // direct reference in that hot path and clone only bare byte arrays.
    queuedFrame = frame instanceof Uint8Array ? new Uint8Array(packet.frame) : packet.frame;
    queuedMeta = {
      frameId: Number(packet.frameId || 0),
      source: String(packet.source || "--"),
      timestamp: Number(packet.timestamp || 0),
      enqueuedAt: getNow()
    };
    queuedAt = queuedMeta.enqueuedAt;
    arm();
  }

  function intervalMs() {
    const fps = Math.max(1, Number(getTargetFps?.() || 30));
    return 1000 / fps;
  }

  function computeWakeDelay(now = getNow()) {
    const waitByFps = Math.max(0, nextAt - now);
    const waitByPause = Math.max(0, Number(getPauseUntil?.() || 0) - now);
    return Math.max(waitByFps, waitByPause);
  }

  // STEP37BV: single monotonic scheduler. The previous implementation armed a
  // fresh timeout from several hot-path locations and also emitted debug metrics
  // while arming. On slower Chromium/RPi builds this created small but visible
  // timing jitter. Keep exactly one scheduler alive while there is work/pause,
  // recompute wake time against performance.now(), and publish metrics only from
  // the normal throttled metrics path.
  function arm() {
    if (schedulerActive || timerId || sending) return;
    schedulerActive = true;
    scheduleNextWake();
  }

  function scheduleNextWake() {
    if (!schedulerActive) return;
    if (timerId) {
      window.clearTimeout(timerId);
      timerId = 0;
    }
    const now = getNow();
    const wait = computeWakeDelay(now);
    nextWakeAt = now + wait;
    timerId = window.setTimeout(onSchedulerWake, Math.max(0, Math.round(wait)));
  }

  function onSchedulerWake() {
    timerId = 0;
    const hadWork = Boolean(queuedFrame);
    drain();
    const now = getNow();
    const pauseRemaining = Math.max(0, Number(getPauseUntil?.() || 0) - now);
    if (queuedFrame || pauseRemaining > 0 || sending) {
      scheduleNextWake();
      return;
    }
    schedulerActive = false;
    nextWakeAt = 0;
    if (hadWork) emitMetrics();
  }

  function drain() {
    if (sending) return;
    if (!queuedFrame) {
      return;
    }
    if (!isEnabled()) {
      queuedFrame = null;
      metrics.dropped += 1;
      metrics.droppedDisabled += 1;
      windowDropped += 1;
      emitMetrics({ force: true });
      return;
    }

    const now = getNow();
    if (now < nextAt || now < Number(getPauseUntil?.() || 0)) {
      if (schedulerActive) scheduleNextWake();
      else arm();
      return;
    }

    sending = true;
    updateLiveMetrics();
    const frame = queuedFrame;
    const frameMeta = queuedMeta || null;
    const enqueuedAt = queuedAt;
    queuedFrame = null;
    queuedMeta = null;
    queuedAt = 0;

    const startedAt = getNow();
    try {
      sendFrame(frame);
      const finishedAt = getNow();
      const sendMs = Math.max(0, finishedAt - startedAt);
      const latencyMs = Math.max(0, finishedAt - enqueuedAt);
      const budget = intervalMs();
      const lateByMs = Math.max(0, finishedAt - (nextAt || finishedAt));
      metrics.sent += 1;
      windowSent += 1;
      sendSamples += 1;
      latencySamples += 1;
      metrics.lastSendMs = Number(sendMs.toFixed(2));
      metrics.lastLatencyMs = Number(latencyMs.toFixed(2));
      metrics.queueWaitMs = Number(Math.max(0, startedAt - enqueuedAt).toFixed(2));
      metrics.serialDispatchMs = Number(sendMs.toFixed(2));
      metrics.sourceFrameId = Number(frameMeta?.frameId || 0);
      metrics.sourceFrameSource = String(frameMeta?.source || "--");
      const sourceAgeMs = frameMeta?.timestamp ? Math.max(0, finishedAt - Number(frameMeta.timestamp)) : 0;
      metrics.sourceFrameAgeMs = Number(sourceAgeMs.toFixed(2));
      metrics.renderToOutputMs = Number(sourceAgeMs.toFixed(2));
      metrics.estimatedEndToEndMs = Number((sourceAgeMs + sendMs).toFixed(2));
      metrics.lateByMs = Number(lateByMs.toFixed(2));
      metrics.maxSendMs = Math.max(metrics.maxSendMs, metrics.lastSendMs);
      metrics.maxLatencyMs = Math.max(metrics.maxLatencyMs, metrics.lastLatencyMs);
      metrics.avgSendMs = Number(updateRollingAverage(metrics.avgSendMs, sendSamples - 1, sendMs).toFixed(2));
      metrics.avgLatencyMs = Number(updateRollingAverage(metrics.avgLatencyMs, latencySamples - 1, latencyMs).toFixed(2));
      if (lateByMs > budget * 0.5) {
        metrics.lateFrames += 1;
        windowLate += 1;
        lateSamples += 1;
        metrics.maxLateByMs = Math.max(metrics.maxLateByMs, metrics.lateByMs);
        metrics.avgLateByMs = Number(updateRollingAverage(metrics.avgLateByMs, lateSamples - 1, lateByMs).toFixed(2));
      }
      metrics.lastError = null;

      if (sendMs > budget * 1.1) {
        overloadCount = Math.min(8, overloadCount + 1);
      } else {
        overloadCount = Math.max(0, overloadCount - 1);
      }
      if (overloadCount >= 3) {
        const pauseMs = Math.min(300, Math.round(intervalMs() * overloadCount));
        const until = finishedAt + pauseMs;
        setPauseUntil?.(until);
        metrics.pausedMs = pauseMs;
      } else {
        metrics.pausedMs = 0;
      }

      nextAt = finishedAt + budget;
    } catch (error) {
      metrics.dropped += 1;
      metrics.droppedError += 1;
      windowDropped += 1;
      metrics.lastError = error?.message || String(error || "send failed");
      const until = getNow() + 120;
      setPauseUntil?.(until);
      nextAt = until;
    } finally {
      sending = false;
      // STEP37AC: do not emit output-pipeline DOM/debug metrics on every sent frame.
      // Drops/errors/health changes still bypass the interval via the important gate.
      emitMetrics();
      if (queuedFrame) {
        if (schedulerActive) scheduleNextWake();
        else arm();
      }
    }
  }

  function flush() {
    if (timerId) {
      window.clearTimeout(timerId);
      timerId = 0;
    }
    schedulerActive = false;
    nextWakeAt = 0;
    drain();
  }

  return {
    enqueue,
    flush,
    getMetrics: snapshotMetrics
  };
}
