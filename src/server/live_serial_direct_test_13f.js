import {
  RAW_SERIAL_PACKET_FORMAT,
  RAW_SERIAL_PACKET_LABEL,
  buildRawSerialAaLen16RgbPacket,
  inspectRawSerialAaLen16RgbPacket
} from "../output/raw_serial_contract_22cb.js";
import { freezeUniqueList } from "./live_output_common.js";

export const LIVE_SERIAL_DIRECT_TEST_13F_VERSION = "STEP22CB-serial-direct-single-source-contract";

function envValue(env, key, fallback = "") {
  return String(env?.[key] ?? fallback).trim();
}

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeRequest({ request = {}, env = process.env } = {}) {
  return Object.freeze({
    serialPath: String(request.serialPath || request.path || request.portName || envValue(env, "LED_SERIAL_PORT", "")).trim(),
    baudRate: clampInt(request.baudRate || envValue(env, "LED_SERIAL_BAUD", "115200"), 9600, 3000000, 115200),
    pixels: clampInt(request.pixels || request.pixelCount || envValue(env, "LED_SERIAL_TEST_PIXELS", "160"), 1, 600, 160),
    brightness: clampInt(request.brightness || envValue(env, "LED_SERIAL_TEST_BRIGHTNESS", "20"), 1, 80, 20),
    frames: clampInt(request.frames || request.frameCount || 6, 1, 30, 6),
    intervalMs: clampInt(request.intervalMs || 180, 20, 2000, 180),
    pattern: String(request.pattern || "rgb-pulse").trim().toLowerCase(),
    physicalWriteEnabled: envValue(env, "LED_PHYSICAL_OUTPUT_ENABLE", "0") === "1",
    directTestEnabled: envValue(env, "LED_SERIAL_DIRECT_TEST_ENABLE", "1") !== "0"
  });
}

function frameRgb({ pixels, frameIndex, pattern }) {
  const rgb = new Uint8Array(pixels * 3);
  const set = (i, r, g, b) => {
    const o = i * 3;
    rgb[o] = r;
    rgb[o + 1] = g;
    rgb[o + 2] = b;
  };

  if (pattern === "red") {
    for (let i = 0; i < pixels; i++) set(i, 255, 0, 0);
    return rgb;
  }
  if (pattern === "green") {
    for (let i = 0; i < pixels; i++) set(i, 0, 255, 0);
    return rgb;
  }
  if (pattern === "blue") {
    for (let i = 0; i < pixels; i++) set(i, 0, 0, 255);
    return rgb;
  }
  if (pattern === "blackout") return rgb;

  if (pattern === "chase") {
    const i = frameIndex % pixels;
    set(i, 255, 90, 0);
    return rgb;
  }

  // rgb-pulse: every frame is very visible on both strips.
  const phase = frameIndex % 4;
  for (let i = 0; i < pixels; i++) {
    if (phase === 0) set(i, 255, 0, 0);
    else if (phase === 1) set(i, 0, 255, 0);
    else if (phase === 2) set(i, 0, 0, 255);
    else set(i, 0, 0, 0);
  }
  return rgb;
}

function inspectAaLen16RgbPacket(packet, expectedPixels) {
  const inspected = inspectRawSerialAaLen16RgbPacket(packet, expectedPixels);
  return Object.freeze({
    ...inspected,
    reason: inspected.ok ? "OK" : inspected.errors[0] || "UNKNOWN",
    protocol: "AA_LEN16_PIXELS_LE_RGB",
    contract: "STEP22CB_DIRECT_TEST_AA_LEN16_PIXELS_LE_RGB_ONLY",
    actualBytes: inspected.packetBytes
  });
}

function buildPackets(test) {
  const packets = [];
  const inspections = [];
  for (let frameIndex = 0; frameIndex < test.frames; frameIndex += 1) {
    const rgb = frameRgb({ pixels: test.pixels, frameIndex, pattern: test.pattern });
    const packet = buildRawSerialAaLen16RgbPacket({ rgb, pixels: test.pixels, brightness: test.brightness });
    const inspection = inspectAaLen16RgbPacket(packet, test.pixels);
    if (!inspection.ok) throw new Error(`direct-test packet contract failed: ${inspection.reason}`);
    packets.push(packet);
    inspections.push(inspection);
  }
  return { packets, inspections };
}

async function listPorts() {
  try {
    const { SerialPort } = await import("serialport");
    const ports = await SerialPort.list();
    return { ok: true, ports: ports.map((p) => ({ path: p.path, manufacturer: p.manufacturer || "", vendorId: p.vendorId || "", productId: p.productId || "" })) };
  } catch (error) {
    return { ok: false, ports: [], error: error?.message || String(error) };
  }
}

export async function runLiveSerialDirectTest13F({ request = {}, env = process.env } = {}) {
  const test = normalizeRequest({ request, env });
  const blocked = [];
  const warnings = [];
  const listed = await listPorts();

  if (!test.serialPath) blocked.push("LED_SERIAL_PORT_MISSING");
  if (!test.physicalWriteEnabled) blocked.push("LED_PHYSICAL_OUTPUT_ENABLE_NOT_1");
  if (!test.directTestEnabled) blocked.push("LED_SERIAL_DIRECT_TEST_ENABLE_0");
  if (!listed.ok) warnings.push(`SERIAL_PORT_LIST_FAILED:${listed.error}`);
  const match = listed.ports.find((p) => String(p.path).toLowerCase() === test.serialPath.toLowerCase()) || null;
  if (listed.ok && listed.ports.length && !match) blocked.push("LED_SERIAL_PORT_NOT_FOUND");

  const built = buildPackets(test);
  const packets = built.packets;
  const packetInspections = built.inspections;
  const packetBytes = packets.reduce((sum, p) => sum + p.length, 0);
  const headHex = Array.from(packets[0]?.slice(0, 16) || []).map((b) => b.toString(16).padStart(2, "0")).join(" ");

  const base = {
    version: LIVE_SERIAL_DIRECT_TEST_13F_VERSION,
    request: test,
    targetLabel: `${test.serialPath || "NO_PORT"}@${test.baudRate}`,
    ports: listed.ports,
    matchedPort: match,
    packetCount: packets.length,
    packetBytes,
    expectedReceiverProtocol: RAW_SERIAL_PACKET_LABEL,
    expectedFirstByteDecimal: 170,
    expectedLen16Pixels: test.pixels,
    expectedPacketBytesEach: packets[0]?.length || 0,
    packetContract: "STEP22CB_DIRECT_TEST_AA_LEN16_PIXELS_LE_RGB_ONLY",
    packetInspections,
    headHex,
    warnings: freezeUniqueList(warnings),
    blocked: freezeUniqueList(blocked),
    outputTouched: false,
    serialTouched: false
  };

  if (blocked.length) {
    return Object.freeze({ ...base, ok: false, status: "BLOCKED", decision: "SERIAL_DIRECT_TEST_BLOCKED_13F" });
  }

  const { SerialPort } = await import("serialport");
  const port = new SerialPort({ path: test.serialPath, baudRate: test.baudRate, autoOpen: false });
  try {
    await new Promise((resolve, reject) => port.open((err) => err ? reject(err) : resolve()));
    // Give Arduino autoreset boards a moment after opening the port.
    await delay(1200);
    for (const packet of packets) {
      await new Promise((resolve, reject) => port.write(packet, (err) => err ? reject(err) : resolve()));
      await new Promise((resolve, reject) => port.drain((err) => err ? reject(err) : resolve()));
      await delay(test.intervalMs);
    }
    return Object.freeze({ ...base, ok: true, status: "SENT", decision: "SERIAL_DIRECT_TEST_SENT_13F", outputTouched: true, serialTouched: true });
  } catch (error) {
    return Object.freeze({ ...base, ok: false, status: "ERROR", decision: "SERIAL_DIRECT_TEST_ERROR_13F", error: error?.message || String(error), outputTouched: true, serialTouched: true });
  } finally {
    await new Promise((resolve) => {
      try { port.close(() => resolve()); } catch { resolve(); }
    });
  }
}

export function createLiveSerialDirectTest13F({ env = process.env } = {}) {
  return Object.freeze({
    version: LIVE_SERIAL_DIRECT_TEST_13F_VERSION,
    run: (request = {}) => runLiveSerialDirectTest13F({ request, env })
  });
}
