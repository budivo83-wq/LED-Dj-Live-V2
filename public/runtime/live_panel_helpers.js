import { freezeUniqueList } from "./list_utils.js";

function setText(node, text) {
  if (!node) return;
  const next = String(text ?? "");
  if (node.textContent !== next) node.textContent = next;
}

export function renderLivePanel(controls, live = null, detail = "") {
  const status = String(live?.status || "DISARMED").toUpperCase();
  const stopped = Boolean(live?.emergencyStopLatched);
  const armed = Boolean(live?.armed);
  const physical = live?.physicalWriteAllowed ? "PHYSICAL-ALLOW" : "PHYSICAL-BLOCK";
  setText(controls.liveArmStatus, `${stopped ? "STOPPED" : status} | ${armed ? "ARMED" : "DISARMED"} | ${physical}`);
  setText(controls.liveArmDetail, detail || `token ${live?.armTokenDigest || "none"} | reason ${live?.lastDisarmReason || "--"}`);
}

export function renderPreflightSummary(controls, preflight = null, fallback = "") {
  if (!controls.livePhysicalPreflightStatus) return;
  if (!preflight) {
    setText(controls.livePhysicalPreflightStatus, fallback || "PREFLIGHT IDLE");
    return;
  }
  const status = String(preflight.status || "BLOCKED").toUpperCase();
  const decision = String(preflight.decision || "PHYSICAL_RELEASE_BLOCKED");
  const blocked = Array.isArray(preflight.blocked) ? preflight.blocked : [];
  setText(controls.livePhysicalPreflightStatus, `${status} | ${decision} | ${blocked.slice(0, 4).join(",") || "-"}`);
}

export function renderFullTokenSummary(controls, tokenGate = null, fallback = "") {
  if (!controls.liveFullTokenStatus) return;
  if (!tokenGate) {
    setText(controls.liveFullTokenStatus, fallback || "INACTIVE");
    return;
  }
  const decision = String(tokenGate.decision || (tokenGate.active ? "FULL_LIVE_TOKEN_ACTIVE" : "FULL_LIVE_TOKEN_INACTIVE"));
  const digest = String(tokenGate.tokenDigest || "none");
  const blocked = Array.isArray(tokenGate.blocked) ? tokenGate.blocked : [];
  setText(controls.liveFullTokenStatus, `${decision} | ${digest} | ${blocked.slice(0, 3).join(",") || "-"}`);
}

export function renderSyncSummary(controls, sync = null, fallback = "") {
  if (!controls.liveSyncStatus) return;
  if (!sync) {
    setText(controls.liveSyncStatus, fallback || "SYNC UNKNOWN");
    return;
  }
  const status = String(sync.status || (sync.ok ? "SYNCED" : "DESYNC"));
  const mismatches = Array.isArray(sync.mismatches) ? sync.mismatches : [];
  const warnings = Array.isArray(sync.warnings) ? sync.warnings : [];
  const detail = mismatches.length ? mismatches.slice(0, 3).join(",") : (warnings.slice(0, 2).join(",") || sync.decision || "OK");
  setText(controls.liveSyncStatus, `${status} | ${sync.liveStatus || "?"}/${sync.readinessStatus || "?"} | ${detail}`);
}

export function renderSerialDiagnosticsSummary(controls, serialDiagnostics = null, fallback = "") {
  if (!controls.liveSerialDiagnosticsStatus) return;
  if (!serialDiagnostics) {
    setText(controls.liveSerialDiagnosticsStatus, fallback || "SERIAL DIAG IDLE");
    return;
  }
  const status = String(serialDiagnostics.status || "BLOCKED").toUpperCase();
  const target = String(serialDiagnostics.targetLabel || serialDiagnostics.target?.serialPath || "?");
  const count = Number(serialDiagnostics.portCount || 0);
  const match = serialDiagnostics.matchedPort ? "MATCH" : "NO-MATCH";
  const blocked = Array.isArray(serialDiagnostics.blocked) ? serialDiagnostics.blocked : [];
  const warnings = Array.isArray(serialDiagnostics.warnings) ? serialDiagnostics.warnings : [];
  const detail = blocked.length ? blocked.slice(0, 2).join(",") : (warnings.slice(0, 2).join(",") || match);
  setText(controls.liveSerialDiagnosticsStatus, `${status} | ${target} | ports ${count} | ${detail}`);
}

export function renderSerialDirectTestSummary(controls, serialDirectTest = null, fallback = "") {
  if (!controls.liveSerialDirectTestStatus) return;
  if (!serialDirectTest) {
    setText(controls.liveSerialDirectTestStatus, fallback || "DIRECT SERIAL IDLE");
    return;
  }
  const status = String(serialDirectTest.status || "BLOCKED").toUpperCase();
  const target = String(serialDirectTest.targetLabel || serialDirectTest.request?.serialPath || "?");
  const packets = Number(serialDirectTest.packetCount || 0);
  const bytes = Number(serialDirectTest.packetBytes || 0);
  const blocked = Array.isArray(serialDirectTest.blocked) ? serialDirectTest.blocked : [];
  const warnings = Array.isArray(serialDirectTest.warnings) ? serialDirectTest.warnings : [];
  const detail = serialDirectTest.error || (blocked.length ? blocked.slice(0, 2).join(",") : (warnings.slice(0, 2).join(",") || serialDirectTest.headHex || "sent"));
  setText(controls.liveSerialDirectTestStatus, `${status} | ${target} | ${packets}pkt/${bytes}B | ${detail}`);
}

export function renderArtnetDiagnosticsSummary(controls, artnetDiagnostics = null, fallback = "") {
  if (!controls.liveArtnetDiagnosticsStatus) return;
  if (!artnetDiagnostics) {
    setText(controls.liveArtnetDiagnosticsStatus, fallback || "ARTNET DIAG IDLE");
    return;
  }
  const status = String(artnetDiagnostics.status || "BLOCKED").toUpperCase();
  const target = String(artnetDiagnostics.targetLabel || artnetDiagnostics.target?.host || "?");
  const packets = Number(artnetDiagnostics.packetCount || 0);
  const bytes = Number(artnetDiagnostics.payloadBytes || 0);
  const blocked = Array.isArray(artnetDiagnostics.blocked) ? artnetDiagnostics.blocked : [];
  const warnings = Array.isArray(artnetDiagnostics.warnings) ? artnetDiagnostics.warnings : [];
  const detail = blocked.length ? blocked.slice(0, 2).join(",") : (warnings.slice(0, 2).join(",") || "target ready");
  setText(controls.liveArtnetDiagnosticsStatus, `${status} | ${target} | ${packets}pkt/${bytes}B | ${detail}`);
}

export function renderOutputTargetSummary(controls, outputTargetConfig = null, fallback = "") {
  if (!controls.liveOutputTargetStatus) return;
  if (!outputTargetConfig) {
    setText(controls.liveOutputTargetStatus, fallback || "TARGET IDLE");
    return;
  }
  const status = String(outputTargetConfig.status || "BLOCKED").toUpperCase();
  const summary = String(outputTargetConfig.summary || outputTargetConfig.targetLabel || "?");
  const packets = Number(outputTargetConfig.expectedPackets || 0);
  const bytes = Number(outputTargetConfig.expectedPayloadBytes || 0);
  const blocked = Array.isArray(outputTargetConfig.blocked) ? outputTargetConfig.blocked : [];
  const warnings = Array.isArray(outputTargetConfig.warnings) ? outputTargetConfig.warnings : [];
  const detail = blocked.length ? blocked.slice(0, 2).join(",") : (warnings.slice(0, 2).join(",") || "target ready");
  setText(controls.liveOutputTargetStatus, `${status} | ${summary} | ${packets}pkt/${bytes}B | ${detail}`);
}

export function buildOutputTargetRequest(readiness = null, transportKind = "serial") {
  const context = readiness?.tokenGate?.context || {};
  const isArtnet = String(transportKind).toLowerCase() === "artnet";
  return {
    requested: true,
    commit: true,
    dryRun: true,
    transportKind: isArtnet ? "artnet" : "serial",
    host: "127.0.0.1",
    artnetPort: 6454,
    universe: 0,
    pattern: "single-pixel-chase",
    pixels: 30,
    frames: 4,
    brightness: 0.03,
    mappingDigest: String(context.mappingDigest || "output-target-config-12S"),
    transportPlanDigest: String(context.transportPlanDigest || "output-target-config-12S"),
    outputMode: isArtnet ? "artnet" : "serial",
    source: "live-ops-ui-12S"
  };
}

export function renderOutputSmokeSummary(controls, outputSmokeTest = null, fallback = "") {
  if (!controls.liveOutputSmokeStatus) return;
  if (!outputSmokeTest) {
    setText(controls.liveOutputSmokeStatus, fallback || "SMOKE IDLE");
    return;
  }
  const status = String(outputSmokeTest.status || "BLOCKED").toUpperCase();
  const transport = String(outputSmokeTest.transportKind || outputSmokeTest.request?.transportKind || "?").toUpperCase();
  const packets = Number(outputSmokeTest.packetCount || 0);
  const blocked = Array.isArray(outputSmokeTest.blocked) ? outputSmokeTest.blocked : [];
  const warnings = Array.isArray(outputSmokeTest.warnings) ? outputSmokeTest.warnings : [];
  const detail = blocked.length ? blocked.slice(0, 3).join(",") : (warnings.slice(0, 2).join(",") || "ready dry-run");
  setText(controls.liveOutputSmokeStatus, `${status} | ${transport} | ${packets}pkt | ${detail}`);
}

export function renderOutputSendHistorySummary(controls, outputSendHistory = null, fallback = "") {
  if (!controls.liveOutputSendHistoryStatus) return;
  if (!outputSendHistory) {
    setText(controls.liveOutputSendHistoryStatus, fallback || "NO SENDS");
    return;
  }
  const last = outputSendHistory.last || null;
  if (!last) {
    setText(controls.liveOutputSendHistoryStatus, "0 entries | no output attempt yet");
    return;
  }
  const physical = last.physicalWrite ? "PHYSICAL" : last.dryRun ? "DRY-RUN" : "NO-WRITE";
  const touched = last.serialTouched ? "SERIAL" : last.networkTouched ? "ARTNET" : "NO-TOUCH";
  const err = last.error ? ` | ERR ${last.error}` : "";
  setText(controls.liveOutputSendHistoryStatus, `${outputSendHistory.count} entries | ${physical} | ${touched} | ${last.transportKind} ${last.target} | ${last.packetCount}pkt/${last.packetBytes}B | ${last.status}${err}`);
}

export function renderOutputPhysicalArmSummary(controls, outputPhysicalArm = null, fallback = "") {
  if (!controls.liveOutputPhysicalArmStatus) return;
  if (!outputPhysicalArm) {
    setText(controls.liveOutputPhysicalArmStatus, fallback || "DISARMED");
    return;
  }
  const status = String(outputPhysicalArm.status || (outputPhysicalArm.armed ? "ARMED" : "DISARMED")).toUpperCase();
  const transport = String(outputPhysicalArm.transportKind || "none").toUpperCase();
  const env = outputPhysicalArm.physicalWriteEnabled ? "ENV-ON" : "ENV-OFF";
  const remaining = Math.ceil(Number(outputPhysicalArm.remainingMs || 0) / 1000);
  const blocked = Array.isArray(outputPhysicalArm.blocked) ? outputPhysicalArm.blocked : [];
  const detail = blocked.length ? blocked.slice(0, 3).join(",") : (outputPhysicalArm.reason || `${remaining}s left`);
  setText(controls.liveOutputPhysicalArmStatus, `${status} | ${transport} | ${env} | ${detail}`);
}

export function renderHardwareTestOutputSummary(controls, hardwareTestOutput = null, fallback = "") {
  if (!controls.liveHardwareTestOutputStatus) return;
  if (!hardwareTestOutput) {
    setText(controls.liveHardwareTestOutputStatus, fallback || "HW TEST IDLE");
    return;
  }
  const status = String(hardwareTestOutput.status || "BLOCKED").toUpperCase();
  const pattern = String(hardwareTestOutput.request?.pattern || "?");
  const frames = Number(hardwareTestOutput.frameCount || 0);
  const blocked = Array.isArray(hardwareTestOutput.blocked) ? hardwareTestOutput.blocked : [];
  const warnings = Array.isArray(hardwareTestOutput.warnings) ? hardwareTestOutput.warnings : [];
  const detail = blocked.length ? blocked.slice(0, 3).join(",") : (warnings.slice(0, 2).join(",") || "prepared");
  setText(controls.liveHardwareTestOutputStatus, `${status} | ${pattern} | ${frames}f | ${detail}`);
}

export function buildOutputSmokeRequest(readiness = null, token = "", transportKind = "serial") {
  const context = readiness?.tokenGate?.context || {};
  const isArtnet = String(transportKind).toLowerCase() === "artnet";
  return {
    requested: true,
    commit: true,
    dryRun: true,
    transportKind: isArtnet ? "artnet" : "serial",
    pattern: "single-pixel-chase",
    pixels: 30,
    frames: 4,
    brightness: 0.03,
    host: "127.0.0.1",
    universe: 0,
    token: String(token || ""),
    mappingDigest: String(context.mappingDigest || "output-smoke-test-12R"),
    transportPlanDigest: String(context.transportPlanDigest || "output-smoke-test-12R"),
    outputMode: isArtnet ? "artnet" : "serial",
    operatorConfirmed: true,
    confirmation: "CONFIRM_OUTPUT_SMOKE_TEST_LOW_BRIGHTNESS"
  };
}

export function renderOutputTestRunSummary(controls, outputTestRun = null, fallback = "") {
  if (!controls.liveOutputTestRunStatus) return;
  if (!outputTestRun) {
    setText(controls.liveOutputTestRunStatus, fallback || "TEST RUN IDLE");
    return;
  }
  const status = String(outputTestRun.status || "BLOCKED").toUpperCase();
  const transport = String(outputTestRun.transportKind || outputTestRun.request?.transportKind || "?").toUpperCase();
  const mode = outputTestRun.physical ? "PHYSICAL" : "DRY-RUN";
  const packets = Number(outputTestRun.packetCount || outputTestRun.outputSmokeTest?.packetCount || 0);
  const touched = outputTestRun.serialTouched ? "SERIAL" : outputTestRun.networkTouched ? "ARTNET" : "NO-TOUCH";
  const blocked = Array.isArray(outputTestRun.blocked) ? outputTestRun.blocked : [];
  const warnings = Array.isArray(outputTestRun.warnings) ? outputTestRun.warnings : [];
  const detail = blocked.length ? blocked.slice(0, 3).join(",") : (warnings.slice(0, 2).join(",") || String(outputTestRun.nextStep || "flow ready"));
  setText(controls.liveOutputTestRunStatus, `${status} | ${transport} | ${mode} | ${touched} | ${packets}pkt | ${detail}`);
}

export function renderOutputVerificationSummary(controls, outputVerification = null, fallback = "") {
  if (!controls.liveOutputVerificationStatus) return;
  if (!outputVerification) {
    setText(controls.liveOutputVerificationStatus, fallback || "VERIFY IDLE");
    return;
  }
  const status = String(outputVerification.status || "UNKNOWN").toUpperCase();
  const last = outputVerification.last || {};
  const transport = String(last.transportKind || "?").toUpperCase();
  const mode = last.physicalWrite ? "PHYSICAL-ACK" : last.dryRun ? "DRY-ACK" : "NO-WRITE";
  const touched = last.serialTouched ? "SERIAL" : last.networkTouched ? "ARTNET" : "NO-TOUCH";
  const packets = Number(last.packetCount || 0);
  const blocked = Array.isArray(outputVerification.blocked) ? outputVerification.blocked : [];
  const warnings = Array.isArray(outputVerification.warnings) ? outputVerification.warnings : [];
  const detail = blocked.length ? blocked.slice(0, 3).join(",") : (warnings.slice(0, 2).join(",") || String(outputVerification.nextStep || "verified"));
  setText(controls.liveOutputVerificationStatus, `${status} | ${transport} | ${mode} | ${touched} | ${packets}pkt | ${detail}`);
}

export function buildOutputTestRunRequest(readiness = null, token = "", transportKind = "serial", physical = false) {
  const base = buildOutputTargetRequest(readiness, transportKind);
  return {
    ...base,
    dryRun: !physical,
    physical: Boolean(physical),
    real: Boolean(physical),
    token: String(token || ""),
    fullLiveToken: String(token || ""),
    operatorConfirmed: true,
    source: physical ? "live-ops-ui-12V-physical" : "live-ops-ui-12V-dry"
  };
}

export function renderOutputMinimalFrameSummary(controls, outputMinimalFrame = null, fallback = "") {
  if (!controls.liveOutputMinimalFrameStatus) return;
  if (!outputMinimalFrame) {
    setText(controls.liveOutputMinimalFrameStatus, fallback || "MIN FRAME IDLE");
    return;
  }
  const status = String(outputMinimalFrame.status || "UNKNOWN").toUpperCase();
  const transport = String(outputMinimalFrame.transportKind || outputMinimalFrame.request?.transportKind || "?").toUpperCase();
  const mode = outputMinimalFrame.physical ? "PHYSICAL" : "DRY-RUN";
  const touched = outputMinimalFrame.serialTouched ? "SERIAL" : outputMinimalFrame.networkTouched ? "ARTNET" : "NO-TOUCH";
  const packets = Number(outputMinimalFrame.packetCount || outputMinimalFrame.outputSmokeTest?.packetCount || 0);
  const blocked = Array.isArray(outputMinimalFrame.blocked) ? outputMinimalFrame.blocked : [];
  const warnings = Array.isArray(outputMinimalFrame.warnings) ? outputMinimalFrame.warnings : [];
  const detail = blocked.length ? blocked.slice(0, 3).join(",") : (warnings.slice(0, 2).join(",") || String(outputMinimalFrame.nextStep || "minimal frame ready"));
  setText(controls.liveOutputMinimalFrameStatus, `${status} | ${transport} | ${mode} | ${touched} | ${packets}pkt | ${detail}`);
}

export function buildOutputMinimalFrameRequest(readiness = null, token = "", transportKind = "serial", physical = false) {
  const base = buildOutputTargetRequest(readiness, transportKind);
  return {
    ...base,
    dryRun: !physical,
    physical: Boolean(physical),
    real: Boolean(physical),
    frames: 1,
    pixels: Math.min(Number(base.pixels || 30), 30),
    brightness: Math.min(Number(base.brightness || 0.03), 0.03),
    token: String(token || ""),
    fullLiveToken: String(token || ""),
    operatorConfirmed: true,
    source: physical ? "live-ops-ui-12X-physical" : "live-ops-ui-12X-dry"
  };
}

export function renderOutputMultiFrameStreamSummary(controls, outputMultiFrameStream = null, fallback = "") {
  if (!controls.liveOutputMultiFrameStreamStatus) return;
  if (!outputMultiFrameStream) {
    setText(controls.liveOutputMultiFrameStreamStatus, fallback || "STREAM IDLE");
    return;
  }
  const status = String(outputMultiFrameStream.status || "UNKNOWN").toUpperCase();
  const transport = String(outputMultiFrameStream.transportKind || outputMultiFrameStream.request?.transportKind || "?").toUpperCase();
  const mode = outputMultiFrameStream.physical ? "PHYSICAL" : "DRY-RUN";
  const frames = `${Number(outputMultiFrameStream.okFrames || 0)}/${Number(outputMultiFrameStream.frames || 0)}f`;
  const packets = Number(outputMultiFrameStream.packetCount || 0);
  const jitter = Number(outputMultiFrameStream.timing?.jitterMs || 0).toFixed(1);
  const blocked = Array.isArray(outputMultiFrameStream.blocked) ? outputMultiFrameStream.blocked : [];
  const warnings = Array.isArray(outputMultiFrameStream.warnings) ? outputMultiFrameStream.warnings : [];
  const detail = blocked.length ? blocked.slice(0, 3).join(",") : (warnings.slice(0, 2).join(",") || String(outputMultiFrameStream.nextStep || "stream ready"));
  setText(controls.liveOutputMultiFrameStreamStatus, `${status} | ${transport} | ${mode} | ${frames} | ${packets}pkt | jitter ${jitter}ms | ${detail}`);
}

export function buildOutputMultiFrameStreamRequest(readiness = null, token = "", transportKind = "serial", physical = false) {
  const base = buildOutputMinimalFrameRequest(readiness, token, transportKind, physical);
  return {
    ...base,
    frames: 4,
    fps: 10,
    pixels: Math.min(Number(base.pixels || 30), 30),
    brightness: Math.min(Number(base.brightness || 0.03), 0.03),
    source: physical ? "live-ops-ui-12Y-physical" : "live-ops-ui-12Y-dry"
  };
}

export function renderOutputStreamTelemetrySummary(controls, outputStreamTelemetry = null, fallback = "") {
  if (!controls.liveOutputStreamTelemetryStatus) return;
  if (!outputStreamTelemetry) {
    setText(controls.liveOutputStreamTelemetryStatus, fallback || "TELEMETRY IDLE");
    return;
  }
  const run = outputStreamTelemetry.lastRun || outputStreamTelemetry;
  const status = String(outputStreamTelemetry.status || run.status || "UNKNOWN").toUpperCase();
  const transport = String(run.transportKind || "?").toUpperCase();
  const mode = run.physical ? "PHYSICAL" : "DRY-RUN";
  const frames = `${Number(run.okFrames || 0)}/${Number(run.frames || 0)}f`;
  const stopped = Number(run.stoppedFrames || 0);
  const jitter = Number(run.jitterMs || run.timing?.jitterMs || 0).toFixed(1);
  const packets = Number(run.packetCount || 0);
  const blocked = Array.isArray(run.blocked) ? run.blocked : [];
  const detail = blocked.length ? blocked.slice(0, 3).join(",") : String(run.nextStep || outputStreamTelemetry.decision || "telemetry ready");
  setText(controls.liveOutputStreamTelemetryStatus, `${status} | ${transport} | ${mode} | ${frames} | stop ${stopped} | ${packets}pkt | jitter ${jitter}ms | ${detail}`);
}

export function buildOutputStreamTelemetryRequest(readiness = null, token = "", transportKind = "serial") {
  const base = buildOutputMultiFrameStreamRequest(readiness, token, transportKind, false);
  return {
    ...base,
    dryRun: true,
    physical: false,
    frames: 6,
    fps: 12,
    source: "live-ops-ui-12Z-telemetry-dry"
  };
}

export function renderOutputReliabilityGateSummary(controls, outputReliabilityGate = null, fallback = "") {
  if (!controls.liveOutputReliabilityGateStatus) return;
  if (!outputReliabilityGate) {
    setText(controls.liveOutputReliabilityGateStatus, fallback || "RELIABILITY IDLE");
    return;
  }
  const gate = outputReliabilityGate.lastEvaluation || outputReliabilityGate;
  const status = String(gate.status || "UNKNOWN").toUpperCase();
  const transport = String(gate.transportKind || "?").toUpperCase();
  const metrics = gate.metrics || {};
  const frames = `${Number(metrics.okFrames || 0)}/${Number(metrics.frames || 0)}f`;
  const packets = Number(metrics.packetCount || 0);
  const jitter = Number(metrics.jitterMs || 0).toFixed(1);
  const blocked = Array.isArray(gate.blocked) ? gate.blocked : [];
  const warnings = Array.isArray(gate.warnings) ? gate.warnings : [];
  const detail = blocked.length ? blocked.slice(0, 2).join(",") : (warnings.slice(0, 2).join(",") || String(gate.nextStep || gate.decision || "reliability ready"));
  setText(controls.liveOutputReliabilityGateStatus, `${status} | ${transport} | ${frames} | ${packets}pkt | jitter ${jitter}ms | ${detail}`);
}

export function buildHardwareTestOutputRequest(readiness = null, token = "") {
  const context = readiness?.tokenGate?.context || {};
  return {
    requested: true,
    transportKind: "serial",
    pattern: "single-pixel-chase",
    pixels: 150,
    brightness: 0.05,
    fps: 10,
    frames: 8,
    durationMs: 5000,
    token: String(token || ""),
    mappingDigest: String(context.mappingDigest || "hardware-test-output-12L"),
    transportPlanDigest: String(context.transportPlanDigest || "hardware-test-output-12L"),
    outputMode: "serial",
    operatorConfirmed: true,
    confirmation: "CONFIRM_HARDWARE_TEST_OUTPUT_LOW_BRIGHTNESS"
  };
}

function setSnapshot(controls, key, value, detail = "") {
  const statusNode = controls?.[`dbg${key}Snapshot`];
  const detailNode = controls?.[`dbg${key}SnapshotDetail`];
  setText(statusNode, value);
  setText(detailNode, detail || "--");
}

function summarizeHealthSnapshot(controls, { live = null, readiness = null, sync = null, hardwareTestOutput = null, error = "" } = {}) {
  const safetyStatus = error
    ? "ERROR"
    : live?.emergencyStopLatched
      ? "STOPPED"
      : readiness?.status
        ? String(readiness.status).toUpperCase()
        : live?.armed
          ? "ARMED"
          : "SAFE";
  const blockers = Array.isArray(readiness?.blockers) ? readiness.blockers : [];
  const token = readiness?.tokenGate?.active ? "token ok" : "token off";
  setSnapshot(controls, "Safety", safetyStatus, `${live?.armed ? "armed" : "disarmed"} | ${token} | ${blockers.slice(0, 2).join(",") || "no readiness blockers"}`);

  const syncStatus = sync ? (sync.ok ? "SYNCED" : "DESYNC") : "UNKNOWN";
  const mismatches = Array.isArray(sync?.mismatches) ? sync.mismatches : [];
  const syncDetail = sync ? `${sync.liveStatus || "?"}/${sync.readinessStatus || "?"} | ${mismatches.slice(0, 2).join(",") || "ok"}` : "endpoint not refreshed";
  setSnapshot(controls, "Sync", syncStatus, syncDetail);

  if (hardwareTestOutput) {
    const hwStatus = String(hardwareTestOutput.status || "IDLE").toUpperCase();
    const blocked = Array.isArray(hardwareTestOutput.blocked) ? hardwareTestOutput.blocked : [];
    setSnapshot(controls, "Output", hwStatus, blocked.slice(0, 2).join(",") || `${hardwareTestOutput.frameCount || 0} test frames prepared`);
  }
}

export function summarizeActionableStatus(controls, { live = null, readiness = null, sync = null, hardwareTestOutput = null, audit = null, error = "" } = {}) {
  const blockers = [];
  const warnings = [];
  const liveStatus = String(live?.status || "unknown").toUpperCase();

  if (error) blockers.push(String(error));
  if (live?.emergencyStopLatched) blockers.push("EMERGENCY_STOP_LATCHED");
  if (!live?.armed) blockers.push("NOT_ARMED");
  if (!live?.physicalWriteAllowed) blockers.push("PHYSICAL_WRITE_BLOCKED");

  const readinessBlockers = Array.isArray(readiness?.blockers) ? readiness.blockers : [];
  blockers.push(...readinessBlockers.slice(0, 6));

  const tokenBlocked = Array.isArray(readiness?.tokenGate?.blocked) ? readiness.tokenGate.blocked : [];
  if (!readiness?.tokenGate?.active) blockers.push("FULL_TOKEN_INACTIVE");
  blockers.push(...tokenBlocked.slice(0, 4));

  const syncMismatches = Array.isArray(sync?.mismatches) ? sync.mismatches : [];
  if (sync && !sync.ok) blockers.push("SERVER_RUNTIME_DESYNC");
  blockers.push(...syncMismatches.slice(0, 4));
  if (Array.isArray(sync?.warnings)) warnings.push(...sync.warnings.slice(0, 4));

  const hwBlocked = Array.isArray(hardwareTestOutput?.blocked) ? hardwareTestOutput.blocked : [];
  blockers.push(...hwBlocked.slice(0, 4));
  if (Array.isArray(hardwareTestOutput?.warnings)) warnings.push(...hardwareTestOutput.warnings.slice(0, 4));

  const entries = Array.isArray(audit?.entries) ? audit.entries : [];
  const lastEvent = entries[0]?.event || entries[0]?.type || entries.at?.(-1)?.event || "audit-idle";
  const uniqueBlockers = freezeUniqueList(blockers.filter(Boolean).map(String));
  const uniqueWarnings = freezeUniqueList(warnings.filter(Boolean).map(String));

  let nextStep = "refresh live panel";
  if (live?.emergencyStopLatched) nextStep = "clear emergency stop az po fyzicke kontrole";
  else if (sync && !sync.ok) nextStep = "vyresit server/runtime desync";
  else if (!readiness) nextStep = "spustit readiness refresh";
  else if (!readiness?.tokenGate?.active) nextStep = "issue + validate full token";
  else if (!live?.armed) nextStep = "confirm dry arm -> ARM DRY";
  else if (!live?.physicalWriteAllowed) nextStep = "spustit preflight, HW test jen low brightness";
  else if (!uniqueBlockers.length) nextStep = "system pripraveny pro dalsi guarded krok";

  setText(controls.liveBlockersStatus, uniqueBlockers.length ? uniqueBlockers.slice(0, 8).join(" | ") : `NO BLOCKERS | ${liveStatus}`);
  setText(controls.liveOperatorNextStep, nextStep);
  setText(controls.liveCriticalWarnings, uniqueWarnings.length ? uniqueWarnings.slice(0, 6).join(" | ") : `latest audit ${lastEvent}`);
  summarizeHealthSnapshot(controls, { live, readiness, sync, hardwareTestOutput, audit, error });
}

export function renderAuditSummary(controls, audit = null, fallback = "") {
  if (!controls.liveAuditStatus) return;
  if (!audit) {
    setText(controls.liveAuditStatus, fallback || "AUDIT IDLE");
    return;
  }
  const entries = Array.isArray(audit.entries) ? audit.entries : Array.isArray(audit) ? audit : [];
  const latest = entries[0] || entries.at?.(-1) || null;
  const event = latest?.event || latest?.type || latest?.action || "no-entry";
  const count = Number(audit.count ?? entries.length ?? 0);
  setText(controls.liveAuditStatus, `${count} entries | latest ${event}`);
}

export function mapTransportKindFromOutputMode(outputMode = "") {
  const mode = String(outputMode || "").toLowerCase();
  if (mode === "artnet") return "artnet";
  if (mode === "udp") return "udp";
  if (mode === "blx") return "blx";
  return "serial";
}

export function buildPreflightProbeRequest(readiness = null, token = "") {
  const context = readiness?.tokenGate?.context || {};
  const outputMode = String(context.outputMode || "serial");
  return {
    token: String(token || ""),
    transportKind: mapTransportKindFromOutputMode(outputMode),
    outputMode,
    mappingDigest: String(context.mappingDigest || ""),
    transportPlanDigest: String(context.transportPlanDigest || ""),
    operatorConfirmed: false,
    confirmation: "ui_preflight_probe_only"
  };
}

export { setText };
