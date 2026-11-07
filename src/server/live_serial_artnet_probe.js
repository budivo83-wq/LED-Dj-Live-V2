import {
  LIVE_OUTPUT_PACKET_BUILDER_VERSION,
  buildArtDmxPacket,
  buildBlxV2FrameFullPacket,
  splitRgbToArtDmxPackets,
  summarizePacket
} from "./live_output_packet_builder.js";

export const LIVE_SERIAL_ARTNET_PROBE_VERSION = "12P-serial-artnet-output-probe";

const MAX_PROBE_PIXELS = 300;
const MAX_PROBE_BRIGHTNESS = 0.15;

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function buildTestRgb({ pixels, brightness, color = [255, 80, 0] }) {
  const scale = clampNumber(brightness, 0, MAX_PROBE_BRIGHTNESS, 0.05);
  const rgb = [];
  for (let i = 0; i < pixels; i += 1) {
    const active = i === 0 || i === Math.floor(pixels / 2) || i === pixels - 1;
    rgb.push(
      active ? Math.round(Number(color[0] || 0) * scale) : 0,
      active ? Math.round(Number(color[1] || 0) * scale) : 0,
      active ? Math.round(Number(color[2] || 0) * scale) : 0
    );
  }
  return Uint8Array.from(rgb);
}

function normalizeRequest(request = {}) {
  return Object.freeze({
    transportKind: String(request.transportKind || request.transport || "both").toLowerCase(),
    pixels: clampInt(request.pixels ?? request.pixelCount, 1, MAX_PROBE_PIXELS, 150),
    brightness: clampNumber(request.brightness, 0, MAX_PROBE_BRIGHTNESS, 0.05),
    frameId: clampInt(request.frameId, 1, 0xffffffff, 1),
    serialSeq: clampInt(request.serialSeq ?? request.seq, 0, 0xffff, 1),
    artnetSequence: clampInt(request.artnetSequence ?? request.sequence, 0, 255, 1),
    universe: clampInt(request.universe, 0, 32767, 0),
    host: String(request.host || request.ip || "127.0.0.1"),
    port: clampInt(request.port, 1, 65535, 6454),
    baudRate: clampInt(request.baudRate, 9600, 3000000, 1000000),
    serialPath: String(request.serialPath || request.path || ""),
    operatorConfirmed: Boolean(request.operatorConfirmed),
    confirmation: String(request.confirmation || "")
  });
}

export function evaluateSerialArtnetProbe({ request = {}, liveSerialWriter = null, liveUdpWriter = null } = {}) {
  const probe = normalizeRequest(request);
  const rgb = buildTestRgb(probe);
  const blocked = [];
  const warnings = [];
  if (!["both", "serial", "artnet", "udp"].includes(probe.transportKind)) blocked.push("PROBE_TRANSPORT_UNSUPPORTED");
  if (!probe.operatorConfirmed || probe.confirmation !== "CONFIRM_OUTPUT_PACKET_PROBE_DRY_RUN") blocked.push("PROBE_CONFIRMATION_MISSING");

  const serialPacket = buildBlxV2FrameFullPacket({
    frameId: probe.frameId,
    seq: probe.serialSeq,
    segments: [{ segmentId: 0, pixels: rgb }]
  });
  const artnetPackets = splitRgbToArtDmxPackets({
    rgb,
    startUniverse: probe.universe,
    sequence: probe.artnetSequence,
    pixelsPerUniverse: 170
  });
  const firstArtDmx = artnetPackets[0] || buildArtDmxPacket({ universe: probe.universe, dmx: [] });

  const serialCandidate = liveSerialWriter?.evaluate?.({
    transportKind: "serial",
    packetCount: 1,
    payloadBytes: serialPacket.packetBytes,
    routeDigest: "12P-probe-serial",
    mappingDigest: "12P-probe",
    transportPlanDigest: "12P-probe-serial",
    outputMode: "serial",
    operatorConfirmed: probe.operatorConfirmed,
    confirmation: probe.confirmation,
    port: probe.serialPath,
    baudRate: probe.baudRate
  }) || null;
  const artnetCandidate = liveUdpWriter?.evaluate?.({
    transportKind: "artnet",
    packetCount: artnetPackets.length,
    payloadBytes: artnetPackets.reduce((sum, packet) => sum + packet.packetBytes, 0),
    routeDigest: "12P-probe-artnet",
    mappingDigest: "12P-probe",
    transportPlanDigest: "12P-probe-artnet",
    outputMode: "artnet",
    operatorConfirmed: probe.operatorConfirmed,
    confirmation: probe.confirmation,
    target: { host: probe.host, port: probe.port, universe: probe.universe }
  }) || null;

  if (serialCandidate?.ok !== true) warnings.push("SERIAL_CANDIDATE_NOT_READY_OR_DEFAULT_OFF");
  if (artnetCandidate?.ok !== true) warnings.push("ARTNET_CANDIDATE_NOT_READY_OR_DEFAULT_OFF");

  const ok = blocked.length === 0;
  return Object.freeze({
    version: LIVE_SERIAL_ARTNET_PROBE_VERSION,
    builderVersion: LIVE_OUTPUT_PACKET_BUILDER_VERSION,
    ok,
    decision: ok ? "SERIAL_ARTNET_PACKET_PROBE_READY_DRY_RUN" : "SERIAL_ARTNET_PACKET_PROBE_BLOCKED",
    status: ok ? "DRY_RUN_READY" : "BLOCKED",
    request: probe,
    serial: Object.freeze({ packet: summarizePacket(serialPacket), candidate: serialCandidate }),
    artnet: Object.freeze({ packets: artnetPackets.map(summarizePacket), first: summarizePacket(firstArtDmx), candidate: artnetCandidate }),
    blocked: Object.freeze(blocked),
    warnings: Object.freeze(warnings),
    physicalWriteAllowed: false,
    outputTouched: false,
    serialTouched: false,
    networkTouched: false,
    dryRunOnly: true,
    safety: "12P builds BLX-v2 serial and ArtDMX packets for validation only; it does not open serial ports and does not send UDP packets"
  });
}

export function createSerialArtnetProbe({ liveSerialWriter = null, liveUdpWriter = null } = {}) {
  function evaluate(request = {}) {
    return evaluateSerialArtnetProbe({ request, liveSerialWriter, liveUdpWriter });
  }
  return Object.freeze({ version: LIVE_SERIAL_ARTNET_PROBE_VERSION, evaluate });
}
