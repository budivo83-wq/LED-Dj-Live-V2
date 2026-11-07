import { createUiPickerBridge } from "./ui_picker_bridge.js";
import { createAppPickerFacade } from "./app_picker_facade.js";

export function createPickerRuntimeState() {
  return {
    animPicker: null,
    ignoreAnimPickerBackdropUntil: 0,
    palettePicker: null,
    ignorePalettePickerBackdropUntil: 0,
    thumbRenderQueue: [],
    thumbCache: new Map(),
    thumbRenderScheduled: false,
    thumbRenderSession: 0,
    rawPreviewLastAt: { l1: 0, l2: 0 },
    rawPreviewSignature: { l1: "", l2: "" }
  };
}

export function createPickerRuntime(state, { thumbCacheKeyForTask, getUiPickers }) {
  const uiPickerBridge = createUiPickerBridge({
    getUiPickers,
    thumbCacheKeyForTask
  });
  const facade = createAppPickerFacade(uiPickerBridge);
  return {
    uiPickerBridge,
    facade
  };
}
