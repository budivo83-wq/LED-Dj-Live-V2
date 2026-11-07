function nowMs() {
  return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
}

function createWindowedStats() {
  return {
    startedAt: nowMs(),
    count: 0,
    sum: 0,
    max: 0,
    add(value) {
      const v = Math.max(0, Number(value) || 0);
      this.count += 1;
      this.sum += v;
      if (v > this.max) this.max = v;
    },
    avg() {
      return this.count > 0 ? this.sum / this.count : 0;
    }
  };
}

export function createTelemetryCollector() {
  const render = createWindowedStats();
  const map = createWindowedStats();
  const outputSend = createWindowedStats();
  const outputLatency = createWindowedStats();
  const previewPresent = createWindowedStats();

  let frames = 0;
  let dropped = 0;
  let queueDepth = 0;
  let shader = {
    cacheHits: 0,
    cacheMisses: 0,
    compileCount: 0,
    compileFailures: 0,
    avgCompileMs: 0,
    lastCompileMs: 0
  };

  function markFrame() {
    frames += 1;
  }

  function markDropped(count = 1) {
    dropped += Math.max(0, Number(count) || 0);
  }

  function markRenderMs(ms) {
    render.add(ms);
  }

  function markMapMs(ms) {
    map.add(ms);
  }

  function markOutput(status = {}) {
    queueDepth = Number(status.queueDepth || 0);
    outputSend.add(Number(status.lastSendMs || 0));
    outputLatency.add(Number(status.lastLatencyMs || 0));
    dropped = Math.max(dropped, Number(status.dropped || 0));
  }

  function markPreview(ms) {
    previewPresent.add(ms);
  }

  function markShader(stats = {}) {
    shader = {
      cacheHits: Number(stats.cacheHits || 0),
      cacheMisses: Number(stats.cacheMisses || 0),
      compileCount: Number(stats.compileCount || 0),
      compileFailures: Number(stats.compileFailures || 0),
      avgCompileMs: Number(stats.avgCompileMs || 0),
      lastCompileMs: Number(stats.lastCompileMs || 0)
    };
  }

  function snapshot() {
    const elapsed = Math.max(0.001, (nowMs() - render.startedAt) / 1000);
    return {
      fps: frames / elapsed,
      frames,
      dropped,
      queueDepth,
      renderAvgMs: render.avg(),
      renderMaxMs: render.max,
      mapAvgMs: map.avg(),
      mapMaxMs: map.max,
      outputSendAvgMs: outputSend.avg(),
      outputSendMaxMs: outputSend.max,
      outputLatencyAvgMs: outputLatency.avg(),
      outputLatencyMaxMs: outputLatency.max,
      previewAvgMs: previewPresent.avg(),
      previewMaxMs: previewPresent.max,
      shader
    };
  }

  return {
    markFrame,
    markDropped,
    markRenderMs,
    markMapMs,
    markOutput,
    markPreview,
    markShader,
    snapshot
  };
}
