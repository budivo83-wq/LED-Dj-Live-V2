import fs from "fs";
import path from "path";

export const LIVE_STATE_STORE_VERSION = "11Y-persistent-live-state-store";

const DEFAULT_STATE = Object.freeze({
  version: LIVE_STATE_STORE_VERSION,
  armed: false,
  status: "DISARMED",
  emergencyStopLatched: false,
  physicalWriteAllowed: false,
  armToken: null,
  armTokenDigest: "none",
  lastIntent: null,
  lastDisarmReason: "startup_disarm",
  updatedAt: null
});

function clone(value) {
  return JSON.parse(JSON.stringify(value || {}));
}

function digestText(value) {
  const text = String(value || "");
  let hash = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function safeIntent(intent = {}) {
  return Object.freeze({
    requested: Boolean(intent.requested),
    operatorConfirmed: Boolean(intent.operatorConfirmed),
    dryRunAcknowledged: intent.dryRunAcknowledged !== false,
    source: String(intent.source || "live-ui"),
    mode: String(intent.mode || "controlled-arm"),
    note: String(intent.note || "").slice(0, 160)
  });
}

export function createLiveStateStore({ stateFile, now = () => Date.now() } = {}) {
  if (!stateFile) throw new Error("live state store requires stateFile");

  function sanitize(nextState = {}, reason = "sanitize") {
    const source = clone(nextState);
    const emergencyStopLatched = Boolean(source.emergencyStopLatched);
    return Object.freeze({
      ...DEFAULT_STATE,
      version: LIVE_STATE_STORE_VERSION,
      armed: false,
      status: emergencyStopLatched ? "STOPPED" : "DISARMED",
      emergencyStopLatched,
      physicalWriteAllowed: false,
      armToken: null,
      armTokenDigest: source.armTokenDigest ? String(source.armTokenDigest) : "none",
      lastIntent: source.lastIntent && typeof source.lastIntent === "object" ? safeIntent(source.lastIntent) : null,
      lastDisarmReason: String(source.lastDisarmReason || reason),
      updatedAt: Number.isFinite(Number(source.updatedAt)) ? Number(source.updatedAt) : now()
    });
  }

  function loadRaw() {
    try {
      return JSON.parse(fs.readFileSync(stateFile, "utf8"));
    } catch {
      return {};
    }
  }

  function persist(state) {
    fs.mkdirSync(path.dirname(stateFile), { recursive: true });
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
    return state;
  }

  function startupState() {
    return persist(sanitize(loadRaw(), "startup_disarm"));
  }

  function read() {
    return sanitize(loadRaw(), "read_sanitize");
  }

  function requestArmIntent(intent = {}) {
    const previous = read();
    const lastIntent = safeIntent({
      ...intent,
      requested: true,
      operatorConfirmed: intent.operatorConfirmed === true,
      dryRunAcknowledged: intent.dryRunAcknowledged !== false
    });
    const tokenBasis = JSON.stringify({ lastIntent, at: now() });
    return persist(Object.freeze({
      ...DEFAULT_STATE,
      version: LIVE_STATE_STORE_VERSION,
      armed: false,
      status: previous.emergencyStopLatched ? "STOPPED" : "ARM_INTENT_RECORDED",
      emergencyStopLatched: previous.emergencyStopLatched,
      physicalWriteAllowed: false,
      armToken: null,
      armTokenDigest: `intent-${digestText(tokenBasis)}`,
      lastIntent,
      lastDisarmReason: previous.emergencyStopLatched ? "emergency_stop_latched" : "not_armed_dry_intent_only",
      updatedAt: now()
    }));
  }

  function disarm(reason = "operator_disarm") {
    const previous = read();
    return persist(Object.freeze({
      ...DEFAULT_STATE,
      version: LIVE_STATE_STORE_VERSION,
      armed: false,
      status: previous.emergencyStopLatched ? "STOPPED" : "DISARMED",
      emergencyStopLatched: previous.emergencyStopLatched,
      physicalWriteAllowed: false,
      armToken: null,
      armTokenDigest: "none",
      lastIntent: null,
      lastDisarmReason: String(reason || "operator_disarm"),
      updatedAt: now()
    }));
  }

  function emergencyStop(reason = "operator_emergency_stop") {
    return persist(Object.freeze({
      ...DEFAULT_STATE,
      version: LIVE_STATE_STORE_VERSION,
      armed: false,
      status: "STOPPED",
      emergencyStopLatched: true,
      physicalWriteAllowed: false,
      armToken: null,
      armTokenDigest: "none",
      lastIntent: null,
      lastDisarmReason: String(reason || "operator_emergency_stop"),
      updatedAt: now()
    }));
  }

  function clearEmergencyStop(reason = "operator_clear_emergency_stop") {
    return persist(Object.freeze({
      ...DEFAULT_STATE,
      version: LIVE_STATE_STORE_VERSION,
      armed: false,
      status: "DISARMED",
      emergencyStopLatched: false,
      physicalWriteAllowed: false,
      armToken: null,
      armTokenDigest: "none",
      lastIntent: null,
      lastDisarmReason: String(reason || "operator_clear_emergency_stop"),
      updatedAt: now()
    }));
  }

  return Object.freeze({
    version: LIVE_STATE_STORE_VERSION,
    startupState,
    read,
    requestArmIntent,
    disarm,
    emergencyStop,
    clearEmergencyStop
  });
}
