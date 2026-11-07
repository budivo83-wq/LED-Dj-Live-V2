import { BLX_MAGIC_0, BLX_MAGIC_1, BLX_VERSIONS } from "./blx_constants.js";
import { crc16CcittFalse } from "./blx_crc.js";

function readLe16(bytes, offset) {
  return (bytes[offset] | (bytes[offset + 1] << 8)) & 0xffff;
}

function readLe32(bytes, offset) {
  return (
    (bytes[offset]) |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)
  ) >>> 0;
}

export function validatePacket(packet) {
  const bytes = packet instanceof Uint8Array ? packet : new Uint8Array(0);
  if (bytes.length < 11) return Object.freeze({ ok: false, error: "ERR_LENGTH" });
  if (bytes[0] !== BLX_MAGIC_0 || bytes[1] !== BLX_MAGIC_1) return Object.freeze({ ok: false, error: "ERR_MAGIC" });
  const version = bytes[2];
  if (version !== BLX_VERSIONS.V1 && version !== BLX_VERSIONS.V2) {
    return Object.freeze({ ok: false, error: "ERR_VERSION_UNSUPPORTED", version: bytes[2] });
  }
  const headerLength = version === BLX_VERSIONS.V1 ? 15 : 9;
  const lengthOffset = version === BLX_VERSIONS.V1 ? 13 : 7;
  if (bytes.length < headerLength + 2) return Object.freeze({ ok: false, error: "ERR_LENGTH" });
  const expectedLength = readLe16(bytes, lengthOffset);
  const bodyEnd = headerLength + expectedLength;
  if (bodyEnd + 2 !== bytes.length) return Object.freeze({ ok: false, error: "ERR_LENGTH", expectedLength });
  const receivedCrc = readLe16(bytes, bodyEnd);
  const computedCrc = crc16CcittFalse(bytes.slice(2, bodyEnd));
  if (receivedCrc !== computedCrc) return Object.freeze({ ok: false, error: "ERR_CRC", receivedCrc, computedCrc, version });
  return Object.freeze({ ok: true, version, expectedLength, crc: receivedCrc });
}

export function parsePacket(packet) {
  const bytes = packet instanceof Uint8Array ? packet : new Uint8Array(0);
  const validation = validatePacket(bytes);
  if (!validation.ok) return Object.freeze({ ok: false, ...validation, packet: bytes });
  if (bytes[2] === BLX_VERSIONS.V1) {
    const length = readLe16(bytes, 13);
    const payload = bytes.slice(15, 15 + length);
    return Object.freeze({
      ok: true,
      version: bytes[2],
      type: bytes[3],
      flags: readLe16(bytes, 4),
      seq: readLe32(bytes, 6),
      nodeId: readLe16(bytes, 10),
      channel: bytes[12],
      length,
      payload,
      crc: readLe16(bytes, 15 + length),
      packet: bytes
    });
  }
  const length = readLe16(bytes, 7);
  const payload = bytes.slice(9, 9 + length);
  return Object.freeze({
    ok: true,
    version: bytes[2],
    type: bytes[3],
    flags: bytes[4],
    seq: readLe16(bytes, 5),
    length,
    payload,
    crc: readLe16(bytes, 9 + length),
    packet: bytes
  });
}
