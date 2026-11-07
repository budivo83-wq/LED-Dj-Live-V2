import {
  STEP22C_OUTPUT_PROFILES,
  buildStep22COutputConfig,
  listStep22COutputProfiles,
  resolveStep22COutputProfile
} from "../output/output_profiles_22c.js";

const SETTINGS_PROFILE_MAP = Object.freeze({
  ESP32_4x40_RAW_SERIAL: Object.freeze({
    outputProfile: "ESP32_4x40_RAW_SERIAL",
    rawSerialProfile: "esp32-4x40",
    serialBaud: 921600,
    liveFps: 30,
    pixels: 160,
    packetFormat: "aa_len_rgb",
    notes: ["Receiver: esp32_raw_serial_receiver_4x40_AA_LEN16_RGB_STEP22A.ino", "Packet: 0xAA + LEN16 + RGB", "Pins: GPIO 4,5,14,15"]
  }),
  ESP32_4x300_RAW_SERIAL: Object.freeze({
    outputProfile: "ESP32_4x300_RAW_SERIAL",
    rawSerialProfile: "esp32-4x300",
    serialBaud: 3000000,
    liveFps: 20,
    pixels: 1200,
    packetFormat: "aa_len_rgb",
    notes: ["Receiver must be rebuilt for 4x300", "Packet: 0xAA + LEN16 + RGB", "Use only after short 4x40 test is stable"]
  }),
  ARTNET_8x300_STAGE: Object.freeze({
    outputProfile: "ARTNET_8x300_STAGE",
    rawSerialProfile: null,
    serialBaud: null,
    liveFps: 60,
    pixels: 2400,
    packetFormat: null,
    notes: ["ArtNet target default: 2.1.1.30:6454", "Universe start: 0", "150 pixels/universe, 16 universes total"]
  }),
  BLX_SERIAL_SAFE: Object.freeze({
    outputProfile: "BLX_SERIAL_SAFE",
    rawSerialProfile: null,
    serialBaud: 3000000,
    liveFps: 30,
    pixels: 2400,
    packetFormat: null,
    notes: ["BLX is selectable as a profile, but its native serial transport is not autoloaded in STEP22D", "Use after RAW/ArtNet are stable"]
  }),
  PREVIEW_ONLY: Object.freeze({
    outputProfile: "PREVIEW_ONLY",
    rawSerialProfile: "esp32-4x40",
    serialBaud: 921600,
    liveFps: 30,
    pixels: 160,
    packetFormat: "aa_len_rgb",
    notes: ["No physical output", "Safe UI/render debug mode"]
  })
});

export function registerOutputProfileRoutes22D(app, { expressRef } = {}) {
  const jsonParser = expressRef?.json?.({ limit: "128kb" });

  app.get("/api/output-profiles/22d", (_req, res) => {
    res.json({
      ok: true,
      version: "STEP22D_OUTPUT_PROFILE_SETTINGS_BRIDGE",
      defaultProfile: "ESP32_4x40_RAW_SERIAL",
      profiles: listStep22DProfiles()
    });
  });

  app.post("/api/output-profiles/22d/resolve", jsonParser, (req, res) => {
    try {
      const profileId = req.body?.profile || req.body?.profileId || "ESP32_4x40_RAW_SERIAL";
      res.json({ ok: true, resolved: resolveStep22DProfile(profileId, req.body?.overrides || {}) });
    } catch (error) {
      res.status(400).json({ ok: false, error: error.message });
    }
  });
}

export function listStep22DProfiles() {
  return listStep22COutputProfiles().map((item) => {
    const bridge = SETTINGS_PROFILE_MAP[item.id] || SETTINGS_PROFILE_MAP.PREVIEW_ONLY;
    return {
      ...item,
      settings: { ...bridge, notes: [...(bridge.notes || [])] }
    };
  });
}

export function resolveStep22DProfile(profileId = "ESP32_4x40_RAW_SERIAL", overrides = {}) {
  const profile = resolveStep22COutputProfile(profileId, overrides);
  const bridge = SETTINGS_PROFILE_MAP[profile.id] || SETTINGS_PROFILE_MAP.ESP32_4x40_RAW_SERIAL;
  const config = buildStep22COutputConfig({ profile: profile.id, overrides });
  return {
    id: profile.id,
    label: profile.label,
    active: profile.active,
    enabled: profile.enabled || [],
    totalPixels: profile.totalPixels,
    strips: profile.strips,
    pixelsPerStrip: profile.pixelsPerStrip,
    fps: profile.fps,
    adapters: config.adapters || {},
    settings: { ...bridge, notes: [...(bridge.notes || [])] },
    warnings: buildWarnings(profile.id)
  };
}

function buildWarnings(profileId) {
  if (profileId === "BLX_SERIAL_SAFE") return ["BLX adapter remains lazy/optional in STEP22D; do not use as the main live path yet."];
  if (profileId === "ESP32_4x300_RAW_SERIAL") return ["4x300 at 3Mbaud is heavy for ESP32 serial; verify 4x40 first."];
  return [];
}

export { STEP22C_OUTPUT_PROFILES as STEP22D_BASE_OUTPUT_PROFILES };
