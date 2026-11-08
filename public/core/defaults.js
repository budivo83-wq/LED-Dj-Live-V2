// Default state factories. These functions must return fresh objects because
// app.js mutates runtime state heavily during live performance.

export function createDefaultLayerState(colors) {
  return {
    animFile: "",
    // Keep the first-run output coherent with the cool shader look. Existing
    // persisted selections are restored unchanged by state.js.
    paletteFile: "ocean_glow.js",
    params: [0.5, 0.5, 0.5, 0.5],
    master: 1,
    enabled: true,
    beatSync: false,
    blackout: false,
    flash: false,
    reverse: false,
    mirrorX: false,
    mirrorY: false,
    previewOn: true,
    manualPalette: {
      enabled: false,
      selected: 0,
      active: [true, false, false],
      colors
    }
  };
}

export function createDefaultState() {
  return {
    enabled: true,
    previewOpen: true,
    previewMode: "pixel",
    pixelPreviewMode: "big",
    shaderPreviewMode: "big",
    cross: 0.5,
    master: 1,
    bpm: 120,
    blendMode: "add",
    beat: { resetId: 0 },
    fx1: { mode: "none", amount: 0, rate: 0.5, flash: false, hold: false },
    fx2: { mode: "none", amount: 0, rate: 0.5, flash: false, hold: false },
    fxMaster: { mode: "none", amount: 0, rate: 0.5, flash: false, hold: false },
    fxMaster2: { mode: "none", amount: 0, rate: 0.5, flash: false, hold: false },
    l1: createDefaultLayerState(["#06233f", "#00b8e6", "#9ffcff"]),
    l2: createDefaultLayerState(["#07152f", "#176cff", "#b4f7ff"])
  };
}

export function createDefaultSettings() {
  return {
    outputMode: "preview",
    targetIp: "192.168.1.50",
    wifiPort: 7777,
    blxEnabled: false,
    blxTransport: "serial",
    blxTargetIp: "192.168.1.50",
    blxPort: 7777,
    blxSerialBaud: 1000000,
    fps: 60,
    previewFps: 60,
    gamma: 2.2,
    brightnessLimit: 1,
    contrast: 1.35,
    crossMouseSensitivity: 2.2,
    crossfaderPlacement: "normal",
    shaderPreviewFps: 60,
    layerPreviewEnabled: true,
    gpuMode: "auto",
    gpuEnabled: true,
    welcomeEnabled: true,
    welcomeText: "vítej borče",
    ledStartOff: true,
    // STEP22GC: output router flags are normal persistent settings.
    // They are intentionally independent from outputMode so Serial, ArtNet
    // and future USB-DMX can run in parallel.
    artnetEnabled: false,
    routerArtnetEnabled: false,
    routerSerialEnabled: false,
    usbDmxEnabled: false
  };
}

export function createDefaultTransitionSettings() {
  return {
    enabled: false,
    seconds: 1.5
  };
}

export function createModuleSlots() {
  return {
    l1: { anim: null, palette: null },
    l2: { anim: null, palette: null }
  };
}

export function createTransitionSlots() {
  return {
    l1: null,
    l2: null,
    blend: null
  };
}
