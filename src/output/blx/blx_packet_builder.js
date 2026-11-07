import {
  BLX_CAPABILITY_FLAGS,
  BLX_COLOR_ORDER,
  BLX_COMPRESSION_CODEC,
  BLX_PACKET_TYPES_V2,
  BLX_FLAGS_V1,
  BLX_MAGIC_0,
  BLX_MAGIC_1,
  BLX_PACKET_TYPES_V1,
  BLX_VERSIONS
} from "./blx_constants.js";
import { appendCrc16 } from "./blx_crc.js";
import { convertColorOrder } from "./blx_mapping.js";

function clampByte(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(255, Math.round(n)));
}

function clampU16(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(0xffff, Math.round(n)));
}

function clampU32(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return n >>> 0;
}

function normalizeRgb(rgb) {
  if (rgb instanceof Uint8Array) return rgb;
  if (rgb instanceof Uint8ClampedArray) return new Uint8Array(rgb);
  if (Array.isArray(rgb)) return Uint8Array.from(rgb.map((v) => clampByte(v)));
  return new Uint8Array(0);
}

function writeLe16(target, offset, value) {
  target[offset] = value & 0xff;
  target[offset + 1] = (value >> 8) & 0xff;
}

function writeLe32(target, offset, value) {
  const n = value >>> 0;
  target[offset] = n & 0xff;
  target[offset + 1] = (n >> 8) & 0xff;
  target[offset + 2] = (n >> 16) & 0xff;
  target[offset + 3] = (n >> 24) & 0xff;
}

function writeLeI32(target, offset, value) {
  const n = Number(value) | 0;
  target[offset] = n & 0xff;
  target[offset + 1] = (n >> 8) & 0xff;
  target[offset + 2] = (n >> 16) & 0xff;
  target[offset + 3] = (n >> 24) & 0xff;
}

function writeLe64(target, offset, value) {
  let n = BigInt(value ?? 0n);
  if (n < 0n) n = 0n;
  for (let i = 0; i < 8; i += 1) {
    target[offset + i] = Number(n & 0xffn);
    n >>= 8n;
  }
}

function buildV1Packet({
  type,
  flags = BLX_FLAGS_V1.NONE,
  seq = 0,
  nodeId = 1,
  channel = 0,
  payload = new Uint8Array(0)
} = {}) {
  const data = payload instanceof Uint8Array ? payload : new Uint8Array(0);
  const packetNoCrc = new Uint8Array(2 + 1 + 1 + 2 + 4 + 2 + 1 + 2 + data.length);
  packetNoCrc[0] = BLX_MAGIC_0;
  packetNoCrc[1] = BLX_MAGIC_1;
  packetNoCrc[2] = BLX_VERSIONS.V1;
  packetNoCrc[3] = clampByte(type);
  writeLe16(packetNoCrc, 4, clampU16(flags));
  writeLe32(packetNoCrc, 6, clampU32(seq));
  writeLe16(packetNoCrc, 10, clampU16(nodeId, 1));
  packetNoCrc[12] = clampByte(channel);
  writeLe16(packetNoCrc, 13, data.length);
  packetNoCrc.set(data, 15);
  const { packet, crc } = appendCrc16(packetNoCrc.slice(2)); // CRC over VERSION..PAYLOAD

  const finalPacket = new Uint8Array(packetNoCrc.length + 2);
  finalPacket.set(packetNoCrc, 0);
  finalPacket[packetNoCrc.length] = packet[packet.length - 2];
  finalPacket[packetNoCrc.length + 1] = packet[packet.length - 1];
  return Object.freeze({
    protocol: "blx-v1",
    type: clampByte(type),
    seq: clampU32(seq),
    payloadBytes: data.length,
    packetBytes: finalPacket.length,
    crc,
    packet: finalPacket
  });
}

function buildV2Packet({ type, flags = 0, seq = 0, payload = new Uint8Array(0) } = {}) {
  const data = payload instanceof Uint8Array ? payload : new Uint8Array(0);
  const packetNoCrc = new Uint8Array(2 + 1 + 1 + 1 + 2 + 2 + data.length);
  packetNoCrc[0] = BLX_MAGIC_0;
  packetNoCrc[1] = BLX_MAGIC_1;
  packetNoCrc[2] = BLX_VERSIONS.V2;
  packetNoCrc[3] = clampByte(type);
  packetNoCrc[4] = clampByte(flags);
  writeLe16(packetNoCrc, 5, clampU16(seq));
  writeLe16(packetNoCrc, 7, data.length);
  packetNoCrc.set(data, 9);
  const { packet, crc } = appendCrc16(packetNoCrc.slice(2)); // CRC over VERSION..PAYLOAD

  const finalPacket = new Uint8Array(packetNoCrc.length + 2);
  finalPacket.set(packetNoCrc, 0);
  finalPacket[packetNoCrc.length] = packet[packet.length - 2];
  finalPacket[packetNoCrc.length + 1] = packet[packet.length - 1];
  return Object.freeze({
    protocol: "blx-v2",
    type: clampByte(type),
    seq: clampU16(seq),
    payloadBytes: data.length,
    packetBytes: finalPacket.length,
    crc,
    packet: finalPacket
  });
}

export function buildPixelFrame({
  seq = 0,
  nodeId = 1,
  channel = 0,
  frameId = 0,
  pixelCount = null,
  colorOrder = BLX_COLOR_ORDER.RGB,
  brightness = 255,
  rgb = [],
  flags = BLX_FLAGS_V1.NONE
} = {}) {
  const bytes = convertColorOrder(normalizeRgb(rgb), colorOrder);
  const pixels = Math.max(0, Math.min(
    clampU16(pixelCount ?? Math.floor(bytes.length / 3)),
    Math.floor(bytes.length / 3)
  ));
  const payload = new Uint8Array(4 + 2 + 1 + 1 + (pixels * 3));
  writeLe32(payload, 0, frameId);
  writeLe16(payload, 4, pixels);
  payload[6] = clampByte(colorOrder);
  payload[7] = clampByte(brightness, 255);
  payload.set(bytes.slice(0, pixels * 3), 8);
  return buildV1Packet({
    type: BLX_PACKET_TYPES_V1.PIXEL_FRAME,
    flags,
    seq,
    nodeId,
    channel,
    payload
  });
}

export function buildSync({
  seq = 0,
  nodeId = 1,
  channel = 0,
  frameId = 0,
  deadlineMs = 0,
  flags = BLX_FLAGS_V1.NONE
} = {}) {
  const payload = new Uint8Array(6);
  writeLe32(payload, 0, frameId);
  writeLe16(payload, 4, clampU16(deadlineMs));
  return buildV1Packet({
    type: BLX_PACKET_TYPES_V1.SYNC,
    flags,
    seq,
    nodeId,
    channel,
    payload
  });
}

export function buildStatusRequest({
  seq = 0,
  nodeId = 1,
  channel = 0,
  requestId = 0,
  flags = BLX_FLAGS_V1.REQUIRE_ACK
} = {}) {
  const payload = new Uint8Array(2);
  writeLe16(payload, 0, clampU16(requestId));
  return buildV1Packet({
    type: BLX_PACKET_TYPES_V1.STATUS_REQUEST,
    flags,
    seq,
    nodeId,
    channel,
    payload
  });
}

export function buildLiteFrame({ rgb = [], brightness = 255, pixelCount = null } = {}) {
  const src = normalizeRgb(rgb);
  const pixels = Math.max(0, Math.min(
    clampU16(pixelCount ?? Math.floor(src.length / 3)),
    Math.floor(src.length / 3)
  ));
  const packet = new Uint8Array(2 + (pixels * 3));
  packet[0] = 0xaa;
  packet[1] = clampByte(brightness, 255);
  packet.set(src.slice(0, pixels * 3), 2);
  return Object.freeze({
    protocol: "blx-lite",
    payloadBytes: pixels * 3,
    packetBytes: packet.length,
    pixelCount: pixels,
    packet
  });
}

export function buildCapabilityRequest({ seq = 0, flags = 0 } = {}) {
  return buildV2Packet({
    type: BLX_PACKET_TYPES_V2.CAPABILITY_REQUEST,
    flags,
    seq,
    payload: new Uint8Array(0)
  });
}

export function buildCapabilityReply({ seq = 0, flags = 0, capabilityFlags = 0 } = {}) {
  const payload = new Uint8Array(4);
  writeLe32(payload, 0, clampU32(capabilityFlags));
  return buildV2Packet({
    type: BLX_PACKET_TYPES_V2.CAPABILITY_REPLY,
    flags,
    seq,
    payload
  });
}

export function buildClockMaster({ seq = 0, flags = 0, masterTimeUs = 0n } = {}) {
  const payload = new Uint8Array(8);
  writeLe64(payload, 0, masterTimeUs);
  return buildV2Packet({
    type: BLX_PACKET_TYPES_V2.CLOCK_MASTER,
    flags,
    seq,
    payload
  });
}

export function buildClockReply({
  seq = 0,
  flags = 0,
  masterTimeUs = 0n,
  localTimeUs = 0n,
  offsetUs = 0
} = {}) {
  const payload = new Uint8Array(20);
  writeLe64(payload, 0, masterTimeUs);
  writeLe64(payload, 8, localTimeUs);
  writeLeI32(payload, 16, offsetUs);
  return buildV2Packet({
    type: BLX_PACKET_TYPES_V2.CLOCK_REPLY,
    flags,
    seq,
    payload
  });
}

export function buildConfigRead({ seq = 0, flags = 0 } = {}) {
  return buildV2Packet({
    type: BLX_PACKET_TYPES_V2.CONFIG_READ,
    flags,
    seq,
    payload: new Uint8Array(0)
  });
}

export function buildConfigWrite({
  seq = 0,
  flags = 0,
  pixelCount = 0,
  brightnessLimit = 255,
  fpsCap = 60,
  colorOrder = BLX_COLOR_ORDER.RGB,
  fallbackMode = 2
} = {}) {
  const payload = new Uint8Array(7);
  writeLe16(payload, 0, clampU16(pixelCount));
  payload[2] = clampByte(brightnessLimit, 255);
  writeLe16(payload, 3, clampU16(fpsCap));
  payload[5] = clampByte(colorOrder);
  payload[6] = clampByte(fallbackMode);
  return buildV2Packet({
    type: BLX_PACKET_TYPES_V2.CONFIG_WRITE,
    flags,
    seq,
    payload
  });
}

export function buildPixelCompressed({
  seq = 0,
  flags = 0,
  frameId = 0,
  pixelCount = 0,
  codec = BLX_COMPRESSION_CODEC.RAW,
  data = new Uint8Array(0)
} = {}) {
  const bytes = data instanceof Uint8Array ? data : normalizeRgb(data);
  const payload = new Uint8Array(4 + 2 + 1 + bytes.length);
  writeLe32(payload, 0, clampU32(frameId));
  writeLe16(payload, 4, clampU16(pixelCount));
  payload[6] = clampByte(codec);
  payload.set(bytes, 7);
  return buildV2Packet({
    type: BLX_PACKET_TYPES_V2.PIXEL_COMPRESSED,
    flags,
    seq,
    payload
  });
}

export function buildShaderParam({
  seq = 0,
  flags = 0,
  animId = 0,
  p1 = 0,
  p2 = 0,
  p3 = 0,
  p4 = 0,
  timeMs = 0
} = {}) {
  const payload = new Uint8Array(2 + 2 + 2 + 2 + 2 + 4);
  writeLe16(payload, 0, clampU16(animId));
  writeLe16(payload, 2, clampU16(p1 * 1000));
  writeLe16(payload, 4, clampU16(p2 * 1000));
  writeLe16(payload, 6, clampU16(p3 * 1000));
  writeLe16(payload, 8, clampU16(p4 * 1000));
  writeLe32(payload, 10, clampU32(timeMs));
  return buildV2Packet({
    type: BLX_PACKET_TYPES_V2.SHADER_PARAM,
    flags,
    seq,
    payload
  });
}

export function buildFailoverTarget({
  seq = 0,
  flags = 0,
  primaryIp = "2.1.1.30",
  backupIp = "2.1.1.31",
  primaryPort = 9001,
  backupPort = 9001
} = {}) {
  const text = `${primaryIp}:${clampU16(primaryPort)}|${backupIp}:${clampU16(backupPort)}`;
  const bytes = new TextEncoder().encode(text);
  return buildV2Packet({
    type: BLX_PACKET_TYPES_V2.FAILOVER_TARGET,
    flags,
    seq,
    payload: bytes
  });
}

export function createDefaultCapabilities() {
  return (
    BLX_CAPABILITY_FLAGS.RGB |
    BLX_CAPABILITY_FLAGS.GRB |
    BLX_CAPABILITY_FLAGS.DELTA |
    BLX_CAPABILITY_FLAGS.SEGMENT |
    BLX_CAPABILITY_FLAGS.TELEMETRY |
    BLX_CAPABILITY_FLAGS.PRESET |
    BLX_CAPABILITY_FLAGS.TEMP |
    BLX_CAPABILITY_FLAGS.SERIAL
  ) >>> 0;
}
