export const STEP22EJ_ARTNET_MASTER_FRAME_VERSION = 'STEP22EJ_ARTNET_MASTER_FRAMEBUS_BRIDGE';


const GENERATOR_LIVE_SOURCE_PREFIX_38L = 'generator-live-master-frame';
const GENERATOR_LIVE_SUPPRESS_PERFORMANCE_MS_38L = 1500;

function classifyMasterFrameSource38L(source = '') {
  const value = String(source || '').trim().toLowerCase();
  const isGenerator = value.includes(GENERATOR_LIVE_SOURCE_PREFIX_38L) || value.includes('generator-live-master');
  const isPerformance = value.includes('performance-framebus')
    || value.includes('performance-master')
    || value.includes('artnet-master-framebus-mirror')
    || value.includes('browser-master-frame')
    || value.includes('render-pipeline')
    || value.includes('output-owned-render');
  return { value, isGenerator, isPerformance };
}

function shouldDropForGeneratorLiveOwner38L({ latest = null, source = '', now = Date.now(), sourceBytes = 0 } = {}) {
  const incoming = classifyMasterFrameSource38L(source);
  const active = classifyMasterFrameSource38L(latest?.source || '');
  const ageMs = latest ? now - Number(latest.publishedAt || latest.wallClock || 0) : Infinity;
  if (incoming.isPerformance && active.isGenerator && ageMs >= 0 && ageMs <= GENERATOR_LIVE_SUPPRESS_PERFORMANCE_MS_38L) {
    return {
      drop: true,
      reason: 'generator-live-master-owner-active-38l',
      activeSource: latest.source,
      incomingSource: source,
      activeAgeMs: ageMs,
      byteLength: sourceBytes
    };
  }
  return { drop: false, reason: 'allowed' };
}

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function clampFloat(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function expectedBytes(options = {}) {
  const strips = clampInt(options.stripCount, 1, 64, 8);
  const pixels = clampInt(options.pixelsPerStrip, 1, 1000, 300);
  return strips * pixels * 3;
}

function inferStripCount(input, fallback) {
  return clampInt(input.stripCount ?? input.height ?? fallback, 1, 64, fallback || 8);
}

function inferPixelsPerStrip(input, fallback) {
  return clampInt(input.pixelsPerStrip ?? input.width ?? fallback, 1, 1000, fallback || 300);
}

function normalizeFrameBytes(input, options = {}) {
  const expected = expectedBytes(options);
  let src = input instanceof Uint8Array ? input : new Uint8Array(input || []);
  if (src.byteLength === expected) return { frame: src, adapted: false, sourceBytes: src.byteLength, expectedBytes: expected };
  const out = new Uint8Array(expected);
  out.set(src.subarray(0, Math.min(src.byteLength, expected)), 0);
  return { frame: out, adapted: true, sourceBytes: src.byteLength, expectedBytes: expected };
}

export function createArtNetMasterFrameStore22EJ(defaults = {}) {
  const state = {
    latest: null,
    latestPatch: null,
    publishCount: 0,
    droppedCount: 0,
    duplicateCount: 0,
    lastError: null,
    arbitrationDropCount38L: 0,
    lastArbitrationDrop38L: null,
    defaults: { stripCount: 8, pixelsPerStrip: 300, ...defaults }
  };

  function publish(input = {}) {
    try {
      const bytes = input.frame instanceof Uint8Array ? input.frame : new Uint8Array(input.frame || []);
      const stripCount = inferStripCount(input, state.defaults.stripCount);
      const pixelsPerStrip = inferPixelsPerStrip(input, state.defaults.pixelsPerStrip);
      const normalized = normalizeFrameBytes(bytes, { stripCount, pixelsPerStrip });
      const now = Date.now();
      const frameId = Number(input.frameId || 0);
      const source = String(input.source || 'performance-framebus-artnet-mirror');
      const arbitration38L = shouldDropForGeneratorLiveOwner38L({ latest: state.latest, source, now, sourceBytes: normalized.frame.byteLength });
      if (arbitration38L.drop) {
        state.arbitrationDropCount38L += 1;
        state.droppedCount += 1;
        state.lastArbitrationDrop38L = Object.freeze({ ...arbitration38L, at: now });
        return { ...status(), ok: true, accepted: false, dropped: true, blocked: true, reason: arbitration38L.reason, arbitration38L: state.lastArbitrationDrop38L };
      }
      // STEP22MA: de-duplicate repeated browser mirror uploads of the exact same
      // frame. The server ArtNet sender is the only UDP writer; this protects
      // the master store from event+poll double publications during preview boot.
      if (state.latest
        && frameId > 0
        && Number(state.latest.frameId || 0) === frameId
        && String(state.latest.source || '') === source
        && Number(state.latest.byteLength || 0) === normalized.frame.byteLength
        && now - Number(state.latest.publishedAt || 0) < 250) {
        state.duplicateCount += 1;
        return status();
      }
      state.publishCount += 1;
      state.latest = Object.freeze({
        ok: true,
        version: STEP22EJ_ARTNET_MASTER_FRAME_VERSION,
        frame: normalized.frame,
        frameId: frameId || state.publishCount,
        source,
        format: String(input.format || 'rgb8'),
        colorOrder: String(input.colorOrder || 'rgb'),
        width: pixelsPerStrip,
        height: stripCount,
        stripCount,
        pixelsPerStrip,
        byteLength: normalized.frame.byteLength,
        sourceBytes: normalized.sourceBytes,
        expectedBytes: normalized.expectedBytes,
        adapted: normalized.adapted,
        publishedAt: now,
        wallClock: now
      });
      state.lastError = null;
      return status();
    } catch (error) {
      state.lastError = error?.message || String(error);
      state.droppedCount += 1;
      return { ...status(), ok: false, error: state.lastError };
    }
  }


  function publishFast(input = {}) {
    // STEP22NO: low-latency WS master path. Same normalization rules as publish(),
    // but no full status object / nested freeze tree on every 60 FPS frame.
    try {
      const bytes = input.frame instanceof Uint8Array ? input.frame : new Uint8Array(input.frame || []);
      const stripCount = inferStripCount(input, state.defaults.stripCount);
      const pixelsPerStrip = inferPixelsPerStrip(input, state.defaults.pixelsPerStrip);
      const normalized = normalizeFrameBytes(bytes, { stripCount, pixelsPerStrip });
      const now = Date.now();
      const frameId = Number(input.frameId || 0);
      const source = String(input.source || 'performance-framebus-artnet-mirror');
      const arbitration38L = shouldDropForGeneratorLiveOwner38L({ latest: state.latest, source, now, sourceBytes: normalized.frame.byteLength });
      if (arbitration38L.drop) {
        state.arbitrationDropCount38L += 1;
        state.droppedCount += 1;
        state.lastArbitrationDrop38L = { ...arbitration38L, at: now };
        return { ok: true, accepted: false, dropped: true, blocked: true, reason: arbitration38L.reason, arbitration38L: state.lastArbitrationDrop38L };
      }
      if (state.latest
        && frameId > 0
        && Number(state.latest.frameId || 0) === frameId
        && String(state.latest.source || '') === source
        && Number(state.latest.byteLength || 0) === normalized.frame.byteLength
        && now - Number(state.latest.publishedAt || 0) < 250) {
        state.duplicateCount += 1;
        return { ok: true, duplicate: true, frameId };
      }
      state.publishCount += 1;
      // STEP37AH: publishFast is called for every browser master frame. Reuse
      // the latest metadata object instead of allocating a fresh object 60×/s;
      // consumers that need an immutable snapshot use getLatest()/status().
      const latest = state.latest && !Object.isFrozen(state.latest) ? state.latest : {};
      latest.ok = true;
      latest.version = STEP22EJ_ARTNET_MASTER_FRAME_VERSION;
      latest.frame = normalized.frame;
      latest.frameId = frameId || state.publishCount;
      latest.source = source;
      latest.format = String(input.format || 'rgb8');
      latest.colorOrder = String(input.colorOrder || 'rgb');
      latest.width = pixelsPerStrip;
      latest.height = stripCount;
      latest.stripCount = stripCount;
      latest.pixelsPerStrip = pixelsPerStrip;
      latest.byteLength = normalized.frame.byteLength;
      latest.sourceBytes = normalized.sourceBytes;
      latest.expectedBytes = normalized.expectedBytes;
      latest.adapted = normalized.adapted;
      latest.publishedAt = now;
      latest.wallClock = now;
      state.latest = latest;
      state.lastError = null;
      return { ok: true, frameId: state.latest.frameId, byteLength: state.latest.byteLength, publishCount: state.publishCount };
    } catch (error) {
      state.lastError = error?.message || String(error);
      state.droppedCount += 1;
      return { ok: false, error: state.lastError };
    }
  }

  function publishPatch(input = {}) {
    try {
      const rawRoutes = Array.isArray(input.artnetPatch?.routes) ? input.artnetPatch.routes : (Array.isArray(input.routes) ? input.routes : []);
      const routes = rawRoutes.filter((route) => {
        const target = String(route?.outputIp || route?.targetIp || route?.ip || route?.host || '').trim();
        if (!target || target.toLowerCase() === 'default') return false;
        if (route?.enabled === false && !route?.forceBlack) return false;
        return true;
      });
      const now = Date.now();
      state.latestPatch = Object.freeze({
        ok: true,
        version: String(input.version || 'artnet-patch-v1'),
        source: String(input.source || 'mapping-v2-artnet-patch'),
        width: clampInt(input.width, 1, 65535, 8),
        height: clampInt(input.height, 1, 65535, 300),
        totalPixels: clampInt(input.totalPixels, 1, 100000000, Math.max(1, routes.length)),
        routes: Object.freeze(routes.map((route) => Object.freeze({
          segmentId: String(route.segmentId || route.parentSegmentId || ''),
          parentSegmentId: String(route.parentSegmentId || route.segmentId || ''),
          stripIndex: clampInt(route.stripIndex, 0, 65535, 0),
          universe: clampInt(route.universe, 0, 63999, 0),
          startAddress: clampInt(route.startAddress, 0, 2000000, 0),
          sourcePixelOffset: clampInt(route.sourcePixelOffset, 0, 2000000, 0),
          pixelCount: clampInt(route.pixelCount, 1, 65535, 1),
          universeSize: clampInt(route.universeSize, 1, 170, 170),
          physicalPixelCount: clampInt(route.physicalPixelCount, 1, 65535, route.pixelCount),
          direction: String(route.direction || 'forward').toLowerCase() === 'reverse' ? 'reverse' : 'forward',
          colorOrder: String(route.colorOrder || 'RGB').toUpperCase(),
          brightness: clampFloat(route.brightness, 0, 1, 1),
          gamma: clampFloat(route.gamma, 0.1, 5, 1),
          contrast: clampFloat(route.contrast, 0, 3, 1),
          whiteLimit: clampFloat(route.whiteLimit, 0, 1, 1),
          enabled: route.enabled !== false,
          forceBlack: Boolean(route.forceBlack),
          outputIp: String(route.outputIp || route.targetIp || route.ip || route.host || ''),
          targetIp: String(route.outputIp || route.targetIp || route.ip || route.host || ''),
          port: clampInt(route.port || route.targetPort, 1, 65535, 6454),
          targetPort: clampInt(route.port || route.targetPort, 1, 65535, 6454)
        }))),
        publishedAt: now
      });
      return status();
    } catch (error) {
      state.lastError = error?.message || String(error);
      return { ...status(), ok: false, error: state.lastError };
    }
  }

  function getLatest(options = {}) {
    const maxAgeMs = clampInt(options.maxAgeMs, 50, 30000, 1500);
    const now = Date.now();
    const latest = state.latest;
    if (!latest) return null;
    const ageMs = now - Number(latest.publishedAt || 0);
    if (ageMs > maxAgeMs) return null;
    const normalized = normalizeFrameBytes(latest.frame, {
      stripCount: options.stripCount ?? latest.stripCount,
      pixelsPerStrip: options.pixelsPerStrip ?? latest.pixelsPerStrip
    });
    return Object.freeze({
      ...latest,
      frame: normalized.frame,
      byteLength: normalized.frame.byteLength,
      ageMs,
      adaptedForOutput: normalized.adapted || latest.adapted,
      artnetPatch: state.latestPatch
    });
  }

  function status() {
    const now = Date.now();
    const latest = state.latest;
    const ageMs = latest ? now - Number(latest.publishedAt || 0) : null;
    return Object.freeze({
      ok: true,
      version: STEP22EJ_ARTNET_MASTER_FRAME_VERSION,
      hasFrame: Boolean(latest),
      hasPatch: Boolean(state.latestPatch),
      fresh: Boolean(latest && ageMs <= 1500),
      patchAgeMs: state.latestPatch ? now - Number(state.latestPatch.publishedAt || 0) : null,
      ageMs,
      publishCount: state.publishCount,
      droppedCount: state.droppedCount,
      duplicateCount: state.duplicateCount,
      arbitrationDropCount38L: state.arbitrationDropCount38L,
      generatorLiveSuppressMs38L: GENERATOR_LIVE_SUPPRESS_PERFORMANCE_MS_38L,
      lastArbitrationDrop38L: state.lastArbitrationDrop38L ? Object.freeze({ ...state.lastArbitrationDrop38L }) : null,
      lastError: state.lastError,
      latest: latest ? Object.freeze({
        frameId: latest.frameId,
        source: latest.source,
        width: latest.width,
        height: latest.height,
        stripCount: latest.stripCount,
        pixelsPerStrip: latest.pixelsPerStrip,
        byteLength: latest.byteLength,
        sourceBytes: latest.sourceBytes,
        expectedBytes: latest.expectedBytes,
        adapted: latest.adapted,
        publishedAt: latest.publishedAt
      }) : null,
      latestPatch: state.latestPatch ? Object.freeze({
        version: state.latestPatch.version,
        source: state.latestPatch.source,
        width: state.latestPatch.width,
        height: state.latestPatch.height,
        totalPixels: state.latestPatch.totalPixels,
        routeCount: state.latestPatch.routes.length,
        publishedAt: state.latestPatch.publishedAt
      }) : null
    });
  }

  function getLatestPatch() {
    return state.latestPatch || null;
  }

  return Object.freeze({ publish, publishFast, publishPatch, getLatest, getLatestPatch, status });
}

export const artnetMasterFrameStore22EJ = createArtNetMasterFrameStore22EJ();
