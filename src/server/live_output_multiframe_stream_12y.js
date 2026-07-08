import { clampInt, clampNumber, normalizePattern, normalizeTransport } from "./live_output_common.js";

export const LIVE_OUTPUT_MULTIFRAME_STREAM_VERSION = "12Y-multiframe-live-output-dry-run-stream";

const MAX_FRAMES = 8;
const MAX_PIXELS = 150;
const MAX_BRIGHTNESS = 0.08;
const MAX_FPS = 20;

function normalizeRequest(request = {}) {
  const physical = Boolean(request.physical || request.real || request.dryRun === false);
  return Object.freeze({
    requested: Boolean(request.requested ?? true),
    commit: Boolean(request.commit ?? true),
    transportKind: normalizeTransport(request.transportKind || request.transport || request.outputMode, { unknownToDefault: true }),
    physical,
    dryRun: !physical,
    pattern: normalizePattern(request.pattern || request.testPattern || "single-pixel-chase"),
    pixels: clampInt(request.pixels ?? request.pixelCount, 1, MAX_PIXELS, 30),
    frames: clampInt(request.frames ?? request.frameCount, 1, MAX_FRAMES, 4),
    fps: clampNumber(request.fps, 1, MAX_FPS, 10),
    brightness: clampNumber(request.brightness, 0, MAX_BRIGHTNESS, 0.03),
    serialPath: String(request.serialPath || request.path || request.portName || "COM3"),
    baudRate: clampInt(request.baudRate, 9600, 3000000, 1000000),
    host: String(request.host || request.ip || request.target?.host || request.target?.ip || "127.0.0.1"),
    artnetPort: clampInt(request.artnetPort || request.target?.port || request.port, 1, 65535, 6454),
    universe: clampInt(request.universe, 0, 32767, 0),
    token: String(request.token || request.fullLiveToken || ""),
    mappingDigest: String(request.mappingDigest || "multiframe-stream-12Y"),
    transportPlanDigest: String(request.transportPlanDigest || request.routeDigest || "multiframe-stream-12Y"),
    operatorConfirmed: Boolean(request.operatorConfirmed ?? true),
    source: String(request.source || "multiframe-live-output-12Y")
  });
}

function frameRequest(base, frameIndex) {
  return Object.freeze({
    ...base,
    frames: 1,
    frameIndex,
    frameId: `12Y-${Date.now()}-${frameIndex}`,
    source: `${base.source}:frame-${frameIndex + 1}`,
    pattern: base.pattern
  });
}

function computeTiming(samples, fps) {
  const frameCount = samples.length;
  const durationMs = frameCount > 1 ? Math.max(0, samples[frameCount - 1].atMs - samples[0].atMs) : 0;
  const idealStepMs = 1000 / Math.max(1, fps);
  const deltas = [];
  for (let i = 1; i < samples.length; i += 1) deltas.push(samples[i].atMs - samples[i - 1].atMs);
  const jitterMs = deltas.length
    ? Math.max(...deltas.map((delta) => Math.abs(delta - idealStepMs)))
    : 0;
  return Object.freeze({ frameCount, durationMs, idealStepMs: Number(idealStepMs.toFixed(2)), jitterMs: Number(jitterMs.toFixed(2)) });
}

function summarize({ request, results, startedAtMs, finishedAtMs }) {
  const blocked = [];
  const warnings = [];
  let packetCount = 0;
  let packetBytes = 0;
  let outputTouched = false;
  let serialTouched = false;
  let networkTouched = false;
  for (const result of results) {
    if (Array.isArray(result.blocked)) blocked.push(...result.blocked);
    if (Array.isArray(result.warnings)) warnings.push(...result.warnings);
    packetCount += Number(result.packetCount || 0);
    packetBytes += Number(result.packetBytes || 0);
    outputTouched = outputTouched || Boolean(result.outputTouched);
    serialTouched = serialTouched || Boolean(result.serialTouched);
    networkTouched = networkTouched || Boolean(result.networkTouched);
  }
  const okFrames = results.filter((r) => r.ok === true).length;
  const sentFrames = results.filter((r) => r.status === "SENT" || r.decision === "MINIMAL_FRAME_OUTPUT_SENT_12X").length;
  const failedFrames = results.filter((r) => r.ok !== true).length;
  const timing = computeTiming(results.map((r) => ({ atMs: Number(r.atMs || startedAtMs) })), request.fps);
  const uniqueBlocked = [...new Set(blocked)].slice(0, 16);
  const dryReady = !request.physical && failedFrames === 0;
  const sent = request.physical && sentFrames > 0 && uniqueBlocked.length === 0;
  return Object.freeze({
    version: LIVE_OUTPUT_MULTIFRAME_STREAM_VERSION,
    ok: failedFrames === 0,
    status: uniqueBlocked.length ? "BLOCKED" : (sent ? "SENT" : (dryReady ? "READY_DRY_STREAM" : "PARTIAL")),
    decision: uniqueBlocked.length ? "MULTIFRAME_STREAM_BLOCKED_12Y" : (sent ? "MULTIFRAME_STREAM_SENT_12Y" : "MULTIFRAME_STREAM_READY_12Y"),
    transportKind: request.transportKind,
    physical: request.physical,
    dryRun: request.dryRun,
    pattern: request.pattern,
    pixels: request.pixels,
    frames: request.frames,
    fps: request.fps,
    brightness: request.brightness,
    okFrames,
    sentFrames,
    failedFrames,
    packetCount,
    packetBytes,
    outputTouched,
    serialTouched,
    networkTouched,
    timing: Object.freeze({ ...timing, wallMs: Math.max(0, finishedAtMs - startedAtMs) }),
    frameResults: Object.freeze(results.map((r, index) => Object.freeze({
      index,
      ok: Boolean(r.ok),
      status: String(r.status || "UNKNOWN"),
      decision: String(r.decision || ""),
      packetCount: Number(r.packetCount || 0),
      packetBytes: Number(r.packetBytes || 0),
      outputTouched: Boolean(r.outputTouched),
      blocked: Array.isArray(r.blocked) ? r.blocked.slice(0, 4) : []
    }))),
    blocked: Object.freeze(uniqueBlocked),
    warnings: Object.freeze([...new Set(warnings)].slice(0, 16)),
    nextStep: sent ? "multi-frame physical stream attempted; verify ACK/history before increasing frame count" : (request.physical ? "arm matching output and keep env gates enabled" : "dry multi-frame stream verified; keep using 12Y before full live executor")
  });
}

export function createLiveOutputMultiFrameStream12Y({
  liveOutputMinimalFrame12X = null,
  liveOutputSendHistory = null,
  liveAuditLog = null
} = {}) {
  if (!liveOutputMinimalFrame12X?.run) throw new Error("createLiveOutputMultiFrameStream12Y requires liveOutputMinimalFrame12X.run");

  async function run(requestInput = {}) {
    const request = normalizeRequest(requestInput);
    const stopSignal = requestInput?.stopSignal || null;
    const startedAtMs = Date.now();
    const results = [];
    for (let frameIndex = 0; frameIndex < request.frames; frameIndex += 1) {
      if (stopSignal?.isStopped?.()) {
        results.push(Object.freeze({
          ok: false,
          status: "STOPPED",
          decision: "STREAM_STOPPED_BY_OPERATOR_12Z",
          atMs: Date.now(),
          frameIndex,
          packetCount: 0,
          packetBytes: 0,
          outputTouched: false,
          blocked: ["STREAM_STOP_REQUESTED_12Z"]
        }));
        break;
      }
      const frameStartedAtMs = Date.now();
      const result = await liveOutputMinimalFrame12X.run(frameRequest(request, frameIndex));
      results.push(Object.freeze({ ...result, atMs: frameStartedAtMs, frameIndex }));
      requestInput?.telemetrySink?.onFrame?.({ frameIndex, result });
      if (stopSignal?.isStopped?.()) break;
      if (result.ok !== true && request.physical) break;
    }
    const finishedAtMs = Date.now();
    const summary = summarize({ request, results, startedAtMs, finishedAtMs });
    const outputMultiFrameStream = Object.freeze({
      ...summary,
      request,
      safety: "12Y runs a tiny capped multi-frame stream through the existing 12X minimal-frame path. It is capped to 8 frames, 150 px and 8% brightness; physical sends still require the 12U arm gate."
    });
    liveOutputSendHistory?.append?.("multiframe-stream-12Y", outputMultiFrameStream);
    liveAuditLog?.append?.("live.output.multiframe-stream.12Y", { outputMultiFrameStream });
    return outputMultiFrameStream;
  }

  return Object.freeze({ version: LIVE_OUTPUT_MULTIFRAME_STREAM_VERSION, run });
}
