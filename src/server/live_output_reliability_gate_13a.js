export const LIVE_OUTPUT_RELIABILITY_GATE_VERSION = "13A-stream-reliability-gate";

function nowIso() {
  return new Date().toISOString();
}

function asNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function getRunFromTelemetry(streamTelemetry = null) {
  if (!streamTelemetry) return null;
  return streamTelemetry.lastRun || streamTelemetry;
}

function evaluateRun(run = null, thresholds = {}) {
  const maxJitterMs = asNumber(thresholds.maxJitterMs, 8);
  const maxFailedFrames = asNumber(thresholds.maxFailedFrames, 0);
  const requirePackets = thresholds.requirePackets !== false;
  const minOkRatio = asNumber(thresholds.minOkRatio, 1);
  const blocked = [];
  const warnings = [];

  if (!run) {
    blocked.push("NO_STREAM_TELEMETRY_RUN_13A");
  }

  const frames = asNumber(run?.frames, 0);
  const okFrames = asNumber(run?.okFrames, 0);
  const failedFrames = asNumber(run?.failedFrames, 0);
  const stoppedFrames = asNumber(run?.stoppedFrames, 0);
  const packetCount = asNumber(run?.packetCount, 0);
  const jitterMs = asNumber(run?.jitterMs ?? run?.timing?.jitterMs, 0);
  const okRatio = frames > 0 ? okFrames / frames : 0;

  if (run && String(run.status || "").toUpperCase() === "STOPPED") {
    warnings.push("STREAM_STOPPED_BY_OPERATOR_13A");
  }
  if (frames <= 0) blocked.push("NO_FRAMES_RECORDED_13A");
  if (failedFrames > maxFailedFrames) blocked.push("FAILED_FRAMES_ABOVE_LIMIT_13A");
  if (stoppedFrames > 0) warnings.push("STOPPED_FRAMES_PRESENT_13A");
  if (requirePackets && packetCount <= 0) blocked.push("NO_OUTPUT_PACKETS_RECORDED_13A");
  if (jitterMs > maxJitterMs) warnings.push("JITTER_ABOVE_TARGET_13A");
  if (frames > 0 && okRatio < minOkRatio) blocked.push("OK_FRAME_RATIO_BELOW_TARGET_13A");

  const status = blocked.length ? "FAIL" : warnings.length ? "WARN" : "PASS";
  const decision = status === "PASS"
    ? "STREAM_RELIABILITY_PASS_13A"
    : status === "WARN"
      ? "STREAM_RELIABILITY_WARN_13A"
      : "STREAM_RELIABILITY_FAIL_13A";

  return Object.freeze({
    version: LIVE_OUTPUT_RELIABILITY_GATE_VERSION,
    ok: status !== "FAIL",
    status,
    decision,
    allowPhysicalContinue: status === "PASS",
    requireDryRunBeforePhysical: status !== "PASS",
    metrics: Object.freeze({ frames, okFrames, failedFrames, stoppedFrames, packetCount, jitterMs, okRatio: Number(okRatio.toFixed(3)) }),
    thresholds: Object.freeze({ maxJitterMs, maxFailedFrames, requirePackets, minOkRatio }),
    blocked: Object.freeze(blocked),
    warnings: Object.freeze(warnings),
    nextStep: status === "PASS"
      ? "reliability OK; můžeš pokračovat dalším guarded physical testem"
      : status === "WARN"
        ? "zkontroluj jitter/stop stav, zopakuj dry telemetry před fyzickým streamem"
        : "nejdřív oprav stream telemetry; fyzický stream nepouštěj",
    evaluatedAt: nowIso()
  });
}

export function createLiveOutputReliabilityGate13A({
  liveOutputStreamTelemetry12Z = null,
  liveOutputSendHistory = null,
  liveAuditLog = null,
  thresholds = {}
} = {}) {
  if (!liveOutputStreamTelemetry12Z?.snapshot) throw new Error("createLiveOutputReliabilityGate13A requires liveOutputStreamTelemetry12Z.snapshot");
  let lastEvaluation = null;

  function evaluate(requestInput = {}) {
    const telemetry = requestInput.streamTelemetry || liveOutputStreamTelemetry12Z.snapshot();
    const run = getRunFromTelemetry(telemetry);
    const result = Object.freeze({
      ...evaluateRun(run, { ...thresholds, ...(requestInput.thresholds || {}) }),
      telemetryStatus: String(telemetry?.status || run?.status || "IDLE"),
      runId: String(run?.runId || "none"),
      transportKind: String(run?.transportKind || "unknown"),
      physical: Boolean(run?.physical),
      dryRun: run?.dryRun !== false
    });
    lastEvaluation = result;
    liveOutputSendHistory?.append?.("reliability-gate-13A", result);
    liveAuditLog?.append?.("live.output.reliability-gate.13A", { result });
    return result;
  }

  function snapshot() {
    return Object.freeze({
      version: LIVE_OUTPUT_RELIABILITY_GATE_VERSION,
      lastEvaluation,
      status: lastEvaluation?.status || "IDLE",
      decision: lastEvaluation?.decision || "STREAM_RELIABILITY_NOT_EVALUATED_13A",
      updatedAt: lastEvaluation?.evaluatedAt || nowIso()
    });
  }

  return Object.freeze({
    version: LIVE_OUTPUT_RELIABILITY_GATE_VERSION,
    evaluate,
    snapshot
  });
}
