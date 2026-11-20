import assert from 'node:assert/strict';
import {
  FRAME_CONTRACT_VERSION,
  expectedFrameByteLength,
  isValidFrameBytes,
  normalizeFrameInput,
  normalizeFrameDimensions,
  normalizeFrameSource
} from '../public/runtime/frame_contract.js';
import { createOutputTransportAdapter } from '../public/runtime/output_transport_adapter.js';

assert.equal(FRAME_CONTRACT_VERSION, '1.0.0');
assert.deepEqual(normalizeFrameDimensions({ width: '300.4', height: 8.6 }), { width: 300, height: 9 });
assert.deepEqual(normalizeFrameDimensions({ width: -4, height: Number.NaN }), { width: 0, height: 0 });
assert.equal(expectedFrameByteLength({ width: 4, height: 2 }), 24);
assert.equal(isValidFrameBytes(new Uint8Array(24), { width: 4, height: 2 }), true);
assert.equal(isValidFrameBytes(new Uint8Array(23), { width: 4, height: 2 }), false);
assert.equal(normalizeFrameSource(' generator-live '), 'generator-live');
assert.equal(normalizeFrameSource('', 'fallback'), 'fallback');
assert.deepEqual(normalizeFrameInput(new Uint8Array([1, 2])), {
  frame: new Uint8Array([1, 2]), frameId: 0, timestamp: 0, source: 'unknown', legacyBytes: true
});
assert.equal(normalizeFrameInput({ frame: new Uint8Array(3), frameId: 9, source: 'generator' }).frameId, 9);
assert.equal(normalizeFrameInput({ frame: [] }), null);

let transported = null;
const adapter = createOutputTransportAdapter({
  name: 'test',
  sendFrame: (frame, packet) => { transported = { frame, packet }; }
});
const adapterFrame = new Uint8Array([7]);
assert.equal(adapter.send({ frame: adapterFrame, frameId: 3 }), true);
assert.equal(transported.frame, adapterFrame);
assert.equal(transported.packet.frameId, 3);

console.log('PASS shared frame contract');
