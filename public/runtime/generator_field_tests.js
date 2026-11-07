export const GENERATOR_FIELD_TEST_VERSION = 'STEP38K_GENERATOR_FIELD_TEST_CONTROLS';

export const GENERATOR_FIELD_TEST_TYPES = Object.freeze([
  Object.freeze({ id: 'single-strip', name: 'Single strip solid', description: 'Rozsvítí jeden vybraný strip jednou barvou, ostatní nechá černé.' }),
  Object.freeze({ id: 'universe-sweep', name: 'Universe sweep', description: 'Zvýrazní ArtNet universe segmenty 170/130 px pro 8×300 mapping.' }),
  Object.freeze({ id: 'first-last', name: 'First / last pixel probe', description: 'Start stripu zeleně, konec červeně, střed modře.' }),
  Object.freeze({ id: 'rgb-order', name: 'RGB order probe', description: 'Zóny R/G/B/W pro kontrolu pořadí barev.' }),
  Object.freeze({ id: 'direction-probe', name: 'Direction probe', description: 'Směrový gradient a pohyblivý marker pro reverse/forward kontrolu.' })
]);

export const GENERATOR_FIELD_TEST_COLORS = Object.freeze([
  Object.freeze({ id: 'white', name: 'White', rgb: [210, 210, 210] }),
  Object.freeze({ id: 'red', name: 'Red', rgb: [230, 0, 0] }),
  Object.freeze({ id: 'green', name: 'Green', rgb: [0, 210, 0] }),
  Object.freeze({ id: 'blue', name: 'Blue', rgb: [0, 80, 255] }),
  Object.freeze({ id: 'amber', name: 'Amber', rgb: [255, 130, 0] }),
  Object.freeze({ id: 'cyan', name: 'Cyan', rgb: [0, 210, 255] }),
  Object.freeze({ id: 'magenta', name: 'Magenta', rgb: [255, 0, 180] })
]);

const DEFAULT_WIDTH = 300;
const DEFAULT_HEIGHT = 8;
const DEFAULT_UNIVERSE_SIZE = 170;

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function clamp01(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(1, n));
}

function safeText(value, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function colorById(id = 'white') {
  return GENERATOR_FIELD_TEST_COLORS.find((color) => color.id === id)?.rgb || GENERATOR_FIELD_TEST_COLORS[0].rgb;
}

function testTypeById(id = 'single-strip') {
  return GENERATOR_FIELD_TEST_TYPES.find((test) => test.id === id) || GENERATOR_FIELD_TEST_TYPES[0];
}

function scaleColor(rgb, scale = 1) {
  const s = clamp01(scale, 1);
  return [
    Math.max(0, Math.min(255, Math.round(Number(rgb?.[0] || 0) * s))),
    Math.max(0, Math.min(255, Math.round(Number(rgb?.[1] || 0) * s))),
    Math.max(0, Math.min(255, Math.round(Number(rgb?.[2] || 0) * s)))
  ];
}

function writePixel(frame, width, x, y, rgb) {
  const offset = (y * width + x) * 3;
  frame[offset] = Math.max(0, Math.min(255, Math.round(Number(rgb?.[0] || 0))));
  frame[offset + 1] = Math.max(0, Math.min(255, Math.round(Number(rgb?.[1] || 0))));
  frame[offset + 2] = Math.max(0, Math.min(255, Math.round(Number(rgb?.[2] || 0))));
}

function selectedStripMatches(y, stripIndex) {
  return stripIndex < 0 || y === stripIndex;
}

export function listGeneratorFieldTests() {
  return GENERATOR_FIELD_TEST_TYPES.map((test) => ({ ...test }));
}

export function listGeneratorFieldTestColors() {
  return GENERATOR_FIELD_TEST_COLORS.map((color) => ({ ...color, rgb: color.rgb.slice() }));
}

export function normalizeGeneratorFieldTestOptions(options = {}) {
  const width = clampInt(options.width, 1, 4096, DEFAULT_WIDTH);
  const height = clampInt(options.height, 1, 128, DEFAULT_HEIGHT);
  const universeSize = clampInt(options.universeSize, 1, width, DEFAULT_UNIVERSE_SIZE);
  const universeCount = Math.max(1, Math.ceil(width / universeSize) * height);
  const stripIndex = String(options.stripIndex ?? 'all') === 'all'
    ? -1
    : clampInt(options.stripIndex, 0, height - 1, 0);
  const universeIndex = String(options.universeIndex ?? 'auto') === 'auto'
    ? -1
    : clampInt(options.universeIndex, 0, universeCount - 1, 0);
  const test = testTypeById(options.type || options.testType);
  const colorId = GENERATOR_FIELD_TEST_COLORS.some((color) => color.id === options.color) ? String(options.color) : 'white';
  const intensity = clamp01(options.intensity, 0.78);
  const phase = Number(options.phase || 0) || 0;
  return Object.freeze({
    version: GENERATOR_FIELD_TEST_VERSION,
    type: test.id,
    typeName: test.name,
    color: colorId,
    colorName: GENERATOR_FIELD_TEST_COLORS.find((color) => color.id === colorId)?.name || 'White',
    stripIndex,
    universeIndex,
    universeSize,
    universeCount,
    width,
    height,
    intensity,
    phase
  });
}

function universeForPixel(x, y, width, universeSize) {
  const chunksPerStrip = Math.max(1, Math.ceil(width / Math.max(1, universeSize)));
  return y * chunksPerStrip + Math.floor(x / Math.max(1, universeSize));
}

function fillSingleStrip(frame, options) {
  const rgb = scaleColor(colorById(options.color), options.intensity);
  for (let y = 0; y < options.height; y += 1) {
    if (!selectedStripMatches(y, options.stripIndex)) continue;
    for (let x = 0; x < options.width; x += 1) writePixel(frame, options.width, x, y, rgb);
  }
}

function fillUniverseSweep(frame, options) {
  const palette = [
    [230, 0, 0], [0, 210, 0], [0, 80, 255], [255, 130, 0],
    [255, 0, 180], [0, 210, 255], [220, 220, 220], [120, 80, 255]
  ];
  const activeUniverse = options.universeIndex >= 0 ? options.universeIndex : Math.floor(options.phase * 2.25) % options.universeCount;
  for (let y = 0; y < options.height; y += 1) {
    for (let x = 0; x < options.width; x += 1) {
      const universe = universeForPixel(x, y, options.width, options.universeSize);
      if (universe === activeUniverse) {
        const base = palette[universe % palette.length];
        writePixel(frame, options.width, x, y, scaleColor(base, options.intensity));
      } else if (x % options.universeSize === 0 || x === options.width - 1) {
        writePixel(frame, options.width, x, y, [18, 18, 18]);
      }
    }
  }
}

function fillFirstLastProbe(frame, options) {
  const strips = [];
  for (let y = 0; y < options.height; y += 1) if (selectedStripMatches(y, options.stripIndex)) strips.push(y);
  for (const y of strips) {
    const markWidth = Math.min(10, Math.max(2, Math.floor(options.width / 20)));
    for (let x = 0; x < markWidth; x += 1) writePixel(frame, options.width, x, y, scaleColor([0, 230, 0], options.intensity));
    for (let x = options.width - markWidth; x < options.width; x += 1) writePixel(frame, options.width, x, y, scaleColor([230, 0, 0], options.intensity));
    const center = Math.floor(options.width / 2);
    for (let x = Math.max(0, center - 3); x <= Math.min(options.width - 1, center + 3); x += 1) writePixel(frame, options.width, x, y, scaleColor([0, 80, 255], options.intensity));
  }
}

function fillRgbOrder(frame, options) {
  const zones = [[230, 0, 0], [0, 220, 0], [0, 80, 255], [210, 210, 210]];
  for (let y = 0; y < options.height; y += 1) {
    if (!selectedStripMatches(y, options.stripIndex)) continue;
    for (let x = 0; x < options.width; x += 1) {
      const zone = Math.min(zones.length - 1, Math.floor((x / options.width) * zones.length));
      writePixel(frame, options.width, x, y, scaleColor(zones[zone], options.intensity));
    }
  }
}

function fillDirectionProbe(frame, options) {
  const marker = Math.floor((((options.phase * 0.75) % 1) + 1) % 1 * Math.max(1, options.width - 1));
  for (let y = 0; y < options.height; y += 1) {
    if (!selectedStripMatches(y, options.stripIndex)) continue;
    for (let x = 0; x < options.width; x += 1) {
      const gradient = x / Math.max(1, options.width - 1);
      const base = [Math.round(30 + gradient * 190), Math.round(210 - gradient * 160), 40];
      writePixel(frame, options.width, x, y, scaleColor(base, options.intensity * 0.72));
    }
    for (let dx = -4; dx <= 4; dx += 1) {
      const x = Math.max(0, Math.min(options.width - 1, marker + dx));
      const strength = 1 - Math.abs(dx) / 5;
      writePixel(frame, options.width, x, y, scaleColor([255, 255, 255], options.intensity * strength));
    }
    writePixel(frame, options.width, 0, y, [0, 255, 0]);
    writePixel(frame, options.width, options.width - 1, y, [255, 0, 0]);
  }
}

export function createGeneratorFieldTestFrame(options = {}) {
  const normalized = normalizeGeneratorFieldTestOptions(options);
  const frame = new Uint8Array(normalized.width * normalized.height * 3);
  if (normalized.type === 'single-strip') fillSingleStrip(frame, normalized);
  else if (normalized.type === 'universe-sweep') fillUniverseSweep(frame, normalized);
  else if (normalized.type === 'first-last') fillFirstLastProbe(frame, normalized);
  else if (normalized.type === 'rgb-order') fillRgbOrder(frame, normalized);
  else if (normalized.type === 'direction-probe') fillDirectionProbe(frame, normalized);
  return Object.freeze({
    frame,
    width: normalized.width,
    height: normalized.height,
    patch: { name: `FIELD TEST · ${normalized.typeName}`, width: normalized.width, height: normalized.height },
    graphPlan: null,
    meta: {
      version: GENERATOR_FIELD_TEST_VERSION,
      fieldTest: true,
      fieldTestType: normalized.type,
      fieldTestName: normalized.typeName,
      stripIndex: normalized.stripIndex,
      universeIndex: normalized.universeIndex,
      universeSize: normalized.universeSize,
      phase: normalized.phase,
      time: normalized.phase,
      beat: 0,
      bpm: 145,
      renderMs: 0
    },
    options: normalized
  });
}

export function summarizeGeneratorFieldTest(options = {}) {
  const normalized = normalizeGeneratorFieldTestOptions(options);
  const strip = normalized.stripIndex < 0 ? 'ALL STRIPS' : `STRIP ${normalized.stripIndex + 1}`;
  const universe = normalized.universeIndex < 0 ? 'AUTO UNIVERSE' : `U${normalized.universeIndex}`;
  let detail = `${normalized.typeName} · ${strip}`;
  if (normalized.type === 'universe-sweep') detail += ` · ${universe} · ${normalized.universeSize}px chunks`;
  if (normalized.type === 'rgb-order') detail += ' · R / G / B / W zones';
  if (normalized.type === 'first-last') detail += ' · start green / end red';
  if (normalized.type === 'direction-probe') detail += ' · moving white marker';
  if (normalized.type === 'single-strip') detail += ` · ${normalized.colorName}`;
  return Object.freeze({
    version: GENERATOR_FIELD_TEST_VERSION,
    label: normalized.typeName,
    detail,
    strip,
    universe,
    width: normalized.width,
    height: normalized.height,
    byteLength: normalized.width * normalized.height * 3,
    options: normalized
  });
}

export function buildGeneratorFieldTestReport(options = {}, publish = {}) {
  const summary = summarizeGeneratorFieldTest(options);
  const status = publish?.live ? 'LIVE MASTER' : 'PREVIEW ONLY';
  const delivery = publish?.ok ? 'published' : (publish?.skipped ? `skipped: ${publish.reason || 'unknown'}` : 'preview');
  return [
    `FIELD TEST: ${summary.label}`,
    `MODE: ${status}`,
    `DELIVERY: ${delivery}`,
    `TARGET: ${summary.detail}`,
    `FRAME: ${summary.width}x${summary.height} RGB · ${summary.byteLength} bytes`
  ].join('\n');
}

export default Object.freeze({
  GENERATOR_FIELD_TEST_VERSION,
  listGeneratorFieldTests,
  listGeneratorFieldTestColors,
  normalizeGeneratorFieldTestOptions,
  createGeneratorFieldTestFrame,
  summarizeGeneratorFieldTest,
  buildGeneratorFieldTestReport
});
