export async function runStartupSequence(deps) {
  const {
    runtimeProfile = {},
    HEADLESS,
    SHELL_VIEW_ONLY,
    SKIP_STARTUP_LOADING,
    STRICT_STARTUP_PREWARM,
    EMBEDDED_RUNTIME,
    startupStep,
    initShaderInspectorToggle,
    initPreviewCollapseToggle,
    restoreLocalState,
    restoreTransitionSettings,
    ensureBeatClock,
    syncControls,
    initBackgroundDrawWorker,
    connectSocket,
    bindViewportLifecycle,
    resizePreviewCanvas,
    stopBackgroundDrawWorker,
    scheduleNextDraw,
    renderPipeline,
    loadSelectedModules,
    loadList,
    controls,
    lists,
    state,
    pickFile,
    startupProfiling,
    sessionStorageRef,
    finishStartupProfiling,
    notifyShellRuntimeReady,
    bindControls,
    restoreSettings,
    restoreMapping,
    restoreSerialSettings,
    bindRuntimeStateSync,
    settingsKey,
    mappingKey,
    serialKey,
    storageKey,
    animationLibrarySyncKey,
    syncSettingsControls,
    reloadRuntimeStateFromStorage,
    refreshAnimationLibraryRuntime,
    applyState,
    onLedPower,
    isApplyingRemoteState,
    scheduleCpuPrewarm,
    runStartupWarmupFlow,
    createGpuSceneCandidate,
    scheduleGpuWarmup,
    preloadHeadlessWebglStartup,
    preloadShellViewStartup,
    preloadThumbnailCache,
    preloadNeighborShaders,
    warmupStoredShaderScenes,
    warmupStoredShaderModules,
    preloadEverythingForStartup,
    startupFrameGuardRef,
    startupReadyAtRef,
    setPreferLocalStateOnBoot
  } = deps;

  startupStep(6, "Restoring state");
  initShaderInspectorToggle();
  initPreviewCollapseToggle();
  setPreferLocalStateOnBoot(restoreLocalState());
  restoreTransitionSettings();
  ensureBeatClock();
  startupStep(12, "Starting render loop");

  syncControls();
  if (!SHELL_VIEW_ONLY) initBackgroundDrawWorker();
  connectSocket();
  bindViewportLifecycle({
    windowRef: window,
    documentRef: document,
    onResize: () => {
      resizePreviewCanvas();
      scheduleNextDraw(performance.now(), true);
    },
    onOrientationChange: () => {
      resizePreviewCanvas();
      scheduleNextDraw(performance.now(), true);
    },
    onVisibilityHidden: () => {
      stopBackgroundDrawWorker?.();
      scheduleNextDraw(performance.now(), true);
    },
    onVisibilityVisible: () => {
      scheduleNextDraw(performance.now(), true);
    }
  });
  const now = performance.now();
  scheduleNextDraw(now, true);
  if (!SHELL_VIEW_ONLY) {
    renderPipeline?.startOutputLoop?.(now);
  }

  const eagerModuleLoad = SHELL_VIEW_ONLY ? Promise.resolve() : loadSelectedModules();
  startupStep(18, "Loading lists");

  const [l1Anims, l1Palettes, l2Anims, l2Palettes] = await Promise.all([
    loadList("l1_anims", controls.l1Anim),
    loadList("l1_palettes", controls.l1Palette),
    loadList("l2_anims", controls.l2Anim),
    loadList("l2_palettes", controls.l2Palette)
  ]);
  startupStep(52, "Applying lists");

  lists.l1Anims = l1Anims;
  lists.l1Palettes = l1Palettes;
  lists.l2Anims = l2Anims;
  lists.l2Palettes = l2Palettes;
  state.l1.animFile = pickFile(state.l1.animFile, l1Anims);
  state.l1.paletteFile = pickFile(state.l1.paletteFile, l1Palettes);
  state.l2.animFile = pickFile(state.l2.animFile, l2Anims);
  state.l2.paletteFile = pickFile(state.l2.paletteFile, l2Palettes);
  startupStep(64, "Binding controls");
  bindControls();
  restoreSettings();
  restoreMapping();
  restoreSerialSettings();
  startupStep(78, "Finalizing modules");
  bindRuntimeStateSync({
    windowRef: window,
    settingsKey,
    mappingKey,
    serialKey,
    storageKey,
    animationLibrarySyncKey,
    restoreSettings,
    syncSettingsControls,
    restoreMapping,
    restoreSerialSettings,
    reloadRuntimeStateFromStorage,
    refreshAnimationLibraryRuntime,
    state,
    applyState,
    loadSelectedModules,
    scheduleCpuPrewarm,
    syncControls,
    onLedPower
  });

  if (SHELL_VIEW_ONLY) {
    deferShellViewModuleLoad({
      windowRef: window,
      loadSelectedModules,
      isApplyingRemoteState,
      syncControls,
      scheduleNextDraw
    });
  } else {
    await eagerModuleLoad.catch(() => null);
    await loadSelectedModules().then(() => {
      if (!isApplyingRemoteState()) syncControls();
    }).catch((error) => {
      console.warn("Initial module load failed", error);
    });
  }
  scheduleNextDraw(performance.now(), true);
  await runStartupWarmupFlow({
    runtimeProfile,
    headless: HEADLESS,
    shellViewOnly: SHELL_VIEW_ONLY,
    skipStartupLoading: SKIP_STARTUP_LOADING,
    strictStartupPrewarm: STRICT_STARTUP_PREWARM,
    embeddedRuntime: EMBEDDED_RUNTIME,
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
    windowRef: window
  });
  if (!SHELL_VIEW_ONLY && !runtimeProfile.runtimeOnly && !runtimeProfile.disableShaderPrewarm) {
    scheduleCpuPrewarm();
    const initialGpuScene = createGpuSceneCandidate({ forceEnabled: true });
    if (initialGpuScene) scheduleGpuWarmup(initialGpuScene);
  }
  startupStep(92, "Starting runtime");
  await new Promise((resolve) => requestAnimationFrame(() => resolve()));
  startupStep(94, "Ready");
  startupReadyAtRef(performance.now());
  if (!startupProfiling.enabled) {
    startupFrameGuardRef(false);
  }
  sessionStorageRef.setItem("led-main-booted", "1");
  finishStartupProfiling();
  notifyShellRuntimeReady();
}

function deferShellViewModuleLoad({
  windowRef,
  loadSelectedModules,
  isApplyingRemoteState,
  syncControls,
  scheduleNextDraw
}) {
  const stats = windowRef.__ledShellDeferredModuleLoad37BJ = windowRef.__ledShellDeferredModuleLoad37BJ || {
    version: "37BJ",
    scheduledAt: performance.now(),
    attempts: 0,
    loaded: false,
    skippedInactive: 0,
    lastReason: "scheduled"
  };

  const isActive = () => {
    try {
      const activity = windowRef.__ledShellViewActivity;
      return !activity || activity.active !== false;
    } catch {
      return true;
    }
  };

  const scheduleIdle = (task, timeout = 900) => {
    if (typeof windowRef.requestIdleCallback === "function") {
      windowRef.requestIdleCallback(task, { timeout });
      return;
    }
    windowRef.setTimeout(task, 120);
  };

  const run = () => {
    stats.attempts += 1;
    if (stats.loaded) return;
    if (!isActive()) {
      stats.skippedInactive += 1;
      stats.lastReason = "waiting-for-active-shell-view";
      windowRef.setTimeout(run, 350);
      return;
    }
    stats.lastReason = "idle-loading-selected-modules";
    scheduleIdle(() => {
      if (stats.loaded) return;
      if (!isActive()) {
        stats.skippedInactive += 1;
        stats.lastReason = "became-inactive-before-idle-load";
        windowRef.setTimeout(run, 350);
        return;
      }
      Promise.resolve()
        .then(() => loadSelectedModules())
        .then(() => {
          stats.loaded = true;
          stats.loadedAt = performance.now();
          stats.lastReason = "loaded";
          if (!isApplyingRemoteState()) syncControls();
          scheduleNextDraw(performance.now(), true);
        })
        .catch((error) => {
          stats.lastReason = "error";
          stats.lastError = error?.message || String(error);
          console.warn("Deferred shell module load failed", error);
        });
    });
  };

  windowRef.setTimeout(run, 120);
}
