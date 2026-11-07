import assert from 'node:assert/strict';
import { createDefaultMappingV2, compileArtNetPatchFromMappingV2 } from '../public/runtime/mapping_v2.js';
import { buildDefaultEightStripUniverseMap, splitRgbByUniverseMap } from '../src/output/artnet_core.js';

function continuousMapping({ strips = 8, pixels = 300, universeSize = 170 } = {}) {
  const mapping = createDefaultMappingV2({ count: strips, pixelsPerStrip: pixels });
  let universe = 0;
  let address = 0;
  mapping.segments = mapping.segments.map((segment) => {
    const parts = [];
    let remaining = pixels;
    let pixelStart = 0;
    let u = universe;
    let a = address;
    while (remaining > 0) {
      const take = Math.min(remaining, universeSize - a);
      parts.push({ universe: u, startAddress: a, pixelStart, pixelCount: take });
      remaining -= take;
      pixelStart += take;
      u += 1;
      a = 0;
    }
    const next = {
      ...segment,
      physical: {
        ...segment.physical,
        output: 'artnet',
        universe,
        startAddress: address,
        universeSize,
        routeSegments: parts
      }
    };
    const used = address + pixels;
    universe += Math.floor(used / universeSize);
    address = used % universeSize;
    return next;
  });
  return mapping;
}

const patch = compileArtNetPatchFromMappingV2(continuousMapping());
const routes = patch.routes.map((r) => ({ stripIndex: r.stripIndex, universe: r.universe, startAddress: r.startAddress, pixelCount: r.pixelCount, sourcePixelOffset: r.sourcePixelOffset }));
assert.deepEqual(routes.slice(0, 6), [
  { stripIndex: 0, universe: 0, startAddress: 0, pixelCount: 170, sourcePixelOffset: 0 },
  { stripIndex: 0, universe: 1, startAddress: 0, pixelCount: 130, sourcePixelOffset: 170 },
  { stripIndex: 1, universe: 1, startAddress: 130, pixelCount: 40, sourcePixelOffset: 0 },
  { stripIndex: 1, universe: 2, startAddress: 0, pixelCount: 170, sourcePixelOffset: 40 },
  { stripIndex: 1, universe: 3, startAddress: 0, pixelCount: 90, sourcePixelOffset: 210 },
  { stripIndex: 2, universe: 3, startAddress: 90, pixelCount: 80, sourcePixelOffset: 0 }
]);

const map = buildDefaultEightStripUniverseMap({ stripCount: 2, pixelsPerStrip: 300, pixelsPerUniverse: 170, startUniverse: 0 });
assert.equal(map.universeCount, 4);
assert.deepEqual(map.universes.map((u) => [u.universe, u.globalPixelStart, u.length]), [
  [0, 0, 170],
  [1, 170, 170],
  [2, 340, 170],
  [3, 510, 90]
]);

const rgb = new Uint8Array(2 * 300 * 3);
for (let pixel = 0; pixel < 600; pixel += 1) rgb[pixel * 3] = pixel & 0xff;
const packets = splitRgbByUniverseMap({ rgb, universeMap: map, sequence: 1 });
assert.equal(packets.length, 4);
assert.equal(packets[1].packet[18], 170 & 0xff);
assert.equal(packets[1].packet[18 + (169 * 3)], 339 & 0xff);
assert.equal(packets[2].packet[18], 340 & 0xff);
console.log('PASS continuous ArtNet packing');
