function nowMs() {
  if (typeof performance !== "undefined" && typeof performance.now === "function") return performance.now();
  return Date.now();
}

function cloneBytes(bytes) {
  if (bytes instanceof Uint8Array) return new Uint8Array(bytes);
  if (bytes instanceof Uint8ClampedArray) return new Uint8Array(bytes);
  if (Array.isArray(bytes)) return Uint8Array.from(bytes);
  return new Uint8Array(0);
}

function makeFramePacket(input = {}) {
  const timestamp = Number.isFinite(input.timestamp) ? Number(input.timestamp) : nowMs();
  const frame = cloneBytes(input.frame || input.payload || input.rgb);
  return Object.freeze({
    frameId: Number.isFinite(input.frameId) ? Number(input.frameId) : 0,
    timestamp,
    fps: Number.isFinite(input.fps) ? Number(input.fps) : 0,
    dropCounter: Number.isFinite(input.dropCounter) ? Number(input.dropCounter) : 0,
    renderTime: Number.isFinite(input.renderTime) ? Number(input.renderTime) : Number(input.renderMs || 0),
    sendTime: Number.isFinite(input.sendTime) ? Number(input.sendTime) : Number(input.sendMs || 0),
    width: Number.isFinite(input.width) ? Number(input.width) : 0,
    height: Number.isFinite(input.height) ? Number(input.height) : 0,
    colorOrder: String(input.colorOrder || "rgb"),
    format: String(input.format || "rgb8"),
    frame,
    byteLength: frame.byteLength,
    meta: Object.freeze({ ...(input.meta && typeof input.meta === "object" ? input.meta : {}) })
  });
}

export function createDoubleFrameBuffer() {
  let frontBuffer = null;
  let backBuffer = null;
  let lastFrameId = 0;
  let swapCount = 0;
  let dropCounter = 0;

  function render(input = {}) {
    const requestedFrameId = Number.isFinite(input.frameId) ? Number(input.frameId) : lastFrameId + 1;
    if (requestedFrameId > lastFrameId + 1 && lastFrameId > 0) dropCounter += requestedFrameId - lastFrameId - 1;
    backBuffer = makeFramePacket({
      ...input,
      frameId: Math.max(lastFrameId + 1, requestedFrameId),
      dropCounter
    });
    return backBuffer;
  }

  function swap() {
    if (!backBuffer) return frontBuffer;
    const next = backBuffer;
    backBuffer = frontBuffer;
    frontBuffer = next;
    lastFrameId = Math.max(lastFrameId, Number(frontBuffer.frameId || 0));
    swapCount += 1;
    return frontBuffer;
  }

  function renderSwap(input = {}) {
    render(input);
    return swap();
  }

  function getStats() {
    return Object.freeze({
      version: "output-core-frame-sync-v1",
      hasFrontBuffer: Boolean(frontBuffer),
      hasBackBuffer: Boolean(backBuffer),
      frontFrameId: Number(frontBuffer?.frameId || 0),
      backFrameId: Number(backBuffer?.frameId || 0),
      byteLength: Number(frontBuffer?.byteLength || 0),
      swapCount,
      dropCounter
    });
  }

  return Object.freeze({
    render,
    swap,
    renderSwap,
    getFrontBuffer: () => frontBuffer,
    getBackBuffer: () => backBuffer,
    getStats
  });
}

export { makeFramePacket };
