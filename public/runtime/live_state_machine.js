// STEP 11W — Live Runtime State Machine
// Runtime state classification only. This module turns the current guarded live
// evidence into a small explicit state machine so the future physical executor
// has one canonical source of truth. It never calls serial, network, socket,
// DOM, filesystem, timers, or adapter write APIs.

export const LIVE_STATE_MACHINE_VERSION = "11W-live-runtime-state-machine";

function safeList(value) {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function digestParts(parts) {
  const raw = parts.map((part) => String(part ?? "")).join("|");
  let hash = 2166136261 >>> 0;
  for (let i = 0; i < raw.length; i += 1) {
    hash ^= raw.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function createIdleLiveStateMachine(reason = "idle") {
  return Object.freeze({
    version: LIVE_STATE_MACHINE_VERSION,
    enabled: false,
    ran: false,
    ok: false,
    state: "locked",
    decision: "DISABLED",
    status: "OFF",
    severity: "off",
    canArm: false,
    isArmed: false,
    canExecute: false,
    wouldExecute: false,
    physicalWriteAllowed: false,
    outputTouched: false,
    networkTouched: false,
    serialTouched: false,
    evidence: Object.freeze({
      readiness: false,
      mirror: false,
      controlledArm: false,
      executor: false,
      diagnostics: false,
      token: false,
      nullTransport: false
    }),
    blocked: [reason],
    warnings: [],
    transition: "none",
    digest: "none",
    safety: "11W idle state machine only; no serial/network/socket/write API is called"
  });
}

export function evaluateLiveStateMachine({
  enabled = false,
  frameId = 0,
  readinessGate = null,
  mirrorValidation = null,
  controlledArmPhase = null,
  executor = null,
  diagnostics = null,
  operatorIntent = null
} = {}) {
  if (!enabled) return createIdleLiveStateMachine("live_state_machine_disabled");

  const blocked = [];
  const warnings = [];
  const requested = Boolean(operatorIntent?.requested);
  const confirmed = Boolean(operatorIntent?.operatorConfirmed);
  const dryAck = Boolean(operatorIntent?.dryRunAcknowledged);
  const wantsArm = Boolean(requested && confirmed && dryAck);

  const readinessOk = Boolean(readinessGate?.ok);
  const mirrorOk = Boolean(mirrorValidation?.ok);
  const controlledArmOk = Boolean(controlledArmPhase?.ok && controlledArmPhase?.canEnterControlledArm && controlledArmPhase?.token);
  const executorReady = Boolean(executor?.ok && executor?.executorReady && executor?.controlledArmTokenAccepted);
  const diagnosticsReady = Boolean(diagnostics?.ok && diagnostics?.contractReady);
  const token = String(controlledArmPhase?.token || "");
  const nullTransportTouched = Boolean(executor?.nullTransportTouched);

  if (!readinessOk) blocked.push("READINESS_GATE_NOT_OK");
  if (!mirrorOk) blocked.push("LIVE_MIRROR_NOT_OK");
  if (!wantsArm) blocked.push("OPERATOR_ARM_INTENT_MISSING");
  if (!controlledArmOk) blocked.push("CONTROLLED_ARM_NOT_READY");
  if (!executorReady) blocked.push("EXECUTOR_NOT_READY");
  if (!diagnosticsReady) blocked.push("DIAGNOSTICS_CONTRACT_NOT_READY");
  if (!token) blocked.push("CONTROLLED_ARM_TOKEN_MISSING");
  if (!nullTransportTouched && executorReady) warnings.push("EXECUTOR_READY_WITHOUT_NULL_TRANSPORT_TOUCH");

  const sideEffectsClean = executor?.physicalWriteAllowed === false
    && executor?.outputTouched === false
    && executor?.networkTouched === false
    && executor?.serialTouched === false;
  if (!sideEffectsClean) blocked.push("SIDE_EFFECT_OR_PHYSICAL_WRITE_DETECTED");

  let state = "locked";
  if (readinessOk && mirrorOk) state = "ready";
  if (state === "ready" && wantsArm && controlledArmOk) state = "armed";
  if (state === "armed" && executorReady && diagnosticsReady && sideEffectsClean) state = "executing";
  if (blocked.length && state === "locked") state = "locked";
  if (blocked.length && state !== "locked" && state !== "ready") state = "blocked";

  const ok = state === "executing";
  const canArm = Boolean(readinessOk && mirrorOk && wantsArm && controlledArmOk);
  const isArmed = state === "armed" || state === "executing";
  const canExecute = ok;
  const digest = ok
    ? `11W:${Number(frameId || 0)}:${digestParts([state, token, executor?.digest, diagnostics?.digest])}`
    : `11W-${state.toUpperCase()}:${digestParts(blocked.length ? blocked : [state, frameId])}`;

  return Object.freeze({
    version: LIVE_STATE_MACHINE_VERSION,
    enabled: true,
    ran: true,
    ok,
    state,
    decision: ok ? "NULL_EXECUTION_STATE_READY" : `${state.toUpperCase()}_STATE`,
    status: ok ? "EXECUTING_NULL" : state.toUpperCase(),
    severity: ok ? "ready" : (state === "ready" || state === "armed" ? "warning" : "blocked"),
    canArm,
    isArmed,
    canExecute,
    wouldExecute: ok,
    physicalWriteAllowed: false,
    outputTouched: false,
    networkTouched: false,
    serialTouched: false,
    evidence: Object.freeze({
      readiness: readinessOk,
      mirror: mirrorOk,
      controlledArm: controlledArmOk,
      executor: executorReady,
      diagnostics: diagnosticsReady,
      token: Boolean(token),
      nullTransport: nullTransportTouched
    }),
    blocked,
    warnings,
    transition: ok ? "armed->executing-null" : `hold:${state}`,
    digest,
    safety: "11W classifies live runtime state only and permits null execution evidence; physical write remains blocked"
  });
}
