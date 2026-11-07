import { freezeUniqueList } from "./list_utils.js";

export const MAPPING_V2_VERSION = 2;

export const MAPPING_V2_OUTPUTS = ["none", "serial", "blx", "artnet", "sacn", "dmx"];
export const MAPPING_V2_OBJECT_TYPES = ["line", "grid", "matrix", "ring", "triangle", "polygon", "volume3d"];
export const MAPPING_V2_SAMPLING = ["nearest", "linear", "smooth", "supersample"];
export const MAPPING_V2_ROUTE_MODES = ["serial", "blx_serial", "blx_net", "artnet", "sacn", "dmx"];

const DEFAULT_TRANSFORM = Object.freeze({
  translate: Object.freeze({ x: 0, y: 0, z: 0 }),
  rotate: Object.freeze({ x: 0, y: 0, z: 0 }),
  scale: Object.freeze({ x: 1, y: 1, z: 1 }),
  mirror: Object.freeze({ x: false, y: false, z: false }),
  warp: 0,
  curve: 0
});

export function createDefaultMappingV2({ count = 8, pixelsPerStrip = 300, columns = 4, rowGap = 20 } = {}) {
  const stripCount = clampInt(count, 1, 256, 8);
  const stripPixels = clampInt(pixelsPerStrip, 1, 20000, 300);
  const colCount = clampInt(columns, 1, 64, 4);
  const segments = [];
  for (let i = 0; i < stripCount; i += 1) {
    segments.push({
      id: `seg_${i + 1}`,
      label: `SEG ${i + 1}`,
      enabled: true,
      source: { x: 0, y: i, width: stripPixels, height: 1 },
      physical: {
        output: "none",
        universe: 0,
        startAddress: i * stripPixels,
        pixelStart: 0,
        pixelCount: stripPixels,
        direction: "forward",
        colorOrder: "RGB",
        universeSize: 170,
        routeSegments: []
      },
      correction: { brightness: 1, gamma: 1, contrast: 1, whiteLimit: 1 },
      object: { type: "line", sampling: "nearest", transform: defaultTransformForIndex(i, colCount, rowGap, stripPixels) },
      tags: []
    });
  }
  return normalizeMappingV2({
    version: MAPPING_V2_VERSION,
    label: `${stripCount} x ${stripPixels} PX`,
    virtual: { width: stripPixels, height: stripCount, coordinateSystem: "xy", pixelAspect: 1 },
    layout: { columns: colCount, rowGap: clampInt(rowGap, 0, 2000, 20), units: "grid" },
    segments,
    meta: { createdBy: "mapping-v2-default" }
  });
}

export function migrateLegacyMappingToV2(legacy) {
  if (legacy?.version === MAPPING_V2_VERSION && Array.isArray(legacy?.segments)) return normalizeMappingV2(legacy);
  const strips = Array.isArray(legacy?.strips) ? legacy.strips : [];
  const count = clampInt(legacy?.count ?? strips.length, 1, 256, Math.max(1, strips.length || 8));
  const pixelsPerStrip = clampInt(legacy?.pixelsPerStrip, 1, 20000, 300);
  const columns = clampInt(legacy?.columns, 1, 64, 4);
  const rowGap = clampInt(legacy?.rowGap, 0, 2000, 20);
  const segments = [];
  for (let i = 0; i < count; i += 1) {
    const src = strips[i] || {};
    const enabled = src.enabled ?? legacy?.enabled?.[i] ?? true;
    const reversed = Boolean(src.reversed ?? legacy?.reversed?.[i] ?? false);
    const pixels = clampInt(src.pixels ?? legacy?.pixelLimit?.[i] ?? pixelsPerStrip, 1, 20000, pixelsPerStrip);
    segments.push({
      id: String(src.id || `seg_${i + 1}`),
      label: String(src.label || `SEG ${i + 1}`),
      enabled: enabled !== false,
      source: { x: 0, y: i, width: pixels, height: 1 },
      physical: {
        output: normalizeOutput(src.output ?? legacy?.outputs?.[i] ?? legacy?.route?.[i] ?? "none"),
        universe: clampInt(src.universe, 0, 63999, 0),
        startAddress: clampInt(src.start ?? src.startAddress, 0, 2000000, i * pixelsPerStrip),
        pixelStart: 0,
        pixelCount: pixels,
        direction: reversed ? "reverse" : "forward",
        colorOrder: normalizeColorOrder(src.colorOrder),
        universeSize: clampInt(src.universeSize ?? src.universePx ?? legacy?.universeSize, 1, 4096, 170),
        outputIp: String(src.outputIp || src.targetIp || src.ip || src.host || '').trim(),
        targetIp: String(src.outputIp || src.targetIp || src.ip || src.host || '').trim(),
        artnetPort: clampInt(src.artnetPort ?? src.targetPort ?? src.port, 1, 65535, 6454),
        targetPort: clampInt(src.artnetPort ?? src.targetPort ?? src.port, 1, 65535, 6454),
        routeSegments: normalizeRouteSegments(src.routeSegments ?? src.patchSegments ?? src.segments ?? [])
      },
      correction: {
        brightness: clampNum(src.brightness ?? legacy?.brightness?.[i], 0, 1, 1),
        gamma: clampNum(src.gamma, 0.1, 5, 1),
        contrast: clampNum(src.contrast, 0, 3, 1),
        whiteLimit: clampNum(src.whiteLimit, 0, 1, 1)
      },
      object: {
        type: normalizeEnum(src.objectType, MAPPING_V2_OBJECT_TYPES, "line"),
        sampling: normalizeEnum(src.sampling, MAPPING_V2_SAMPLING, "nearest"),
        transform: defaultTransformForIndex(i, columns, rowGap, pixelsPerStrip, reversed)
      },
      tags: Array.isArray(src.tags) ? src.tags.map(String) : []
    });
  }
  return normalizeMappingV2({
    version: MAPPING_V2_VERSION,
    label: String(legacy?.label || `${count} x ${pixelsPerStrip} PX`),
    virtual: { width: pixelsPerStrip, height: count, coordinateSystem: "xy", pixelAspect: 1 },
    layout: { columns, rowGap, units: "grid" },
    segments,
    meta: { migratedFrom: "mapping-v1" }
  });
}

export function normalizeMappingV2(input = {}) {
  const segments = Array.isArray(input.segments) ? input.segments.map(normalizeSegmentV2) : [];
  const virtual = input.virtual || {};
  const layout = input.layout || {};
  const widthFallback = Math.max(1, ...segments.map((s) => s.source.x + s.source.width));
  const heightFallback = Math.max(1, ...segments.map((s) => s.source.y + s.source.height));
  return {
    version: MAPPING_V2_VERSION,
    label: String(input.label || "Mapping V2"),
    virtual: {
      width: clampInt(virtual.width, 1, 65535, widthFallback),
      height: clampInt(virtual.height, 1, 65535, heightFallback),
      coordinateSystem: String(virtual.coordinateSystem || "xy"),
      pixelAspect: clampNum(virtual.pixelAspect, 0.01, 100, 1)
    },
    layout: {
      columns: clampInt(layout.columns, 1, 256, Math.max(1, Math.ceil(Math.sqrt(Math.max(1, segments.length))))),
      rowGap: clampInt(layout.rowGap, 0, 10000, 20),
      units: String(layout.units || "grid")
    },
    segments,
    meta: { ...(input.meta || {}) }
  };
}

export function normalizeSegmentV2(input = {}, index = 0) {
  const physical = input.physical || input || {};
  const correction = input.correction || input || {};
  const object = input.object || input || {};
  const source = input.source || {};
  return {
    id: String(input.id || `seg_${index + 1}`),
    label: String(input.label || input.id || `SEG ${index + 1}`),
    enabled: input.enabled !== false,
    source: {
      x: clampInt(source.x, 0, 65535, 0),
      y: clampInt(source.y ?? index, 0, 65535, index),
      width: clampInt(source.width ?? physical.pixelCount ?? input.pixelCount ?? input.pixels, 1, 65535, 1),
      height: clampInt(source.height, 1, 65535, 1)
    },
    physical: {
      output: normalizeOutput(physical.output),
      universe: clampInt(physical.universe, 0, 63999, 0),
      startAddress: clampInt(physical.startAddress ?? physical.start ?? input.startAddress, 0, 2000000, 0),
      pixelStart: clampInt(physical.pixelStart, 0, 2000000, 0),
      pixelCount: clampInt(physical.pixelCount ?? input.pixelCount ?? input.pixels, 1, 65535, 1),
      direction: String(physical.direction || (input.reversed ? "reverse" : "forward")).toLowerCase() === "reverse" ? "reverse" : "forward",
      colorOrder: normalizeColorOrder(physical.colorOrder),
      universeSize: clampInt(physical.universeSize ?? physical.universePx, 1, 4096, defaultUniverseSizeForOutput(normalizeOutput(physical.output))),
      outputIp: String(physical.outputIp || physical.targetIp || physical.ip || physical.host || input.outputIp || input.targetIp || '').trim(),
      targetIp: String(physical.outputIp || physical.targetIp || physical.ip || physical.host || input.outputIp || input.targetIp || '').trim(),
      artnetPort: clampInt(physical.artnetPort ?? physical.targetPort ?? physical.port ?? input.artnetPort ?? input.targetPort ?? input.port, 1, 65535, 6454),
      targetPort: clampInt(physical.artnetPort ?? physical.targetPort ?? physical.port ?? input.artnetPort ?? input.targetPort ?? input.port, 1, 65535, 6454),
      routeSegments: normalizeRouteSegments(physical.routeSegments ?? input.routeSegments ?? input.patchSegments ?? input.segments ?? [])
    },
    correction: {
      brightness: clampNum(correction.brightness, 0, 1, 1),
      gamma: clampNum(correction.gamma, 0.1, 5, 1),
      contrast: clampNum(correction.contrast, 0, 3, 1),
      whiteLimit: clampNum(correction.whiteLimit, 0, 1, 1)
    },
    object: {
      type: normalizeEnum(object.type || object.objectType, MAPPING_V2_OBJECT_TYPES, "line"),
      sampling: normalizeEnum(object.sampling, MAPPING_V2_SAMPLING, "nearest"),
      transform: normalizeTransform(object.transform || input.transform || DEFAULT_TRANSFORM)
    },
    tags: Array.isArray(input.tags) ? input.tags.map(String) : []
  };
}


export function protocolPixelCapacity(output, requested = null) {
  const id = normalizeOutput(output);
  const fallback = defaultUniverseSizeForOutput(id);
  const value = clampInt(requested, 1, 4096, fallback);
  if (id === "artnet" || id === "sacn" || id === "dmx") return Math.max(1, Math.min(170, value));
  return value;
}

function normalizeUniverseAddress({ universe, startAddress, capacity }) {
  const safeCapacity = Math.max(1, clampInt(capacity, 1, 170, 170));
  const rawUniverse = clampInt(universe, 0, 63999, 0);
  const rawAddress = clampInt(startAddress, 0, 2000000, 0);
  return {
    universe: rawUniverse + Math.floor(rawAddress / safeCapacity),
    startAddress: rawAddress % safeCapacity,
    capacity: safeCapacity
  };
}

export function expandSegmentToRouteParts(segment = {}, index = 0) {
  const p = segment.physical || {};
  const output = normalizeOutput(p.output);
  const totalPixels = clampInt(p.pixelCount ?? segment.pixelCount ?? segment.pixels, 1, 65535, 1);
  const baseUniverse = clampInt(p.universe, 0, 63999, 0);
  const baseStart = clampInt(p.startAddress ?? p.start, 0, 2000000, 0);
  const basePixelStart = clampInt(p.pixelStart, 0, 2000000, 0);
  const capacity = protocolPixelCapacity(output, p.universeSize);
  const shouldSplit = ["artnet", "sacn", "dmx"].includes(output);
  const explicitRouteSegments = Array.isArray(p.routeSegments) ? p.routeSegments : [];
  const parts = [];
  if (explicitRouteSegments.length) {
    const parts = [];
    for (const [partIndex, routeSegment] of explicitRouteSegments.entries()) {
      const normalized = normalizeUniverseAddress({
        universe: routeSegment.universe ?? baseUniverse,
        startAddress: routeSegment.startAddress ?? 0,
        capacity
      });
      parts.push({
        segmentId: `${segment.id || `seg_${index + 1}`}_p${partIndex + 1}`,
        parentSegmentId: segment.id || `seg_${index + 1}`,
        partIndex,
        enabled: segment.enabled !== false,
        output,
        universe: normalized.universe,
        startAddress: normalized.startAddress,
        pixelStart: clampInt(routeSegment.pixelStart, 0, 2000000, 0),
        sourcePixelOffset: clampInt(routeSegment.pixelStart, 0, 2000000, 0),
        pixelCount: clampInt(routeSegment.pixelCount, 1, Math.max(1, normalized.capacity - normalized.startAddress), 1),
        physicalPixelCount: totalPixels,
        direction: p.direction,
        colorOrder: p.colorOrder,
        brightness: segment.correction?.brightness,
        gamma: segment.correction?.gamma,
        contrast: segment.correction?.contrast,
        whiteLimit: segment.correction?.whiteLimit,
        source: segment.source,
        object: segment.object,
        universeSize: capacity,
        outputIp: String(p.outputIp || p.targetIp || p.ip || p.host || '').trim(),
        targetIp: String(p.outputIp || p.targetIp || p.ip || p.host || '').trim(),
        port: clampInt(p.artnetPort ?? p.targetPort ?? p.port, 1, 65535, 6454),
        targetPort: clampInt(p.artnetPort ?? p.targetPort ?? p.port, 1, 65535, 6454)
      });
    }
    return parts;
  }
  if (!shouldSplit) {
    return [{
      segmentId: segment.id || `seg_${index + 1}`,
      parentSegmentId: segment.id || `seg_${index + 1}`,
      partIndex: 0,
      enabled: segment.enabled !== false,
      output,
      universe: baseUniverse,
      startAddress: baseStart,
      pixelStart: basePixelStart,
      sourcePixelOffset: 0,
      pixelCount: totalPixels,
      physicalPixelCount: totalPixels,
      direction: p.direction,
      colorOrder: p.colorOrder,
      brightness: segment.correction?.brightness,
      gamma: segment.correction?.gamma,
      contrast: segment.correction?.contrast,
      whiteLimit: segment.correction?.whiteLimit,
      source: segment.source,
      object: segment.object,
      universeSize: capacity,
      outputIp: String(p.outputIp || p.targetIp || p.ip || p.host || '').trim(),
      targetIp: String(p.outputIp || p.targetIp || p.ip || p.host || '').trim(),
      port: clampInt(p.artnetPort ?? p.targetPort ?? p.port, 1, 65535, 6454),
      targetPort: clampInt(p.artnetPort ?? p.targetPort ?? p.port, 1, 65535, 6454)
    }];
  }
  let remaining = totalPixels;
  let consumed = 0;
  let universe = baseUniverse + Math.floor(baseStart / capacity);
  let startAddress = baseStart % capacity;
  let partIndex = 0;
  while (remaining > 0) {
    const available = Math.max(1, capacity - startAddress);
    const take = Math.min(remaining, available);
    parts.push({
      segmentId: `${segment.id || `seg_${index + 1}`}_p${partIndex + 1}`,
      parentSegmentId: segment.id || `seg_${index + 1}`,
      partIndex,
      enabled: segment.enabled !== false,
      output,
      universe,
      startAddress,
      pixelStart: basePixelStart + consumed,
      sourcePixelOffset: consumed,
      pixelCount: take,
      physicalPixelCount: totalPixels,
      direction: p.direction,
      colorOrder: p.colorOrder,
      brightness: segment.correction?.brightness,
      gamma: segment.correction?.gamma,
      contrast: segment.correction?.contrast,
      whiteLimit: segment.correction?.whiteLimit,
      source: segment.source,
      object: segment.object,
      universeSize: capacity,
      outputIp: String(p.outputIp || p.targetIp || p.ip || p.host || '').trim(),
      targetIp: String(p.outputIp || p.targetIp || p.ip || p.host || '').trim(),
      port: clampInt(p.artnetPort ?? p.targetPort ?? p.port, 1, 65535, 6454),
      targetPort: clampInt(p.artnetPort ?? p.targetPort ?? p.port, 1, 65535, 6454)
    });
    remaining -= take;
    consumed += take;
    universe += 1;
    startAddress = 0;
    partIndex += 1;
  }
  return parts;
}

export function validateMappingV2(mapping) {
  const errors = [];
  const warnings = [];
  const ids = new Set();
  const overlaps = new Map();
  if (mapping?.version !== MAPPING_V2_VERSION) errors.push("mapping.version must be 2");
  if (!Array.isArray(mapping?.segments)) errors.push("mapping.segments must be an array");
  for (const [index, segment] of (mapping?.segments || []).entries()) {
    const p = `segments[${index}]`;
    if (!segment.id) errors.push(`${p}.id is required`);
    if (ids.has(segment.id)) errors.push(`${p}.id duplicate: ${segment.id}`);
    ids.add(segment.id);
    if (!MAPPING_V2_OUTPUTS.includes(segment.physical.output)) errors.push(`${p}.physical.output invalid`);
    if (segment.physical.pixelCount <= 0) errors.push(`${p}.physical.pixelCount must be > 0`);
    if (segment.source.x + segment.source.width > mapping.virtual.width) warnings.push(`${p}.source exceeds virtual width`);
    if (segment.source.y + segment.source.height > mapping.virtual.height) warnings.push(`${p}.source exceeds virtual height`);
    if (segment.enabled && segment.physical.output !== "none") {
      const routeSegments = Array.isArray(segment.physical.routeSegments) ? segment.physical.routeSegments : [];
      if (routeSegments.length) {
        const totalRoutedPixels = routeSegments.reduce((sum, part) => sum + clampInt(part.pixelCount, 1, 65535, 1), 0);
        if (totalRoutedPixels !== segment.physical.pixelCount) {
          errors.push(`${p}.physical.routeSegments pixel sum ${totalRoutedPixels} must equal strip pixelCount ${segment.physical.pixelCount}`);
        }
        const sourceRanges = routeSegments
          .map((part) => ({
            start: clampInt(part.pixelStart, 0, 2000000, 0),
            end: clampInt(part.pixelStart, 0, 2000000, 0) + clampInt(part.pixelCount, 1, 65535, 1) - 1
          }))
          .sort((a, b) => a.start - b.start || a.end - b.end);
        let expectedSourcePixel = 0;
        for (const range of sourceRanges) {
          if (range.start !== expectedSourcePixel) errors.push(`${p}.physical.routeSegments source coverage must stay contiguous from 0; got ${range.start}, expected ${expectedSourcePixel}`);
          expectedSourcePixel = range.end + 1;
        }
      }
      const parts = expandSegmentToRouteParts(segment, index);
      for (const part of parts) {
        const targetKey = `${String(part.outputIp || part.targetIp || part.host || '').trim() || 'default'}:${Number(part.targetPort || part.port || 6454) || 6454}`;
        const key = `${part.output}:${targetKey}:${part.universe}`;
        const start = part.startAddress;
        const end = start + part.pixelCount - 1;
        if (["artnet", "sacn", "dmx"].includes(part.output) && end >= part.universeSize) {
          errors.push(`${p}.physical route part exceeds ${part.output} universe capacity`);
        }
        const list = overlaps.get(key) || [];
        for (const other of list) {
          if (start <= other.end && end >= other.start) {
            errors.push(`${p}.physical address overlaps ${other.id} on ${key}`);
          }
        }
        list.push({ id: part.parentSegmentId || segment.id, start, end });
        overlaps.set(key, list);
      }
    }
  }
  return { ok: errors.length === 0, errors, warnings };
}

export function compileMappingV2(mapping) {
  const normalized = normalizeMappingV2(mapping);
  const validation = validateMappingV2(normalized);
  const routes = {};
  const rows = {
    reversed: [],
    enabled: [],
    brightness: [],
    pixelLimit: [],
    route: [],
    colorOrder: []
  };
  normalized.segments.forEach((segment, index) => {
    rows.reversed[index] = segment.physical.direction === "reverse";
    rows.enabled[index] = segment.enabled;
    rows.brightness[index] = segment.correction.brightness;
    rows.pixelLimit[index] = segment.physical.pixelCount;
    rows.route[index] = segment.physical.output;
    rows.colorOrder[index] = segment.physical.colorOrder || "RGB";
    const routeKey = segment.physical.output;
    if (!routes[routeKey]) routes[routeKey] = [];
    for (const part of expandSegmentToRouteParts(segment, index)) {
      routes[routeKey].push({
        ...part,
        index,
        stripIndex: index,
        label: segment.label,
        segmentId: part.segmentId,
        parentSegmentId: part.parentSegmentId || segment.id
      });
    }
  });
  return {
    version: MAPPING_V2_VERSION,
    ok: validation.ok,
    validation,
    virtual: normalized.virtual,
    rows,
    routes,
    segments: normalized.segments,
    summary: {
      segments: normalized.segments.length,
      enabled: normalized.segments.filter((s) => s.enabled).length,
      physicalPixels: normalized.segments.reduce((sum, s) => sum + (s.enabled ? s.physical.pixelCount : 0), 0),
      outputs: Object.fromEntries(Object.entries(routes).map(([key, list]) => [key, list.filter((s) => s.enabled).length]))
    }
  };
}

export function compileArtNetPatchFromMappingV2(mapping, options = {}) {
  const compiled = compileMappingV2(mapping);
  const width = clampInt(options.width ?? compiled.virtual?.width, 1, 65535, compiled.virtual?.width || 1);
  const height = clampInt(options.height ?? compiled.segments?.length, 1, 65535, compiled.segments?.length || 1);
  const routes = Array.isArray(compiled.routes?.artnet) ? compiled.routes.artnet : [];
  return finalizeArtNetPatch({
    version: "artnet-patch-v1",
    patchSource: "mapping-v2-canonical",
    width,
    height,
    totalPixels: width * height,
    routes: routes
      .filter((route) => String(route.outputIp || route.targetIp || route.ip || route.host || '').trim())
      .map((route) => {
        const enabled = route?.enabled !== false;
        return {
          segmentId: String(route.segmentId || route.parentSegmentId || ""),
          parentSegmentId: String(route.parentSegmentId || route.segmentId || ""),
          stripIndex: clampInt(route.stripIndex, 0, 65535, 0),
          universe: clampInt(route.universe, 0, 63999, 0),
          startAddress: clampInt(route.startAddress, 0, 2000000, 0),
          sourcePixelOffset: clampInt(route.sourcePixelOffset, 0, 2000000, 0),
          pixelCount: clampInt(route.pixelCount, 1, 65535, 1),
          universeSize: clampInt(route.universeSize, 1, 170, 170),
          physicalPixelCount: clampInt(route.physicalPixelCount, 1, 65535, route.pixelCount),
          direction: String(route.direction || "forward").toLowerCase() === "reverse" ? "reverse" : "forward",
          colorOrder: normalizeColorOrder(route.colorOrder),
          brightness: clampNum(route.brightness, 0, 1, 1),
          gamma: clampNum(route.gamma, 0.1, 5, 1),
          contrast: clampNum(route.contrast, 0, 3, 1),
          whiteLimit: clampNum(route.whiteLimit, 0, 1, 1),
          enabled,
          forceBlack: !enabled,
          outputIp: String(route.outputIp || route.targetIp || route.ip || route.host || ''),
          targetIp: String(route.outputIp || route.targetIp || route.ip || route.host || ''),
          port: clampInt(route.port || route.targetPort, 1, 65535, 6454),
          targetPort: clampInt(route.port || route.targetPort, 1, 65535, 6454)
        };
      })
  });
}

export function createArtNetPatchSignature(patch = {}) {
  const routes = Array.isArray(patch.routes) ? patch.routes : [];
  const normalized = routes.map((route) => [
    clampInt(route.stripIndex, 0, 65535, 0),
    clampInt(route.universe, 0, 63999, 0),
    clampInt(route.startAddress, 0, 2000000, 0),
    clampInt(route.sourcePixelOffset, 0, 2000000, 0),
    clampInt(route.pixelCount, 1, 65535, 1),
    clampInt(route.universeSize, 1, 170, 170),
    route.forceBlack ? 1 : 0,
    String(route.direction || "forward"),
    String(route.colorOrder || "RGB"),
    Number(route.brightness ?? 1).toFixed(3),
    Number(route.gamma ?? 1).toFixed(3),
    Number(route.contrast ?? 1).toFixed(3),
    Number(route.whiteLimit ?? 1).toFixed(3),
    String(route.outputIp || route.targetIp || route.host || ""),
    String(route.targetPort || route.port || 6454),
    String(route.parentSegmentId || route.segmentId || "")
  ]);
  return JSON.stringify({
    version: String(patch.version || "artnet-patch-v1"),
    width: clampInt(patch.width, 1, 65535, 1),
    height: clampInt(patch.height, 1, 65535, 1),
    routes: normalized
  });
}

export function finalizeArtNetPatch(patch = {}, meta = {}) {
  const routes = Array.isArray(patch.routes) ? patch.routes.map((route) => ({
    segmentId: String(route.segmentId || route.parentSegmentId || ""),
    parentSegmentId: String(route.parentSegmentId || route.segmentId || ""),
    stripIndex: clampInt(route.stripIndex, 0, 65535, 0),
    universe: clampInt(route.universe, 0, 63999, 0),
    startAddress: clampInt(route.startAddress, 0, 2000000, 0),
    sourcePixelOffset: clampInt(route.sourcePixelOffset, 0, 2000000, 0),
    pixelCount: clampInt(route.pixelCount, 1, 65535, 1),
    universeSize: clampInt(route.universeSize, 1, 170, 170),
    physicalPixelCount: clampInt(route.physicalPixelCount, 1, 65535, route.pixelCount),
    direction: String(route.direction || "forward").toLowerCase() === "reverse" ? "reverse" : "forward",
    colorOrder: normalizeColorOrder(route.colorOrder),
    brightness: clampNum(route.brightness, 0, 1, 1),
    gamma: clampNum(route.gamma, 0.1, 5, 1),
    contrast: clampNum(route.contrast, 0, 3, 1),
    whiteLimit: clampNum(route.whiteLimit, 0, 1, 1),
    enabled: route.enabled !== false,
    forceBlack: Boolean(route.forceBlack),
    outputIp: String(route.outputIp || route.targetIp || route.ip || route.host || ''),
    targetIp: String(route.outputIp || route.targetIp || route.ip || route.host || ''),
    port: clampInt(route.port || route.targetPort, 1, 65535, 6454),
    targetPort: clampInt(route.port || route.targetPort, 1, 65535, 6454)
  })) : [];
  const finalized = {
    version: String(patch.version || "artnet-patch-v1"),
    patchSource: String(patch.patchSource || meta.patchSource || "mapping-v2-canonical"),
    width: clampInt(patch.width, 1, 65535, 1),
    height: clampInt(patch.height, 1, 65535, 1),
    totalPixels: clampInt(patch.totalPixels, 1, 2000000000, clampInt(patch.width, 1, 65535, 1) * clampInt(patch.height, 1, 65535, 1)),
    routes
  };
  const universes = freezeUniqueList(routes.map((route) => route.universe).map((value) => String(value))).map(Number).sort((a, b) => a - b);
  finalized.routeCount = routes.length;
  finalized.universeFirst = universes.length ? universes[0] : null;
  finalized.universeLast = universes.length ? universes[universes.length - 1] : null;
  finalized.mappingPatchSignature = createArtNetPatchSignature(finalized);
  return finalized;
}

export function toLegacyRowsFromMappingV2(mapping) {
  return compileMappingV2(mapping).rows;
}

export function mappingV2ToLegacyExport(mapping) {
  const normalized = normalizeMappingV2(mapping);
  return {
    type: "custom",
    version: MAPPING_V2_VERSION,
    label: normalized.label,
    pixelsPerStrip: normalized.virtual.width,
    count: normalized.segments.length,
    columns: normalized.layout.columns,
    rowGap: normalized.layout.rowGap,
    totalPixels: normalized.segments.reduce((sum, segment) => sum + segment.physical.pixelCount, 0),
    reversed: normalized.segments.map((segment) => segment.physical.direction === "reverse"),
    enabled: normalized.segments.map((segment) => segment.enabled),
    brightness: normalized.segments.map((segment) => segment.correction.brightness),
    outputs: normalized.segments.map((segment) => segment.physical.output),
    strips: normalized.segments.map((segment, index) => ({
      index,
      id: segment.id,
      enabled: segment.enabled,
      brightness: segment.correction.brightness,
      gamma: segment.correction.gamma,
      contrast: segment.correction.contrast,
      reversed: segment.physical.direction === "reverse",
      output: segment.physical.output,
      pixels: segment.physical.pixelCount,
      universe: segment.physical.universe,
      start: segment.physical.startAddress,
      end: segment.physical.startAddress + segment.physical.pixelCount - 1,
      colorOrder: segment.physical.colorOrder,
      routeSegments: segment.physical.routeSegments,
      objectType: segment.object.type,
      sampling: segment.object.sampling
    })),
    mappingV2: normalized,
    compiled: compileMappingV2(normalized)
  };
}

function defaultTransformForIndex(index, columns, rowGap, pixelsPerStrip, reversed = false) {
  const col = index % Math.max(1, columns);
  const row = Math.floor(index / Math.max(1, columns));
  const spacingY = Math.max(0.6, rowGap / 40);
  const x = col;
  const y = -row * spacingY;
  return normalizeTransform({
    translate: { x, y, z: 0 },
    rotate: { x: 0, y: 0, z: reversed ? 180 : 0 },
    scale: { x: Math.max(0.2, pixelsPerStrip / Math.max(1, pixelsPerStrip)), y: 1, z: 1 },
    mirror: { x: false, y: false, z: false },
    warp: 0,
    curve: 0
  });
}

function normalizeTransform(input = {}) {
  return {
    translate: vec3(input.translate, DEFAULT_TRANSFORM.translate, -100000, 100000),
    rotate: vec3(input.rotate, DEFAULT_TRANSFORM.rotate, -3600, 3600),
    scale: vec3(input.scale, DEFAULT_TRANSFORM.scale, 0.001, 1000),
    mirror: {
      x: Boolean(input?.mirror?.x),
      y: Boolean(input?.mirror?.y),
      z: Boolean(input?.mirror?.z)
    },
    warp: clampNum(input.warp, -1000, 1000, 0),
    curve: clampNum(input.curve, -1000, 1000, 0)
  };
}

function vec3(input = {}, fallback = {}, min = -Infinity, max = Infinity) {
  return {
    x: clampNum(input.x, min, max, fallback.x ?? 0),
    y: clampNum(input.y, min, max, fallback.y ?? 0),
    z: clampNum(input.z, min, max, fallback.z ?? 0)
  };
}


function defaultUniverseSizeForOutput(output) {
  const id = normalizeOutput(output);
  if (id === "artnet" || id === "sacn" || id === "dmx") return 170;
  if (id === "blx") return 512;
  return 4096;
}

function normalizeOutput(value) {
  return normalizeEnum(String(value || "none").toLowerCase(), MAPPING_V2_OUTPUTS, "none");
}

function normalizeColorOrder(value) {
  const order = String(value || "RGB").toUpperCase();
  return ["RGB", "RBG", "GRB", "GBR", "BRG", "BGR"].includes(order) ? order : "RGB";
}

function normalizeRouteSegments(value) {
  const items = Array.isArray(value) ? value : [];
  let nextPixelStart = 0;
  return items.map((item) => {
    const pixelCount = clampInt(item?.pixelCount ?? item?.pixels, 1, 65535, 1);
    const pixelStart = item?.pixelStart == null
      ? nextPixelStart
      : clampInt(item?.pixelStart, 0, 2000000, nextPixelStart);
    nextPixelStart = pixelStart + pixelCount;
    return {
      universe: clampInt(item?.universe, 0, 63999, 0),
      startAddress: clampInt(item?.startAddress ?? item?.start, 0, 2000000, 0),
      pixelStart,
      pixelCount
    };
  });
}

function normalizeEnum(value, allowed, fallback) {
  const normalized = String(value || fallback).toLowerCase();
  return allowed.includes(normalized) ? normalized : fallback;
}

function clampInt(value, min, max, fallback) {
  const number = Number.parseInt(value, 10);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function clampNum(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}
