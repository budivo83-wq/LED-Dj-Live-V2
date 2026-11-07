const DEFAULT_LIMIT = 12;

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function round(value, decimals = 2) {
  const number = safeNumber(value);
  const factor = 10 ** decimals;
  return Math.round(number * factor) / factor;
}

function phaseFromSample(sample) {
  const kind = String(sample?.kind || "sample");
  if (kind === "render") {
    return {
      lane: "RENDER",
      status: safeNumber(sample.skipped) > 0 ? "WARN" : "OK",
      detail: `render ${round(sample.renderMs)}ms | preview ${round(sample.previewDrawMs)}ms | late ${round(sample.lateByMs)}ms`
    };
  }
  if (kind === "output") {
    return {
      lane: "OUTPUT",
      status: safeNumber(sample.dropped) > 0 ? "WARN" : "OK",
      detail: `lat ${round(sample.latencyMs)}ms | send ${round(sample.sendMs)}ms | q ${safeNumber(sample.queueDepth)}`
    };
  }
  if (kind === "outputTick") {
    const drift = safeNumber(sample.driftMs);
    return {
      lane: "TICK",
      status: Math.abs(drift) > 5 ? "WARN" : "OK",
      detail: `tick ${round(sample.tickMs)}ms | drift ${round(drift)}ms`
    };
  }
  if (kind === "uiSync" || kind === "debugSync") {
    return {
      lane: kind === "debugSync" ? "DEBUG" : "UI",
      status: safeNumber(sample.elapsedMs) > 8 ? "WARN" : "OK",
      detail: `${kind} ${round(sample.elapsedMs)}ms`
    };
  }
  return {
    lane: kind.toUpperCase(),
    status: "OK",
    detail: kind
  };
}

function rowId(sample, index) {
  const timestamp = Math.round(safeNumber(sample?.timestamp));
  return `${timestamp || index}-${String(sample?.kind || "sample")}-${index}`;
}

export function buildTelemetryTimeline(telemetry, options = {}) {
  const limit = Math.max(1, Number(options.limit || DEFAULT_LIMIT));
  const recent = Array.isArray(telemetry?.history?.recent)
    ? telemetry.history.recent
    : Array.isArray(telemetry?.recentSamples)
      ? telemetry.recentSamples
      : [];
  const sliced = recent.slice(-limit);
  return sliced.map((sample, index) => {
    const phase = phaseFromSample(sample);
    return {
      id: rowId(sample, index),
      ageMs: Math.max(0, Math.round(safeNumber(telemetry?.timestamp) - safeNumber(sample?.timestamp))),
      kind: String(sample?.kind || "sample"),
      timestamp: safeNumber(sample?.timestamp),
      ...phase
    };
  });
}

export function renderTelemetryTimelineRows(container, timeline) {
  if (!container) return;
  const rows = Array.isArray(timeline) ? timeline : [];
  const html = !rows.length
    ? `<div class="debug-timeline-empty">timeline čeká na runtime samples</div>`
    : rows.map((row) => {
      const status = String(row.status || "OK").toLowerCase();
      return `<div class="debug-timeline-row debug-timeline-${status}">
        <span class="debug-timeline-dot" aria-hidden="true"></span>
        <strong>${escapeHtml(row.lane)}</strong>
        <span>${escapeHtml(row.detail)}</span>
        <small>${Number(row.ageMs || 0)}ms ago</small>
      </div>`;
    }).join("");
  if (container.__budilightTimelineHtml37DB !== html) {
    container.__budilightTimelineHtml37DB = html;
    container.innerHTML = html;
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
