import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");
const startup = read("public/runtime/startup_warmup.js");
const queue = read("public/runtime/gpu_warmup_queue.js");
const app = read("public/app.js");

assert.match(startup, /Thumbnail readiness is part of the normal desktop startup contract/);
assert.match(startup, /runtimeProfile\.startupThumbPreload === true && !embeddedRuntime/);
assert.doesNotMatch(startup, /startupThumbPreload === true && !skipStartupLoading && !embeddedRuntime/);
assert.match(queue, /isTransitionActive = \(\) => false/);
assert.match(queue, /if \(gpuWarmupQueue\.length && isTransitionActive\(\)\)/);
assert.match(queue, /setTimeout\(processGpuWarmupQueue, 180\)/);
assert.match(app, /isTransitionActive: \(\) => Object\.values\(transitions\)\.some\(Boolean\)/);

console.log("Startup prewarm contract passed (thumbnail boot cache + fade-safe GPU warmup).");
