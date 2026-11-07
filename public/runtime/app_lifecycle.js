export function createAppLifecycleState({
  headless,
  shellViewOnly,
  safeBoot = false,
  sessionStorageRef,
  performanceRef,
  createStartupOverlay
}) {
  const FAST_MAIN_RETURN_KEY = "led-main-return-fast";
  const MAIN_BOOTED_KEY = "led-main-booted";
  const fastMainReturn = sessionStorageRef.getItem(FAST_MAIN_RETURN_KEY) === "1";
  if (fastMainReturn) sessionStorageRef.removeItem(FAST_MAIN_RETURN_KEY);

  const mainAlreadyBooted = sessionStorageRef.getItem(MAIN_BOOTED_KEY) === "1";
  const embeddedRuntime = Boolean(headless || shellViewOnly);
  const skipStartupLoading = Boolean(embeddedRuntime || safeBoot || fastMainReturn || mainAlreadyBooted);
  // STEP22NW: strict startup prewarm was able to monopolize Chromium and pull live/output FPS down.
  // Keep startup/loading visual-only by default; opt in with ?strictPrewarm=1 when benchmarking caches.
  const strictStartupPrewarm = !skipStartupLoading && !safeBoot && new URLSearchParams(location.search || '').get('strictPrewarm') === '1';
  const startupProfiling = {
    enabled: embeddedRuntime ? false : (strictStartupPrewarm ? true : !skipStartupLoading),
    startedAt: performanceRef.now(),
    marks: []
  };
  const startupOverlay = startupProfiling.enabled ? createStartupOverlay() : null;

  return {
    fastMainReturn,
    mainAlreadyBooted,
    embeddedRuntime,
    skipStartupLoading,
    strictStartupPrewarm,
    startupProfiling,
    startupOverlay
  };
}

export function startAppLifecycle({
  headless,
  documentRef,
  headlessLeader,
  startFpsMeter,
  startPerfProfileReporter,
  startUiRefreshLoops,
  syncMasterValue,
  refreshRangeVisuals,
  initPostLoginTransition,
  init
}) {
  startFpsMeter();
  startPerfProfileReporter();
  startUiRefreshLoops();
  if (headless) documentRef.documentElement.classList.add("headless-output");
  if (headless) {
    headlessLeader.init();
  }
  syncMasterValue();
  refreshRangeVisuals();
  initPostLoginTransition();
  init();
}
