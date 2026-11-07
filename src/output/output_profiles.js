export const OUTPUT_PROFILES = Object.freeze({
  "Club Full": Object.freeze({
    name: "Club Full",
    transport: "artnet",
    fallback: "blx",
    preview: true,
    fps: 60,
    artSync: true,
    stripCount: 8,
    pixelsPerStrip: 300,
    pixelsPerUniverse: 170,
    totalPixels: 2400,
    universeCount: 16,
    targetIp: "2.1.1.30"
  }),
  "RasPi Safe": Object.freeze({
    name: "RasPi Safe",
    transport: "blx",
    fallback: "preview",
    preview: true,
    fps: 30,
    artSync: false,
    compression: "DIFF_FRAME",
    totalPixels: 2400
  }),
  "ESP32 WiFi": Object.freeze({
    name: "ESP32 WiFi",
    transport: "artnet",
    fallback: "blx",
    preview: true,
    fps: 30,
    artSync: true,
    compression: "ZERO_SKIP",
    preferUnicast: true,
    targetIp: "2.1.1.30"
  }),
  "Teensy Ethernet": Object.freeze({
    name: "Teensy Ethernet",
    transport: "artnet",
    fallback: "blx",
    preview: true,
    fps: 60,
    artSync: true,
    preferUnicast: true,
    targetIp: "2.1.1.30"
  }),
  Debug: Object.freeze({
    name: "Debug",
    transport: "preview",
    fallback: "null",
    preview: true,
    fps: 20,
    artSync: false,
    compression: "RAW_RGB",
    dryRun: true
  })
});

export function resolveOutputProfile(name = "Club Full", overrides = {}) {
  const profile = OUTPUT_PROFILES[name] || OUTPUT_PROFILES["Club Full"];
  return Object.freeze({
    ...profile,
    ...(overrides && typeof overrides === "object" ? overrides : {})
  });
}

export function listOutputProfiles() {
  return Object.freeze(Object.keys(OUTPUT_PROFILES));
}
