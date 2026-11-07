export const LIVE_HARDWARE_TEST_MODE_VERSION = "12P-real-hardware-test-mode-serial-artnet-low-risk";

const REQUIRED_CONFIRMATION = "CONFIRM_1_STRIP_LOW_BRIGHTNESS";
const MAX_STRIPS = 1;
const MAX_BRIGHTNESS = 0.1;
const MAX_FPS = 15;
const MAX_DURATION_MS = 60_000;

function numberValue(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeRequest(request = {}) {
  return Object.freeze({
    requested: Boolean(request.requested || request.enable || request.start),
    transportKind: String(request.transportKind || request.transport || "serial").toLowerCase(),
    stripCount: Math.max(0, Math.floor(numberValue(request.stripCount ?? request.strips, 0))),
    brightness: Math.max(0, numberValue(request.brightness, 0)),
    fps: Math.max(0, numberValue(request.fps, 0)),
    durationMs: Math.max(0, numberValue(request.durationMs, 0)),
    confirmation: String(request.confirmation || ""),
    operatorConfirmed: Boolean(request.operatorConfirmed),
    target: request.target && typeof request.target === "object" ? request.target : null
  });
}

export function evaluateLiveHardwareTestMode({
  request = {},
  liveEmergencyInterlock = null,
  liveTransportBoundary = null
} = {}) {
  const test = normalizeRequest(request);
  const blocked = [];
  const warnings = [];

  if (!test.requested) blocked.push("HARDWARE_TEST_NOT_REQUESTED");
  if (!["serial", "artnet"].includes(test.transportKind)) blocked.push("HARDWARE_TEST_TRANSPORT_UNSUPPORTED_12P");
  if (test.stripCount !== MAX_STRIPS) blocked.push("HARDWARE_TEST_REQUIRES_ONE_STRIP");
  if (test.brightness <= 0 || test.brightness > MAX_BRIGHTNESS) blocked.push("HARDWARE_TEST_BRIGHTNESS_LIMIT");
  if (test.fps <= 0 || test.fps > MAX_FPS) blocked.push("HARDWARE_TEST_FPS_LIMIT");
  if (test.durationMs <= 0 || test.durationMs > MAX_DURATION_MS) blocked.push("HARDWARE_TEST_DURATION_LIMIT");
  if (!test.operatorConfirmed || test.confirmation !== REQUIRED_CONFIRMATION) blocked.push("HARDWARE_TEST_CONFIRMATION_MISSING");

  const emergency = liveEmergencyInterlock?.evaluate?.({ requested: false, source: "hardware-test-12D" }) || null;
  if (emergency?.emergencyStopLatched) blocked.push("EMERGENCY_STOP_LATCHED");

  const boundary = liveTransportBoundary?.evaluate?.({
    transportKind: test.transportKind,
    packetCount: test.requested ? 1 : 0,
    payloadBytes: test.stripCount > 0 ? Math.max(3, test.stripCount * 3) : 0,
    routeDigest: `hardware-test-12P-${test.transportKind}`
  }) || null;
  if (!boundary) blocked.push("TRANSPORT_BOUNDARY_MISSING");
  if (boundary?.physicalWriteAllowed !== true) warnings.push("BOUNDARY_STILL_BLOCKS_PHYSICAL_WRITE");

  const ready = blocked.length === 0;

  return Object.freeze({
    version: LIVE_HARDWARE_TEST_MODE_VERSION,
    ok: ready,
    decision: ready ? "HARDWARE_TEST_READY_DRY_RUN" : "HARDWARE_TEST_BLOCKED",
    status: ready ? "READY_DRY_RUN" : "BLOCKED",
    requested: test.requested,
    transportKind: test.transportKind,
    stripCount: test.stripCount,
    brightness: test.brightness,
    fps: test.fps,
    durationMs: test.durationMs,
    limits: Object.freeze({
      maxStrips: MAX_STRIPS,
      maxBrightness: MAX_BRIGHTNESS,
      maxFps: MAX_FPS,
      maxDurationMs: MAX_DURATION_MS,
      requiredConfirmation: REQUIRED_CONFIRMATION
    }),
    emergency,
    boundary,
    blocked: Object.freeze(blocked),
    warnings: Object.freeze(warnings),
    testPatternPrepared: ready,
    physicalWriteAllowed: false,
    outputTouched: false,
    serialTouched: false,
    networkTouched: false,
    dryRunOnly: true,
    safety: "12P hardware test mode prepares constrained serial/ArtNet low-brightness dry-runs only; no physical write API is called"
  });
}

export function createLiveHardwareTestMode({
  liveEmergencyInterlock = null,
  liveTransportBoundary = null
} = {}) {
  function evaluate(request = {}) {
    return evaluateLiveHardwareTestMode({
      request,
      liveEmergencyInterlock,
      liveTransportBoundary
    });
  }

  return Object.freeze({
    version: LIVE_HARDWARE_TEST_MODE_VERSION,
    evaluate
  });
}
