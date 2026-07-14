import { readFileSync } from "node:fs";

import { evaluateLiveOutputDriverBridge } from "../src/server/live_output_driver_bridge.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const evaluation = evaluateLiveOutputDriverBridge({
  request: {
    requested: true,
    commit: true,
    dryRun: true,
    transportKind: "serial",
    pattern: "red",
    pixels: 4,
    frames: 2,
    brightness: 0.05,
    serialPath: "COM3",
    serialProtocol: "aa_len_rgb",
    operatorConfirmed: true,
    confirmation: "CONFIRM_REAL_OUTPUT_BRIDGE_LOW_BRIGHTNESS"
  },
  physicalWriteEnabled: true
});

assert(evaluation.ok === true, "driver bridge evaluation should be ready for dry run");
assert(!Object.keys(evaluation).includes("packetPlan"), "packetPlan must stay non-enumerable");
assert(Object.getOwnPropertyDescriptor(evaluation, "packetPlan")?.enumerable === false, "packetPlan must remain hidden");
assert(Array.isArray(evaluation.packetPlan?.packets), "packetPlan packets must exist");
assert(Array.isArray(evaluation.packetPlan?.packetBuffers), "packetPlan packetBuffers must exist");
assert(evaluation.packetPlan.packetBuffers.length === evaluation.packetCount, "packet buffer count must match packet count");
assert(evaluation.packetPlan.packetBytes === evaluation.packetBytes, "packetBytes must match the cached packet plan");
assert(
  evaluation.packetPlan.packetBuffers.every((packet) => packet instanceof Uint8Array || Buffer.isBuffer(packet)),
  "packetBuffers must contain binary packet payloads"
);

const source = readFileSync(new URL("../src/server/live_output_driver_bridge.js", import.meta.url), "utf8");
assert(!source.includes("Buffer.from(packet)"), "driver bridge send path must not copy packets with Buffer.from(packet)");
assert(source.includes("port.write(packet"), "serial send path must write packets directly");
assert(source.includes("socket.send(packet"), "udp send path must send packets directly");

console.log("Live output driver bridge packet plan test passed.");
