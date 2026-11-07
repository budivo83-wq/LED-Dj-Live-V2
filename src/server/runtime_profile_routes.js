const VALID_RUNTIME_PRESETS = new Set(["normal", "normal-pc", "raspi-safe", "raspi-stable", "raspi-ultra-safe", "burn-in"]);

export function isValidRuntimePreset(value) {
  return VALID_RUNTIME_PRESETS.has(String(value || "").trim().toLowerCase());
}

export function normalizeRuntimePreset(value, raspi) {
  const preset = String(value || "").trim().toLowerCase();
  if (isValidRuntimePreset(preset)) return preset;
  return raspi ? "raspi-safe" : "normal-pc";
}

export function isRaspiStableLiveProfile(profile = {}) {
  return profile?.raspi === true
    && ["raspi-stable", "raspi-ultra-safe"].includes(String(profile?.runtimePreset || "").toLowerCase())
    && String(profile?.adaptiveFpsMode || "").toLowerCase() === "auto";
}

export function applyRuntimePrefsToEnv(prefs = {}, env = process.env) {
  if (prefs.raspi != null) env.LED_RPI_MODE = prefs.raspi ? "1" : "0";
  if (prefs.adaptiveFpsMode) env.LED_ADAPTIVE_FPS_MODE = String(prefs.adaptiveFpsMode).toLowerCase();
  if (prefs.runtimePreset) env.LED_RUNTIME_PRESET = String(prefs.runtimePreset).toLowerCase();

  // STEP22OC: persist service/performance tuning too. Previously only the
  // runtime preset was restored, so a reboot could silently re-enable heavy
  // frame-rate diagnostics/thumb work.
  const map = {
    debugRefreshMs: "LED_DEBUG_REFRESH_MS",
    uiRefreshMs: "LED_UI_REFRESH_MS",
    shaderRefreshMs: "LED_SHADER_REFRESH_MS",
    disableShaderPrewarm: "LED_DISABLE_SHADER_PREWARM",
    disableThumbWarmup: "LED_DISABLE_THUMB_WARMUP",
    startupThumbPreload: "LED_STARTUP_THUMB_PRELOAD",
    runtimeThumbRender: "LED_RUNTIME_THUMB_RENDER",
    frameBusPublishEventMs: "LED_FRAMEBUS_PUBLISH_EVENT_MS",
    frameBusStatsMs: "LED_FRAMEBUS_STATS_MS",
    frameAuthorityStatsMs: "LED_FRAMEAUTHORITY_STATS_MS",
    frameAuthorityFrameEventMs: "LED_FRAMEAUTHORITY_FRAME_EVENT_MS",
    telemetryStatsMs: "LED_RENDER_TELEMETRY_STATS_MS",
    metricsEmitMs: "LED_RENDER_METRICS_EMIT_MS",
    outputPipelineStatsMs: "LED_OUTPUT_PIPELINE_STATS_MS",
    livePreviewFpsCap: "LED_LIVE_PREVIEW_FPS_CAP",
    liveRawPreviewGapMs: "LED_LIVE_RAW_PREVIEW_GAP_MS"
  };
  for (const [key, envName] of Object.entries(map)) {
    if (prefs[key] == null) continue;
    if (typeof prefs[key] === "boolean") env[envName] = prefs[key] ? "1" : "0";
    else env[envName] = String(prefs[key]);
  }
}

export function buildRuntimeProfileResponse({ profile, persisted = {}, runtimeProfileRevision = 1 }) {
  const runtimeStableLiveMode = isRaspiStableLiveProfile(profile);
  return {
    ok: true,
    raspi: profile.raspi === true,
    adaptiveFpsMode: profile.adaptiveFpsMode || "off",
    runtimePreset: profile.runtimePreset || "normal",
    runtimeStableLiveMode,
    stableLiveMode: runtimeStableLiveMode,
    runtimeProfileRevision,
    runtimeProfileUpdatedAt: profile.runtimeProfileUpdatedAt,
    runtimeProfileUpdateReason: profile.runtimeProfileUpdateReason,
    persisted,
    profile: { ...profile, runtimeStableLiveMode, stableLiveMode: runtimeStableLiveMode }
  };
}

export function registerRuntimeProfileRoutes(app, {
  runtimeProfile,
  getPersistedPrefs,
  setRuntimeMode,
  getRevision
}) {
  app.get("/api/runtime-profile", (_req, res) => {
    res.json(runtimeProfile);
  });

  app.get("/api/runtime/profile", (_req, res) => {
    res.json(buildRuntimeProfileResponse({
      profile: runtimeProfile,
      persisted: getPersistedPrefs(),
      runtimeProfileRevision: getRevision()
    }));
  });

  app.post("/api/runtime/profile", (req, res) => {
    const raspi = req.body?.raspi === true || req.body?.raspi === "true" || req.body?.mode === "raspi";
    const adaptiveFpsMode = req.body?.adaptiveFpsMode || req.body?.adaptive || process.env.LED_ADAPTIVE_FPS_MODE || "off";
    const hasRuntimePreset = Object.prototype.hasOwnProperty.call(req.body || {}, "runtimePreset");
    const runtimePreset = hasRuntimePreset ? String(req.body.runtimePreset || "").trim().toLowerCase() : undefined;

    if (hasRuntimePreset && !isValidRuntimePreset(runtimePreset)) {
      return res.status(400).json({
        ok: false,
        error: "Invalid runtimePreset",
        allowedRuntimePresets: Array.from(VALID_RUNTIME_PRESETS)
      });
    }

    const profile = setRuntimeMode({
      raspi,
      adaptiveFpsMode,
      runtimePreset,
      persist: req.body?.persist !== false,
      stableLiveMode: req.body?.stableLiveMode === true
    });

    console.log(`[runtime] switched to ${profile.raspi ? "RASPBERRY PI" : "NORMAL"} · preset=${profile.runtimePreset} · adaptive=${profile.adaptiveFpsMode}`, profile);
    res.json(buildRuntimeProfileResponse({
      profile,
      persisted: getPersistedPrefs(),
      runtimeProfileRevision: getRevision()
    }));
  });
}
