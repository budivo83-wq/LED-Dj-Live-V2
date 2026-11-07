// STEP 11Q — Live Frame Mirror Validation
// Dry-run only. Creates a read-only mirror signature for the authoritative frame and
// validates that the live-executor candidate still points at the same frame evidence.
// This file must never call serial/network/socket/write APIs.

export const LIVE_FRAME_MIRROR_VALIDATION_VERSION = "11Q-live-frame-mirror-validation";

function asNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function freezeList(values) {
  return Object.freeze([...(Array.isArray(values) ? values : [])]);
}

function deriveBytes(frame = null) {
  if (!frame) return new Uint8Array(0);
  if (frame instanceof Uint8Array) return frame;
  if (ArrayBuffer.isView(frame)) return new Uint8Array(frame.buffer, frame.byteOffset, frame.byteLength);
  if (Array.isArray(frame)) return Uint8Array.from(frame.map((v) => Math.max(0, Math.min(255, Number(v) || 0))));
  if (ArrayBuffer.isView(frame?.pixels)) return new Uint8Array(frame.pixels.buffer, frame.pixels.byteOffset, frame.pixels.byteLength);
  if (Array.isArray(frame?.pixels)) return Uint8Array.from(frame.pixels.map((v) => Math.max(0, Math.min(255, Number(v) || 0))));
  return new Uint8Array(0);
}

function digestBytes(bytes) {
  // Small deterministic non-cryptographic digest. Stable enough for QA/debug evidence.
  let h1 = 2166136261 >>> 0;
  let h2 = 16777619 >>> 0;
  for (let i = 0; i < bytes.length; i += 1) {
    const v = bytes[i] >>> 0;
    h1 ^= v;
    h1 = Math.imul(h1, 16777619) >>> 0;
    h2 = (h2 + Math.imul(v + i + 1, 2654435761)) >>> 0;
  }
  return `${h1.toString(16).padStart(8, "0")}${h2.toString(16).padStart(8, "0")}`;
}

function sampleBytes(bytes, maxSamples = 16) {
  if (!bytes.length) return Object.freeze([]);
  const count = Math.max(1, Math.min(maxSamples, bytes.length));
  const out = [];
  if (count === 1) return Object.freeze([{ index: 0, value: bytes[0] }]);
  for (let i = 0; i < count; i += 1) {
    const index = Math.min(bytes.length - 1, Math.round((i * (bytes.length - 1)) / (count - 1)));
    out.push(Object.freeze({ index, value: bytes[index] }));
  }
  return Object.freeze(out);
}

function hasAnyGuardTrip(...values) {
  return values.some((value) => Boolean(
    value?.physicalWriteAllowed ||
    value?.outputTouched ||
    value?.networkTouched ||
    value?.serialTouched ||
    value?.writeTouched ||
    value?.socketTouched
  ));
}

export function buildLiveFrameMirrorValidation({
  enabled = false,
  authoritativeFrame = null,
  frameSource = "frame_bus",
  frameTimestampMs = null,
  frameId = 0,
  liveExecutorPreflight = null,
  executionCommitPreview = null,
  routePlan = null,
  transportBatchPlan = null,
  expectedPixels = null,
  sampleCount = 16
} = {}) {
  if (!enabled) {
    return Object.freeze({
      version: LIVE_FRAME_MIRROR_VALIDATION_VERSION,
      enabled: false,
      ok: false,
      decision: "DISABLED",
      status: "OFF",
      severity: "off",
      canValidateLiveMirror: false,
      frameId: asNumber(frameId, 0),
      mirror: null,
      checks: Object.freeze({}),
      metrics: Object.freeze({}),
      warnings: freezeList([]),
      blocked: freezeList([]),
      blockerCount: 0,
      warningCount: 0,
      digest: "none",
      dryRunOnly: true,
      physicalWriteAllowed: false,
      outputTouched: false,
      networkTouched: false,
      serialTouched: false
    });
  }

  const blocked = [];
  const warnings = [];
  const addBlock = (code) => { if (!blocked.includes(code)) blocked.push(code); };
  const addWarn = (code) => { if (!warnings.includes(code)) warnings.push(code); };

  const bytes = deriveBytes(authoritativeFrame);
  const safeFrameId = asNumber(frameId || liveExecutorPreflight?.frameId || executionCommitPreview?.frameId, 0);
  const source = String(frameSource || authoritativeFrame?.source || authoritativeFrame?.meta?.source || "").toLowerCase();
  const frameAuthority = source === "frame_bus" || source === "authoritative_frame" || source === "qa-authoritative-frame";
  if (!frameAuthority) addBlock("MIRROR_FRAME_AUTHORITY_INVALID");

  const pixelCount = bytes.length ? Math.floor(bytes.length / 3) : 0;
  const expectedPixelCount = Math.max(
    asNumber(expectedPixels, 0),
    asNumber(liveExecutorPreflight?.metrics?.expectedPixels, 0),
    asNumber(routePlan?.pixelCount || routePlan?.totalPixels, 0),
    asNumber(transportBatchPlan?.pixelCount || transportBatchPlan?.totalPixels, 0)
  );
  if (!bytes.length) addBlock("MIRROR_FRAME_EMPTY");
  if (bytes.length % 3 !== 0) addBlock("MIRROR_FRAME_BYTE_ALIGNMENT_INVALID");
  if (expectedPixelCount > 0 && pixelCount !== expectedPixelCount) addBlock("MIRROR_PIXEL_COUNT_MISMATCH");

  const preflightOk = Boolean(liveExecutorPreflight?.ok && liveExecutorPreflight?.canArmLive);
  if (!preflightOk) addBlock("PREFLIGHT_NOT_OK");

  const commitPreviewOk = executionCommitPreview ? Boolean(executionCommitPreview?.ok || executionCommitPreview?.operationCount > 0) : true;
  const operationCount = asNumber(executionCommitPreview?.preview?.operationCount ?? executionCommitPreview?.operationCount, 0);
  if (!commitPreviewOk) addBlock("COMMIT_PREVIEW_NOT_OK");
  if (executionCommitPreview && operationCount <= 0) addBlock("COMMIT_PREVIEW_EMPTY");

  const preflightFrameId = asNumber(liveExecutorPreflight?.frameId, safeFrameId);
  const commitFrameId = asNumber(executionCommitPreview?.preview?.frameId ?? executionCommitPreview?.frameId, safeFrameId);
  const frameIdsAligned = safeFrameId === preflightFrameId && safeFrameId === commitFrameId;
  if (!frameIdsAligned) addBlock("MIRROR_FRAME_ID_MISMATCH");

  const frameTimestampValid = frameTimestampMs == null || asNumber(frameTimestampMs, 0) > 0;
  if (!frameTimestampValid) addWarn("MIRROR_TIMESTAMP_MISSING");

  const guardTrip = hasAnyGuardTrip(authoritativeFrame, liveExecutorPreflight, executionCommitPreview, routePlan, transportBatchPlan);
  if (guardTrip) addBlock("MIRROR_DRY_RUN_GUARD_VIOLATION");

  const mirrorDigest = digestBytes(bytes);
  const mirror = Object.freeze({
    frameId: safeFrameId,
    source,
    byteLength: bytes.length,
    pixelCount,
    digest: mirrorDigest,
    samples: sampleBytes(bytes, sampleCount),
    timestampMs: frameTimestampMs == null ? 0 : asNumber(frameTimestampMs, 0),
    dryRunOnly: true,
    physicalWriteAllowed: false
  });

  const checks = Object.freeze({
    frameAuthority,
    frameNonEmpty: bytes.length > 0,
    byteAlignmentValid: bytes.length > 0 && bytes.length % 3 === 0,
    pixelCountValid: expectedPixelCount <= 0 || pixelCount === expectedPixelCount,
    preflightOk,
    commitPreviewOk,
    frameIdsAligned,
    dryRunProtected: !guardTrip
  });
  const metrics = Object.freeze({
    frameId: safeFrameId,
    byteLength: bytes.length,
    pixelCount,
    expectedPixelCount,
    operationCount,
    sampleCount: mirror.samples.length
  });

  const ok = blocked.length === 0;
  const status = ok ? (warnings.length ? "MIRROR_VALIDATED_WITH_WARNINGS" : "MIRROR_VALIDATED") : "BLOCKED";
  const severity = ok ? (warnings.length ? "warning" : "ok") : "error";
  const decision = ok ? "LIVE_MIRROR_VALID_DRY_RUN" : "LIVE_MIRROR_BLOCKED";
  const digest = ["mirror", safeFrameId, status, mirrorDigest, blocked.join("+") || "none", warnings.join("+") || "none"].join(":");

  return Object.freeze({
    version: LIVE_FRAME_MIRROR_VALIDATION_VERSION,
    enabled: true,
    ok,
    decision,
    status,
    severity,
    canValidateLiveMirror: ok,
    frameId: safeFrameId,
    mirror,
    checks,
    metrics,
    warnings: freezeList(warnings),
    blocked: freezeList(blocked),
    blockerCount: blocked.length,
    warningCount: warnings.length,
    digest,
    dryRunOnly: true,
    physicalWriteAllowed: false,
    outputTouched: false,
    networkTouched: false,
    serialTouched: false,
    safety: "11Q live frame mirror validation is dry-run only and never writes to serial/network/output"
  });
}
