export function createAppPickerFacade(uiPickerBridge) {
  return {
    bindAnimationPicker: (...args) => uiPickerBridge.bindAnimationPicker(...args),
    openAnimationPicker: (...args) => uiPickerBridge.openAnimationPicker(...args),
    ensureAnimationPicker: (...args) => uiPickerBridge.ensureAnimationPicker(...args),
    closeAnimationPicker: (...args) => uiPickerBridge.closeAnimationPicker(...args),
    selectAnimationFile: (...args) => uiPickerBridge.selectAnimationFile(...args),
    renderAnimationThumb: (...args) => uiPickerBridge.renderAnimationThumb(...args),
    bindPalettePicker: (...args) => uiPickerBridge.bindPalettePicker(...args),
    openPalettePicker: (...args) => uiPickerBridge.openPalettePicker(...args),
    ensurePalettePicker: (...args) => uiPickerBridge.ensurePalettePicker(...args),
    closePalettePicker: (...args) => uiPickerBridge.closePalettePicker(...args),
    selectPaletteFile: (...args) => uiPickerBridge.selectPaletteFile(...args),
    renderPaletteThumb: (...args) => uiPickerBridge.renderPaletteThumb(...args),
    queueThumbRender: (...args) => uiPickerBridge.queueThumbRender(...args),
    processThumbRenderQueue: (...args) => uiPickerBridge.processThumbRenderQueue(...args),
    thumbCacheKey: (...args) => uiPickerBridge.thumbCacheKey(...args),
    drawThumbFromCache: (...args) => uiPickerBridge.drawThumbFromCache(...args)
  };
}
