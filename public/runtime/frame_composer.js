import { applySingleFxRuntime, blendWithModeRuntime } from "../fx_controls.js";

export const FRAME_COMPOSER_VERSION = "3B-extracted";

export function createFrameComposer(deps) {
  const {
    clamp01,
    easeInOut,
    getBeatPosition,
    getLayerVisibility,
    getLayerColor,
    getLayerState,
    getLayerRuntime,
    getTransitions,
    getTransitionProgress,
    getState
  } = deps;

  // A blend transition is constant for every pixel in one composed frame.
  // Cache its progress once per frame; the old path called performance.now(),
  // fetched state and evaluated easing for every pixel during a fade.
  let frameBlend = { initialized: false, state: null, transition: null, mode: null, progress: 1 };

  function beginFrame() {
    const state = getState();
    const transition = getTransitions()?.blend || null;
    const progress = transition ? getTransitionProgress(transition) : 1;
    frameBlend = {
      initialized: true,
      state,
      transition,
      mode: state?.blendMode,
      progress
    };
  }

  function applyOutputCorrection(color) {
    const layerRuntime = getLayerRuntime();
    return layerRuntime ? layerRuntime.applyOutputCorrection(color) : color;
  }

  function renderPixelColor(layerKey, x, y, mix) {
    const layerState = getLayerState(layerKey);
    const visibility = getLayerVisibility(layerState);
    const gain = visibility * mix * layerState.master;
    if (gain <= 0) return [0, 0, 0];
    const base = getLayerColor(layerKey, x, y);
    if (gain === 1) return base;
    return [base[0] * gain, base[1] * gain, base[2] * gain];
  }

  function applySingleFx(color, fx, x, y, phaseOffset) {
    return applySingleFxRuntime({ clamp01, getBeatPosition }, color, fx, x, y, phaseOffset);
  }

  function blend(a, b) {
    const state = getState();
    const transitions = getTransitions();
    const transition = transitions?.blend || null;
    if (!frameBlend.initialized || frameBlend.state !== state || frameBlend.transition !== transition || frameBlend.mode !== state?.blendMode) beginFrame();
    const cachedProgress = frameBlend.progress;
    if (!transition) return blendWithMode(a, b, state.blendMode);

    const progress = cachedProgress;
    if (progress >= 1) return blendWithMode(a, b, state.blendMode);

    const previous = blendWithMode(a, b, transition.mode);
    const current = blendWithMode(a, b, state.blendMode);
    const amount = easeInOut(progress);
    const keep = 1 - amount;
    return [
      previous[0] * keep + current[0] * amount,
      previous[1] * keep + current[1] * amount,
      previous[2] * keep + current[2] * amount
    ];
  }

  function blendWithMode(a, b, mode) {
    return blendWithModeRuntime({ clamp01, getBeatPosition, state: getState() }, a, b, mode);
  }

  return {
    applyOutputCorrection,
    renderPixelColor,
    applySingleFx,
    beginFrame,
    blend,
    blendWithMode
  };
}
