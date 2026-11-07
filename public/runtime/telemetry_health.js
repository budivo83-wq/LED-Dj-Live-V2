const DEFAULT_THRESHOLDS = Object.freeze({
  renderAvgWarnMs: 12,
  renderAvgBadMs: 20,
  renderMaxWarnMs: 24,
  renderMaxBadMs: 40,
  outputLatencyWarnMs: 20,
  outputLatencyBadMs: 50,
  outputTickWarnMs: 20,
  outputTickBadMs: 35,
  uiWarnMs: 8,
  uiBadMs: 16,
  debugWarnMs: 8,
  debugBadMs: 16
});

function bucketAvg(telemetry, name) {
  return Number(telemetry?.buckets?.[name]?.avg || 0);
}

function bucketMax(telemetry, name) {
  return Number(telemetry?.buckets?.[name]?.max || 0);
}

function counterValue(telemetry, name) {
  return Number(telemetry?.counters?.[name] || 0);
}

function recentSamples(telemetry) {
  return Array.isArray(telemetry?.recentSamples)
    ? telemetry.recentSamples
    : Array.isArray(telemetry?.history?.recent)
      ? telemetry.history.recent
      : [];
}

function recentNumbers(telemetry, kind, fields) {
  const names = Array.isArray(fields) ? fields : [fields];
  return recentSamples(telemetry)
    .filter((sample) => sample?.kind === kind)
    .map((sample) => {
      for (const name of names) {
        const value = Number(sample?.[name]);
        if (Number.isFinite(value) && value >= 0) return value;
      }
      return null;
    })
    .filter((value) => value !== null);
}

function recentAvg(telemetry, kind, fields) {
  const values = recentNumbers(telemetry, kind, fields);
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function recentMax(telemetry, kind, fields) {
  const values = recentNumbers(telemetry, kind, fields);
  return values.length ? Math.max(...values) : null;
}

function metricAvg(telemetry, kind, fields, bucketName) {
  const recent = recentAvg(telemetry, kind, fields);
  return recent === null ? bucketAvg(telemetry, bucketName) : recent;
}

function metricMax(telemetry, kind, fields, bucketName) {
  const recent = recentMax(telemetry, kind, fields);
  return recent === null ? bucketMax(telemetry, bucketName) : recent;
}

function recentFrameLoss(telemetry) {
  const samples = recentSamples(telemetry);
  return samples.reduce((sum, sample) => {
    if (!sample || typeof sample !== "object") return sum;
    // STEP 13AI: output.dropped used to be a cumulative total in some runtime builds.
    // Prefer explicit deltas and ignore cumulative totals for recent health decisions.
    const renderSkipped = sample.kind === "render" ? Number(sample.skipped || 0) : 0;
    const outputDropped = sample.kind === "output"
      ? Number((sample.droppedDelta ?? sample.dropped) || 0)
      : 0;
    return sum + Math.max(0, renderSkipped) + Math.max(0, outputDropped);
  }, 0);
}

function levelFor(value, warn, bad) {
  const n = Number(value || 0);
  if (!Number.isFinite(n) || n <= 0) return "ok";
  if (n >= bad) return "bad";
  if (n >= warn) return "warn";
  return "ok";
}

function worseLevel(a, b) {
  const rank = { ok: 0, warn: 1, bad: 2 };
  return rank[b] > rank[a] ? b : a;
}

function pushIssue(issues, level, code, label, value, limit) {
  if (level === "ok") return;
  issues.push({
    level,
    code,
    label,
    value: Number(value || 0),
    limit: Number(limit || 0)
  });
}

export function analyzeTelemetryHealth(telemetry = {}, thresholds = {}) {
  const t = { ...DEFAULT_THRESHOLDS, ...thresholds };
  const issues = [];
  let level = "ok";

  const renderAvg = metricAvg(telemetry, "render", "renderMs", "render.ms");
  const renderMax = metricMax(telemetry, "render", "renderMs", "render.ms");
  const outputLatency = metricAvg(telemetry, "output", "latencyMs", "output.latencyMs");
  const outputTick = metricAvg(telemetry, "outputTick", ["tickMs", "elapsedMs"], "output.tickMs");
  const uiSync = metricAvg(telemetry, "uiSync", "elapsedMs", "uiSync.ms");
  const debugSync = metricAvg(telemetry, "debugSync", "elapsedMs", "debugSync.ms");

  const renderAvgLevel = levelFor(renderAvg, t.renderAvgWarnMs, t.renderAvgBadMs);
  const renderMaxLevel = levelFor(renderMax, t.renderMaxWarnMs, t.renderMaxBadMs);
  const outputLatencyLevel = levelFor(outputLatency, t.outputLatencyWarnMs, t.outputLatencyBadMs);
  const outputTickLevel = levelFor(outputTick, t.outputTickWarnMs, t.outputTickBadMs);
  const uiLevel = levelFor(uiSync, t.uiWarnMs, t.uiBadMs);
  const debugLevel = levelFor(debugSync, t.debugWarnMs, t.debugBadMs);

  pushIssue(issues, renderAvgLevel, "render.avg", "render avg", renderAvg, renderAvgLevel === "bad" ? t.renderAvgBadMs : t.renderAvgWarnMs);
  pushIssue(issues, renderMaxLevel, "render.max", "render max", renderMax, renderMaxLevel === "bad" ? t.renderMaxBadMs : t.renderMaxWarnMs);
  pushIssue(issues, outputLatencyLevel, "output.latency", "output latency", outputLatency, outputLatencyLevel === "bad" ? t.outputLatencyBadMs : t.outputLatencyWarnMs);
  pushIssue(issues, outputTickLevel, "output.tick", "output tick", outputTick, outputTickLevel === "bad" ? t.outputTickBadMs : t.outputTickWarnMs);
  if (uiLevel !== "ok") {
    issues.push({
      level: uiLevel === "bad" ? "warn" : uiLevel,
      code: "ui.sync",
      label: "ui panel sync",
      value: Number(uiSync || 0),
      limit: Number(uiLevel === "bad" ? t.uiBadMs : t.uiWarnMs)
    });
  }
  if (debugLevel !== "ok") {
    issues.push({
      level: "info",
      code: "debug.sync",
      label: "debug panel cost",
      value: Number(debugSync || 0),
      limit: Number(debugLevel === "bad" ? t.debugBadMs : t.debugWarnMs)
    });
  }

  for (const issue of issues) level = worseLevel(level, issue.level);

  const recentDropped = recentFrameLoss(telemetry);
  const mode = String(globalThis?.__ledRuntimeModeAuthority?.get?.().mode || globalThis?.RUNTIME_PROFILE?.mode || (globalThis?.RUNTIME_PROFILE?.raspi ? "raspi-safe" : "normal")).toLowerCase();
  const constrained = mode !== "normal";
  const relaxedHealth = Boolean(constrained || globalThis?.RUNTIME_PROFILE?.relaxedHealth);
  const frameLossWarn = Number(globalThis?.RUNTIME_PROFILE?.frameLossWarn || (relaxedHealth ? 12 : 20));
  const frameLossBad = Number(globalThis?.RUNTIME_PROFILE?.frameLossBad || (relaxedHealth ? 80 : 60));
  if (recentDropped >= frameLossWarn) {
    const droppedLevel = recentDropped >= frameLossBad ? "bad" : "warn";
    level = worseLevel(level, droppedLevel);
    issues.push({ level: droppedLevel, code: "frame.loss", label: "recent frame loss", value: recentDropped, limit: droppedLevel === "bad" ? frameLossBad : frameLossWarn });
  } else {
    const historicalDropped = counterValue(telemetry, "output.droppedTotal") + counterValue(telemetry, "render.skipped");
    if (historicalDropped > 0) {
      issues.push({ level: "info", code: "frame.loss.history", label: "historical frame loss", value: historicalDropped, limit: 0 });
    }
  }

  return {
    level,
    ok: level === "ok",
    label: level === "bad" ? "BAD" : level === "warn" ? "WARN" : "OK",
    issues,
    summary: issues.filter((issue) => issue.level !== "info").length
      ? issues.filter((issue) => issue.level !== "info").slice(0, 3).map((issue) => `${issue.label} ${issue.value.toFixed(1)}`).join(" | ")
      : "stable"
  };
}
