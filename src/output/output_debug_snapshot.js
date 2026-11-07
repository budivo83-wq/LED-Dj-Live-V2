function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(num(value) * factor) / factor;
}

export function buildOutputDebugSnapshot({
  render = {},
  output = {},
  artnet = {},
  blx = {},
  watchdog = {},
  queue = {}
} = {}) {
  const outputFps = num(output.fps ?? output.outputFps ?? output.rate?.fps);
  const bytesTx = num(output.bytesTx ?? artnet.bytesTx ?? artnet.packetBytes);
  const universeTx = num(artnet.universeTxPerFrame ?? artnet.packetCount);
  const ackOk = num(blx.ackOk ?? blx.ack?.ackOk);
  const ackTimeout = num(blx.ackTimeout ?? blx.ack?.ackTimeout);
  const ackTotal = ackOk + ackTimeout;
  const ackRate = ackTotal > 0 ? ackOk / ackTotal : 0;
  const droppedFrames = num(output.dropped ?? queue.dropped ?? 0);
  const sentFrames = num(output.sent ?? 0);
  const totalFrames = Math.max(1, sentFrames + droppedFrames);

  return Object.freeze({
    version: "output-debug-snapshot-v1",
    renderFps: round(render.fps ?? render.renderFps),
    outputFps: round(outputFps),
    droppedFrames,
    dropRatio: round(droppedFrames / totalFrames, 4),
    queueDepth: num(queue.depth ?? output.queueDepth),
    latencyMs: round(output.lastLatencyMs ?? output.latencyMs),
    jitterMs: round(output.jitterMs ?? output.driftMs),
    outputLoad: round(output.load ?? artnet.serialLoad ?? 0, 4),
    universeTxPerFrame: universeTx,
    universeTxPerSecond: round(universeTx * outputFps),
    bytesTxPerFrame: bytesTx,
    bytesTxPerSecond: round(bytesTx * outputFps),
    ackRate: round(ackRate, 4),
    ackOk,
    ackTimeout,
    watchdogDecision: String(watchdog.decision || output.watchdogDecision || "IDLE"),
    fallbackActive: Boolean(watchdog.fallback || output.fallbackUsed),
    health: droppedFrames > 0 || ackTimeout > 0 ? "WARN" : "OK"
  });
}
