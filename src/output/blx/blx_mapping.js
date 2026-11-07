import { BLX_COLOR_ORDER } from "./blx_constants.js";

function clampByte(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(255, Math.round(n)));
}

function normalizeRgbBytes(rgb) {
  if (rgb instanceof Uint8Array) return rgb;
  if (rgb instanceof Uint8ClampedArray) return new Uint8Array(rgb);
  if (Array.isArray(rgb)) return Uint8Array.from(rgb.map(clampByte));
  return new Uint8Array(0);
}

export function convertColorOrder(rgb, colorOrder = BLX_COLOR_ORDER.RGB) {
  const src = normalizeRgbBytes(rgb);
  if (colorOrder !== BLX_COLOR_ORDER.GRB) return src;
  const out = new Uint8Array(src.length);
  for (let i = 0; i + 2 < src.length; i += 3) {
    out[i] = src[i + 1];
    out[i + 1] = src[i];
    out[i + 2] = src[i + 2];
  }
  return out;
}

export function splitFrameToSegments({
  rgb = [],
  pixelsPerSegment = 170,
  startSegmentId = 0
} = {}) {
  const src = normalizeRgbBytes(rgb);
  const pxPerSegment = Math.max(1, Number(pixelsPerSegment) || 170);
  const bytesPerSegment = pxPerSegment * 3;
  const segments = [];
  for (let offset = 0; offset < src.length; offset += bytesPerSegment) {
    const payload = src.slice(offset, offset + bytesPerSegment);
    segments.push(Object.freeze({
      segmentId: (startSegmentId + segments.length) & 0xff,
      pixelCount: Math.floor(payload.length / 3),
      payload
    }));
  }
  return Object.freeze(segments);
}

