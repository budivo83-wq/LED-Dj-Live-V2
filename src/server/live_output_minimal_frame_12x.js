import { clampInt, clampNumber, freezeUniqueList, normalizePattern, normalizeTransport } from "./live_output_common.js";

export const LIVE_OUTPUT_MINIMAL_FRAME_VERSION = "12X-minimal-live-frame-output-path";

const MAX_PIXELS = 150;
const MAX_FRAMES = 1;
const MAX_BRIGHTNESS = 0.08;

function normalizeRequest(request = {}) {
  const physical = Boolean(request.physical || request.real || request.dryRun === false);
  return Object.freeze({
    requested: Boolean(request.requested ?? true),
    commit: Boolean(request.commit ?? true),
    transportKind: normalizeTransport(request.transportKind || request.transport || request.outputMode),
    physical,
    dryRun: !physical,
    pattern: normalizePattern(request.pattern || request.testPattern || "single-pixel-chase"),
    pixels: clampInt(request.pixels ?? request.pixelCount, 1, MAX_PIXELS, 30),
    frames: MAX_FRAMES,
    brightness: clampNumber(request.brightness, 0, MAX_BRIGHTNESS, 0.03),
    serialPath: String(request.serialPath || request.path || request.portName || "COM3"),
    baudRate: clampInt(request.baudRate, 9600, 3000000, 1000000),
    host: String(request.host || request.ip || request.target?.host || request.target?.ip || "127.0.0.1"),
    artnetPort: clampInt(request.artnetPort || request.target?.port || request.port, 1, 65535, 6454),
    universe: clampInt(request.universe, 0, 32767, 0),
    token: String(request.token || request.fullLiveToken || ""),
    mappingDigest: String(request.mappingDigest || "minimal-frame-output-12X"),
    transportPlanDigest: String(request.transportPlanDigest || request.routeDigest || "minimal-frame-output-12X"),
    operatorConfirmed: Boolean(request.operatorConfirmed ?? true),
    source: String(request.source || "minimal-live-frame-output-12X")
  });
}

function toSmokeRequest(request) {
  return Object.freeze({
    requested: request.requested,
    commit: request.commit,
    dryRun: request.dryRun,
    transportKind: request.transportKind,
    pattern: request.pattern,
    pixels: request.pixels,
    frames: request.frames,
    brightness: request.brightness,
    serialPath: request.serialPath,
    baudRate: request.baudRate,
    host: request.host,
    artnetPort: request.artnetPort,
    universe: request.universe,
    token: request.token,
    fullLiveToken: request.token,
    mappingDigest: request.mappingDigest,
    transportPlanDigest: request.transportPlanDigest,
    outputMode: request.transportKind,
    operatorConfirmed: true,
    confirmation: "CONFIRM_OUTPUT_SMOKE_TEST_LOW_BRIGHTNESS",
    source: request.source
  });
}

function summarize({ request, targetConfig, physicalArm, outputSmokeTest }) {
  const blocked = [];
  const warnings = [];
  if (!targetConfig?.ok) blocked.push(...(targetConfig?.blocked || ["OUTPUT_TARGET_CONFIG_NOT_READY"]));
  if (request.physical && physicalArm?.sendAllowed !== true) blocked.push(...(physicalArm?.blocked || ["PHYSICAL_OUTPUT_NOT_ARMED_12U"]));
  if (Array.isArray(outputSmokeTest?.blocked)) blocked.push(...outputSmokeTest.blocked);
  if (Array.isArray(targetConfig?.warnings)) warnings.push(...targetConfig.warnings);
  if (Array.isArray(outputSmokeTest?.warnings)) warnings.push(...outputSmokeTest.warnings);

  const sent = outputSmokeTest?.decision === "OUTPUT_SMOKE_TEST_SENT" || outputSmokeTest?.status === "SENT";
  const readyDry = !request.physical && blocked.length === 0 && outputSmokeTest?.ok === true;
  return Object.freeze({
    version: LIVE_OUTPUT_MINIMAL_FRAME_VERSION,
    ok: blocked.length === 0 && Boolean(outputSmokeTest?.ok),
    status: sent ? "SENT" : (readyDry ? "READY_DRY_RUN" : (blocked.length ? "BLOCKED" : String(outputSmokeTest?.status || "READY").toUpperCase())),
    decision: sent ? "MINIMAL_FRAME_OUTPUT_SENT_12X" : (blocked.length ? "MINIMAL_FRAME_OUTPUT_BLOCKED_12X" : "MINIMAL_FRAME_OUTPUT_READY_12X"),
    transportKind: request.transportKind,
    physical: request.physical,
    dryRun: request.dryRun,
    pattern: request.pattern,
    pixels: request.pixels,
    frames: request.frames,
    brightness: request.brightness,
    targetLabel: String(targetConfig?.targetLabel || "target:unknown"),
    packetCount: Number(outputSmokeTest?.packetCount || 0),
    packetBytes: Number(outputSmokeTest?.packetBytes || 0),
    outputTouched: Boolean(outputSmokeTest?.outputTouched),
    serialTouched: Boolean(outputSmokeTest?.serialTouched),
    networkTouched: Boolean(outputSmokeTest?.networkTouched),
    blocked: freezeUniqueList(blocked, 16),
    warnings: freezeUniqueList(warnings, 16),
    nextStep: sent ? "minimal frame physically sent; verify ACK/history" : (request.physical ? "arm matching output and keep env gates enabled" : "dry minimal frame verified; arm before physical send")
  });
}

export function createLiveOutputMinimalFrame12X({
  liveOutputTargetConfig = null,
  liveOutputSmokeTest = null,
  liveOutputPhysicalArmGate = null,
  liveOutputSendHistory = null,
  liveAuditLog = null
} = {}) {
  async function run(requestInput = {}) {
    const request = normalizeRequest(requestInput);
    const targetConfig = liveOutputTargetConfig?.evaluate?.({
      ...request,
      requested: true,
      commit: true,
      dryRun: request.dryRun,
      source: request.source
    }) || null;
    const smokeRequest = toSmokeRequest(request);
    const physicalArm = liveOutputPhysicalArmGate?.evaluateSend?.(smokeRequest) || null;
    let outputSmokeTest = null;
    if (targetConfig?.ok !== true) {
      outputSmokeTest = Object.freeze({ ok: false, status: "BLOCKED", decision: "MINIMAL_FRAME_TARGET_BLOCKED_12X", blocked: targetConfig?.blocked || ["OUTPUT_TARGET_CONFIG_NOT_READY"], outputTouched: false, dryRunOnly: true });
    } else if (request.physical && physicalArm?.sendAllowed !== true) {
      outputSmokeTest = Object.freeze({ ok: false, status: "BLOCKED", decision: "MINIMAL_FRAME_BLOCKED_BY_12U_PHYSICAL_ARM", physicalArm, blocked: physicalArm?.blocked || ["PHYSICAL_OUTPUT_NOT_ARMED_12U"], outputTouched: false, dryRunOnly: true });
    } else {
      outputSmokeTest = request.physical
        ? await liveOutputSmokeTest.execute(smokeRequest)
        : liveOutputSmokeTest.evaluate(smokeRequest);
    }
    const summary = summarize({ request, targetConfig, physicalArm, outputSmokeTest });
    const result = Object.freeze({
      ...summary,
      request,
      targetConfig,
      physicalArm,
      outputSmokeTest,
      safety: "12X sends/evaluates one tiny minimal frame through the same target, arm, smoke-test, driver-bridge, history and verification gates. It is not a full live stream."
    });
    liveOutputSendHistory?.append?.("minimal-frame-output-12X", result);
    liveAuditLog?.append?.("live.output.minimal-frame.12X", { outputMinimalFrame: result });
    return result;
  }
  return Object.freeze({ version: LIVE_OUTPUT_MINIMAL_FRAME_VERSION, run });
}
