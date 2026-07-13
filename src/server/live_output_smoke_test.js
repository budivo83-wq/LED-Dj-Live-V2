import { freezeUniqueList, normalizeLiveOutputRequest } from "./live_output_common.js";

export const LIVE_OUTPUT_SMOKE_TEST_VERSION = "12R-serial-artnet-output-smoke-test-layer";

const REQUIRED_CONFIRMATION = "CONFIRM_OUTPUT_SMOKE_TEST_LOW_BRIGHTNESS";
const MAX_PIXELS = 150;
const MAX_FRAMES = 8;
const MAX_BRIGHTNESS = 0.08;

function normalizeRequest(request = {}) {
  return normalizeLiveOutputRequest(request, {
    defaultPattern: "single-pixel-chase",
    defaultBaudRate: 115200,
    defaultFrameId: 1,
    defaultSeq: 1,
    defaultMappingDigest: "output-smoke-test-12R",
    defaultTransportPlanDigest: "output-smoke-test-12R"
  });
}

function bridgeRequestFromSmoke(test) {
  return Object.freeze({
    requested: test.requested,
    commit: test.commit,
    dryRun: test.dryRun,
    transportKind: test.transportKind,
    pattern: test.pattern,
    pixels: test.pixels,
    frames: test.frames,
    brightness: test.brightness,
    serialPath: test.serialPath,
    baudRate: test.baudRate,
    serialProtocol: test.serialProtocol,
    host: test.host,
    artnetPort: test.artnetPort,
    universe: test.universe,
    seq: test.seq,
    frameId: test.frameId,
    armToken: test.armToken,
    fullLiveToken: test.fullLiveToken,
    operatorConfirmed: test.operatorConfirmed,
    confirmation: "CONFIRM_REAL_OUTPUT_BRIDGE_LOW_BRIGHTNESS",
    mappingDigest: test.mappingDigest,
    transportPlanDigest: test.transportPlanDigest
  });
}

export function evaluateLiveOutputSmokeTest({
  request = {},
  liveOutputDriverBridge = null,
  physicalWriteEnabled = false
} = {}) {
  const test = normalizeRequest(request);
  const blocked = [];
  const warnings = [];

  if (!test.requested) blocked.push("OUTPUT_SMOKE_TEST_NOT_REQUESTED");
  if (!test.commit) blocked.push("OUTPUT_SMOKE_TEST_COMMIT_FALSE");
  if (!test.operatorConfirmed || test.confirmation !== REQUIRED_CONFIRMATION) blocked.push("OUTPUT_SMOKE_TEST_CONFIRMATION_MISSING");
  if (!liveOutputDriverBridge) blocked.push("OUTPUT_DRIVER_BRIDGE_MISSING");
  if (!physicalWriteEnabled && test.dryRun === false) blocked.push("OUTPUT_SMOKE_TEST_PHYSICAL_ENV_DISABLED");
  if (!["serial", "artnet"].includes(test.transportKind)) blocked.push("OUTPUT_SMOKE_TEST_TRANSPORT_UNSUPPORTED");
  if (test.transportKind === "serial" && !test.serialPath) blocked.push("SERIAL_PATH_MISSING");
  if (test.transportKind === "artnet" && !test.host) blocked.push("ARTNET_HOST_MISSING");
  if (test.dryRun) warnings.push("OUTPUT_SMOKE_TEST_DRY_RUN_TRUE_NO_PHYSICAL_SEND");

  const bridgeRequest = bridgeRequestFromSmoke(test);
  const driverBridge = liveOutputDriverBridge?.evaluate?.(bridgeRequest) || null;
  if (driverBridge && driverBridge.ok !== true) {
    blocked.push(...(Array.isArray(driverBridge.blocked) ? driverBridge.blocked.map((x) => `BRIDGE:${x}`) : ["BRIDGE_NOT_READY"]));
  }

  const canSend = blocked.length === 0 && test.dryRun === false;
  return Object.freeze({
    version: LIVE_OUTPUT_SMOKE_TEST_VERSION,
    ok: blocked.length === 0,
    status: canSend ? "READY_TO_SEND" : (blocked.length === 0 ? "READY_DRY_RUN" : "BLOCKED"),
    decision: canSend ? "OUTPUT_SMOKE_TEST_READY_TO_SEND" : (blocked.length === 0 ? "OUTPUT_SMOKE_TEST_READY_DRY_RUN" : "OUTPUT_SMOKE_TEST_BLOCKED"),
    request: test,
    bridgeRequest,
    driverBridge,
    transportKind: test.transportKind,
    packetCount: Number(driverBridge?.packetCount || 0),
    packetBytes: Number(driverBridge?.packetBytes || 0),
    packets: Object.freeze(Array.isArray(driverBridge?.packets) ? driverBridge.packets : []),
    blocked: freezeUniqueList(blocked),
    warnings: freezeUniqueList(warnings),
    physicalWriteAllowed: canSend,
    outputTouched: false,
    serialTouched: false,
    networkTouched: false,
    dryRunOnly: test.dryRun || !canSend,
    safety: "12R smoke test delegates packet/write details to 12Q bridge; it only allows tiny low-brightness serial/ArtNet verification patterns."
  });
}

export async function executeLiveOutputSmokeTest(options = {}) {
  const evaluation = evaluateLiveOutputSmokeTest(options);
  if (evaluation.decision !== "OUTPUT_SMOKE_TEST_READY_TO_SEND") return evaluation;
  const result = await options.liveOutputDriverBridge.execute(evaluation.bridgeRequest);
  return Object.freeze({
    ...evaluation,
    driverBridge: result,
    decision: result?.decision === "OUTPUT_DRIVER_BRIDGE_SENT" ? "OUTPUT_SMOKE_TEST_SENT" : "OUTPUT_SMOKE_TEST_SEND_NOT_CONFIRMED",
    status: result?.status === "SENT" ? "SENT" : "ERROR",
    outputTouched: Boolean(result?.outputTouched),
    serialTouched: Boolean(result?.serialTouched),
    networkTouched: Boolean(result?.networkTouched),
    dryRunOnly: false
  });
}

export function createLiveOutputSmokeTest({ liveOutputDriverBridge = null, physicalWriteEnabled = false } = {}) {
  return Object.freeze({
    version: LIVE_OUTPUT_SMOKE_TEST_VERSION,
    evaluate: (request = {}) => evaluateLiveOutputSmokeTest({ request, liveOutputDriverBridge, physicalWriteEnabled }),
    execute: (request = {}) => executeLiveOutputSmokeTest({ request, liveOutputDriverBridge, physicalWriteEnabled })
  });
}
