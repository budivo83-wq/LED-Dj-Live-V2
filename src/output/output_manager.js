import { buildBlxAaFramePacket, createBlxAckTracker } from "./blx_packet.js";
import { buildArtSyncPacket, resolveUniverseMap, splitRgbByUniverseMap } from "./artnet_core.js";
import { createDoubleFrameBuffer } from "./frame_sync.js";
import { createOutputRateLimiter } from "./rate_limiter.js";
import { resolveOutputProfile } from "./output_profiles.js";
import { createOutputWatchdog } from "./output_watchdog.js";

function nowMs() {
  if (typeof performance !== "undefined" && typeof performance.now === "function") return performance.now();
  return Date.now();
}

function normalizeTransport(value) {
  const key = String(value || "null").toLowerCase();
  if (key === "serial" || key === "blx" || key === "blx_serial") return "blx";
  if (key === "preview") return "preview";
  if (key === "artnet" || key === "udp") return "artnet";
  if (key === "sacn" || key === "e131") return "sacn";
  return "null";
}

function createStats(id) {
  return {
    id,
    connected: false,
    sent: 0,
    dropped: 0,
    queueDepth: 0,
    lastFrameId: 0,
    lastSendMs: 0,
    lastLatencyMs: 0,
    bytesTx: 0,
    lastError: ""
  };
}

class BaseOutput {
  constructor(id, options = {}) {
    this.id = id;
    this.options = options;
    this.stats = createStats(id);
    this.packets = [];
    this.rateLimiter = createOutputRateLimiter({
      fps: options.fps || options.fpsLimit || 60,
      autoAdapt: options.autoAdapt === true,
      minFps: options.minFps || 20
    });
  }

  connect() {
    this.stats.connected = true;
    return true;
  }

  disconnect() {
    this.stats.connected = false;
    this.stats.queueDepth = 0;
    return true;
  }

  sendFrame(frame) {
    const startedAt = nowMs();
    if (!this.stats.connected) this.connect();
    if (!this.rateLimiter.allow()) {
      this.stats.dropped += 1;
      this.stats.lastError = "rate_limited";
      return Object.freeze({ ok: false, output: this.id, skipped: true, reason: "rate_limited", packets: [] });
    }
    try {
      const packets = this.buildPackets(frame);
      const list = Array.isArray(packets) ? packets : [packets].filter(Boolean);
      this.packets = list;
      this.stats.sent += 1;
      this.stats.lastFrameId = Number(frame?.frameId || this.stats.lastFrameId);
      this.stats.bytesTx += list.reduce((sum, packet) => sum + Number(packet?.packetBytes || packet?.packet?.byteLength || 0), 0);
      this.stats.lastSendMs = Math.max(0, nowMs() - startedAt);
      this.stats.lastLatencyMs = frame?.timestamp ? Math.max(0, startedAt - Number(frame.timestamp)) : 0;
      this.stats.lastError = "";
      return Object.freeze({ ok: true, output: this.id, packets: list });
    } catch (error) {
      this.stats.dropped += 1;
      this.stats.lastError = String(error?.message || error || "send_failed");
      return Object.freeze({ ok: false, output: this.id, error: this.stats.lastError, packets: [] });
    }
  }

  buildPackets(frame) {
    void frame;
    return [];
  }

  getStats() {
    return Object.freeze({ ...this.stats, packetCount: this.packets.length, rate: this.rateLimiter.getStats() });
  }
}

export class NullOutput extends BaseOutput {
  constructor(options = {}) {
    super("null", options);
  }
}

export class PreviewOutput extends BaseOutput {
  constructor(options = {}) {
    super("preview", options);
    this.lastFrame = null;
  }

  buildPackets(frame) {
    this.lastFrame = frame || null;
    return [];
  }
}

export class SerialBLXOutput extends BaseOutput {
  constructor(options = {}) {
    super("blx", options);
    this.ack = createBlxAckTracker(options.ack || {});
  }

  buildPackets(frame) {
    const packet = buildBlxAaFramePacket({
      frameId: Number(frame?.frameId || 0),
      brightness: this.options.brightness ?? frame?.meta?.brightness ?? 255,
      rgb: frame?.frame || frame?.payload || []
    });
    this.ack.track(packet);
    return packet;
  }

  receiveAck(line) {
    return this.ack.receive(line);
  }

  collectDueResends() {
    return this.ack.collectDueResends();
  }

  getStats() {
    return Object.freeze({ ...super.getStats(), ack: this.ack.getStats() });
  }
}

export class ArtNetOutput extends BaseOutput {
  constructor(options = {}) {
    super("artnet", options);
    this.sequence = 1;
    this.universeMap = resolveUniverseMap(options);
  }

  buildPackets(frame) {
    const packets = splitRgbByUniverseMap({
      rgb: frame?.frame || frame?.payload || [],
      universeMap: this.universeMap,
      sequence: this.sequence
    });
    this.sequence = (this.sequence + 1) & 0xff;
    return this.options.artSync === false ? packets : [...packets, buildArtSyncPacket()];
  }

  getStats() {
    const artDmxPackets = this.packets.filter((packet) => packet?.opCode === "OpDmx");
    const bytesPerFrame = artDmxPackets.reduce((sum, packet) => sum + Number(packet.packetBytes || 0), 0);
    return Object.freeze({
      ...super.getStats(),
      universeCount: this.universeMap.universeCount,
      artSync: this.options.artSync !== false,
      universeTxPerFrame: artDmxPackets.length,
      bytesPerFrame
    });
  }
}

export class SacnOutput extends BaseOutput {
  constructor(options = {}) {
    super("sacn", options);
  }
}

export function createOutputManager(options = {}) {
  const profile = resolveOutputProfile(options.profile || options.profileName || "Club Full", options.profileOverrides || {});
  const buffer = createDoubleFrameBuffer();
  const previewAlwaysOn = options.previewAlwaysOn ?? profile.preview === true;
  const fallbackTransport = normalizeTransport(options.fallbackTransport || profile.fallback || "null");
  const watchdog = createOutputWatchdog({
    ...(options.watchdog || {}),
    fallbackTransport
  });
  const outputs = {
    null: new NullOutput(options.null || {}),
    preview: new PreviewOutput(options.preview || {}),
    blx: new SerialBLXOutput(options.blx || {}),
    artnet: new ArtNetOutput(options.artnet || { artSync: true }),
    sacn: new SacnOutput(options.sacn || {})
  };

  let active = normalizeTransport(options.transport || options.mode || profile.transport || "preview");
  let lastFallbackAt = 0;
  let fallbackCount = 0;
  let lastDecision = "INIT";

  function select(transport) {
    const next = normalizeTransport(transport);
    if (next === active) return outputs[active];
    outputs[active]?.disconnect();
    active = next;
    outputs[active]?.connect();
    return outputs[active];
  }

  function sendFrame(frame, sendOptions = {}) {
    const output = sendOptions.transport ? select(sendOptions.transport) : outputs[active];
    const packet = buffer.renderSwap(frame);
    if (previewAlwaysOn && output.id !== "preview") outputs.preview.sendFrame(packet);
    watchdog.markFrameSent();
    const result = output.sendFrame(packet);
    if (result.ok) {
      lastDecision = "SENT";
      return result;
    }
    const fallback = outputs[fallbackTransport] || outputs.null;
    if (fallback.id !== output.id) {
      fallbackCount += 1;
      lastFallbackAt = nowMs();
      lastDecision = `FALLBACK_${fallback.id.toUpperCase()}`;
      const fallbackResult = fallback.sendFrame(packet);
      return Object.freeze({
        ...fallbackResult,
        primary: result,
        fallback: fallback.id,
        fallbackUsed: true
      });
    }
    lastDecision = "DROPPED";
    return result;
  }

  function evaluateWatchdog(stats = {}) {
    const decision = watchdog.evaluate(stats);
    if (decision.fallback && active !== fallbackTransport) {
      fallbackCount += 1;
      lastFallbackAt = nowMs();
      select(fallbackTransport);
      lastDecision = `WATCHDOG_FALLBACK_${fallbackTransport.toUpperCase()}`;
    } else if (decision.reconnect) {
      outputs[active]?.disconnect();
      outputs[active]?.connect();
      lastDecision = "WATCHDOG_RECONNECT";
    }
    return decision;
  }

  return Object.freeze({
    connect: () => outputs[active].connect(),
    disconnect: () => outputs[active].disconnect(),
    setTransport: (transport) => select(transport).id,
    evaluateWatchdog,
    sendFrame,
    getStats: () => Object.freeze({
      version: "output-manager-v1",
      profile,
      active,
      fallbackTransport,
      previewAlwaysOn,
      fallbackCount,
      lastFallbackAt,
      lastDecision,
      watchdog: watchdog.getStats(),
      buffer: buffer.getStats(),
      outputs: Object.freeze(Object.fromEntries(Object.entries(outputs).map(([key, output]) => [key, output.getStats()])))
    }),
    getOutput: (transport) => outputs[normalizeTransport(transport)]
  });
}
