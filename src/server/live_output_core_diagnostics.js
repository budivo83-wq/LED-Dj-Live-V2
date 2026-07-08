import { buildDefaultEightStripUniverseMap, splitRgbByUniverseMap } from "../output/artnet_core.js";
import { runBlxBenchmark } from "../output/blx_benchmark.js";
import { encodeBlxCompressedFrame } from "../output/blx_compression.js";
import { buildBlxAaFramePacket } from "../output/blx_packet.js";
import { listOutputProfiles, resolveOutputProfile } from "../output/output_profiles.js";
import { buildOutputDebugSnapshot } from "../output/output_debug_snapshot.js";
import { normalizePattern } from "./live_output_common.js";

export const LIVE_OUTPUT_CORE_DIAGNOSTICS_VERSION = "output-core-diagnostics-v1";

const PATTERNS = Object.freeze(["rgb", "white", "chase", "snake", "universe-color", "address-check", "moving-pixel", "heat-map"]);

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function clampByte(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(255, Math.round(n)));
}

function makePatternFrame({ pattern = "rgb", pixelCount = 2400, frameId = 1, universeMap = null } = {}) {
  const count = clampInt(pixelCount, 1, 10000, 2400);
  const bytes = new Uint8Array(count * 3);
  const key = normalizePattern(pattern, { defaultValue: "rgb", allowed: [...PATTERNS], unknownValue: "rgb" });
  const phase = Math.max(0, Number(frameId) || 0);
  const map = universeMap || buildDefaultEightStripUniverseMap();

  for (let i = 0; i < count; i += 1) {
    const o = i * 3;
    if (key === "white") {
      bytes[o] = 255;
      bytes[o + 1] = 255;
      bytes[o + 2] = 255;
    } else if (key === "chase" || key === "moving-pixel") {
      const active = i === (phase % count);
      bytes[o] = active ? 255 : 0;
      bytes[o + 1] = active ? 255 : 0;
      bytes[o + 2] = active ? 255 : 0;
    } else if (key === "snake") {
      const head = phase % count;
      const distance = (i <= head) ? head - i : count - i + head;
      const level = Math.max(0, 255 - distance * 16);
      bytes[o] = level;
      bytes[o + 1] = Math.round(level * 0.45);
      bytes[o + 2] = 0;
    } else if (key === "universe-color") {
      const universeEntry = map.universes.find((entry) => {
        const start = entry.strip * map.pixelsPerStrip + entry.startPixel;
        return i >= start && i < start + entry.length;
      });
      const universe = Number(universeEntry?.universe || 0);
      bytes[o] = (universe * 47) & 0xff;
      bytes[o + 1] = (80 + universe * 31) & 0xff;
      bytes[o + 2] = (180 - universe * 11) & 0xff;
    } else if (key === "address-check") {
      bytes[o] = i & 0xff;
      bytes[o + 1] = (i >> 8) & 0xff;
      bytes[o + 2] = 255;
    } else if (key === "heat-map") {
      const t = count > 1 ? i / (count - 1) : 0;
      bytes[o] = clampByte(t * 255);
      bytes[o + 1] = clampByte((1 - Math.abs(t - 0.5) * 2) * 255);
      bytes[o + 2] = clampByte((1 - t) * 255);
    } else {
      const band = i % 3;
      bytes[o] = band === 0 ? 255 : 0;
      bytes[o + 1] = band === 1 ? 255 : 0;
      bytes[o + 2] = band === 2 ? 255 : 0;
    }
  }

  return Object.freeze({ pattern: key, pixelCount: count, frameId: Number(frameId) || 0, rgb: bytes });
}

function summarizeUniverseMap(map) {
  return Object.freeze(map.universes.map((entry) => Object.freeze({
    label: `U${entry.universe}`,
    universe: entry.universe,
    strip: entry.strip,
    startPixel: entry.startPixel,
    length: entry.length,
    outputIp: entry.outputIp,
    enabled: entry.enabled !== false,
    fps: 0,
    load: 0,
    lastSend: 0
  })));
}

export function evaluateOutputCoreDiagnostics({ request = {}, env = process.env } = {}) {
  const profileName = String(request.profile || env?.LED_OUTPUT_PROFILE || "Club Full");
  const profile = resolveOutputProfile(profileName);
  const fps = clampInt(request.fps ?? profile.fps, 1, 120, profile.fps || 60);
  const pixelCount = clampInt(request.pixels ?? request.pixelCount ?? profile.totalPixels, 1, 10000, profile.totalPixels || 2400);
  const pattern = normalizePattern(request.pattern, { defaultValue: "rgb", allowed: [...PATTERNS], unknownValue: "rgb" });
  const frameId = clampInt(request.frameId, 0, 0xffff, 1);
  const compression = String(request.compression || profile.compression || "DIFF_FRAME").toUpperCase();
  const universeMap = buildDefaultEightStripUniverseMap({
    stripCount: clampInt(request.stripCount ?? profile.stripCount, 1, 64, profile.stripCount || 8),
    pixelsPerStrip: clampInt(request.pixelsPerStrip ?? profile.pixelsPerStrip, 1, 2000, profile.pixelsPerStrip || 300),
    pixelsPerUniverse: clampInt(request.pixelsPerUniverse ?? profile.pixelsPerUniverse, 1, 170, profile.pixelsPerUniverse || 150),
    outputIp: String(request.outputIp || request.host || profile.targetIp || "2.1.1.30")
  });

  const frame = makePatternFrame({ pattern, pixelCount, frameId, universeMap });
  const artnetPackets = splitRgbByUniverseMap({ rgb: frame.rgb, universeMap, sequence: frameId || 1 });
  const blxPacket = buildBlxAaFramePacket({ frameId, brightness: 255, rgb: frame.rgb, pixelCount });
  const compressed = encodeBlxCompressedFrame({ mode: compression, previous: new Uint8Array(frame.rgb.byteLength), current: frame.rgb });
  const benchmark = runBlxBenchmark({ fps, baudRate: clampInt(request.baudRate, 9600, 3000000, 1000000), changedPixels: clampInt(request.changedPixels, 1, pixelCount, 20) });
  const debug = buildOutputDebugSnapshot({
    render: { fps },
    output: {
      fps,
      sent: 1,
      dropped: 0,
      queueDepth: 0,
      lastLatencyMs: 0,
      jitterMs: 0
    },
    artnet: {
      packetCount: artnetPackets.length,
      packetBytes: artnetPackets.reduce((sum, packet) => sum + Number(packet.packetBytes || 0), 0)
    },
    blx: { ackOk: 0, ackTimeout: 0 },
    watchdog: { decision: "DRY_RUN" }
  });

  return Object.freeze({
    version: LIVE_OUTPUT_CORE_DIAGNOSTICS_VERSION,
    ok: true,
    status: "READY_DRY_RUN",
    dryRunOnly: true,
    outputTouched: false,
    networkTouched: false,
    serialTouched: false,
    profile,
    profiles: listOutputProfiles(),
    pattern: frame.pattern,
    availablePatterns: PATTERNS,
    frame: Object.freeze({
      frameId,
      pixelCount,
      byteLength: frame.rgb.byteLength,
      fps
    }),
    universeMap,
    universeVisualization: summarizeUniverseMap(universeMap),
    artnet: Object.freeze({
      packetCount: artnetPackets.length,
      payloadBytes: artnetPackets.reduce((sum, packet) => sum + Number(packet.dmxBytes || 0), 0),
      packetBytes: artnetPackets.reduce((sum, packet) => sum + Number(packet.packetBytes || 0), 0),
      artSync: profile.artSync !== false,
      universes: artnetPackets.map((packet) => packet.universe)
    }),
    blx: Object.freeze({
      protocol: blxPacket.protocol,
      packetBytes: blxPacket.packetBytes,
      payloadBytes: blxPacket.payloadBytes,
      compression: compressed
    }),
    debug,
    benchmark,
    summary: `${profile.name} | ${frame.pattern} | ${pixelCount}px | ${universeMap.universeCount}U | ${fps}fps | ArtSync ${profile.artSync !== false ? "ON" : "OFF"}`
  });
}

export function createLiveOutputCoreDiagnostics({ env = process.env } = {}) {
  return Object.freeze({
    version: LIVE_OUTPUT_CORE_DIAGNOSTICS_VERSION,
    evaluate: (request = {}) => evaluateOutputCoreDiagnostics({ request, env })
  });
}
