import { createBlxOutputAdapter } from "../output/adapters/blx/index.js";

function clampInt(value, min, max, fallback) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function nowMs() {
  return Date.now();
}

function clampByte(value, fallback = 0) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(255, n));
}

export function createBlxControlService(options = {}) {
  const adapter = createBlxOutputAdapter(options);
  const tickHz = clampInt(options.tickHz, 5, 240, 60);
  const tickMs = Math.max(4, Math.round(1000 / tickHz));
  const nodes = new Map();
  let timer = null;

  function step(count = 1) {
    const loops = clampInt(count, 1, 2000, 1);
    for (let i = 0; i < loops; i += 1) adapter.processOne();
    return loops;
  }

  function start() {
    adapter.start();
    if (!timer) {
      timer = setInterval(() => {
        try {
          adapter.processOne();
        } catch {
          // keep control loop alive; errors are exposed through adapter status
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

  function snapshot() {
    return Object.freeze({
      ok: true,
      active: Boolean(timer),
      tickHz,
      tickMs,
      adapter: adapter.getStatus(),
      nodes: Object.freeze(Array.from(nodes.values()))
    });
  }

  function rememberDiscoveredNodes(maxAgeMs = 30_000) {
    const list = adapter.getDiscoveredNodes(maxAgeMs) || [];
    const at = nowMs();
    for (const node of list) {
      const id = `${node.host}:${node.port}`;
      const parsed = node.parsed && typeof node.parsed === "object" ? node.parsed : {};
      nodes.set(id, {
        id,
        host: node.host,
        port: node.port,
        nodeId: Number.isFinite(parsed.nodeId) ? parsed.nodeId : null,
        fwVersion: parsed.fwVersion || "",
        capabilities: Number.isFinite(parsed.capabilities) ? parsed.capabilities : null,
        pixelCount: Number.isFinite(parsed.pixelCount) ? parsed.pixelCount : null,
        advertisedIp: parsed.ip || "",
        fps: Number.isFinite(parsed.fps) ? parsed.fps : null,
        seenAt: node.at || at,
        updatedAt: at,
        raw: node.text || ""
      });
    }
    return list;
  }

  return Object.freeze({
    start,
    stop,
    step,
    snapshot,
    requestCapabilities: () => adapter.requestCapabilities(),
    requestConfig: () => adapter.requestConfig(),
    writeConfig: (payload = {}) => adapter.writeConfig(payload),
    sendClockMaster: (masterTimeUs = 0n) => adapter.sendClockMaster(masterTimeUs),
    sendClockReply: (payload = {}) => adapter.sendClockReply(payload),
    sendCompressedFrame: (payload = {}) => adapter.sendCompressedFrame(payload),
    sendShaderParam: (payload = {}) => adapter.sendShaderParam(payload),
    sendFailoverTarget: (payload = {}) => adapter.sendFailoverTarget(payload),
    pushFrame: (frame = {}) => adapter.pushFrame(frame),
    pushRgbFrame: ({ frameId = 0, rgb = [], brightness = null } = {}) => {
      const bytes = rgb instanceof Uint8Array
        ? rgb
        : Uint8Array.from((Array.isArray(rgb) ? rgb : []).map((v) => clampByte(v, 0)));
      return adapter.pushFrame({
        frameId: Number(frameId) || 0,
        frame: bytes,
        payload: bytes,
        meta: brightness == null ? undefined : { brightness: clampByte(brightness, 255) }
      });
    },
    pushSolidFrame: ({
      frameId = 0,
      pixels = Number(options.pixelCount || 60),
      color = [255, 0, 0],
      brightness = null
    } = {}) => {
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
      return adapter.pushFrame({
        frameId: Number(frameId) || 0,
        frame,
        payload: frame,
        meta: brightness == null ? undefined : { brightness: clampByte(brightness, 255) }
      });
    },
    broadcastDiscovery: (nodeName = "BLX_NODE") => adapter.broadcastDiscovery(nodeName),
    getDiscoveredNodes: (maxAgeMs = 30_000) => {
      rememberDiscoveredNodes(maxAgeMs);
      return Object.freeze(Array.from(nodes.values()));
    }
  });
}
