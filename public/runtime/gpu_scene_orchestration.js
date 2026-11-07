export function createGpuSceneCandidateRuntime(deps, options = {}) {
  const {
    forceCpuRender,
    state,
    previewRenderer,
    modules,
    transitions,
    transitionProgress,
    easeInOut,
    normalizedParams,
    layerTime,
    getLayerVisibility,
    normalizeManualPalette,
    normalizeManualPaletteActive,
    activeManualPaletteColors,
    hexToRgb,
    clamp01,
    clampInt,
    width,
    height,
    time,
    beat,
    settings
  } = deps;

  if (forceCpuRender) return null;
  if (!state.enabled && !options.forceEnabled) return { enabled: false };
  if (!previewRenderer.drawShaderScene) return null;
  if (!modules.l1.anim?.gpu || !modules.l2.anim?.gpu) return null;

  const l1Transition = gpuLayerTransitionScene("l1", {
    transitions,
    transitionProgress,
    easeInOut,
    normalizedParams,
    layerTime,
    manualPalette: (palette) => gpuManualPalettePayload(palette, {
      normalizeManualPalette,
      normalizeManualPaletteActive,
      activeManualPaletteColors,
      hexToRgb,
      clamp01,
      clampInt
    })
  });
  const l2Transition = gpuLayerTransitionScene("l2", {
    transitions,
    transitionProgress,
    easeInOut,
    normalizedParams,
    layerTime,
    manualPalette: (palette) => gpuManualPalettePayload(palette, {
      normalizeManualPalette,
      normalizeManualPaletteActive,
      activeManualPaletteColors,
      hexToRgb,
      clamp01,
      clampInt
    })
  });
  if (l1Transition === false || l2Transition === false) return null;

  const blendTransition = gpuBlendTransitionScene({ transitions, transitionProgress, easeInOut });

  const safeBrightnessLimit = Number(globalThis?.__ledRaspiSafeLiveState?.brightnessLimit || 0);
  const brightnessLimit = safeBrightnessLimit > 0
    ? Math.min(Number(settings.brightnessLimit || 1), safeBrightnessLimit)
    : settings.brightnessLimit;
  return {
    enabled: options.forceEnabled ? true : state.enabled,
    width,
    height,
    time,
    beat,
    cross: state.cross,
    master: state.master,
    gamma: settings.gamma,
    brightnessLimit,
    blendMode: state.blendMode,
    blendTransition,
    fx1: state.fx1,
    fx2: state.fx2,
    fxMaster: state.fxMaster,
    fxMaster2: state.fxMaster2,
    layers: [
      gpuLayerScene("l1", 1 - state.cross, state.l1.flash || state.fx1.flash, l1Transition, {
        state,
        modules,
        normalizedParams,
        layerTime,
        getLayerVisibility,
        manualPalette: (palette) => gpuManualPalettePayload(palette, {
          normalizeManualPalette,
          normalizeManualPaletteActive,
          activeManualPaletteColors,
          hexToRgb,
          clamp01,
          clampInt
        })
      }),
      gpuLayerScene("l2", state.cross, state.l2.flash || state.fx2.flash, l2Transition, {
        state,
        modules,
        normalizedParams,
        layerTime,
        getLayerVisibility,
        manualPalette: (palette) => gpuManualPalettePayload(palette, {
          normalizeManualPalette,
          normalizeManualPaletteActive,
          activeManualPaletteColors,
          hexToRgb,
          clamp01,
          clampInt
        })
      })
    ]
  };
}

export function canUseGpuRenderRuntime(deps) {
  const { forceCpuRender, gpuModeValue, settings } = deps;
  return !forceCpuRender && gpuModeValue(settings.gpuMode, settings.gpuEnabled ? "auto" : "cpu") !== "cpu";
}

export function shouldTryGpuAutoSwitchRuntime(deps, now) {
  const { canUseGpuRender, gpuModeValue, settings, gpuReady, previewRenderer, gpuWarmupAttemptAt } = deps;
  if (!canUseGpuRender()) return false;
  if (gpuModeValue(settings.gpuMode, "auto") !== "auto") return false;
  if (gpuReady) return false;
  if (!previewRenderer.warmupShaderScene) return false;
  if (now - gpuWarmupAttemptAt < 500) return false;
  return true;
}

function gpuLayerScene(layerKey, crossMix, forceFullMix, transition, deps) {
  const { state, modules, normalizedParams, layerTime, getLayerVisibility, manualPalette } = deps;
  const layerState = state[layerKey];
  return {
    gpu: modules[layerKey].anim.gpu,
    params: normalizedParams(layerState.params),
    time: layerTime(layerState),
    master: layerState.master,
    visibility: getLayerVisibility(layerState),
    mix: forceFullMix ? 1 : crossMix,
    paletteFile: layerState.paletteFile,
    manualPalette: manualPalette(layerState.manualPalette),
    flip: layerState.reverse,
    mirrorX: layerState.mirrorX,
    mirrorY: layerState.mirrorY,
    transition
  };
}

function gpuLayerTransitionScene(layerKey, deps) {
  const { transitions, transitionProgress, easeInOut, normalizedParams, layerTime, manualPalette } = deps;
  const transition = transitions[layerKey];
  if (!transition) return null;

  const progress = transitionProgress(transition);
  if (progress >= 1) return null;

  if (!transition.modules?.anim?.gpu) return false;

  return {
    gpu: transition.modules.anim.gpu,
    params: normalizedParams(transition.state.params),
    time: layerTime(transition.state),
    paletteFile: transition.state.paletteFile,
    manualPalette: manualPalette(transition.state.manualPalette),
    flip: transition.state.reverse,
    mirrorX: transition.state.mirrorX,
    mirrorY: transition.state.mirrorY,
    progress: easeInOut(progress)
  };
}

function gpuManualPalettePayload(palette, deps) {
  const {
    normalizeManualPalette,
    normalizeManualPaletteActive,
    activeManualPaletteColors,
    hexToRgb,
    clamp01,
    clampInt
  } = deps;
  const colors = new Float32Array(9);
  const enabled = Boolean(palette?.enabled);
  if (!enabled) return { enabled: false, count: 0, colors };

  const normalized = normalizeManualPalette(palette);
  const active = normalizeManualPaletteActive(palette);
  const selected = clampInt(palette?.selected ?? 0, 0, 2, 0);
  const activeHex = activeManualPaletteColors({ colors: normalized, active, selected });
  const limited = activeHex.slice(0, 3);

  for (let index = 0; index < limited.length; index += 1) {
    const [r, g, b] = hexToRgb(limited[index]);
    const offset = index * 3;
    colors[offset] = clamp01(r / 255);
    colors[offset + 1] = clamp01(g / 255);
    colors[offset + 2] = clamp01(b / 255);
  }

  return {
    enabled: true,
    count: limited.length,
    colors
  };
}

function gpuBlendTransitionScene(deps) {
  const { transitions, transitionProgress, easeInOut } = deps;
  const transition = transitions.blend;
  if (!transition) return null;

  const progress = transitionProgress(transition);
  if (progress >= 1) return null;

  return {
    mode: transition.mode,
    progress: easeInOut(progress)
  };
}
