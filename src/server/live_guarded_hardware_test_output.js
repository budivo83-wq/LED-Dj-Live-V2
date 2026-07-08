import { clampInt, clampNumber, normalizePattern, normalizeTransport } from "./live_output_common.js";

export const LIVE_GUARDED_HARDWARE_TEST_OUTPUT_VERSION = "12P-guarded-hardware-test-output-serial-artnet";

const ALLOWED_PATTERNS = new Set(["blackout", "red", "green", "blue", "white-low", "single-pixel-chase"]);
const REQUIRED_CONFIRMATION = "CONFIRM_HARDWARE_TEST_OUTPUT_LOW_BRIGHTNESS";
const MAX_PIXELS = 150;
const MAX_BRIGHTNESS = 0.1;
const MAX_FRAMES = 16;
const MAX_FPS = 15;
const MAX_DURATION_MS = 60_000;

function rgbForPattern(pattern, pixelIndex, frameIndex, brightness) {
  const scale = Math.max(0, Math.min(1, brightness));
  if (pattern === "blackout") return [0, 0, 0];
  if (pattern === "red") return [Math.round(255 * scale), 0, 0];
  if (pattern === "green") return [0, Math.round(255 * scale), 0];
  if (pattern === "blue") return [0, 0, Math.round(255 * scale)];
  if (pattern === "white-low") {
    const v = Math.round(96 * scale);
    return [v, v, v];
  }
  if (pattern === "single-pixel-chase") {
    return pixelIndex === frameIndex ? [Math.round(255 * scale), Math.round(80 * scale), 0] : [0, 0, 0];
  }
  return [0, 0, 0];
}

function buildFrames({ pattern, pixels, brightness, frames }) {
  const frameCount = pattern === "single-pixel-chase" ? Math.max(1, frames) : 1;
  return Array.from({ length: frameCount }, (_, frameIndex) => {
    const payload = [];
    for (let i = 0; i < pixels; i += 1) payload.push(...rgbForPattern(pattern, i, frameIndex % pixels, brightness));
    return Object.freeze({ frameIndex, payloadBytes: payload.length, previewHead: Object.freeze(payload.slice(0, 24)) });
  });
}

function normalizeRequest(request = {}) {
  const pattern = normalizePattern(request.pattern || request.testPattern, { defaultValue: "blackout", allowed: [...ALLOWED_PATTERNS], unknownValue: "unknown" });
  const pixels = clampInt(request.pixels ?? request.pixelCount, 1, MAX_PIXELS, 150);
  const brightness = clampNumber(request.brightness, 0, MAX_BRIGHTNESS, 0.05);
  const fps = clampInt(request.fps, 1, MAX_FPS, 10);
  const frames = clampInt(request.frames ?? request.frameCount, 1, MAX_FRAMES, pattern === "single-pixel-chase" ? 8 : 1);
  return Object.freeze({
    requested: Boolean(request.requested || request.start || request.enable),
    transportKind: normalizeTransport(request.transportKind || request.transport || "serial"),
    pattern,
    pixels,
    brightness,
    fps,
    frames,
    durationMs: clampInt(request.durationMs, 1, MAX_DURATION_MS, 5000),
    operatorConfirmed: Boolean(request.operatorConfirmed),
    confirmation: String(request.confirmation || ""),
    port: String(request.port || request.path || ""),
    baudRate: Number(request.baudRate || 0),
    armToken: request.armToken ? String(request.armToken) : null,
    fullLiveToken: request.fullLiveToken || request.token ? String(request.fullLiveToken || request.token) : null,
    mappingDigest: String(request.mappingDigest || "hardware-test-output-12L"),
    transportPlanDigest: String(request.transportPlanDigest || request.routeDigest || "hardware-test-output-12L"),
    outputMode: String(request.outputMode || request.transportKind || request.transport || "serial"),
    target: Object.freeze({
      host: String(request.host || request.ip || request.target?.host || request.target?.ip || "127.0.0.1"),
      port: Number(request.target?.port || request.port || 6454),
      universe: Number(request.target?.universe ?? request.universe ?? 0)
    })
  });
}

export function evaluateLiveGuardedHardwareTestOutput({
  request = {},
  liveHardwareTestMode = null,
  liveSerialWriter = null,
  liveUdpWriter = null,
  liveEmergencyInterlock = null
} = {}) {
  const test = normalizeRequest(request);
  const blocked = [];
  const warnings = [];

  if (!test.requested) blocked.push("HARDWARE_TEST_OUTPUT_NOT_REQUESTED");
  if (!["serial", "artnet"].includes(test.transportKind)) blocked.push("HARDWARE_TEST_OUTPUT_TRANSPORT_UNSUPPORTED_12P");
  if (test.pattern === "unknown") blocked.push("HARDWARE_TEST_OUTPUT_PATTERN_UNKNOWN");
  if (!test.operatorConfirmed || test.confirmation !== REQUIRED_CONFIRMATION) blocked.push("HARDWARE_TEST_OUTPUT_CONFIRMATION_MISSING");

  const emergency = liveEmergencyInterlock?.evaluate?.({ requested: false, source: "hardware-test-output-12L" }) || null;
  if (emergency?.emergencyStopLatched) blocked.push("EMERGENCY_STOP_LATCHED");

  const mode = liveHardwareTestMode?.evaluate?.({
    requested: test.requested,
    transportKind: test.transportKind,
    stripCount: 1,
    brightness: test.brightness,
    fps: test.fps,
    durationMs: test.durationMs,
    operatorConfirmed: test.operatorConfirmed,
    confirmation: "CONFIRM_1_STRIP_LOW_BRIGHTNESS"
  }) || null;
  if (!mode) blocked.push("HARDWARE_TEST_MODE_MISSING");
  if (mode && mode.ok !== true) blocked.push("HARDWARE_TEST_MODE_NOT_READY");

  const frames = buildFrames(test);
  const totalPayloadBytes = frames.reduce((sum, frame) => sum + frame.payloadBytes, 0);
  const serialCandidate = test.transportKind === "serial" ? liveSerialWriter?.evaluate?.({
    packetCount: frames.length,
    payloadBytes: totalPayloadBytes,
    routeDigest: test.transportPlanDigest,
    mappingDigest: test.mappingDigest,
    transportPlanDigest: test.transportPlanDigest,
    outputMode: "serial",
    armToken: test.armToken,
    fullLiveToken: test.fullLiveToken,
    operatorConfirmed: test.operatorConfirmed,
    confirmation: test.confirmation,
    port: test.port,
    baudRate: test.baudRate
  }) || null : null;
  const artnetCandidate = test.transportKind === "artnet" ? liveUdpWriter?.evaluate?.({
    transportKind: "artnet",
    packetCount: frames.length,
    payloadBytes: totalPayloadBytes,
    routeDigest: test.transportPlanDigest,
    mappingDigest: test.mappingDigest,
    transportPlanDigest: test.transportPlanDigest,
    outputMode: "artnet",
    armToken: test.armToken,
    fullLiveToken: test.fullLiveToken,
    operatorConfirmed: test.operatorConfirmed,
    confirmation: test.confirmation,
    target: test.target
  }) || null : null;
  if (test.transportKind === "serial" && !serialCandidate) blocked.push("SERIAL_WRITER_CANDIDATE_MISSING");
  if (test.transportKind === "artnet" && !artnetCandidate) blocked.push("ARTNET_WRITER_CANDIDATE_MISSING");
  if (serialCandidate?.ok !== true && test.transportKind === "serial") warnings.push("SERIAL_WRITER_NOT_READY_REAL_WRITE_REMAINS_BLOCKED");
  if (artnetCandidate?.ok !== true && test.transportKind === "artnet") warnings.push("ARTNET_WRITER_NOT_READY_REAL_WRITE_REMAINS_BLOCKED");

  const ok = blocked.length === 0;
  return Object.freeze({
    version: LIVE_GUARDED_HARDWARE_TEST_OUTPUT_VERSION,
    ok,
    decision: ok ? "HARDWARE_TEST_OUTPUT_PREPARED_GUARDED" : "HARDWARE_TEST_OUTPUT_BLOCKED",
    status: ok ? "PREPARED_GUARDED" : "BLOCKED",
    request: test,
    limits: Object.freeze({
      allowedPatterns: Object.freeze([...ALLOWED_PATTERNS]),
      maxPixels: MAX_PIXELS,
      maxBrightness: MAX_BRIGHTNESS,
      maxFrames: MAX_FRAMES,
      maxFps: MAX_FPS,
      maxDurationMs: MAX_DURATION_MS,
      requiredConfirmation: REQUIRED_CONFIRMATION
    }),
    frames: Object.freeze(frames),
    frameCount: frames.length,
    totalPayloadBytes,
    mode,
    emergency,
    serialCandidate,
    artnetCandidate,
    blocked: Object.freeze(blocked),
    warnings: Object.freeze(warnings),
    physicalWriteAllowed: false,
    outputTouched: false,
    serialTouched: false,
    networkTouched: false,
    dryRunOnly: true,
    safety: "12P prepares constrained low-brightness hardware-test payloads for serial or ArtNet candidate evaluation only; no serial write API is called and no UDP packet is sent"
  });
}

export function createLiveGuardedHardwareTestOutput({
  liveHardwareTestMode = null,
  liveSerialWriter = null,
  liveUdpWriter = null,
  liveEmergencyInterlock = null
} = {}) {
  function evaluate(request = {}) {
    return evaluateLiveGuardedHardwareTestOutput({ request, liveHardwareTestMode, liveSerialWriter, liveUdpWriter, liveEmergencyInterlock });
  }
  return Object.freeze({ version: LIVE_GUARDED_HARDWARE_TEST_OUTPUT_VERSION, evaluate });
}
