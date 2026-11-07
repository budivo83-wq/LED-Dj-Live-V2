export function createAppRuntimeDelegateFacade(deps = {}) {
  const call = (getter, method, args = []) => getter?.()?.[method]?.(...args);
  const result = (getter, method, args = [], fallback = undefined) => {
    const value = getter?.()?.[method]?.(...args);
    return value === undefined ? fallback : value;
  };

  return {
    startPerfProfileReporter: () => call(deps.getRuntimeRefreshLoops, "startPerfProfileReporter"),
    startUiRefreshLoops: () => call(deps.getRuntimeRefreshLoops, "startUiRefreshLoops"),
    syncOutputCards: (detail) => call(deps.getUiStateSync, "syncOutputCards", [detail]),
    syncShaderInspector: (detail = null) => call(deps.getUiStateSync, "syncShaderInspector", [detail]),

    drawLayerRawPreview: (layer) => call(deps.getLayerRuntime, "drawLayerRawPreview", [layer]),
    getLayerColor: (layerKey, x, y) => result(deps.getLayerRuntime, "getLayerColor", [layerKey, x, y], [0, 0, 0]),
    renderLayerColor: (layerKey, layerState, layerModules, x, y) => result(deps.getLayerRuntime, "renderLayerColor", [layerKey, layerState, layerModules, x, y], [0, 0, 0]),
    manualPaletteColor: (palette, value) => result(deps.getLayerRuntime, "manualPaletteColor", [palette, value], [0, 0, 0]),
    layerTime: (layerState) => result(deps.getLayerRuntime, "layerTime", [layerState], deps.getTime?.() ?? 0),
    getLayerVisibility: (layerState) => result(deps.getLayerRuntime, "getLayerVisibility", [layerState], 0),

    applyOutputCorrection: (color) => result(deps.getFrameComposer, "applyOutputCorrection", [color], color),
    renderPixelColor: (layerKey, x, y, mix) => result(deps.getFrameComposer, "renderPixelColor", [layerKey, x, y, mix], [0, 0, 0]),
    applySingleFx: (color, fx, x, y, phaseOffset) => result(deps.getFrameComposer, "applySingleFx", [color, fx, x, y, phaseOffset], color),
    blend: (a, b) => result(deps.getFrameComposer, "blend", [a, b], a),
    blendWithMode: (a, b, mode) => result(deps.getFrameComposer, "blendWithMode", [a, b, mode], a),

    getPreviewMode: () => result(deps.getPreviewModeRuntime, "getPreviewMode", [], "pixel"),
    getPixelPreviewMode: () => result(deps.getPreviewModeRuntime, "getPixelPreviewMode", [], "big"),
    previewModeDatasetValue: () => result(deps.getPreviewModeRuntime, "previewModeDatasetValue", [], "pixel-big"),
    getDebugOverlayBaseMode: () => result(deps.getPreviewModeRuntime, "getDebugOverlayBaseMode", [], "pixel-big"),
    effectiveRenderPreviewMode: (fallback) => result(deps.getPreviewModeRuntime, "effectiveRenderPreviewMode", [], fallback),
    setPreviewMode: (mode) => call(deps.getPreviewModeRuntime, "setPreviewMode", [mode]),
    cyclePixelPreviewMode: () => call(deps.getPreviewModeRuntime, "cyclePixelPreviewMode"),
    cycleShaderPreviewMode: () => call(deps.getPreviewModeRuntime, "cycleShaderPreviewMode"),
    syncPreviewModeControls: () => call(deps.getPreviewModeRuntime, "syncPreviewModeControls"),

    syncRenderModeControls: (gpuReady) => call(deps.getUiStateSync, "syncRenderModeControls", [gpuReady]),
    syncLayerButtons: (layer) => call(deps.getUiStateSync, "syncLayerButtons", [layer]),
    syncManualPalette: (layer) => call(deps.getUiStateSync, "syncManualPalette", [layer]),
    syncPaletteSelectPreview: (select, paletteModule, file) => call(deps.getUiStateSync, "syncPaletteSelectPreview", [select, paletteModule, file]),
    syncLayerTools: (layer) => call(deps.getUiStateSync, "syncLayerTools", [layer]),
    updateParamLabels: (layer) => call(deps.getUiStateSync, "updateParamLabels", [layer]),
    renderBlendOptions: () => call(deps.getUiStateSync, "renderBlendOptions"),

    applyCrossfaderPlacement: () => call(deps.getTopbarMixLayout, "applyCrossfaderPlacement"),
    initMixCoreCollapse: () => call(deps.getTopbarMixLayout, "initMixCoreCollapse"),
    applyTopbarMixLayout: () => call(deps.getTopbarMixLayout, "applyTopbarMixLayout")
  };
}
