export function createUiPickerBridge({ getUiPickers, thumbCacheKeyForTask }) {
  function pickers() {
    return getUiPickers?.() || null;
  }

  return {
    bindAnimationPicker(select, layer, listKey, folder) {
      pickers()?.bindAnimationPicker(select, layer, listKey, folder);
    },
    async openAnimationPicker(layer, listKey, folder) {
      await pickers()?.openAnimationPicker(layer, listKey, folder);
    },
    ensureAnimationPicker() {
      return pickers()?.ensureAnimationPicker();
    },
    closeAnimationPicker() {
      pickers()?.closeAnimationPicker();
    },
    async selectAnimationFile(layer, file, folder) {
      await pickers()?.selectAnimationFile(layer, file, folder);
    },
    async renderAnimationThumb(canvas, layer, file, folder) {
      await pickers()?.renderAnimationThumb(canvas, layer, file, folder);
    },
    bindPalettePicker(select, layer, listKey, folder) {
      pickers()?.bindPalettePicker(select, layer, listKey, folder);
    },
    async openPalettePicker(layer, listKey, folder) {
      await pickers()?.openPalettePicker(layer, listKey, folder);
    },
    ensurePalettePicker() {
      return pickers()?.ensurePalettePicker();
    },
    closePalettePicker() {
      pickers()?.closePalettePicker();
    },
    async selectPaletteFile(layer, file, folder) {
      await pickers()?.selectPaletteFile(layer, file, folder);
    },
    async renderPaletteThumb(canvas, file, folder) {
      await pickers()?.renderPaletteThumb(canvas, file, folder);
    },
    queueThumbRender(task) {
      pickers()?.queueThumbRender(task);
    },
    processThumbRenderQueue(deadline) {
      pickers()?.processThumbRenderQueue(deadline);
    },
    thumbCacheKey(task) {
      return thumbCacheKeyForTask(task);
    },
    drawThumbFromCache(canvas, imageData) {
      pickers()?.drawThumbFromCache(canvas, imageData);
    }
  };
}
