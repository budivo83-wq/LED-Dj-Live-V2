import { createArtnetOutputAdapter } from "../output/adapters/artnet/index.js";

function clampInt(value, min, max, fallback) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function clampByte(value, fallback = 0) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(255, n));
}

export function createArtnetControlService(options = {}) {
  const adapter = createArtnetOutputAdapter(options);
  const tickHz = clampInt(options.tickHz, 5, 240, 60);
  const tickMs = Math.max(4, Math.round(1000 / tickHz));
  let timer = null;

  function start() {
    adapter.start();
    if (!timer) {
      timer = setInterval(() => {
        try {
          adapter.processOne();
        } catch {
          // keep loop alive
        }
      }, tickMs);
      timer.unref?.();
    }
    return snapshot();
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
    adapter.stop();
    return snapshot();
  }

  function step(count = 1) {
    const loops = clampInt(count, 1, 2000, 1);
    for (let i = 0; i < loops; i += 1) adapter.processOne();
    return loops;
  }

  function pushRgbFrame({ frameId = 0, rgb = [] } = {}) {
    const frame = rgb instanceof Uint8Array ? rgb : Uint8Array.from((Array.isArray(rgb) ? rgb : []).map((v) => clampByte(v, 0)));
    return adapter.pushFrame({ frameId: Number(frameId) || 0, frame, payload: frame });
  }

  function pushSolidFrame({ frameId = 0, pixels = Number(options.pixelCount || 60), color = [255, 0, 0] } = {}) {
    const px = clampInt(pixels, 1, 10000, Number(options.pixelCount || 60));
    const r = clampByte(color?.[0], 255);
    const g = clampByte(color?.[1], 0);
    const b = clampByte(color?.[2], 0);
    const frame = new Uint8Array(px * 3);
    for (let i = 0; i < px; i += 1) {
      const o = i * 3;
      frame[o] = r;
      frame[o + 1] = g;
      frame[o + 2] = b;
    }
    return adapter.pushFrame({ frameId: Number(frameId) || 0, frame, payload: frame });
  }

  function snapshot() {
    return Object.freeze({
      ok: true,
      active: Boolean(timer),
      tickHz,
      tickMs,
      adapter: adapter.getStatus()
    });
  }

  return Object.freeze({
    start,
    stop,
    step,
    snapshot,
    pushRgbFrame,
    pushSolidFrame
    ,
    configureTarget: ({ host = "", port = 0 } = {}) => {
      if (typeof adapter.setTarget === "function") {
        return adapter.setTarget({ host, port });
      }
      return { host, port };
    },
    discoverNodes: () => (typeof adapter.discoverNodes === "function" ? adapter.discoverNodes() : false),
    getDiscoveredNodes: (maxAgeMs = 30000) => (typeof adapter.getDiscoveredNodes === "function" ? adapter.getDiscoveredNodes(maxAgeMs) : []),
    validateTarget: ({ host = options.host || "127.0.0.1", port = options.port || 6454, map = options.map || {} } = {}) => {
      const issues = [];
      const hostText = String(host || "").trim();
      if (!hostText) issues.push("TARGET_HOST_MISSING");
      const portNum = Number(port);
      if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) issues.push("TARGET_PORT_INVALID");
      const stripCount = Number(map?.stripCount ?? options.map?.stripCount ?? 1);
      const pixelsPerStrip = Number(map?.pixelsPerStrip ?? options.map?.pixelsPerStrip ?? 300);
      const pixelsPerUniverse = Number(map?.pixelsPerUniverse ?? options.map?.pixelsPerUniverse ?? 170);
      if (!Number.isInteger(stripCount) || stripCount <= 0) issues.push("MAP_STRIP_COUNT_INVALID");
      if (!Number.isInteger(pixelsPerStrip) || pixelsPerStrip <= 0) issues.push("MAP_PIXELS_PER_STRIP_INVALID");
      if (!Number.isInteger(pixelsPerUniverse) || pixelsPerUniverse <= 0 || pixelsPerUniverse > 170) issues.push("MAP_PIXELS_PER_UNIVERSE_INVALID");
      return Object.freeze({
        ok: issues.length === 0,
        host: hostText,
        port: portNum,
        issues: Object.freeze(issues),
        universeEstimate: issues.length === 0 ? Math.ceil((stripCount * pixelsPerStrip) / pixelsPerUniverse) : 0
      });
    }
  });
}
