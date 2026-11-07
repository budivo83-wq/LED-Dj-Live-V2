export const LIVE_EMERGENCY_INTERLOCK_VERSION = "12C-emergency-stop-blackout-interlock";

function normalizeBlackoutRequest(value = {}) {
  return Object.freeze({
    requested: Boolean(value.requested || value.blackoutRequested),
    allowPhysicalBlackout: Boolean(value.allowPhysicalBlackout),
    source: String(value.source || "operator"),
    reason: String(value.reason || "emergency_stop")
  });
}

export function evaluateLiveEmergencyInterlock({
  liveState = null,
  blackoutRequest = {},
  transportBoundary = null
} = {}) {
  const blackout = normalizeBlackoutRequest(blackoutRequest);
  const emergencyStopLatched = Boolean(liveState?.emergencyStopLatched);
  const blocked = [];
  const warnings = [];

  if (emergencyStopLatched) blocked.push("EMERGENCY_STOP_LATCHED");
  if (liveState?.armed === true) blocked.push("LIVE_STATE_MUST_BE_DISARMED_BY_STOP");
  if (liveState?.physicalWriteAllowed === true) blocked.push("PHYSICAL_WRITE_MUST_BE_FALSE");
  if (blackout.requested && !blackout.allowPhysicalBlackout) warnings.push("BLACKOUT_PHYSICAL_SEND_NOT_AUTHORIZED");

  const boundaryDecision = transportBoundary && typeof transportBoundary.evaluate === "function"
    ? transportBoundary.evaluate({
      transportKind: "blackout",
      packetCount: blackout.requested ? 1 : 0,
      payloadBytes: 0,
      routeDigest: "blackout"
    })
    : null;

  return Object.freeze({
    version: LIVE_EMERGENCY_INTERLOCK_VERSION,
    ok: true,
    decision: emergencyStopLatched ? "STOP_LATCHED_BLACKOUT_BLOCKED" : "STOP_CLEAR",
    status: emergencyStopLatched ? "STOPPED" : "CLEAR",
    emergencyStopLatched,
    blackoutRequested: blackout.requested,
    blackoutPhysicalAuthorized: false,
    blackoutPacketPrepared: false,
    boundaryDecision,
    blocked: Object.freeze(blocked),
    warnings: Object.freeze(warnings),
    armed: Boolean(liveState?.armed),
    physicalWriteAllowed: false,
    outputTouched: false,
    serialTouched: false,
    networkTouched: false,
    safety: "12C emergency interlock is highest priority; STOP latches, disarms, and blocks blackout physical send by default"
  });
}

export function createLiveEmergencyInterlock({ liveStateStore, liveTransportBoundary = null } = {}) {
  if (!liveStateStore) throw new Error("live emergency interlock requires liveStateStore");

  function evaluate(blackoutRequest = {}) {
    return evaluateLiveEmergencyInterlock({
      liveState: liveStateStore.read(),
      blackoutRequest,
      transportBoundary: liveTransportBoundary
    });
  }

  function stop(reason = "operator_emergency_stop") {
    const live = liveStateStore.emergencyStop(reason);
    return Object.freeze({
      live,
      interlock: evaluateLiveEmergencyInterlock({
        liveState: live,
        blackoutRequest: { requested: true, source: "emergency-stop", reason },
        transportBoundary: liveTransportBoundary
      })
    });
  }

  function clear(reason = "operator_clear_emergency_stop") {
    const live = liveStateStore.clearEmergencyStop(reason);
    return Object.freeze({
      live,
      interlock: evaluateLiveEmergencyInterlock({
        liveState: live,
        blackoutRequest: { requested: false, source: "clear-stop", reason },
        transportBoundary: liveTransportBoundary
      })
    });
  }

  return Object.freeze({
    version: LIVE_EMERGENCY_INTERLOCK_VERSION,
    evaluate,
    stop,
    clear
  });
}
