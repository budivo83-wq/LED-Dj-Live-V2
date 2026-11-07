export function createCoreRuntimeAssembly({
  createLayerRuntime,
  createFrameComposer,
  createPreviewModeRuntime,
  createLayerSwitching,
  createModuleWarmup,
  createAppBackgroundModuleWarmup,
  createShaderPreloadManager,
  state,
  settings,
  modules,
  transitions,
  layerButtons,
  pickerRuntimeState,
  rawPreviewFps,
  rawPreviewScale,
  forceCpuLayerPreview,
  renderShaderLayerCanvas,
  normalizedParams,
  layerCoords,
  normalizeValue,
  activeManualPaletteColors,
  hexToRgb,
  mixColor,
  clamp,
  clamp01,
  fallbackColor,
  getBeatPosition,
  transitionProgress,
  easeInOut,
  widthRef,
  heightRef,
  timeRef,
  controls,
  documentRef,
  transitionSettings,
  blendModes,
  syncControls,
  commitState,
  now,
  cpuPrewarmDoneRef,
  setCpuPrewarmDone,
  cpuPrewarmRunningRef,
  setCpuPrewarmRunning,
  getDimensions,
  renderLayerColor,
  loadModule,
  hasModule,
  windowRef,
  runtimeProfile,
  pathsForFolder,
  lists,
  startupStep,
  startupTimingState,
  prewarmAllGpuCombos,
  warmupLayerPreviewShaders,
  getGpuShaderStats,
  getLayerVisibility,
  getLayerColor,
  getLayerState
}) {
  const layerRuntime = createLayerRuntime({
    state,
    settings,
    modules,
    transitions,
    layerButtons,
    animPicker: () => pickerRuntimeState.animPicker,
    palettePicker: () => pickerRuntimeState.palettePicker,
    rawPreviewLastAt: pickerRuntimeState.rawPreviewLastAt,
    rawPreviewSignature: pickerRuntimeState.rawPreviewSignature,
    RAW_PREVIEW_FPS: rawPreviewFps,
    RAW_PREVIEW_SCALE: rawPreviewScale,
    FORCE_CPU_LAYER_PREVIEW: forceCpuLayerPreview,
    renderShaderLayerCanvas,
    normalizedParams,
    layerCoords,
    normalizeValue,
    activeManualPaletteColors,
    hexToRgb,
    mixColor,
    clamp,
    clamp01,
    fallbackColor,
    getBeatPosition: () => getBeatPosition(),
    transitionProgress,
    easeInOut,
    WRef: widthRef,
    HRef: heightRef,
    tRef: timeRef
  });

  const frameComposer = createFrameComposer({
    clamp01,
    easeInOut,
    mixColor,
    getBeatPosition,
    getLayerVisibility,
    getLayerColor,
    getLayerState,
    getLayerRuntime: () => layerRuntime,
    getTransitions: () => transitions,
    getTransitionProgress: () => transitionProgress,
    getState: () => state
  });

  const previewModeRuntime = createPreviewModeRuntime({
    state,
    controls,
    documentRef
  });

  const layerSwitching = createLayerSwitching({
    state,
    modules,
    transitions,
    transitionSettings,
    blendModes,
    syncControls,
    commitState,
    now
  });

  const moduleWarmup = createModuleWarmup({
    getCpuPrewarmDone: cpuPrewarmDoneRef,
    setCpuPrewarmDone,
    getCpuPrewarmRunning: cpuPrewarmRunningRef,
    setCpuPrewarmRunning,
    getDimensions,
    state,
    modules,
    renderLayerColor,
    loadModule,
    hasModule,
    windowRef,
    runtimeProfile
  });

  const backgroundModuleWarmup = createAppBackgroundModuleWarmup({
    pathsForFolder,
    lists,
    moduleWarmupRef: () => moduleWarmup
  });

  const shaderPreloadManager = createShaderPreloadManager({
    pathsForFolder,
    listsRef: () => lists,
    loadModule,
    startupStep,
    startupTimingState,
    prewarmAllGpuCombos,
    warmupLayerPreviewShaders,
    getGpuShaderStats
  });

  return {
    layerRuntime,
    frameComposer,
    previewModeRuntime,
    layerSwitching,
    moduleWarmup,
    backgroundModuleWarmup,
    shaderPreloadManager
  };
}
