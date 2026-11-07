import { createTelemetryHistory } from "./telemetry_history.js";

const DEFAULT_MAX_EVENTS = 240;
const DEFAULT_SAMPLE_LIMIT = 120;
const DEFAULT_HISTORY_LIMIT = 360;

function nowMs(performanceRef) {
  if (performanceRef?.now) return performanceRef.now();
  return Date.now();
}

function roundNumber(value, decimals = 3) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  const factor = 10 ** decimals;
  return Math.round(number * factor) / factor;
}

function clonePlain(value) {
  if (!value || typeof value !== "object") return value;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return { unavailable: true };
  }
}

function createMetricBucket() {
  return {
    count: 0,
    sum: 0,
    max: 0,
    last: 0
  };
}

function pushRing(buffer, value, limit) {
  buffer.push(value);
  while (buffer.length > limit) buffer.shift();
}

export function createTelemetryBus(options = {}) {
  const {
    performanceRef = globalThis.performance,
    windowRef = typeof window !== "undefined" ? window : null,
    maxEvents = DEFAULT_MAX_EVENTS,
    sampleLimit = DEFAULT_SAMPLE_LIMIT,
    historyLimit = DEFAULT_HISTORY_LIMIT,
    dispatchDomEvents = true
  } = options;

  const startedAt = nowMs(performanceRef);
  const listeners = new Set();
  const events = [];
  const samples = [];
  const history = createTelemetryHistory({ performanceRef, limit: historyLimit });
  const counters = new Map();
  const buckets = new Map();
  let lastEvent = null;
  let lastSnapshot = null;
  let lastOutputSent = 0;
  let lastOutputDropped = 0;

  function metricDelta(current, previous) {
    const cur = Number(current || 0);
    const prev = Number(previous || 0);
    if (!Number.isFinite(cur)) return 0;
    if (!Number.isFinite(prev)) return Math.max(0, cur);
    // If the source counter reset after reload/reconnect, treat current as the first delta.
    if (cur < prev) return Math.max(0, cur);
    return Math.max(0, cur - prev);
  }

  function counter(name, delta = 1) {
    const key = String(name || "unknown");
    const next = Number(counters.get(key) || 0) + Number(delta || 0);
    counters.set(key, next);
    return next;
  }

  function observe(name, value) {
    const key = String(name || "unknown");
    const number = Math.max(0, Number(value || 0));
    const bucket = buckets.get(key) || createMetricBucket();
    bucket.count += 1;
    bucket.sum += number;
    bucket.max = Math.max(bucket.max, number);
    bucket.last = number;
    buckets.set(key, bucket);
    return { ...bucket };
  }

  function emit(type, detail = {}) {
    const timestamp = nowMs(performanceRef);
    const event = {
      type: String(type || "event"),
      timestamp,
      sinceStartMs: Math.max(0, timestamp - startedAt),
      detail: clonePlain(detail)
    };
    lastEvent = event;
    pushRing(events, event, maxEvents);
    counter(`event.${event.type}`, 1);
    for (const listener of listeners) {
      try {
        listener(event);
      } catch (error) {
        console.warn("telemetry listener error", error);
      }
    }
    if (dispatchDomEvents && windowRef?.dispatchEvent && typeof CustomEvent !== "undefined") {
      try {
        windowRef.dispatchEvent(new CustomEvent("led-telemetry", { detail: event }));
      } catch {
        // CustomEvent can be unavailable in some test contexts.
      }
    }
    return event;
  }

  function recordRenderMetric(metric = {}) {
    const renderMs = Number(metric.renderMs || 0);
    const previewDrawMs = Number(metric.previewDrawMs || 0);
    const lateByMs = Number(metric.lateByMs || 0);
    observe("render.ms", renderMs);
    observe("preview.drawMs", previewDrawMs);
    observe("render.lateMs", lateByMs);
    if (Number(metric.skipped || 0) > 0) counter("render.skipped", Number(metric.skipped || 0));
    const sample = {
      kind: "render",
      timestamp: nowMs(performanceRef),
      renderMs: roundNumber(renderMs),
      previewDrawMs: roundNumber(previewDrawMs),
      lateByMs: roundNumber(lateByMs),
      skipped: Number(metric.skipped || 0),
      frameId: Number(metric.latestFrameId || metric.frameId || 0),
      frameBus: clonePlain(metric.frameBus || null),
      frameAuthority: clonePlain(metric.frameAuthority || null)
    };
    pushRing(samples, sample, sampleLimit);
    history.record("render", sample);
    return emit("render", metric);
  }

  function recordOutputMetric(metric = {}) {
    const lastLatencyMs = Number(metric.lastLatencyMs || 0);
    const lastSendMs = Number(metric.lastSendMs || 0);
    const sentTotal = Number(metric.sent || 0);
    const droppedTotal = Number(metric.dropped || 0);
    const sentDelta = Number.isFinite(Number(metric.sentDelta))
      ? Math.max(0, Number(metric.sentDelta || 0))
      : metricDelta(sentTotal, lastOutputSent);
    const droppedDelta = Number.isFinite(Number(metric.droppedDelta))
      ? Math.max(0, Number(metric.droppedDelta || 0))
      : metricDelta(droppedTotal, lastOutputDropped);

    lastOutputSent = Number.isFinite(sentTotal) ? sentTotal : lastOutputSent;
    lastOutputDropped = Number.isFinite(droppedTotal) ? droppedTotal : lastOutputDropped;

    observe("output.latencyMs", lastLatencyMs);
    observe("output.sendMs", lastSendMs);
    counter("output.sent", sentDelta);
    counter("output.droppedTotal", droppedDelta);
    if (droppedDelta > 0) counter("output.droppedRecent", droppedDelta);
    const sample = {
      kind: "output",
      timestamp: nowMs(performanceRef),
      sent: sentTotal,
      sentDelta,
      dropped: droppedDelta,
      droppedTotal,
      latencyMs: roundNumber(lastLatencyMs),
      sendMs: roundNumber(lastSendMs),
      queueDepth: Number(metric.queueDepth || 0),
      pausedMs: Number(metric.pausedMs || 0)
    };
    pushRing(samples, sample, sampleLimit);
    history.record("output", sample);
    return emit("output", { ...metric, sentDelta, droppedDelta, droppedTotal });
  }

  function recordOutputTick(metric = {}) {
    const tickMs = Number(metric.tickMs || 0);
    const driftMs = Number(metric.driftMs || 0);
    observe("output.tickMs", tickMs);
    observe("output.driftMs", driftMs);
    const sample = {
      kind: "outputTick",
      timestamp: nowMs(performanceRef),
      tickMs: roundNumber(tickMs),
      driftMs: roundNumber(driftMs),
      frameId: Number(metric.outputFrameId || metric.latestFrameId || 0),
      source: String(metric.outputFrameSource || metric.frameBus?.lastSource || "--"),
      frameAgeMs: roundNumber(metric.outputFrameAgeMs || metric.frameBus?.lastFrameAgeMs || 0),
      outputEnabled: Boolean(metric.outputEnabled),
      serialEnabled: Boolean(metric.serialEnabled),
      blockedReason: String(metric.outputBlockedReason || "--"),
      frameBus: clonePlain(metric.frameBus || null),
      frameAuthority: clonePlain(metric.frameAuthority || null)
    };
    pushRing(samples, sample, sampleLimit);
    history.record("outputTick", sample);
    return emit("outputTick", metric);
  }

  function recordUiMetric(kind, elapsedMs) {
    const safeKind = String(kind || "ui");
    observe(`${safeKind}.ms`, Number(elapsedMs || 0));
    counter(`${safeKind}.calls`, 1);
    const sample = {
      kind: safeKind,
      timestamp: nowMs(performanceRef),
      elapsedMs: roundNumber(elapsedMs)
    };
    pushRing(samples, sample, sampleLimit);
    history.record(safeKind, sample);
    return emit(safeKind, { elapsedMs: roundNumber(elapsedMs) });
  }

  function subscribe(listener) {
    if (typeof listener !== "function") return () => {};
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function bucketSnapshot() {
    const result = {};
    for (const [name, bucket] of buckets.entries()) {
      result[name] = {
        count: bucket.count,
        avg: roundNumber(bucket.sum / Math.max(1, bucket.count)),
        max: roundNumber(bucket.max),
        last: roundNumber(bucket.last)
      };
    }
    return result;
  }

  function counterSnapshot() {
    const result = {};
    for (const [name, value] of counters.entries()) result[name] = value;
    return result;
  }

  function snapshot(extra = {}) {
    const timestamp = nowMs(performanceRef);
    lastSnapshot = {
      timestamp,
      uptimeMs: Math.max(0, Math.round(timestamp - startedAt)),
      counters: counterSnapshot(),
      buckets: bucketSnapshot(),
      lastEvent: clonePlain(lastEvent),
      recentEvents: events.slice(-24),
      recentSamples: samples.slice(-60),
      history: history.snapshot({ recentLimit: 90 }),
      ...clonePlain(extra)
    };
    return clonePlain(lastSnapshot);
  }

  function reset() {
    events.length = 0;
    samples.length = 0;
    counters.clear();
    buckets.clear();
    history.reset();
    lastEvent = null;
    lastSnapshot = null;
  }

  const api = {
    emit,
    counter,
    observe,
    recordRenderMetric,
    recordOutputMetric,
    recordOutputTick,
    recordUiMetric,
    subscribe,
    snapshot,
    reset,
    getLastSnapshot: () => clonePlain(lastSnapshot),
    getRecentEvents: () => events.slice(),
    getRecentSamples: () => samples.slice(),
    getHistorySnapshot: () => history.snapshot()
  };

  if (windowRef) {
    windowRef.__ledTelemetryBus = api;
  }

  return api;
}
