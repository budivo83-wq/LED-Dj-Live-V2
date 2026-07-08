import { clampInt, clampNumber, normalizeTransport } from "./live_output_common.js";

export const LIVE_OUTPUT_TARGET_CONFIG_VERSION = "12S-output-target-config-verification";

const DEFAULTS = Object.freeze({
  transportKind: "serial",
  serialPath: "COM3",
  baudRate: 115200,
  host: "127.0.0.1",
  artnetPort: 6454,
  universe: 0,
  pixels: 60,
  frames: 4,
  brightness: 0.04,
  pattern: "single-pixel-chase",
  serialProtocol: "simple-aa"
});

function envValue(env, key, fallback) {
  const v = env?.[key];
  return v === undefined || v === null || String(v).trim() === "" ? fallback : v;
}

function normalizePattern(value) {
  const p = String(value || DEFAULTS.pattern).trim().toLowerCase();
  if (["blackout", "red", "green", "blue", "white-low", "single-pixel-chase"].includes(p)) return p;
  return DEFAULTS.pattern;
}

export function readOutputTargetDefaults(env = process.env) {
  return Object.freeze({
    transportKind: normalizeTransport(envValue(env, "LED_OUTPUT_TRANSPORT", DEFAULTS.transportKind), {
      defaultValue: DEFAULTS.transportKind,
      aliases: ["udp", "network", "art-net"]
    }),
    serialPath: String(envValue(env, "LED_SERIAL_PORT", DEFAULTS.serialPath)),
    baudRate: clampInt(envValue(env, "LED_SERIAL_BAUD", DEFAULTS.baudRate), 9600, 3000000, DEFAULTS.baudRate),
    host: String(envValue(env, "LED_ARTNET_HOST", DEFAULTS.host)),
    artnetPort: clampInt(envValue(env, "LED_ARTNET_PORT", DEFAULTS.artnetPort), 1, 65535, DEFAULTS.artnetPort),
    universe: clampInt(envValue(env, "LED_ARTNET_UNIVERSE", DEFAULTS.universe), 0, 32767, DEFAULTS.universe),
    pixels: clampInt(envValue(env, "LED_OUTPUT_TEST_PIXELS", DEFAULTS.pixels), 1, 150, DEFAULTS.pixels),
    frames: clampInt(envValue(env, "LED_OUTPUT_TEST_FRAMES", DEFAULTS.frames), 1, 8, DEFAULTS.frames),
    brightness: clampNumber(envValue(env, "LED_OUTPUT_TEST_BRIGHTNESS", DEFAULTS.brightness), 0, 0.08, DEFAULTS.brightness),
    pattern: normalizePattern(envValue(env, "LED_OUTPUT_TEST_PATTERN", DEFAULTS.pattern)),
    physicalWriteEnabled: String(envValue(env, "LED_PHYSICAL_OUTPUT_ENABLE", "0")).trim() === "1",
    serialProtocol: String(envValue(env, "LED_SERIAL_PROTOCOL", DEFAULTS.serialProtocol)).trim().toLowerCase()
  });
}

export function normalizeOutputTargetConfig(request = {}, env = process.env) {
  const defaults = readOutputTargetDefaults(env);
  return Object.freeze({
    version: LIVE_OUTPUT_TARGET_CONFIG_VERSION,
    transportKind: normalizeTransport(request.transportKind || request.transport || request.outputMode || defaults.transportKind, {
      defaultValue: defaults.transportKind,
      aliases: ["udp", "network", "art-net"]
    }),
    serialPath: String(request.serialPath || request.path || request.portName || defaults.serialPath),
    baudRate: clampInt(request.baudRate || defaults.baudRate, 9600, 3000000, defaults.baudRate),
    host: String(request.host || request.ip || request.target?.host || request.target?.ip || defaults.host),
    artnetPort: clampInt(request.artnetPort || request.target?.port || request.port || defaults.artnetPort, 1, 65535, defaults.artnetPort),
    universe: clampInt(request.universe ?? defaults.universe, 0, 32767, defaults.universe),
    pixels: clampInt(request.pixels ?? request.pixelCount ?? defaults.pixels, 1, 150, defaults.pixels),
    frames: clampInt(request.frames ?? request.frameCount ?? defaults.frames, 1, 8, defaults.frames),
    brightness: clampNumber(request.brightness ?? defaults.brightness, 0, 0.08, defaults.brightness),
    pattern: normalizePattern(request.pattern || request.testPattern || defaults.pattern),
    dryRun: request.dryRun !== false,
    requested: Boolean(request.requested || request.start || request.commit),
    commit: Boolean(request.commit || request.writeNow),
    physicalWriteEnabled: defaults.physicalWriteEnabled,
    serialProtocol: String(request.serialProtocol || request.protocol || defaults.serialProtocol).trim().toLowerCase(),
    source: String(request.source || "output-target-config-12S")
  });
}

export function evaluateOutputTargetConfig({ request = {}, env = process.env } = {}) {
  const config = normalizeOutputTargetConfig(request, env);
  const blocked = [];
  const warnings = [];

  if (!["serial", "artnet"].includes(config.transportKind)) blocked.push("OUTPUT_TARGET_TRANSPORT_UNSUPPORTED");
  if (config.transportKind === "serial" && !config.serialPath) blocked.push("OUTPUT_TARGET_SERIAL_PATH_MISSING");
  if (config.transportKind === "artnet" && !config.host) blocked.push("OUTPUT_TARGET_ARTNET_HOST_MISSING");
  if (config.dryRun) warnings.push("OUTPUT_TARGET_DRY_RUN_TRUE");
  if (!config.physicalWriteEnabled) warnings.push("OUTPUT_TARGET_PHYSICAL_ENV_OFF");
  if (config.brightness > 0.05) warnings.push("OUTPUT_TARGET_BRIGHTNESS_ABOVE_SMOKE_DEFAULT");
  if (config.pixels > 60) warnings.push("OUTPUT_TARGET_PIXEL_COUNT_ABOVE_SMOKE_DEFAULT");

  const targetLabel = config.transportKind === "serial"
    ? `${config.serialPath}@${config.baudRate}`
    : `${config.host}:${config.artnetPort}/u${config.universe}`;
  const expectedPackets = config.transportKind === "serial"
    ? config.frames
    : Math.max(1, Math.ceil((config.pixels * 3) / 512)) * config.frames;
  const expectedPayloadBytes = config.pixels * 3 * config.frames;
  const expectedWireBytes = config.transportKind === "serial" && config.serialProtocol !== "blx-v2"
    ? (2 + config.pixels * 3) * config.frames
    : expectedPayloadBytes;

  return Object.freeze({
    version: LIVE_OUTPUT_TARGET_CONFIG_VERSION,
    ok: blocked.length === 0,
    status: blocked.length ? "BLOCKED" : "READY",
    decision: blocked.length ? "OUTPUT_TARGET_CONFIG_BLOCKED" : "OUTPUT_TARGET_CONFIG_READY",
    config,
    targetLabel,
    expectedPackets,
    expectedPayloadBytes,
    expectedWireBytes,
    blocked: Object.freeze(blocked),
    warnings: Object.freeze(warnings),
    summary: `${String(config.transportKind).toUpperCase()} | ${targetLabel} | ${config.pixels}px | ${config.frames}f | b${config.brightness}${config.transportKind === "serial" ? ` | ${config.serialProtocol}` : ""}`
  });
}

export function buildSmokeRequestFromTargetConfig({ configResult = null, token = "", mappingDigest = "output-target-config-12S", transportPlanDigest = "output-target-config-12S", dryRun = true } = {}) {
  const cfg = configResult?.config || configResult || readOutputTargetDefaults();
  return Object.freeze({
    requested: true,
    commit: true,
    dryRun: dryRun !== false,
    transportKind: cfg.transportKind,
    pattern: cfg.pattern,
    pixels: cfg.pixels,
    frames: cfg.frames,
    brightness: cfg.brightness,
    serialPath: cfg.serialPath,
    baudRate: cfg.baudRate,
    host: cfg.host,
    artnetPort: cfg.artnetPort,
    universe: cfg.universe,
    token: String(token || ""),
    mappingDigest,
    transportPlanDigest,
    outputMode: cfg.transportKind,
    serialProtocol: cfg.serialProtocol,
    operatorConfirmed: true,
    confirmation: "CONFIRM_OUTPUT_SMOKE_TEST_LOW_BRIGHTNESS",
    source: "output-target-config-12S"
  });
}

export function createLiveOutputTargetConfig({ env = process.env } = {}) {
  return Object.freeze({
    version: LIVE_OUTPUT_TARGET_CONFIG_VERSION,
    readDefaults: () => readOutputTargetDefaults(env),
    evaluate: (request = {}) => evaluateOutputTargetConfig({ request, env }),
    buildSmokeRequest: (options = {}) => buildSmokeRequestFromTargetConfig(options)
  });
}
