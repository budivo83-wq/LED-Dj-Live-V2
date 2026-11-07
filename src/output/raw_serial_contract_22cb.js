export const STEP22CB_RAW_SERIAL_CONTRACT_VERSION = 'STEP22CB-raw-serial-contract-single-source';
export const RAW_SERIAL_START_BYTE = 0xAA;
export const RAW_SERIAL_PACKET_FORMAT = 'aa_len_rgb';
export const RAW_SERIAL_PACKET_LABEL = '0xAA + LEN16_PIXELS_LE + RGB';
export const RAW_SERIAL_DEFAULT_PIXELS = 160;
export const RAW_SERIAL_MAX_PIXELS = 2400;
export const RAW_SERIAL_DEFAULT_BAUD = 1000000;
export const RAW_SERIAL_DEFAULT_FPS = 30;

export function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

export function clampByte(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(255, Math.round(n)));
}

export function normalizeRawSerialSettings(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  const pixels = clampInt(source.simpleAaPixels ?? source.aaPixels ?? source.pixels ?? source.pixelCount, 1, RAW_SERIAL_MAX_PIXELS, RAW_SERIAL_DEFAULT_PIXELS);
  return Object.freeze({
    enabled: source.enabled === true || source.enabled === 'true',
    path: String(source.path || source.serialPath || source.portName || '').trim(),
    baudRate: clampInt(source.baudRate ?? source.baud ?? source.serialBaud, 9600, 3000000, RAW_SERIAL_DEFAULT_BAUD),
    fps: clampInt(source.fps ?? source.serialFps, 1, 120, RAW_SERIAL_DEFAULT_FPS),
    protocol: RAW_SERIAL_PACKET_FORMAT,
    packetFormat: RAW_SERIAL_PACKET_FORMAT,
    packetLabel: RAW_SERIAL_PACKET_LABEL,
    simpleAaPixels: pixels,
    aaPixels: pixels,
    pixels,
    brightness: clampByte(source.brightness ?? source.testBrightness, 20),
    testBrightness: clampByte(source.testBrightness ?? source.brightness, 20),
    requestedProtocol: source.protocol == null ? RAW_SERIAL_PACKET_FORMAT : String(source.protocol).toLowerCase()
  });
}

export function normalizeRgbBytes(value) {
  if (value instanceof Uint8Array || Buffer.isBuffer(value)) return Uint8Array.from(value);
  if (!Array.isArray(value)) return new Uint8Array(0);
  if (value.length && (Array.isArray(value[0]) || typeof value[0] === 'object')) {
    const out = [];
    for (const pixel of value) {
      if (Array.isArray(pixel)) out.push(clampByte(pixel[0]), clampByte(pixel[1]), clampByte(pixel[2]));
      else if (pixel && typeof pixel === 'object') out.push(clampByte(pixel.r ?? pixel.red), clampByte(pixel.g ?? pixel.green), clampByte(pixel.b ?? pixel.blue));
    }
    return Uint8Array.from(out);
  }
  return Uint8Array.from(value.map((v) => clampByte(v)));
}

export function expectedRawSerialPacketBytes(pixelCount = RAW_SERIAL_DEFAULT_PIXELS) {
  const pixels = clampInt(pixelCount, 1, RAW_SERIAL_MAX_PIXELS, RAW_SERIAL_DEFAULT_PIXELS);
  return 3 + pixels * 3;
}

export function buildRawSerialAaLen16RgbPacket({ rgb, pixels = RAW_SERIAL_DEFAULT_PIXELS, brightness = 255 } = {}) {
  const count = clampInt(pixels, 1, RAW_SERIAL_MAX_PIXELS, RAW_SERIAL_DEFAULT_PIXELS);
  const source = normalizeRgbBytes(rgb);
  const gain = clampByte(brightness, 255) / 255;
  const packet = Buffer.alloc(expectedRawSerialPacketBytes(count), 0);
  packet[0] = RAW_SERIAL_START_BYTE;
  packet[1] = count & 0xff;
  packet[2] = (count >> 8) & 0xff;
  const payloadBytes = count * 3;
  for (let i = 0; i < payloadBytes; i += 1) packet[3 + i] = clampByte((source[i] || 0) * gain);
  return packet;
}

export function inspectRawSerialAaLen16RgbPacket(packetLike, expectedPixels = RAW_SERIAL_DEFAULT_PIXELS) {
  const packet = Buffer.isBuffer(packetLike) ? packetLike : Buffer.from(packetLike || []);
  const expectedPixelCount = clampInt(expectedPixels, 1, RAW_SERIAL_MAX_PIXELS, RAW_SERIAL_DEFAULT_PIXELS);
  const declaredPixels = packet.length >= 3 ? ((packet[1] | (packet[2] << 8)) >>> 0) : 0;
  const actualPayloadBytes = Math.max(0, packet.length - 3);
  const declaredPayloadBytes = declaredPixels * 3;
  const expectedPacketBytes = expectedRawSerialPacketBytes(expectedPixelCount);
  const errors = [];
  if (packet.length < 3) errors.push('PACKET_TOO_SHORT');
  if ((packet.length ? packet[0] : null) !== RAW_SERIAL_START_BYTE) errors.push('BAD_START_BYTE');
  if (declaredPixels !== expectedPixelCount) errors.push('PIXEL_COUNT_MISMATCH');
  if (actualPayloadBytes !== declaredPayloadBytes) errors.push('PAYLOAD_LENGTH_MISMATCH');
  if (packet.length !== expectedPacketBytes) errors.push('TOTAL_PACKET_BYTES_MISMATCH');
  return Object.freeze({
    ok: errors.length === 0,
    version: STEP22CB_RAW_SERIAL_CONTRACT_VERSION,
    protocol: RAW_SERIAL_PACKET_FORMAT,
    packetFormat: RAW_SERIAL_PACKET_FORMAT,
    packetLabel: RAW_SERIAL_PACKET_LABEL,
    contract: 'AA_LEN16_PIXELS_LE_RGB_ONLY',
    startByte: packet.length ? packet[0] : null,
    declaredPixels,
    expectedPixels: expectedPixelCount,
    actualPayloadBytes,
    declaredPayloadBytes,
    expectedPayloadBytes: expectedPixelCount * 3,
    packetBytes: packet.length,
    expectedPacketBytes,
    firstBytes: Array.from(packet.slice(0, Math.min(16, packet.length))).map((value) => value.toString(16).padStart(2, '0')).join(' '),
    errors
  });
}
