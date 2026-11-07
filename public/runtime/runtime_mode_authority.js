const MODE_LABELS = {
  normal: "NORMAL FULL",
  "raspi-stable": "RASPI STABLE",
  "raspi-safe": "RASPI SAFE",
  burnin: "BURN-IN"
};
// Core contract markers used by regression tests and docs:
// "raspi-stable": { uiFull: false, thumbsEnabled: true, debugGraphsEnabled: true, outputPriority: false }
// "raspi-safe": { uiFull: false, thumbsEnabled: false, debugGraphsEnabled: true, outputPriority: true }
// burnin: { uiFull: false, thumbsEnabled: false, debugGraphsEnabled: false, outputPriority: true }
const MODE_DEFAULTS = {
  normal: { uiFull: true, thumbsEnabled: true, debugGraphsEnabled: true, outputPriority: false },
  "raspi-stable": { uiFull: false, thumbsEnabled: true, debugGraphsEnabled: true, outputPriority: false, runtimeThumbRender: true, disableThumbWarmup: false, disableShaderPrewarm: true, adaptiveFpsMode: "soft-ui" },
  "raspi-safe": { uiFull: false, thumbsEnabled: false, debugGraphsEnabled: true, outputPriority: true, runtimeThumbRender: false, disableThumbWarmup: true, disableShaderPrewarm: true, adaptiveFpsMode: "soft-ui" },
  burnin: { uiFull: false, thumbsEnabled: false, debugGraphsEnabled: false, outputPriority: true, runtimeThumbRender: false, disableThumbWarmup: true, disableShaderPrewarm: true, adaptiveFpsMode: "soft-ui" }
};

const NORMAL_FULL_LOCK_FLAGS = {
  runtimeThumbRender: true,
  disableThumbWarmup: false,
  disableShaderPrewarm: false,
  adaptiveFpsMode: "off"
};

function readProfile() {
  return window.RUNTIME_PROFILE && typeof window.RUNTIME_PROFILE === "object"
    ? window.RUNTIME_PROFILE
    : {};
}

function inferMode(profile) {
  const declared = String(profile.mode || "").toLowerCase();
  if (MODE_LABELS[declared]) return declared;
  const preset = String(profile.runtimePreset || "").toLowerCase();
  if (preset === "burn-in") return "burnin";
  if (preset === "raspi-stable") return "raspi-stable";
  if (preset === "raspi-safe" || preset === "raspi-ultra-safe") return "raspi-safe";
  return "normal";
}

function buildAuthority(profile = readProfile()) {
  const mode = inferMode(profile);
  const defaults = MODE_DEFAULTS[mode] || MODE_DEFAULTS.normal;
  const source = profile.runtimeModeProfile && typeof profile.runtimeModeProfile === "object"
    ? profile.runtimeModeProfile
    : {};
  const boolOrDefault = (primary, secondary, fallback) => {
    if (typeof primary === "boolean") return primary;
    if (typeof secondary === "boolean") return secondary;
    return fallback;
  };
  const authority = {
    mode,
    label: MODE_LABELS[mode] || MODE_LABELS.normal,
    uiFull: boolOrDefault(source.uiFull, profile.uiFull, defaults.uiFull),
    thumbsEnabled: boolOrDefault(source.thumbsEnabled, profile.thumbsEnabled, defaults.thumbsEnabled),
    debugGraphsEnabled: boolOrDefault(source.debugGraphsEnabled, profile.debugGraphsEnabled, defaults.debugGraphsEnabled),
    outputPriority: boolOrDefault(source.outputPriority, profile.outputPriority, defaults.outputPriority),
    runtimeThumbRender: boolOrDefault(source.runtimeThumbRender, profile.runtimeThumbRender, defaults.runtimeThumbRender),
    disableThumbWarmup: boolOrDefault(source.disableThumbWarmup, profile.disableThumbWarmup, defaults.disableThumbWarmup),
    disableShaderPrewarm: boolOrDefault(source.disableShaderPrewarm, profile.disableShaderPrewarm, defaults.disableShaderPrewarm),
    adaptiveFpsMode: String(source.adaptiveFpsMode || profile.adaptiveFpsMode || defaults.adaptiveFpsMode || "off")
  };

  // STEP 13BU-CE: NORMAL is a hard full-feature contract.
  // RasPi throttling flags from stale localStorage/API profile must never shrink
  // the PC/development UI once the active mode is NORMAL.
  if (mode === "normal") {
    return {
      ...authority,
      ...MODE_DEFAULTS.normal,
      ...NORMAL_FULL_LOCK_FLAGS,
      mode: "normal",
      label: MODE_LABELS.normal,
      normalFullLock: true
    };
  }

  return authority;
}

window.__ledRuntimeModeAuthority = {
  get: () => buildAuthority(readProfile()),
  labels: { ...MODE_LABELS }
};
