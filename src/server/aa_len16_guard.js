export function classifyAaLen16RgbPayload(msg, {
  variableLengthEnabled = false,
  expectedPixels = 160,
  maxPixels = 2400
} = {}) {
  if (!Buffer.isBuffer(msg)) return { ok: false, reason: "NOT_BUFFER" };
  if (msg.length < 6) return { ok: false, reason: "TOO_SHORT" };
  if (msg[0] !== 0xAA) return { ok: false, reason: "BAD_MAGIC" };

  const lenPixels = msg[1] | (msg[2] << 8);
  const expectedBytes = 3 + lenPixels * 3;
  if (lenPixels < 1 || lenPixels > maxPixels) {
    return { ok: false, reason: "LEN_PIXELS_OUT_OF_RANGE", lenPixels, expectedBytes, actualBytes: msg.length };
  }
  if (msg.length !== expectedBytes) {
    return { ok: false, reason: "AA_LEN16_LENGTH_MISMATCH", expectedBytes, actualBytes: msg.length, lenPixels };
  }
  if (!variableLengthEnabled && lenPixels !== expectedPixels) {
    return { ok: false, reason: "AA_LEN16_PIXEL_COUNT_MISMATCH", expectedPixels, lenPixels, expectedBytes, actualBytes: msg.length };
  }
  if (((msg.length - 3) % 3) !== 0) {
    return { ok: false, reason: "BAD_RGB_ALIGNMENT", expectedBytes, actualBytes: msg.length, lenPixels };
  }
  return { ok: true, reason: "OK", protocol: "AA_LEN16_PIXELS_LE_RGB", expectedBytes, actualBytes: msg.length, pixels: lenPixels, lenPixels };
}
