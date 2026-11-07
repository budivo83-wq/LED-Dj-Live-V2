function normalizeRgb(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof Uint8ClampedArray) return new Uint8Array(value);
  if (Array.isArray(value)) return Uint8Array.from(value.map((item) => Math.max(0, Math.min(255, Number(item) || 0))));
  return new Uint8Array(0);
}

export function encodeBlxRawRgb(rgb = []) {
  const bytes = normalizeRgb(rgb);
  return Object.freeze({
    mode: "RAW_RGB",
    payload: new Uint8Array(bytes),
    originalBytes: bytes.byteLength,
    encodedBytes: bytes.byteLength,
    ratio: bytes.byteLength ? 1 : 0
  });
}

export function encodeBlxRle(rgb = []) {
  const bytes = normalizeRgb(rgb);
  const out = [];
  for (let i = 0; i < bytes.length; i += 3) {
    const r = bytes[i] || 0;
    const g = bytes[i + 1] || 0;
    const b = bytes[i + 2] || 0;
    let run = 1;
    while (i + run * 3 < bytes.length && run < 255) {
      const o = i + run * 3;
      if (bytes[o] !== r || bytes[o + 1] !== g || bytes[o + 2] !== b) break;
      run += 1;
    }
    out.push(run, r, g, b);
    i += (run - 1) * 3;
  }
  const payload = Uint8Array.from(out);
  return Object.freeze({
    mode: "RLE",
    payload,
    originalBytes: bytes.byteLength,
    encodedBytes: payload.byteLength,
    ratio: bytes.byteLength ? Number((payload.byteLength / bytes.byteLength).toFixed(4)) : 0
  });
}

export function encodeBlxZeroSkip(rgb = []) {
  const bytes = normalizeRgb(rgb);
  const out = [];
  const pixels = Math.floor(bytes.length / 3);
  for (let pixel = 0; pixel < pixels; pixel += 1) {
    const o = pixel * 3;
    const r = bytes[o] || 0;
    const g = bytes[o + 1] || 0;
    const b = bytes[o + 2] || 0;
    if (!r && !g && !b) continue;
    out.push((pixel >> 8) & 0xff, pixel & 0xff, r, g, b);
  }
  const payload = Uint8Array.from(out);
  return Object.freeze({
    mode: "ZERO_SKIP",
    payload,
    originalBytes: bytes.byteLength,
    encodedBytes: payload.byteLength,
    changedPixels: payload.byteLength / 5,
    ratio: bytes.byteLength ? Number((payload.byteLength / bytes.byteLength).toFixed(4)) : 0
  });
}

export function encodeBlxDiffFrame(previous = [], current = []) {
  const prev = normalizeRgb(previous);
  const next = normalizeRgb(current);
  const pixels = Math.floor(next.length / 3);
  const out = [];
  for (let pixel = 0; pixel < pixels; pixel += 1) {
    const o = pixel * 3;
    if (prev[o] === next[o] && prev[o + 1] === next[o + 1] && prev[o + 2] === next[o + 2]) continue;
    out.push((pixel >> 8) & 0xff, pixel & 0xff, next[o] || 0, next[o + 1] || 0, next[o + 2] || 0);
  }
  const payload = Uint8Array.from(out);
  return Object.freeze({
    mode: "DIFF_FRAME",
    payload,
    originalBytes: next.byteLength,
    encodedBytes: payload.byteLength,
    changedPixels: payload.byteLength / 5,
    ratio: next.byteLength ? Number((payload.byteLength / next.byteLength).toFixed(4)) : 0
  });
}

export function encodeBlxCompressedFrame({ mode = "RAW_RGB", current = [], previous = [] } = {}) {
  const key = String(mode || "RAW_RGB").toUpperCase().replace(/[\s-]+/g, "_");
  if (key === "RLE") return encodeBlxRle(current);
  if (key === "ZERO_SKIP") return encodeBlxZeroSkip(current);
  if (key === "DIFF_FRAME" || key === "DIFF") return encodeBlxDiffFrame(previous, current);
  return encodeBlxRawRgb(current);
}
