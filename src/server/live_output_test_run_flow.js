import { freezeUniqueList, normalizeLiveOutputRequest } from "./live_output_common.js";

export const LIVE_OUTPUT_TEST_RUN_FLOW_VERSION = "12V-output-test-run-flow";

function normalizeRequest(request = {}) {
  return Object.freeze({
    ...normalizeLiveOutputRequest(request, {
      requested: true,
      commit: true,
      operatorConfirmed: true,
      defaultSource: "output-test-run-flow-12V",
      defaultToken: "",
      defaultMappingDigest: "output-test-run-flow-12V",
      defaultTransportPlanDigest: "output-test-run-flow-12V"
    }),
    overrides: Object.freeze({ ...(request.overrides || {}), ...request })
  });
}

function summarizeFlow({ request, targetConfig, physicalArm, outputSmokeTest }) {
  const blocked = [];
  const warnings = [];
  if (!targetConfig?.ok) blocked.push(...(targetConfig?.blocked || ["OUTPUT_TARGET_CONFIG_NOT_READY"]));
  if (request.physical && physicalArm?.sendAllowed !== true) blocked.push(...(physicalArm?.blocked || ["PHYSICAL_OUTPUT_NOT_ARMED_12U"]));
  if (outputSmokeTest?.blocked?.length) blocked.push(...outputSmokeTest.blocked);
  if (targetConfig?.warnings?.length) warnings.push(...targetConfig.warnings);
  if (outputSmokeTest?.warnings?.length) warnings.push(...outputSmokeTest.warnings);

  const status = outputSmokeTest?.status || (blocked.length ? "BLOCKED" : "READY");
  const sent = outputSmokeTest?.decision === "OUTPUT_SMOKE_TEST_SENT" || outputSmokeTest?.status === "SENT";
  return Object.freeze({
    version: LIVE_OUTPUT_TEST_RUN_FLOW_VERSION,
    ok: blocked.length === 0 && Boolean(outputSmokeTest?.ok),
    status: sent ? "SENT" : String(status || "UNKNOWN").toUpperCase(),
    decision: sent ? "OUTPUT_TEST_RUN_SENT_12V" : (blocked.length ? "OUTPUT_TEST_RUN_BLOCKED_12V" : "OUTPUT_TEST_RUN_EVALUATED_12V"),
    transportKind: request.transportKind,
    physical: request.physical,
    dryRun: request.dryRun,
    targetLabel: String(targetConfig?.targetLabel || "target:unknown"),
    packetCount: Number(outputSmokeTest?.packetCount || 0),
    packetBytes: Number(outputSmokeTest?.packetBytes || 0),
    outputTouched: Boolean(outputSmokeTest?.outputTouched),
    serialTouched: Boolean(outputSmokeTest?.serialTouched),
    networkTouched: Boolean(outputSmokeTest?.networkTouched),
    blocked: freezeUniqueList(blocked, 16),
    warnings: freezeUniqueList(warnings, 16),
    nextStep: sent ? "physical send confirmed in send-history" : (request.physical && physicalArm?.sendAllowed !== true ? "arm matching output first, then run physical test" : (blocked.length ? "fix blockers before sending" : "dry-run verified; use 12U arm before physical send"))
  });
}

export function createLiveOutputTestRunFlow({
  liveOutputTargetConfig = null,
  liveOutputSmokeTest = null,
  liveOutputPhysicalArmGate = null,
  liveOutputSendHistory = null,
  liveAuditLog = null
} = {}) {
  async function run(requestInput = {}) {
    const request = normalizeRequest(requestInput);
    const targetConfig = liveOutputTargetConfig?.evaluate?.({
      ...request.overrides,
      transportKind: request.transportKind,
      requested: true,
      commit: true,
      dryRun: request.dryRun,
      source: request.source
    }) || null;

    const smokeRequest = liveOutputTargetConfig?.buildSmokeRequest?.({
      configResult: targetConfig,
      token: request.token,
      mappingDigest: request.mappingDigest,
      transportPlanDigest: request.transportPlanDigest,
      dryRun: request.dryRun
    }) || {
      ...request.overrides,
      requested: true,
      commit: true,
      dryRun: request.dryRun,
      transportKind: request.transportKind,
      operatorConfirmed: true,
      confirmation: "CONFIRM_OUTPUT_SMOKE_TEST_LOW_BRIGHTNESS",
      token: request.token,
      mappingDigest: request.mappingDigest,
      transportPlanDigest: request.transportPlanDigest
    };

    const physicalArm = liveOutputPhysicalArmGate?.evaluateSend?.(smokeRequest) || null;
    let outputSmokeTest = null;
    if (targetConfig?.ok !== true) {
      outputSmokeTest = Object.freeze({ ok: false, status: "BLOCKED", decision: "OUTPUT_TEST_RUN_TARGET_BLOCKED_12V", request: smokeRequest, blocked: targetConfig?.blocked || ["OUTPUT_TARGET_CONFIG_NOT_READY"], outputTouched: false, dryRunOnly: true });
    } else if (request.physical && physicalArm && physicalArm.sendAllowed !== true) {
      outputSmokeTest = Object.freeze({ ok: false, status: "BLOCKED", decision: "OUTPUT_TEST_RUN_BLOCKED_BY_12U_PHYSICAL_ARM", request: smokeRequest, physicalArm, blocked: physicalArm.blocked || ["PHYSICAL_OUTPUT_NOT_ARMED_12U"], outputTouched: false, dryRunOnly: true });
    } else {
      outputSmokeTest = request.physical
        ? await liveOutputSmokeTest.execute(smokeRequest)
        : liveOutputSmokeTest.evaluate(smokeRequest);
    }

    const summary = summarizeFlow({ request, targetConfig, physicalArm, outputSmokeTest });
    const result = Object.freeze({
      ...summary,
      request,
      targetConfig,
      physicalArm,
      outputSmokeTest,
      safety: "12V runs a complete target→arm→smoke-test flow. Physical send still requires LED_PHYSICAL_OUTPUT_ENABLE=1, writer env gates, and a matching short-lived 12U arm."
    });
    liveOutputSendHistory?.append?.("test-run-flow-12V", result);
    liveAuditLog?.append?.("live.output.test-run-flow.12V", { outputTestRun: result });
    return result;
  }

  return Object.freeze({
    version: LIVE_OUTPUT_TEST_RUN_FLOW_VERSION,
    run
  });
}
