import { DEFAULT_SEGMENT, MAPPING_OBJECT_TYPES, MAPPING_OUTPUTS, SAMPLING_MODES } from './constants.js';

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function clampNum(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

export function normalizeSegment(input, index = 0) {
  const base = DEFAULT_SEGMENT;
  const raw = input || {};
  const t = raw.transform || {};
  const id = String(raw.id || `seg_${index + 1}`);
  const output = String(raw.output || base.output).toLowerCase();
  const objectType = String(raw.objectType || base.objectType).toLowerCase();
  const sampling = String(raw.sampling || base.sampling).toLowerCase();
  const direction = String(raw.direction || base.direction).toLowerCase();

  return {
    id,
    enabled: raw.enabled !== false,
    output: MAPPING_OUTPUTS.includes(output) ? output : base.output,
    universe: clampInt(raw.universe, 0, 63999, base.universe),
    pixelStart: clampInt(raw.pixelStart ?? raw.startAddress, 0, 2000000, base.pixelStart),
    pixelCount: clampInt(raw.pixelCount ?? raw.pixels, 1, 2000000, base.pixelCount),
    direction: direction === 'reverse' ? 'reverse' : 'forward',
    brightness: clampNum(raw.brightness, 0, 1, base.brightness),
    gamma: clampNum(raw.gamma, 0.1, 5, base.gamma),
    grouping: clampInt(raw.grouping, 1, 4096, base.grouping),
    objectType: MAPPING_OBJECT_TYPES.includes(objectType) ? objectType : base.objectType,
    sampling: SAMPLING_MODES.includes(sampling) ? sampling : base.sampling,
    transform: {
      translate: {
        x: clampNum(t?.translate?.x, -100000, 100000, 0),
        y: clampNum(t?.translate?.y, -100000, 100000, 0),
        z: clampNum(t?.translate?.z, -100000, 100000, 0)
      },
      rotate: {
        x: clampNum(t?.rotate?.x, -3600, 3600, 0),
        y: clampNum(t?.rotate?.y, -3600, 3600, 0),
        z: clampNum(t?.rotate?.z, -3600, 3600, 0)
      },
      scale: {
        x: clampNum(t?.scale?.x, 0.001, 1000, 1),
        y: clampNum(t?.scale?.y, 0.001, 1000, 1),
        z: clampNum(t?.scale?.z, 0.001, 1000, 1)
      },
      mirror: {
        x: Boolean(t?.mirror?.x),
        y: Boolean(t?.mirror?.y),
        z: Boolean(t?.mirror?.z)
      },
      warp: clampNum(t?.warp, -1000, 1000, 0),
      curve: clampNum(t?.curve, -1000, 1000, 0)
    }
  };
}

export function normalizeMappingState(mappingState) {
  const rawSegments = Array.isArray(mappingState?.segments)
    ? mappingState.segments
    : (Array.isArray(mappingState?.outputs) ? mappingState.outputs : []);

  const segments = rawSegments.map((segment, index) => normalizeSegment(segment, index));

  return {
    segments,
    width: clampInt(mappingState?.width, 1, 16384, 30),
    height: clampInt(mappingState?.height, 1, 16384, 10)
  };
}
