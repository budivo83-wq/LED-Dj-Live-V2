/**
 * Central app control wiring for the performance runtime.
 *
 * This keeps public/app.js focused on orchestration while preserving the
 * existing binding order and callback ownership. No runtime behavior lives here
 * beyond invoking the already-existing binder modules with explicit deps.
 */
export function bindAppControlsRuntime(deps) {
  const {
    controls,
    sliders,
    fxControls,
    state,
    settings,
    transitionSettings,
    BLEND_MODES,
    randomItem,
    bindGlobalControlsRuntime,
    initCenterMenuControlsRuntime,
    bindKeyboardInput,
    bindBlendTransitionControlsRuntime,
    bindModuleSelectControl,
    bindLayerRangeControlsRuntime,
    bindFxControlBindingsRuntime,
    documentRef,
    locationRef,
    windowRef,
    fetchRef,
    syncControls,
    commitState,
    syncSettingsControls,
    saveSettings,
    syncMasterValue,
    applyRangeVisual,
    numberValue,
    gammaValue,
    contrastValue,
    bpmValue,
    gpuModeValue,
    setGpuReady,
    drawRenderPipeline,
    adjustBpm,
    tapBpm,
    performanceRef,
    toggleCenterMenuRuntime,
    handleOutsideMenuClickRuntime,
    toggleFullscreenRuntime,
    syncFullscreenButtonLabel,
    toggleCenterMenuRuntimeAction,
    handleOutsideMenuClickRuntimeAction,
    crossControl,
    bindPerformancePads,
    bindPreviewTabs,
    keyboardControls,
    transitionSecondsValue,
    startBlendTransition,
    stepBlend,
    syncTransitionControls,
    saveTransitionSettings,
    bindSelect,
    bindStepper,
    bindAnimationPicker,
    bindPalettePicker,
    bindParamSlider,
    bindMasterSlider,
    bindLayerTools,
    bindLayerButtons,
    bindManualPalette,
    bindFx,
    initFxPanelToggles,
    initPerfPadsToggle,
    initManualPaletteToggles,
    initDirectRangeControl,
    initMixCoreCollapse,
    applyTopbarMixLayout
  } = deps;

  bindGlobalControlsRuntime({
    controls,
    state,
    settings,
    syncControls,
    commitState,
    syncSettingsControls,
    saveSettings,
    syncMasterValue,
    applyRangeVisual,
    numberValue,
    gammaValue,
    contrastValue,
    bpmValue,
    gpuModeValue,
    setGpuReady,
    drawRenderPipeline,
    adjustBpm,
    tapBpm,
    performanceRef,
    windowRef
  });

  initCenterMenuControlsRuntime({
    controls,
    documentRef,
    locationRef,
    windowRef,
    fetchRef,
    toggleCenterMenuRuntime,
    handleOutsideMenuClickRuntime,
    toggleFullscreenRuntime,
    syncFullscreenButtonLabel,
    toggleCenterMenuRuntimeAction,
    handleOutsideMenuClickRuntimeAction
  });

  controls.crossMouseToggle?.addEventListener("click", () => {
    crossControl?.toggleMouseControl();
  });
  crossControl?.bindDocumentEvents();
  bindPerformancePads();
  bindPreviewTabs();
  bindKeyboardInput({
    documentRef,
    windowRef,
    onKeyDown: (event) => keyboardControls?.handleShortcut(event),
    onKeyUp: (event) => keyboardControls?.handleShortcutUp(event),
    onBlur: () => keyboardControls?.releaseHeldFxKeys()
  });

  bindBlendTransitionControlsRuntime({
    controls,
    state,
    transitionSettings,
    blendModes: BLEND_MODES,
    randomItem,
    transitionSecondsValue,
    startBlendTransition,
    stepBlend,
    syncControls,
    commitState,
    syncTransitionControls,
    saveTransitionSettings
  });

  bindSelect(controls.l1Anim, "l1", "animFile", "l1_anims", "anim");
  bindSelect(controls.l1Palette, "l1", "paletteFile", "l1_palettes", "palette");
  bindSelect(controls.l2Anim, "l2", "animFile", "l2_anims", "anim");
  bindSelect(controls.l2Palette, "l2", "paletteFile", "l2_palettes", "palette");

  bindStepper("l1_anim", "l1", "animFile", "l1Anims", "l1_anims", "anim");
  bindStepper("l1_palette", "l1", "paletteFile", "l1Palettes", "l1_palettes", "palette");
  bindStepper("l2_anim", "l2", "animFile", "l2Anims", "l2_anims", "anim");
  bindStepper("l2_palette", "l2", "paletteFile", "l2Palettes", "l2_palettes", "palette");
  bindAnimationPicker(controls.l1Anim, "l1", "l1Anims", "l1_anims");
  bindAnimationPicker(controls.l2Anim, "l2", "l2Anims", "l2_anims");
  bindPalettePicker(controls.l1Palette, "l1", "l1Palettes", "l1_palettes");
  bindPalettePicker(controls.l2Palette, "l2", "l2Palettes", "l2_palettes");

  bindLayerRangeControlsRuntime({
    sliders,
    state,
    bindParamSlider,
    bindMasterSlider
  });
  bindLayerTools("l1");
  bindLayerTools("l2");
  bindLayerButtons("l1");
  bindLayerButtons("l2");
  bindManualPalette("l1");
  bindManualPalette("l2");

  bindFxControlBindingsRuntime({
    fxControls,
    sliders,
    bindFx
  });
  initFxPanelToggles();
  initPerfPadsToggle();
  initManualPaletteToggles();
  initDirectRangeControl();
  initMixCoreCollapse();
  applyTopbarMixLayout();
}
