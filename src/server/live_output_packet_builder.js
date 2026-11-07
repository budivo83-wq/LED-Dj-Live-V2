export const LIVE_OUTPUT_PACKET_BUILDER_VERSION = "STEP37AG-artnet-reusable-packet-no-full-fill";

const ARTNET_PORT = 6454;
const ARTNET_MAX_DMX = 512;
const BLX_MAGIC_A = 0x42;
const BLX_MAGIC_B = 0x58;
const BLX_VERSION = 0x02;
const BLX_TYPE_FRAME_FULL = 0x01;

function clampByte(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(255, Math.round(n)));
}

function normalizeRgbBytes(value) {
  if (value instanceof Uint8Array) return value;
  if (Array.isArray(value)) return Uint8Array.from(value.map(clampByte));
  return new Uint8Array(0);
}

function crc16CcittFalse(bytes) {
  let crc = 0xffff;
  for (const byte of bytes) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i += 1) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc & 0xffff;
}

function le16(buffer, offset, value) {
  buffer[offset] = value & 0xff;
  buffer[offset + 1] = (value >> 8) & 0xff;
}

function le32(buffer, offset, value) {
  const n = Number(value) >>> 0;
  buffer[offset] = n & 0xff;
  buffer[offset + 1] = (n >> 8) & 0xff;
  buffer[offset + 2] = (n >> 16) & 0xff;
  buffer[offset + 3] = (n >> 24) & 0xff;
}

function normalizeSegment(segment = {}, index = 0) {
  const pixels = normalizeRgbBytes(segment.pixels || segment.rgb || segment.payload || []);
  const pixelCount = Math.floor(pixels.length / 3);
  return Object.freeze({
    segmentId: clampByte(segment.segmentId ?? segment.id ?? index),
    pixelCount,
    pixels: pixels.slice(0, pixelCount * 3)
  });
}


export function buildSimpleAaSerialFramePacket({ rgb = [], brightness = 10 } = {}) {
  const pixels = normalizeRgbBytes(rgb);
  const packet = new Uint8Array(2 + pixels.length);
  packet[0] = 0xaa;
  packet[1] = clampByte(brightness);
  packet.set(pixels, 2);
  return Object.freeze({
    protocol: "simple-aa",
    type: "AA_BRIGHTNESS_RGB",
    payloadBytes: pixels.length,
    packetBytes: packet.length,
    pixelCount: Math.floor(pixels.length / 3),
    brightness: clampByte(brightness),
    packet
  });
}

export function buildBlxV2FrameFullPacket({ frameId = 1, segments = [], seq = 1, ackRequired = false } = {}) {
  const normalizedSegments = segments.map(normalizeSegment).filter((segment) => segment.pixelCount > 0);
  const payloadLength = 4 + 1 + normalizedSegments.reduce((sum, segment) => sum + 1 + 2 + segment.pixels.length, 0);
  const payload = new Uint8Array(payloadLength);
  le32(payload, 0, frameId);
  payload[4] = Math.min(255, normalizedSegments.length);
  let offset = 5;
  for (const segment of normalizedSegments) {
    payload[offset] = segment.segmentId;
    le16(payload, offset + 1, segment.pixelCount);
    payload.set(segment.pixels, offset + 3);
    offset += 3 + segment.pixels.length;
  }
  return packBlxV2({ type: BLX_TYPE_FRAME_FULL, payload, seq, flags: ackRequired ? 0x01 : 0x00 });
}

export function packBlxV2({ type, payload = new Uint8Array(0), seq = 1, flags = 0 } = {}) {
  const body = new Uint8Array(7 + payload.length);
  body[0] = BLX_VERSION;
  body[1] = clampByte(type);
  body[2] = clampByte(flags);
  le16(body, 3, Number(seq) & 0xffff);
  le16(body, 5, payload.length);
  body.set(payload, 7);
  const crc = crc16CcittFalse(body);
  const packet = new Uint8Array(2 + body.length + 2);
  packet[0] = BLX_MAGIC_A;
  packet[1] = BLX_MAGIC_B;
  packet.set(body, 2);
  le16(packet, 2 + body.length, crc);
  return Object.freeze({
    protocol: "blx-v2",
    type: "FRAME_FULL",
    seq: Number(seq) & 0xffff,
    payloadBytes: payload.length,
    packetBytes: packet.length,
    segmentCount: payload[4] || 0,
    crc,
    packet
  });
}

const artDmxReusablePool = new Map();
const ARTDMX_REUSABLE_SLOTS = 4;

function makeArtDmxPacketBuffer({ universe = 0, dmxBytes = 0, sequence = 1, physical = 0, protocolVersion = 14 } = {}) {
  const evenLength = dmxBytes % 2 === 0 ? dmxBytes : dmxBytes + 1;
  const packet = new Uint8Array(18 + evenLength);
  packet.set([0x41, 0x72, 0x74, 0x2d, 0x4e, 0x65, 0x74, 0x00], 0);
  packet[8] = 0x00;
  packet[9] = 0x50;
  packet[10] = (protocolVersion >> 8) & 0xff;
  packet[11] = protocolVersion & 0xff;
  packet[12] = clampByte(sequence);
  packet[13] = clampByte(physical);
  const u = Number(universe) & 0x7fff;
  packet[14] = u & 0xff;
  packet[15] = (u >> 8) & 0xff;
  packet[16] = (evenLength >> 8) & 0xff;
  packet[17] = evenLength & 0xff;
  return packet;
}

export function buildReusableArtDmxPacket({ universe = 0, dmx = [], sequence = 1, physical = 0, protocolVersion = 14 } = {}) {
  const source = normalizeRgbBytes(dmx);
  const length = Math.min(ARTNET_MAX_DMX, source.length);
  const evenLength = length % 2 === 0 ? length : length + 1;
  const u = Number(universe) & 0x7fff;
  const key = `${u}|${evenLength}|${Number(physical) & 0xff}|${Number(protocolVersion) || 14}`;
  let slots = artDmxReusablePool.get(key);
  if (!slots) {
    slots = Array.from({ length: ARTDMX_REUSABLE_SLOTS }, () => {
      const packet = makeArtDmxPacketBuffer({ universe: u, dmxBytes: evenLength, sequence, physical, protocolVersion });
      return {
        protocol: "artnet",
        opCode: "OpDmx",
        port: ARTNET_PORT,
        universe: u,
        sequence: clampByte(sequence),
        dmxBytes: evenLength,
        packetBytes: packet.length,
        packet
      };
    });
    artDmxReusablePool.set(key, slots);
  }
  const seq = clampByte(sequence);
  const slot = slots[seq % ARTDMX_REUSABLE_SLOTS];
  slot.sequence = seq;
  slot.packet[12] = seq;
  // STEP37AG: do not clear the whole DMX payload before writing it. The pool key
  // is based on the exact even payload length, so the current source overwrites
  // all active DMX bytes every frame. Only the optional ArtNet padding byte for
  // odd lengths must be cleared. This removes one extra 510-byte write per
  // universe packet in the 60 FPS ArtNet hot path.
  slot.packet.set(source.subarray(0, length), 18);
  if (evenLength > length) slot.packet[18 + length] = 0;
  return slot;
}

export function buildArtDmxPacket({ universe = 0, dmx = [], sequence = 1, physical = 0, protocolVersion = 14, fastPath = false } = {}) {
  const source = normalizeRgbBytes(dmx);
  const length = Math.min(ARTNET_MAX_DMX, source.length);
  const evenLength = length % 2 === 0 ? length : length + 1;
  const packet = new Uint8Array(18 + evenLength);
  packet.set([0x41, 0x72, 0x74, 0x2d, 0x4e, 0x65, 0x74, 0x00], 0);
  packet[8] = 0x00;
  packet[9] = 0x50;
  packet[10] = (protocolVersion >> 8) & 0xff;
  packet[11] = protocolVersion & 0xff;
  packet[12] = clampByte(sequence);
  packet[13] = clampByte(physical);
  const u = Number(universe) & 0x7fff;
  packet[14] = u & 0xff;
  packet[15] = (u >> 8) & 0xff;
  packet[16] = (evenLength >> 8) & 0xff;
  packet[17] = evenLength & 0xff;
  // STEP22MH: write payload straight into the ArtDMX packet and skip the
  // temporary DMX buffer allocation on every universe packet.
  packet.set(source.subarray(0, length), 18);
  const out = {
    protocol: "artnet",
    opCode: "OpDmx",
    port: ARTNET_PORT,
    universe: u,
    sequence: clampByte(sequence),
    dmxBytes: evenLength,
    packetBytes: packet.length,
    packet
  };
  return fastPath ? out : Object.freeze(out);
}

export function splitRgbToArtDmxPackets({ rgb = [], startUniverse = 0, sequence = 1, pixelsPerUniverse = 170 } = {}) {
  const bytes = normalizeRgbBytes(rgb);
  const chunkBytes = Math.max(3, Math.min(ARTNET_MAX_DMX, Math.floor(Number(pixelsPerUniverse) || 170) * 3));
  const packets = [];
  for (let offset = 0; offset < bytes.length; offset += chunkBytes) {
    packets.push(buildArtDmxPacket({
      universe: startUniverse + packets.length,
      sequence: (sequence + packets.length) & 0xff,
      dmx: bytes.slice(offset, offset + chunkBytes)
    }));
  }
  return Object.freeze(packets);
}

export function summarizePacket(packet) {
  const bytes = packet?.packet instanceof Uint8Array ? packet.packet : new Uint8Array(0);
  return Object.freeze({
    protocol: packet?.protocol || "unknown",
    packetBytes: bytes.length,
    payloadBytes: packet?.payloadBytes ?? packet?.dmxBytes ?? 0,
    headHex: Array.from(bytes.slice(0, 24)).map((b) => b.toString(16).padStart(2, "0")).join(" ")
  });
}
