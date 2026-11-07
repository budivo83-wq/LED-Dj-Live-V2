// STEP 13AQ: central FPS governor
// Output FPS is the transport authority. UI, preview, gallery and thumbnails must never
// lower or rewrite output FPS. They only get their own capped budgets.

function clampInt(value, min, max, fallback) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function readStoredPreviewFps(runtimeProfile, fallback) {
  try {
    const rawSettings = globalThis?.localStorage?.getItem?.('led-engine-settings-v1');
    if (rawSettings) {
      const parsed = JSON.parse(rawSettings);
      const stored = Number(parsed?.previewFps || 0);
      if (Number.isFinite(stored) && stored > 0) return Math.min(60, Math.max(1, Math.round(stored)));
    }
    const cap = Number(globalThis?.localStorage?.getItem?.('budilightLivePreviewFpsCap') || globalThis?.localStorage?.getItem?.('budilightShellLivePreviewFpsCap') || 0);
    if (Number.isFinite(cap) && cap > 0) return Math.min(60, Math.max(1, Math.round(cap)));
  } catch {}
  return clampInt(runtimeProfile.previewFps, 1, 60, fallback);
}

function nowMs() {
  return (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
}

function createAdaptiveState({ runtimeProfile = {}, documentRef = document } = {}) {
  const state = {
    level: 0,
    emaFrameMs: 0,
    lastRafMs: 0,
    lastAdjustMs: 0,
    started: false
  };

  function mode() {
    return String(runtimeProfile?.adaptiveFpsMode || "off").toLowerCase();
  }

  function enabled() {
    return ["cpu", "serial", "auto"].includes(mode());
  }

  function tick(ts) {
    if (!enabled()) {
      state.level = 0;
      state.lastRafMs = ts || nowMs();
      requestAnimationFrame(tick);
      return;
    }

    const t = ts || nowMs();
    if (state.lastRafMs > 0 && documentRef?.hidden !== true) {
      const dt = Math.max(1, Math.min(250, t - state.lastRafMs));
      state.emaFrameMs = state.emaFrameMs ? (state.emaFrameMs * 0.88 + dt * 0.12) : dt;
      const cooldown = Math.max(1500, Number(runtimeProfile?.adaptiveFpsCooldownMs || 4500));
      if (t - state.lastAdjustMs > cooldown) {
        if (state.emaFrameMs > 55 && state.level < 3) {
          state.level += 1;
          state.lastAdjustMs = t;
        } else if (state.emaFrameMs < 28 && state.level > 0) {
          state.level -= 1;
          state.lastAdjustMs = t;
        }
      }
    }
    state.lastRafMs = t;
    requestAnimationFrame(tick);
  }

  if (typeof requestAnimationFrame === "function" && !state.started) {
    state.started = true;
    requestAnimationFrame(tick);
  }

  return {
    mode,
    enabled,
    level: () => enabled() ? state.level : 0,
    emaFrameMs: () => Math.round(state.emaFrameMs || 0)
  };
}

function adaptiveCap(value, level, minValue, factors) {
  const base = Math.max(1, Number(value) || 1);
  const i = Math.max(0, Math.min(factors.length - 1, Number(level) || 0));
  return Math.max(minValue, Math.round(base * factors[i]));
}

export const FPS_DOMAINS = Object.freeze({
  OUTPUT: "output",
  PREVIEW: "preview",
  SHADER_PREVIEW: "shaderPreview",
  GALLERY: "gallery",
  THUMBNAIL: "thumbnail",
  DEBUG: "debug"
});

export function createFpsGovernor({ settings = {}, runtimeProfile = {}, documentRef = document } = {}) {
  const authority = globalThis?.__ledRuntimeModeAuthority?.get?.() || {};
  const mode = String(authority.mode || runtimeProfile.mode || (runtimeProfile.raspi ? "raspi-safe" : "normal")).toLowerCase();
  const outputPriority = authority.outputPriority === true;
  const constrained = mode !== "normal";
  const outputMin = 1;
  const outputMax = 120;
  const outputDefault = outputPriority ? 50 : 60;
  const adaptive = createAdaptiveState({ runtimeProfile, documentRef });

  function outputFps() {
    // Settings/output config owns this. Adaptive SERIAL/AUTO may only cap it downward under visible UI load.
    const base = clampInt(settings?.fps, outputMin, outputMax, outputDefault);
    const mode = adaptive.mode();
    if (mode !== "serial" && mode !== "auto") return base;
    const min = clampInt(runtimeProfile.adaptiveFpsOutputMin, 1, outputMax, outputPriority ? 24 : 30);
    const adaptiveOutput = adaptiveCap(base, adaptive.level(), min, [1, 0.83, 0.66, 0.5]);
    const safeCap = clampInt(globalThis?.__ledRaspiSafeLiveState?.fpsCap, 1, outputMax, 0);
    return safeCap > 0 ? Math.min(adaptiveOutput, safeCap) : adaptiveOutput;
  }

  function previewFps() {
    const hidden = documentRef?.hidden === true;
    if (hidden) return constrained ? 5 : 10;
    const cap = readStoredPreviewFps(runtimeProfile, constrained ? 24 : 30);
    const min = clampInt(runtimeProfile.adaptiveFpsPreviewMin, 1, cap, constrained ? 8 : 12);
    const adaptivePreview = adaptiveCap(cap, adaptive.level(), min, [1, 0.75, 0.55, 0.4]);
    return Math.min(outputFps(), adaptivePreview);
  }

  function shaderPreviewFps() {
    const cap = clampInt(runtimeProfile.shaderPreviewFps, 1, 60, constrained ? 18 : 30);
    const adaptiveShader = adaptiveCap(cap, adaptive.level(), constrained ? 6 : 10, [1, 0.7, 0.5, 0.35]);
    return Math.min(previewFps(), adaptiveShader);
  }

  function galleryFps() {
    const cap = clampInt(runtimeProfile.galleryFps, 1, 30, constrained ? 12 : 18);
    return adaptiveCap(cap, adaptive.level(), constrained ? 4 : 6, [1, 0.7, 0.5, 0.35]);
  }

  function thumbnailFps() {
    const cap = clampInt(runtimeProfile.thumbnailFps, 1, 20, constrained ? 8 : 12);
    const min = clampInt(runtimeProfile.adaptiveFpsThumbnailMin, 1, cap, constrained ? 3 : 5);
    return adaptiveCap(cap, adaptive.level(), min, [1, 0.65, 0.45, 0.3]);
  }

  function frameMs(domain = FPS_DOMAINS.PREVIEW) {
    const fps = domain === FPS_DOMAINS.OUTPUT ? outputFps()
      : domain === FPS_DOMAINS.SHADER_PREVIEW ? shaderPreviewFps()
      : domain === FPS_DOMAINS.GALLERY ? galleryFps()
      : domain === FPS_DOMAINS.THUMBNAIL ? thumbnailFps()
      : previewFps();
    return 1000 / Math.max(1, fps);
  }

  return Object.freeze({
    outputFps,
    previewFps,
    shaderPreviewFps,
    galleryFps,
    thumbnailFps,
    frameMs,
    snapshot: () => Object.freeze({
      outputFps: outputFps(),
      previewFps: previewFps(),
      shaderPreviewFps: shaderPreviewFps(),
      galleryFps: galleryFps(),
      thumbnailFps: thumbnailFps(),
      adaptiveFpsMode: adaptive.mode(),
      adaptiveFpsLevel: adaptive.level(),
      adaptiveFrameMs: adaptive.emaFrameMs()
    })
  });
}
