// Shared runtime constants. Keep IDs and localStorage keys centralized so pages
// can evolve without silently diverging.

export const MATRIX_DEFAULT_WIDTH = 30;
export const MATRIX_DEFAULT_HEIGHT = 10;
export const LED_PREVIEW_CELL_SIZE = 15;
export const PARAM_COUNT = 4;
export const DEFAULT_PARAM_LABELS = ["Scale", "Speed", "Shape", "Intensity"];

export const STORAGE_KEY = "led-engine-state-v3";
export const SETTINGS_KEY = "led-engine-settings-v1";
export const MAPPING_KEY = "led-engine-mapping-v1";
export const TRANSITION_KEY = "led-engine-transition-v1";
export const SERIAL_KEY = "led-engine-serial-v1";
export const SHADER_PREWARM_KEY = "led-engine-shader-prewarm-v1";
export const SHADER_MODULE_PREWARM_KEY = "led-engine-shader-module-prewarm-v1";

export const FORCE_CPU_RENDER = false;
export const FORCE_CPU_LAYER_PREVIEW = true;
export const DEFAULT_RUNTIME_FPS = 60;
export const MIN_RUNTIME_FPS = 1;
export const MAX_RUNTIME_FPS = 120;
export const RAW_PREVIEW_FPS = DEFAULT_RUNTIME_FPS;
export const RAW_PREVIEW_SCALE = 0.5;
export const STARTUP_ANIM_THUMB_SIZE = { width: 144, height: 80 };

export const BLEND_MODES = [
  "fade",
  "mix",
  "add",
  "screen",
  "multiply",
  "max",
  "difference",
  "overlay",
  "softlight",
  "colorDodge",
  "lumaMask",
  "strobeGate",
  "beatCut",
  "glitchMix",
  "subtract",
  "darken"
];

export const BLEND_GROUPS = {
  basic: ["fade", "mix", "add", "screen", "multiply", "max", "difference", "subtract", "darken"],
  cinematic: ["overlay", "softlight", "colorDodge"],
  glitch: ["glitchMix"],
  reactive: ["strobeGate", "beatCut"],
  shader: ["lumaMask"],
  mask: ["lumaMask"]
};
