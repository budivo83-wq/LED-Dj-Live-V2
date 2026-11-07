import { artnetMasterFrameStore22EJ } from '../src/output/artnet_master_frame_store_22ej.js';
import { createStep22DqLiveSender } from '../src/output/artnet_sync_live_sender_22dq.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const sender = createStep22DqLiveSender({
  fps: 10,
  stripCount: 1,
  pixelsPerStrip: 1,
  pixelsPerUniverse: 1,
  outputIp: '127.0.0.1',
  sourceMode: 'performance-master-only',
  visualPattern: 'master-framebus'
});

const strictMissing = sender.sendOneFrame({
  mode: 'dry-run',
  sourceMode: 'performance-master-only',
  visualPattern: 'master-framebus',
  stripCount: 1,
  pixelsPerStrip: 1,
  pixelsPerUniverse: 1,
  masterMaxAgeMs: 100,
  lastGoodHoldMs: 1000,
  blackoutAfterHold: true
});

assert(strictMissing.summary?.sourceMode === 'performance-master-only', 'strict mode must be exposed in summary');
assert(strictMissing.summary?.frameSource === 'master-source-missing-blackout', 'strict mode must blackout when no fresh master frame exists');

artnetMasterFrameStore22EJ.publish({
  frame: new Uint8Array([11, 22, 33]),
  frameId: 9001,
  source: 'test-master-frame',
  stripCount: 1,
  pixelsPerStrip: 1
});

const freshMaster = sender.sendOneFrame({
  mode: 'dry-run',
  sourceMode: 'performance-master-only',
  visualPattern: 'master-framebus',
  stripCount: 1,
  pixelsPerStrip: 1,
  pixelsPerUniverse: 1,
  masterMaxAgeMs: 1000
});

assert(freshMaster.summary?.frameSource === 'master-framebus', 'fresh master frame must drive ArtNet output');
assert(freshMaster.summary?.masterFrame?.frameId === 9001, 'summary must point to published master frame');

await sleep(130);

const cachedMaster = sender.sendOneFrame({
  mode: 'dry-run',
  sourceMode: 'master-with-cache',
  visualPattern: 'master-framebus',
  stripCount: 1,
  pixelsPerStrip: 1,
  pixelsPerUniverse: 1,
  masterMaxAgeMs: 1,
  lastGoodHoldMs: 1000,
  blackoutAfterHold: true
});

assert(cachedMaster.summary?.frameSource === 'last-good-master-cache', 'cache mode may reuse last good master frame');

const strictStale = sender.sendOneFrame({
  mode: 'dry-run',
  sourceMode: 'performance-master-only',
  visualPattern: 'master-framebus',
  stripCount: 1,
  pixelsPerStrip: 1,
  pixelsPerUniverse: 1,
  masterMaxAgeMs: 1,
  lastGoodHoldMs: 1000,
  blackoutAfterHold: true
});

assert(strictStale.summary?.frameSource === 'master-source-missing-blackout', 'strict mode must not fall back to cached or synthetic frames');

console.log('ArtNet live source policy test passed.');
