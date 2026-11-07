const BLX_AA_MAGIC = 0xaa;

function clampByte(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(255, Math.round(n)));
}

function clampU16(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(0xffff, Math.round(n)));
}

function normalizeRgb(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof Uint8ClampedArray) return new Uint8Array(value);
  if (Array.isArray(value)) return Uint8Array.from(value.map((item) => clampByte(item)));
  return new Uint8Array(0);
}

export function crc16CcittFalse(bytes) {
  let crc = 0xffff;
  for (const byte of bytes || []) {
    crc ^= (byte & 0xff) << 8;
    for (let i = 0; i < 8; i += 1) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc & 0xffff;
}

export function buildBlxAaFramePacket({ frameId = 0, brightness = 255, rgb = [], pixelCount = null } = {}) {
  const source = normalizeRgb(rgb);
  const pixels = Math.min(clampU16(pixelCount ?? Math.floor(source.length / 3)), Math.floor(source.length / 3));
  const rgbBytes = source.slice(0, pixels * 3);
  const body = new Uint8Array(1 + 2 + 1 + 2 + rgbBytes.length);
  body[0] = BLX_AA_MAGIC;
  body[1] = (frameId >> 8) & 0xff;
  body[2] = frameId & 0xff;
  body[3] = clampByte(brightness, 255);
  body[4] = (pixels >> 8) & 0xff;
  body[5] = pixels & 0xff;
  body.set(rgbBytes, 6);
  const crc = crc16CcittFalse(body);
  const packet = new Uint8Array(body.length + 2);
  packet.set(body, 0);
  packet[body.length] = (crc >> 8) & 0xff;
  packet[body.length + 1] = crc & 0xff;
  return Object.freeze({
    protocol: "blx-aa-crc16",
    frameId: clampU16(frameId),
    brightness: clampByte(brightness, 255),
    pixelCount: pixels,
    payloadBytes: rgbBytes.length,
    packetBytes: packet.length,
    crc,
    packet
  });
}

export function parseBlxAckLine(line) {
  const text = String(line || "").trim();
  const match = /^OK\s+(\d{1,5})$/i.exec(text);
  if (!match) return Object.freeze({ ok: false, type: "UNKNOWN", line: text, frameId: 0 });
  return Object.freeze({ ok: true, type: "OK", line: text, frameId: clampU16(Number(match[1])) });
}

export function createBlxAckTracker({ timeoutMs = 100, maxResend = 2, now = () => Date.now() } = {}) {
  const pending = new Map();
  const stats = {
    ackOk: 0,
    ackTimeout: 0,
    resend: 0,
    dropped: 0,
    lastAckFrameId: 0,
    queueDepth: 0
  };

  function track(packet) {
    const frameId = clampU16(packet?.frameId);
    if (!frameId) return false;
    pending.set(frameId, { packet, sentAt: now(), resendCount: 0 });
    stats.queueDepth = pending.size;
    return true;
  }

  function receive(line) {
    const ack = parseBlxAckLine(line);
    if (!ack.ok) return ack;
    if (pending.delete(ack.frameId)) stats.ackOk += 1;
    stats.lastAckFrameId = ack.frameId;
    stats.queueDepth = pending.size;
    return ack;
  }

  function collectDueResends() {
    const t = now();
    const due = [];
    for (const [frameId, item] of pending.entries()) {
      if (t - item.sentAt < timeoutMs) continue;
      stats.ackTimeout += 1;
      if (item.resendCount >= maxResend) {
        pending.delete(frameId);
        stats.dropped += 1;
        continue;
      }
      item.resendCount += 1;
      item.sentAt = t;
      stats.resend += 1;
      due.push(item.packet);
    }
    stats.queueDepth = pending.size;
    return due;
  }

  return Object.freeze({
    track,
    receive,
    collectDueResends,
    getStats: () => Object.freeze({ ...stats, queueDepth: pending.size, timeoutMs, maxResend })
  });
}

export function buildBlxDiffFrame({ previous = [], current = [] } = {}) {
  const prev = normalizeRgb(previous);
  const next = normalizeRgb(current);
  const pixels = Math.floor(Math.min(prev.length || next.length, next.length) / 3);
  const changed = [];
  for (let i = 0; i < pixels; i += 1) {
    const o = i * 3;
    if (prev[o] !== next[o] || prev[o + 1] !== next[o + 1] || prev[o + 2] !== next[o + 2]) {
      changed.push(i, next[o] || 0, next[o + 1] || 0, next[o + 2] || 0);
    }
  }
  return Object.freeze({
    mode: "DIFF_FRAME",
    changedPixels: changed.length / 4,
    totalPixels: pixels,
    entries: Object.freeze(changed)
  });
}
