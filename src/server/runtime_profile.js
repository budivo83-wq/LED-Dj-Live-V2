function envInt(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

function envStr(name, fallback) {
  const raw = process.env[name];
  if (raw == null || String(raw).trim() === "") return fallback;
  return String(raw).trim().toLowerCase();
}

function envBool(name, fallback = false) {
  const raw = process.env[name];
  if (raw == null) return fallback;
  return ["1", "true", "yes", "on"].includes(String(raw).toLowerCase());
}

function normalizePreset(raw, raspi) {
  const value = String(raw || "").trim().toLowerCase();
  if (["normal", "normal-pc", "raspi-safe", "raspi-stable", "raspi-ultra-safe", "burn-in"].includes(value)) return value;
  return raspi ? "raspi-safe" : "normal-pc";
}

function modeFromPreset(preset) {
  const value = String(preset || "").toLowerCase();
  if (value === "burn-in") return "burnin";
  if (value === "raspi-stable") return "raspi-stable";
  if (value === "raspi-safe" || value === "raspi-ultra-safe") return "raspi-safe";
  return "normal";
}

function buildRuntimeModeProfile(mode) {
  // STEP22MH: output-first UI. Physical LED transport has priority over
  // thumbnails/debug graphs even on PC NORMAL mode. Heavy visual helpers can be
  // enabled later, but the live page must not steal time from ArtNet.
  const outputPriority = mode === "normal" || mode === "raspi-safe" || mode === "burnin" || mode === "raspi-stable";
  return {
    mode,
    uiFull: mode === "normal",
    // NORMAL keeps selector thumbnails visible; constrained/burn-in modes can
    // still disable them through their preset/runtime flags.
    thumbsEnabled: mode === "normal" || mode === "raspi-stable",
    debugGraphsEnabled: false,
    outputPriority
  };
}

function presetDefaults(preset, raspi) {
  if (preset === "burn-in") {
    return {
      uiRefreshMs: 450,
      shaderRefreshMs: 1600,
      debugRefreshMs: 1800,
      debugHiddenRefreshMs: 7000,
      hardwareStatsCacheMs: 3500,
      hardwareStatsPollMs: 7000,
      previewFps: 14,
      shaderPreviewFps: 8,
      galleryFps: 6,
      thumbnailFps: 3,
      thumbnailCacheEntries: 160,
      thumbnailCacheBytes: 7000000,
      disableShaderPrewarm: true,
      disableThumbWarmup: true,
      relaxedHealth: true,
      frameLossWarn: 20,
      frameLossBad: 140,
      adaptiveFpsSampleMs: 2400,
      adaptiveFpsCooldownMs: 9000,
      adaptiveFpsPreviewMin: 5,
      adaptiveFpsThumbnailMin: 2,
      adaptiveFpsOutputMin: 20
    };
  }

  if (preset === "raspi-stable") {
    return {
      uiRefreshMs: 320,
      shaderRefreshMs: 1250,
      debugRefreshMs: 1300,
      debugHiddenRefreshMs: 5200,
      hardwareStatsCacheMs: 3000,
      hardwareStatsPollMs: 6000,
      previewFps: 20,
      shaderPreviewFps: 14,
      galleryFps: 10,
      thumbnailFps: 6,
      thumbnailCacheEntries: 220,
      thumbnailCacheBytes: 9500000,
      disableShaderPrewarm: true,
      disableThumbWarmup: true,
      relaxedHealth: true,
      frameLossWarn: 12,
      frameLossBad: 100,
      adaptiveFpsSampleMs: 2000,
      adaptiveFpsCooldownMs: 7000,
      adaptiveFpsPreviewMin: 7,
      adaptiveFpsThumbnailMin: 3,
      adaptiveFpsOutputMin: 24
    };
  }

  if (preset === "raspi-ultra-safe") {
    return {
      uiRefreshMs: 400,
      shaderRefreshMs: 1500,
      debugRefreshMs: 1600,
      debugHiddenRefreshMs: 6000,
      hardwareStatsCacheMs: 4000,
      hardwareStatsPollMs: 7000,
      previewFps: 16,
      shaderPreviewFps: 10,
      galleryFps: 8,
      thumbnailFps: 4,
      thumbnailCacheEntries: 192,
      thumbnailCacheBytes: 8000000,
      disableShaderPrewarm: true,
      disableThumbWarmup: true,
      relaxedHealth: true,
      frameLossWarn: 16,
      frameLossBad: 120,
      adaptiveFpsSampleMs: 2200,
      adaptiveFpsCooldownMs: 8500,
      adaptiveFpsPreviewMin: 6,
      adaptiveFpsThumbnailMin: 2,
      adaptiveFpsOutputMin: 24
    };
  }

  if (preset === "raspi-safe") {
    return {
      uiRefreshMs: 250,
      shaderRefreshMs: 1000,
      debugRefreshMs: 1000,
      debugHiddenRefreshMs: 4000,
      hardwareStatsCacheMs: 2500,
      hardwareStatsPollMs: 5000,
      previewFps: 24,
      shaderPreviewFps: 18,
      galleryFps: 12,
      thumbnailFps: 8,
      thumbnailCacheEntries: 256,
      thumbnailCacheBytes: 12000000,
      disableShaderPrewarm: true,
      disableThumbWarmup: true,
      relaxedHealth: true,
      frameLossWarn: 8,
      frameLossBad: 80,
      adaptiveFpsSampleMs: 1800,
      adaptiveFpsCooldownMs: 6000,
      adaptiveFpsPreviewMin: 8,
      adaptiveFpsThumbnailMin: 3,
      adaptiveFpsOutputMin: 24
    };
  }

  return {
    // STEP22MH: stable live defaults. The old PC profile was UI/debug heavy
    // (100 ms UI tick, 30 FPS preview, live debug refresh) which is fine for
    // design work but bad while ArtNet is active. STEP22MH over-corrected the
    // visible preview down to ~12 FPS on PC NORMAL, which made operators think
    // the render path was broken. Keep NORMAL preview responsive again while
    // still leaving output as the authority.
    uiRefreshMs: raspi ? 320 : 420,
    shaderRefreshMs: raspi ? 1200 : 1600,
    debugRefreshMs: raspi ? 1600 : 2200,
    debugHiddenRefreshMs: raspi ? 7000 : 9000,
    hardwareStatsCacheMs: raspi ? 3000 : 2500,
    hardwareStatsPollMs: raspi ? 6000 : 5000,
    previewFps: raspi ? 16 : 30,
    shaderPreviewFps: raspi ? 10 : 24,
    galleryFps: raspi ? 8 : 12,
    thumbnailFps: raspi ? 3 : 6,
    thumbnailCacheEntries: raspi ? 256 : 192,
    thumbnailCacheBytes: raspi ? 12000000 : 9000000,
    disableShaderPrewarm: true,
    // NORMAL-PC owns the visible picker experience. Keep the thumbnail cache
    // warm from startup so opening a shader selector never performs the first
    // bulk import/render burst on the UI click.
    disableThumbWarmup: false,
    relaxedHealth: true,
    frameLossWarn: raspi ? 16 : 12,
    frameLossBad: raspi ? 140 : 120,
    adaptiveFpsSampleMs: raspi ? 2200 : 2400,
    adaptiveFpsCooldownMs: raspi ? 8000 : 9000,
    adaptiveFpsPreviewMin: raspi ? 5 : 4,
    adaptiveFpsThumbnailMin: raspi ? 1 : 1,
    adaptiveFpsOutputMin: raspi ? 24 : 30
  };
}

export function createRuntimeProfile() {
  const raspi = envBool("LED_RPI_MODE");
  const runtimePreset = normalizePreset(process.env.LED_RUNTIME_PRESET, raspi);
  const mode = modeFromPreset(runtimePreset);
  const runtimeModeProfile = buildRuntimeModeProfile(mode);
  const preset = presetDefaults(runtimePreset, raspi);
  const adaptiveFpsMode = envStr("LED_ADAPTIVE_FPS_MODE", "off");
  const adaptiveFpsEnabled = ["cpu", "serial", "auto"].includes(adaptiveFpsMode);
  const normalLock = mode === "normal";
  const selectInt = (envName, lockedValue) => normalLock ? lockedValue : envInt(envName, lockedValue);
  const selectBool = (envName, lockedValue) => normalLock ? lockedValue : envBool(envName, lockedValue);
  return {
    raspi,
    mode,
    runtimeModeProfile,
    uiFull: runtimeModeProfile.uiFull,
    thumbsEnabled: runtimeModeProfile.thumbsEnabled,
    debugGraphsEnabled: runtimeModeProfile.debugGraphsEnabled,
    outputPriority: runtimeModeProfile.outputPriority,
    runtimePreset,
    // STEP22MH: allow AUTO governor even in NORMAL if enabled via env/UI.
    // It never raises UI load; it only soft-caps preview/thumbs under pressure.
    adaptiveFpsMode: adaptiveFpsMode,
    adaptiveFpsEnabled: adaptiveFpsEnabled,
    runtimeStableLiveMode: raspi === true && ["raspi-stable", "raspi-ultra-safe"].includes(runtimePreset) && adaptiveFpsMode === "auto",
    adaptiveFpsSampleMs: selectInt("LED_ADAPTIVE_FPS_SAMPLE_MS", preset.adaptiveFpsSampleMs),
    adaptiveFpsCooldownMs: selectInt("LED_ADAPTIVE_FPS_COOLDOWN_MS", preset.adaptiveFpsCooldownMs),
    adaptiveFpsPreviewMin: selectInt("LED_ADAPTIVE_PREVIEW_MIN_FPS", preset.adaptiveFpsPreviewMin),
    adaptiveFpsThumbnailMin: selectInt("LED_ADAPTIVE_THUMB_MIN_FPS", preset.adaptiveFpsThumbnailMin),
    adaptiveFpsOutputMin: selectInt("LED_ADAPTIVE_OUTPUT_MIN_FPS", preset.adaptiveFpsOutputMin),
    disableShaderPrewarm: selectBool("LED_DISABLE_SHADER_PREWARM", preset.disableShaderPrewarm),
    disableThumbWarmup: selectBool("LED_DISABLE_THUMB_WARMUP", preset.disableThumbWarmup),
    uiRefreshMs: selectInt("LED_UI_REFRESH_MS", preset.uiRefreshMs),
    shaderRefreshMs: selectInt("LED_SHADER_REFRESH_MS", preset.shaderRefreshMs),
    debugRefreshMs: selectInt("LED_DEBUG_REFRESH_MS", preset.debugRefreshMs),
    auditLimit: envInt("LED_AUDIT_LIMIT", raspi ? 300 : 200),
    runtimeOnly: normalLock ? false : envBool("LED_RUNTIME_ONLY", false),
    lowPower: normalLock ? false : envBool("LED_LOW_POWER_MODE", false),
    relaxedHealth: normalLock ? false : envBool("LED_HEALTH_RELAXED", preset.relaxedHealth),
    frameLossWarn: selectInt("LED_FRAME_LOSS_WARN", preset.frameLossWarn),
    frameLossBad: selectInt("LED_FRAME_LOSS_BAD", preset.frameLossBad),
    hardwareStatsCacheMs: selectInt("LED_HARDWARE_STATS_CACHE_MS", preset.hardwareStatsCacheMs),
    hardwareStatsPollMs: selectInt("LED_HARDWARE_STATS_POLL_MS", preset.hardwareStatsPollMs),
    debugHiddenRefreshMs: selectInt("LED_DEBUG_HIDDEN_REFRESH_MS", preset.debugHiddenRefreshMs),
    raspiFocusRefreshMs: envInt("LED_RASPI_FOCUS_REFRESH_MS", raspi ? 2500 : 1200),
    shellBootLoginBackground: envBool("LED_SHELL_BOOT_LOGIN_BACKGROUND", true),
    previewFps: selectInt("LED_PREVIEW_FPS", preset.previewFps),
    shaderPreviewFps: selectInt("LED_SHADER_PREVIEW_FPS", preset.shaderPreviewFps),
    galleryFps: selectInt("LED_GALLERY_FPS", preset.galleryFps),
    thumbnailFps: selectInt("LED_THUMBNAIL_FPS", preset.thumbnailFps),
    startupThumbPreload: normalLock ? true : envBool("LED_STARTUP_THUMB_PRELOAD", true),
    runtimeThumbRender: normalLock ? true : envBool("LED_RUNTIME_THUMB_RENDER", !raspi),
    thumbnailCacheEntries: selectInt("LED_THUMB_CACHE_ENTRIES", preset.thumbnailCacheEntries),
    thumbnailCacheBytes: selectInt("LED_THUMB_CACHE_BYTES", preset.thumbnailCacheBytes),
    // STEP22OC service mode: live output must not emit heavy diagnostics/events at
    // frame rate. Direct output_pipeline owns hardware frames; framebus publish
    // events are only diagnostic fallback now.
    frameBusPublishEventMs: selectInt("LED_FRAMEBUS_PUBLISH_EVENT_MS", 0),
    frameBusStatsMs: selectInt("LED_FRAMEBUS_STATS_MS", 1200),
    frameAuthorityStatsMs: selectInt("LED_FRAMEAUTHORITY_STATS_MS", 1200),
    frameAuthorityFrameEventMs: selectInt("LED_FRAMEAUTHORITY_FRAME_EVENT_MS", 0),
    telemetryStatsMs: selectInt("LED_RENDER_TELEMETRY_STATS_MS", 1200),
    metricsEmitMs: selectInt("LED_RENDER_METRICS_EMIT_MS", 750),
    outputPipelineStatsMs: selectInt("LED_OUTPUT_PIPELINE_STATS_MS", 750),
    // Main visible preview cadence is operator-configurable. Keep the legacy
    // live monitor fallback at a normal-PC rate instead of silently forcing 6 FPS.
    livePreviewFpsCap: selectInt("LED_LIVE_PREVIEW_FPS_CAP", raspi ? 4 : 30),
    liveRawPreviewGapMs: selectInt("LED_LIVE_RAW_PREVIEW_GAP_MS", 900),
    // STEP37AI: cosmetic/operator UI is deliberately slower while live output
    // is active. These can be overridden from env if design work needs faster
    // dashboards, but the default favours stable ArtNet FPS.
    liveOutputUiCardsMs: selectInt("LED_LIVE_OUTPUT_UI_CARDS_MS", raspi ? 700 : 500),
    liveOutputShaderInspectorMs: selectInt("LED_LIVE_OUTPUT_SHADER_INSPECTOR_MS", raspi ? 1800 : 1200),
    debugLiveOutputRefreshMs: selectInt("LED_DEBUG_LIVE_OUTPUT_REFRESH_MS", raspi ? 3500 : 2500),
    wsStateBufferedSkipBytes: selectInt("LED_WS_STATE_BUFFERED_SKIP_BYTES", 512000),
    wsStateBackpressureRetryMs: selectInt("LED_WS_STATE_BACKPRESSURE_RETRY_MS", 120)
  };
}
