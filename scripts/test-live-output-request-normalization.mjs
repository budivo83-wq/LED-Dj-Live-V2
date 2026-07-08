import { normalizeLiveOutputRequest } from "../src/server/live_output_common.js";
import { createLiveOutputTestRunFlow } from "../src/server/live_output_test_run_flow.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const normalized = normalizeLiveOutputRequest({
  transport: "art-net",
  pattern: "red",
  commit: true,
  token: "abc",
  mappingDigest: "map-a",
  transportPlanDigest: "plan-a"
}, {
  requested: true,
  commit: true,
  defaultSource: "normalize-test",
  defaultTransportKind: "serial",
  defaultPattern: "single-pixel-chase"
});

assert(normalized.requested === true, "normalized request must preserve explicit requested state");
assert(normalized.commit === true, "normalized request must preserve commit state");
assert(normalized.transportKind === "artnet", "art-net must normalize to artnet");
assert(normalized.pattern === "red", "pattern must pass through");
assert(normalized.token === "abc", "token must be preserved");
assert(normalized.source === "normalize-test", "default source must apply when absent");

const flow = createLiveOutputTestRunFlow({
  liveOutputTargetConfig: {
    evaluate: (request) => ({
      ok: true,
      warnings: [],
      blocked: [],
      targetLabel: `target:${request.transportKind}`
    }),
    buildSmokeRequest: ({ configResult, token, mappingDigest, transportPlanDigest, dryRun }) => ({
      requested: true,
      commit: true,
      dryRun,
      transportKind: "artnet",
      operatorConfirmed: true,
      confirmation: "CONFIRM_OUTPUT_SMOKE_TEST_LOW_BRIGHTNESS",
      token,
      mappingDigest,
      transportPlanDigest,
      derivedTarget: configResult.targetLabel
    })
  },
  liveOutputSmokeTest: {
    evaluate: (request) => ({
      ok: true,
      status: "READY_DRY_RUN",
      decision: "OUTPUT_SMOKE_TEST_READY_DRY_RUN",
      packetCount: 1,
      packetBytes: 2,
      outputTouched: false,
      serialTouched: false,
      networkTouched: false,
      warnings: [],
      blocked: [],
      derivedTarget: request.derivedTarget
    }),
    execute: async () => ({
      ok: true,
      status: "SENT",
      decision: "OUTPUT_SMOKE_TEST_SENT",
      packetCount: 1,
      packetBytes: 2,
      outputTouched: true,
      serialTouched: false,
      networkTouched: true,
      warnings: [],
      blocked: []
    })
  },
  liveOutputPhysicalArmGate: {
    evaluateSend: () => ({ sendAllowed: true, blocked: [] })
  }
});

const result = await flow.run({
  transport: "udp",
  token: "flow-token",
  mappingDigest: "map-b",
  transportPlanDigest: "plan-b",
  overrides: { custom: "value" }
});

assert(result.request.transportKind === "artnet", "flow request must normalize transport aliases");
assert(result.request.requested === true, "flow request must be marked requested");
assert(result.request.commit === true, "flow request must be marked commit");
assert(result.request.overrides.custom === "value", "flow request must preserve overrides");
assert(result.targetConfig.targetLabel === "target:artnet", "target config stub must receive normalized transport");
assert(result.outputSmokeTest.derivedTarget === "target:artnet", "buildSmokeRequest must receive the target config result");

console.log("Live output request normalization test passed.");
