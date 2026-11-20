import { getRuntimeFrameBus } from "./frame_bus.js";
import { FRAME_AUTHORITY_POLICY_VERSION, FRAME_POLICY_DECISIONS, evaluateFramePublishPolicy } from "./frame_authority_policy.js";
import { expectedFrameByteLength, isValidFrameBytes, normalizeFrameDimensions, normalizeFrameSource } from "./frame_contract.js";

// Frame Authority — STEP 8M
//
// Purpose:
//   This is the single publishing boundary for composed runtime frames.
//   Render/output fallback paths may still produce pixels, but they must publish
//   through this authority so preview, output and debug observe the same frameId
//   and immutable packet contract.
//
// Rule:
//   producers create pixels; Frame Authority validates, clones, classifies and
//   publishes. Consumers read from the frame bus; they do not mutate or republish
//   packets.
//
// STEP 8B added producer bookkeeping.
// STEP 8C added a soft publish gate. STEP 8D made output fallback explicit.
// STEP 8E keeps output fallback, but avoids creating a second render stream
// while a fresh authoritative frame already exists.
// STEP 8I adds an in-authority composed-frame API so render_pipeline no
// longer calls the raw publishFrame entry directly. This keeps the stable
// 8E startup/runtime path, but creates a safer boundary before attempting
// another external commit module.

export const FRAME_AUTHORITY_VERSION = "STEP22NI_FRAME_EVENT_FASTPATH";

const ARTNET_MASTER_MIRROR_FLAG = "budilightArtNetMasterMirror22EJ";
const ARTNET_MASTER_MIRROR_FPS_KEY = "budilightArtNetMasterMirrorFps22EJ";
const DEFAULT_ARTNET_MASTER_MIRROR_FPS = 30;
const DEFAULT_AUTHORITY_STATS_PUBLISH_MS = 250;
const DEFAULT_AUTHORITY_FRAME_EVENT_MS = 0;

function getArtnetMirrorRuntime() {
  try {
    if (!globalThis.__budilightArtnetMirrorRuntime22GV) {
      globalThis.__budilightArtnetMirrorRuntime22GV = {
        inFlight: false,
        lastFrameId: 0,
        lastSentAt: 0,
        sent: 0,
        skipped: 0,
        errors: 0,
        lastError: ""
      };
    }
    return globalThis.__budilightArtnetMirrorRuntime22GV;
  } catch {
    return null;
  }
}

function artnetMirrorEnabled() {
  try {
    return globalThis.localStorage?.getItem?.(ARTNET_MASTER_MIRROR_FLAG) !== "0";
  } catch {
    return true;
  }
}

function artnetMirrorTargetFps() {
  try {
    const value = Number(globalThis.localStorage?.getItem?.(ARTNET_MASTER_MIRROR_FPS_KEY) || DEFAULT_ARTNET_MASTER_MIRROR_FPS);
    return Number.isFinite(value) ? Math.max(1, Math.min(60, value)) : DEFAULT_ARTNET_MASTER_MIRROR_FPS;
  } catch {
    return DEFAULT_ARTNET_MASTER_MIRROR_FPS;
  }
}

function mirrorPacketToArtnetMaster(packet) {
  const runtime = getArtnetMirrorRuntime();
  if (!runtime) return;
  if (globalThis.__budilightArtNetMasterMirror22EJ) return;
  if (!artnetMirrorEnabled()) return;
  if (!packet || !(packet.frame instanceof Uint8Array)) return;
  if (typeof fetch !== "function") return;
  const frameId = Number(packet.frameId || 0);
  if (frameId > 0 && frameId === runtime.lastFrameId) {
    runtime.skipped += 1;
    return;
  }
  const now = (typeof performance !== "undefined" && typeof performance.now === "function") ? performance.now() : Date.now();
  const minPeriodMs = Math.max(16, 1000 / artnetMirrorTargetFps());
  if (runtime.inFlight || (now - Number(runtime.lastSentAt || 0)) < minPeriodMs) {
    runtime.skipped += 1;
    return;
  }
  runtime.inFlight = true;
  runtime.lastSentAt = now;
  runtime.lastFrameId = frameId;

  const width = Math.max(1, Math.round(Number(packet.width || 300)));
  const height = Math.max(1, Math.round(Number(packet.height || 8)));
  const stripCount = Math.max(1, Math.min(64, height));
  const pixelsPerStrip = Math.max(1, Math.min(1000, width));
  const query = new URLSearchParams({
    source: "performance-frame-authority-artnet-master",
    frameId: String(frameId || 0),
    stripCount: String(stripCount),
    pixelsPerStrip: String(pixelsPerStrip),
    width: String(width),
    height: String(height),
    format: String(packet.format || "rgb8"),
    colorOrder: String(packet.colorOrder || "rgb")
  });

  fetch(`/api/artnet/master-mirror/frame-bin?${query.toString()}`, {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream" },
    body: packet.frame
  }).then(async (response) => {
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body?.error || response.statusText || "artnet_master_mirror_post_failed");
    }
    runtime.sent += 1;
    runtime.lastError = "";
  }).catch((error) => {
    runtime.errors += 1;
    runtime.lastError = String(error?.message || error || "artnet_master_mirror_post_failed");
  }).finally(() => {
    runtime.inFlight = false;
  });
}


export const FRAME_CONSUMERS = Object.freeze({
  OUTPUT_LOOP: "output-loop",
  PREVIEW3D_FRAME_BRIDGE: "preview3d-frame-bridge",
  GENERIC_READ: "generic-read",
  GENERIC_SUBSCRIBE: "generic-subscribe",
  UNKNOWN: "unknown-consumer"
});

export const FRAME_PRODUCERS = Object.freeze({
  PREVIEW_RENDER: "preview-render",
  OUTPUT_OWNED_RENDER: "output-owned-render",
  OUTPUT_STARTUP_FALLBACK: "output-startup-fallback",
  RENDER_PIPELINE: "render-pipeline",
  UNKNOWN: "unknown-producer"
});

function cloneBytes(frame) {
  if (!(frame instanceof Uint8Array)) return null;
  return new Uint8Array(frame);
}

function makeProducerStats() {
  return {
    publishCount: 0,
    rejectedCount: 0,
    lastFrameId: 0,
    lastPublishAt: 0,
    lastRejectReason: "none",
    lastRenderMs: 0,
    lastByteLength: 0,
    lastPolicyDecision: "none",
    lastPolicyReason: "none",
    lastPreviewMode: "unknown",
    lastOutputEnabled: false,
    lastSerialPipelineEnabled: false,
    lastMeta: null
  };
}

function cloneProducerStats(stats) {
  return Object.freeze({ ...stats });
}

function makeMeta(options = {}, dimensions, frame, producerStats) {
  return {
    ...(options.meta && typeof options.meta === "object" ? options.meta : {}),
    authorityVersion: FRAME_AUTHORITY_VERSION,
    policyVersion: FRAME_AUTHORITY_POLICY_VERSION,
    policyDecision: options.policy?.decision || "unknown",
    policyReason: options.policy?.reason || "unknown",
    producer: normalizeSource(options.source),
    producerPublishCount: producerStats?.publishCount || 0,
    outputEnabled: Boolean(options.outputEnabled),
    serialPipelineEnabled: Boolean(options.serialPipelineEnabled),
    previewMode: typeof options.previewMode === "string" ? options.previewMode : "unknown",
    beat: Number.isFinite(options.beat) ? options.beat : null,
    renderer: typeof options.renderer === "string" ? options.renderer : "unknown",
    outputMode: typeof options.outputMode === "string" ? options.outputMode : "unknown",
    targetFps: Number.isFinite(options.targetFps) ? options.targetFps : null,
    byteLength: frame?.byteLength || 0,
    expectedByteLength: expectedFrameByteLength(dimensions)
  };
}

function dispatchAuthorityEvent(type, detail) {
  try {
    globalThis.dispatchEvent?.(new CustomEvent(type, { detail }));
  } catch {
    // Browserless tests may not expose CustomEvent.
  }
}

function publishAuthorityStatsToGlobal(getStats) {
  try {
    const stats = getStats();
    globalThis.__ledFrameAuthorityStats = stats;
    dispatchAuthorityEvent("led-frame-authority-stats", stats);
  } catch {
    // diagnostics only
  }
}

export function createFrameAuthority(options = {}) {
  const frameBus = options.frameBus || getRuntimeFrameBus();
  const runtimeProfile = globalThis.RUNTIME_PROFILE || {};
  const producerStats = new Map();
  let rejectedCount = 0;
  let publishCount = 0;
  let lastRejectReason = "none";
  let lastProducer = FRAME_PRODUCERS.UNKNOWN;
  let policyAllowCount = 0;
  let policyRejectCount = 0;
  let lastPolicyDecision = "none";
  let lastPolicyReason = "none";
  const consumerStats = new Map();
  const resolveIntervalMs = (primary, secondary, fallback) => {
    const a = Number(primary);
    if (Number.isFinite(a)) return Math.max(0, a);
    const b = Number(secondary);
    if (Number.isFinite(b)) return Math.max(0, b);
    return Math.max(0, Number(fallback) || 0);
  };
  const statsPublishIntervalMs = resolveIntervalMs(options.statsPublishIntervalMs, runtimeProfile.frameAuthorityStatsMs, DEFAULT_AUTHORITY_STATS_PUBLISH_MS);
  // Keep the render-core publish event unthrottled as well. It is lightweight
  // and keeps downstream live consumers aligned with the actual render clock.
  const frameEventIntervalMs = resolveIntervalMs(options.frameEventIntervalMs, runtimeProfile.frameAuthorityFrameEventMs, DEFAULT_AUTHORITY_FRAME_EVENT_MS);
  let lastStatsPublishAt = 0;
  let lastFrameEventAt = 0;
  let lastProducerMetaStoreAt = 0;

  function publishAuthorityStatsNow(force = false) {
    try {
      const now = (typeof performance !== "undefined" && typeof performance.now === "function") ? performance.now() : Date.now();
      if (!force && statsPublishIntervalMs > 0 && lastStatsPublishAt && now - lastStatsPublishAt < statsPublishIntervalMs) return;
      lastStatsPublishAt = now;
      publishAuthorityStatsToGlobal(getStats);
    } catch {
      // diagnostics only
    }
  }

  function dispatchFramePublishEvent(detail) {
    const now = (typeof performance !== "undefined" && typeof performance.now === "function") ? performance.now() : Date.now();
    if (frameEventIntervalMs > 0 && lastFrameEventAt && now - lastFrameEventAt < frameEventIntervalMs) return;
    lastFrameEventAt = now;
    dispatchAuthorityEvent("led-rendercore-frame-published", detail);
  }

  function normalizeConsumer(consumer) {
    if (typeof consumer !== "string" || !consumer.trim()) return FRAME_CONSUMERS.UNKNOWN;
    return consumer.trim();
  }

  function makeConsumerStats() {
    return {
      readCount: 0,
      lastFrameId: 0,
      lastReadAt: 0,
      lastFrameAgeMs: 0,
      lastSource: "none",
      subscribeCount: 0,
      lastPushFrameId: 0,
      lastPushAt: 0,
      lastPushSource: "none"
    };
  }

  function cloneConsumerStats(stats) {
    return Object.freeze({ ...stats });
  }

  function getMutableConsumerStats(consumer) {
    const key = normalizeConsumer(consumer);
    if (!consumerStats.has(key)) consumerStats.set(key, makeConsumerStats());
    return consumerStats.get(key);
  }

  function getConsumerStats() {
    const out = {};
    for (const [consumer, stats] of consumerStats.entries()) {
      out[consumer] = cloneConsumerStats(stats);
    }
    return Object.freeze(out);
  }

  function getMutableProducerStats(source) {
    const producer = normalizeSource(source);
    if (!producerStats.has(producer)) producerStats.set(producer, makeProducerStats());
    return producerStats.get(producer);
  }

  function publishFrame(input = {}) {
    const source = normalizeFrameSource(input.source, FRAME_PRODUCERS.UNKNOWN);
    const dimensions = normalizeFrameDimensions(input.dimensions || { width: input.width, height: input.height });
    const sourceFrame = input.frame instanceof Uint8Array ? input.frame : null;
    const stats = getMutableProducerStats(source);

    const policy = evaluateFramePublishPolicy({
      source,
      frame: sourceFrame,
      dimensions
    });
    lastPolicyDecision = policy.decision;
    lastPolicyReason = policy.reason;
    stats.lastPolicyDecision = policy.decision;
    stats.lastPolicyReason = policy.reason;

    if (policy.decision !== FRAME_POLICY_DECISIONS.ALLOW) {
      const reason = `policy rejected frame from ${source}: ${policy.reason} (${policy.actualBytes}/${policy.expectedBytes} bytes)`;
      policyRejectCount += 1;
      rejectedCount += 1;
      lastRejectReason = reason;
      lastProducer = source;
      stats.rejectedCount += 1;
      stats.lastRejectReason = reason;
      console.warn("Frame authority rejected frame", reason);
      dispatchAuthorityEvent("led-frame-authority-reject", { source, reason, rejectedCount, policy });
      publishAuthorityStatsNow(true);
      return null;
    }

    if (!isValidFrameBytes(sourceFrame, dimensions)) {
      const reason = `invalid frame from ${source}: ${sourceFrame?.byteLength || 0}/${expectedFrameByteLength(dimensions)} bytes`;
      rejectedCount += 1;
      lastRejectReason = reason;
      lastProducer = source;
      stats.rejectedCount += 1;
      stats.lastRejectReason = reason;
      console.warn("Frame authority rejected frame", reason);
      return null;
    }

    policyAllowCount += 1;
    const renderMs = Number(input.renderMs) || 0;
    // STEP22NS: when live output is ON, the hot path is browser frame -> WS ->
    // server ArtNet. Cloning 7.2 kB on every authoritative frame adds avoidable
    // GC/main-thread jitter. Use the producer buffer directly for the immediate
    // publish event; keep the old clone behaviour for preview-only operation.
    const liveOutputActive = input.outputEnabled === true || input.serialPipelineEnabled === true
      || source === FRAME_PRODUCERS.OUTPUT_OWNED_RENDER
      || source === FRAME_PRODUCERS.RENDER_PIPELINE && Boolean(input.meta?.outputEnabled);
    const stableFrame = liveOutputActive ? sourceFrame : cloneBytes(sourceFrame);
    const meta = makeMeta({ ...input, policy, zeroCopyLiveOutput: liveOutputActive }, dimensions, stableFrame, stats);
    const packet = frameBus.publishFrame({
      frame: stableFrame,
      width: dimensions.width,
      height: dimensions.height,
      renderMs,
      source,
      stateVersion: Number(input.stateVersion) || 0,
      meta
    });

    publishCount += 1;
    lastRejectReason = "none";
    lastProducer = source;
    stats.publishCount += 1;
    stats.lastFrameId = Number(packet?.frameId || 0);
    stats.lastPublishAt = Number(packet?.timestamp || 0);
    stats.lastRejectReason = "none";
    stats.lastRenderMs = renderMs;
    stats.lastByteLength = stableFrame.byteLength;
    stats.lastPreviewMode = typeof input.previewMode === "string" ? input.previewMode : "unknown";
    stats.lastOutputEnabled = Boolean(input.outputEnabled);
    stats.lastSerialPipelineEnabled = Boolean(input.serialPipelineEnabled);
    const metaNow = (typeof performance !== "undefined" && typeof performance.now === "function") ? performance.now() : Date.now();
    if (!lastProducerMetaStoreAt || metaNow - lastProducerMetaStoreAt >= 250) {
      stats.lastMeta = meta;
      lastProducerMetaStoreAt = metaNow;
    }

    const detail = {
      authorityVersion: FRAME_AUTHORITY_VERSION,
      frameId: Number(packet?.frameId || 0),
      source,
      producer: source,
      width: dimensions.width,
      height: dimensions.height,
      byteLength: stableFrame.byteLength,
      renderMs,
      previewMode: stats.lastPreviewMode,
      outputEnabled: stats.lastOutputEnabled,
      serialPipelineEnabled: stats.lastSerialPipelineEnabled,
      publishCount,
      producerPublishCount: stats.publishCount
    };
    globalThis.__ledRenderCoreLastPublish = detail;
    // STEP22MB: ArtNet MASTER upload is owned only by runtime/artnet_master_framebus_mirror_22ej.js.
    // Do not upload here; otherwise Performance preview can produce two browser writers.
    // mirrorPacketToArtnetMaster(packet);
    dispatchFramePublishEvent(detail);
    publishAuthorityStatsNow();
    return packet;
  }



  function publishComposedFrame(input = {}) {
    // STEP 8I: composed runtime frames use a named authority API instead of
    // calling the raw publishFrame implementation from render_pipeline. Keep
    // this wrapper inside Frame Authority to avoid the startup/import fragility
    // that broke STEP 8F's external commit-boundary experiment.
    return publishFrame({
      ...input,
      source: normalizeFrameSource(input.source || FRAME_PRODUCERS.RENDER_PIPELINE, FRAME_PRODUCERS.RENDER_PIPELINE)
    });
  }

  function getLatestFrame(options = {}) {
    const packet = frameBus.getLatestFrame();
    const stats = getMutableConsumerStats(options.consumer || FRAME_CONSUMERS.GENERIC_READ);
    const now = (typeof performance !== "undefined" && typeof performance.now === "function") ? performance.now() : Date.now();
    stats.readCount += 1;
    stats.lastFrameId = Number(packet?.frameId || 0);
    stats.lastReadAt = now;
    stats.lastFrameAgeMs = packet?.timestamp ? Math.max(0, now - Number(packet.timestamp)) : 0;
    stats.lastSource = String(packet?.source || "none");
    return packet;
  }

  function recordConsumerPush(consumer, packet) {
    const stats = getMutableConsumerStats(consumer);
    const now = (typeof performance !== "undefined" && typeof performance.now === "function") ? performance.now() : Date.now();
    stats.lastPushFrameId = Number(packet?.frameId || 0);
    stats.lastPushAt = now;
    stats.lastPushSource = String(packet?.source || "none");
    if (!stats.lastFrameId) stats.lastFrameId = Number(packet?.frameId || 0);
    if (!stats.lastSource || stats.lastSource === "none") stats.lastSource = String(packet?.source || "none");
  }

  function subscribe(listener, options = {}) {
    if (typeof listener !== "function") {
      throw new TypeError("frame_authority.subscribe(listener) expects a function");
    }
    const consumer = normalizeConsumer(options.consumer || FRAME_CONSUMERS.GENERIC_SUBSCRIBE);
    const stats = getMutableConsumerStats(consumer);
    stats.subscribeCount += 1;
    return frameBus.subscribe((packet) => {
      recordConsumerPush(consumer, packet);
      listener(packet);
    });
  }

  function getLatestFrameId() {
    return frameBus.getLatestFrameId();
  }

  function getProducerStats() {
    const out = {};
    for (const [producer, stats] of producerStats.entries()) {
      out[producer] = cloneProducerStats(stats);
    }
    return Object.freeze(out);
  }

  function getStats() {
    return Object.freeze({
      version: FRAME_AUTHORITY_VERSION,
      publishCount,
      rejectedCount,
      lastRejectReason,
      lastProducer,
      policyVersion: FRAME_AUTHORITY_POLICY_VERSION,
      policyAllowCount,
      policyRejectCount,
      lastPolicyDecision,
      lastPolicyReason,
      producers: getProducerStats(),
      consumers: getConsumerStats(),
      bus: frameBus.getStats()
    });
  }

  return Object.freeze({
    publishFrame,
    publishComposedFrame,
    getLatestFrame,
    subscribe,
    getLatestFrameId,
    getProducerStats,
    getConsumerStats,
    getStats
  });
}

const runtimeFrameAuthority = createFrameAuthority();

export function getRuntimeFrameAuthority() {
  try {
    globalThis.__ledFrameAuthority = runtimeFrameAuthority;
    globalThis.__ledFrameAuthorityStats = runtimeFrameAuthority.getStats();
  } catch {
    // diagnostics only
  }
  return runtimeFrameAuthority;
}

try {
  globalThis.__ledFrameAuthority = runtimeFrameAuthority;
  globalThis.__ledFrameAuthorityStats = runtimeFrameAuthority.getStats();
} catch {
  // diagnostics only
}
