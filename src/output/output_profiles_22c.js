export const STEP22C_OUTPUT_PROFILES = Object.freeze({
  ESP32_4x40_RAW_SERIAL: Object.freeze({
    id: 'ESP32_4x40_RAW_SERIAL',
    label: 'ESP32 4x40 RAW SERIAL',
    active: 'serial',
    enabled: ['serial'],
    totalPixels: 160,
    strips: 4,
    pixelsPerStrip: 40,
    fps: 30,
    adapters: Object.freeze({
      serial: Object.freeze({
        pixels: 160,
        pixelCount: 160,
        baudRate: 921600,
        fpsLimit: 30,
        maxQueue: 2,
        packetFormat: 'aa_len_rgb',
        packetLabel: '0xAA + LEN16 + RGB'
      })
    })
  }),
  ESP32_4x300_RAW_SERIAL: Object.freeze({
    id: 'ESP32_4x300_RAW_SERIAL',
    label: 'ESP32 4x300 RAW SERIAL',
    active: 'serial',
    enabled: ['serial'],
    totalPixels: 1200,
    strips: 4,
    pixelsPerStrip: 300,
    fps: 20,
    adapters: Object.freeze({
      serial: Object.freeze({
        pixels: 1200,
        pixelCount: 1200,
        baudRate: 3000000,
        fpsLimit: 20,
        maxQueue: 2,
        packetFormat: 'aa_len_rgb',
        packetLabel: '0xAA + LEN16 + RGB'
      })
    })
  }),
  ARTNET_8x300_STAGE: Object.freeze({
    id: 'ARTNET_8x300_STAGE',
    label: 'ArtNet 8x300 Stage',
    active: 'artnet',
    enabled: ['artnet'],
    totalPixels: 2400,
    strips: 8,
    pixelsPerStrip: 300,
    fps: 60,
    adapters: Object.freeze({
      artnet: Object.freeze({
        host: '2.1.1.30',
        port: 6454,
        fpsLimit: 60,
        artSync: true,
        scheduler: 'step22p',
        useScheduler22P: true,
        dryRun: true,
        map: Object.freeze({
          stripCount: 8,
          pixelsPerStrip: 300,
          pixelsPerUniverse: 170,
          startUniverse: 0
        })
      })
    })
  }),
  BLX_SERIAL_SAFE: Object.freeze({
    id: 'BLX_SERIAL_SAFE',
    label: 'BLX Serial Safe',
    active: 'blx',
    enabled: ['blx'],
    totalPixels: 2400,
    strips: 8,
    pixelsPerStrip: 300,
    fps: 30,
    adapters: Object.freeze({
      blx: Object.freeze({
        mode: 'v1',
        transport: 'serial',
        baudRate: 3000000,
        fpsLimit: 30,
        maxQueue: 8
      })
    })
  }),
  PREVIEW_ONLY: Object.freeze({
    id: 'PREVIEW_ONLY',
    label: 'Preview only',
    active: 'preview',
    enabled: [],
    totalPixels: 160,
    strips: 4,
    pixelsPerStrip: 40,
    fps: 30,
    adapters: Object.freeze({})
  })
});

function deepMerge(base, extra) {
  if (!extra || typeof extra !== 'object') return { ...(base || {}) };
  const out = { ...(base || {}) };
  for (const [key, value] of Object.entries(extra)) {
    if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Uint8Array) && !(typeof Buffer !== 'undefined' && Buffer.isBuffer(value))) {
      out[key] = deepMerge(out[key], value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

export function listStep22COutputProfiles() {
  return Object.values(STEP22C_OUTPUT_PROFILES).map((profile) => ({
    id: profile.id,
    label: profile.label,
    active: profile.active,
    totalPixels: profile.totalPixels,
    fps: profile.fps
  }));
}

export function resolveStep22COutputProfile(profileId = 'ESP32_4x40_RAW_SERIAL', overrides = {}) {
  const key = String(profileId || '').trim();
  const profile = STEP22C_OUTPUT_PROFILES[key] || STEP22C_OUTPUT_PROFILES.ESP32_4x40_RAW_SERIAL;
  return deepMerge(profile, overrides);
}

export function buildStep22COutputConfig(input = {}) {
  const profileId = input.profile || input.profileId || input.id || 'ESP32_4x40_RAW_SERIAL';
  const profile = resolveStep22COutputProfile(profileId, input.overrides || {});
  return deepMerge(profile, {
    active: input.active || input.mode || profile.active,
    enabled: Array.isArray(input.enabled) ? input.enabled : profile.enabled,
    adapters: deepMerge(profile.adapters || {}, input.adapters || {})
  });
}
