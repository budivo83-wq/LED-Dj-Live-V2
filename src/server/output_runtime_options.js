import { ARTNET_LIVE_DEFAULTS } from "../../shared/artnet_live_defaults.js";

function numberFromEnv(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function stringFromEnv(value, fallback) {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
}

export function createBlxControlOptions(env = process.env) {
  return {
    mode: stringFromEnv(env.LED_BLX_MODE, "v2"),
    transport: stringFromEnv(env.LED_BLX_TRANSPORT, "udp"),
    host: stringFromEnv(env.LED_BLX_TARGET_IP, "127.0.0.1"),
    port: numberFromEnv(env.LED_BLX_TARGET_PORT, 9001),
    bindPort: numberFromEnv(env.LED_BLX_BIND_PORT, 0),
    discoveryPort: numberFromEnv(env.LED_BLX_DISCOVERY_PORT ?? env.LED_BLX_TARGET_PORT, 9001),
    fpsLimit: numberFromEnv(env.LED_BLX_FPS, 60),
    maxQueue: numberFromEnv(env.LED_BLX_MAX_QUEUE, 128),
    tickHz: numberFromEnv(env.LED_BLX_TICK_HZ, 60),
    serialPort: stringFromEnv(env.LED_BLX_SERIAL_PORT ?? env.LED_SERIAL_PORT, ""),
    baudRate: numberFromEnv(env.LED_BLX_SERIAL_BAUD ?? env.LED_SERIAL_BAUD, 115200),
    nodeId: numberFromEnv(env.LED_BLX_NODE_ID, 1),
    channel: numberFromEnv(env.LED_BLX_CHANNEL, 0),
    pixelCount: numberFromEnv(env.LED_BLX_PIXEL_COUNT, 60),
    colorOrder: numberFromEnv(env.LED_BLX_COLOR_ORDER, 0)
  };
}

export function createArtNetSchedulerOptions22P(env = process.env) {
  return {
    host: stringFromEnv(env.LED_ARTNET_TARGET_IP, ARTNET_LIVE_DEFAULTS.outputIp),
    port: numberFromEnv(env.LED_ARTNET_TARGET_PORT, ARTNET_LIVE_DEFAULTS.port),
    fps: numberFromEnv(env.LED_ARTNET_FPS, ARTNET_LIVE_DEFAULTS.fps),
    stripCount: numberFromEnv(env.LED_ARTNET_STRIP_COUNT, 8),
    pixelsPerStrip: numberFromEnv(env.LED_ARTNET_PIXELS_PER_STRIP, 300),
    pixelsPerUniverse: numberFromEnv(env.LED_ARTNET_PIXELS_PER_UNIVERSE, ARTNET_LIVE_DEFAULTS.pixelsPerUniverse),
    startUniverse: numberFromEnv(env.LED_ARTNET_START_UNIVERSE, ARTNET_LIVE_DEFAULTS.universeStart),
    dryRun: String(env.LED_ARTNET_DRY_RUN || "1") !== "0"
  };
}

export function createMultiTransportOptions22U(env = process.env, artnetScheduler22P) {
  return {
    totalPixels: numberFromEnv(env.LED_MULTI_TOTAL_PIXELS, 2400),
    frameBarrierTimeoutMs: numberFromEnv(env.LED_MULTI_BARRIER_TIMEOUT_MS, 25),
    artnetScheduler22P,
    transports: {
      serial: { enabled: String(env.LED_MULTI_SERIAL_ENABLED || "0") === "1" },
      artnet: { enabled: String(env.LED_MULTI_ARTNET_ENABLED || "1") !== "0", scheduler: artnetScheduler22P },
      sacn: { enabled: String(env.LED_MULTI_SACN_ENABLED || "0") === "1" }
    }
  };
}

export function createArtnetControlOptions(env = process.env) {
  const outputIp = stringFromEnv(env.LED_ARTNET_TARGET_IP, ARTNET_LIVE_DEFAULTS.outputIp);
  return {
    host: outputIp,
    port: numberFromEnv(env.LED_ARTNET_TARGET_PORT, ARTNET_LIVE_DEFAULTS.port),
    bindPort: numberFromEnv(env.LED_ARTNET_BIND_PORT, 0),
    fpsLimit: numberFromEnv(env.LED_ARTNET_FPS, ARTNET_LIVE_DEFAULTS.fps),
    maxQueue: numberFromEnv(env.LED_ARTNET_MAX_QUEUE, 64),
    tickHz: numberFromEnv(env.LED_ARTNET_TICK_HZ, 60),
    map: {
      stripCount: numberFromEnv(env.LED_ARTNET_STRIP_COUNT, 1),
      pixelsPerStrip: numberFromEnv(env.LED_ARTNET_PIXELS_PER_STRIP, 300),
      pixelsPerUniverse: numberFromEnv(env.LED_ARTNET_PIXELS_PER_UNIVERSE, ARTNET_LIVE_DEFAULTS.pixelsPerUniverse),
      startUniverse: numberFromEnv(env.LED_ARTNET_START_UNIVERSE, ARTNET_LIVE_DEFAULTS.universeStart),
      outputIp,
      enabled: true
    }
  };
}

export function createLiveSenderOptions22DQ(env = process.env) {
  return {
    outputIp: stringFromEnv(env.LED_ARTNET_TARGET_IP, ARTNET_LIVE_DEFAULTS.outputIp),
    bindIp: stringFromEnv(env.LED_ARTNET_BIND_IP ?? env.LED_ARTNET_LOCAL_IP, ARTNET_LIVE_DEFAULTS.bindIp),
    port: numberFromEnv(env.LED_ARTNET_TARGET_PORT, ARTNET_LIVE_DEFAULTS.port),
    fps: numberFromEnv(env.LED_ARTNET_FPS, ARTNET_LIVE_DEFAULTS.fps),
    bpm: numberFromEnv(env.LED_BPM, ARTNET_LIVE_DEFAULTS.bpm),
    stripCount: numberFromEnv(env.LED_ARTNET_STRIP_COUNT, 8),
    pixelsPerStrip: numberFromEnv(env.LED_ARTNET_PIXELS_PER_STRIP, 300),
    pixelsPerUniverse: numberFromEnv(env.LED_ARTNET_PIXELS_PER_UNIVERSE, ARTNET_LIVE_DEFAULTS.pixelsPerUniverse),
    startUniverse: numberFromEnv(env.LED_ARTNET_START_UNIVERSE, ARTNET_LIVE_DEFAULTS.universeStart)
  };
}
