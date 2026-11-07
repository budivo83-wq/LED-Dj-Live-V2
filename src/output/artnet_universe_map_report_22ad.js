import { validateFullOutputPipeline22AC } from './full_pipeline_validator_22ac.js';

function buildStripMatrix(universes = [], stripCount = 8) {
  const rows = Array.from({ length: stripCount }, (_, strip) => ({
    strip,
    universes: [],
    pixelsCovered: 0,
    firstUniverse: null,
    lastUniverse: null,
    gaps: [],
    overlaps: []
  }));
  for (const u of universes) {
    const row = rows[u.strip];
    if (!row) continue;
    row.universes.push({
      universe: u.universe,
      localStart: u.startPixel,
      localEnd: u.startPixel + u.lengthPixels - 1,
      globalStart: u.globalPixelStart,
      globalEnd: u.globalPixelEnd,
      bytes: u.dmxBytes,
      firstPixel: u.firstPixel?.rgb || [0, 0, 0],
      midPixel: u.midPixel?.rgb || [0, 0, 0],
      lastPixel: u.lastPixel?.rgb || [0, 0, 0]
    });
  }
  for (const row of rows) {
    row.universes.sort((a, b) => a.localStart - b.localStart || a.universe - b.universe);
    row.firstUniverse = row.universes[0]?.universe ?? null;
    row.lastUniverse = row.universes.at(-1)?.universe ?? null;
    let cursor = 0;
    for (const u of row.universes) {
      if (u.localStart > cursor) row.gaps.push({ from: cursor, to: u.localStart - 1 });
      if (u.localStart < cursor) row.overlaps.push({ universe: u.universe, startsAt: u.localStart, expectedAtLeast: cursor });
      cursor = Math.max(cursor, u.localEnd + 1);
      row.pixelsCovered += Math.max(0, u.localEnd - u.localStart + 1);
    }
  }
  return rows;
}

function buildUniverseContinuity(universes = []) {
  const sorted = [...universes].sort((a, b) => a.universe - b.universe);
  const missing = [];
  const duplicates = [];
  const seen = new Set();
  let previous = sorted[0]?.universe ?? 0;
  for (const u of sorted) {
    if (seen.has(u.universe)) duplicates.push(u.universe);
    seen.add(u.universe);
    while (previous < u.universe) {
      if (!seen.has(previous)) missing.push(previous);
      previous += 1;
    }
    previous = u.universe + 1;
  }
  return { order: sorted.map((u) => u.universe), missing, duplicates };
}

export async function createUniverseMapReport22AD(options = {}) {
  const validation = await validateFullOutputPipeline22AC(options);
  const universes = validation.mapping?.universes || [];
  const stripCount = validation.mapping?.stripCount || options.stripCount || 8;
  const pixelsPerStrip = validation.mapping?.pixelsPerStrip || options.pixelsPerStrip || 300;
  const rows = buildStripMatrix(universes, stripCount);
  const continuity = buildUniverseContinuity(universes);
  const errors = [...(validation.errors || [])];
  const warnings = [...(validation.warnings || [])];

  for (const row of rows) {
    if (row.universes.length !== 2) errors.push(`STRIP_${row.strip}_UNIVERSE_COUNT expected 2 got ${row.universes.length}`);
    if (row.pixelsCovered !== pixelsPerStrip) errors.push(`STRIP_${row.strip}_PIXELS_COVERED expected ${pixelsPerStrip} got ${row.pixelsCovered}`);
    if (row.gaps.length) errors.push(`STRIP_${row.strip}_GAPS ${JSON.stringify(row.gaps)}`);
    if (row.overlaps.length) errors.push(`STRIP_${row.strip}_OVERLAPS ${JSON.stringify(row.overlaps)}`);
  }
  if (continuity.missing.length) errors.push(`UNIVERSE_MISSING ${continuity.missing.join(',')}`);
  if (continuity.duplicates.length) errors.push(`UNIVERSE_DUPLICATE ${continuity.duplicates.join(',')}`);

  const report = {
    ok: errors.length === 0,
    version: 'step22ad-universe-map-report',
    mode: 'dry-run-map-report-only',
    generatedAt: Date.now(),
    summary: {
      target: validation.artnet?.target || 'unknown',
      universeCount: validation.artnet?.packets || 0,
      stripCount,
      pixelsPerStrip,
      totalPixels: validation.mapping?.totalPixels || 0,
      bytes: validation.frame?.bytes || 0,
      dmxBytesTotal: validation.artnet?.dmxBytesTotal || 0,
      packetBytesTotal: validation.artnet?.packetBytesTotal || 0,
      firstUniverse: universes[0]?.universe ?? null,
      lastUniverse: universes.at(-1)?.universe ?? null
    },
    continuity,
    strips: rows,
    validation,
    errors,
    warnings
  };
  report.text = rows.map((row) => {
    const cells = row.universes.map((u) => `U${u.universe}:px${u.localStart}-${u.localEnd}/g${u.globalStart}-${u.globalEnd}`).join(' | ');
    return `STRIP ${row.strip}: ${cells}`;
  }).join('\n');
  return Object.freeze(report);
}
