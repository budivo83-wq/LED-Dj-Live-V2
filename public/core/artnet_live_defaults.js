export const ARTNET_LIVE_DEFAULTS = Object.freeze({
  outputIp: "2.1.1.30",
  bindIp: "",
  targetMode: "unicast",
  port: 6454,
  fps: 60,
  maxLiveFps: 60,
  bpm: 145,
  stripCount: 8,
  pixelsPerStrip: 300,
  universeStart: 0,
  pixelsPerUniverse: 170,
  packetPaceMs: 0,
  packetsPerBurst: 32,
  maxPendingBatchMs: 120,
  callbackMode: "lightweight",
  adaptiveFrameClock: "off",
  adaptiveFloorFps: 24,
  packetOrder: "sequential",
  artSyncMode: "off",
  artSyncEveryN: 1,
  masterMaxAgeMs: 2500,
  lastGoodHoldMs: 0,
  blackoutAfterHold: true,
  visualPattern: "master-framebus",
  sourceMode: "performance-master-only",
  masterDriven: "on"
});

export function withArtnetLiveDefaults(overrides = {}) {
  return { ...ARTNET_LIVE_DEFAULTS, ...overrides };
}
