// STEP 11V — Live Executor Diagnostics + Guarded Transport Contract
// Diagnostics only. This module creates a visible contract for the future live
// transport boundary, but it never calls serial, network, socket, DOM,
// filesystem, or adapter write APIs.

import { freezeUniqueList } from "./list_utils.js";

export const LIVE_EXECUTOR_DIAGNOSTICS_VERSION = "11V-live-executor-diagnostics-contract";

function digestParts(parts) {
  const raw = parts.map((part) => String(part ?? "")).join("|");
  let hash = 2166136261 >>> 0;
  for (let i = 0; i < raw.length; i += 1) {
    hash ^= raw.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function createIdleLiveExecutorDiagnostics(reason = "idle") {
  return Object.freeze({
    version: LIVE_EXECUTOR_DIAGNOSTICS_VERSION,
    enabled: false,
    ran: false,
    ok: false,
    decision: "DISABLED",
    status: "OFF",
    severity: "off",
    contractReady: false,
    contractMode: "disabled",
    guardedTransportContract: null,
    allowedTransportKinds: [],
    requiredEvidence: ["controlled-arm-token", "readiness-gate", "mirror-validation", "batch-schedule"],
    blocked: [reason],
    warnings: [],
    invariants: Object.freeze({
      physicalWriteAllowed: false,
      outputTouched: false,
      networkTouched: false,
      serialTouched: false,
      adapterWriteApiCalled: false
    }),
    digest: "none",
    safety: "11V idle diagnostics only; no serial/network/socket/write API is called"
  });
}

export function buildLiveExecutorDiagnostics({ enabled = false, executor = null, frameId = 0 } = {}) {
  if (!enabled) return createIdleLiveExecutorDiagnostics("live_executor_diagnostics_disabled");

  const blocked = [];
  const warnings = [];
  const ex = executor || {};
  const executorReady = Boolean(ex.ok && ex.executorReady);
  const tokenAccepted = Boolean(ex.controlledArmTokenAccepted);
  const nullTransportTouched = Boolean(ex.nullTransportTouched);
  const physicalBlocked = ex.physicalWriteAllowed === false;
  const outputClean = ex.outputTouched === false;
  const networkClean = ex.networkTouched === false;
  const serialClean = ex.serialTouched === false;

  if (!executorReady) blocked.push("EXECUTOR_NOT_READY");
  if (!tokenAccepted) blocked.push("CONTROLLED_ARM_TOKEN_NOT_ACCEPTED");
  if (!physicalBlocked) blocked.push("PHYSICAL_WRITE_NOT_BLOCKED");
  if (!outputClean) blocked.push("OUTPUT_SIDE_EFFECT_DETECTED");
  if (!networkClean) blocked.push("NETWORK_SIDE_EFFECT_DETECTED");
  if (!serialClean) blocked.push("SERIAL_SIDE_EFFECT_DETECTED");
  if (!nullTransportTouched && executorReady) warnings.push("NULL_TRANSPORT_NOT_TOUCHED_WHILE_READY");

  const plannedBatchCount = Number(ex.plannedBatchCount || 0);
  const plannedPacketCount = Number(ex.plannedPacketCount || 0);
  const plannedPayloadBytes = Number(ex.plannedPayloadBytes || 0);
  const allowedTransportKinds = freezeUniqueList((Array.isArray(ex.plannedTransports) ? ex.plannedTransports : []).map(String));
  if (plannedBatchCount <= 0) blocked.push("NO_PLANNED_BATCHES");
  if (plannedPacketCount <= 0) blocked.push("NO_PLANNED_PACKETS");
  if (plannedPayloadBytes <= 0) warnings.push("PAYLOAD_BYTES_UNKNOWN_OR_ZERO");
  if (!allowedTransportKinds.length) blocked.push("NO_TRANSPORT_KIND_IN_CONTRACT");

  const ok = blocked.length === 0;
  const contract = Object.freeze({
    mode: "null-transport-contract",
    physicalWriteAllowed: false,
    futurePhysicalWriteRequiresNewFlag: true,
    futureTransportMustImplement: ["open", "writeBatch", "flush", "close", "health"],
    allowedTransportKinds,
    plannedBatchCount,
    plannedPacketCount,
    plannedPayloadBytes,
    nullTransportTouched,
    tokenDigest: String(ex.tokenDigest || "none"),
    executorDigest: String(ex.digest || "none")
  });

  const digest = ok
    ? `11V:${Number(frameId || 0)}:${digestParts([contract.mode, allowedTransportKinds.join("+"), plannedBatchCount, plannedPacketCount, plannedPayloadBytes, contract.tokenDigest])}`
    : `11V-BLOCKED:${digestParts(blocked)}`;

  return Object.freeze({
    version: LIVE_EXECUTOR_DIAGNOSTICS_VERSION,
    enabled: true,
    ran: true,
    ok,
    decision: ok ? "CONTRACT_READY" : "CONTRACT_BLOCKED",
    status: ok ? "CONTRACT_READY" : "BLOCKED",
    severity: ok ? "ready" : "blocked",
    contractReady: ok,
    contractMode: "null-transport-contract",
    guardedTransportContract: contract,
    allowedTransportKinds,
    requiredEvidence: ["controlled-arm-token", "readiness-gate", "mirror-validation", "batch-schedule"],
    blocked,
    warnings,
    invariants: Object.freeze({
      physicalWriteAllowed: false,
      outputTouched: false,
      networkTouched: false,
      serialTouched: false,
      adapterWriteApiCalled: false
    }),
    digest,
    safety: "11V exposes the guarded transport contract for a future live executor; physical write remains blocked"
  });
}
