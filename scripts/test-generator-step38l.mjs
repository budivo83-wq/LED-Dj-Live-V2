import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createArtNetMasterFrameStore22EJ } from '../src/output/artnet_master_frame_store_22ej.js';

const root = process.cwd();
const failures = [];

const bridge = readFileSync(join(root, 'public/runtime/generator_bridge.js'), 'utf8');
const mirror = readFileSync(join(root, 'public/runtime/artnet_master_framebus_mirror_22ej.js'), 'utf8');
const routes = readFileSync(join(root, 'src/server/artnet_master_frame_routes_22ej.js'), 'utf8');
const ws = readFileSync(join(root, 'src/server/ws_controller.js'), 'utf8');
const storeSource = readFileSync(join(root, 'src/output/artnet_master_frame_store_22ej.js'), 'utf8');

function expect(condition, message) {
  if (!condition) failures.push(message);
}

expect(bridge.includes('STEP38L_GENERATOR_TAKES_MASTER_OUTPUT_LOCK'), 'generator bridge version must mark STEP38L output lock takeover');
expect(bridge.includes('heartbeat: true'), 'generator bridge must refresh the live lock every published frame');
expect(mirror.includes('GENERATOR_LIVE_LOCK_KEY_38L'), 'performance master mirror must read generator live lock');
expect(mirror.includes('generator-live-master-owner-active-38l'), 'performance master mirror must suppress uploads while generator owns live output');
expect(routes.includes('X-LED-Master-Frame-Dropped'), 'server frame-bin route must not trigger ArtNet send for dropped performance frames');
expect(ws.includes('master-frame-ws-suppressed-by-active-owner'), 'WS performance fast path must not direct-trigger ArtNet when store drops frame');
expect(storeSource.includes('GENERATOR_LIVE_SUPPRESS_PERFORMANCE_MS_38L'), 'master store must include generator-live source arbitration window');

const store = createArtNetMasterFrameStore22EJ({ stripCount: 8, pixelsPerStrip: 300 });
const generatorFrame = new Uint8Array(8 * 300 * 3).fill(77);
const performanceFrame = new Uint8Array(8 * 300 * 3).fill(13);
const g = store.publish({
  frame: generatorFrame,
  source: 'generator-live-master-frame',
  frameId: 1,
  stripCount: 8,
  pixelsPerStrip: 300
});
expect(g.ok === true && g.latest?.source === 'generator-live-master-frame', 'generator frame must be accepted as current master source');
const p = store.publishFast({
  frame: performanceFrame,
  source: 'performance-framebus-artnet-master-ws',
  frameId: 2,
  stripCount: 8,
  pixelsPerStrip: 300
});
expect(p.dropped === true && p.reason === 'generator-live-master-owner-active-38l', 'performance WS frame must be dropped while fresh generator master exists');
const latest = store.getLatest({ stripCount: 8, pixelsPerStrip: 300, maxAgeMs: 5000 });
expect(latest?.source === 'generator-live-master-frame', 'dropped performance frame must not replace generator frame in master store');
expect(latest?.frame?.[0] === 77, 'latest master frame bytes must remain generator bytes');
const status = store.status();
expect(status.arbitrationDropCount38L >= 1, 'status must expose generator arbitration drop count');
expect(status.lastArbitrationDrop38L?.incomingSource === 'performance-framebus-artnet-master-ws', 'status must expose last suppressed incoming performance source');

if (failures.length) {
  console.error('STEP38L generator output lock test failed:');
  for (const failure of failures) console.error(' - ' + failure);
  process.exit(1);
}
console.log('PASS generator STEP38L output lock takeover guard');
