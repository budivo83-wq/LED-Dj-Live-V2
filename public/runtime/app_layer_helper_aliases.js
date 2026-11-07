import { createUiLayerHelpers } from "../ui_layers.js";

export function createAppLayerHelperAliases({
  getWidth,
  getHeight,
  getTime,
  getParamCount,
  clamp01,
  clamp,
  contrast01,
  now
}) {
  const uiLayerHelpers = createUiLayerHelpers({
    getWidth,
    getHeight,
    getTime,
    getParamCount,
    clamp01,
    clamp,
    contrast01,
    now
  });

  return {
    fallbackColor: (...args) => uiLayerHelpers.fallbackColor(...args),
    layerCoords: (...args) => uiLayerHelpers.layerCoords(...args),
    normalizedParams: (...args) => uiLayerHelpers.normalizedParams(...args),
    normalizeValue: (...args) => uiLayerHelpers.normalizeValue(...args),
    cloneLayerState: (...args) => uiLayerHelpers.cloneLayerState(...args),
    normalizeHexColor: (...args) => uiLayerHelpers.normalizeHexColor(...args),
    normalizeManualPalette: (...args) => uiLayerHelpers.normalizeManualPalette(...args),
    normalizeManualPaletteActive: (...args) => uiLayerHelpers.normalizeManualPaletteActive(...args),
    activeManualPaletteColors: (...args) => uiLayerHelpers.activeManualPaletteColors(...args),
    hexToRgb: (...args) => uiLayerHelpers.hexToRgb(...args),
    hsvToRgb: (...args) => uiLayerHelpers.hsvToRgb(...args),
    rgbToHex: (...args) => uiLayerHelpers.rgbToHex(...args),
    colorFromWheelEvent: (...args) => uiLayerHelpers.colorFromWheelEvent(...args),
    drawManualPaletteWheel: (...args) => uiLayerHelpers.drawManualPaletteWheel(...args),
    transitionProgress: (...args) => uiLayerHelpers.transitionProgress(...args),
    pickFile: (...args) => uiLayerHelpers.pickFile(...args)
  };
}
