import { analyzeTelemetryHealth } from "./telemetry_health.js";

function numberLabel(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? String(Math.round(n)) : "0";
}

function fixed(value, decimals = 1, fallback = "--") {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(decimals) : fallback;
}

function mergeTelemetryWithFallback(telemetry, fallback = {}) {
  const perf = fallback?.perf || fallback || {};
  const detail = fallback?.detail || {};
  const source = telemetry && typeof telemetry === "object" ? JSON.parse(JSON.stringify(telemetry)) : {};
  source.counters = source.counters && typeof source.counters === "object" ? source.counters : {};
  source.buckets = source.buckets && typeof source.buckets === "object" ? source.buckets : {};
  source.history = source.history && typeof source.history === "object" ? source.history : { summary: {}, recent: [] };
  source.history.summary = source.history.summary && typeof source.history.summary === "object" ? source.history.summary : {};

  const elapsedMs = Math.max(1, Number(source.uptimeMs || perf.elapsedMs || 0));
  source.uptimeMs = elapsedMs;
  const elapsedSec = elapsedMs / 1000;

  const renderFps = Number(perf.renderFps || detail.renderFps || 0);
  const outputTickFps = Number(perf.outputTickFps || detail.outputTickFps || 0);
  source.fps = Number.isFinite(renderFps) ? renderFps : Number(source.fps || 0);
  source.outputTickFps = Number.isFinite(outputTickFps) ? outputTickFps : Number(source.outputTickFps || 0);
  if (!Number(source.counters["event.render"] || 0) && renderFps > 0) {
    source.counters["event.render"] = Math.max(1, Math.round(renderFps * elapsedSec));
  }
  if (!Number(source.counters["event.outputTick"] || 0) && outputTickFps > 0) {
    source.counters["event.outputTick"] = Math.max(1, Math.round(outputTickFps * elapsedSec));
  }
  if (!Number(source.counters["render.skipped"] || 0) && Number(perf.renderDropped || 0) > 0) {
    source.counters["render.skipped"] = Number(perf.renderDropped || 0);
  }
  if (!Number(source.counters["output.droppedTotal"] || 0) && Number(perf.outputDropped || 0) > 0) {
    source.counters["output.droppedTotal"] = Number(perf.outputDropped || 0);
  }

  function ensureBucket(name, avg, max = avg, last = avg, count = null) {
    const current = source.buckets[name];
    if (current && Number(current.count || 0) > 0) return;
    const value = Number(avg);
    if (!Number.isFinite(value) || value < 0) return;
    const safeCount = Math.max(1, Number(count ?? source.counters["event.render"] ?? 1));
    source.buckets[name] = {
      count: safeCount,
      avg: Number(value.toFixed(3)),
      max: Number(Math.max(value, Number(max || value)).toFixed(3)),
      last: Number(Number(last || value).toFixed(3))
    };
  }

  ensureBucket("render.ms", perf.renderAvgMs, perf.renderMaxMs, perf.renderAvgMs, source.counters["event.render"]);
  ensureBucket("preview.drawMs", perf.previewAvgMs, perf.previewAvgMs, perf.previewAvgMs, source.counters["event.render"]);
  ensureBucket("render.lateMs", perf.lateAvgMs, perf.lateAvgMs, perf.lateAvgMs, source.counters["event.render"]);
  ensureBucket("output.tickMs", perf.outputTickAvgMs, perf.outputTickMaxMs, perf.outputTickAvgMs, source.counters["event.outputTick"]);
  ensureBucket("output.driftMs", perf.outputDriftAvgMs, perf.outputDriftAvgMs, perf.outputDriftAvgMs, source.counters["event.outputTick"]);
  ensureBucket("output.latencyMs", perf.outputLatencyMs ?? detail.outputLatencyMs, perf.outputLatencyMs ?? detail.outputLatencyMs, perf.outputLatencyMs ?? detail.outputLatencyMs, source.counters["event.outputTick"] || 1);

  const summary = source.history.summary;
  if (!Number(summary.count || 0)) {
    summary.limit = summary.limit || 360;
    summary.count = Math.max(0, Number(source.counters["event.render"] || 0) + Number(source.counters["event.outputTick"] || 0));
    summary.renderMs = source.buckets["render.ms"] || summary.renderMs;
    summary.outputLatencyMs = source.buckets["output.latencyMs"] || summary.outputLatencyMs;
    summary.outputDriftMs = source.buckets["output.driftMs"] || summary.outputDriftMs;
    summary.droppedTotal = Number(source.counters["output.droppedTotal"] || 0);
  }

  return source;
}

function counterValue(counters, name) {
  return Number(counters?.[name] || 0);
}

function setText(element, value) {
  if (!element) return;
  const next = String(value ?? "--");
  if (element.textContent !== next) element.textContent = next;
}

function setHealthClass(card, label) {
  if (!card?.classList) return;
  const normalized = String(label || "OK").toLowerCase();
  const nextClass = normalized.includes("bad")
    ? "debug-health-bad"
    : normalized.includes("warn")
      ? "debug-health-warn"
      : "debug-health-ok";
  if (card.classList.contains(nextClass)) return;
  card.classList.remove("debug-health-ok", "debug-health-warn", "debug-health-bad");
  card.classList.add(nextClass);
}

function estimateRenderFps(telemetry, renderEvents) {
  const direct = Number(telemetry?.fps || 0);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const uptimeSec = Math.max(0.001, Number(telemetry?.uptimeMs || 0) / 1000);
  if (!renderEvents) return 0;
  return renderEvents / uptimeSec;
}

function renderMetricCards(controls, telemetry, health, renderEvents) {
  const history = telemetry?.history || null;
  const summary = history?.summary || {};
  const buckets = telemetry?.buckets || {};
  const renderBucket = buckets["render.ms"] || summary.renderMs || {};
  const driftBucket = buckets["output.driftMs"] || summary.outputDriftMs || {};
  const latencyBucket = buckets["output.latencyMs"] || summary.outputLatencyMs || {};
  const renderFps = estimateRenderFps(telemetry, renderEvents);
  const outputFps = Number(telemetry?.outputTickFps || 0);
  const serialFps = Number(telemetry?.serialFps || telemetry?.detail?.serialFps || 0);
  const fps = Number.isFinite(outputFps) && outputFps > 0 ? outputFps : renderFps;
  const dropped = Number(summary.droppedTotal || telemetry?.counters?.["output.droppedTotal"] || 0)
    + Number(telemetry?.counters?.["render.skipped"] || 0);

  setHealthClass(controls.dbgHealthCard, health.label);
  setText(controls.dbgHealth, health.label || "OK");
  setText(controls.dbgHealthDetail, health.summary || "runtime nominal");
  setText(controls.dbgFps, fps > 0 ? fixed(fps, 1) : "--");
  setText(controls.dbgFpsDetail, `LIVE ${fixed(outputFps, 1, "0.0")} | PREVIEW ${fixed(renderFps, 1, "0.0")} | TRANSPORT ${fixed(serialFps, 1, "0.0")}`);
  setText(controls.dbgFrameTime, renderBucket?.count ? `${fixed(renderBucket.avg, 2)}ms` : "--");
  setText(controls.dbgFrameTimeDetail, renderBucket?.count ? `max ${fixed(renderBucket.max, 2)}ms | last ${fixed(renderBucket.last, 2)}ms` : "avg / max");
  setText(controls.dbgJitter, driftBucket?.count ? `${fixed(driftBucket.last ?? driftBucket.avg, 2)}ms` : "--");
  setText(controls.dbgJitterDetail, driftBucket?.count ? `avg ${fixed(driftBucket.avg, 2)}ms | max ${fixed(driftBucket.max, 2)}ms` : "output drift");
  setText(controls.dbgLatency, latencyBucket?.count ? `${fixed(latencyBucket.avg, 2)}ms` : "--");
  setText(controls.dbgLatencyDetail, latencyBucket?.count ? `max ${fixed(latencyBucket.max, 2)}ms | last ${fixed(latencyBucket.last, 2)}ms` : "output avg / max");
  setText(controls.dbgDrops, String(Math.round(dropped)));
  setText(controls.dbgDropsDetail, dropped ? "check output/render budget" : "no recent drops");

  const renderStatus = health.label === "BAD" ? "BAD" : health.label === "WARN" ? "WARN" : "OK";
  setText(controls.dbgRenderSnapshot, renderStatus);
  setText(controls.dbgRenderSnapshotDetail, renderBucket?.count ? `avg ${fixed(renderBucket.avg, 2)}ms | drop ${Math.round(dropped)}` : health.summary || "no render samples");

  const outputStatus = dropped ? "WATCH" : (latencyBucket?.count || driftBucket?.count ? "OK" : "IDLE");
  setText(controls.dbgOutputSnapshot, outputStatus);
  setText(controls.dbgOutputSnapshotDetail, latencyBucket?.count ? `lat ${fixed(latencyBucket.avg, 2)}ms | jitter ${fixed(driftBucket?.avg || 0, 2)}ms` : "no output samples");

  setText(controls.dbgSyncSnapshot, dropped ? "WATCH" : "OK");
  setText(controls.dbgSyncSnapshotDetail, health.summary || "runtime link");
  setText(controls.dbgSafetySnapshot, health.label || "OK");
  setText(controls.dbgSafetySnapshotDetail, dropped ? "watch dropped frames" : "live state stable");
}

export function syncTelemetryDebugPanel(controls, telemetry, fallback = {}) {
  if (!controls) return;
  const source = mergeTelemetryWithFallback(telemetry, fallback);
  const counters = source.counters || {};
  const uptimeMs = Number(source.uptimeMs || 0);
  const eventCount = Object.entries(counters)
    .filter(([key]) => key.startsWith("event."))
    .reduce((sum, [, value]) => sum + Number(value || 0), 0);
  const renderEvents = counterValue(counters, "event.render");
  const health = analyzeTelemetryHealth(source);

  renderMetricCards(controls, source, health, renderEvents);

  setText(controls.dbgTelemetry, `LIVE | ${health.label} | UP ${numberLabel(uptimeMs)}ms | ${eventCount} events`);
  setText(controls.dbgTelemetryFreezeState, "LIVE");
}

export function __resetTelemetryDebugPanelForTests() {
  return undefined;
}
