import assert from "node:assert/strict";
import { createOutputPipeline } from "../public/runtime/output_pipeline.js";

const scheduled = [];
const cleared = [];
let now = 0;
let pauseUntil = 0;
let sent = 0;
let pipeline;

globalThis.window = {
  setTimeout(callback, delay) {
    const timer = { callback, delay, cleared: false };
    scheduled.push(timer);
    return timer;
  },
  clearTimeout(timer) {
    if (timer) timer.cleared = true;
    cleared.push(timer);
  }
};

pipeline = createOutputPipeline({
  getNow: () => now,
  isEnabled: () => true,
  getTargetFps: () => 10,
  getPauseUntil: () => pauseUntil,
  setPauseUntil: (value) => { pauseUntil = value; },
  sendFrame: () => {
    sent += 1;
    if (sent === 1) pipeline.enqueue({ frame: new Uint8Array([2]), frameId: 2 });
  },
  onMetrics: () => {}
});

pipeline.enqueue({ frame: new Uint8Array([1]), frameId: 1 });
assert.equal(scheduled.length, 1, "first frame should arm one scheduler timer");

const firstTimer = scheduled[0];
firstTimer.callback();

assert.equal(sent, 1, "scheduler should send the first frame");
assert.equal(scheduled.length, 2, "queued replacement should arm exactly one follow-up timer");
assert.equal(cleared.length, 0, "scheduler should not clear and re-arm the same wake-up");
assert.equal(pipeline.getMetrics().timerArmed, true, "follow-up timer should remain armed");

console.log("OUTPUT_PIPELINE_SCHEDULER: PASS");
