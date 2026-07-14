import { readFileSync } from "node:fs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(rel) {
  return readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");
}

const serialController = read("src/server/serial_controller.js");
const serialRoutes = read("src/server/serial_routes.js");
const directTest = read("src/server/live_serial_direct_test_13f.js");

assert(serialController.includes("function normalizeBinaryPacket"), "serial controller must keep zero-copy packet normalization");
assert(!serialRoutes.includes("Buffer.from(packet)"), "serial routes must not copy packets before serial write");
assert(serialRoutes.includes("serialController.writeAndDrain(packet"), "serial routes must write packets directly");
assert(!directTest.includes("Buffer.from(packet)"), "direct serial test must not copy packets before write");
assert(directTest.includes("port.write(packet"), "direct serial test must write packets directly");

console.log("Serial zero-copy write path test passed.");
