const DEFAULT_HISTORY_LIMIT = 360;

function roundNumber(value, decimals = 3) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  const factor = 10 ** decimals;
  return Math.round(number * factor) / factor;
}

function safeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function pushRing(buffer, value, limit) {
  buffer.push(value);
  while (buffer.length > limit) buffer.shift();
}

function getTimestamp(performanceRef) {
  if (performanceRef?.now) return performanceRef.now();
  return Date.now();
}

function createBucketSummary(values) {
  const clean = values.map(safeNumber).filter((value) => Number.isFinite(value));
  if (!clean.length) return { count: 0, min: 0, avg: 0, max: 0, last: 0 };
  const sum = clean.reduce((acc, value) => acc + value, 0);
  return {
    count: clean.length,
    min: roundNumber(Math.min(...clean)),
    avg: roundNumber(sum / clean.length),
    max: roundNumber(Math.max(...clean)),
    last: roundNumber(clean[clean.length - 1])
  };
}

export function createTelemetryHistory(options = {}) {
  const {
    performanceRef = globalThis.performance,
    limit = DEFAULT_HISTORY_LIMIT
  } = options;

  const samples = [];

  function record(kind, payload = {}) {
    const sample = {
      kind: String(kind || payload.kind || "sample"),
      timestamp: getTimestamp(performanceRef),
      ...payload
    };
    pushRing(samples, sample, Math.max(1, Number(limit || DEFAULT_HISTORY_LIMIT)));
    return sample;
  }

  function getSamples(kind = null) {
    const list = kind ? samples.filter((sample) => sample.kind === kind) : samples;
    return list.map((sample) => ({ ...sample }));
  }

  function summarize() {
    const render = samples.filter((sample) => sample.kind === "render");
    const output = samples.filter((sample) => sample.kind === "output");
    const outputTick = samples.filter((sample) => sample.kind === "outputTick");
    const ui = samples.filter((sample) => sample.kind === "uiSync" || sample.kind === "debugSync");
    const droppedTotal = output.reduce((sum, sample) => sum + safeNumber(sample.dropped), 0)
      + render.reduce((sum, sample) => sum + safeNumber(sample.skipped), 0);

    return {
      limit: Math.max(1, Number(limit || DEFAULT_HISTORY_LIMIT)),
      count: samples.length,
      renderMs: createBucketSummary(render.map((sample) => sample.renderMs)),
      renderLateMs: createBucketSummary(render.map((sample) => sample.lateByMs)),
      outputLatencyMs: createBucketSummary(output.map((sample) => sample.latencyMs)),
      outputTickMs: createBucketSummary(outputTick.map((sample) => sample.tickMs)),
      outputDriftMs: createBucketSummary(outputTick.map((sample) => sample.driftMs)),
      uiMs: createBucketSummary(ui.map((sample) => sample.elapsedMs)),
      droppedTotal: roundNumber(droppedTotal, 0)
    };
  }

  function snapshot(options = {}) {
    const recentLimit = Math.max(0, Number(options.recentLimit ?? 90));
    return {
      summary: summarize(),
      recent: recentLimit ? getSamples().slice(-recentLimit) : []
    };
  }

  function reset() {
    samples.length = 0;
  }

  return {
    record,
    snapshot,
    summarize,
    reset,
    getSamples
  };
}
