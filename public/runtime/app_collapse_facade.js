import {
  initShaderInspectorToggleRuntime,
  initPreviewCollapseToggleRuntime,
  initFxPanelTogglesRuntime,
  initManualPaletteTogglesRuntime,
  initPerfPadsToggleRuntime
} from "./collapse_toggles.js";
import {
  applyPreviewCollapsedRuntime,
  applyShaderInspectorCollapsedRuntime
} from "./app_panel_helpers.js";

export function createAppCollapseFacade({
  controls,
  layerButtons,
  manualPaletteCollapsed,
  storageKeys,
  state
} = {}) {
  return {
    applyShaderInspectorCollapsed() {
      applyShaderInspectorCollapsedRuntime({ controls, collapsed: state?.getShaderInspectorCollapsed?.() });
    },
    initShaderInspectorToggle() {
      initShaderInspectorToggleRuntime({
        controls,
        storageKey: storageKeys?.shaderInspectorCollapsed,
        getCollapsed: () => state?.getShaderInspectorCollapsed?.() === true,
        setCollapsed: (value) => state?.setShaderInspectorCollapsed?.(value === true)
      });
    },
    initFxPanelToggles() {
      initFxPanelTogglesRuntime({
        controls,
        storageKey: storageKeys?.fxPanelCollapsed
      });
    },
    initManualPaletteToggles() {
      initManualPaletteTogglesRuntime({
        layerButtons,
        manualPaletteCollapsed,
        storageKey: storageKeys?.manualPaletteCollapsed
      });
    },
    applyPreviewCollapsed() {
      applyPreviewCollapsedRuntime({ controls, collapsed: state?.getPreviewCollapsed?.() });
    },
    initPreviewCollapseToggle() {
      initPreviewCollapseToggleRuntime({
        controls,
        storageKey: storageKeys?.previewCollapsed,
        getCollapsed: () => state?.getPreviewCollapsed?.() === true,
        setCollapsed: (value) => state?.setPreviewCollapsed?.(value === true)
      });
    },
    initPerfPadsToggle() {
      initPerfPadsToggleRuntime({
        controls,
        storageKey: storageKeys?.perfPadsCollapsed
      });
    }
  };
}
