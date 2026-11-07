export const LIVE_READINESS_SUMMARY_VERSION = "12F-live-readiness-summary";

export function createLiveReadinessSummary({
  liveStateStore,
  liveTransportBoundary = null,
  liveEmergencyInterlock = null,
  liveSerialWriter = null,
  liveUdpWriter = null,
  liveHardwareTestMode = null,
  liveFullEnableTokenGate = null
} = {}) {
  if (!liveStateStore) throw new Error("live readiness summary requires liveStateStore");

  function read() {
    const live = liveStateStore.read();
    const emergency = liveEmergencyInterlock?.evaluate?.({ requested: false, source: "readiness-summary" }) || null;
    const tokenGate = liveFullEnableTokenGate?.snapshot?.() || null;
    const boundary = liveTransportBoundary?.evaluate?.({
      transportKind: "serial",
      packetCount: 1,
      payloadBytes: 3,
      routeDigest: "readiness-summary",
      outputMode: "serial"
    }) || null;
    const serial = liveSerialWriter?.evaluate?.({
      packetCount: 1,
      payloadBytes: 3,
      routeDigest: "readiness-summary",
      outputMode: "serial"
    }) || null;
    const udp = liveUdpWriter?.evaluate?.({
      transportKind: "artnet",
      packetCount: 1,
      payloadBytes: 3,
      routeDigest: "readiness-summary",
      outputMode: "artnet",
      target: { host: "127.0.0.1", port: 6454, universe: 0 }
    }) || null;
    const hardwareTest = liveHardwareTestMode?.evaluate?.({
      requested: false,
      transportKind: "serial",
      stripCount: 0,
      brightness: 0,
      fps: 0,
      durationMs: 0
    }) || null;

    const blockers = [];
    if (live.emergencyStopLatched) blockers.push("EMERGENCY_STOP_LATCHED");
    if (!tokenGate?.active) blockers.push("FULL_LIVE_TOKEN_INACTIVE");
    if (boundary?.physicalWriteAllowed !== true) blockers.push("TRANSPORT_BOUNDARY_BLOCKED");
    if (serial?.enabled !== true) blockers.push("SERIAL_WRITER_DEFAULT_OFF");
    if (udp?.enabled !== true) blockers.push("UDP_WRITER_DEFAULT_OFF");

    return Object.freeze({
      version: LIVE_READINESS_SUMMARY_VERSION,
      ok: false,
      decision: "LIVE_PHYSICAL_WRITE_BLOCKED",
      status: live.emergencyStopLatched ? "STOPPED" : "SAFE_BLOCKED",
      live,
      emergency,
      tokenGate,
      boundary,
      serial,
      udp,
      hardwareTest,
      blockers: Object.freeze(blockers),
      physicalWriteAllowed: false,
      outputTouched: false,
      serialTouched: false,
      networkTouched: false,
      safety: "12F summarizes live readiness only; physical write remains blocked"
    });
  }

  return Object.freeze({
    version: LIVE_READINESS_SUMMARY_VERSION,
    read
  });
}
