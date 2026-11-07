// STEP 11U — Live Executor Skeleton v2
// This is the first single executor boundary after controlled-arm. It accepts
// only already-built scheduler batches and a valid controlled-arm phase, but it
// deliberately executes through a null/mock transport. No serial, network,
// socket, DOM, filesystem, or adapter write API is called here.
// No serial, network, socket, DOM, filesystem, or adapter write API is called.

export const LIVE_EXECUTOR_SKELETON_VERSION = "11U-live-executor-skeleton-v2";

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function digestToken(text) {
  const raw = String(text || "none");
  let hash = 2166136261 >>> 0;
  for (let i = 0; i < raw.length; i += 1) {
    hash ^= raw.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function sumPacketsFromBatches(batches) {
  let packets = 0;
  let payloadBytes = 0;
  const transports = [];
  for (const batch of safeArray(batches)) {
    packets += Number(batch?.packetCount || batch?.packetEstimate || batch?.packets?.length || 0);
    payloadBytes += Number(batch?.payloadBytes || 0);
    const transport = String(batch?.transport || batch?.protocol || "").trim();
    if (transport && !transports.includes(transport)) transports.push(transport);
  }
  return { packets, payloadBytes, transports };
}

export function createIdleLiveExecutorSkeleton(reason = "idle") {
  return Object.freeze({
    version: LIVE_EXECUTOR_SKELETON_VERSION,
    enabled: false,
    ran: false,
    ok: false,
    decision: "DISABLED",
    status: "OFF",
    severity: "off",
    executorReady: false,
    controlledArmTokenAccepted: false,
    tokenDigest: "none",
    plannedBatchCount: 0,
    plannedPacketCount: 0,
    plannedPayloadBytes: 0,
    plannedTransports: [],
    nullTransportEnabled: true,
    nullTransportTouched: false,
    mockExecuteCount: 0,
    physicalWriteAllowed: false,
    outputTouched: false,
    networkTouched: false,
    serialTouched: false,
    frameAuthorityTouched: false,
    blocked: [reason],
    warnings: [],
    digest: "none",
    safety: "11U idle live executor skeleton; no serial/network/socket/write API is called"
  });
}

export function runLiveExecutorSkeleton({
  enabled = false,
  controlledArmPhase = null,
  multiOutputRouter = null,
  frameId = 0,
  requireControlledArm = true
} = {}) {
  if (!enabled) return createIdleLiveExecutorSkeleton("live_executor_skeleton_disabled");

  const blocked = [];
  const warnings = [];
  const armOk = Boolean(controlledArmPhase?.ok && controlledArmPhase?.canEnterControlledArm);
  const token = String(controlledArmPhase?.token || "");
  if (requireControlledArm && !armOk) blocked.push("CONTROLLED_ARM_NOT_READY");
  if (requireControlledArm && !token) blocked.push("CONTROLLED_ARM_TOKEN_MISSING");

  const scheduleOk = Boolean(multiOutputRouter?.batchExecutionScheduleOk || multiOutputRouter?.executionCommitPreviewOk);
  if (!scheduleOk) blocked.push("EXECUTION_SCHEDULE_NOT_READY");

  const batches = safeArray(multiOutputRouter?.transportBatches);
  const totals = sumPacketsFromBatches(batches);
  const batchCount = Number(multiOutputRouter?.transportBatchCount || batches.length || 0);
  const packetCount = Number(totals.packets || multiOutputRouter?.commitPlanPackets || 0);
  const payloadBytes = Number(totals.payloadBytes || multiOutputRouter?.commitPlanPayloadBytes || 0);
  const transports = totals.transports.length ? totals.transports : safeArray(multiOutputRouter?.commitPlanTransports).map(String);

  if (batchCount <= 0) blocked.push("NO_TRANSPORT_BATCHES");
  if (packetCount <= 0) blocked.push("NO_PACKETS_PLANNED");
  if (payloadBytes <= 0) warnings.push("PAYLOAD_BYTES_UNKNOWN_OR_ZERO");

  const ok = blocked.length === 0;
  const tokenDigest = token ? digestToken(token) : "none";
  const digest = ok
    ? `11U:${Number(frameId || 0)}:${batchCount}:${packetCount}:${payloadBytes}:${tokenDigest}`
    : `11U-BLOCKED:${blocked.join("+")}`;

  return Object.freeze({
    version: LIVE_EXECUTOR_SKELETON_VERSION,
    enabled: true,
    ran: true,
    ok,
    decision: ok ? "NULL_EXECUTOR_READY" : "EXECUTOR_BLOCKED",
    status: ok ? "NULL_EXECUTOR_READY" : "BLOCKED",
    severity: ok ? "ready" : "blocked",
    executorReady: ok,
    controlledArmTokenAccepted: Boolean(ok && token),
    tokenDigest,
    plannedBatchCount: ok ? batchCount : Math.max(0, batchCount),
    plannedPacketCount: ok ? packetCount : Math.max(0, packetCount),
    plannedPayloadBytes: ok ? payloadBytes : Math.max(0, payloadBytes),
    plannedTransports: transports.slice(0, 12),
    nullTransportEnabled: true,
    nullTransportTouched: ok,
    mockExecuteCount: ok ? batchCount : 0,
    physicalWriteAllowed: false,
    outputTouched: false,
    networkTouched: false,
    serialTouched: false,
    frameAuthorityTouched: false,
    blocked,
    warnings,
    digest,
    safety: "11U live executor skeleton accepts controlled-arm evidence and records a null execution only; physical write remains blocked"
  });
}
