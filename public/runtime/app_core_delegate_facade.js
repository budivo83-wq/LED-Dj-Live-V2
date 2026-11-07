export function createAppCoreDelegateFacade(deps = {}) {
  const call = (getter, method, args = []) => getter?.()?.[method]?.(...args);
  const result = (getter, method, args = [], fallback = undefined) => {
    const value = getter?.()?.[method]?.(...args);
    return value === undefined ? fallback : value;
  };

  return {
    restoreLocalState: () => result(deps.getStateBridge, "restoreLocalState", [], false) === true,
    restoreSettings: () => call(deps.getStateBridge, "restoreSettings"),
    outputModeValue: (value) => result(deps.getStateBridge, "outputModeValue", [value], "preview"),
    restoreTransitionSettings: () => call(deps.getStateBridge, "restoreTransitionSettings"),
    restoreMapping: () => call(deps.getStateBridge, "restoreMapping"),
    restoreSerialSettings: () => call(deps.getStateBridge, "restoreSerialSettings"),
    previewDimensions: (mapping) => result(deps.getStateBridge, "previewDimensions", [mapping], { width: 30, height: 10 }),
    saveSettings: () => call(deps.getStateBridge, "saveSettings"),
    saveTransitionSettings: () => call(deps.getStateBridge, "saveTransitionSettings"),
    saveLocalState: () => call(deps.getStateBridge, "saveLocalState"),
    applyState: (nextState) => call(deps.getStateBridge, "applyState", [nextState]),
    applyFxState: (target, source) => call(deps.getStateBridge, "applyFxState", [target, source]),
    applyLayerState: (target, source) => call(deps.getStateBridge, "applyLayerState", [target, source]),
    applyManualPaletteState: (target, source) => call(deps.getStateBridge, "applyManualPaletteState", [target, source]),

    adjustBpm: (delta) => call(deps.getBpmEngine, "adjustBpm", [delta]),
    tapBpm: () => call(deps.getBpmEngine, "tapBpm"),
    resetBeat: () => call(deps.getBpmEngine, "resetBeat"),
    syncBeatToNearestDownbeat: (groupBeats = 4) => result(deps.getBpmEngine, "syncBeatToNearestDownbeat", [groupBeats], 0),
    ensureBeatClock: () => call(deps.getBpmEngine, "ensureBeatClock"),
    getBeatPosition: () => result(deps.getBpmEngine, "getBeatPosition", [], 0),
    seekBeatPosition: (targetBeat = 0) => result(deps.getBpmEngine, "seekBeatPosition", [targetBeat], 0),

    stepBlend: (direction) => call(deps.getLayerSwitching, "stepBlend", [direction]),
    startLayerTransition: (layer, previousModules, previousState) => call(deps.getLayerSwitching, "startLayerTransition", [layer, previousModules, previousState]),
    startBlendTransition: (previousMode) => call(deps.getLayerSwitching, "startBlendTransition", [previousMode]),
    captureLayerModules: (layer) => result(deps.getLayerSwitching, "captureLayerModules", [layer], { anim: null, palette: null }),

    notifyShellRuntimeLoading: (percent, label) => call(deps.getShellRuntimeNotifications, "notifyLoading", [percent, label]),
    notifyShellRuntimeReady: () => call(deps.getShellRuntimeNotifications, "notifyReady")
  };
}
