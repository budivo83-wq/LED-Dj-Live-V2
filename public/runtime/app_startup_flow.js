import { freezeUniqueList } from "./list_utils.js";

export function createAppStartupFlow({
  startupProfiling,
  startupOverlay,
  updateStartupOverlay,
  notifyShellRuntimeLoading,
  startupStepRuntime,
  shaderPreloadManagerRef,
  loadHeadlessShaderModulesRef,
  prewarmAllGpuCombos,
  pathsForFolder,
  lists,
  loadModule,
  preloadThumbnailCacheRuntime,
  STARTUP_ANIM_THUMB_SIZE,
  thumbCacheKey,
  thumbCache,
  getUiPickers,
  runtimeProfile,
  startupTimingState,
  renderAnimationThumb,
  renderPaletteThumb,
  finishStartupProfilingRuntime
}) {
  function updateStartupSlowestSteps() {
    if (!startupTimingState || !startupProfiling?.enabled) return;
    const marks = Array.isArray(startupProfiling.marks) ? startupProfiling.marks : [];
    if (marks.length < 2) return;
    const deltas = marks.map((mark, index) => {
      const atMs = Number(mark?.atMs || 0);
      const prevAt = index > 0 ? Number(marks[index - 1]?.atMs || 0) : 0;
      return {
        label: String(mark?.label || ""),
        deltaMs: Math.max(0, atMs - prevAt)
      };
    });
    const top = deltas
      .sort((a, b) => b.deltaMs - a.deltaMs)
      .slice(0, 3)
      .filter((entry) => entry.deltaMs > 0 && entry.label);
    startupTimingState.slowestSteps = top;
    startupTimingState.slowestSummary = top.map((entry) => `${entry.label}:${Math.round(entry.deltaMs)}ms`).join(" | ");
  }

  function startupStep(percent, label) {
    notifyShellRuntimeLoading(percent, label);
    startupStepRuntime(startupProfiling, startupOverlay, updateStartupOverlay, percent, label);
    updateStartupSlowestSteps();
  }

  async function preloadEverythingForStartup() {
    await shaderPreloadManagerRef()?.startupPreloadAll?.();
  }

  async function preloadHeadlessWebglStartup() {
    startupStep(82, "Loading shader modules");
    await loadHeadlessShaderModulesRef();
    startupStep(88, "Compiling WebGL banks");
    await prewarmAllGpuCombos((done, total) => {
      const ratio = total ? done / total : 1;
      startupStep(88 + ratio * 4, `Compiling WebGL banks ${done}/${total}`);
    }, { chunkSize: 4, yieldMs: 0 });
  }

  async function loadHeadlessShaderModules() {
    const paths = [
      ...pathsForFolder("l1_anims", lists.l1Anims),
      ...pathsForFolder("l2_anims", lists.l2Anims)
    ];
    for (let index = 0; index < paths.length; index += 1) {
      await loadModule(paths[index]);
      if (index % 8 === 7 || index === paths.length - 1) {
        const done = index + 1;
        const ratio = done / Math.max(1, paths.length);
        startupStep(82 + ratio * 4, `Loading shader modules ${done}/${paths.length}`);
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
  }

  async function preloadShellViewStartup() {
    startupStep(78, "Caching UI modules");
    const paths = freezeUniqueList([
      ...pathsForFolder("l1_anims", lists.l1Anims),
      ...pathsForFolder("l2_anims", lists.l2Anims),
      ...pathsForFolder("l1_palettes", lists.l1Palettes),
      ...pathsForFolder("l2_palettes", lists.l2Palettes)
    ]);
    for (let index = 0; index < paths.length; index += 1) {
      await loadModule(paths[index]);
      if (index % 8 === 7 || index === paths.length - 1) {
        const done = index + 1;
        const ratio = done / Math.max(1, paths.length);
        startupStep(78 + ratio * 14, `Caching UI modules ${done}/${paths.length}`);
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
  }

  async function preloadThumbnailCache() {
    await preloadThumbnailCacheRuntime({
      lists,
      STARTUP_ANIM_THUMB_SIZE,
      thumbCacheKey,
      thumbCache,
      readThumbFromSession: getUiPickers()?.readThumbFromSession,
      writeThumbToSession: getUiPickers()?.writeThumbToSession,
      runtimeProfile,
      startupTimingState,
      renderAnimationThumb,
      renderPaletteThumb,
      startupStep
    });
  }

  function finishStartupProfiling() {
    finishStartupProfilingRuntime(startupProfiling, startupOverlay);
  }

  return {
    startupStep,
    preloadEverythingForStartup,
    preloadHeadlessWebglStartup,
    loadHeadlessShaderModules,
    preloadShellViewStartup,
    preloadThumbnailCache,
    finishStartupProfiling
  };
}

export function createStartupSequenceDeps({
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
  runtimeProfile,
  startupFrameGuardRef,
  startupReadyAtRef,
  setPreferLocalStateOnBoot
} = {}) {
  return {
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
    runtimeProfile,
    startupFrameGuardRef,
    startupReadyAtRef,
    setPreferLocalStateOnBoot
  };
}
