import { buildArtSyncPacket, buildDefaultEightStripUniverseMap, splitRgbByArtnetPatch, splitRgbByUniverseMap } from './artnet_core.js';

export const STEP22DO_ARTNET_TX_VERSION = 'STEP22DO_ARTNET_TX_FOUNDATION';

const defaultMapCache = new Map();

export function buildStep22DoDefaultMap(options = {}) {
  const stripCount = clampInt(options.stripCount, 1, 64, 8);
  const pixelsPerStrip = clampInt(options.pixelsPerStrip, 1, 1000, 300);
  const pixelsPerUniverse = clampInt(options.pixelsPerUniverse, 1, 170, 170);
  const startUniverse = clampInt(options.startUniverse, 0, 32767, 0);
  const outputIp = String(options.outputIp || options.host || '2.1.1.30');
  const enabled = options.enabled !== false;
  const key = `${stripCount}|${pixelsPerStrip}|${pixelsPerUniverse}|${startUniverse}|${outputIp}|${enabled ? 1 : 0}`;
  const cached = defaultMapCache.get(key);
  if (cached) return cached;
  const built = buildDefaultEightStripUniverseMap({
    stripCount,
    pixelsPerStrip,
    pixelsPerUniverse,
    startUniverse,
    outputIp,
    enabled
  });
  defaultMapCache.set(key, built);
  return built;
}

export function artnetFrameBudget({ stripCount = 8, pixelsPerStrip = 300, pixelsPerUniverse = 170, fps = 60, artSync = true } = {}) {
  const map = buildStep22DoDefaultMap({ stripCount, pixelsPerStrip, pixelsPerUniverse });
  const universePackets = map.universeCount;
  const syncPackets = artSync ? 1 : 0;
  const packetsPerFrame = universePackets + syncPackets;
  const artDmxPacketBytes = 18 + Math.min(512, pixelsPerUniverse * 3);
  const syncPacketBytes = artSync ? buildArtSyncPacket().packetBytes : 0;
  const frameBytes = universePackets * artDmxPacketBytes + syncPacketBytes;
  const safeFps = clampInt(fps, 1, 120, 60);
  return Object.freeze({
    version: STEP22DO_ARTNET_TX_VERSION,
    stripCount: map.stripCount,
    pixelsPerStrip: map.pixelsPerStrip,
    totalPixels: map.totalPixels,
    pixelsPerUniverse: map.pixelsPerUniverse,
    universeCount: map.universeCount,
    packetsPerFrame,
    artSync: Boolean(artSync),
    bytesPerFrame: frameBytes,
    fps: safeFps,
    packetsPerSecond: packetsPerFrame * safeFps,
    bytesPerSecond: frameBytes * safeFps,
    megabitPerSecondApprox: Number(((frameBytes * safeFps * 8) / 1000000).toFixed(3))
  });
}

export function buildArtnetDryRunFrame({ rgb, stripCount = 8, pixelsPerStrip = 300, pixelsPerUniverse = 170, startUniverse = 0, outputIp = '2.1.1.30', sequence = 1, artSync = true, artnetPatch = null, width = null, height = null, fastPath = false, includeMap = true, requireExplicitPatch = false } = {}) {
  const map = buildStep22DoDefaultMap({ stripCount, pixelsPerStrip, pixelsPerUniverse, startUniverse, outputIp });
  const expectedBytes = map.totalPixels * 3;
  const bytes = normalizeRgb(rgb, expectedBytes);
  const patchWidth = clampInt(width, 1, 65535, pixelsPerStrip);
  const patchHeight = clampInt(height, 1, 65535, stripCount);
  const hasExplicitPatch = Array.isArray(artnetPatch?.routes) && artnetPatch.routes.length > 0;
  const packets = hasExplicitPatch
    ? splitRgbByArtnetPatch({
        rgb: bytes,
        width: patchWidth,
        height: patchHeight,
        patch: artnetPatch,
        sequence,
        fastPath
      })
    : (requireExplicitPatch ? (fastPath ? [] : Object.freeze([])) : splitRgbByUniverseMap({ rgb: bytes, universeMap: map, sequence, fastPath }));
  const sync = artSync ? buildArtSyncPacket() : null;
  const syncPackets = (sync && packets.length) ? buildArtSyncPacketsForPacketTargets(packets, sync, outputIp) : [];
  const packetList = artSync
    ? (fastPath ? (() => { for (const syncPacket of syncPackets) packets.push(syncPacket); return packets; })() : [...packets, ...syncPackets])
    : packets;
  const out = {
    ok: true,
    version: STEP22DO_ARTNET_TX_VERSION,
    inputBytes: bytes.length,
    expectedRgbBytes: expectedBytes,
    packets: packetList,
    summary: {
      firstUniverse: packets[0]?.universe ?? null,
      lastUniverse: packets[packets.length - 1]?.universe ?? null,
      artDmxPackets: packets.length,
      totalPackets: packetList.length,
      firstPacketBytes: packets[0]?.packetBytes ?? 0,
      syncPacket: Boolean(sync),
      syncPacketBytes: sync?.packetBytes || 0
    }
  };
  if (includeMap) {
    out.map = artnetPatch?.routes?.length
      ? {
          ...map,
          mode: 'artnet-patch-v1',
          width: patchWidth,
          height: patchHeight,
          routeCount: artnetPatch.routes.length,
          explicitOnly: Boolean(requireExplicitPatch)
        }
      : map;
  } else {
    out.map = null;
  }
  if (fastPath) return out;
  if (artSync) Object.freeze(packetList);
  Object.freeze(out.summary);
  return Object.freeze(out);
}


function buildArtSyncPacketsForPacketTargets(packets = [], sync = null, fallbackHost = '') {
  if (!sync) return [];
  const targets = new Map();
  for (const packet of packets || []) {
    const host = String(packet?.targetIp || packet?.host || fallbackHost || '').trim();
    const port = clampInt(packet?.targetPort || packet?.port || sync.port || 6454, 1, 65535, 6454);
    const key = `${host || '__default__'}:${port}`;
    if (!targets.has(key)) targets.set(key, { host, port });
  }
  if (!targets.size) targets.set(`${String(fallbackHost || '').trim() || '__default__'}:${sync.port || 6454}`, { host: String(fallbackHost || '').trim(), port: sync.port || 6454 });
  return [...targets.values()].map((target) => target.host
    ? { ...sync, targetIp: target.host, host: target.host, targetPort: target.port, port: target.port }
    : { ...sync, targetPort: target.port, port: target.port });
}

export function buildStep22DoPlan(options = {}) {
  const target = {
    host: String(options.host || options.outputIp || '2.1.1.30'),
    port: clampInt(options.port, 1, 65535, 6454)
  };
  const map = buildStep22DoDefaultMap({ ...options, outputIp: target.host });
  const budget = artnetFrameBudget({
    stripCount: map.stripCount,
    pixelsPerStrip: map.pixelsPerStrip,
    pixelsPerUniverse: map.pixelsPerUniverse,
    fps: options.fps ?? 60,
    artSync: options.artSync !== false
  });
  return Object.freeze({
    ok: true,
    version: STEP22DO_ARTNET_TX_VERSION,
    mode: 'artnet-tx-dry-foundation',
    target,
    map,
    budget,
    liveRules: Object.freeze([
      'ArtNet TX uses 150 pixels per universe for clean 450-byte DMX payloads.',
      'Default 8x300 layout maps to 16 ArtDmx packets plus one ArtSync packet per frame.',
      'UDP ArtNet is the preferred 60 FPS path for full 8x300; raw serial 4x300 stays capped by baudrate.',
      'Live send should stay behind arm gate until node target and universe mapping are verified.'
    ])
  });
}

function normalizeRgb(rgb, expectedBytes) {
  if (rgb instanceof Uint8Array) {
    if (rgb.length === expectedBytes) return rgb;
    const out = new Uint8Array(expectedBytes);
    out.set(rgb.slice(0, expectedBytes));
    return out;
  }
  const out = new Uint8Array(expectedBytes);
  if (Array.isArray(rgb)) {
    for (let i = 0; i < Math.min(rgb.length, expectedBytes); i += 1) out[i] = clampByte(rgb[i]);
  }
  return out;
}

function clampByte(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(255, Math.round(n)));
}

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}
