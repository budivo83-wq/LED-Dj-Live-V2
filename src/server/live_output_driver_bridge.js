import dgram from "node:dgram";
import { buildBlxV2FrameFullPacket, splitRgbToArtDmxPackets, summarizePacket } from "./live_output_packet_builder.js";
import { buildRawSerialAaLen16RgbPacket, RAW_SERIAL_PACKET_LABEL } from "../output/raw_serial_contract_22cb.js";
import { freezeUniqueList, normalizeLiveOutputRequest } from "./live_output_common.js";

export const LIVE_OUTPUT_DRIVER_BRIDGE_VERSION = "12Q-serial-artnet-output-driver-bridge";

const REQUIRED_CONFIRMATION = "CONFIRM_REAL_OUTPUT_BRIDGE_LOW_BRIGHTNESS";
const MAX_PIXELS = 150;
const MAX_BRIGHTNESS = 0.1;
const MAX_FRAMES = 8;

function normalizeRequest(request = {}) {
  return normalizeLiveOutputRequest(request, {
    defaultTransportKind: "serial",
    transportAliases: ["udp"],
    defaultPattern: "single-pixel-chase",
    defaultFrames: 1,
    defaultBaudRate: 115200,
    defaultSerialProtocol: "aa_len_rgb",
    defaultMappingDigest: "output-driver-bridge-12Q",
    defaultTransportPlanDigest: "output-driver-bridge-12Q"
  });
}

function rgbForPattern(pattern, i, frame, brightness) {
  const s = Math.max(0, Math.min(1, brightness));
  if (pattern === "blackout") return [0, 0, 0];
  if (pattern === "red") return [Math.round(255 * s), 0, 0];
  if (pattern === "green") return [0, Math.round(255 * s), 0];
  if (pattern === "blue") return [0, 0, Math.round(255 * s)];
  if (pattern === "white-low") { const v = Math.round(80 * s); return [v, v, v]; }
  return i === frame % Math.max(1, MAX_PIXELS) ? [Math.round(255 * s), Math.round(70 * s), 0] : [0, 0, 0];
}

function buildRgbFrames(test) {
  return Array.from({ length: test.frames }, (_, frameIndex) => {
    const bytes = [];
    for (let i = 0; i < test.pixels; i += 1) bytes.push(...rgbForPattern(test.pattern, i, frameIndex, test.brightness));
    return Uint8Array.from(bytes);
  });
}

function buildPackets(test, rgbFrames) {
  return test.transportKind === "serial"
    ? rgbFrames.map((rgb, i) => test.serialProtocol === "blx-v2"
      ? buildBlxV2FrameFullPacket({ frameId: test.frameId + i, seq: test.seq + i, segments: [{ segmentId: 0, pixels: rgb }] })
      : ({
          protocol: "aa_len_rgb",
          type: "AA_LEN16_PIXELS_LE_RGB",
          payloadBytes: rgb.length,
          packetBytes: 3 + rgb.length,
          pixelCount: Math.floor(rgb.length / 3),
          packet: buildRawSerialAaLen16RgbPacket({ rgb, pixels: Math.floor(rgb.length / 3), brightness: 255 })
        }))
    : rgbFrames.flatMap((rgb, i) => splitRgbToArtDmxPackets({ rgb, startUniverse: test.universe, sequence: (test.seq + i) & 0xff }));
}

function preparePacketPlan(test) {
  const rgbFrames = buildRgbFrames(test);
  const packets = buildPackets(test, rgbFrames);
  const packetBuffers = packets.map((packet) => packet.packet);
  const packetBytes = packets.reduce((sum, packet) => sum + packet.packet.length, 0);
  return Object.freeze({
    rgbFrames: Object.freeze(rgbFrames),
    packets: Object.freeze(packets),
    packetBuffers: Object.freeze(packetBuffers),
    packetBytes
  });
}

function attachPacketPlan(target, packetPlan) {
  Object.defineProperty(target, "packetPlan", {
    value: packetPlan,
    enumerable: false,
    configurable: false,
    writable: false
  });
}

async function writeSerialPackets({ serialPath, baudRate, packets }) {
  const { SerialPort } = await import("serialport");
  const port = new SerialPort({ path: serialPath, baudRate, autoOpen: false });
  await new Promise((resolve, reject) => port.open((err) => err ? reject(err) : resolve()));
  try {
    for (const packet of packets) {
      await new Promise((resolve, reject) => port.write(Buffer.from(packet), (err) => err ? reject(err) : resolve()));
      await new Promise((resolve, reject) => port.drain((err) => err ? reject(err) : resolve()));
    }
  } finally {
    await new Promise((resolve) => port.close(() => resolve()));
  }
}

async function sendUdpPackets({ host, port, packets }) {
  const socket = dgram.createSocket("udp4");
  try {
    for (const packet of packets) {
      await new Promise((resolve, reject) => socket.send(Buffer.from(packet), port, host, (err) => err ? reject(err) : resolve()));
    }
  } finally {
    socket.close();
  }
}

export function evaluateLiveOutputDriverBridge({
  request = {},
  liveSerialWriter = null,
  liveUdpWriter = null,
  physicalWriteEnabled = false
} = {}) {
  const test = normalizeRequest(request);
  const blocked = [];
  const warnings = [];

  if (!test.requested) blocked.push("OUTPUT_DRIVER_BRIDGE_NOT_REQUESTED");
  if (!test.commit) blocked.push("OUTPUT_DRIVER_BRIDGE_COMMIT_FALSE");
  if (!test.operatorConfirmed || test.confirmation !== REQUIRED_CONFIRMATION) blocked.push("OUTPUT_DRIVER_BRIDGE_CONFIRMATION_MISSING");
  if (!physicalWriteEnabled) blocked.push("OUTPUT_DRIVER_BRIDGE_DEFAULT_OFF");
  if (!["serial", "artnet"].includes(test.transportKind)) blocked.push("OUTPUT_DRIVER_BRIDGE_TRANSPORT_UNSUPPORTED");
  if (test.transportKind === "serial" && !test.serialPath) blocked.push("SERIAL_PATH_MISSING");
  if (test.transportKind === "artnet" && !test.host) blocked.push("ARTNET_HOST_MISSING");

  const packetPlan = preparePacketPlan(test);
  const packets = packetPlan.packets;
  const packetBytes = packetPlan.packetBytes;

  const writerRequest = {
    transportKind: test.transportKind,
    packetCount: packets.length,
    payloadBytes: packetBytes,
    routeDigest: test.transportPlanDigest,
    mappingDigest: test.mappingDigest,
    transportPlanDigest: test.transportPlanDigest,
    outputMode: test.transportKind,
    armToken: test.armToken,
    fullLiveToken: test.fullLiveToken,
    operatorConfirmed: test.operatorConfirmed,
    confirmation: test.confirmation,
    port: test.serialPath,
    baudRate: test.baudRate,
    target: { host: test.host, port: test.artnetPort, universe: test.universe },
    serialProtocol: test.serialProtocol,
    driverBridge12Q: true
  };

  const writer = test.transportKind === "serial"
    ? liveSerialWriter?.evaluate?.(writerRequest) || null
    : liveUdpWriter?.evaluate?.(writerRequest) || null;
  if (!writer) warnings.push("OUTPUT_WRITER_DIAGNOSTIC_MISSING_DIRECT_DRIVER_STILL_AVAILABLE");
  if (writer && writer.ok !== true) warnings.push("OUTPUT_WRITER_DIAGNOSTIC_NOT_READY_DIRECT_DRIVER_STILL_AVAILABLE");
  if (test.dryRun) warnings.push("OUTPUT_DRIVER_BRIDGE_DRY_RUN_TRUE_NO_PHYSICAL_SEND");

  const canSend = blocked.length === 0 && test.dryRun === false;
  const result = {
    version: LIVE_OUTPUT_DRIVER_BRIDGE_VERSION,
    ok: blocked.length === 0,
    decision: canSend ? "OUTPUT_DRIVER_BRIDGE_READY_TO_SEND" : (blocked.length === 0 ? "OUTPUT_DRIVER_BRIDGE_READY_DRY_RUN" : "OUTPUT_DRIVER_BRIDGE_BLOCKED"),
    status: canSend ? "READY_TO_SEND" : (blocked.length === 0 ? "READY_DRY_RUN" : "BLOCKED"),
    request: test,
    writer,
    packetCount: packets.length,
    packetBytes,
    packets: Object.freeze(packets.slice(0, 4).map(summarizePacket)),
    blocked: freezeUniqueList(blocked),
    warnings: freezeUniqueList(warnings),
    physicalWriteAllowed: canSend,
    outputTouched: false,
    serialTouched: false,
    networkTouched: false,
    dryRunOnly: test.dryRun || !canSend,
    safety: `STEP22CC direct driver serial default is ${RAW_SERIAL_PACKET_LABEL}. Physical send needs LED_PHYSICAL_OUTPUT_ENABLE=1, exact confirmation, dryRun:false, and 12U arm; LED_SERIAL_LIVE_WRITER_ENABLE is no longer required for this smoke path.`
  };
  attachPacketPlan(result, packetPlan);
  return Object.freeze(result);
}

export async function executeLiveOutputDriverBridge(options = {}) {
  const evaluation = evaluateLiveOutputDriverBridge(options);
  if (evaluation.decision !== "OUTPUT_DRIVER_BRIDGE_READY_TO_SEND") return evaluation;

  const test = evaluation.request;
  const packets = evaluation.packetPlan?.packetBuffers || [];
  const packetBytes = evaluation.packetPlan?.packetBytes ?? evaluation.packetBytes;

  if (test.transportKind === "serial") await writeSerialPackets({ serialPath: test.serialPath, baudRate: test.baudRate, packets });
  if (test.transportKind === "artnet") await sendUdpPackets({ host: test.host, port: test.artnetPort, packets });

  return Object.freeze({
    ...evaluation,
    packetBytes,
    decision: "OUTPUT_DRIVER_BRIDGE_SENT",
    status: "SENT",
    serialTouched: test.transportKind === "serial",
    networkTouched: test.transportKind === "artnet",
    outputTouched: true,
    dryRunOnly: false
  });
}

export function createLiveOutputDriverBridge({
  liveSerialWriter = null,
  liveUdpWriter = null,
  physicalWriteEnabled = false
} = {}) {
  return Object.freeze({
    version: LIVE_OUTPUT_DRIVER_BRIDGE_VERSION,
    evaluate: (request = {}) => evaluateLiveOutputDriverBridge({ request, liveSerialWriter, liveUdpWriter, physicalWriteEnabled }),
    execute: (request = {}) => executeLiveOutputDriverBridge({ request, liveSerialWriter, liveUdpWriter, physicalWriteEnabled })
  });
}
