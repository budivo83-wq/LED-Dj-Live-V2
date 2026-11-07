export const STEP22DM_SERIAL_STABILIZER_VERSION = "STEP22DM_SERIAL_STABILIZER";

export const RAW_SERIAL_STABILIZER_DEFAULTS = Object.freeze({
  startByteBytes: 1,
  lenBytes: 2,
  bytesPerPixel: 3,
  serialBitsPerByte: 10,
  safetyFactor: 1.25,
  minIntervalMs: 2,
  maxRecommendedFps: 60,
  minRecommendedFps: 1
});

export function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

export function rawSerialPacketBytesForPixels(pixels) {
  const px = Math.floor(clampNumber(pixels, 1, 2400, 160));
  return RAW_SERIAL_STABILIZER_DEFAULTS.startByteBytes + RAW_SERIAL_STABILIZER_DEFAULTS.lenBytes + (px * RAW_SERIAL_STABILIZER_DEFAULTS.bytesPerPixel);
}

export function rawSerialWireBudgetMs({ packetBytes, baudRate, safetyFactor, minIntervalMs } = {}) {
  const bytes = Math.floor(clampNumber(packetBytes, 1, 65535, rawSerialPacketBytesForPixels(160)));
  const baud = Math.floor(clampNumber(baudRate, 9600, 3000000, 1000000));
  const safety = clampNumber(safetyFactor, 1.0, 3.0, RAW_SERIAL_STABILIZER_DEFAULTS.safetyFactor);
  const floor = clampNumber(minIntervalMs, 0, 1000, RAW_SERIAL_STABILIZER_DEFAULTS.minIntervalMs);
  const physicalMs = (bytes * RAW_SERIAL_STABILIZER_DEFAULTS.serialBitsPerByte * 1000) / baud;
  const safeMs = Math.max(floor, physicalMs * safety);
  return {
    packetBytes: bytes,
    baudRate: baud,
    physicalMs: Number(physicalMs.toFixed(3)),
    safeMs: Number(safeMs.toFixed(3)),
    safetyFactor: safety,
    minIntervalMs: floor
  };
}

export function rawSerialRecommendedFps({ pixels, packetBytes, baudRate, safetyFactor, minIntervalMs, maxRecommendedFps, minRecommendedFps } = {}) {
  const bytes = packetBytes || rawSerialPacketBytesForPixels(pixels);
  const budget = rawSerialWireBudgetMs({ packetBytes: bytes, baudRate, safetyFactor, minIntervalMs });
  const maxFps = Math.floor(clampNumber(maxRecommendedFps, 1, 240, RAW_SERIAL_STABILIZER_DEFAULTS.maxRecommendedFps));
  const minFps = Math.floor(clampNumber(minRecommendedFps, 1, maxFps, RAW_SERIAL_STABILIZER_DEFAULTS.minRecommendedFps));
  const rawFps = budget.safeMs > 0 ? Math.floor(1000 / budget.safeMs) : minFps;
  const recommendedFps = Math.max(minFps, Math.min(maxFps, rawFps));
  return {
    version: STEP22DM_SERIAL_STABILIZER_VERSION,
    pixels: Math.floor(clampNumber(pixels, 1, 2400, 160)),
    packetBytes: bytes,
    baudRate: budget.baudRate,
    physicalMs: budget.physicalMs,
    safeMs: budget.safeMs,
    recommendedFps,
    maxRecommendedFps: maxFps,
    minRecommendedFps: minFps,
    serialUtilizationAtRecommended: Number(((budget.physicalMs * recommendedFps) / 1000).toFixed(3)),
    note: "Latest-only queue + paced writes: keep newest frame, never stack old frames."
  };
}

export function rawSerialLivePlan({ profile = "esp32-4x40", pixels = 160, baudRate = 1000000, requestedFps = 30 } = {}) {
  const recommended = rawSerialRecommendedFps({ pixels, baudRate });
  const req = Math.floor(clampNumber(requestedFps, 1, 120, 30));
  const effectiveFps = Math.min(req, recommended.recommendedFps);
  return {
    ...recommended,
    profile,
    requestedFps: req,
    effectiveFps,
    capped: effectiveFps !== req,
    expectedPacketHeader: "AA + LEN16_PIXELS_LE + RGB",
    expectedPacketBytes: rawSerialPacketBytesForPixels(pixels)
  };
}
