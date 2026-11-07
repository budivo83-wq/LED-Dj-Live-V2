import assert from 'node:assert/strict';
import { createOutputRateLimiter } from '../src/output/rate_limiter.js';

let now = 0;
const limiter = createOutputRateLimiter({
  fps: 60,
  autoAdapt: false,
  minFps: 20,
  now: () => now
});

assert.equal(limiter.allow(), true);
now = 1;
assert.equal(limiter.allow(), false, 'early tick is rate-limited');
assert.equal(limiter.getStats().fps, 60, 'early tick must not lower configured Art-Net FPS');
now = 17;
assert.equal(limiter.allow(), true, 'next scheduled tick is accepted');
assert.equal(limiter.getStats().adapted, 0, 'Art-Net limiter must not auto-adapt');

console.log('ARTNET_OUTPUT_FPS_STABILITY: PASS');
