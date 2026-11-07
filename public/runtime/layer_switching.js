export function createLayerSwitching(deps) {
  const {
    state,
    modules,
    transitions,
    transitionSettings,
    blendModes,
    syncControls,
    commitState,
    now
  } = deps;

  function startLayerTransition(layer, previousModules, previousState) {
    if (!transitionSettings.enabled || transitionSettings.seconds <= 0) {
      transitions[layer] = null;
      return;
    }

    transitions[layer] = {
      startedAt: now(),
      duration: transitionSettings.seconds * 1000,
      modules: previousModules,
      state: previousState
    };
  }

  function startBlendTransition(previousMode) {
    if (previousMode === state.blendMode || !blendModes.includes(previousMode)) return;

    if (!transitionSettings.enabled || transitionSettings.seconds <= 0) {
      transitions.blend = null;
      return;
    }

    transitions.blend = {
      startedAt: now(),
      duration: transitionSettings.seconds * 1000,
      mode: previousMode
    };
  }

  function stepBlend(direction) {
    const current = Math.max(0, blendModes.indexOf(state.blendMode));
    const previous = state.blendMode;
    state.blendMode = blendModes[(current + direction + blendModes.length) % blendModes.length];
    startBlendTransition(previous);
    syncControls();
    commitState();
  }

  function captureLayerModules(layer) {
    return {
      anim: modules[layer].anim,
      palette: modules[layer].palette
    };
  }

  return {
    stepBlend,
    startLayerTransition,
    startBlendTransition,
    captureLayerModules
  };
}
