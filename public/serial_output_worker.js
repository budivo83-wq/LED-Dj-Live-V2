import { createBlxV2Sender, BLX_V2_FLAGS } from "./blx_sender_v2.js";
import { createFixedClock } from "./core/fixed_clock.js";
import {
  buildSerialFrame,
  buildSegmentedFrameForMode,
  buildRoutedFrameForMode,
  wrapBlxNetTransportPacket,
  clampPort,
  shouldUseLegacySerialPayload,
  effectiveSerialRoutingMode
} from "./runtime/mapping_transform.js";
import { applyMappingOutputTestFrame } from "./runtime/mapping_v2_test_output.js";

const blxV2 = createBlxV2Sender();
const sendClock = createFixedClock(60);
let ws = null;
let wsReady = false;
let wsConnecting = false;
let queued = null;
let sending = false;
let lastSeq = 0;
let lastDebug = {
  mode: "worker",
  strips: 0,
  ledsPerStrip: 0,
  pixels: 0,
  frameBytes: 0,
  packetBytes: 0,
  checksum: "--",
  type: "--",
  seq: 0,
  delayMs: 0,
  slotMs: 0,
  queue: 0
};

self.onmessage = (event) => {
  const data = event?.data || {};
  if (data.type !== "frame") return;
  queued = data;
  flushQueue();
};

function flushQueue() {
  if (sending) return;
  if (!queued) return;
  sending = true;
  const next = queued;
  queued = null;
  ensureSocket()
    .then(() => sendSnapshot(next))
    .catch((error) => {
      postMessage({ type: "error", message: error?.message || String(error) });
    })
    .finally(() => {
      sending = false;
      if (queued) {
        setTimeout(flushQueue, 0);
      }
    });
}

function ensureSocket() {
  if (wsReady && ws && ws.readyState === WebSocket.OPEN) return Promise.resolve();
  if (wsConnecting) return new Promise((resolve) => waitForOpen(resolve));

  wsConnecting = true;
  return new Promise((resolve, reject) => {
    try {
      const base = self.location?.origin || "";
      const url = base.replace(/^http/, "ws");
      ws = new WebSocket(url);
      ws.binaryType = "arraybuffer";
      ws.onopen = () => {
        wsReady = true;
        wsConnecting = false;
        resolve();
      };
      ws.onerror = () => {
        wsConnecting = false;
        reject(new Error("websocket open failed"));
      };
      ws.onclose = () => {
        wsReady = false;
        wsConnecting = false;
      };
    } catch (error) {
      wsConnecting = false;
      reject(error);
    }
  });
}

function waitForOpen(resolve) {
  const poll = () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      wsReady = true;
      wsConnecting = false;
      resolve();
      return;
    }
    if (!wsConnecting) {
      resolve();
      return;
    }
    setTimeout(poll, 10);
  };
  setTimeout(poll, 10);
}

async function sendSnapshot(next) {
  const payload = next.payload || {};
  const frame = new Uint8Array(next.frame || 0);
  const mode = String(payload.outputMode || "preview");
  const width = Number(payload.width || 0) | 0;
  const height = Number(payload.height || 0) | 0;
  const rows = payload.rows || {};
  // STEP 13J: payload.mappingTest is null during normal live serial.
  // This prevents a stale Mapping Test/Solid color from freezing the real output.
  const sourceFrame = payload.mappingTest
    ? applyMappingOutputTestFrame(frame, width, height, rows, payload.mappingTest)
    : frame;
  const mappingMode = effectiveSerialRoutingMode(rows, mode);
  const serialFrame = buildSerialFrame(sourceFrame, width, height, rows, mappingMode);

  if (mode === "blx_serial" && !shouldUseLegacySerialPayload(rows, mode)) {
    const built = buildBlxV2SerialPayload(serialFrame, width, height, payload);
    await sendPacket(built.packet, built.debug, built.delayMs);
    return;
  }

  if (mode === "blx_net") {
    const built = buildBlxV2NetPayload(serialFrame, width, height, payload, payload.blxNetConfig || {});
    await sendPacket(built.packet, built.debug, built.delayMs);
    return;
  }

  const routingMode = effectiveSerialRoutingMode(rows, mode);
  const routed = buildRoutedFrameForMode(serialFrame, width, height, rows, routingMode);
  const builtLegacy = applySerialProtocol(routed, payload?.serialSettings?.protocol || "aa_len_rgb", payload);
  const legacyDelayMs = legacyPacketDelayMs(payload?.serialSettings?.fps, builtLegacy.packet?.length || 0, builtLegacy.debug?.protocol || payload?.serialSettings?.protocol);
  lastDebug = builtLegacy.debug;
  await sendPacket(builtLegacy.packet, lastDebug, legacyDelayMs);
}


function clampByte(value, fallback = 0) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(255, n));
}

function countNonZero(bytes) {
  let n = 0;
  for (let i = 0; i < bytes.length; i += 1) if (bytes[i]) n += 1;
  return n;
}

function firstBytesHex(bytes, limit = 16) {
  return Array.from(bytes.subarray(0, Math.min(limit, bytes.length)))
    .map((v) => v.toString(16).toUpperCase().padStart(2, "0"))
    .join(" ");
}

function simpleAaPixelCount(payload) {
  const settings = payload?.serialSettings || {};
  const raw = settings.simpleAaPixels ?? settings.aaPixels ?? 160;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? Math.max(1, Math.min(2400, n)) : 160;
}

function fixedLengthAaRgb(raw, pixelCount) {
  const count = Math.max(1, Number.parseInt(pixelCount, 10) || 160);
  const bytes = count * 3;
  const out = new Uint8Array(bytes);
  if (raw instanceof Uint8Array) out.set(raw.subarray(0, Math.min(raw.length, bytes)), 0);
  return out;
}

function applySerialProtocol(routed, protocolValue = "aa_len_rgb", payload = null) {
  // STEP22BX: operator/live serial is intentionally locked to one wire contract.
  // UI or stale localStorage may still contain older protocol names, but runtime
  // must not branch into RAW/AA_RGB/AA20/WLED/LE anymore.
  const raw = routed?.data instanceof Uint8Array ? routed.data : new Uint8Array(0);
  const forcedProtocol = "aa_len_rgb";
  const rawPixels = Math.floor(raw.length / 3);
  const aaPixels = simpleAaPixelCount(payload);
  const aaRaw = fixedLengthAaRgb(raw, aaPixels);
  const packet = new Uint8Array(3 + aaRaw.length);
  packet[0] = 0xAA;
  // STEP22BX contract: LEN16 is PIXEL COUNT, little-endian.
  // 4×40 => AA A0 00 + 480 RGB bytes = 483 bytes total.
  packet[1] = aaPixels & 0xff;
  packet[2] = (aaPixels >> 8) & 0xff;
  packet.set(aaRaw, 3);
  return {
    packet,
    debug: {
      mode: "step22bx-worker-aa-len-rgb-locked",
      protocol: forcedProtocol,
      requestedProtocol: String(protocolValue || "aa_len_rgb").toLowerCase(),
      lenField: "pixels_le16",
      strips: routed?.strips || 0,
      ledsPerStrip: routed?.ledsPerStrip || 0,
      pixels: aaPixels,
      rawPixelsBeforeLimit: rawPixels,
      frameBytes: aaRaw.length,
      rawFrameBytesBeforeLimit: raw.length,
      packetBytes: packet.length,
      expectedPacketBytes: 3 + aaPixels * 3,
      nonZeroBytes: countNonZero(aaRaw),
      firstBytes: firstBytesHex(packet),
      checksum: "--",
      type: "0xAA+LEN16_PIXELS_LE+RGB ONLY",
      seq: 0,
      delayMs: 0,
      slotMs: 0,
      queue: 0
    }
  };
}

function sendPacket(packet, debug, delayMs) {
  return new Promise((resolve) => {
    const trySend = () => {
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        resolve();
        return;
      }
      const now = performance.now();
      const slotMs = Math.max(1000 / 60, Number(delayMs) || 0);
      if (!sendClock.peekNextAt()) sendClock.setNextAt(now);
      const wait = Math.max(0, sendClock.peekNextAt() - now);
      if (wait > 0) {
        setTimeout(trySend, wait);
        return;
      }
      try {
        ws.send(packet);
        sendClock.setNextAt(performance.now() + slotMs);
        lastDebug = { ...debug, delayMs: Math.round(wait), slotMs: Math.round(slotMs), queue: sending ? 1 : 0 };
        postMessage({ type: "debug", debug: lastDebug });
      } catch (error) {
        postMessage({ type: "error", message: error?.message || String(error) });
      }
      resolve();
    };

    trySend();
  });
}

function legacyPacketDelayMs(configuredFps, packetBytes = 0, protocolValue = "") {
  const protocol = String(protocolValue || "").toLowerCase();
  const isSimpleAa = protocol === "aa_len_rgb" || protocol === "simple-aa" || Number(packetBytes) === 483;
  // STEP 13BU-AJ: 13BU-AI proved that conservative AA pacing stabilizes Arduino,
  // but the final control belongs in Serial Settings. Do not hard-cap simple AA
  // to 12 FPS here; settings.fps is the live limiter and can be tuned on RasPi.
  const defaultFps = isSimpleAa ? 30 : 25;
  const hardCap = 120;
  const fpsRaw = Number(configuredFps || defaultFps);
  const fps = Math.max(1, Math.min(hardCap, Number.isFinite(fpsRaw) ? fpsRaw : defaultFps));
  return 1000 / fps;
}

function effectiveSerialFps(packetBytes, preferredFps, baudRate) {
  const preferred = Math.max(1, Number(preferredFps) || 30);
  const baud = Math.max(9600, Number(baudRate) || 1000000);
  const bytes = Math.max(1, Number(packetBytes) || 1);
  const rawFps = baud / (bytes * 10);
  const safeFps = Math.floor(rawFps * 0.5);
  const hardCap = 18;
  return Math.max(6, Math.min(preferred, safeFps, hardCap));
}


function buildBlxV2SerialPayload(frame, width, height, payload) {
  const rows = payload?.rows || {};
  const segmented = buildSegmentedFrameForMode(frame, width, height, rows, "blx_serial");
  if (!segmented.segments.length) {
    return {
      packet: buildOutputPayloadFallback(segmented.raw, payload?.serialSettings?.protocol || "aa_len_rgb"),
      debug: {
        mode: "legacy-worker",
        strips: 0,
        ledsPerStrip: 0,
        pixels: segmented.raw.length / 3,
        frameBytes: segmented.raw.length,
        packetBytes: segmented.raw.length + 4,
        checksum: "--",
        type: "--",
        seq: 0,
        delayMs: 0,
        slotMs: 0,
        queue: 0
      },
      delayMs: 0
    };
  }
  lastSeq = (lastSeq + 1) >>> 0;
  const built = blxV2.buildFrameFullPacket(lastSeq, segmented.segments, BLX_V2_FLAGS.NONE);
  const preferredFps = Number(payload?.serialSettings?.fps || 30);
  const baud = Number(payload?.blxSerialBaud || 1000000);
  const delayMs = 1000 / effectiveSerialFps(built.packet.length, preferredFps, baud);
  return {
    packet: built.packet,
    debug: {
      mode: "blx_serial_v2",
      strips: segmented.segments.length,
      ledsPerStrip: segmented.maxPixels,
      pixels: segmented.pixels,
      frameBytes: segmented.raw.length,
      packetBytes: built.packet.length,
      checksum: built.crc.toString(16).toUpperCase().padStart(4, "0"),
      type: "0x01",
      seq: built.seq,
      delayMs,
      slotMs: Math.round(delayMs),
      queue: queued ? 1 : 0
    },
    delayMs
  };
}

function buildBlxV2NetPayload(frame, width, height, payload, netConfig) {
  const rows = payload?.rows || {};
  const segmented = buildSegmentedFrameForMode(frame, width, height, rows, "blx_net");
  if (!segmented.segments.length) {
    return {
      packet: buildOutputPayloadFallback(segmented.raw, payload?.serialSettings?.protocol || "aa_len_rgb"),
      debug: {
        mode: "legacy-worker",
        strips: 0,
        ledsPerStrip: 0,
        pixels: segmented.raw.length / 3,
        frameBytes: segmented.raw.length,
        packetBytes: segmented.raw.length + 4,
        checksum: "--",
        type: "--",
        seq: 0
      },
      delayMs: 0
    };
  }
  lastSeq = (lastSeq + 1) >>> 0;
  const built = blxV2.buildFrameFullPacket(lastSeq, segmented.segments, BLX_V2_FLAGS.NONE);
  const targetIp = String(netConfig?.targetIp || "127.0.0.1").trim();
  const port = clampPort(netConfig?.port);
  const tunneled = wrapBlxNetTransportPacket(built.packet, targetIp, port);
  return {
    packet: tunneled,
    debug: {
      mode: "blx_net_v2",
      strips: segmented.segments.length,
      ledsPerStrip: segmented.maxPixels,
      pixels: segmented.pixels,
      frameBytes: segmented.raw.length,
      packetBytes: tunneled.length,
      checksum: built.crc.toString(16).toUpperCase().padStart(4, "0"),
      type: "0x01",
      seq: built.seq,
      delayMs: 0,
      slotMs: 0,
      queue: queued ? 1 : 0
    },
    delayMs: 0
  };
}

function buildOutputPayloadFallback(frame) {
  const raw = frame instanceof Uint8Array ? frame : new Uint8Array(0);
  const pixels = Math.floor(raw.length / 3);
  const payload = new Uint8Array(3 + raw.length);
  payload[0] = 0xAA;
  payload[1] = pixels & 0xff;
  payload[2] = (pixels >> 8) & 0xff;
  payload.set(raw, 3);
  return payload;
}
