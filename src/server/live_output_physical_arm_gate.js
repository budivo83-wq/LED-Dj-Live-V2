import { clampInt, freezeUniqueList, normalizeTransport } from "./live_output_common.js";

export const LIVE_OUTPUT_PHYSICAL_ARM_GATE_VERSION = "12U-output-physical-arm-confirmation-gate";

const DEFAULT_TTL_MS = 90_000;
const REQUIRED_CONFIRMATION = "CONFIRM_PHYSICAL_OUTPUT_ARM_LOW_BRIGHTNESS";
const SUPPORTED_TRANSPORTS = new Set(["serial", "artnet"]);

function nowMs() { return Date.now(); }
function nowIso() { return new Date().toISOString(); }
function clampTtl(value, fallback = DEFAULT_TTL_MS) {
  return clampInt(value, 5_000, 300_000, fallback);
}

export function createLiveOutputPhysicalArmGate({ ttlMs = DEFAULT_TTL_MS, physicalWriteEnabled = false } = {}) {
  const maxTtlMs = clampTtl(ttlMs);
  let armed = false;
  let transportKind = "none";
  let armedAt = 0;
  let expiresAt = 0;
  let reason = "startup_disarmed";
  let armCount = 0;

  function expired(at = nowMs()) { return armed && expiresAt > 0 && at >= expiresAt; }
  function normalizeState() {
    if (expired()) {
      armed = false;
      reason = "physical_output_arm_expired";
    }
  }
  function snapshot() {
    normalizeState();
    const remainingMs = armed ? Math.max(0, expiresAt - nowMs()) : 0;
    return Object.freeze({
      version: LIVE_OUTPUT_PHYSICAL_ARM_GATE_VERSION,
      ok: true,
      armed,
      status: armed ? "ARMED" : "DISARMED",
      transportKind,
      physicalWriteEnabled: Boolean(physicalWriteEnabled),
      armedAt: armedAt ? new Date(armedAt).toISOString() : null,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      remainingMs,
      armCount,
      reason,
      requiredConfirmation: REQUIRED_CONFIRMATION,
      safety: "12U physical output arm is short-lived and only unlocks dryRun:false route execution; bridge/writer/env gates still apply."
    });
  }
  function arm(request = {}) {
    const transport = normalizeTransport(request.transportKind || request.transport || request.outputMode, { aliases: ["udp", "network"] });
    const blocked = [];
    if (!SUPPORTED_TRANSPORTS.has(transport)) blocked.push("PHYSICAL_ARM_TRANSPORT_UNSUPPORTED");
    if (!request.operatorConfirmed || String(request.confirmation || "") !== REQUIRED_CONFIRMATION) blocked.push("PHYSICAL_ARM_CONFIRMATION_MISSING");
    if (!physicalWriteEnabled) blocked.push("PHYSICAL_ARM_ENV_DISABLED");
    if (blocked.length) {
      armed = false;
      transportKind = transport;
      reason = blocked[0];
      return Object.freeze({ ...snapshot(), ok: false, status: "BLOCKED", blocked: freezeUniqueList(blocked) });
    }
    const at = nowMs();
    armed = true;
    transportKind = transport;
    armedAt = at;
    expiresAt = at + clampTtl(request.ttlMs, maxTtlMs);
    reason = String(request.reason || "operator_physical_output_arm_12U");
    armCount += 1;
    return Object.freeze({ ...snapshot(), ok: true, status: "ARMED", blocked: Object.freeze([]), armedEventAt: nowIso() });
  }
  function disarm(request = {}) {
    armed = false;
    reason = String(request.reason || "operator_physical_output_disarm_12U");
    return Object.freeze({ ...snapshot(), ok: true, status: "DISARMED" });
  }
  function evaluateSend(request = {}) {
    const state = snapshot();
    const requestedTransport = normalizeTransport(request.transportKind || request.transport || request.outputMode);
    const blocked = [];
    if (request.dryRun !== false) return Object.freeze({ ...state, sendAllowed: true, decision: "PHYSICAL_ARM_NOT_REQUIRED_FOR_DRY_RUN", requestedTransport, blocked: freezeUniqueList([]) });
    if (!state.armed) blocked.push("PHYSICAL_OUTPUT_NOT_ARMED_12U");
    if (!state.physicalWriteEnabled) blocked.push("PHYSICAL_OUTPUT_ENV_DISABLED_12U");
    if (state.armed && state.transportKind !== requestedTransport) blocked.push("PHYSICAL_OUTPUT_ARM_TRANSPORT_MISMATCH_12U");
    return Object.freeze({
      ...state,
      requestedTransport,
      sendAllowed: blocked.length === 0,
      decision: blocked.length ? "PHYSICAL_OUTPUT_SEND_BLOCKED_BY_12U" : "PHYSICAL_OUTPUT_SEND_ALLOWED_BY_12U",
      blocked: freezeUniqueList(blocked)
    });
  }
  return Object.freeze({
    version: LIVE_OUTPUT_PHYSICAL_ARM_GATE_VERSION,
    snapshot,
    arm,
    disarm,
    evaluateSend
  });
}
