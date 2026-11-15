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
  function deferAfterPaint(callback) {
    const run = () => {
      try { callback?.(); } catch {}
    };
    try {
      if (typeof globalThis.requestAnimationFrame === "function") {
        globalThis.requestAnimationFrame(() => globalThis.setTimeout(run, 0));
        return;
      }
    } catch {}
    try { globalThis.setTimeout(run, 0); } catch { run(); }
  }

  function randomizeLayerParams(layer) {
    const previousModules = captureLayerModules(layer);
    const previousState = cloneLayerState(state[layer]);

    for (let index = 0; index < paramCount; index += 1) {
      state[layer].params[index] = randomParam();
    }

    startLayerTransition(layer, previousModules, previousState);
    // Keep the click path limited to in-memory render state. DOM sync and
    // persistence are moved behind the next paint so they cannot steal the
    // current output frame.
    deferAfterPaint(() => syncControls());
    deferAfterPaint(() => commitState());
  }

  return {
    randomizeLayerParams
  };
}
