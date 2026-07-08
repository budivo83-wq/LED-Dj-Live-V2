import { normalizePattern, normalizeTransport } from "../src/server/live_output_common.js";
import { createLiveOutputMinimalFrame12X } from "../src/server/live_output_minimal_frame_12x.js";
import { createLiveOutputMultiFrameStream12Y } from "../src/server/live_output_multiframe_stream_12y.js";
import { createLiveOutputPhysicalArmGate } from "../src/server/live_output_physical_arm_gate.js";
import { normalizeOutputTargetConfig } from "../src/server/live_output_target_config.js";
import { evaluateLiveOutputDriverBridge } from "../src/server/live_output_driver_bridge.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(normalizeTransport(undefined) === "serial", "default transport must stay serial");
assert(normalizeTransport("udp") === "artnet", "udp must map to artnet");
assert(normalizeTransport("network") === "artnet", "network must map to artnet");
assert(normalizeTransport("foo") === "foo", "unknown transport must pass through by default");
assert(normalizeTransport("foo", { unknownToDefault: true }) === "serial", "unknown transport may fall back to default when requested");
assert(normalizeTransport("udp", { aliases: ["udp"] }) === "artnet", "custom alias mapping must still resolve to artnet");
assert(normalizePattern("red") === "red", "known pattern must pass through");
assert(normalizePattern("rgb", { defaultValue: "rgb", allowed: ["rgb"], unknownValue: "rgb" }) === "rgb", "custom whitelist must preserve allowed patterns");
assert(normalizePattern("orange", { defaultValue: "rgb", allowed: ["rgb"], unknownValue: "rgb" }) === "rgb", "unknown pattern must fall back to the requested default");

const targetConfig = normalizeOutputTargetConfig({ transportKind: "network" });
assert(targetConfig.transportKind === "artnet", "target config must resolve network to artnet");

const physicalArmGate = createLiveOutputPhysicalArmGate({ physicalWriteEnabled: false });
assert(physicalArmGate.evaluateSend({ transportKind: "art-net", dryRun: false }).requestedTransport === "artnet", "physical arm gate must resolve art-net to artnet");

const minimalFrame = createLiveOutputMinimalFrame12X({ liveOutputTargetConfig: { evaluate: () => ({ ok: true }) }, liveOutputSmokeTest: { evaluate: () => ({ ok: true }) } });
assert(minimalFrame.version === "12X-minimal-live-frame-output-path", "minimal frame factory sanity check failed");

const multiFrame = createLiveOutputMultiFrameStream12Y({ liveOutputMinimalFrame12X: { run: async () => ({ ok: true, packetCount: 0, packetBytes: 0 }) } });
assert(multiFrame.version === "12Y-multiframe-live-output-dry-run-stream", "multiframe factory sanity check failed");

const driverBridge = evaluateLiveOutputDriverBridge({ request: { transportKind: "udp", requested: true, commit: true, operatorConfirmed: true, confirmation: "CONFIRM_REAL_OUTPUT_BRIDGE_LOW_BRIGHTNESS", dryRun: true } });
assert(driverBridge.request.transportKind === "artnet", "driver bridge must resolve udp to artnet");

console.log("Live output common normalization test passed.");
