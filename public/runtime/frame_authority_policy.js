// Frame Authority Policy — STEP 8E
//
// STEP 8C centralized the publish gate. STEP 8D kept that permissive publish
// gate and moved the output-owned render decision into this policy module.
// STEP 8E tightens hidden/minimized behavior: documentHidden no longer means
// "always render separately". Output reuses the latest authoritative frame
// while it is fresh, and only renders its safety fallback when the frame is
// missing or stale. This reduces dual-render drift while preserving LED
// transport protection when preview timers sleep.

export const FRAME_AUTHORITY_POLICY_VERSION = "8E-output-freshness-guard";

export const FRAME_POLICY_DECISIONS = Object.freeze({
  ALLOW: "allow",
  REJECT: "reject"
});

export const FRAME_POLICY_REASONS = Object.freeze({
  VALID_PRODUCER: "valid-producer",
  INVALID_SOURCE: "invalid-source",
  INVALID_DIMENSIONS: "invalid-dimensions",
  INVALID_FRAME: "invalid-frame"
});

function normalizeSource(source) {
  return typeof source === "string" ? source.trim() : "";
}

function normalizeByteLength(frame) {
  return frame instanceof Uint8Array ? frame.byteLength : 0;
}

function expectedByteLength(dimensions) {
  const width = Math.max(0, Math.round(Number(dimensions?.width || 0)));
  const height = Math.max(0, Math.round(Number(dimensions?.height || 0)));
  return Math.max(0, width * height * 3);
}

export function evaluateFramePublishPolicy(input = {}) {
  const source = normalizeSource(input.source);
  const dimensions = input.dimensions || {};
  const width = Math.max(0, Math.round(Number(dimensions.width || 0)));
  const height = Math.max(0, Math.round(Number(dimensions.height || 0)));
  const actualBytes = normalizeByteLength(input.frame);
  const expectedBytes = expectedByteLength({ width, height });

  if (!source) {
    return Object.freeze({
      decision: FRAME_POLICY_DECISIONS.REJECT,
      reason: FRAME_POLICY_REASONS.INVALID_SOURCE,
      policyVersion: FRAME_AUTHORITY_POLICY_VERSION,
      source: "",
      width,
      height,
      actualBytes,
      expectedBytes
    });
  }

  if (width <= 0 || height <= 0 || expectedBytes <= 0) {
    return Object.freeze({
      decision: FRAME_POLICY_DECISIONS.REJECT,
      reason: FRAME_POLICY_REASONS.INVALID_DIMENSIONS,
      policyVersion: FRAME_AUTHORITY_POLICY_VERSION,
      source,
      width,
      height,
      actualBytes,
      expectedBytes
    });
  }

  if (!(input.frame instanceof Uint8Array) || actualBytes !== expectedBytes) {
    return Object.freeze({
      decision: FRAME_POLICY_DECISIONS.REJECT,
      reason: FRAME_POLICY_REASONS.INVALID_FRAME,
      policyVersion: FRAME_AUTHORITY_POLICY_VERSION,
      source,
      width,
      height,
      actualBytes,
      expectedBytes
    });
  }

  return Object.freeze({
    decision: FRAME_POLICY_DECISIONS.ALLOW,
    reason: FRAME_POLICY_REASONS.VALID_PRODUCER,
    policyVersion: FRAME_AUTHORITY_POLICY_VERSION,
    source,
    width,
    height,
    actualBytes,
    expectedBytes
  });
}


export const OUTPUT_RENDER_POLICY_VERSION = "8E-output-freshness-guard";

export const OUTPUT_RENDER_DECISIONS = Object.freeze({
  USE_LATEST: "use-latest-frame",
  RENDER_FRESH: "render-fresh-output-frame"
});

export const OUTPUT_RENDER_REASONS = Object.freeze({
  OUTPUT_DISABLED: "output-disabled",
  NO_USABLE_FRAME: "no-usable-frame",
  DOCUMENT_HIDDEN_STALE: "document-hidden-stale",
  STALE_FRAME: "stale-frame",
  LATEST_FRAME_OK: "latest-frame-ok",
  HIDDEN_LATEST_FRAME_OK: "hidden-latest-frame-ok"
});

function normalizeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function evaluateOutputRenderPolicy(input = {}) {
  const outputEnabled = input.outputEnabled === true;
  const hasUsableFrame = input.hasUsableFrame === true;
  const documentHidden = input.documentHidden === true;
  const targetFrameMs = Math.max(1, normalizeNumber(input.targetFrameMs, 16.67));
  const frameAgeMs = Math.max(0, normalizeNumber(input.frameAgeMs, Number.POSITIVE_INFINITY));
  const staleLimitMs = Math.max(targetFrameMs * 1.75, targetFrameMs + 8);
  // In hidden/minimized mode browsers can throttle visible rendering, but this
  // app already arms a background preview worker. Do not create a second render
  // stream unless the authoritative frame has actually gone stale.
  const hiddenStaleLimitMs = Math.max(targetFrameMs * 2.5, targetFrameMs + 20);

  if (!outputEnabled) {
    return Object.freeze({
      decision: OUTPUT_RENDER_DECISIONS.USE_LATEST,
      reason: OUTPUT_RENDER_REASONS.OUTPUT_DISABLED,
      policyVersion: OUTPUT_RENDER_POLICY_VERSION,
      outputEnabled,
      hasUsableFrame,
      documentHidden,
      frameAgeMs,
      staleLimitMs,
      hiddenStaleLimitMs
    });
  }

  if (!hasUsableFrame) {
    return Object.freeze({
      decision: OUTPUT_RENDER_DECISIONS.RENDER_FRESH,
      reason: OUTPUT_RENDER_REASONS.NO_USABLE_FRAME,
      policyVersion: OUTPUT_RENDER_POLICY_VERSION,
      outputEnabled,
      hasUsableFrame,
      documentHidden,
      frameAgeMs,
      staleLimitMs,
      hiddenStaleLimitMs
    });
  }

  if (documentHidden && frameAgeMs > hiddenStaleLimitMs) {
    return Object.freeze({
      decision: OUTPUT_RENDER_DECISIONS.RENDER_FRESH,
      reason: OUTPUT_RENDER_REASONS.DOCUMENT_HIDDEN_STALE,
      policyVersion: OUTPUT_RENDER_POLICY_VERSION,
      outputEnabled,
      hasUsableFrame,
      documentHidden,
      frameAgeMs,
      staleLimitMs,
      hiddenStaleLimitMs
    });
  }

  if (!documentHidden && frameAgeMs > staleLimitMs) {
    return Object.freeze({
      decision: OUTPUT_RENDER_DECISIONS.RENDER_FRESH,
      reason: OUTPUT_RENDER_REASONS.STALE_FRAME,
      policyVersion: OUTPUT_RENDER_POLICY_VERSION,
      outputEnabled,
      hasUsableFrame,
      documentHidden,
      frameAgeMs,
      staleLimitMs,
      hiddenStaleLimitMs
    });
  }

  return Object.freeze({
    decision: OUTPUT_RENDER_DECISIONS.USE_LATEST,
    reason: documentHidden ? OUTPUT_RENDER_REASONS.HIDDEN_LATEST_FRAME_OK : OUTPUT_RENDER_REASONS.LATEST_FRAME_OK,
    policyVersion: OUTPUT_RENDER_POLICY_VERSION,
    outputEnabled,
    hasUsableFrame,
    documentHidden,
    frameAgeMs,
    staleLimitMs,
    hiddenStaleLimitMs
  });
}
