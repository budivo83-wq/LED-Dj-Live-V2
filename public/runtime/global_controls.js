export function bindGlobalControlsRuntime(deps = {}) {
  const {
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
    performanceRef = performance,
    windowRef = window
  } = deps;

  let crossRenderFrame = 0;
  let settingsSaveTimer = 0;
  function scheduleCrossRender() {
    if (!drawRenderPipeline || crossRenderFrame) return;
    if (typeof windowRef.requestAnimationFrame !== "function") {
      drawRenderPipeline(performanceRef.now());
      return;
    }
    crossRenderFrame = windowRef.requestAnimationFrame((now) => {
      crossRenderFrame = 0;
      drawRenderPipeline(now || performanceRef.now());
    });
  }

  function scheduleSettingsSave() {
    if (settingsSaveTimer) windowRef.clearTimeout(settingsSaveTimer);
    settingsSaveTimer = windowRef.setTimeout(() => {
      settingsSaveTimer = 0;
      saveSettings();
    }, 120);
  }

  controls.onoff?.addEventListener("click", () => {
    state.enabled = !state.enabled;
    syncControls();
    commitState();
  });

  controls.previewBtn?.addEventListener("click", () => {
    state.previewOpen = !state.previewOpen;
    syncControls();
    commitState();
  });

  controls.master?.addEventListener("input", (event) => {
    state.master = numberValue(event.target.value, 1);
    applyRangeVisual(event.target);
    syncMasterValue();
    commitState();
  });

  controls.gamma?.addEventListener("input", (event) => {
    settings.gamma = gammaValue(event.target.value);
    syncSettingsControls();
    scheduleSettingsSave();
  });

  controls.contrast?.addEventListener("input", (event) => {
    settings.contrast = contrastValue(event.target.value);
    syncSettingsControls();
    scheduleSettingsSave();
  });

  controls.cross?.addEventListener("input", (event) => {
    state.cross = numberValue(event.target.value, 0.5);
    applyRangeVisual(event.target);
    scheduleCrossRender();
    commitState();
  });

  controls.bpm?.addEventListener("input", (event) => {
    state.bpm = bpmValue(event.target.value);
    syncControls();
    commitState();
  });

  controls.bpmMinus?.addEventListener("click", () => adjustBpm?.(-0.5));
  controls.bpmPlus?.addEventListener("click", () => adjustBpm?.(0.5));
  controls.tapBtn?.addEventListener("click", () => tapBpm?.());
}
