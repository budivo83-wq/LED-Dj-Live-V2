import os from "node:os";
import { buildArtDmxPacket, splitRgbToArtDmxPackets, summarizePacket } from "./live_output_packet_builder.js";
import { freezeUniqueList } from "./live_output_common.js";

export const LIVE_ARTNET_TARGET_DIAGNOSTICS_VERSION = "13D-artnet-target-diagnostics-hardening";

function envValue(env, key, fallback = "") {
  const value = env?.[key];
  return value === undefined || value === null || String(value).trim() === "" ? fallback : String(value).trim();
}

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function normalizeHost(value) {
  return String(value || "").trim();
}

function normalizePatternBytes(pixels = 30) {
  const count = clampInt(pixels, 1, 150, 30);
  const rgb = new Uint8Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const on = i === 0 || i === Math.floor(count / 2) || i === count - 1;
    rgb[i * 3 + 0] = on ? 24 : 0;
    rgb[i * 3 + 1] = on ? 4 : 0;
    rgb[i * 3 + 2] = on ? 0 : 0;
  }
  return rgb;
}

function listIpv4Interfaces() {
  const nets = os.networkInterfaces?.() || {};
  const out = [];
  for (const [name, entries] of Object.entries(nets)) {
    for (const entry of entries || []) {
      if (entry?.family !== "IPv4") continue;
      out.push(Object.freeze({
        name,
        address: String(entry.address || ""),
        netmask: String(entry.netmask || ""),
        internal: Boolean(entry.internal),
        cidr: String(entry.cidr || "")
      }));
    }
  }
  return Object.freeze(out);
}

function isBroadcastHost(host) {
  return host === "255.255.255.255" || host.endsWith(".255");
}

function isLoopbackHost(host) {
  return host === "127.0.0.1" || host.startsWith("127.") || host === "localhost";
}

function isPrivateIpv4(host) {
  return /^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host) || /^2\./.test(host);
}

export function readArtnetTargetDefaults(env = process.env) {
  return Object.freeze({
    version: LIVE_ARTNET_TARGET_DIAGNOSTICS_VERSION,
    host: normalizeHost(envValue(env, "LED_ARTNET_HOST", envValue(env, "LED_ARTNET_TARGET_IP", "127.0.0.1"))),
    port: clampInt(envValue(env, "LED_ARTNET_PORT", "6454"), 1, 65535, 6454),
    universe: clampInt(envValue(env, "LED_ARTNET_UNIVERSE", "0"), 0, 32767, 0),
    pixels: clampInt(envValue(env, "LED_ARTNET_PIXELS", "30"), 1, 150, 30),
    physicalWriteEnabled: envValue(env, "LED_PHYSICAL_OUTPUT_ENABLE", "0") === "1",
    liveWriterEnabled: envValue(env, "LED_ARTNET_LIVE_WRITER_ENABLE", "0") === "1"
  });
}

export function evaluateArtnetTargetDiagnostics({ env = process.env, request = {} } = {}) {
  const defaults = readArtnetTargetDefaults(env);
  const target = Object.freeze({
    ...defaults,
    host: normalizeHost(("host" in request) ? request.host : (("ip" in request) ? request.ip : (("targetIp" in request) ? request.targetIp : defaults.host))),
    port: clampInt(request.artnetPort || request.port || defaults.port, 1, 65535, defaults.port),
    universe: clampInt(request.universe ?? defaults.universe, 0, 32767, defaults.universe),
    pixels: clampInt(request.pixels ?? request.pixelCount ?? defaults.pixels, 1, 150, defaults.pixels)
  });

  const blocked = [];
  const warnings = [];
  if (!target.host) blocked.push("LED_ARTNET_HOST_EMPTY");
  if (target.port !== 6454) warnings.push("LED_ARTNET_PORT_NON_STANDARD");
  if (!target.physicalWriteEnabled) warnings.push("LED_PHYSICAL_OUTPUT_ENABLE_OFF");
  if (!target.liveWriterEnabled) warnings.push("LED_ARTNET_LIVE_WRITER_ENABLE_OFF");
  if (isLoopbackHost(target.host)) warnings.push("ARTNET_TARGET_LOOPBACK_TEST_ONLY");
  if (isBroadcastHost(target.host)) warnings.push("ARTNET_BROADCAST_TARGET");
  if (!isPrivateIpv4(target.host) && !isLoopbackHost(target.host) && !isBroadcastHost(target.host)) warnings.push("ARTNET_TARGET_NOT_PRIVATE_IPV4_RANGE");
  if (target.pixels > 60) warnings.push("ARTNET_PIXEL_COUNT_ABOVE_SMOKE_DEFAULT");

  const rgb = normalizePatternBytes(target.pixels);
  const packets = splitRgbToArtDmxPackets({ rgb, startUniverse: target.universe, sequence: 1, pixelsPerUniverse: 170 });
  const previewPacket = buildArtDmxPacket({ universe: target.universe, dmx: rgb, sequence: 1 });
  const packetSummaries = packets.map((packet) => summarizePacket(packet));
  const packetCount = packets.length;
  const payloadBytes = packets.reduce((sum, packet) => sum + Number(packet.dmxBytes || 0), 0);
  const packetBytes = packets.reduce((sum, packet) => sum + Number(packet.packetBytes || 0), 0);
  const interfaces = listIpv4Interfaces();
  const nonInternalInterfaces = interfaces.filter((item) => !item.internal);
  if (!nonInternalInterfaces.length) warnings.push("NO_NON_INTERNAL_IPV4_INTERFACE_DETECTED");

  const status = blocked.length ? "BLOCKED" : (warnings.length ? "WARN" : "READY");
  const decision = blocked.length
    ? "ARTNET_TARGET_DIAGNOSTICS_BLOCKED_13D"
    : warnings.length
      ? "ARTNET_TARGET_DIAGNOSTICS_WARN_13D"
      : "ARTNET_TARGET_DIAGNOSTICS_READY_13D";

  return Object.freeze({
    version: LIVE_ARTNET_TARGET_DIAGNOSTICS_VERSION,
    ok: blocked.length === 0,
    status,
    decision,
    target,
    targetLabel: `${target.host}:${target.port}/u${target.universe}`,
    packetCount,
    payloadBytes,
    packetBytes,
    preview: summarizePacket(previewPacket),
    packetSummaries: Object.freeze(packetSummaries),
    interfaces,
    interfaceCount: interfaces.length,
    nonInternalInterfaceCount: nonInternalInterfaces.length,
    blocked: freezeUniqueList(blocked),
    warnings: freezeUniqueList(warnings),
    summary: `${status} | ${target.host}:${target.port} | u${target.universe} | ${target.pixels}px | ${packetCount}pkt/${payloadBytes}B`
  });
}

export function createLiveArtnetTargetDiagnostics13D({ env = process.env } = {}) {
  return Object.freeze({
    version: LIVE_ARTNET_TARGET_DIAGNOSTICS_VERSION,
    readTarget: () => readArtnetTargetDefaults(env),
    evaluate: (request = {}) => evaluateArtnetTargetDiagnostics({ env, request })
  });
}
