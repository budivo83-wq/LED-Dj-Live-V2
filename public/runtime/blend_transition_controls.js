export function bindBlendTransitionControlsRuntime(deps = {}) {
  const {
    controls,
    state,
    transitionSettings,
    blendModes = [],
    randomItem,
    transitionSecondsValue,
    startBlendTransition,
    stepBlend,
    syncControls,
    commitState,
    syncTransitionControls,
    saveTransitionSettings,
    requestFreshPreviewFrame
  } = deps;

  const invalidatePreview = () => requestFreshPreviewFrame?.();

  controls.blend?.addEventListener("change", (event) => {
    const previous = state.blendMode;
    state.blendMode = event.target.value;
    startBlendTransition?.(previous);
    commitState?.();
    invalidatePreview();
  });

  controls.blendPrev?.addEventListener("click", () => { stepBlend?.(-1); invalidatePreview(); });
  controls.blendNext?.addEventListener("click", () => { stepBlend?.(1); invalidatePreview(); });
  controls.blendRandom?.addEventListener("click", () => {
    const previous = state.blendMode;
    state.blendMode = randomItem?.(blendModes) ?? state.blendMode;
    startBlendTransition?.(previous);
    syncControls?.();
    commitState?.();
    invalidatePreview();
  });

  controls.transitionToggle?.addEventListener("click", () => {
    transitionSettings.enabled = !transitionSettings.enabled;
    syncTransitionControls?.();
    saveTransitionSettings?.();
  });

  controls.transitionSeconds?.addEventListener("input", (event) => {
    transitionSettings.seconds = transitionSecondsValue(event.target.value);
    syncTransitionControls?.();
    saveTransitionSettings?.();
  });
}
