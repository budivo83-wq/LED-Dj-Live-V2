// Frame Bus — STEP 13BT-A foundation
//
// Purpose:
//   Keep one authoritative latest composed frame packet for render, preview,
//   output and debug code paths.
//
// 13BT-A is a foundation-only step:
//   - no output routing is changed yet
//   - no preview/serial consumer is rewired yet
//   - adds a public diagnostic API: window.__ledFrameBus
//   - adds consumer read/lag tracking
//   - adds CustomEvent telemetry for future consumers

export const FRAME_BUS_VERSION = "13BT-N-live-stats-event-governor";
export const FRAME_BUS_TRACE_VERSION = "13BT-N-live-stats-event-governor";

const DEFAULT_MAX_LISTENERS = 96;
const CONSUMER_STALE_WARN_MS = 250;
const CONSUMER_STALE_BAD_MS = 1000;
const DEFAULT_STATS_PUBLISH_MS = 200;
const DEFAULT_FRAME_EVENT_MS = 0;

// STEP37AX: stats/event governor. Keep the public globals fresh, but avoid
// pushing diagnostic CustomEvents too often while a physical output lock is
// active. These events wake telemetry/adaptive/debug listeners on the main
// thread and can cause tiny output hitches on weaker Chromium/RPi sessions.
const LIVE_STATS_EVENT_MIN_MS_37AX = 650;
let lastStatsDomEventAt37AX = 0;

function cloneMeta(meta) {
  if (!meta || typeof meta !== "object") return {};
  // STEP37AE: frame meta is produced fresh by frame_authority for each frame.
  // Cloning it again in the 60 FPS publish path creates avoidable object churn.
  // Keep deep-copy semantics only when diagnostics explicitly opt in.
  try {
    if (globalThis.RUNTIME_PROFILE?.frameBusCloneMeta !== true) return meta;
  } catch {}
  const out = {};
  try {
    for (const [key, value] of Object.entries(meta)) {
      if (Array.isArray(value)) out[key] = value.slice();
      else if (value && typeof value === "object") out[key] = { ...value };
      else out[key] = value;
    }
  } catch {
    return { cloneError: true };
  }
  return out;
}

function performanceNowSafe() {
  if (globalThis.performance && typeof globalThis.performance.now === "function") {
    return globalThis.performance.now();
  }
  return Date.now();
}

function cloneFrameIfRequested(frame, cloneFrame) {
  if (!(frame instanceof Uint8Array)) return null;
  return cloneFrame ? new Uint8Array(frame) : frame;
}

function makePacket(input = {}) {
  const frame = input.frame instanceof Uint8Array ? input.frame : null;
  return Object.freeze({
    frameId: Number.isFinite(input.frameId) ? input.frameId : 0,
    timestamp: Number.isFinite(input.timestamp) ? input.timestamp : performanceNowSafe(),
    wallClock: Number.isFinite(input.wallClock) ? input.wallClock : Date.now(),
    stateVersion: Number.isFinite(input.stateVersion) ? input.stateVersion : 0,
    width: Number.isFinite(input.width) ? input.width : 0,
    height: Number.isFinite(input.height) ? input.height : 0,
    frame,
    byteLength: frame?.byteLength || 0,
    renderMs: Number.isFinite(input.renderMs) ? input.renderMs : 0,
    source: typeof input.source === "string" ? input.source : "unknown",
    producer: typeof input.producer === "string" ? input.producer : (typeof input.source === "string" ? input.source : "unknown"),
    colorOrder: typeof input.colorOrder === "string" ? input.colorOrder : "rgb",
    format: typeof input.format === "string" ? input.format : "rgb8",
    meta: cloneMeta(input.meta)
  });
}

function healthFromAge(ageMs) {
  if (!Number.isFinite(ageMs)) return "NO_FRAME";
  if (ageMs > CONSUMER_STALE_BAD_MS) return "STALE";
  if (ageMs > CONSUMER_STALE_WARN_MS) return "WARN";
  return "OK";
}


function isLiveOutputLocked37AX() {
  try {
    const lock = globalThis.__budilightOutputLock37AP;
    if (lock && lock.active === true) return true;
    const mirror = globalThis.__budilightArtNetMasterMirror22EJ;
    if (mirror && (mirror.enabled === true || mirror.lastStatus?.ok === true)) return true;
    const serial = globalThis.__budilightLiveSerialMirror22CR || globalThis.__budilightLiveSerialAppMirror22CR;
    if (serial && (serial.enabled === true || serial.lastStatus?.ok === true)) return true;
  } catch {}
  return false;
}

function shouldDispatchStatsEvent37AX(force = false) {
  if (force) return true;
  if (!isLiveOutputLocked37AX()) return true;
  const now = performanceNowSafe();
  if (now - lastStatsDomEventAt37AX < LIVE_STATS_EVENT_MIN_MS_37AX) return false;
  lastStatsDomEventAt37AX = now;
  return true;
}

function dispatchFrameBusEvent(type, detail) {
  try {
    globalThis.dispatchEvent?.(new CustomEvent(type, { detail }));
  } catch {
    // Browserless tests may not expose CustomEvent.
  }
}

function directConsumersSnapshot() {
  try {
    const list = globalThis.__ledFrameBusDirectConsumers;
    return Array.isArray(list) && list.length ? list : null;
  } catch {
    return null;
  }
}

function publishToDirectConsumers(packet, detail) {
  const list = directConsumersSnapshot();
  if (!list) return 0;
  let delivered = 0;
  for (let i = 0; i < list.length; i += 1) {
    const item = list[i];
    const fn = typeof item === "function" ? item : item && item.handler;
    if (typeof fn !== "function") continue;
    try {
      fn(packet, detail);
      delivered += 1;
    } catch (error) {
      try { console.warn("frame bus direct consumer failed", error); } catch {}
    }
  }
  return delivered;
}

export function createFrameBus(options = {}) {
  const listeners = new Set();
  const consumerStats = new Map();
  let latestPacket = null;
  let latestFrameId = 0;
  let publishCount = 0;
  let duplicateCount = 0;
  let outOfOrderCount = 0;
  let lastPublishAt = 0;
  let lastSource = "none";
  let lastProducer = "none";
  let lastPublishWallClock = 0;
  let totalBytesPublished = 0;
  let maxByteLength = 0;
  let lastPublishError = null;
  const runtimeProfile = globalThis.RUNTIME_PROFILE || {};
  const recorderMaxFrames = Math.max(8, Math.min(600, Number(options.recorderMaxFrames) || Number(globalThis.RUNTIME_PROFILE?.frameRecorderMaxFrames || 180)));
  const recorderSamples = [];
  // Live output smoothness: the recorder used to allocate/freeze one sample for
  // every rendered frame and then shift() the history buffer. That is useful
  // for deep diagnostics, but it creates steady main-thread/GC pressure while
  // ArtNet is trying to run at 60 FPS. Keep it opt-in; stats events remain on.
  let recorderEnabled = options.recorderEnabled === true || runtimeProfile.frameBusRecorderEnabled === true;
  let recorderDropped = 0;
  const maxListeners = Math.max(1, Number(options.maxListeners) || DEFAULT_MAX_LISTENERS);
  const resolveIntervalMs = (primary, secondary, fallback) => {
    const a = Number(primary);
    if (Number.isFinite(a)) return Math.max(0, a);
    const b = Number(secondary);
    if (Number.isFinite(b)) return Math.max(0, b);
    return Math.max(0, Number(fallback) || 0);
  };
  const statsPublishIntervalMs = resolveIntervalMs(options.statsPublishIntervalMs, runtimeProfile.frameBusStatsMs, DEFAULT_STATS_PUBLISH_MS);
  // STEP13BT-K / STEP22 output smoothness fix:
  // This event is the live Performance -> ArtNet master mirror trigger.
  // A 50 ms throttle here hard-capped real LED output to ~20 FPS while the UI
  // render counters still showed 50-60 FPS. Default must be 0 = every accepted
  // authoritative frame; diagnostics stats remain throttled separately above.
  const frameEventIntervalMs = resolveIntervalMs(options.frameEventIntervalMs, runtimeProfile.frameBusPublishEventMs, DEFAULT_FRAME_EVENT_MS);
  let lastStatsPublishAt = 0;
  let lastFrameEventAt = 0;

  function updateConsumerStats(name, packet, extra = {}) {
    const consumer = String(name || "unknown-consumer");
    const now = performanceNowSafe();
    const ageMs = packet ? Math.max(0, now - Number(packet.timestamp || now)) : 0;
    const previous = consumerStats.get(consumer) || {
      consumer,
      reads: 0,
      lastFrameId: 0,
      skippedFrames: 0,
      duplicateReads: 0,
      maxAgeMs: 0,
      lastReadAt: 0,
      lastAgeMs: 0,
      lastSource: "none",
      lastReason: "init",
      health: "NO_FRAME"
    };

    const frameId = Number(packet?.frameId || 0);
    if (frameId && previous.lastFrameId) {
      if (frameId === previous.lastFrameId) previous.duplicateReads += 1;
      if (frameId > previous.lastFrameId + 1) previous.skippedFrames += frameId - previous.lastFrameId - 1;
    }

    const next = {
      ...previous,
      ...extra,
      consumer,
      reads: previous.reads + 1,
      lastFrameId: frameId || previous.lastFrameId,
      lastReadAt: now,
      lastAgeMs: Math.round(ageMs),
      maxAgeMs: Math.max(Number(previous.maxAgeMs || 0), Math.round(ageMs)),
      lastSource: packet?.source || previous.lastSource || "none",
      lastReason: extra.reason || previous.lastReason || "read",
      health: healthFromAge(ageMs)
    };

    consumerStats.set(consumer, next);
    return Object.freeze({ ...next });
  }

  function makeRecorderSample(packet) {
    const now = performanceNowSafe();
    return Object.freeze({
      frameId: Number(packet?.frameId || 0),
      timestamp: Number(packet?.timestamp || 0),
      ageMs: packet?.timestamp ? Math.max(0, Math.round(now - Number(packet.timestamp))) : 0,
      wallClock: Number(packet?.wallClock || Date.now()),
      width: Number(packet?.width || 0),
      height: Number(packet?.height || 0),
      byteLength: Number(packet?.byteLength || 0),
      renderMs: Number(packet?.renderMs || 0),
      source: String(packet?.source || "unknown"),
      producer: String(packet?.producer || packet?.source || "unknown"),
      previewMode: String(packet?.meta?.previewMode || "unknown"),
      outputMode: String(packet?.meta?.outputMode || "unknown"),
      outputEnabled: Boolean(packet?.meta?.outputEnabled),
      serialPipelineEnabled: Boolean(packet?.meta?.serialPipelineEnabled),
      documentHidden: Boolean(packet?.meta?.documentHidden),
      beat: packet?.meta?.beat ?? null
    });
  }

  function recordPacket(packet) {
    if (!recorderEnabled || !packet) return;
    recorderSamples.push(makeRecorderSample(packet));
    while (recorderSamples.length > recorderMaxFrames) {
      recorderSamples.shift();
      recorderDropped += 1;
    }
  }

  function getRecorderSnapshot(options = {}) {
    const limit = Math.max(1, Math.min(recorderMaxFrames, Number(options.limit || recorderSamples.length || recorderMaxFrames)));
    const samples = recorderSamples.slice(-limit).map((item) => ({ ...item }));
    const first = samples[0] || null;
    const last = samples[samples.length - 1] || null;
    const durationMs = first && last ? Math.max(0, Number(last.timestamp || 0) - Number(first.timestamp || 0)) : 0;
    return Object.freeze({
      version: FRAME_BUS_VERSION,
      enabled: recorderEnabled,
      maxFrames: recorderMaxFrames,
      count: recorderSamples.length,
      returned: samples.length,
      dropped: recorderDropped,
      firstFrameId: Number(first?.frameId || 0),
      lastFrameId: Number(last?.frameId || 0),
      durationMs: Math.round(durationMs),
      approxFps: durationMs > 0 && samples.length > 1 ? Number(((samples.length - 1) * 1000 / durationMs).toFixed(2)) : 0,
      samples
    });
  }

  function clearRecorder() {
    recorderSamples.length = 0;
    recorderDropped = 0;
    publishFrameStatsToGlobal(true);
  }

  function setRecorderEnabled(enabled) {
    recorderEnabled = enabled !== false;
    publishFrameStatsToGlobal(true);
    return recorderEnabled;
  }

  function publishFrame(input = {}) {
    try {
      const requestedFrameId = Number.isFinite(input.frameId) ? input.frameId : latestFrameId + 1;
      if (requestedFrameId < latestFrameId) outOfOrderCount += 1;
      if (requestedFrameId === latestFrameId) duplicateCount += 1;

      const nextFrameId = Math.max(latestFrameId + 1, requestedFrameId);
      latestFrameId = nextFrameId;
      latestPacket = makePacket({
        frameId: nextFrameId,
        frame: input.frame,
        timestamp: input.timestamp,
        wallClock: input.wallClock,
        stateVersion: input.stateVersion,
        width: input.width,
        height: input.height,
        renderMs: input.renderMs,
        source: input.source,
        producer: input.producer,
        colorOrder: input.colorOrder,
        format: input.format,
        meta: input.meta
      });
      publishCount += 1;
      lastPublishAt = latestPacket.timestamp;
      lastPublishWallClock = latestPacket.wallClock;
      lastSource = latestPacket.source;
      lastProducer = latestPacket.producer;
      totalBytesPublished += latestPacket.byteLength;
      maxByteLength = Math.max(maxByteLength, latestPacket.byteLength);
      lastPublishError = null;
      recordPacket(latestPacket);

      maybeDispatchFrameEvent(latestPacket);

      // STEP37AE: iterate the Set directly. Creating [...listeners] on every
      // authoritative frame was a tiny but steady allocation in the render/output
      // hot path. Set iteration tolerates unsubscribe during dispatch.
      for (const listener of listeners) {
        try {
          listener(latestPacket);
        } catch (error) {
          lastPublishError = error?.message || String(error);
          console.warn("frame bus listener failed", error);
        }
      }

      publishFrameStatsToGlobal();
      return latestPacket;
    } catch (error) {
      lastPublishError = error?.message || String(error);
      throw error;
    }
  }

  function getLatestFrame(optionsOrConsumer = {}) {
    let consumer = null;
    let cloneFrame = false;
    let reason = "getLatestFrame";

    if (typeof optionsOrConsumer === "string") {
      consumer = optionsOrConsumer;
    } else if (optionsOrConsumer && typeof optionsOrConsumer === "object") {
      consumer = optionsOrConsumer.consumer || null;
      cloneFrame = optionsOrConsumer.cloneFrame === true;
      reason = optionsOrConsumer.reason || reason;
    }

    if (consumer) updateConsumerStats(consumer, latestPacket, { reason });

    if (!latestPacket || !cloneFrame) return latestPacket;
    return Object.freeze({
      ...latestPacket,
      frame: cloneFrameIfRequested(latestPacket.frame, true),
      meta: cloneMeta(latestPacket.meta)
    });
  }

  function peekLatestFrame() {
    return latestPacket;
  }

  function getLatestFrameId() {
    return latestFrameId;
  }

  function hasFrame() {
    return latestPacket !== null;
  }

  function subscribe(listener, options = {}) {
    if (typeof listener !== "function") {
      throw new TypeError("frame_bus.subscribe(listener) expects a function");
    }
    if (listeners.size >= maxListeners) {
      throw new Error(`frame_bus listener limit reached (${maxListeners})`);
    }
    const consumer = typeof options.consumer === "string" ? options.consumer : null;
    const wrapped = consumer
      ? (packet) => {
          updateConsumerStats(consumer, packet, { reason: "subscribe" });
          listener(packet);
        }
      : listener;

    listeners.add(wrapped);
    publishFrameStatsToGlobal(true);
    return () => {
      listeners.delete(wrapped);
      publishFrameStatsToGlobal(true);
    };
  }

  function markConsumerRead(consumer, options = {}) {
    return updateConsumerStats(consumer, latestPacket, {
      reason: options.reason || "manual",
      detail: options.detail || undefined
    });
  }

  function getConsumerStats(consumer = null) {
    if (consumer) return Object.freeze({ ...(consumerStats.get(String(consumer)) || { consumer: String(consumer), reads: 0, health: "NO_FRAME" }) });
    return Object.freeze(Array.from(consumerStats.values()).map((item) => ({ ...item })));
  }

  function clearConsumers() {
    consumerStats.clear();
    publishFrameStatsToGlobal(true);
  }

  function clear() {
    latestPacket = null;
    latestFrameId = 0;
    publishCount = 0;
    duplicateCount = 0;
    outOfOrderCount = 0;
    lastPublishAt = 0;
    lastPublishWallClock = 0;
    lastSource = "none";
    lastProducer = "none";
    totalBytesPublished = 0;
    maxByteLength = 0;
    lastPublishError = null;
    listeners.clear();
    consumerStats.clear();
    publishFrameStatsToGlobal(true);
  }

  function evaluateHealthGates(consumers, lastFrameAgeMs) {
    const warnings = [];
    const errors = [];
    const now = performanceNowSafe();
    const activeConsumers = (consumers || []).filter((item) => {
      const lastReadAt = Number(item?.lastReadAt || 0);
      // STEP22NZ: many UI/debug consumers are one-shot readers. If they read once
      // and then stop, their age should not poison the health gate forever. Keep
      // only consumers that have read in the recent diagnostic window.
      return lastReadAt > 0 && now - lastReadAt <= 2500;
    });

    if (!latestPacket) {
      // STEP37AC: in the shell/output-runner architecture the visible UI
      // frame bus can be intentionally idle while the hidden runner owns
      // hardware output. Do not report a hard ERROR when nobody is actively
      // consuming this diagnostic bus; show NO_FRAME/IDLE instead.
      if (listeners.size > 0 || activeConsumers.length > 0) errors.push("NO_FRAME");
    } else if (lastFrameAgeMs > 1500) {
      errors.push(`FRAME_STALE_${Math.round(lastFrameAgeMs)}MS`);
    } else if (lastFrameAgeMs > 350) {
      warnings.push(`FRAME_WARN_${Math.round(lastFrameAgeMs)}MS`);
    }

    for (const item of activeConsumers) {
      const name = String(item.consumer || "unknown");
      const age = Number(item.lastAgeMs || 0);
      const health = String(item.health || "").toUpperCase();
      if (health === "STALE" || age > 1500) {
        errors.push(`${name.toUpperCase()}_STALE_${Math.round(age)}MS`);
      } else if (health === "WARN" || age > 350) {
        warnings.push(`${name.toUpperCase()}_WARN_${Math.round(age)}MS`);
      }
      if (Number(item.skippedFrames || 0) > 30) {
        warnings.push(`${name.toUpperCase()}_SKIPS_${Math.round(Number(item.skippedFrames || 0))}`);
      }
    }

    if (lastPublishError) errors.push(`PUBLISH_ERROR_${String(lastPublishError).slice(0, 80)}`);
    if (outOfOrderCount > 0) warnings.push(`OUT_OF_ORDER_${outOfOrderCount}`);
    if (duplicateCount > 5) warnings.push(`DUPLICATE_PUBLISH_${duplicateCount}`);

    const status = errors.length ? "ERROR" : warnings.length ? "WARN" : latestPacket ? "OK" : "NO_FRAME";
    return Object.freeze({
      status,
      ok: status === "OK",
      warnings,
      errors,
      warningCount: warnings.length,
      errorCount: errors.length
    });
  }

  function getStats() {
    const now = performanceNowSafe();
    const lastFrameAgeMs = latestPacket ? Math.max(0, Math.round(now - latestPacket.timestamp)) : 0;
    const consumers = Array.from(consumerStats.values()).map((item) => ({ ...item }));
    let slowestConsumer = null;
    for (let i = 0; i < consumers.length; i += 1) {
      const item = consumers[i];
      if (!slowestConsumer || Number(item.lastAgeMs || 0) > Number(slowestConsumer.lastAgeMs || 0)) slowestConsumer = item;
    }
    const gates = evaluateHealthGates(consumers, lastFrameAgeMs);

    return Object.freeze({
      version: FRAME_BUS_VERSION,
      traceVersion: FRAME_BUS_TRACE_VERSION,
      hasFrame: hasFrame(),
      latestFrameId,
      listenerCount: listeners.size,
      consumerCount: consumerStats.size,
      byteLength: latestPacket?.byteLength || 0,
      width: latestPacket?.width || 0,
      height: latestPacket?.height || 0,
      format: latestPacket?.format || "rgb8",
      colorOrder: latestPacket?.colorOrder || "rgb",
      publishCount,
      duplicateCount,
      outOfOrderCount,
      lastPublishAt,
      lastPublishWallClock,
      lastSource,
      lastProducer,
      lastPublishError,
      totalBytesPublished,
      maxByteLength,
      avgBytesPerFrame: publishCount ? Math.round(totalBytesPublished / publishCount) : 0,
      recorder: {
        enabled: recorderEnabled,
        count: recorderSamples.length,
        maxFrames: recorderMaxFrames,
        dropped: recorderDropped,
        firstFrameId: Number(recorderSamples[0]?.frameId || 0),
        lastFrameId: Number(recorderSamples[recorderSamples.length - 1]?.frameId || 0)
      },
      lastFrameAgeMs,
      health: gates.status === "ERROR" ? "ERROR" : (latestPacket ? healthFromAge(lastFrameAgeMs) : "NO_FRAME"),
      gates,
      slowestConsumer,
      consumers
    });
  }

  function maybeDispatchFrameEvent(packet) {
    const now = performanceNowSafe();
    if (frameEventIntervalMs > 0 && now - lastFrameEventAt < frameEventIntervalMs) return;
    lastFrameEventAt = now;
    const detail = {
      frameId: packet.frameId,
      timestamp: packet.timestamp,
      wallClock: packet.wallClock,
      width: packet.width,
      height: packet.height,
      byteLength: packet.byteLength,
      renderMs: packet.renderMs,
      source: packet.source,
      producer: packet.producer,
      publishCount,
      packet
    };
    const directDelivered = publishToDirectConsumers(packet, detail);
    // STEP37AO: ArtNet/Serial mirrors register direct consumers, which avoids a
    // 60 FPS CustomEvent allocation/dispatch on the main thread. Keep the old
    // event as a compatibility fallback when no direct live consumer is present
    // or when diagnostics explicitly opt back into legacy frame events.
    if (directDelivered > 0 && globalThis.__ledFrameBusPreferDirectPublish !== false) return;
    dispatchFrameBusEvent("led-framebus-publish", detail);
  }

  function publishFrameStatsToGlobal(force = false) {
    try {
      const now = performanceNowSafe();
      if (!force && statsPublishIntervalMs > 0 && now - lastStatsPublishAt < statsPublishIntervalMs) return;
      lastStatsPublishAt = now;
      const stats = getStats();
      globalThis.__ledFrameBusStats = stats;
      if (shouldDispatchStatsEvent37AX(force)) {
        dispatchFrameBusEvent("led-framebus-stats", stats);
      }
      try {
        globalThis.__ledFrameBusStatsEventGovernor37AX = {
          version: "STEP37AX_STATS_EVENT_GOVERNOR",
          live: isLiveOutputLocked37AX(),
          minIntervalMs: isLiveOutputLocked37AX() ? LIVE_STATS_EVENT_MIN_MS_37AX : 0,
          lastDomEventAt: lastStatsDomEventAt37AX,
          updatedAt: performanceNowSafe()
        };
      } catch {}
    } catch {
      // ignore diagnostics only
    }
  }

  const api = Object.freeze({
    version: FRAME_BUS_VERSION,
    publishFrame,
    getLatestFrame,
    peekLatestFrame,
    getLatestFrameId,
    hasFrame,
    subscribe,
    markConsumerRead,
    getConsumerStats,
    clearConsumers,
    getRecorderSnapshot,
    clearRecorder,
    setRecorderEnabled,
    clear,
    getStats
  });

  return api;
}

const runtimeFrameBus = createFrameBus();

export function getRuntimeFrameBus() {
  try {
    globalThis.__ledFrameBus = runtimeFrameBus;
    globalThis.__ledFrameBusStats = runtimeFrameBus.getStats();
  } catch {
    // diagnostics only
  }
  return runtimeFrameBus;
}

try {
  globalThis.__ledFrameBus = runtimeFrameBus;
  globalThis.__ledFrameBusStats = runtimeFrameBus.getStats();
} catch {
  // diagnostics only
}
