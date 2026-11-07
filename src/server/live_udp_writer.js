export const LIVE_UDP_WRITER_VERSION = "12B-artnet-udp-live-writer-adapter-default-off";

function normalizeUdpRequest(request = {}) {
  const target = request.target && typeof request.target === "object" ? request.target : {};
  return Object.freeze({
    transportKind: String(request.transportKind || request.transport || "artnet").toLowerCase(),
    packetCount: Math.max(0, Number(request.packetCount || request.packets || 0)),
    payloadBytes: Math.max(0, Number(request.payloadBytes || request.bytes || 0)),
    routeDigest: String(request.routeDigest || request.digest || "none"),
    armToken: request.armToken ? String(request.armToken) : null,
    fullLiveToken: request.fullLiveToken || request.token ? String(request.fullLiveToken || request.token) : null,
    mappingDigest: String(request.mappingDigest || ""),
    transportPlanDigest: String(request.transportPlanDigest || request.routeDigest || request.digest || ""),
    outputMode: String(request.outputMode || request.transportKind || request.transport || "artnet"),
    operatorConfirmed: Boolean(request.operatorConfirmed),
    confirmation: String(request.confirmation || ""),
    target: Object.freeze({
      host: String(target.host || target.ip || request.host || request.ip || ""),
      port: Number(target.port || request.port || 6454),
      universe: Number(target.universe ?? request.universe ?? 0)
    })
  });
}

function targetIssues(target) {
  const issues = [];
  if (!target.host) issues.push("UDP_TARGET_HOST_MISSING");
  if (!Number.isInteger(target.port) || target.port < 1 || target.port > 65535) issues.push("UDP_TARGET_PORT_INVALID");
  if (!Number.isInteger(target.universe) || target.universe < 0 || target.universe > 32767) issues.push("UDP_UNIVERSE_INVALID");
  if (target.host === "255.255.255.255") issues.push("UDP_BROADCAST_NOT_ALLOWED");
  if (/^224\.|^239\./.test(target.host)) issues.push("UDP_MULTICAST_NOT_ALLOWED");
  return issues;
}

export function evaluateLiveUdpWriter({
  enabled = false,
  request = {},
  liveTransportBoundary = null,
  liveEmergencyInterlock = null
} = {}) {
  const packet = normalizeUdpRequest(request);
  const blocked = [];
  const warnings = [];

  if (!enabled) blocked.push("UDP_LIVE_WRITER_DEFAULT_OFF");
  if (!["artnet", "udp", "blx"].includes(packet.transportKind)) blocked.push("UDP_TRANSPORT_UNSUPPORTED");
  if (packet.packetCount <= 0) blocked.push("UDP_PACKET_COUNT_EMPTY");
  if (packet.payloadBytes <= 0) blocked.push("UDP_PAYLOAD_EMPTY");
  if (packet.payloadBytes > 530) warnings.push("UDP_PAYLOAD_OVER_SINGLE_DMX_UNIVERSE");
  blocked.push(...targetIssues(packet.target));

  const emergency = liveEmergencyInterlock?.evaluate?.({ requested: false, source: "udp-writer-12B" }) || null;
  if (emergency?.emergencyStopLatched) blocked.push("EMERGENCY_STOP_LATCHED");

  const boundary = liveTransportBoundary?.evaluate?.(packet) || null;
  if (!boundary) blocked.push("TRANSPORT_BOUNDARY_MISSING");
  if (boundary && boundary.decision !== "ALLOW_UDP_WRITE") blocked.push(`BOUNDARY_${String(boundary.decision || "BLOCKED")}`);
  if (boundary?.physicalWriteAllowed !== true) blocked.push("BOUNDARY_PHYSICAL_WRITE_FALSE");

  const wouldWrite = Boolean(enabled && blocked.length === 0);

  return Object.freeze({
    version: LIVE_UDP_WRITER_VERSION,
    enabled: Boolean(enabled),
    ok: wouldWrite,
    decision: wouldWrite ? "UDP_WRITE_READY_FUTURE" : "UDP_WRITE_BLOCKED",
    status: wouldWrite ? "READY_FUTURE" : "BLOCKED",
    transportKind: packet.transportKind,
    packet,
    boundary,
    emergency,
    wouldWritePackets: wouldWrite ? packet.packetCount : 0,
    wouldWritePayloadBytes: wouldWrite ? packet.payloadBytes : 0,
    udpSendAttempted: false,
    udpSendOk: false,
    blocked: Object.freeze(blocked),
    warnings: Object.freeze(warnings),
    physicalWriteAllowed: false,
    outputTouched: false,
    serialTouched: false,
    networkTouched: false,
    dryRunOnly: true,
    safety: "12B ArtNet/UDP live writer adapter is default OFF and returns write-candidate diagnostics only; no UDP send API is called"
  });
}

export function createLiveUdpWriter({
  enabled = false,
  liveTransportBoundary,
  liveEmergencyInterlock
} = {}) {
  function evaluate(request = {}) {
    return evaluateLiveUdpWriter({
      enabled,
      request,
      liveTransportBoundary,
      liveEmergencyInterlock
    });
  }

  return Object.freeze({
    version: LIVE_UDP_WRITER_VERSION,
    enabled: Boolean(enabled),
    evaluate
  });
}
