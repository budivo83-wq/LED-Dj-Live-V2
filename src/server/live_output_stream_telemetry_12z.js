export const LIVE_OUTPUT_STREAM_TELEMETRY_VERSION = "12Z-stream-telemetry-stop-control";

function nowIso() {
  return new Date().toISOString();
}

function makeInitialState() {
  return {
    version: LIVE_OUTPUT_STREAM_TELEMETRY_VERSION,
    running: false,
    stopRequested: false,
    activeRunId: null,
    lastRun: null,
    history: [],
    updatedAt: nowIso()
  };
}

function compactRun(run = {}) {
  return Object.freeze({
    runId: String(run.runId || "none"),
    status: String(run.status || "IDLE"),
    decision: String(run.decision || "STREAM_TELEMETRY_IDLE_12Z"),
    transportKind: String(run.transportKind || run.request?.transportKind || "unknown"),
    physical: Boolean(run.physical),
    dryRun: run.dryRun !== false,
    frames: Number(run.frames || 0),
    okFrames: Number(run.okFrames || 0),
    sentFrames: Number(run.sentFrames || 0),
    failedFrames: Number(run.failedFrames || 0),
    stoppedFrames: Number(run.stoppedFrames || 0),
    packetCount: Number(run.packetCount || 0),
    packetBytes: Number(run.packetBytes || 0),
    jitterMs: Number(run.timing?.jitterMs || 0),
    wallMs: Number(run.timing?.wallMs || 0),
    blocked: Object.freeze(Array.isArray(run.blocked) ? run.blocked.slice(0, 8) : []),
    warnings: Object.freeze(Array.isArray(run.warnings) ? run.warnings.slice(0, 8) : []),
    nextStep: String(run.nextStep || "run dry stream before physical output"),
    startedAt: String(run.startedAt || ""),
    finishedAt: String(run.finishedAt || "")
  });
}

export function createLiveOutputStreamTelemetry12Z({
  liveOutputMultiFrameStream12Y = null,
  liveOutputSendHistory = null,
  liveAuditLog = null
} = {}) {
  if (!liveOutputMultiFrameStream12Y?.run) throw new Error("createLiveOutputStreamTelemetry12Z requires liveOutputMultiFrameStream12Y.run");
  const state = makeInitialState();

  function snapshot() {
    return Object.freeze({
      version: LIVE_OUTPUT_STREAM_TELEMETRY_VERSION,
      running: state.running,
      stopRequested: state.stopRequested,
      activeRunId: state.activeRunId,
      lastRun: state.lastRun,
      history: Object.freeze(state.history.map(compactRun)),
      count: state.history.length,
      updatedAt: state.updatedAt,
      status: state.running ? "RUNNING" : state.stopRequested ? "STOP_REQUESTED" : state.lastRun?.status || "IDLE",
      decision: state.running ? "STREAM_TELEMETRY_RUNNING_12Z" : state.lastRun?.decision || "STREAM_TELEMETRY_IDLE_12Z"
    });
  }

  function requestStop(reason = "operator_stop_stream_12Z") {
    state.stopRequested = true;
    state.updatedAt = nowIso();
    const stop = Object.freeze({
      version: LIVE_OUTPUT_STREAM_TELEMETRY_VERSION,
      ok: true,
      status: state.running ? "STOP_REQUESTED" : "IDLE_STOP_REQUESTED",
      decision: "STREAM_STOP_REQUESTED_12Z",
      activeRunId: state.activeRunId,
      reason: String(reason || "operator_stop_stream_12Z"),
      updatedAt: state.updatedAt
    });
    liveAuditLog?.append?.("live.output.stream.stop.12Z", { stop });
    return stop;
  }

  async function run(requestInput = {}) {
    if (state.running) {
      const blocked = Object.freeze({
        version: LIVE_OUTPUT_STREAM_TELEMETRY_VERSION,
        ok: false,
        status: "BLOCKED",
        decision: "STREAM_ALREADY_RUNNING_12Z",
        blocked: Object.freeze(["STREAM_ALREADY_RUNNING_12Z"]),
        outputTouched: false,
        running: true,
        activeRunId: state.activeRunId
      });
      liveOutputSendHistory?.append?.("stream-telemetry-blocked-12Z", blocked);
      return blocked;
    }

    const runId = `12Z-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const startedAt = nowIso();
    state.running = true;
    state.stopRequested = false;
    state.activeRunId = runId;
    state.updatedAt = startedAt;

    try {
      const result = await liveOutputMultiFrameStream12Y.run({
        ...requestInput,
        source: requestInput.source || "stream-telemetry-12Z",
        runId,
        stopSignal: {
          isStopped: () => state.stopRequested
        }
      });
      const stoppedFrames = Array.isArray(result.frameResults)
        ? result.frameResults.filter((frame) => frame.status === "STOPPED" || frame.decision === "STREAM_STOPPED_BY_OPERATOR_12Z").length
        : 0;
      const stopped = state.stopRequested || stoppedFrames > 0;
      const finishedAt = nowIso();
      const telemetry = Object.freeze({
        ...result,
        version: LIVE_OUTPUT_STREAM_TELEMETRY_VERSION,
        runId,
        startedAt,
        finishedAt,
        stopped,
        stoppedFrames,
        running: false,
        status: stopped ? "STOPPED" : String(result.status || "DONE"),
        decision: stopped ? "STREAM_STOPPED_BY_OPERATOR_12Z" : String(result.decision || "STREAM_TELEMETRY_DONE_12Z"),
        nextStep: stopped ? "stream zastaven; ověř history/ACK a spusť znovu dry-run" : String(result.nextStep || "stream telemetry complete")
      });
      state.lastRun = compactRun(telemetry);
      state.history.unshift(state.lastRun);
      state.history = state.history.slice(0, 16);
      state.updatedAt = finishedAt;
      liveOutputSendHistory?.append?.("stream-telemetry-12Z", telemetry);
      liveAuditLog?.append?.("live.output.stream.telemetry.12Z", { telemetry });
      return telemetry;
    } finally {
      state.running = false;
      state.activeRunId = null;
      state.stopRequested = false;
      state.updatedAt = nowIso();
    }
  }

  return Object.freeze({
    version: LIVE_OUTPUT_STREAM_TELEMETRY_VERSION,
    run,
    snapshot,
    requestStop
  });
}
