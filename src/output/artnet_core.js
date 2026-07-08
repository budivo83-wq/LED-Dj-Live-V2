import { buildArtDmxPacket, buildReusableArtDmxPacket } from "../server/live_output_packet_builder.js";

const DEFAULT_ARTSYNC_PROTOCOL_VERSION = 14;
const artSyncPacketCache = new Map();

export function buildDefaultEightStripUniverseMap({
  stripCount = 8,
  pixelsPerStrip = 300,
  pixelsPerUniverse = 170,
  startUniverse = 0,
  outputIp = "2.1.1.30",
  enabled = true
} = {}) {
  const totalPixels = stripCount * pixelsPerStrip;
  const universeStart = Number(startUniverse) || 0;
  const universes = [];
  for (let globalPixelStart = 0; globalPixelStart < totalPixels; globalPixelStart += pixelsPerUniverse) {
    const length = Math.min(pixelsPerUniverse, totalPixels - globalPixelStart);
    const firstStrip = Math.floor(globalPixelStart / pixelsPerStrip);
    universes.push(Object.freeze({
      strip: firstStrip,
      universe: universeStart + universes.length,
      startPixel: globalPixelStart - firstStrip * pixelsPerStrip,
      globalPixelStart,
      length,
      outputIp,
      enabled
    }));
  }
  const strips = [];
  for (let strip = 0; strip < stripCount; strip += 1) {
    const start = strip * pixelsPerStrip;
    const end = start + pixelsPerStrip;
    const stripUniverses = [];
    for (const entry of universes) {
      if (entry.globalPixelStart < end && entry.globalPixelStart + entry.length > start) stripUniverses.push(entry);
    }
    strips.push(Object.freeze({
      strip,
      universes: Object.freeze(stripUniverses)
    }));
  }
  const enabledUniverses = Object.freeze(universes.filter((entry) => entry.enabled !== false));
  return Object.freeze({
    version: "artnet-universe-map-v2-continuous",
    stripCount,
    pixelsPerStrip,
    pixelsPerUniverse,
    totalPixels,
    universeCount: universes.length,
    enabledUniverses,
    strips: Object.freeze(strips),
    universes: Object.freeze(universes)
  });
}

export function resolveUniverseMap(options = {}) {
  return options.universeMap || buildDefaultEightStripUniverseMap(options.map || {});
}

export function buildArtSyncPacket({ protocolVersion = 14 } = {}) {
  const version = Number(protocolVersion) || DEFAULT_ARTSYNC_PROTOCOL_VERSION;
  const cached = artSyncPacketCache.get(version);
  if (cached) return cached;
  const packet = new Uint8Array(14);
  packet.set([0x41, 0x72, 0x74, 0x2d, 0x4e, 0x65, 0x74, 0x00], 0);
  packet[8] = 0x00;
  packet[9] = 0x52;
  packet[10] = (version >> 8) & 0xff;
  packet[11] = version & 0xff;
  packet[12] = 0;
  packet[13] = 0;
  const built = Object.freeze({
    protocol: "artnet",
    opCode: "OpSync",
    port: 6454,
    packetBytes: packet.length,
    packet
  });
  artSyncPacketCache.set(version, built);
  return built;
}

const artnetPatchPlanCache = new WeakMap();

function getCompiledPatchPlan(patch = null, width = 0, height = 0) {
  if (!patch || !Array.isArray(patch.routes)) return null;
  const normalizedWidth = clampInt(width, 1, 65535, 1);
  const normalizedHeight = clampInt(height, 1, 65535, 1);
  const capacity = clampInt(patch?.pixelsPerUniverse ?? patch?.universeSize ?? 170, 1, 170, 170);
  const key = `${normalizedWidth}|${normalizedHeight}|${capacity}|${patch.routes.length}|${patch.publishedAt || ''}`;
  const cached = artnetPatchPlanCache.get(patch);
  if (cached?.key === key) return cached;

  const routes = normalizePatchRoutesForArtNetCapacity(patch.routes, patch);
  const byUniverse = new Map();
  for (const route of routes) {
    if (!route || (route.enabled === false && !route.forceBlack)) continue;
    const universe = clampInt(route.universe, 0, 63999, 0);
    const rawStartAddress = clampInt(route.startAddress, 0, 2000000, 0);
    const universeCapacity = clampInt(route.universeSize ?? patch?.pixelsPerUniverse ?? patch?.universeSize, 1, 170, 170);
    const normalizedUniverse = universe + Math.floor(rawStartAddress / universeCapacity);
    const startAddress = rawStartAddress % universeCapacity;
    const sourcePixelOffset = clampInt(route.sourcePixelOffset, 0, 2000000, 0);
    const stripIndex = clampInt(route.stripIndex, 0, 65535, 0);
    const pixelCount = clampInt(route.pixelCount, 1, Math.max(1, universeCapacity - startAddress), 1);
    const srcRowOffset = stripIndex * normalizedWidth;
    const srcPixelStart = srcRowOffset + sourcePixelOffset;
    const srcPixelEnd = srcPixelStart + pixelCount;
    const totalPixels = normalizedWidth * normalizedHeight;
    const dstByteStart = startAddress * 3;
    const srcByteStart = srcPixelStart * 3;
    const srcByteEnd = srcPixelEnd * 3;
    const targetIp = String(route.outputIp || route.targetIp || route.host || patch?.outputIp || patch?.targetIp || '').trim();
    const targetPort = clampInt(route.port || route.targetPort || patch?.port || patch?.targetPort, 1, 65535, 6454);
    const universeKey = `${targetIp || '__default__'}:${targetPort}:${normalizedUniverse}`;
    const entry = byUniverse.get(universeKey) || { universe: normalizedUniverse, outputIp: targetIp, targetPort, maxPixels: 0, routes: [] };
    entry.maxPixels = Math.max(entry.maxPixels, startAddress + pixelCount);
    entry.routes.push({
      srcByteStart,
      srcByteEnd,
      dstByteStart,
      pixelCount,
      validSpan: srcPixelStart >= 0 && srcPixelEnd <= totalPixels,
      srcRowOffset,
      sourcePixelOffset,
      totalPixels,
      physicalPixelCount: clampInt(route.physicalPixelCount, 1, 65535, pixelCount),
      direction: String(route.direction || 'forward').toLowerCase() === 'reverse' ? 'reverse' : 'forward',
      colorOrder: String(route.colorOrder || 'RGB').toUpperCase(),
      brightness: clampFloat(route.brightness, 0, 1, 1),
      gamma: clampFloat(route.gamma, 0.1, 5, 1),
      contrast: clampFloat(route.contrast, 0, 3, 1),
      whiteLimit: clampFloat(route.whiteLimit, 0, 1, 1),
      forceBlack: Boolean(route.forceBlack),
      identityCorrection: isIdentityCorrection(route),
      correctionLut: isIdentityCorrection(route) ? null : makeCorrectionLut(route)
    });
    byUniverse.set(universeKey, entry);
  }

  const universes = [...byUniverse.values()].sort((a, b) => a.universe - b.universe).map((entry) => {
    const routes = entry.routes.sort((a, b) => a.dstByteStart - b.dstByteStart);
    let covered = 0;
    let needsClear = false;
    for (const route of routes) {
      if (route.forceBlack || route.dstByteStart > covered) { needsClear = true; break; }
      covered = Math.max(covered, route.dstByteStart + route.pixelCount * 3);
    }
    if (covered < entry.maxPixels * 3) needsClear = true;
    return {
      universe: entry.universe,
      outputIp: entry.outputIp || '',
      targetIp: entry.outputIp || '',
      targetPort: entry.targetPort || 6454,
      maxPixels: entry.maxPixels,
      buffer: new Uint8Array(entry.maxPixels * 3),
      needsClear,
      routes
    };
  });
  const compiled = { key, width: normalizedWidth, height: normalizedHeight, universes };
  artnetPatchPlanCache.set(patch, compiled);
  return compiled;
}

export function splitRgbByUniverseMap({ rgb = [], universeMap, sequence = 1, physical = 0, fastPath = false } = {}) {
  const bytes = rgb instanceof Uint8Array ? rgb : new Uint8Array(0);
  const map = universeMap || buildDefaultEightStripUniverseMap();
  const universes = map.enabledUniverses || map.universes.filter((entry) => entry.enabled !== false);
  const packets = new Array(universes.length);
  for (let index = 0; index < universes.length; index += 1) {
    const entry = universes[index];
      const globalPixelStart = Number.isFinite(Number(entry.globalPixelStart))
        ? Number(entry.globalPixelStart)
        : entry.strip * map.pixelsPerStrip + entry.startPixel;
      const byteStart = globalPixelStart * 3;
      // STEP22ME: subarray avoids a per-universe allocation; the packet builder
      // copies once into the UDP packet payload.
      const dmx = bytes.subarray(byteStart, byteStart + entry.length * 3);
      packets[index] = (fastPath ? buildReusableArtDmxPacket : buildArtDmxPacket)({
        universe: entry.universe,
        sequence: (sequence + index) & 0xff,
        physical,
        dmx,
        fastPath
      });
  }
  return fastPath ? packets : Object.freeze(packets);
}

export function splitRgbByArtnetPatch({ rgb = [], width = 0, height = 0, patch = null, sequence = 1, physical = 0, fastPath = false } = {}) {
  const bytes = rgb instanceof Uint8Array ? rgb : new Uint8Array(0);
  const plan = getCompiledPatchPlan(patch, width, height);
  if (!plan) return fastPath ? [] : Object.freeze([]);
  const packets = new Array(plan.universes.length);
  for (let index = 0; index < plan.universes.length; index += 1) {
    const entry = plan.universes[index];
    const dst = entry.buffer;
    // Reuse the same universe buffer every frame. Zero only when the compiled
    // patch does not fully overwrite the ArtDMX payload. Full 8x300 mappings
    // cover every byte, so skipping fill removes ~8 kB of writes per frame.
    if (entry.needsClear) dst.fill(0);
    for (const route of entry.routes) {
      if (route.forceBlack) continue;
      if (route.direction === 'forward' && route.identityCorrection && route.colorOrder === 'RGB' && route.validSpan) {
        dst.set(bytes.subarray(route.srcByteStart, route.srcByteStart + route.pixelCount * 3), route.dstByteStart);
        continue;
      }
      for (let i = 0; i < route.pixelCount; i += 1) {
        const physicalSource = route.direction === 'reverse'
          ? Math.max(0, route.physicalPixelCount - 1 - (route.sourcePixelOffset + i))
          : route.sourcePixelOffset + i;
        const srcPixel = route.srcRowOffset + physicalSource;
        if (srcPixel < 0 || srcPixel >= route.totalPixels) continue;
        const srcByte = srcPixel * 3;
        const dstByte = route.dstByteStart + i * 3;
        writeCorrectedPixel(dst, dstByte, bytes[srcByte] || 0, bytes[srcByte + 1] || 0, bytes[srcByte + 2] || 0, route);
      }
    }
    const builtPacket = (fastPath ? buildReusableArtDmxPacket : buildArtDmxPacket)({
      universe: entry.universe,
      sequence: (sequence + index) & 0xff,
      physical,
      dmx: dst,
      fastPath
    });
    packets[index] = entry.outputIp
      ? { ...builtPacket, targetIp: entry.outputIp, host: entry.outputIp, targetPort: entry.targetPort || builtPacket.port || 6454 }
      : builtPacket;
  }
  return fastPath ? packets : Object.freeze(packets);
}

function clampFloat(value, min, max, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
}

function isIdentityCorrection(route) {
  const brightness = clampFloat(route.brightness, 0, 1, 1);
  const gamma = clampFloat(route.gamma, 0.1, 5, 1);
  const contrast = clampFloat(route.contrast, 0, 3, 1);
  const whiteLimit = clampFloat(route.whiteLimit, 0, 1, 1);
  return Math.abs(brightness - 1) < 0.0001
    && Math.abs(gamma - 1) < 0.0001
    && Math.abs(contrast - 1) < 0.0001
    && Math.abs(whiteLimit - 1) < 0.0001;
}

function makeCorrectionLut(route) {
  // STEP37AD: per-frame Math.pow() on every RGB channel was one of the
  // remaining hot spots in live ArtNet output. 8x300 with patch correction
  // means up to 7200 gamma/contrast computations per frame. The route
  // parameters change only when the mapping patch changes, so compile a
  // 256-entry LUT once into the patch plan and use direct table lookups in
  // the 60 FPS path.
  const lut = new Uint8Array(256);
  const contrast = Number(route.contrast ?? 1) || 1;
  const gamma = Math.max(0.1, Number(route.gamma ?? 1) || 1);
  const gain = (Number(route.brightness ?? 1) || 1) * (Number(route.whiteLimit ?? 1) || 1);
  for (let value = 0; value < 256; value += 1) {
    const normalized = value / 255;
    const contrasted = Math.max(0, Math.min(1, ((normalized - 0.5) * contrast) + 0.5));
    const corrected = Math.pow(contrasted, 1 / gamma);
    lut[value] = Math.max(0, Math.min(255, Math.round(corrected * gain * 255)));
  }
  return lut;
}

function writeCorrectedPixel(dst, dstByte, r, g, b, route) {
  const lut = route.correctionLut;
  const rr = lut ? lut[r & 255] : r;
  const gg = lut ? lut[g & 255] : g;
  const bb = lut ? lut[b & 255] : b;
  switch (String(route.colorOrder || 'RGB').toUpperCase()) {
    case 'GRB': dst[dstByte] = gg; dst[dstByte + 1] = rr; dst[dstByte + 2] = bb; break;
    case 'BRG': dst[dstByte] = bb; dst[dstByte + 1] = rr; dst[dstByte + 2] = gg; break;
    case 'RBG': dst[dstByte] = rr; dst[dstByte + 1] = bb; dst[dstByte + 2] = gg; break;
    case 'BGR': dst[dstByte] = bb; dst[dstByte + 1] = gg; dst[dstByte + 2] = rr; break;
    case 'GBR': dst[dstByte] = gg; dst[dstByte + 1] = bb; dst[dstByte + 2] = rr; break;
    default: dst[dstByte] = rr; dst[dstByte + 1] = gg; dst[dstByte + 2] = bb; break;
  }
}

function normalizePatchRoutesForArtNetCapacity(routes = [], patch = {}) {
  const artnetCapacity = clampInt(patch?.pixelsPerUniverse ?? patch?.universeSize ?? 170, 1, 170, 170);
  if (artnetCapacity !== 170 || !Array.isArray(routes) || routes.length < 2) return routes;
  const byStrip = new Map();
  for (const route of routes) {
    if (!route || (route.enabled === false && !route.forceBlack)) continue;
    const stripIndex = clampInt(route.stripIndex, 0, 65535, 0);
    const list = byStrip.get(stripIndex) || [];
    list.push(route);
    byStrip.set(stripIndex, list);
  }
  let repairedAny = false;
  const repaired = [];
  const used = new Set();
  for (const [stripIndex, list] of byStrip.entries()) {
    const sorted = [...list].sort((a, b) => clampInt(a.sourcePixelOffset, 0, 2000000, 0) - clampInt(b.sourcePixelOffset, 0, 2000000, 0));
    const totalPixels = sorted.reduce((sum, route) => sum + clampInt(route.pixelCount, 1, 65535, 1), 0);
    const looksLikeLegacy150 = totalPixels >= 170
      && sorted.length >= 2
      && sorted.every((route, index) => clampInt(route.startAddress, 0, 2000000, 0) === 0
        && clampInt(route.sourcePixelOffset, 0, 2000000, 0) === sorted.slice(0, index).reduce((sum, r) => sum + clampInt(r.pixelCount, 1, 65535, 1), 0)
        && clampInt(route.pixelCount, 1, 65535, 1) <= 150);
    if (!looksLikeLegacy150) continue;
    const baseUniverse = clampInt(sorted[0].universe, 0, 63999, 0);
    let remaining = totalPixels;
    let sourcePixelOffset = 0;
    let universe = baseUniverse;
    while (remaining > 0) {
      const pixelCount = Math.min(remaining, artnetCapacity);
      repaired.push({
        ...sorted[0],
        stripIndex,
        universe,
        startAddress: 0,
        sourcePixelOffset,
        pixelCount,
        universeSize: artnetCapacity
      });
      remaining -= pixelCount;
      sourcePixelOffset += pixelCount;
      universe += 1;
    }
    for (const route of sorted) used.add(route);
    repairedAny = true;
  }
  if (!repairedAny) return routes;
  for (const route of routes) {
    if (!used.has(route)) repaired.push(route);
  }
  return repaired.sort((a, b) => clampInt(a.universe, 0, 63999, 0) - clampInt(b.universe, 0, 63999, 0)
    || clampInt(a.startAddress, 0, 2000000, 0) - clampInt(b.startAddress, 0, 2000000, 0));
}

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}
