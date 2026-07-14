import {
  RAW_SERIAL_PACKET_FORMAT,
  RAW_SERIAL_PACKET_LABEL,
  buildRawSerialAaLen16RgbPacket,
  expectedRawSerialPacketBytes as expectedRawSerialContractBytes,
  inspectRawSerialAaLen16RgbPacket
} from "../output/raw_serial_contract_22cb.js";

const LEGACY_SERIAL_FRAME_LOCKDOWN_REASON = "legacy_serial_frame_route_locked_by_11T";
const STEP22CH_SERIAL_ROUTE_CONTRACT = "STEP22CH_API_SERIAL_TEST_USES_SHARED_AA_LEN16_CONTRACT";

export function registerSerialRoutes(app, { serialController, expressRef, legacySerialFrameEnabled = false } = {}) {
  app.get("/api/serial/ports", async (req, res) => {
    try {
      const ports = await serialController.listPorts();
      res.json({ ok: true, ports });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message });
    }
  });

  app.get("/api/serial/status", (req, res) => {
    res.json(serialController.status());
  });

  app.post("/api/serial/open", async (req, res) => {
    try {
      const result = await serialController.open(req.body?.path, req.body?.baudRate);
      res.json(result);
    } catch (error) {
      const statusCode = String(error?.message || "") === "missing path" ? 400 : 500;
      res.status(statusCode).json({ ok: false, error: error.message });
    }
  });

  app.post("/api/serial/close", async (req, res) => {
    await serialController.close();
    res.json(serialController.status());
  });



  app.post("/api/serial/test", expressRef.json({ limit: "32kb" }), async (req, res) => {
    if (!serialController.status().open) return res.status(409).json({ ok: false, error: "serial closed" });
    const requestedProtocol = String(req.body?.protocol || RAW_SERIAL_PACKET_FORMAT).toLowerCase();
    const protocol = normalizeSerialProtocol(requestedProtocol);
    const pixels = clampInt(req.body?.pixels, 1, 2400, 160);
    const color = Array.isArray(req.body?.color) ? req.body.color : [255, 32, 0];
    const brightness = clampByte(req.body?.brightness, 20);
    const raw = new Uint8Array(pixels * 3);
    for (let i = 0; i < pixels; i += 1) {
      const o = i * 3;
      raw[o] = clampByte(color[0], 255);
      raw[o + 1] = clampByte(color[1], 32);
      raw[o + 2] = clampByte(color[2], 0);
    }
    const packet = buildSerialProtocolPacket(raw, protocol, brightness, pixels);
    const packetInspection = inspectRawSerialAaLen16RgbPacket(packet, pixels);
    if (!packetInspection.ok) {
      return res.status(400).json({
        ok: false,
        error: "serial test packet contract failed",
        requestedProtocol,
        forcedProtocol: RAW_SERIAL_PACKET_FORMAT,
        packetInspection
      });
    }
    const result = typeof serialController.writeAndDrain === "function"
      ? await serialController.writeAndDrain(packet, { errorPrefix: "Serial solid test write error", minOpenAgeMs: 2200 })
      : { ok: serialController.write(packet, "Serial solid test write error"), waitedMs: 0, bytes: packet.length };
    if (!result.ok) return res.status(409).json({ ok: false, error: result.error || "serial closed" });
    res.json({
      ok: true,
      protocol,
      requestedProtocol,
      forcedProtocol: RAW_SERIAL_PACKET_FORMAT,
      packetLabel: RAW_SERIAL_PACKET_LABEL,
      packetContract: STEP22CH_SERIAL_ROUTE_CONTRACT,
      pixels,
      brightness,
      bytes: packet.length,
      expectedBytes: expectedSerialProtocolBytes(protocol, pixels),
      waitedMs: result.waitedMs || 0,
      firstBytes: firstBytesHex(packet),
      packetInspection
    });
  });
  app.post("/api/serial/frame", expressRef.raw({ type: "application/octet-stream", limit: "2mb" }), (req, res) => {
    if (!legacySerialFrameEnabled) {
      return res.status(423).json({
        ok: false,
        error: "legacy serial frame route locked",
        reason: LEGACY_SERIAL_FRAME_LOCKDOWN_REASON,
        next: "use next-engine guarded live chain after explicit arm/commit"
      });
    }
    if (!serialController.status().open) return res.status(409).json({ ok: false, error: "serial closed" });
    if (!Buffer.isBuffer(req.body) || req.body.length < 5) return res.status(400).json({ ok: false, error: "empty frame" });

    const ok = serialController.write(req.body);
    if (!ok) return res.status(409).json({ ok: false, error: "serial closed" });
    res.json({ ok: true, bytes: req.body.length });
  });
}

function normalizeSerialProtocol(value) {
  const raw = String(value || "aa_len_rgb").toLowerCase();
  return raw === "aa_len_rgb" ? raw : "aa_len_rgb";
}

function clampInt(value, min, max, fallback) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function clampByte(value, fallback = 0) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(255, n));
}

function firstBytesHex(bytes, limit = 16) {
  return Array.from(bytes.subarray(0, Math.min(limit, bytes.length)))
    .map((v) => v.toString(16).toUpperCase().padStart(2, "0"))
    .join(" ");
}

export function buildSerialProtocolPacket(raw, protocol, brightness = 20, pixels = Math.floor(raw.length / 3)) {
  // STEP22CH: even the old /api/serial/test route uses the single shared packet contract.
  // Stale callers may still request raw_rgb/aa_rgb/aa_brightness_rgb/wled_adalight, but hardware output is forced to:
  //   0xAA + LEN16_PIXELS_LE + RGB
  return buildRawSerialAaLen16RgbPacket({ rgb: raw, pixels, brightness });
}

export function expectedSerialProtocolBytes(_protocol, pixels) {
  return expectedRawSerialContractBytes(pixels);
}
