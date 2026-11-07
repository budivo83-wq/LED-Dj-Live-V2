import { randomParam } from "../core/math.js";

export function createLayerParamRandomizer({
  state,
  paramCount,
  captureLayerModules,
  cloneLayerState,
  startLayerTransition,
  syncControls,
  commitState
}) {
  function randomizeLayerParams(layer) {
    const previousModules = captureLayerModules(layer);
    const previousState = cloneLayerState(state[layer]);

    for (let index = 0; index < paramCount; index += 1) {
      state[layer].params[index] = randomParam();
    }

    startLayerTransition(layer, previousModules, previousState);
    syncControls();
    commitState();
  }

  return {
    randomizeLayerParams
  };
}
