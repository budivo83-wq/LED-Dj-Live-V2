const BLX_V2_MAGIC_0 = 0x42; // B
const BLX_V2_MAGIC_1 = 0x58; // X
const BLX_V2_VERSION = 0x02;

export const BLX_V2_TYPES = Object.freeze({
  FRAME_FULL: 0x01,
  FRAME_PARTIAL: 0x02,
  FRAME_DELTA: 0x03,
  CONFIG_SET: 0x04,
  CONFIG_GET: 0x05,
  CONFIG_REPLY: 0x06,
  PING: 0x07,
  PONG: 0x08,
  ACK: 0x09,
  ERROR: 0x0A,
  SYNC: 0x0B,
  BLACKOUT: 0x0C,
  BRIGHTNESS: 0x0D,
  IDENTIFY: 0x0E,
  CAPABILITIES: 0x0F
});

export const BLX_V2_FLAGS = Object.freeze({
  NONE: 0x00,
  ACK_REQUIRED: 0x01
});

function clampByte(value) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(255, n));
}

function clampWord(value) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(65535, n));
}

function clampUint32(value) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(0xFFFFFFFF, n >>> 0));
}

function writeU16LE(target, offset, value) {
  target[offset] = value & 0xFF;
  target[offset + 1] = (value >> 8) & 0xFF;
}

function writeU32LE(target, offset, value) {
  target[offset] = value & 0xFF;
  target[offset + 1] = (value >> 8) & 0xFF;
  target[offset + 2] = (value >> 16) & 0xFF;
  target[offset + 3] = (value >> 24) & 0xFF;
}

function crc16CcittFalse(bytes, offset = 0, length = bytes.length - offset) {
  let crc = 0xFFFF;
  for (let i = 0; i < length; i += 1) {
    crc ^= (bytes[offset + i] << 8);
    for (let bit = 0; bit < 8; bit += 1) {
      if (crc & 0x8000) crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
      else crc = (crc << 1) & 0xFFFF;
    }
  }
  return crc & 0xFFFF;
}

export function createBlxV2Sender(options = {}) {
  let seq = clampWord(options.initialSeq || 0);

  function nextSeq() {
    seq = (seq + 1) & 0xFFFF;
    return seq;
  }

  function pack(type, payload = new Uint8Array(0), flags = BLX_V2_FLAGS.NONE, forcedSeq = null) {
    const bodyLen = Math.max(0, Math.min(0xFFFF, payload.length));
    const packet = new Uint8Array(2 + 1 + 1 + 1 + 2 + 2 + bodyLen + 2);
    packet[0] = BLX_V2_MAGIC_0;
    packet[1] = BLX_V2_MAGIC_1;
    packet[2] = BLX_V2_VERSION;
    packet[3] = clampByte(type);
    packet[4] = clampByte(flags);
    const outSeq = forcedSeq == null ? nextSeq() : clampWord(forcedSeq);
    writeU16LE(packet, 5, outSeq);
    writeU16LE(packet, 7, bodyLen);
    if (bodyLen > 0) packet.set(payload.subarray(0, bodyLen), 9);
    const crc = crc16CcittFalse(packet, 2, 7 + bodyLen);
    writeU16LE(packet, 9 + bodyLen, crc);
    return { packet, seq: outSeq, crc };
  }

  function buildFrameFullPayload(frameId, segments) {
    const safeSegments = Array.isArray(segments) ? segments : [];
    const count = Math.min(255, safeSegments.length);
    const sizes = [];
    let payloadLen = 4 + 1;
    for (let i = 0; i < count; i += 1) {
      const segment = safeSegments[i] || {};
      const segmentId = clampByte(segment.segmentId ?? i);
      const pixels = segment.pixels instanceof Uint8Array ? segment.pixels : new Uint8Array(0);
      const pixelBytes = Math.min(65535 * 3, pixels.length - (pixels.length % 3));
      sizes.push({ segmentId, pixelBytes, pixels });
      payloadLen += 1 + 2 + pixelBytes;
    }

    const payload = new Uint8Array(payloadLen);
    writeU32LE(payload, 0, clampUint32(frameId));
    payload[4] = count;
    let offset = 5;
    for (const item of sizes) {
      payload[offset] = item.segmentId;
      writeU16LE(payload, offset + 1, Math.floor(item.pixelBytes / 3));
      offset += 3;
      if (item.pixelBytes > 0) {
        payload.set(item.pixels.subarray(0, item.pixelBytes), offset);
        offset += item.pixelBytes;
      }
    }
    return payload;
  }

  function buildFrameFullPacket(frameId, segments, flags = BLX_V2_FLAGS.NONE) {
    const payload = buildFrameFullPayload(frameId, segments);
    return pack(BLX_V2_TYPES.FRAME_FULL, payload, flags);
  }

  function buildBlackoutPacket(enabled, flags = BLX_V2_FLAGS.ACK_REQUIRED) {
    const payload = new Uint8Array([enabled ? 1 : 0]);
    return pack(BLX_V2_TYPES.BLACKOUT, payload, flags);
  }

  function buildBrightnessPacket(brightness01, flags = BLX_V2_FLAGS.ACK_REQUIRED) {
    const value = clampWord(Math.round(Math.max(0, Math.min(1, Number(brightness01) || 0)) * 1000));
    const payload = new Uint8Array(2);
    writeU16LE(payload, 0, value);
    return pack(BLX_V2_TYPES.BRIGHTNESS, payload, flags);
  }

  function buildPingPacket(timestampMs = 0, flags = BLX_V2_FLAGS.NONE) {
    const payload = new Uint8Array(4);
    writeU32LE(payload, 0, clampUint32(timestampMs));
    return pack(BLX_V2_TYPES.PING, payload, flags);
  }

  function buildAckPacket(ackSeq, flags = BLX_V2_FLAGS.NONE) {
    const payload = new Uint8Array(2);
    writeU16LE(payload, 0, clampWord(ackSeq));
    return pack(BLX_V2_TYPES.ACK, payload, flags);
  }

  function buildConfigGetPacket(flags = BLX_V2_FLAGS.ACK_REQUIRED) {
    return pack(BLX_V2_TYPES.CONFIG_GET, new Uint8Array(0), flags);
  }

  function buildConfigSetPacket(config = {}, flags = BLX_V2_FLAGS.ACK_REQUIRED) {
    const fps = clampWord(config.fps ?? 30);
    const master = clampWord(Math.round(Math.max(0, Math.min(1, Number(config.master ?? 1))) * 1000));
    const blackout = config.blackout ? 1 : 0;
    const payload = new Uint8Array(5);
    writeU16LE(payload, 0, fps);
    writeU16LE(payload, 2, master);
    payload[4] = blackout;
    return pack(BLX_V2_TYPES.CONFIG_SET, payload, flags);
  }

  return {
    BLX_V2_TYPES,
    BLX_V2_FLAGS,
    pack,
    buildFrameFullPayload,
    buildFrameFullPacket,
    buildBlackoutPacket,
    buildBrightnessPacket,
    buildPingPacket,
    buildAckPacket,
    buildConfigGetPacket,
    buildConfigSetPacket
  };
}

