import { createRuntimeProfile } from "./runtime_profile.js";
import { createRuntimePrefsStore } from "./runtime_prefs_store.js";
import {
  applyRuntimePrefsToEnv,
  isRaspiStableLiveProfile,
  normalizeRuntimePreset
} from "./runtime_profile_routes.js";

export function createRuntimeModeController({
  runtimePrefsFile,
  processRef = process
} = {}) {
  const runtimePrefsStore = createRuntimePrefsStore({ runtimePrefsFile });
  const persistedRuntimePrefs = runtimePrefsStore.read();
  applyRuntimePrefsToEnv(persistedRuntimePrefs);

  const runtimeProfile = createRuntimeProfile();
  let runtimeProfileRevision = 1;

  function stampRuntimeProfile(reason = "boot") {
    runtimeProfile.runtimeProfileRevision = runtimeProfileRevision;
    runtimeProfile.runtimeProfileUpdatedAt = new Date().toISOString();
    runtimeProfile.runtimeProfileUpdateReason = reason;
    return runtimeProfile;
  }

  stampRuntimeProfile("boot");

  function setRuntimeMode({
    raspi,
    adaptiveFpsMode,
    runtimePreset,
    persist = true,
    stableLiveMode = false
  } = {}) {
    processRef.env.LED_RPI_MODE = raspi ? "1" : "0";
    const mode = ["off", "cpu", "serial", "auto"].includes(String(adaptiveFpsMode || "").toLowerCase())
      ? String(adaptiveFpsMode).toLowerCase()
      : (processRef.env.LED_ADAPTIVE_FPS_MODE || "off");
    const preset = normalizeRuntimePreset(runtimePreset || processRef.env.LED_RUNTIME_PRESET, raspi);
    processRef.env.LED_ADAPTIVE_FPS_MODE = mode;
    processRef.env.LED_RUNTIME_PRESET = preset;
    Object.assign(runtimeProfile, createRuntimeProfile());
    runtimeProfileRevision += 1;
    stampRuntimeProfile("set-runtime-mode");
    if (persist) {
      runtimePrefsStore.write({
        raspi: runtimeProfile.raspi === true,
        mode: runtimeProfile.raspi ? "raspi" : "normal",
        adaptiveFpsMode: runtimeProfile.adaptiveFpsMode || "off",
        runtimePreset: runtimeProfile.runtimePreset || preset,
        stableLiveMode: stableLiveMode === true && isRaspiStableLiveProfile(runtimeProfile)
      });
    }
    return runtimeProfile;
  }

  return {
    persistedRuntimePrefs,
    runtimePrefsStore,
    runtimeProfile,
    getRuntimeProfileRevision: () => runtimeProfileRevision,
    setRuntimeMode,
    stampRuntimeProfile
  };
}
