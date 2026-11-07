import { buildBlxAaFramePacket } from "./blx_packet.js";
import { encodeBlxCompressedFrame } from "./blx_compression.js";

export const BLX_BENCHMARK_PIXEL_COUNTS = Object.freeze([40, 300, 600, 1200, 2400]);

function makePattern(pixelCount, changedPixels = pixelCount) {
  const frame = new Uint8Array(pixelCount * 3);
  for (let i = 0; i < Math.min(pixelCount, changedPixels); i += 1) {
    const o = i * 3;
    frame[o] = (i * 17) & 0xff;
    frame[o + 1] = (255 - i * 7) & 0xff;
    frame[o + 2] = (i * 3) & 0xff;
  }
  return frame;
}

export function runBlxBenchmark({
  pixelCounts = BLX_BENCHMARK_PIXEL_COUNTS,
  fps = 60,
  baudRate = 1000000,
  compressionModes = ["RAW_RGB", "RLE", "ZERO_SKIP", "DIFF_FRAME"],
  changedPixels = 20
} = {}) {
  const rows = [];
  for (const pixelCount of pixelCounts) {
    const previous = makePattern(pixelCount, 0);
    const current = makePattern(pixelCount, Math.min(pixelCount, changedPixels));
    const rawPacket = buildBlxAaFramePacket({ frameId: 1, brightness: 255, rgb: current, pixelCount });
    for (const mode of compressionModes) {
      const encoded = encodeBlxCompressedFrame({ mode, previous, current });
      const packetBytes = mode === "RAW_RGB" ? rawPacket.packetBytes : encoded.encodedBytes;
      const wireMs = packetBytes * 10 * 1000 / Math.max(9600, Number(baudRate) || 1000000);
      const targetMs = 1000 / Math.max(1, Number(fps) || 60);
      rows.push(Object.freeze({
        pixelCount,
        mode,
        frameBytes: pixelCount * 3,
        packetBytes,
        encodedBytes: encoded.encodedBytes,
        compressionRatio: encoded.ratio,
        changedPixels: encoded.changedPixels ?? pixelCount,
        targetFps: fps,
        theoreticalMaxFps: Number((1000 / Math.max(0.001, wireMs)).toFixed(2)),
        serialLoad: Number((wireMs / targetMs).toFixed(4)),
        wireMs: Number(wireMs.toFixed(3)),
        okAtTargetFps: wireMs <= targetMs
      }));
    }
  }
  return Object.freeze({
    version: "blx-benchmark-v1",
    baudRate,
    fps,
    changedPixels,
    rows: Object.freeze(rows)
  });
}
