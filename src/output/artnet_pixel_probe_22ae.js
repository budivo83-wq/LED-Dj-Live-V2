import { createUniverseMapReport22AD } from './artnet_universe_map_report_22ad.js';

function clampInt(value, min, max, fallback = min) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function findUniverseForGlobalPixel(universes = [], globalPixel) {
  return universes.find((u) => globalPixel >= u.globalPixelStart && globalPixel <= u.globalPixelEnd) || null;
}

function buildNeighborSamples(validation, globalPixel) {
  const rgb = validation?.__rgb;
  // validateFullOutputPipeline22AC intentionally does not expose the full rgb buffer.
  // So we use its deterministic sample helper output plus universe edge samples.
  const samples = [];
  const all = [
    ...(validation?.samples?.pixels || []),
    ...((validation?.mapping?.universes || []).flatMap((u) => [u.firstPixel, u.midPixel, u.lastPixel]).filter(Boolean))
  ];
  const wanted = new Set([globalPixel - 2, globalPixel - 1, globalPixel, globalPixel + 1, globalPixel + 2]);
  for (const s of all) if (wanted.has(Number(s.pixel))) samples.push(s);
  return samples.sort((a, b) => a.pixel - b.pixel);
}

export async function createPixelProbe22AE(options = {}) {
  const report = await createUniverseMapReport22AD(options);
  const stripCount = report.summary?.stripCount || 8;
  const pixelsPerStrip = report.summary?.pixelsPerStrip || 300;
  const strip = clampInt(options.strip ?? options.config?.strip, 0, stripCount - 1, 0);
  const pixel = clampInt(options.pixel ?? options.config?.pixel, 0, pixelsPerStrip - 1, 0);
  const globalPixel = strip * pixelsPerStrip + pixel;
  const universe = findUniverseForGlobalPixel(report.validation?.mapping?.universes || [], globalPixel);
  const localInUniverse = universe ? globalPixel - universe.globalPixelStart : null;
  const dmxByteStart = universe ? localInUniverse * 3 : null;
  const dmxByteEnd = universe ? dmxByteStart + 2 : null;
  const stripRow = report.strips?.[strip] || null;
  const neighbors = buildNeighborSamples(report.validation, globalPixel);
  const errors = [...(report.errors || [])];
  if (!universe) errors.push(`PIXEL_${globalPixel}_NOT_MAPPED`);
  if (!stripRow) errors.push(`STRIP_${strip}_NOT_FOUND`);
  if (universe && universe.strip !== strip) errors.push(`PIXEL_STRIP_MISMATCH expected ${strip} got ${universe.strip}`);
  if (universe && (localInUniverse < 0 || localInUniverse >= universe.lengthPixels)) errors.push(`PIXEL_LOCAL_UNIVERSE_OUT_OF_RANGE ${localInUniverse}`);

  const result = {
    ok: errors.length === 0,
    version: 'step22ae-pixel-probe',
    mode: 'dry-run-pixel-probe-only',
    generatedAt: Date.now(),
    input: { strip, pixel, requestedStrip: options.strip ?? options.config?.strip ?? null, requestedPixel: options.pixel ?? options.config?.pixel ?? null },
    probe: {
      strip,
      pixel,
      globalPixel,
      universe: universe?.universe ?? null,
      universeIndex: universe?.index ?? null,
      localPixelInUniverse: localInUniverse,
      dmxByteStart,
      dmxByteEnd,
      expectedByteRangeInFullFrame: universe ? [globalPixel * 3, globalPixel * 3 + 2] : null,
      universeGlobalRange: universe ? [universe.globalPixelStart, universe.globalPixelEnd] : null,
      universeLocalRange: universe ? [universe.startPixel, universe.startPixel + universe.lengthPixels - 1] : null,
      firstPixel: universe?.firstPixel || null,
      midPixel: universe?.midPixel || null,
      lastPixel: universe?.lastPixel || null,
      neighborSamples: neighbors
    },
    strip: stripRow,
    summary: report.summary,
    continuity: report.continuity,
    errors,
    warnings: [...(report.warnings || [])],
    text: universe
      ? `STRIP ${strip} PIXEL ${pixel} -> GLOBAL ${globalPixel} -> U${universe.universe} local ${localInUniverse} DMX bytes ${dmxByteStart}-${dmxByteEnd}`
      : `STRIP ${strip} PIXEL ${pixel} -> GLOBAL ${globalPixel} -> NOT MAPPED`,
    report
  };
  return Object.freeze(result);
}
