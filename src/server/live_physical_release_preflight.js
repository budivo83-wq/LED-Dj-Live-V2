export const LIVE_PHYSICAL_RELEASE_PREFLIGHT_VERSION = "12H-physical-release-preflight-gate";

function normalizeRequest(request = {}) {
  return Object.freeze({
    transportKind: String(request.transportKind || request.transport || "serial").toLowerCase(),
    token: String(request.fullLiveToken || request.token || ""),
    mappingDigest: String(request.mappingDigest || ""),
    transportPlanDigest: String(request.transportPlanDigest || request.routeDigest || ""),
    outputMode: String(request.outputMode || request.transportKind || request.transport || "serial"),
    operatorConfirmed: Boolean(request.operatorConfirmed),
    confirmation: String(request.confirmation || "")
  });
}

export function evaluateLivePhysicalReleasePreflight({
  enabled = false,
  request = {},
  liveStateStore = null,
  liveFullEnableTokenGate = null,
  liveEmergencyInterlock = null,
  liveReadinessSummary = null
} = {}) {
  const normalized = normalizeRequest(request);
  const live = liveStateStore?.read?.() || null;
  const emergency = liveEmergencyInterlock?.evaluate?.({ requested: false, source: "physical-release-preflight-12H" }) || null;
  const token = liveFullEnableTokenGate?.validate?.(normalized) || null;
  const readiness = liveReadinessSummary?.read?.() || null;
  const blocked = [];

  if (!enabled) blocked.push("PHYSICAL_RELEASE_ENV_DISABLED");
  if (!["serial", "artnet", "udp", "blx"].includes(normalized.transportKind)) blocked.push("PHYSICAL_RELEASE_TRANSPORT_UNSUPPORTED");
  if (live?.emergencyStopLatched) blocked.push("EMERGENCY_STOP_LATCHED");
  if (emergency?.emergencyStopLatched) blocked.push("EMERGENCY_INTERLOCK_STOPPED");
  if (token?.ok !== true) blocked.push("FULL_LIVE_TOKEN_NOT_VALID");
  if (readiness?.physicalWriteAllowed !== true) blocked.push("READINESS_PHYSICAL_WRITE_FALSE");

  return Object.freeze({
    version: LIVE_PHYSICAL_RELEASE_PREFLIGHT_VERSION,
    ok: false,
    decision: "PHYSICAL_RELEASE_BLOCKED",
    status: blocked.length ? "BLOCKED" : "READY_BUT_NOT_RELEASED",
    enabled: Boolean(enabled),
    request: normalized,
    live,
    emergency,
    token,
    readiness,
    blocked: Object.freeze(blocked),
    physicalWriteAllowed: false,
    outputTouched: false,
    serialTouched: false,
    networkTouched: false,
    safety: "12H physical release preflight evaluates final gates only; real write remains disabled"
  });
}

export function createLivePhysicalReleasePreflight({
  enabled = false,
  liveStateStore,
  liveFullEnableTokenGate,
  liveEmergencyInterlock,
  liveReadinessSummary
} = {}) {
  function evaluate(request = {}) {
    return evaluateLivePhysicalReleasePreflight({
      enabled,
      request,
      liveStateStore,
      liveFullEnableTokenGate,
      liveEmergencyInterlock,
      liveReadinessSummary
    });
  }

  return Object.freeze({
    version: LIVE_PHYSICAL_RELEASE_PREFLIGHT_VERSION,
    enabled: Boolean(enabled),
    evaluate
  });
}
