function reportDeferredError(label, error) {
  console.warn(`[startup warmup] ${label} failed`, error);
}

async function safeAwait(label, task) {
  try {
    await task?.();
  } catch (error) {
    reportDeferredError(label, error);
  }
}

function deferWarmup(windowRef, label, task, delay = 350) {
  const run = () => Promise.resolve()
    .then(task)
    .catch((error) => reportDeferredError(label, error));

  if (windowRef?.setTimeout) {
    windowRef.setTimeout(run, delay);
    return;
  }

  setTimeout(run, delay);
}

function deferCommonWarmups({
  windowRef,
  preloadThumbnailCache,
  preloadNeighborShaders,
  lists,
  state,
  warmupStoredShaderScenes,
  warmupStoredShaderModules,
  preloadEverythingForStartup,
  includeEverything = false,
  delay = 1400
}) {
  deferWarmup(windowRef, "thumbnail cache", () => preloadThumbnailCache?.(), delay);
  deferWarmup(windowRef, "neighbor shader warmup", () => {
    preloadNeighborShaders?.("l1", "l1_anims", lists?.l1Anims || [], state?.l1?.animFile);
    preloadNeighborShaders?.("l2", "l2_anims", lists?.l2Anims || [], state?.l2?.animFile);
  }, delay + 3600);
  deferWarmup(windowRef, "stored shader scenes", () => warmupStoredShaderScenes?.(), delay + 1600);
  deferWarmup(windowRef, "stored shader modules", () => warmupStoredShaderModules?.(), delay + 2400);
  if (includeEverything) {
    deferWarmup(windowRef, "full startup preload", () => preloadEverythingForStartup?.(), delay + 3600);
  }
}

export async function runStartupWarmupFlow(deps) {
  const {
    runtimeProfile = {},
    headless,
    shellViewOnly,
    skipStartupLoading,
    strictStartupPrewarm,
    embeddedRuntime,
    startupStep,
    preloadHeadlessWebglStartup,
    preloadShellViewStartup,
    preloadThumbnailCache,
    preloadNeighborShaders,
    lists,
    state,
    warmupStoredShaderScenes,
    warmupStoredShaderModules,
    preloadEverythingForStartup,
    windowRef
  } = deps;

  // Startup thumbnail rendering is opt-in. Selector thumbnails are rendered
  // lazily by the idle queue; generating the complete library at boot blocks
  // the first live frames when the animation library is large.
  const disableThumbWarmup = runtimeProfile.disableThumbWarmup === true
    || runtimeProfile.runtimeOnly === true
    || runtimeProfile.startupThumbPreload !== true;
  const disableShaderPrewarm = runtimeProfile.disableShaderPrewarm === true || runtimeProfile.runtimeOnly === true || runtimeProfile.lowPower === true;

  if (runtimeProfile.runtimeOnly) {
    startupStep?.(88, "Starting RasPi runtime-only mode");
    if (headless) await safeAwait("headless WebGL startup", preloadHeadlessWebglStartup);
    return;
  }

  const safePreloadThumbnailCache = disableThumbWarmup ? null : preloadThumbnailCache;
  const safePreloadNeighborShaders = disableShaderPrewarm ? null : preloadNeighborShaders;
  const safeWarmupStoredShaderScenes = disableShaderPrewarm ? null : warmupStoredShaderScenes;
  const safeWarmupStoredShaderModules = disableShaderPrewarm ? null : warmupStoredShaderModules;
  const safePreloadEverythingForStartup = (disableThumbWarmup || disableShaderPrewarm) ? null : preloadEverythingForStartup;

  if (headless) {
    startupStep?.(88, "Starting output runtime");
    await safeAwait("headless WebGL startup", preloadHeadlessWebglStartup);
    return;
  }

  if (shellViewOnly) {
    // Import every listed module before READY so the first shader/palette
    // change never performs a blocking dynamic import inside the click path.
    startupStep?.(78, "Caching UI modules");
    await safeAwait("shell module cache", preloadShellViewStartup);
    // The shell view does not own hardware output, but it does own the visible
    // shader/palette pickers. Build their cache before READY; otherwise opening
    // a picker becomes the first expensive import/render burst.
    startupStep?.(88, "Preparing picker thumbnails");
    await safeAwait("shell thumbnail cache", safePreloadThumbnailCache);
    // The visible Shell owns the Shader canvas and its WebGL context. It must
    // run the same full GPU/CPU prewarm as the main runtime; otherwise every
    // shader change compiles in the Shell for the first time.
    startupStep?.(92, "Preparing GPU shader previews");
    await safeAwait("shell GPU shader preload", safePreloadEverythingForStartup);
    startupStep?.(95, "Starting UI runtime");
    return;
  }

  if (strictStartupPrewarm && !skipStartupLoading) {
    // Explicit strict mode may still wait, but failures are non-fatal: startup contract
    // must always continue to READY.
    startupStep?.(90, "Prewarming runtime");
    await safeAwait("thumbnail cache", safePreloadThumbnailCache);
    preloadNeighborShaders?.("l1", "l1_anims", lists?.l1Anims || [], state?.l1?.animFile);
    preloadNeighborShaders?.("l2", "l2_anims", lists?.l2Anims || [], state?.l2?.animFile);
    await safeAwait("stored shader scenes", safeWarmupStoredShaderScenes);
    await safeAwait("stored shader modules", safeWarmupStoredShaderModules);
    await safeAwait("full startup preload", safePreloadEverythingForStartup);
    return;
  }

  startupStep?.(90, runtimeProfile.startupThumbPreload === true ? "Preloading thumbnails" : "Scheduling warmup");
  // Thumbnail readiness is part of the normal desktop startup contract. The
  // fast-return flag skips the visual overlay, not the cache preparation;
  // otherwise the first picker open becomes an avoidable blocking import/render
  // burst.
  if (runtimeProfile.startupThumbPreload === true && !embeddedRuntime) {
    await safeAwait("thumbnail cache", safePreloadThumbnailCache);
  }
  if (!embeddedRuntime) {
    // The full shader/module preload must finish before READY. Deferring this
    // work made the first fade changes look smooth, then caused a later fade to
    // synchronously compile a transition program on the render thread.
    if (!disableShaderPrewarm) {
      startupStep?.(92, "Preparing animation transitions");
      await safeAwait("full startup preload", safePreloadEverythingForStartup);
    }
    deferCommonWarmups({
      windowRef,
      preloadThumbnailCache: runtimeProfile.startupThumbPreload === true ? null : safePreloadThumbnailCache,
      preloadNeighborShaders: safePreloadNeighborShaders,
      lists,
      state,
      warmupStoredShaderScenes: safeWarmupStoredShaderScenes,
      warmupStoredShaderModules: safeWarmupStoredShaderModules,
      preloadEverythingForStartup: null,
      includeEverything: false,
      delay: 1800
    });
  }
}
