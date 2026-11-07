import { createSerialOutputAdapter } from "../output/adapters/serial/index.js";
import { classifyAaLen16RgbPayload } from "./aa_len16_guard.js";
import { buildRawSerialAaLen16RgbPacket as buildContractPacket, expectedRawSerialPacketBytes as expectedContractPacketBytes, inspectRawSerialAaLen16RgbPacket as inspectContractPacket } from "../output/raw_serial_contract_22cb.js";
import { rawSerialLivePlan, rawSerialRecommendedFps, rawSerialPacketBytesForPixels, STEP22DM_SERIAL_STABILIZER_VERSION } from "../output/raw_serial_stabilizer_22dm.js";

const START_BYTE = 0xAA;
const DEFAULT_PIXELS = 160;
const MAX_PIXELS = 2400;

export const RAW_SERIAL_PACKET_FORMATS = {
  aa_len_rgb: { id: "aa_len_rgb", label: "0xAA + LEN16 + RGB", headerBytes: 3, hasLength: true, hasBrightness: false }
};
const DEFAULT_PACKET_FORMAT = "aa_len_rgb";
const STEP22CS_LEGACY_VERSION = "STEP22CS_REAL_RENDER_PIPELINE";
const STEP22CV_VERSION = "STEP22CV_LIVE_OUTPUT_ARM_GATE";
const STEP22CX_VERSION = "STEP22CX_BINARY_APP_MIRROR_LOW_LAG";
const STEP22CY_VERSION = "STEP22CY_HEADLESS_LIVE_OUTPUT_MODE";
const STEP22FH_VERSION = "STEP22FH_HARDWARE_LOCK_OUTPUT_VERIFY";
const STEP22FJ_VERSION = "STEP22FJ_WIRING_DIAGNOSIS_MATRIX";
const STEP22FK_VERSION = "STEP22FK_SAFE_ROLLING_BURNIN";
const STEP22FO_VERSION = "STEP22FO_GPIO4_5_12_13_SERIAL_TX_DIAG";
const STEP22FQ_VERSION = "STEP22FQ_LOCK_1000000_STABLE_SERIAL";
const STEP22FI_COMPAT_STAGE = "STEP22FI_WIRING_VERDICT_REPORT";
const STEP22FH_HARDWARE_LOCK = {
  version: STEP22FH_VERSION,
  profile: "esp32-4x300",
  outputs: 4,
  pixelsPerOutput: 300,
  totalPixels: 1200,
  pins: [4, 5, 12, 13],
  packetFormat: "aa_len_rgb",
  packetHeader: "0xAA + LEN16 pixels little endian + RGB",
  intent: "freeze real receiver contract before ArtNet/BLX work"
};


function buildStep22FjDiagnosis(checks) {
  const ok = checks.filter((c) => c.visible === true).map((c) => c.output);
  const fail = checks.filter((c) => c.visible === false).map((c) => c.output);
  const unknown = checks.filter((c) => c.visible == null).map((c) => c.output);
  const pin = (output) => STEP22FH_HARDWARE_LOCK.pins[output - 1];
  if (unknown.length > 0) {
    return {
      code: "INCOMPLETE_TEST",
      severity: "warn",
      title: "Dokonči ruční ověření všech čtyř výstupů.",
      actions: [
        `Zbývá otestovat OUT ${unknown.join(", ")}.`,
        "Nezkoušej live serial, dokud nejsou všechny čtyři výstupy označené OK/FAIL."
      ]
    };
  }
  if (fail.length === 0) {
    return {
      code: "READY_LOW_FPS_SERIAL",
      severity: "ok",
      title: "Všechny 4 výstupy prošly samostatným testem.",
      actions: [
        "Spusť low-FPS live serial na 10 FPS.",
        "Brightness drž nízko a zvyšuj FPS až po stabilitě: 10 → 15 → 20.",
        "ArtNet/BLX zatím neřeš; nejdřív potvrď čistý raw serial řetězec."
      ]
    };
  }
  if (fail.length === 4) {
    return {
      code: "NO_OUTPUTS_VISIBLE",
      severity: "fail",
      title: "Nesvítí žádný výstup.",
      actions: [
        "Zkontroluj COM port, baudrate 1000000 a zda je serial skutečně otevřený.",
        "Nahraj znovu receiver BudiLight_ESP32D_Node_4x300_AA_LEN16_RGB_STEP22FH.ino.",
        "Ověř společnou GND, napájení pásků a level shifter."
      ]
    };
  }
  if (ok.length === 1 && ok[0] === 1 && fail.join(",") === "2,3,4") {
    return {
      code: "ONLY_GPIO4_VISIBLE",
      severity: "fail",
      title: "Svítí jen OUT1/GPIO4.",
      actions: [
        "Ověř, že v ESP32 není starý GPIO4_ONLY ani 4x40 receiver.",
        "Zkontroluj datové vodiče na GPIO5, GPIO12 a GPIO13.",
        "Pokud boot test receiveru rozsvítí všechny pásky, hledej chybu v packet offsetech nebo v profilu aplikace."
      ]
    };
  }
  return {
    code: "PARTIAL_OUTPUT_FAIL",
    severity: "fail",
    title: `Nefunguje OUT ${fail.join(", ")} / GPIO ${fail.map(pin).join(", ")}.`,
    actions: [
      `Funguje OUT ${ok.join(", ") || "nic"}.`,
      "Když fail výstup nesvítí ani při boot testu receiveru, řeš kabel/pin/level shifter/data-in/napájení.",
      "Když boot test svítí, ale aplikace ne, řeš mapování segmentů, packet offset nebo starý profil."
    ]
  };
}

function make4StripProfile(id, perStrip) {
  return {
    id,
    label: `ESP32 4×${perStrip} px / pins 4,5,12,13`,
    pixels: perStrip * 4,
    segments: [
      { name: "GPIO4", offset: 0, pixels: perStrip },
      { name: "GPIO5", offset: perStrip, pixels: perStrip },
      { name: "GPIO12", offset: perStrip * 2, pixels: perStrip },
      { name: "GPIO13", offset: perStrip * 3, pixels: perStrip }
    ]
  };
}

export const RAW_SERIAL_PROFILES = {
  "esp32-4x40": make4StripProfile("esp32-4x40", 40),
  "esp32-4x144": make4StripProfile("esp32-4x144", 144),
  "esp32-4x300": make4StripProfile("esp32-4x300", 300),
  custom: { id: "custom", label: "CUSTOM pixel count", pixels: null, segments: [] }
};

export function registerRawSerialRoutes(app, { serialController, expressRef } = {}) {
  const jsonParser = expressRef?.json?.({ limit: "2mb" });
  const rawMirrorParser = expressRef?.raw?.({ type: "application/octet-stream", limit: "64kb" });
  const liveState = createRawSerialLiveState();
  const appMirrorState = createAppMirrorState();
  const adapterBridge = createRawSerialAdapterBridge({ serialController, getAppMirrorFrame: () => appMirrorState.latest });
  const liveArm = createRawSerialLiveArmGate({ onDisarm: () => adapterBridge.stop("disarmed") });

  app.get("/api/raw-serial/profiles", (_req, res) => {
    res.json({ ok: true, profiles: Object.values(RAW_SERIAL_PROFILES), defaultProfile: "esp32-4x300", hardwareLock: STEP22FH_HARDWARE_LOCK });
  });


  app.get("/api/raw-serial/stabilizer/plan", (req, res) => {
    try {
      const profile = resolveRawSerialProfile(req.query?.profile);
      const pixels = resolveRawSerialPixelCount(req.query || {}, null, profile);
      const serialStatus = typeof serialController?.status === "function" ? serialController.status() : { open: false, baudRate: Number(req.query?.baudRate || 1000000) };
      const baudRate = clampInt(req.query?.baudRate ?? serialStatus.baudRate, 9600, 3000000, 1000000);
      const requestedFps = clampInt(req.query?.fps, 1, 120, 30);
      const plan = rawSerialLivePlan({ profile: profile?.id || "custom", pixels, baudRate, requestedFps });
      res.json({
        ok: true,
        version: STEP22DM_SERIAL_STABILIZER_VERSION,
        plan,
        serial: serialStatus,
        profile,
        rules: [
          "serial latest-only queue keeps only newest pending frame",
          "wire budget is calculated from packet bytes, baudrate and safety factor",
          "4x300 at 1M baud is stable for bring-up, but not a full 60 FPS raw serial mode"
        ]
      });
    } catch (error) {
      res.status(400).json({ ok: false, error: error.message });
    }
  });

  app.get("/api/raw-serial/real-4x300/plan", (req, res) => {
    const profile = RAW_SERIAL_PROFILES["esp32-4x300"];
    const baudRate = clampInt(req.query?.baudRate, 9600, 3000000, 1000000);
    const requestedFps = clampInt(req.query?.fps, 1, 120, 60);
    const plan = rawSerialLivePlan({ profile: profile.id, pixels: profile.pixels, baudRate, requestedFps });
    res.json({
      ok: true,
      stage: "STEP22DN_REAL_4x300_PLAN",
      profile,
      packet: {
        format: DEFAULT_PACKET_FORMAT,
        header: "AA LEN_LO LEN_HI",
        pixels: profile.pixels,
        rgbBytes: profile.pixels * 3,
        totalBytes: rawSerialPacketBytesForPixels(profile.pixels)
      },
      plan,
      receiverDefines: { STRIPS: 4, LEDS_PER_STRIP: 300, TOTAL_LEDS: 1200, PINS: [4, 5, 14, 15] },
      warning: plan.capped ? `Requested ${requestedFps} FPS is above safe raw serial budget at ${baudRate} baud.` : "Requested FPS is inside calculated raw serial budget."
    });
  });

  app.get("/api/raw-serial/status", (_req, res) => {
    const serialStatus = typeof serialController?.status === "function" ? serialController.status() : { open: false };
    res.json({
      ok: true,
      protocol: DEFAULT_PACKET_FORMAT,
      packetFormats: Object.values(RAW_SERIAL_PACKET_FORMATS),
      defaultPacketFormat: DEFAULT_PACKET_FORMAT,
      format: "STEP22FH fixed hardware lock: ESP32D 4x300 GPIO4/5/12/13, aa_len_rgb only",
      hardwareLock: STEP22FH_HARDWARE_LOCK,
      startByte: START_BYTE,
      maxPixels: MAX_PIXELS,
      profiles: Object.values(RAW_SERIAL_PROFILES),
      livePatterns: ["moving-dot", "scan-bars", "pulse", "segment-walk"],
      frameSources: ["rgb-array", "flat-rgb", "pixels-rgb", "frame-rgb", "frame-pixels"],
      serial: serialStatus
    });
  });



  app.get("/api/raw-serial/hardware-lock", (_req, res) => {
    const serial = serialController?.status?.() || { open: false };
    const profile = RAW_SERIAL_PROFILES[STEP22FH_HARDWARE_LOCK.profile];
    const packetBytes = expectedRawSerialPacketBytes({ pixels: profile.pixels, packetFormat: DEFAULT_PACKET_FORMAT });
    res.json({
      ok: true,
      stage: STEP22FQ_VERSION,
      hardwareLock: STEP22FH_HARDWARE_LOCK,
      profile,
      serial,
      packet: {
        format: DEFAULT_PACKET_FORMAT,
        bytes: packetBytes,
        rgbBytes: profile.pixels * 3,
        headerBytes: 3,
        len16Pixels: profile.pixels
      },
      recommended: {
        baudRate: 1000000,
        safeTestFps: 10,
        maxRawSerialFpsNote: "4x300 raw RGB is heavy; start 10-15 FPS, then raise only after stable output."
      }
    });
  });

  app.post("/api/raw-serial/output-verify", jsonParser, async (req, res) => {
    try {
      if (!serialController?.status?.().open) {
        return res.status(409).json({ ok: false, error: "serial closed", stage: STEP22FO_VERSION });
      }
      const profile = RAW_SERIAL_PROFILES["esp32-4x300"];
      const output = clampInt(req.body?.output, 1, 4, 1);
      const brightness = clampByte(req.body?.brightness, 48);
      const color = normalizeColor(req.body?.color, [255, 0, 0]);
      const blackoutOthers = req.body?.blackoutOthers !== false;
      const rgb = buildOutputVerifyRgb({ profile, output, color, blackoutOthers });
      const packet = buildRawSerialPacket(rgb, { pixels: profile.pixels, brightness, packetFormat: DEFAULT_PACKET_FORMAT });
      const packetInspection = assertRawSerialPacketContract(packet, { pixels: profile.pixels, source: "raw-serial-output-verify" });
      const result = typeof serialController.writeAndDrain === "function"
        ? await serialController.writeAndDrain(packet, { errorPrefix: "STEP22FH output verify write error", minOpenAgeMs: 3200 })
        : { ok: serialController.write(packet, "STEP22FH output verify write error"), waitedMs: 0, bytes: packet.length };
      if (!result.ok) return res.status(409).json({ ok: false, error: result.error || "serial write failed", stage: STEP22FO_VERSION });
      const segment = profile.segments[output - 1];
      res.json({
        ok: true,
        stage: STEP22FQ_VERSION,
        mode: "output-verify",
        output,
        pin: STEP22FH_HARDWARE_LOCK.pins[output - 1],
        segment,
        profile: profile.id,
        pixels: profile.pixels,
        pixelsPerOutput: STEP22FH_HARDWARE_LOCK.pixelsPerOutput,
        brightness,
        color,
        blackoutOthers,
        bytes: packet.length,
        expectedBytes: expectedRawSerialPacketBytes({ pixels: profile.pixels, packetFormat: DEFAULT_PACKET_FORMAT }),
        packetInspection,
        waitedMs: result.waitedMs || 0,
        firstBytes: firstBytesHex(packet, 24),
        expectedVisible: `Only GPIO${STEP22FH_HARDWARE_LOCK.pins[output - 1]} / strip ${output} should light. Other outputs should be black.`
      });
    } catch (error) {
      res.status(400).json({ ok: false, error: error.message, stage: STEP22FO_VERSION });
    }
  });



  app.post("/api/raw-serial/output-verify/report", jsonParser, (req, res) => {
    try {
      const profile = RAW_SERIAL_PROFILES["esp32-4x300"];
      const serial = serialController?.status?.() || { open: false };
      const checks = Array.isArray(req.body?.checks) ? req.body.checks.slice(0, 4) : [];
      const normalized = [1,2,3,4].map((output) => {
        const found = checks.find((c) => Number(c?.output) === output) || {};
        return {
          output,
          pin: STEP22FH_HARDWARE_LOCK.pins[output - 1],
          segment: profile.segments[output - 1],
          visible: found.visible === true ? true : found.visible === false ? false : null,
          note: String(found.note || "").slice(0, 240),
          testedAt: found.testedAt || null
        };
      });
      const okCount = normalized.filter((c) => c.visible === true).length;
      const failCount = normalized.filter((c) => c.visible === false).length;
      const unknownCount = normalized.filter((c) => c.visible == null).length;
      const verdict = okCount === 4 ? "PASS_4_OUTPUTS" : failCount > 0 ? "WIRING_OR_MAPPING_FAIL" : "INCOMPLETE";
      const diagnosis = buildStep22FjDiagnosis(normalized);
      const report = {
        ok: true,
        stage: STEP22FJ_VERSION,
        createdAt: new Date().toISOString(),
        verdict,
        summary: { okCount, failCount, unknownCount },
        hardwareLock: STEP22FH_HARDWARE_LOCK,
        profile,
        serial,
        checks: normalized,
        diagnosis,
        clientDiagnosis: req.body?.clientDiagnosis || null,
        next: verdict === "PASS_4_OUTPUTS"
          ? "Pokračuj na low-FPS live serial run: 10 FPS, 4x300, potom zvyšovat až po stabilitě."
          : "Neřeš live režim. Oprav nejdřív konkrétní pin/strip podle failed výstupu."
      };
      res.json(report);
    } catch (error) {
      res.status(400).json({ ok: false, error: error.message, stage: STEP22FJ_VERSION });
    }
  });


  app.post("/api/raw-serial/output-burnin/report", jsonParser, (req, res) => {
    try {
      const serial = serialController?.status?.() || { open: false };
      const profile = RAW_SERIAL_PROFILES["esp32-4x300"];
      const samples = Array.isArray(req.body?.samples) ? req.body.samples.slice(-240) : [];
      const okSamples = samples.filter((s) => s?.ok === true).length;
      const failSamples = samples.filter((s) => s?.ok === false).length;
      const outputs = [1, 2, 3, 4].map((output) => ({
        output,
        pin: STEP22FH_HARDWARE_LOCK.pins[output - 1],
        sent: samples.filter((s) => Number(s?.output) === output).length,
        errors: samples.filter((s) => Number(s?.output) === output && s?.ok === false).length
      }));
      const durationSec = Math.max(0, Number(req.body?.durationSec || 0));
      const verdict = failSamples > 0
        ? "BURNIN_FAIL"
        : durationSec >= 60 && okSamples >= 16
          ? "BURNIN_PASS"
          : "BURNIN_SHORT_SAMPLE";
      res.json({
        ok: true,
        stage: STEP22FK_VERSION,
        createdAt: new Date().toISOString(),
        verdict,
        durationSec,
        summary: { okSamples, failSamples, sampleCount: samples.length },
        outputs,
        hardwareLock: STEP22FH_HARDWARE_LOCK,
        profile,
        serial,
        next: verdict === "BURNIN_PASS"
          ? "Můžeš přejít na low-FPS live serial: začni 10 FPS, brightness nízko, bez ArtNet/BLX."
          : "Ještě nepouštěj live serial. Nejdřív opakuj rolling burn-in déle nebo oprav chyby v konkrétním výstupu."
      });
    } catch (error) {
      res.status(400).json({ ok: false, error: error.message, stage: STEP22FK_VERSION });
    }
  });


  app.post("/api/raw-serial/packet-preview", jsonParser, (req, res) => {
    try {
      const profile = resolveRawSerialProfile(req.body?.profile);
      const pixels = resolveRawSerialPixelCount(req.body || {}, null, profile);
      const brightness = clampByte(req.body?.brightness, 32);
      const packetFormat = resolveRawSerialPacketFormat(req.body?.packetFormat);
      const color = normalizeColor(req.body?.color, [255, 0, 0]);
      const rgb = buildSolidRgb({ pixels, color });
      const packet = buildRawSerialPacket(rgb, { pixels, brightness, packetFormat });
      res.json({
        ok: true,
        mode: "packet-preview",
        protocol: packetFormat,
        packetFormat,
        packetLabel: RAW_SERIAL_PACKET_FORMATS[packetFormat]?.label || packetFormat,
        profile: profile?.id || null,
        profileLabel: profile?.label || "CUSTOM",
        pixels,
        brightness,
        rgbBytes: pixels * 3,
        headerBytes: RAW_SERIAL_PACKET_FORMATS[packetFormat]?.headerBytes ?? 0,
        bytes: packet.length,
        expectedBytes: expectedRawSerialPacketBytes({ pixels, packetFormat }),
        packetInspection: assertRawSerialPacketContract(packet, { pixels, source: "raw-serial-packet-preview" }),
        firstBytes: firstBytesHex(packet, 24),
        receiverHints: buildReceiverHints({ pixels, packetFormat, profile }),
        checklist: buildPacketChecklist({ pixels, packetFormat, profile })
      });
    } catch (error) {
      res.status(400).json({ ok: false, error: error.message });
    }
  });


  app.post("/api/raw-serial/pretest/contract-snapshot", jsonParser, (req, res) => {
    try {
      const profile = resolveRawSerialProfile(req.body?.profile);
      const pixels = resolveRawSerialPixelCount(req.body || {}, null, profile);
      const brightness = clampByte(req.body?.brightness, 32);
      const packetFormat = resolveRawSerialPacketFormat(req.body?.packetFormat);
      const probes = buildPretestContractProbes({ pixels, brightness, packetFormat, profile });
      const allOk = probes.every((probe) => probe.packetInspection?.ok === true);
      res.status(allOk ? 200 : 500).json({
        ok: allOk,
        mode: "pretest-contract-snapshot",
        stage: "STEP22CG",
        contract: "AA_LEN16_PIXELS_LE_RGB_ONLY",
        protocol: packetFormat,
        profile: profile?.id || null,
        pixels,
        expectedBytes: expectedRawSerialPacketBytes({ pixels, packetFormat }),
        receiverExpected: {
          boot: "BDL_BOOT",
          ackPrefix: "BDL_ACK",
          okWhen: "frames rises and badStart/badLen stay near zero"
        },
        probes
      });
    } catch (error) {
      res.status(400).json({ ok: false, error: error.message });
    }
  });

  const frameHandler = async (req, res) => {
    try {
      if (!serialController?.status?.().open) {
        return res.status(409).json({ ok: false, error: "serial closed" });
      }

      const profile = resolveRawSerialProfile(req.body?.profile);
      const raw = normalizeRgbPayload(req.body);
      const pixels = resolveRawSerialPixelCount(req.body, raw, profile);
      const brightness = clampByte(req.body?.brightness, 255);
      const packetFormat = resolveRawSerialPacketFormat(req.body?.packetFormat);
      const packet = buildRawSerialPacket(raw, { pixels, brightness, packetFormat });
      const packetInspection = assertRawSerialPacketContract(packet, { pixels, source: "raw-serial-frame" });
      const result = typeof serialController.writeAndDrain === "function"
        ? await serialController.writeAndDrain(packet, { errorPrefix: "Raw serial frame write error", minOpenAgeMs: 3200 })
        : { ok: serialController.write(packet, "Raw serial frame write error"), waitedMs: 0, bytes: packet.length };

      if (!result.ok) return res.status(409).json({ ok: false, error: result.error || "serial write failed" });
      res.json({
        ok: true,
        protocol: packetFormat,
        profile: profile?.id || null,
        pixels,
        brightness,
        bytes: packet.length,
        expectedBytes: expectedRawSerialPacketBytes({ pixels, packetFormat }),
        packetInspection,
        waitedMs: result.waitedMs || 0,
        firstBytes: firstBytesHex(packet)
      });
    } catch (error) {
      res.status(400).json({ ok: false, error: error.message });
    }
  };

  app.post("/api/raw-serial/frame", jsonParser, frameHandler);

  app.post("/api/raw-serial/external-frame", jsonParser, async (req, res) => {
    try {
      if (!serialController?.status?.().open) {
        return res.status(409).json({ ok: false, error: "serial closed" });
      }

      const profile = resolveRawSerialProfile(req.body?.profile);
      const extracted = extractExternalRgbFrame(req.body || {});
      const pixels = resolveRawSerialPixelCount(req.body, extracted.rgb, profile);
      const brightness = clampByte(req.body?.brightness, 255);
      const packetFormat = resolveRawSerialPacketFormat(req.body?.packetFormat);
      const packet = buildRawSerialPacket(extracted.rgb, { pixels, brightness, packetFormat });
      const packetInspection = assertRawSerialPacketContract(packet, { pixels, source: "raw-serial-external-frame" });
      const result = typeof serialController.writeAndDrain === "function"
        ? await serialController.writeAndDrain(packet, { errorPrefix: "Raw serial external frame write error", minOpenAgeMs: 3200 })
        : { ok: serialController.write(packet, "Raw serial external frame write error"), waitedMs: 0, bytes: packet.length };

      if (!result.ok) return res.status(409).json({ ok: false, error: result.error || "serial write failed" });
      res.json({
        ok: true,
        protocol: packetFormat,
        mode: "external-frame",
        sourceFormat: extracted.sourceFormat,
        profile: profile?.id || null,
        pixels,
        brightness,
        bytes: packet.length,
        expectedBytes: expectedRawSerialPacketBytes({ pixels, packetFormat }),
        packetInspection,
        waitedMs: result.waitedMs || 0,
        firstBytes: firstBytesHex(packet)
      });
    } catch (error) {
      res.status(400).json({ ok: false, error: error.message });
    }
  });

  app.post("/api/raw-serial/live/external-frame", jsonParser, async (req, res) => {
    req.url = "/api/raw-serial/external-frame";
    return app._router?.handle ? res.status(410).json({ ok: false, error: "use /api/raw-serial/external-frame" }) : res.status(410).json({ ok: false, error: "use /api/raw-serial/external-frame" });
  });

  app.post("/api/raw-serial/solid", jsonParser, async (req, res) => {
    const profile = resolveRawSerialProfile(req.body?.profile);
    const pixels = resolveRawSerialPixelCount(req.body, null, profile);
    const brightness = clampByte(req.body?.brightness, 32);
    const color = normalizeColor(req.body?.color, [255, 0, 0]);
    req.body = {
      ...req.body,
      pixels,
      brightness,
      rgb: buildSolidRgb({ pixels, color })
    };
    return frameHandler(req, res);
  });

  app.post("/api/raw-serial/pattern", jsonParser, async (req, res) => {
    const profile = resolveRawSerialProfile(req.body?.profile);
    const pixels = resolveRawSerialPixelCount(req.body, null, profile);
    const brightness = clampByte(req.body?.brightness, 32);
    const pattern = String(req.body?.pattern || "first-pixel").trim().toLowerCase();
    const rgb = buildPatternRgb({ pixels, pattern, profile });
    req.body = {
      ...req.body,
      pixels,
      brightness,
      rgb
    };
    return frameHandler(req, res);
  });

  app.get("/api/raw-serial/live/status", (_req, res) => {
    const serial = serialController?.status?.() || { open: false };
    res.json({ ok: true, live: rawSerialLiveSnapshot(liveState, serial), serial });
  });

  app.get("/api/raw-serial/live/health", (_req, res) => {
    const serial = serialController?.status?.() || { open: false };
    res.json({ ok: true, health: rawSerialLiveHealth(liveState, serial), live: rawSerialLiveSnapshot(liveState, serial), serial });
  });

  app.post("/api/raw-serial/live/step", jsonParser, async (req, res) => {
    try {
      if (!serialController?.status?.().open) {
        return res.status(409).json({ ok: false, error: "serial closed" });
      }
      const profile = resolveRawSerialProfile(req.body?.profile);
      const pixels = resolveRawSerialPixelCount(req.body, null, profile);
      const brightness = clampByte(req.body?.brightness, 32);
      const pattern = String(req.body?.pattern || "segment-walk").trim().toLowerCase();
      const frame = clampInt(req.body?.frame, 0, 1000000000, 0);
      const rgb = buildLivePatternRgb({ pixels, pattern, frame, profile });
      const packetFormat = resolveRawSerialPacketFormat(req.body?.packetFormat);
      const packet = buildRawSerialPacket(rgb, { pixels, brightness, packetFormat });
      const packetInspection = assertRawSerialPacketContract(packet, { pixels, source: "raw-serial-live-step" });
      const result = typeof serialController.writeAndDrain === "function"
        ? await serialController.writeAndDrain(packet, { errorPrefix: "Raw serial live step write error", minOpenAgeMs: 3200 })
        : { ok: serialController.write(packet, "Raw serial live step write error"), waitedMs: 0, bytes: packet.length };
      if (!result.ok) return res.status(409).json({ ok: false, error: result.error || "serial write failed" });
      res.json({
        ok: true,
        protocol: packetFormat,
        mode: "live-step",
        profile: profile?.id || null,
        pixels,
        brightness,
        pattern,
        frame,
        bytes: packet.length,
        expectedBytes: expectedRawSerialPacketBytes({ pixels, packetFormat }),
        packetInspection,
        waitedMs: result.waitedMs || 0,
        firstBytes: firstBytesHex(packet)
      });
    } catch (error) {
      res.status(400).json({ ok: false, error: error.message });
    }
  });

  app.post("/api/raw-serial/live/start", jsonParser, (req, res) => {
    try {
      if (!serialController?.status?.().open) {
        return res.status(409).json({ ok: false, error: "serial closed" });
      }
      startRawSerialLiveStream(liveState, serialController, req.body || {});
      res.json({ ok: true, live: rawSerialLiveSnapshot(liveState) });
    } catch (error) {
      res.status(400).json({ ok: false, error: error.message });
    }
  });

  app.post("/api/raw-serial/live/stop", jsonParser, (_req, res) => {
    stopRawSerialLiveStream(liveState, "manual");
    res.json({ ok: true, live: rawSerialLiveSnapshot(liveState) });
  });

  app.post("/api/raw-serial/app-mirror/frame", jsonParser, (req, res) => {
    try {
      const extracted = extractExternalRgbFrame(req.body || {});
      const width = clampInt(req.body?.width ?? req.body?.frame?.width, 0, 10000, 0);
      const height = clampInt(req.body?.height ?? req.body?.frame?.height, 0, 10000, 0);
      appMirrorState.latest = {
        rgb: extracted.rgb,
        sourceFormat: extracted.sourceFormat,
        pixels: Math.floor(extracted.rgb.length / 3),
        width,
        height,
        frameId: clampInt(req.body?.frameId ?? req.body?.frame?.frameId, 0, 1000000000, appMirrorState.frameId + 1),
        receivedAt: Date.now(),
        source: String(req.body?.source || req.body?.frame?.source || "browser-framebus")
      };
      appMirrorState.frameId = appMirrorState.latest.frameId;
      appMirrorState.received += 1;
      appMirrorState.lastError = "";
      res.json({ ok: true, mirror: appMirrorSnapshot(appMirrorState) });
    } catch (error) {
      appMirrorState.lastError = String(error?.message || error || "app_mirror_frame_failed");
      res.status(400).json({ ok: false, error: appMirrorState.lastError, mirror: appMirrorSnapshot(appMirrorState) });
    }
  });


  app.post("/api/raw-serial/app-mirror/frame-bin", rawMirrorParser, (req, res) => {
    try {
      const buf = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || []);
      if (!buf.length || buf.length % 3 !== 0) throw new Error("binary mirror body must be RGB bytes, length divisible by 3");
      const width = clampInt(req.query?.width, 0, 10000, 0);
      const height = clampInt(req.query?.height, 0, 10000, 0);
      appMirrorState.latest = {
        rgb: Uint8Array.from(buf),
        sourceFormat: "binary-rgb8",
        pixels: Math.floor(buf.length / 3),
        width,
        height,
        frameId: clampInt(req.query?.frameId, 0, 1000000000, appMirrorState.frameId + 1),
        receivedAt: Date.now(),
        source: String(req.query?.source || "performance-framebus-binary")
      };
      appMirrorState.frameId = appMirrorState.latest.frameId;
      appMirrorState.received += 1;
      appMirrorState.binaryReceived = (appMirrorState.binaryReceived || 0) + 1;
      appMirrorState.lastError = "";
      res.json({ ok: true, mirror: appMirrorSnapshot(appMirrorState) });
    } catch (error) {
      appMirrorState.lastError = String(error?.message || error || "app_mirror_binary_frame_failed");
      res.status(400).json({ ok: false, error: appMirrorState.lastError, mirror: appMirrorSnapshot(appMirrorState) });
    }
  });

  app.get("/api/raw-serial/app-mirror/status", (_req, res) => {
    res.json({ ok: true, mirror: appMirrorSnapshot(appMirrorState) });
  });


  app.get("/api/raw-serial/arm/status", (_req, res) => {
    res.json({ ok: true, arm: liveArm.snapshot(), bridge: adapterBridge.snapshot() });
  });

  app.post("/api/raw-serial/arm", jsonParser, (req, res) => {
    const ttlMs = clampInt(req.body?.ttlMs, 5000, 300000, 90000);
    const reason = String(req.body?.reason || "manual-arm").slice(0, 120);
    liveArm.arm({ ttlMs, reason });
    res.json({ ok: true, arm: liveArm.snapshot(), bridge: adapterBridge.snapshot() });
  });

  app.post("/api/raw-serial/disarm", jsonParser, (req, res) => {
    const reason = String(req.body?.reason || "manual-disarm").slice(0, 120);
    liveArm.disarm(reason);
    res.json({ ok: true, arm: liveArm.snapshot(), bridge: adapterBridge.snapshot() });
  });

  app.get("/api/raw-serial/adapter/status", (_req, res) => {
    const serialStatus = typeof serialController?.status === "function" ? serialController.status() : { open: false };
    res.json({ ok: true, bridge: adapterBridge.snapshot(), serial: serialStatus });
  });

  app.post("/api/raw-serial/adapter/start", jsonParser, (req, res) => {
    try {
      if (!liveArm.isArmed()) {
        return res.status(423).json({ ok: false, error: "LIVE_OUTPUT_NOT_ARMED", message: "Press ARM LIVE OUTPUT before START LIVE BRIDGE.", arm: liveArm.snapshot(), bridge: adapterBridge.snapshot() });
      }
      adapterBridge.start(req.body || {});
      res.json({ ok: true, arm: liveArm.snapshot(), bridge: adapterBridge.snapshot() });
    } catch (error) {
      res.status(400).json({ ok: false, error: error.message, bridge: adapterBridge.snapshot() });
    }
  });

  app.post("/api/raw-serial/adapter/stop", jsonParser, (_req, res) => {
    adapterBridge.stop("manual");
    res.json({ ok: true, bridge: adapterBridge.snapshot() });
  });

  app.post("/api/raw-serial/adapter/step", jsonParser, (req, res) => {
    try {
      if (!serialController?.status?.().open) {
        return res.status(409).json({ ok: false, error: "serial closed", bridge: adapterBridge.snapshot() });
      }
      const result = adapterBridge.step(req.body || {});
      res.json({ ok: true, ...result, bridge: adapterBridge.snapshot() });
    } catch (error) {
      res.status(400).json({ ok: false, error: error.message, bridge: adapterBridge.snapshot() });
    }
  });

}

export function buildRawSerialLenRgbPacket(rawRgb, { pixels = DEFAULT_PIXELS, brightness = 255 } = {}) {
  return buildRawSerialPacket(rawRgb, { pixels, brightness, packetFormat: "aa_len_rgb" });
}

export function buildRawSerialPacket(rawRgb, { pixels = DEFAULT_PIXELS, brightness = 255, packetFormat = DEFAULT_PACKET_FORMAT } = {}) {
  // STEP22CD: server raw-serial routes no longer maintain their own packet writer.
  // Even if a stale caller passes packetFormat=aa_brightness_rgb/aa_rgb/raw_rgb, the shared contract builder
  // always emits the single live hardware contract: 0xAA + LEN16_PIXELS_LE + RGB.
  resolveRawSerialPacketFormat(packetFormat);
  const count = clampInt(pixels, 1, MAX_PIXELS, DEFAULT_PIXELS);
  return buildContractPacket({ rgb: rawRgb, pixels: count, brightness });
}

export function expectedRawSerialPacketBytes({ pixels = DEFAULT_PIXELS, packetFormat = DEFAULT_PACKET_FORMAT } = {}) {
  resolveRawSerialPacketFormat(packetFormat);
  const count = clampInt(pixels, 1, MAX_PIXELS, DEFAULT_PIXELS);
  return expectedContractPacketBytes(count);
}

export function inspectRawSerialPacketContract(packet, { pixels = DEFAULT_PIXELS, variableLengthEnabled = false } = {}) {
  const expectedPixels = clampInt(pixels, 1, MAX_PIXELS, DEFAULT_PIXELS);
  // Keep the STEP22BZ telemetry shape stable for existing UI/tests, but packet construction is now shared.
  const inspection = classifyAaLen16RgbPayload(packet, {
    expectedPixels,
    variableLengthEnabled,
    maxPixels: MAX_PIXELS
  });
  const firstBytes = Buffer.isBuffer(packet) ? firstBytesHex(packet, 12) : "";
  return {
    ...inspection,
    contract: "STEP22BZ_AA_LEN16_PIXELS_LE_RGB_ONLY",
    packetFormat: DEFAULT_PACKET_FORMAT,
    packetLabel: RAW_SERIAL_PACKET_FORMATS[DEFAULT_PACKET_FORMAT].label,
    expectedPixels,
    firstBytes
  };
}

function assertRawSerialPacketContract(packet, { pixels = DEFAULT_PIXELS, source = "raw-serial" } = {}) {
  const inspection = inspectRawSerialPacketContract(packet, { pixels });
  if (!inspection.ok) {
    const err = new Error(`${source}: ${inspection.reason}`);
    err.code = "RAW_SERIAL_CONTRACT_FAILED";
    err.inspection = inspection;
    throw err;
  }
  return inspection;
}

export function extractExternalRgbFrame(body = {}) {
  const candidates = [
    [body.rgb, "rgb-array"],
    [body.frame?.rgb, "frame-rgb"],
    [body.payload?.rgb, "payload-rgb"],
    [body.data?.rgb, "data-rgb"],
    [body.pixels, "pixels-rgb"],
    [body.frame?.pixels, "frame-pixels"],
    [body.payload?.pixels, "payload-pixels"],
    [body.data?.pixels, "data-pixels"]
  ];

  for (const [value, sourceFormat] of candidates) {
    if (Array.isArray(value) || Buffer.isBuffer(value) || value instanceof Uint8Array) {
      return { rgb: normalizeRgbLike(value), sourceFormat };
    }
  }

  throw new Error("missing external RGB frame; expected rgb array or pixels array");
}

function normalizeRgbLike(value) {
  if (Array.isArray(value) && value.length > 0 && Array.isArray(value[0])) {
    const out = [];
    for (const pixel of value) {
      out.push(clampByte(pixel?.[0], 0), clampByte(pixel?.[1], 0), clampByte(pixel?.[2], 0));
    }
    return out;
  }

  if (Array.isArray(value) && value.length > 0 && typeof value[0] === "object" && value[0] !== null && !Array.isArray(value[0])) {
    const out = [];
    for (const pixel of value) {
      out.push(clampByte(pixel.r ?? pixel.red, 0), clampByte(pixel.g ?? pixel.green, 0), clampByte(pixel.b ?? pixel.blue, 0));
    }
    return out;
  }

  return Array.from(value, (v) => clampByte(v, 0));
}

function normalizeRgbPayload(bodyOrArray) {
  const value = Array.isArray(bodyOrArray) || Buffer.isBuffer(bodyOrArray) || bodyOrArray instanceof Uint8Array
    ? bodyOrArray
    : bodyOrArray?.rgb;
  if (!Array.isArray(value) && !Buffer.isBuffer(value) && !(value instanceof Uint8Array)) {
    throw new Error("missing rgb array");
  }
  const arr = Array.from(value, (v) => clampByte(v, 0));
  if (arr.length < 3) throw new Error("rgb array too short");
  return arr;
}

function normalizeColor(value, fallback) {
  const input = Array.isArray(value) ? value : fallback;
  return [clampByte(input[0], fallback[0]), clampByte(input[1], fallback[1]), clampByte(input[2], fallback[2])];
}

function buildSolidRgb({ pixels, color }) {
  const raw = new Array(pixels * 3);
  for (let i = 0; i < pixels; i += 1) {
    const o = i * 3;
    raw[o] = color[0];
    raw[o + 1] = color[1];
    raw[o + 2] = color[2];
  }
  return raw;
}

function buildPatternRgb({ pixels, pattern, profile = null }) {
  const raw = new Array(pixels * 3).fill(0);
  for (let i = 0; i < pixels; i += 1) {
    const o = i * 3;
    if (pattern === "first-pixel") {
      raw[o] = i === 0 ? 255 : 0;
      raw[o + 1] = i === 0 ? 255 : 0;
      raw[o + 2] = i === 0 ? 255 : 0;
    } else if (pattern === "locator") {
      raw[o] = i % 10 === 0 ? 255 : 0;
      raw[o + 1] = i % 10 === 0 ? 80 : 0;
      raw[o + 2] = i % 10 === 0 ? 0 : 16;
    } else if (pattern === "gradient") {
      const f = pixels <= 1 ? 0 : i / (pixels - 1);
      raw[o] = Math.round(255 * (1 - f));
      raw[o + 1] = Math.round(255 * f);
      raw[o + 2] = Math.round(96 + 96 * Math.sin(f * Math.PI));
    } else if (pattern === "segment-locator") {
      const segment = profile?.segments?.find((seg) => i >= seg.offset && i < seg.offset + seg.pixels);
      const local = segment ? i - segment.offset : i;
      const segmentIndex = profile?.segments?.indexOf(segment) ?? 0;
      const marker = local === 0 || local === Math.max(0, (segment?.pixels || pixels) - 1) || local % 10 === 0;
      raw[o] = marker ? [255, 0, 80, 255, 0, 120, 255, 32][segmentIndex % 8] : 0;
      raw[o + 1] = marker ? [60, 255, 180, 0, 120, 0, 255, 64][segmentIndex % 8] : 0;
      raw[o + 2] = marker ? [0, 80, 255, 220, 255, 120, 0, 255][segmentIndex % 8] : 10;
    } else if (pattern === "rgb-bars") {
      const third = Math.max(1, Math.ceil(pixels / 3));
      raw[o] = i < third ? 255 : 0;
      raw[o + 1] = i >= third && i < third * 2 ? 255 : 0;
      raw[o + 2] = i >= third * 2 ? 255 : 0;
    } else {
      raw[o] = i === 0 ? 255 : 0;
      raw[o + 1] = i === 0 ? 255 : 0;
      raw[o + 2] = i === 0 ? 255 : 0;
    }
  }
  return raw;
}



function buildPretestContractProbes({ pixels, brightness, packetFormat, profile }) {
  const probeSpecs = [
    { id: "blackout", label: "all LEDs off", rgb: buildSolidRgb({ pixels, color: [0, 0, 0] }) },
    { id: "first-pixel-white", label: "first pixel white", rgb: buildPatternRgb({ pixels, pattern: "first-pixel", profile }) },
    { id: "segment-locator", label: "segment locator / strip boundaries", rgb: buildPatternRgb({ pixels, pattern: "segment-locator", profile }) },
    { id: "rgb-bars", label: "RGB order bars", rgb: buildPatternRgb({ pixels, pattern: "rgb-bars", profile }) }
  ];
  return probeSpecs.map((spec) => {
    const packet = buildRawSerialPacket(spec.rgb, { pixels, brightness, packetFormat });
    const packetInspection = assertRawSerialPacketContract(packet, { pixels, source: `raw-serial-pretest-${spec.id}` });
    return {
      id: spec.id,
      label: spec.label,
      bytes: packet.length,
      expectedBytes: expectedRawSerialPacketBytes({ pixels, packetFormat }),
      firstBytes: firstBytesHex(packet, 24),
      packetInspection
    };
  });
}

function createAppMirrorState() {
  return { latest: null, received: 0, frameId: 0, lastError: "", binaryReceived: 0 };
}

function appMirrorSnapshot(state) {
  const now = Date.now();
  const latest = state.latest || null;
  return {
    available: Boolean(latest),
    received: state.received || 0,
    frameId: state.frameId || 0,
    pixels: latest?.pixels || 0,
    width: latest?.width || 0,
    height: latest?.height || 0,
    source: latest?.source || "none",
    sourceFormat: latest?.sourceFormat || "none",
    ageMs: latest?.receivedAt ? Math.max(0, now - latest.receivedAt) : null,
    lastError: state.lastError || "",
    binaryReceived: state.binaryReceived || 0
  };
}

function fitRgbToPixels(rgb, pixels) {
  const outLen = Math.max(1, pixels) * 3;
  const out = new Array(outLen).fill(0);
  const src = Array.isArray(rgb) || Buffer.isBuffer(rgb) || rgb instanceof Uint8Array ? rgb : [];
  for (let i = 0; i < Math.min(outLen, src.length); i += 1) out[i] = clampByte(src[i], 0);
  return out;
}

function createRawSerialLiveState() {
  return {
    running: false,
    timer: null,
    startedAt: 0,
    stoppedAt: 0,
    stopReason: "idle",
    frame: 0,
    sent: 0,
    dropped: 0,
    bytesSent: 0,
    lastPacketBytes: 0,
    lastPacketInspection: null,
    lastError: null,
    lastAt: 0,
    lastFrameDurationMs: 0,
    maxFrameDurationMs: 0,
    lastStatus: "IDLE",
    recentSent: [],
    config: {
      pixels: DEFAULT_PIXELS,
      brightness: 32,
      fps: 20,
      pattern: "moving-dot",
      packetFormat: DEFAULT_PACKET_FORMAT
    }
  };
}

function startRawSerialLiveStream(state, serialController, body = {}) {
  stopRawSerialLiveStream(state, "restart");
  state.config = {
    profile: resolveRawSerialProfile(body?.profile)?.id || null,
    pixels: resolveRawSerialPixelCount(body, null, resolveRawSerialProfile(body?.profile)),
    brightness: clampByte(body?.brightness, 32),
    fps: clampInt(body?.fps, 1, 60, 20),
    pattern: String(body?.pattern || "moving-dot").trim().toLowerCase(),
    packetFormat: resolveRawSerialPacketFormat(body?.packetFormat)
  };
  state.running = true;
  state.startedAt = Date.now();
  state.stoppedAt = 0;
  state.stopReason = "running";
  state.frame = 0;
  state.sent = 0;
  state.dropped = 0;
  state.bytesSent = 0;
  state.lastPacketBytes = 0;
  state.lastPacketInspection = null;
  state.lastError = null;
  state.lastAt = 0;
  state.lastFrameDurationMs = 0;
  state.maxFrameDurationMs = 0;
  state.lastStatus = "STARTING";
  state.recentSent = [];

  const intervalMs = Math.max(16, Math.round(1000 / state.config.fps));
  const tick = () => {
    if (!state.running) return;
    const tickStartedAt = Date.now();
    try {
      if (!serialController?.status?.().open) {
        stopRawSerialLiveStream(state, "serial closed");
        return;
      }
      const rgb = buildLivePatternRgb({
        pixels: state.config.pixels,
        pattern: state.config.pattern,
        frame: state.frame,
        profile: resolveRawSerialProfile(state.config.profile)
      });
      const packet = buildRawSerialPacket(rgb, {
        pixels: state.config.pixels,
        brightness: state.config.brightness,
        packetFormat: state.config.packetFormat
      });
      const packetInspection = assertRawSerialPacketContract(packet, { pixels: state.config.pixels, source: "raw-serial-live" });
      state.lastPacketInspection = packetInspection;
      const ok = serialController.write(packet, "Raw serial live stream write error");
      const now = Date.now();
      state.lastPacketBytes = packet.length;
      state.lastFrameDurationMs = Math.max(0, now - tickStartedAt);
      state.maxFrameDurationMs = Math.max(state.maxFrameDurationMs || 0, state.lastFrameDurationMs);
      if (ok) {
        state.sent += 1;
        state.bytesSent += packet.length;
        state.lastAt = now;
        state.lastStatus = "WRITE_OK";
        pushRecentSent(state, now);
      } else {
        state.dropped += 1;
        state.lastError = "serial write rejected";
        state.lastStatus = "WRITE_REJECTED";
      }
      state.frame += 1;
    } catch (error) {
      state.dropped += 1;
      state.lastError = error?.message || "live stream tick error";
      state.lastStatus = "TICK_ERROR";
    }
  };
  tick();
  state.timer = setInterval(tick, intervalMs);
  state.timer.unref?.();
}

function stopRawSerialLiveStream(state, reason = "stopped") {
  if (state.timer) clearInterval(state.timer);
  state.timer = null;
  if (state.running) state.stoppedAt = Date.now();
  state.running = false;
  state.stopReason = reason;
  state.lastStatus = reason === "manual" ? "STOPPED" : `STOPPED: ${reason}`;
}

function pushRecentSent(state, timestamp) {
  state.recentSent.push(timestamp);
  const cutoff = timestamp - 5000;
  while (state.recentSent.length && state.recentSent[0] < cutoff) state.recentSent.shift();
}

function rawSerialActualFps(state, now = Date.now()) {
  const cutoff = now - 1000;
  return state.recentSent.filter((at) => at >= cutoff).length;
}

function rawSerialLiveSnapshot(state, serial = null) {
  const now = Date.now();
  const runtimeMs = state.running && state.startedAt ? now - state.startedAt : 0;
  const actualFps = rawSerialActualFps(state, now);
  const targetFps = clampInt(state.config?.fps, 1, 60, 20);
  const queue = serial?.liveWriteQueue || {};
  const health = rawSerialLiveHealth(state, serial, { now, actualFps, targetFps });
  return {
    running: state.running,
    startedAt: state.startedAt,
    stoppedAt: state.stoppedAt,
    runtimeMs,
    stopReason: state.stopReason,
    frame: state.frame,
    sent: state.sent,
    dropped: state.dropped,
    bytesSent: state.bytesSent,
    lastPacketBytes: state.lastPacketBytes,
    lastPacketInspection: state.lastPacketInspection,
    actualFps,
    targetFps,
    lastFrameDurationMs: state.lastFrameDurationMs,
    maxFrameDurationMs: state.maxFrameDurationMs,
    lastStatus: state.lastStatus,
    lastError: state.lastError,
    lastAt: state.lastAt,
    lastAgeMs: state.lastAt ? Math.max(0, now - state.lastAt) : 0,
    queue: {
      busy: Boolean(queue.busy),
      pending: Boolean(queue.pending),
      sentFps: queue.sentFps || 0,
      coalescedFps: queue.coalescedFps || 0,
      throttledFps: queue.throttledFps || 0,
      recommendedFps: queue.recommendedFps || 0,
      lastError: queue.lastError || null,
      lastWriteMs: queue.lastWriteMs || 0,
      lastDrainMs: queue.lastDrainMs || 0
    },
    health,
    config: state.config
  };
}

function rawSerialLiveHealth(state, serial = null, precomputed = {}) {
  const now = precomputed.now || Date.now();
  const actualFps = precomputed.actualFps ?? rawSerialActualFps(state, now);
  const targetFps = precomputed.targetFps ?? clampInt(state.config?.fps, 1, 60, 20);
  const queue = serial?.liveWriteQueue || {};
  const lastAgeMs = state.lastAt ? Math.max(0, now - state.lastAt) : 0;
  const dropRatio = state.sent + state.dropped > 0 ? state.dropped / (state.sent + state.dropped) : 0;
  const warnings = [];
  if (!serial?.open) warnings.push("SERIAL_CLOSED");
  if (state.running && lastAgeMs > Math.max(1000, 3 * Math.round(1000 / targetFps))) warnings.push("NO_RECENT_WRITE");
  if (state.running && actualFps < Math.max(1, Math.floor(targetFps * 0.5))) warnings.push("LOW_ACTUAL_FPS");
  if (dropRatio > 0.05) warnings.push("DROPS_DETECTED");
  if (queue.busy && queue.busyAgeMs > 1000) warnings.push("SERIAL_QUEUE_BUSY");
  if (queue.pending) warnings.push("SERIAL_PENDING_FRAME");
  if (queue.lastError) warnings.push("SERIAL_QUEUE_ERROR");
  return {
    ok: warnings.length === 0,
    state: warnings.length === 0 ? (state.running ? "RUNNING_OK" : "IDLE_OK") : "WARN",
    warnings,
    targetFps,
    actualFps,
    dropRatio: Number(dropRatio.toFixed(4)),
    lastAgeMs,
    serialOpen: Boolean(serial?.open),
    queueBusy: Boolean(queue.busy),
    queuePending: Boolean(queue.pending),
    recommendedFps: queue.recommendedFps || 0
  };
}

export function buildLivePatternRgb({ pixels, pattern, frame, profile = null }) {
  const raw = new Array(pixels * 3).fill(0);
  const head = pixels > 0 ? frame % pixels : 0;
  const tail = Math.max(4, Math.min(32, Math.floor(pixels / 8)));
  for (let i = 0; i < pixels; i += 1) {
    const o = i * 3;
    if (pattern === "moving-dot" || pattern === "chase") {
      const dist = circularDistance(i, head, pixels);
      const v = Math.max(0, 255 - Math.round((dist / tail) * 255));
      raw[o] = v;
      raw[o + 1] = Math.round(v * 0.25);
      raw[o + 2] = Math.round(v * 0.9);
    } else if (pattern === "scan-bars") {
      const phase = Math.floor((i + frame) / Math.max(1, Math.floor(pixels / 12))) % 3;
      raw[o] = phase === 0 ? 255 : 0;
      raw[o + 1] = phase === 1 ? 255 : 0;
      raw[o + 2] = phase === 2 ? 255 : 0;
    } else if (pattern === "segment-walk") {
      const segment = profile?.segments?.find((seg) => i >= seg.offset && i < seg.offset + seg.pixels);
      const local = segment ? i - segment.offset : i;
      const len = Math.max(1, segment?.pixels || pixels);
      const localHead = frame % len;
      const dist = circularDistance(local, localHead, len);
      const v = Math.max(0, 255 - Math.round((dist / Math.max(3, Math.floor(len / 10))) * 255));
      raw[o] = v;
      raw[o + 1] = Math.round(v * 0.45);
      raw[o + 2] = Math.round(v * 0.95);
    } else if (pattern === "pulse") {
      const v = Math.round(128 + 127 * Math.sin(frame * 0.18));
      raw[o] = v;
      raw[o + 1] = Math.round(v * 0.12);
      raw[o + 2] = Math.round(255 - v * 0.35);
    } else {
      const dist = circularDistance(i, head, pixels);
      const v = Math.max(0, 255 - Math.round((dist / tail) * 255));
      raw[o] = v;
      raw[o + 1] = Math.round(v * 0.25);
      raw[o + 2] = Math.round(v * 0.9);
    }
  }
  return raw;
}

function circularDistance(a, b, size) {
  if (size <= 0) return 0;
  const d = Math.abs(a - b);
  return Math.min(d, size - d);
}

function resolveRawSerialPacketFormat(_formatId) {
  return DEFAULT_PACKET_FORMAT;
}

function resolveRawSerialProfile(profileId) {
  const raw = String(profileId || "esp32-4x40").toLowerCase();
  return RAW_SERIAL_PROFILES[raw] || RAW_SERIAL_PROFILES["esp32-4x40"];
}

function resolveRawSerialPixelCount(body = {}, raw = null, profile = null) {
  if (profile?.pixels) return clampInt(profile.pixels, 1, MAX_PIXELS, DEFAULT_PIXELS);
  if (body && body.pixels != null) return clampInt(body.pixels, 1, MAX_PIXELS, DEFAULT_PIXELS);
  if (raw?.length) return clampInt(Math.floor(raw.length / 3), 1, MAX_PIXELS, DEFAULT_PIXELS);
  return DEFAULT_PIXELS;
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

function firstBytesHex(bytes, limit = 18) {
  return Array.from(bytes.subarray(0, Math.min(limit, bytes.length)))
    .map((v) => v.toString(16).toUpperCase().padStart(2, "0"))
    .join(" ");
}



function buildReceiverHints({ pixels, packetFormat, profile }) {
  const lines = [];
  lines.push(`Server pošle ${pixels} px = ${pixels * 3} RGB bajtů + ${RAW_SERIAL_PACKET_FORMATS[packetFormat]?.headerBytes ?? 0} bajtů hlavičky.`);
  lines.push(`Receiver musí čekat 0xAA + LEN16 + RGB. LEN16 musí být ${pixels}.`);
  if (profile?.segments?.length) {
    lines.push(`Profil má segmenty: ${profile.segments.map((seg) => `${seg.name}:${seg.pixels}`).join(" + ")}.`);
  }
  lines.push("Pro ESP32 receiver: GPIO4/5/12/13, počet pixelů na výstup musí odpovídat vybranému profilu.");
  return lines;
}

function buildPacketChecklist({ pixels, packetFormat, profile }) {
  const totalFromSegments = profile?.segments?.reduce((sum, seg) => sum + clampInt(seg.pixels, 0, MAX_PIXELS, 0), 0) || pixels;
  return {
    serverPixelCount: pixels,
    profilePixelCount: profile?.pixels || null,
    segmentPixelSum: totalFromSegments,
    selectedPacketFormat: packetFormat,
    recommendedReceiverPacketFormatDefine: packetFormat,
    expectedArduinoTotalLeds: pixels,
    expectedArduinoDefines: profile?.segments?.length
      ? profile.segments.slice(0, 4).map((seg, idx) => ({ define: `LEDS_${idx + 1}`, value: seg.pixels, name: seg.name }))
      : [{ define: "LEDS_1", value: pixels, name: "OUT" }],
    warning: totalFromSegments !== pixels ? "PROFILE_SEGMENT_SUM_DIFFERS_FROM_PIXELS" : null
  };
}


function createRawSerialLiveArmGate({ onDisarm = null } = {}) {
  let armedUntil = 0;
  let reason = "boot";
  let armedAt = 0;
  let disarmedAt = Date.now();

  function snapshot() {
    const now = Date.now();
    const armed = armedUntil > now;
    return {
      version: STEP22CV_VERSION,
      armed,
      armedAt,
      armedUntil,
      disarmedAt,
      remainingMs: armed ? Math.max(0, armedUntil - now) : 0,
      ttlMs: armed && armedAt ? Math.max(0, armedUntil - armedAt) : 0,
      reason
    };
  }

  function arm({ ttlMs = 90000, reason: nextReason = "manual-arm" } = {}) {
    const now = Date.now();
    armedAt = now;
    armedUntil = now + clampInt(ttlMs, 5000, 300000, 90000);
    reason = nextReason;
    return snapshot();
  }

  function disarm(nextReason = "manual-disarm") {
    armedUntil = 0;
    disarmedAt = Date.now();
    reason = nextReason;
    if (typeof onDisarm === "function") onDisarm(nextReason);
    return snapshot();
  }

  function isArmed() {
    if (armedUntil > Date.now()) return true;
    if (armedUntil !== 0) disarm("ttl-expired");
    return false;
  }

  return { arm, disarm, isArmed, snapshot };
}

function createRawSerialAdapterBridge({ serialController, getAppMirrorFrame = null } = {}) {
  let lastPacketInspection = null;
  const adapter = createSerialOutputAdapter({
    serialController,
    fpsLimit: 60,
    maxQueue: 1,
    onPacket: (packet, info = {}) => {
      lastPacketInspection = assertRawSerialPacketContract(packet, {
        pixels: info.pixels || config.pixels || DEFAULT_PIXELS,
        source: "raw-serial-adapter"
      });
    }
  });

  let timer = null;
  let running = false;
  let frame = 0;
  let config = { profile: "esp32-4x40", pixels: 160, brightness: 32, fps: 30, pattern: "segment-walk", packetFormat: DEFAULT_PACKET_FORMAT, sourceMode: "app-mirror-shared", sharedOutputMode: true };
  let lastSourceMode = "pattern";
  let mirrorMisses = 0;
  let startedAt = 0;
  let stoppedAt = 0;
  let stopReason = "init";
  let pushOk = 0;
  let pushDropped = 0;
  let ticks = 0;
  let lastError = "";
  let lastAt = 0;
  let firstTickAt = 0;
  let lastTickAt = 0;
  let txBusy = false;
  let queueOverwrites = 0;
  let mirrorFramesUsed = 0;
  let fallbackFramesUsed = 0;
  let staleMirrorFrames = 0;
  let noMirrorFrames = 0;
  let lastMirrorAgeMs = null;
  let lastFrameSource = "none";
  let lastFrameBuildMs = 0;

  function resolveConfig(body = {}) {
    const profile = resolveRawSerialProfile(body.profile) || resolveRawSerialProfile(config.profile);
    const pixels = resolveRawSerialPixelCount(body, null, profile);
    return {
      profile: profile?.id || body.profile || config.profile || "esp32-4x40",
      pixels,
      brightness: clampByte(body.brightness ?? config.brightness, 32),
      fps: clampInt(body.fps ?? config.fps, 1, 60, 20),
      pattern: String(body.pattern || config.pattern || "segment-walk"),
      packetFormat: resolveRawSerialPacketFormat(body.packetFormat ?? config.packetFormat),
      sourceMode: String(body.sourceMode || body.source || config.sourceMode || "pattern").trim().toLowerCase(),
      sharedOutputMode: Boolean(body.sharedOutputMode ?? config.sharedOutputMode ?? false)
    };
  }

  function buildFrame(body = {}) {
    const next = resolveConfig(body);
    const profile = resolveRawSerialProfile(next.profile);
    let rgb = body.rgb || body.frame?.rgb || body.payload?.rgb || body.pixels || null;
    let sourceMode = next.sourceMode;
    const wantsMirror = sourceMode === "app-mirror" || sourceMode === "app-mirror-shared";
    if (!rgb && wantsMirror) {
      const mirrored = typeof getAppMirrorFrame === "function" ? getAppMirrorFrame() : null;
      if (mirrored?.rgb?.length) {
        const ageMs = mirrored.receivedAt ? Math.max(0, Date.now() - mirrored.receivedAt) : 999999;
        lastMirrorAgeMs = ageMs;
        if (ageMs <= 1500) {
          const fitted = fitRgbToPixels(mirrored.rgb, next.pixels);
          if (sourceMode === "app-mirror-shared" || next.sharedOutputMode) {
            // STEP22DD: GPIO4 shared strip clone mode.
            // The tested ESP32D drives one reliable physical output only.
            // For 4 paralleled strips, derive one 40px strip and repeat it into the virtual 4x40 packet.
            // The GPIO4-only receiver displays the first 40px; repeated data keeps the packet truthful for later clones.
            const perStrip = Math.max(1, Math.floor(next.pixels / 4));
            const shared = fitted.slice(0, perStrip * 3);
            const repeated = new Array(next.pixels * 3);
            for (let strip = 0; strip < 4; strip++) {
              for (let i = 0; i < shared.length; i++) repeated[(strip * shared.length) + i] = shared[i] || 0;
            }
            rgb = repeated;
            sourceMode = "app-mirror-shared";
            lastSourceMode = "app-mirror-shared";
            lastFrameSource = "app-mirror-shared";
          } else {
            rgb = fitted;
            lastSourceMode = "app-mirror";
            lastFrameSource = "app-mirror";
          }
          mirrorFramesUsed += 1;
        } else {
          mirrorMisses += 1;
          staleMirrorFrames += 1;
          sourceMode = "pattern-fallback-stale-mirror";
        }
      } else {
        mirrorMisses += 1;
        noMirrorFrames += 1;
        sourceMode = "pattern-fallback-no-mirror";
      }
    }
    if (!rgb) {
      rgb = buildLivePatternRgb({
        pixels: next.pixels,
        pattern: next.pattern,
        frame,
        profile
      });
      fallbackFramesUsed += 1;
      lastFrameSource = sourceMode.startsWith("pattern-fallback") ? sourceMode : "pattern";
      if (next.sourceMode !== "app-mirror") lastSourceMode = "pattern";
    }
    return {
      rgb,
      pixelCount: next.pixels,
      brightness: next.brightness,
      packetFormat: next.packetFormat,
      frameId: frame,
      timestamp: Date.now(),
      meta: {
        source: (sourceMode === "app-mirror" || sourceMode === "app-mirror-shared") ? "raw-serial-app-mirror" : "raw-serial-adapter-bridge",
        sourceMode,
        profile: next.profile,
        pattern: next.pattern,
        pixels: next.pixels,
        brightness: next.brightness,
        packetFormat: next.packetFormat
      }
    };
  }

  function tick(body = {}) {
    if (txBusy) {
      pushDropped += 1;
      queueOverwrites += 1;
      return { pushed: false, error: "tx_busy", frame };
    }
    const buildStart = Date.now();
    try {
      txBusy = true;
      const built = buildFrame(body);
      lastFrameBuildMs = Math.max(0, Date.now() - buildStart);
      const pushed = adapter.pushFrame(built);
      if (pushed === false) { pushDropped += 1; queueOverwrites += 1; } else pushOk += 1;
      adapter.processOne();
      frame += 1;
      ticks += 1;
      lastAt = Date.now();
      if (!firstTickAt) firstTickAt = lastAt;
      lastTickAt = lastAt;
      lastError = "";
      return { pushed: pushed !== false, frame: frame - 1, source: lastFrameSource };
    } catch (error) {
      pushDropped += 1;
      lastError = String(error?.message || error || "adapter_tick_failed");
      return { pushed: false, error: lastError, frame };
    } finally {
      txBusy = false;
    }
  }

  function start(body = {}) {
    if (!serialController?.status?.().open) throw new Error("serial closed");
    stop("restart");
    config = resolveConfig(body);
    running = true;
    startedAt = Date.now();
    stoppedAt = 0;
    stopReason = "running";
    frame = 0;
    firstTickAt = 0;
    lastTickAt = 0;
    queueOverwrites = 0;
    mirrorFramesUsed = 0;
    fallbackFramesUsed = 0;
    staleMirrorFrames = 0;
    noMirrorFrames = 0;
    lastMirrorAgeMs = null;
    lastFrameSource = "none";
    adapter.start();
    const period = Math.max(16, Math.round(1000 / config.fps));
    timer = setInterval(() => {
      tick();
    }, period);
    tick();
  }

  function stop(reason = "manual") {
    if (timer) clearInterval(timer);
    timer = null;
    running = false;
    stoppedAt = Date.now();
    stopReason = reason;
    adapter.stop();
  }

  function step(body = {}) {
    config = resolveConfig(body);
    adapter.start();
    return tick(body);
  }

  function snapshot() {
    const now = Date.now();
    const runtimeMs = running && startedAt ? now - startedAt : 0;
    const actualFps = runtimeMs > 0 ? Number(((ticks * 1000) / runtimeMs).toFixed(2)) : 0;
    const adapterStatus = adapter.getStatus();
    const txFps = runtimeMs > 0 ? Number(((adapterStatus.sent * 1000) / runtimeMs).toFixed(2)) : 0;
    return {
      version: "STEP22DF_GPIO4_SHARED_DEFAULT_LIVE",
      previousVersion: STEP22CY_VERSION,
      compatibilityMarkers: [
        "STEP22DE_GPIO4_SHARED_WIRING_GUIDE",
        "STEP22DD_SHARED_GPIO4_LIVE_CLONE"
      ],
      serverSideLiveOutput: true,
      headlessSafe: true,
      monitorPageRequired: false,
      legacyVersion: "STEP22CT_LIVE_BURNIN_WATCH",
      running,
      protocol: config.packetFormat || DEFAULT_PACKET_FORMAT,
      packetFormats: Object.values(RAW_SERIAL_PACKET_FORMATS),
      config,
      frame,
      pushOk,
      pushDropped,
      ticks,
      actualFps,
      startedAt,
      stoppedAt,
      stopReason,
      lastAt,
      lastAgeMs: lastAt ? Math.max(0, now - lastAt) : 0,
      lastError,
      lastPacketInspection,
      sourceMode: config.sourceMode || "pattern",
      lastSourceMode,
      mirrorMisses,
      queueOverwrites,
      txBusy,
      renderFps: actualFps,
      txFps,
      targetFps: config.fps,
      mirrorFramesUsed,
      fallbackFramesUsed,
      staleMirrorFrames,
      noMirrorFrames,
      lastMirrorAgeMs,
      lastFrameSource,
      lastFrameBuildMs,
      latestOnly: true,
      maxQueue: 1,
      adapter: adapterStatus
    };
  }

  return { start, stop, step, snapshot };
}

function buildOutputVerifyRgb({ profile, output, color, blackoutOthers = true }) {
  const pixels = profile?.pixels || 1200;
  const raw = new Array(pixels * 3).fill(0);
  const segment = profile?.segments?.[Math.max(0, output - 1)];
  if (!blackoutOthers) {
    for (let i = 0; i < pixels; i += 1) { const o = i * 3; raw[o] = 0; raw[o + 1] = 0; raw[o + 2] = 8; }
  }
  if (!segment) return raw;
  for (let i = segment.offset; i < segment.offset + segment.pixels; i += 1) {
    const o = i * 3;
    raw[o] = clampByte(color[0], 255);
    raw[o + 1] = clampByte(color[1], 0);
    raw[o + 2] = clampByte(color[2], 0);
  }
  return raw;
}
