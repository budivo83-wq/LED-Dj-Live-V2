import { buildDefaultEightStripUniverseMap, splitRgbByUniverseMap } from './artnet_core.js';

function clampByte(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(255, Math.round(n)));
}

function setPixel(rgb, pixel, color) {
  const o = pixel * 3;
  rgb[o] = clampByte(color[0]);
  rgb[o + 1] = clampByte(color[1]);
  rgb[o + 2] = clampByte(color[2]);
}

function samplePixel(rgb, pixelIndex) {
  const safe = Math.max(0, Math.min(Math.floor(rgb.length / 3) - 1, Number(pixelIndex) | 0));
  const o = safe * 3;
  return Object.freeze({ pixel: safe, rgb: [rgb[o] ?? 0, rgb[o + 1] ?? 0, rgb[o + 2] ?? 0] });
}

const STRIP_COLORS = Object.freeze([
  [255, 0, 0],
  [255, 96, 0],
  [255, 220, 0],
  [0, 255, 0],
  [0, 210, 255],
  [0, 48, 255],
  [170, 0, 255],
  [255, 0, 190]
]);

function paintMarkerPattern({ stripCount, pixelsPerStrip, pixelsPerUniverse, brightness = 0.75 } = {}) {
  const totalPixels = stripCount * pixelsPerStrip;
  const rgb = new Uint8Array(totalPixels * 3);
  const b = Math.max(0, Math.min(1, Number(brightness) || 0.75));
  const marks = [];

  for (let strip = 0; strip < stripCount; strip += 1) {
    const base = strip * pixelsPerStrip;
    const color = STRIP_COLORS[strip % STRIP_COLORS.length].map((v) => v * b);
    const dim = color.map((v) => v * 0.18);

    for (let p = 0; p < pixelsPerStrip; p += 1) setPixel(rgb, base + p, dim);

    const markers = [
      { pixel: 0, color: [255, 255, 255], label: 'strip-start' },
      { pixel: 1, color, label: 'strip-start-color-confirm' },
      { pixel: pixelsPerUniverse - 1, color: [255, 255, 255], label: 'universe-a-end' },
      { pixel: pixelsPerUniverse, color: [0, 0, 0], label: 'universe-b-start-black-gap' },
      { pixel: pixelsPerUniverse + 1, color: [255, 255, 255], label: 'universe-b-start-white' },
      { pixel: pixelsPerStrip - 2, color, label: 'strip-end-color-confirm' },
      { pixel: pixelsPerStrip - 1, color: [255, 255, 255], label: 'strip-end' }
    ];

    for (let p = 25; p < pixelsPerStrip; p += 25) {
      if (p === pixelsPerUniverse) continue;
      markers.push({ pixel: p, color: [255, 255, 255], label: `tick-${p}` });
    }

    for (const marker of markers) {
      if (marker.pixel < 0 || marker.pixel >= pixelsPerStrip) continue;
      const globalPixel = base + marker.pixel;
      setPixel(rgb, globalPixel, marker.color);
      marks.push(Object.freeze({
        strip,
        localPixel: marker.pixel,
        globalPixel,
        label: marker.label,
        rgb: [rgb[globalPixel * 3], rgb[globalPixel * 3 + 1], rgb[globalPixel * 3 + 2]]
      }));
    }
  }

  return Object.freeze({ rgb, marks: Object.freeze(marks) });
}

function summarizeUniverse({ rgb, map, entry, packet, index }) {
  const globalStart = entry.strip * map.pixelsPerStrip + entry.startPixel;
  const globalEnd = globalStart + entry.length - 1;
  return Object.freeze({
    index,
    strip: entry.strip,
    universe: entry.universe,
    startPixel: entry.startPixel,
    lengthPixels: entry.length,
    globalPixelStart: globalStart,
    globalPixelEnd: globalEnd,
    dmxBytes: packet?.dmxBytes ?? 0,
    packetBytes: packet?.packetBytes ?? 0,
    firstPixel: samplePixel(rgb, globalStart),
    midPixel: samplePixel(rgb, globalStart + Math.floor(entry.length / 2)),
    lastPixel: samplePixel(rgb, globalEnd)
  });
}

export async function createArtNetMarkerPattern22AF({
  config = {},
  stripCount = 8,
  pixelsPerStrip = 300,
  pixelsPerUniverse = 170,
  startUniverse = 0,
  outputIp = '2.1.1.30'
} = {}) {
  const brightness = config.brightness ?? 0.75;
  const sequence = Number(config.sequence ?? 49) & 0xff;
  const expectedPixels = stripCount * pixelsPerStrip;
  const expectedBytes = expectedPixels * 3;
  const map = buildDefaultEightStripUniverseMap({ stripCount, pixelsPerStrip, pixelsPerUniverse, startUniverse, outputIp, enabled: true });
  const { rgb, marks } = paintMarkerPattern({ stripCount, pixelsPerStrip, pixelsPerUniverse, brightness });
  const packets = splitRgbByUniverseMap({ rgb, universeMap: map, sequence, physical: 0 });
  const universes = map.universes.map((entry, index) => summarizeUniverse({ rgb, map, entry, packet: packets[index], index }));
  const errors = [];
  const warnings = [];

  if (rgb.length !== expectedBytes) errors.push(`RGB_BYTES_MISMATCH expected ${expectedBytes} got ${rgb.length}`);
  if (map.universeCount !== 16) errors.push(`UNIVERSE_COUNT_MISMATCH expected 16 got ${map.universeCount}`);
  if (packets.length !== map.universeCount) errors.push(`PACKET_COUNT_MISMATCH expected ${map.universeCount} got ${packets.length}`);
  for (const u of universes) {
    if (u.dmxBytes !== pixelsPerUniverse * 3) errors.push(`U${u.universe}_DMX_BYTES expected ${pixelsPerUniverse * 3} got ${u.dmxBytes}`);
  }

  const boundaryPairs = [];
  for (let strip = 0; strip < stripCount; strip += 1) {
    const base = strip * pixelsPerStrip;
    boundaryPairs.push(Object.freeze({
      strip,
      universeAEnd: samplePixel(rgb, base + pixelsPerUniverse - 1),
      universeBStart: samplePixel(rgb, base + pixelsPerUniverse),
      stripEnd: samplePixel(rgb, base + pixelsPerStrip - 1)
    }));
  }

  return Object.freeze({
    ok: errors.length === 0,
    version: 'step22af-artnet-marker-pattern',
    mode: 'dry-run-marker-pattern-only',
    generatedAt: Date.now(),
    summary: Object.freeze({
      pattern: 'strip-color + white ticks + universe boundary markers',
      target: outputIp,
      stripCount,
      pixelsPerStrip,
      totalPixels: expectedPixels,
      rgbBytes: rgb.length,
      expectedBytes,
      pixelsPerUniverse,
      universeCount: map.universeCount,
      packetCount: packets.length,
      sequence,
      markerCount: marks.length
    }),
    legend: Object.freeze({
      dimBase: 'každý strip má vlastní tlumenou barvu',
      white: 'začátky/konce stripů, 25px ticks a universe hrany',
      blackGap: 'pixel 150 na každém stripu je černá mezera mezi U-A a U-B',
      purpose: 'na LEDkách má být okamžitě vidět otočený strip, špatný universe nebo posun o pixel'
    }),
    universes: Object.freeze(universes),
    boundaryPairs: Object.freeze(boundaryPairs),
    markers: Object.freeze(marks.slice(0, 96)),
    errors: Object.freeze(errors),
    warnings: Object.freeze(warnings),
    text: `STEP22AF marker pattern: ${stripCount}×${pixelsPerStrip}px -> ${map.universeCount} universes, dry-run only`
  });
}


export async function createArtNetMarkerPatternFrame22AG(options = {}) {
  const report = await createArtNetMarkerPattern22AF(options);
  const stripCount = Math.max(1, Number(options.stripCount || 8));
  const pixelsPerStrip = Math.max(1, Number(options.pixelsPerStrip || 300));
  const pixelsPerUniverse = Math.max(1, Number(options.pixelsPerUniverse || 170));
  const brightness = options.config?.brightness ?? options.brightness ?? 0.75;
  const painted = paintMarkerPattern({ stripCount, pixelsPerStrip, pixelsPerUniverse, brightness });
  return Object.freeze({
    ok: report.ok,
    version: 'step22ag-live-marker-send',
    mode: 'marker-frame-ready-for-multi-transport',
    rgb: painted.rgb,
    report,
    summary: Object.freeze({
      ...(report.summary || {}),
      rgbBytes: painted.rgb.length,
      framePixels: Math.floor(painted.rgb.length / 3),
      sendPurpose: 'controlled marker-pattern frame for STEP22U multi-transport path'
    })
  });
}
