export const LIVE_OUTPUT_SEND_HISTORY_VERSION = "12T-output-send-history-diagnostics";

const DEFAULT_LIMIT = 16;

function nowIso() {
  return new Date().toISOString();
}

function compactResult(result = {}) {
  const request = result.request || result.bridgeRequest || result.outputSmokeTest?.request || {};
  const driverBridge = result.driverBridge || result.outputDriverBridge || {};
  const transportKind = String(result.transportKind || request.transportKind || driverBridge.request?.transportKind || "unknown");
  const status = String(result.status || result.decision || "UNKNOWN").toUpperCase();
  const decision = String(result.decision || status);
  const dryRun = Boolean(result.dryRunOnly ?? request.dryRun ?? driverBridge.dryRunOnly ?? true);
  const packetCount = Number(result.packetCount ?? driverBridge.packetCount ?? 0);
  const packetBytes = Number(result.packetBytes ?? driverBridge.packetBytes ?? 0);
  const serialTouched = Boolean(result.serialTouched || driverBridge.serialTouched);
  const networkTouched = Boolean(result.networkTouched || driverBridge.networkTouched);
  const outputTouched = Boolean(result.outputTouched || driverBridge.outputTouched);
  const blocked = Array.isArray(result.blocked) ? result.blocked : [];
  const warnings = Array.isArray(result.warnings) ? result.warnings : [];
  const target = transportKind === "serial"
    ? String(request.serialPath || driverBridge.request?.serialPath || "serial:missing")
    : `${String(request.host || driverBridge.request?.host || "artnet:missing")}:${Number(request.artnetPort || driverBridge.request?.artnetPort || 6454)}/u${Number(request.universe || driverBridge.request?.universe || 0)}`;
  return Object.freeze({
    at: nowIso(),
    version: LIVE_OUTPUT_SEND_HISTORY_VERSION,
    transportKind,
    target,
    status,
    decision,
    dryRun,
    packetCount,
    packetBytes,
    serialTouched,
    networkTouched,
    outputTouched,
    physicalWrite: outputTouched && !dryRun,
    pattern: String(request.pattern || driverBridge.request?.pattern || "?"),
    pixels: Number(request.pixels || driverBridge.request?.pixels || 0),
    frames: Number(request.frames || driverBridge.request?.frames || 0),
    brightness: Number(request.brightness || driverBridge.request?.brightness || 0),
    blocked: Object.freeze(blocked.slice(0, 8)),
    warnings: Object.freeze(warnings.slice(0, 8)),
    error: result.error ? String(result.error) : ""
  });
}

export function createLiveOutputSendHistory({ limit = DEFAULT_LIMIT } = {}) {
  const max = Math.max(1, Math.min(100, Number(limit) || DEFAULT_LIMIT));
  const entries = [];

  function append(kind = "output", result = {}) {
    const entry = Object.freeze({ kind: String(kind || "output"), ...compactResult(result) });
    entries.unshift(entry);
    while (entries.length > max) entries.pop();
    return entry;
  }

  function snapshot() {
    const last = entries[0] || null;
    return Object.freeze({
      version: LIVE_OUTPUT_SEND_HISTORY_VERSION,
      ok: true,
      count: entries.length,
      last,
      entries: Object.freeze(entries.slice())
    });
  }

  function clear() {
    entries.splice(0, entries.length);
    return snapshot();
  }

  return Object.freeze({
    version: LIVE_OUTPUT_SEND_HISTORY_VERSION,
    append,
    snapshot,
    clear
  });
}
