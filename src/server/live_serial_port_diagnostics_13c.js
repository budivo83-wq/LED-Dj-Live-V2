export const LIVE_SERIAL_PORT_DIAGNOSTICS_VERSION = "13C-serial-port-real-adapter-hardening";

function envValue(env, key, fallback = "") {
  const value = env?.[key];
  return value === undefined || value === null || String(value).trim() === "" ? fallback : String(value).trim();
}

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function normalizePort(port) {
  return String(port || "").trim();
}

function portLabel(port = {}) {
  const parts = [port.path || port.comName || "unknown"];
  if (port.manufacturer) parts.push(port.manufacturer);
  if (port.vendorId || port.productId) parts.push(`${port.vendorId || "?"}:${port.productId || "?"}`);
  return parts.join(" | ");
}

export function readSerialPortTarget(env = process.env) {
  return Object.freeze({
    version: LIVE_SERIAL_PORT_DIAGNOSTICS_VERSION,
    serialPath: normalizePort(envValue(env, "LED_SERIAL_PORT", "COM3")),
    baudRate: clampInt(envValue(env, "LED_SERIAL_BAUD", "1000000"), 9600, 3000000, 1000000),
    physicalWriteEnabled: envValue(env, "LED_PHYSICAL_OUTPUT_ENABLE", "0") === "1",
    liveWriterEnabled: envValue(env, "LED_SERIAL_LIVE_WRITER_ENABLE", "0") === "1"
  });
}

async function listSerialPorts() {
  try {
    const { SerialPort } = await import("serialport");
    const ports = await SerialPort.list();
    return { ok: true, ports: Array.isArray(ports) ? ports : [], error: "" };
  } catch (error) {
    return { ok: false, ports: [], error: error?.message || String(error) };
  }
}

function evaluatePorts({ ports = [], target = readSerialPortTarget(), listOk = true, listError = "" } = {}) {
  const targetPath = normalizePort(target.serialPath);
  const blocked = [];
  const warnings = [];
  const normalizedPorts = ports.map((port) => Object.freeze({
    path: String(port.path || port.comName || ""),
    manufacturer: String(port.manufacturer || ""),
    serialNumber: String(port.serialNumber || ""),
    vendorId: String(port.vendorId || ""),
    productId: String(port.productId || ""),
    label: portLabel(port)
  })).filter((port) => port.path);

  if (!listOk) blocked.push("SERIAL_PORT_LIST_FAILED");
  if (!targetPath) blocked.push("LED_SERIAL_PORT_EMPTY");
  if (target.baudRate < 9600 || target.baudRate > 3000000) blocked.push("LED_SERIAL_BAUD_OUT_OF_RANGE");
  if (!target.physicalWriteEnabled) warnings.push("LED_PHYSICAL_OUTPUT_ENABLE_OFF");
  if (!target.liveWriterEnabled) warnings.push("LED_SERIAL_LIVE_WRITER_ENABLE_OFF");
  if (!normalizedPorts.length && listOk) warnings.push("NO_SERIAL_PORTS_DETECTED");

  const match = normalizedPorts.find((port) => port.path.toLowerCase() === targetPath.toLowerCase()) || null;
  if (targetPath && normalizedPorts.length && !match) blocked.push("LED_SERIAL_PORT_NOT_FOUND");

  const status = blocked.length ? "BLOCKED" : (warnings.length ? "WARN" : "READY");
  const decision = blocked.length
    ? "SERIAL_PORT_DIAGNOSTICS_BLOCKED_13C"
    : warnings.length
      ? "SERIAL_PORT_DIAGNOSTICS_WARN_13C"
      : "SERIAL_PORT_DIAGNOSTICS_READY_13C";

  return Object.freeze({
    version: LIVE_SERIAL_PORT_DIAGNOSTICS_VERSION,
    ok: blocked.length === 0,
    status,
    decision,
    target,
    targetLabel: `${targetPath || "NO_PORT"}@${target.baudRate}`,
    ports: Object.freeze(normalizedPorts),
    portCount: normalizedPorts.length,
    matchedPort: match,
    blocked: Object.freeze(blocked),
    warnings: Object.freeze(warnings),
    error: listError,
    summary: `${status} | ${targetPath || "NO_PORT"}@${target.baudRate} | ports ${normalizedPorts.length} | ${match ? "MATCH" : "NO-MATCH"}`
  });
}

export async function evaluateSerialPortDiagnostics({ env = process.env, request = {} } = {}) {
  const target = Object.freeze({
    ...readSerialPortTarget(env),
    serialPath: normalizePort(request.serialPath || request.path || request.portName || envValue(env, "LED_SERIAL_PORT", "COM3")),
    baudRate: clampInt(request.baudRate || envValue(env, "LED_SERIAL_BAUD", "1000000"), 9600, 3000000, 1000000)
  });
  const listed = await listSerialPorts();
  return evaluatePorts({ ports: listed.ports, target, listOk: listed.ok, listError: listed.error });
}

export function createLiveSerialPortDiagnostics13C({ env = process.env } = {}) {
  return Object.freeze({
    version: LIVE_SERIAL_PORT_DIAGNOSTICS_VERSION,
    readTarget: () => readSerialPortTarget(env),
    evaluate: (request = {}) => evaluateSerialPortDiagnostics({ env, request })
  });
}
