export const LIVE_SERIAL_WRITER_VERSION = "12A-serial-live-writer-adapter-default-off";

function normalizePacketRequest(request = {}) {
  const payloadBytes = Math.max(0, Number(request.payloadBytes || request.bytes || 0));
  const packetCount = Math.max(0, Number(request.packetCount || request.packets || (payloadBytes > 0 ? 1 : 0)));
  return Object.freeze({
    transportKind: "serial",
    packetCount,
    payloadBytes,
    routeDigest: String(request.routeDigest || request.digest || "none"),
    armToken: request.armToken ? String(request.armToken) : null,
    fullLiveToken: request.fullLiveToken || request.token ? String(request.fullLiveToken || request.token) : null,
    mappingDigest: String(request.mappingDigest || ""),
    transportPlanDigest: String(request.transportPlanDigest || request.routeDigest || request.digest || ""),
    outputMode: String(request.outputMode || "serial"),
    operatorConfirmed: Boolean(request.operatorConfirmed),
    confirmation: String(request.confirmation || ""),
    port: String(request.port || request.path || ""),
    baudRate: Number(request.baudRate || 0)
  });
}

export function evaluateLiveSerialWriter({
  enabled = false,
  request = {},
  liveTransportBoundary = null,
  liveEmergencyInterlock = null
} = {}) {
  const packet = normalizePacketRequest(request);
  const blocked = [];
  const warnings = [];

  if (!enabled) blocked.push("SERIAL_LIVE_WRITER_DEFAULT_OFF");
  if (packet.packetCount <= 0) blocked.push("SERIAL_PACKET_COUNT_EMPTY");
  if (packet.payloadBytes <= 0) blocked.push("SERIAL_PAYLOAD_EMPTY");

  const emergency = liveEmergencyInterlock?.evaluate?.({ requested: false, source: "serial-writer-12A" }) || null;
  if (emergency?.emergencyStopLatched) blocked.push("EMERGENCY_STOP_LATCHED");

  const boundary = liveTransportBoundary?.evaluate?.(packet) || null;
  if (!boundary) blocked.push("TRANSPORT_BOUNDARY_MISSING");
  if (boundary && boundary.decision !== "ALLOW_SERIAL_WRITE") blocked.push(`BOUNDARY_${String(boundary.decision || "BLOCKED")}`);
  if (boundary?.physicalWriteAllowed !== true) blocked.push("BOUNDARY_PHYSICAL_WRITE_FALSE");

  if (!packet.port) warnings.push("SERIAL_PORT_NOT_SPECIFIED");
  if (!packet.baudRate) warnings.push("SERIAL_BAUD_NOT_SPECIFIED");

  const wouldWrite = Boolean(enabled && blocked.length === 0);

  return Object.freeze({
    version: LIVE_SERIAL_WRITER_VERSION,
    enabled: Boolean(enabled),
    ok: wouldWrite,
    decision: wouldWrite ? "SERIAL_WRITE_READY_FUTURE" : "SERIAL_WRITE_BLOCKED",
    status: wouldWrite ? "READY_FUTURE" : "BLOCKED",
    transportKind: "serial",
    packet,
    boundary,
    emergency,
    wouldWritePackets: wouldWrite ? packet.packetCount : 0,
    wouldWritePayloadBytes: wouldWrite ? packet.payloadBytes : 0,
    serialWriteAttempted: false,
    serialWriteOk: false,
    blocked: Object.freeze(blocked),
    warnings: Object.freeze(warnings),
    physicalWriteAllowed: false,
    outputTouched: false,
    serialTouched: false,
    networkTouched: false,
    dryRunOnly: true,
    safety: "12A serial live writer adapter is default OFF and returns write-candidate diagnostics only; no serial write API is called"
  });
}

export function createLiveSerialWriter({
  enabled = false,
  liveTransportBoundary,
  liveEmergencyInterlock
} = {}) {
  function evaluate(request = {}) {
    return evaluateLiveSerialWriter({
      enabled,
      request,
      liveTransportBoundary,
      liveEmergencyInterlock
    });
  }

  return Object.freeze({
    version: LIVE_SERIAL_WRITER_VERSION,
    enabled: Boolean(enabled),
    evaluate
  });
}
