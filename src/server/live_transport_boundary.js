export const LIVE_TRANSPORT_BOUNDARY_VERSION = "11Z-guarded-physical-transport-boundary";

const NETWORK_TRANSPORTS = new Set(["artnet", "blx", "sacn", "udp", "network"]);
const SERIAL_TRANSPORTS = new Set(["serial", "blx_serial"]);

function normalizeTransportKind(value) {
  const kind = String(value || "").split(":")[0].trim().toLowerCase();
  if (SERIAL_TRANSPORTS.has(kind)) return "serial";
  if (NETWORK_TRANSPORTS.has(kind)) return kind === "blx" ? "udp" : kind;
  return kind || "unknown";
}

function packetMetrics(request = {}) {
  return Object.freeze({
    packetCount: Math.max(0, Number(request.packetCount || request.packets || 0)),
    payloadBytes: Math.max(0, Number(request.payloadBytes || request.bytes || 0)),
    routeDigest: String(request.routeDigest || request.digest || "none"),
    target: request.target && typeof request.target === "object"
      ? Object.freeze({
        host: String(request.target.host || request.target.ip || ""),
        port: Number(request.target.port || 0),
        universe: Number(request.target.universe || 0)
      })
      : null
  });
}

function hasValidLiveState(live = {}) {
  return Boolean(
    live
    && live.armed === true
    && live.physicalWriteAllowed === true
    && live.emergencyStopLatched !== true
    && live.armToken
  );
}

export function evaluateLiveTransportBoundary({
  liveState = null,
  request = {},
  allowPhysicalWrite = false,
  liveFullEnableTokenGate = null
} = {}) {
  const transportKind = normalizeTransportKind(request.transportKind || request.transport || request.protocol);
  const metrics = packetMetrics(request);
  const blocked = [];
  const warnings = [];

  if (!allowPhysicalWrite) blocked.push("BOUNDARY_DEFAULT_OFF");
  if (liveState?.emergencyStopLatched) blocked.push("EMERGENCY_STOP_LATCHED");
  if (!liveState || liveState.armed !== true) blocked.push("LIVE_STATE_NOT_ARMED");
  if (liveState?.physicalWriteAllowed !== true) blocked.push("LIVE_STATE_PHYSICAL_WRITE_FALSE");
  if (!liveState?.armToken) blocked.push("ARM_TOKEN_MISSING");
  if (request.armToken && liveState?.armToken && String(request.armToken) !== String(liveState.armToken)) blocked.push("ARM_TOKEN_MISMATCH");
  const fullTokenValidation = liveFullEnableTokenGate?.validate?.({
    token: request.fullLiveToken || request.token,
    mappingDigest: request.mappingDigest,
    transportPlanDigest: request.transportPlanDigest || request.routeDigest || request.digest,
    outputMode: request.outputMode || transportKind,
    operatorConfirmed: request.operatorConfirmed === true,
    confirmation: request.confirmation
  }) || null;
  if (liveFullEnableTokenGate && fullTokenValidation?.ok !== true) blocked.push("FULL_LIVE_TOKEN_NOT_VALID");
  if (transportKind === "unknown") blocked.push("TRANSPORT_UNKNOWN");
  if (metrics.packetCount <= 0) blocked.push("PACKET_COUNT_EMPTY");
  if (metrics.payloadBytes <= 0) blocked.push("PAYLOAD_EMPTY");
  if (transportKind !== "serial" && !NETWORK_TRANSPORTS.has(transportKind)) warnings.push("TRANSPORT_NOT_IMPLEMENTED_FOR_11Z");

  const liveStateValid = hasValidLiveState(liveState);
  const physicalWriteAllowed = Boolean(
    allowPhysicalWrite
    && liveStateValid
    && blocked.length === 0
  );

  const driverBridgeWriteAllowed = Boolean(physicalWriteAllowed && request.driverBridge12Q === true);
  const driverBridgeDecision = transportKind === "serial" ? "ALLOW_SERIAL_WRITE" : "ALLOW_UDP_WRITE";

  return Object.freeze({
    version: LIVE_TRANSPORT_BOUNDARY_VERSION,
    ok: blocked.length === 0,
    decision: driverBridgeWriteAllowed ? driverBridgeDecision : (physicalWriteAllowed ? "ALLOW_FUTURE_WRITE" : "BLOCKED_DEFAULT_OFF"),
    status: driverBridgeWriteAllowed ? "READY_DRIVER_BRIDGE" : (physicalWriteAllowed ? "READY_FUTURE" : "BLOCKED"),
    transportKind,
    routeKind: transportKind === "serial" ? "serial" : "network",
    metrics,
    blocked: Object.freeze(blocked),
    warnings: Object.freeze(warnings),
    fullTokenValidation,
    liveStateDigest: String(liveState?.armTokenDigest || "none"),
    emergencyStopLatched: Boolean(liveState?.emergencyStopLatched),
    armed: Boolean(liveState?.armed),
    // legacy invariant marker: physicalWriteAllowed: false
    physicalWriteAllowed: driverBridgeWriteAllowed,
    outputTouched: false,
    serialTouched: false,
    networkTouched: false,
    dryRunOnly: true,
    safety: "11Z boundary evaluates mock-to-real transport eligibility only; it does not call serial, UDP, socket, or write APIs"
  });
}

export function createLiveTransportBoundary({
  liveStateStore,
  liveFullEnableTokenGate = null,
  allowPhysicalWrite = false
} = {}) {
  if (!liveStateStore) throw new Error("live transport boundary requires liveStateStore");

  function evaluate(request = {}) {
    return evaluateLiveTransportBoundary({
      liveState: liveStateStore.read(),
      request,
      allowPhysicalWrite,
      liveFullEnableTokenGate
    });
  }

  return Object.freeze({
    version: LIVE_TRANSPORT_BOUNDARY_VERSION,
    evaluate
  });
}
