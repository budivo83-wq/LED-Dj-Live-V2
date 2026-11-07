import { createOutputAdapterBase } from '../base.js';
import {
  RAW_SERIAL_PACKET_FORMAT,
  RAW_SERIAL_PACKET_LABEL,
  RAW_SERIAL_START_BYTE,
  RAW_SERIAL_DEFAULT_PIXELS,
  RAW_SERIAL_MAX_PIXELS,
  buildRawSerialAaLen16RgbPacket,
  clampByte,
  clampInt
} from '../../raw_serial_contract_22cb.js';

function flattenPixels(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const pixel of value) {
    if (Array.isArray(pixel)) {
      out.push(clampByte(pixel[0]), clampByte(pixel[1]), clampByte(pixel[2]));
    } else if (pixel && typeof pixel === 'object') {
      out.push(
        clampByte(pixel.r ?? pixel.red),
        clampByte(pixel.g ?? pixel.green),
        clampByte(pixel.b ?? pixel.blue)
      );
    }
  }
  return out;
}

export function normalizeSerialRgbFrame(frame = {}) {
  const candidate = frame?.frame ?? frame?.payload ?? frame?.rgb ?? frame?.data?.rgb ?? frame?.pixels ?? frame?.data;
  if (candidate instanceof Uint8Array || Buffer.isBuffer(candidate)) return candidate;
  if (Array.isArray(candidate) && candidate.length && (Array.isArray(candidate[0]) || typeof candidate[0] === 'object')) {
    return Uint8Array.from(flattenPixels(candidate));
  }
  if (Array.isArray(candidate)) return Uint8Array.from(candidate.map((v) => clampByte(v)));
  return new Uint8Array(0);
}

export function resolveRawSerialAdapterPacketFormat() {
  return RAW_SERIAL_PACKET_FORMAT;
}

export function buildRawSerialAdapterPacket(frame = {}, options = {}) {
  const raw = normalizeSerialRgbFrame(frame);
  const requestedPixels = frame?.pixels ?? frame?.pixelCount ?? frame?.meta?.pixels ?? frame?.meta?.pixelCount ?? options.pixels ?? options.pixelCount;
  const inferredPixels = raw.length > 0 ? Math.ceil(raw.length / 3) : RAW_SERIAL_DEFAULT_PIXELS;
  const pixels = clampInt(requestedPixels, 1, RAW_SERIAL_MAX_PIXELS, Math.min(RAW_SERIAL_MAX_PIXELS, inferredPixels));
  const brightness = clampByte(frame?.brightness ?? frame?.meta?.brightness ?? options.brightness, 255);
  return buildRawSerialAaLen16RgbPacket({ rgb: raw, pixels, brightness });
}

export function createSerialOutputAdapter(options = {}) {
  const base = createOutputAdapterBase('serial', {
    fpsLimit: options.fpsLimit || 30,
    reconnectMs: options.reconnectMs || 1200,
    maxQueue: options.maxQueue || 4
  });

  const serialController = options.serialController || null;
  const writer = typeof options.writer === 'function' ? options.writer : null;
  const onPacket = typeof options.onPacket === 'function' ? options.onPacket : null;

  let packetsTx = 0;
  let bytesTx = 0;
  let lastPacketBytes = 0;
  let lastPixelCount = 0;
  let lastFirstBytes = '';

  function sendSerial(frame) {
    const packet = buildRawSerialAdapterPacket(frame, options);
    packetsTx += 1;
    bytesTx += packet.length;
    lastPacketBytes = packet.length;
    lastPixelCount = (packet[1] | (packet[2] << 8)) >>> 0;
    lastFirstBytes = Array.from(packet.slice(0, Math.min(12, packet.length))).map((v) => v.toString(16).padStart(2, '0')).join(' ');

    if (onPacket) onPacket(packet, { frame, pixels: lastPixelCount, packetFormat: RAW_SERIAL_PACKET_FORMAT });
    if (writer) {
      const ok = writer(packet, frame);
      if (ok === false) throw new Error('serial_writer_returned_false');
      return;
    }
    if (serialController && typeof serialController.write === 'function') {
      if (serialController.status && serialController.status()?.open === false) throw new Error('serial_closed');
      const ok = serialController.write(packet, 'Raw serial adapter write error');
      if (ok === false) throw new Error('serial_controller_write_failed');
      return;
    }
    throw new Error('serial_writer_missing');
  }

  return {
    ...base,
    processOne() {
      base.processOne(sendSerial);
    },
    getStatus() {
      return {
        ...base.getStatus(),
        protocol: RAW_SERIAL_PACKET_FORMAT,
        packetFormat: RAW_SERIAL_PACKET_FORMAT,
        packetLabel: RAW_SERIAL_PACKET_LABEL,
        packetsTx,
        bytesTx,
        lastPacketBytes,
        lastPixelCount,
        lastFirstBytes,
        writerReady: Boolean(writer || serialController)
      };
    }
  };
}
