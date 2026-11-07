import { buildDefaultEightStripUniverseMap, splitRgbByUniverseMap } from './artnet_core.js';

function byteAt(rgb, pixelIndex, channel = 0) {
  const offset = pixelIndex * 3 + channel;
  return rgb[offset] ?? 0;
}

function samplePixel(rgb, pixelIndex) {
  const safe = Math.max(0, Math.min(Math.floor(rgb.length / 3) - 1, Number(pixelIndex) | 0));
  const o = safe * 3;
  return Object.freeze({ pixel: safe, rgb: [rgb[o] ?? 0, rgb[o + 1] ?? 0, rgb[o + 2] ?? 0] });
}

function summarizeUniversePayload({ rgb, map, entry, packet, index }) {
  const globalStart = entry.strip * map.pixelsPerStrip + entry.startPixel;
  const globalEnd = globalStart + entry.length - 1;
  const byteStart = globalStart * 3;
  const byteEnd = (globalEnd * 3) + 2;
  return Object.freeze({
    index,
    strip: entry.strip,
    universe: entry.universe,
    startPixel: entry.startPixel,
    lengthPixels: entry.length,
    globalPixelStart: globalStart,
    globalPixelEnd: globalEnd,
    byteStart,
    byteEnd,
    expectedDmxBytes: entry.length * 3,
    dmxBytes: packet?.dmxBytes ?? 0,
    packetBytes: packet?.packetBytes ?? 0,
    sequence: packet?.sequence ?? null,
    firstPixel: samplePixel(rgb, globalStart),
    midPixel: samplePixel(rgb, globalStart + Math.floor(entry.length / 2)),
    lastPixel: samplePixel(rgb, globalEnd),
    firstByte: byteAt(rgb, globalStart, 0),
    lastByte: byteAt(rgb, globalEnd, 2)
  });
}

export async function validateFullOutputPipeline22AC({
  shaderRunner,
  config = {},
  stripCount = 8,
  pixelsPerStrip = 300,
  pixelsPerUniverse = 170,
  startUniverse = 0,
  outputIp = '2.1.1.30'
} = {}) {
  if (!shaderRunner || typeof shaderRunner.renderFrame !== 'function') {
    throw new Error('STEP22AC requires shaderRunner.renderFrame()');
  }
  const expectedPixels = stripCount * pixelsPerStrip;
  const expectedBytes = expectedPixels * 3;
  const rendered = await shaderRunner.renderFrame({ brightness: 0.82, index: 0, t: 4.125, ...config });
  const rgb = rendered?.rgb instanceof Uint8Array ? rendered.rgb : new Uint8Array(rendered?.rgb || []);
  const map = buildDefaultEightStripUniverseMap({ stripCount, pixelsPerStrip, pixelsPerUniverse, startUniverse, outputIp, enabled: true });
  const packets = splitRgbByUniverseMap({ rgb, universeMap: map, sequence: Number(config.sequence || 44) & 0xff, physical: 0 });
  const expectedUniverseCount = Math.ceil(pixelsPerStrip / pixelsPerUniverse) * stripCount;
  const expectedDmxBytesPerUniverse = pixelsPerUniverse * 3;
  const expectedPacketBytesPerUniverse = 18 + expectedDmxBytesPerUniverse;
  const universes = map.universes.map((entry, index) => summarizeUniversePayload({ rgb, map, entry, packet: packets[index], index }));
  const errors = [];
  const warnings = [];
  if (rgb.length !== expectedBytes) errors.push(`RGB_BYTES_MISMATCH expected ${expectedBytes} got ${rgb.length}`);
  if (map.totalPixels !== expectedPixels) errors.push(`MAP_PIXELS_MISMATCH expected ${expectedPixels} got ${map.totalPixels}`);
  if (map.universeCount !== expectedUniverseCount) errors.push(`UNIVERSE_COUNT_MISMATCH expected ${expectedUniverseCount} got ${map.universeCount}`);
  if (packets.length !== expectedUniverseCount) errors.push(`PACKET_COUNT_MISMATCH expected ${expectedUniverseCount} got ${packets.length}`);
  for (const u of universes) {
    if (u.dmxBytes !== u.expectedDmxBytes) errors.push(`UNIVERSE_${u.universe}_DMX_BYTES expected ${u.expectedDmxBytes} got ${u.dmxBytes}`);
    if (u.packetBytes !== 18 + u.expectedDmxBytes) errors.push(`UNIVERSE_${u.universe}_PACKET_BYTES expected ${18 + u.expectedDmxBytes} got ${u.packetBytes}`);
    if (u.globalPixelStart < 0 || u.globalPixelEnd >= expectedPixels) errors.push(`UNIVERSE_${u.universe}_PIXEL_RANGE_OUT_OF_BOUNDS`);
  }
  const firstUniverses = universes.slice(0, 4);
  const lastUniverses = universes.slice(-4);
  const samplePixels = [0, 1, 149, 150, 299, 300, 1199, 1200, 2398, 2399].map((p) => samplePixel(rgb, p));
  const litPixels = (() => {
    let lit = 0;
    for (let i = 0; i < rgb.length; i += 3) if ((rgb[i] || rgb[i+1] || rgb[i+2]) > 0) lit += 1;
    return lit;
  })();
  if (litPixels < Math.max(1, Math.floor(expectedPixels * 0.02))) warnings.push(`LOW_LIT_PIXELS ${litPixels}/${expectedPixels}`);
  const ok = errors.length === 0;
  return Object.freeze({
    ok,
    version: 'step22ac-full-output-pipeline-validator',
    mode: 'dry-run-validation-only',
    generatedAt: Date.now(),
    frame: Object.freeze({
      shader: rendered?.summary?.name || rendered?.summary?.file || 'unknown',
      shaderFile: rendered?.summary?.file || null,
      bytes: rgb.length,
      expectedBytes,
      pixels: Math.floor(rgb.length / 3),
      expectedPixels,
      avg: rendered?.summary?.avg ?? null,
      peak: rendered?.summary?.peak ?? null
    }),
    artnet: Object.freeze({
      target: outputIp,
      port: 6454,
      startUniverse,
      universeCount: map.universeCount,
      expectedUniverseCount,
      pixelsPerUniverse,
      expectedDmxBytesPerUniverse,
      expectedPacketBytesPerUniverse,
      packets: packets.length,
      packetBytesTotal: packets.reduce((sum, packet) => sum + Number(packet.packetBytes || 0), 0),
      dmxBytesTotal: packets.reduce((sum, packet) => sum + Number(packet.dmxBytes || 0), 0)
    }),
    mapping: Object.freeze({
      stripCount,
      pixelsPerStrip,
      totalPixels: map.totalPixels,
      universeOrder: map.universes.map((u) => u.universe),
      firstUniverses,
      lastUniverses,
      universes
    }),
    samples: Object.freeze({ pixels: samplePixels }),
    errors: Object.freeze(errors),
    warnings: Object.freeze(warnings)
  });
}
