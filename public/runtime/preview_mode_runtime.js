export const PREVIEW_MODE_RUNTIME_VERSION = "37AA-preview-tabs-diagnostics";

const VALID_PREVIEW_MODES = ["stage", "pixel", "shader", "dual", "debug"];
const PIXEL_PREVIEW_CYCLE = ["big", "small"];
const SHADER_PREVIEW_CYCLE = ["big", "small", "led"];
const STAGE_PREVIEW_CYCLE = ["pure", "pixel", "shader"];
const DEBUG_BASE_MODES = ["stage", "pixel-big", "pixel-small", "shader-big", "shader-small", "shader-led", "shader"];

export function createPreviewModeRuntime({ state, controls, documentRef = document } = {}) {
  if (!state) throw new Error("createPreviewModeRuntime requires state");

  let debugOverlayBaseMode = "pixel-big";

  function getPreviewMode() {
    const mode = String(state.previewMode || "pixel").toLowerCase();
    return VALID_PREVIEW_MODES.includes(mode) ? mode : "pixel";
  }

  function getPixelPreviewMode() {
    const mode = String(state.pixelPreviewMode || "big").toLowerCase();
    return PIXEL_PREVIEW_CYCLE.includes(mode) ? mode : "big";
  }

  function getShaderPreviewMode() {
    const mode = String(state.shaderPreviewMode || "big").toLowerCase();
    return SHADER_PREVIEW_CYCLE.includes(mode) ? mode : "big";
  }

  function getStagePreviewVariant() {
    const variant = String(state.stagePreviewVariant || "pure").toLowerCase();
    return STAGE_PREVIEW_CYCLE.includes(variant) ? variant : "pure";
  }

  function previewModeDatasetValue() {
    const mode = getPreviewMode();
    if (mode === "debug") return "debug";
    if (mode === "dual") return "dual-small";
    if (mode === "shader") return "shader";
    if (mode !== "pixel") return mode;
    return `pixel-${getPixelPreviewMode()}`;
  }

  function getDebugOverlayBaseMode() {
    const value = String(debugOverlayBaseMode || "pixel-big").toLowerCase();
    return DEBUG_BASE_MODES.includes(value) ? value : "pixel-big";
  }

  function effectiveRenderPreviewMode() {
    const mode = getPreviewMode();
    if (mode !== "debug") return previewModeDatasetValue();
    const base = getDebugOverlayBaseMode();
    if (base === "pixel-small") return "pixel-big";
    if (base === "shader-small") return "shader";
    if (base === "shader-big") return "shader";
    return base;
  }

  function setPreviewMode(mode) {
    const next = String(mode || "pixel").toLowerCase();
    if (next === "debug") {
      const currentDataset = previewModeDatasetValue();
      const currentMode = getPreviewMode();
      const shaderDataset = currentMode === "shader" ? `shader-${getShaderPreviewMode()}` : currentDataset;
      debugOverlayBaseMode = DEBUG_BASE_MODES.includes(shaderDataset) ? shaderDataset : "pixel-big";
      state.previewMode = "debug";
      return;
    }
    state.previewMode = VALID_PREVIEW_MODES.includes(next) ? next : "pixel";
    if (state.previewMode !== "debug") {
      const dataset = previewModeDatasetValue();
      debugOverlayBaseMode = DEBUG_BASE_MODES.includes(dataset) ? dataset : debugOverlayBaseMode;
    }
  }

  function cyclePixelPreviewMode() {
    const current = getPixelPreviewMode();
    const index = PIXEL_PREVIEW_CYCLE.indexOf(current);
    state.pixelPreviewMode = PIXEL_PREVIEW_CYCLE[(index + 1) % PIXEL_PREVIEW_CYCLE.length];
    state.previewMode = "pixel";
  }

  function cycleShaderPreviewMode() {
    const current = getShaderPreviewMode();
    const index = SHADER_PREVIEW_CYCLE.indexOf(current);
    state.shaderPreviewMode = SHADER_PREVIEW_CYCLE[(index + 1) % SHADER_PREVIEW_CYCLE.length];
    state.previewMode = "shader";
  }

  function syncPreviewModeControls() {
    const mode = getPreviewMode();
    const pixelMode = getPixelPreviewMode();
    const datasetValue = previewModeDatasetValue();
    const debugBaseMode = mode === "debug" ? getDebugOverlayBaseMode() : "";
    const shaderMode = getShaderPreviewMode();
    const stageVariant = getStagePreviewVariant();
    const pixelLabel = pixelMode.toUpperCase();
    const shaderLabel = shaderMode.toUpperCase();
    if (documentRef?.body?.dataset) {
      documentRef.body.dataset.previewMode = datasetValue;
      documentRef.body.dataset.debugBaseMode = debugBaseMode;
      documentRef.body.dataset.shaderPreviewSize = shaderMode;
      documentRef.body.dataset.pixelPreviewSize = pixelMode;
      documentRef.body.dataset.stagePreviewVariant = stageVariant;
    }
    const status = documentRef?.getElementById?.("previewModeStatus");
    if (status) {
      const effective = mode === "debug"
        ? `DEBUG over ${debugBaseMode || "preview"}`
        : mode === "stage" ? `STAGE / ${stageVariant}` : datasetValue;
      status.textContent = `PREVIEW: ${String(effective).replace(/-/g, " ").toUpperCase()}`;
      status.dataset.previewModeStatus = datasetValue;
      status.dataset.debugBaseMode = debugBaseMode || "";
    }
    documentRef?.body?.classList?.toggle("shader-preview-small", shaderMode === "small");
    documentRef?.body?.classList?.toggle("shader-preview-big", shaderMode === "big");
    documentRef?.body?.classList?.toggle("pixel-preview-small", pixelMode === "small");
    documentRef?.body?.classList?.toggle("pixel-preview-big", pixelMode === "big");
    const tabs = Array.isArray(controls?.previewTabs) ? controls.previewTabs : [];
    tabs.forEach((entry) => {
      if (!entry) return;
      if (entry.id === "previewTabPixel") {
        const active = mode === "pixel";
        entry.classList?.toggle("active", active);
        entry.setAttribute?.("aria-pressed", active ? "true" : "false");
        entry.dataset.previewSize = pixelMode;
        entry.textContent = `PIXEL ${pixelLabel}`;
        entry.title = active ? `Pixel preview: ${pixelLabel}. Click toggles BIG/SMALL.` : "Switch to pixel preview.";
        return;
      }
      if (entry.id === "previewTabStage") {
        const active = mode === "stage";
        entry.classList?.toggle("active", active);
        entry.setAttribute?.("aria-pressed", active ? "true" : "false");
        entry.textContent = active ? `STAGE ${STAGE_PREVIEW_CYCLE.indexOf(stageVariant) + 1}/3` : "STAGE";
        entry.title = active ? `Stage variant ${STAGE_PREVIEW_CYCLE.indexOf(stageVariant) + 1}/3: ${stageVariant}. Click to cycle.` : "Stage preview: physical 2D layout.";
      }
      if (entry.id === "previewTabShader") {
        const active = mode === "shader";
        entry.classList?.toggle("active", active);
        entry.setAttribute?.("aria-pressed", active ? "true" : "false");
        entry.dataset.previewSize = shaderMode;
        entry.textContent = `SHADER ${shaderLabel}`;
        entry.title = active ? `Shader preview: ${shaderLabel}. Click toggles BIG/SMALL/LED FRAME.` : "Switch to shader preview.";
        return;
      }
      if (entry.id === "previewTabDual") {
        const active = mode === "dual";
        entry.classList?.toggle("active", active);
        entry.setAttribute?.("aria-pressed", active ? "true" : "false");
        entry.textContent = "DUAL SMALL";
        entry.title = "Zobrazit současně Shader Small a Pixel Small.";
        return;
      }
      if (entry.id === "previewTabDebug") {
        const active = mode === "debug";
        entry.classList?.toggle("active", active);
        entry.setAttribute?.("aria-pressed", active ? "true" : "false");
        entry.title = active ? "Close debug overlay and return to previous preview." : "Open live debug overlay.";
      }
    });
  }

  return {
    getPreviewMode,
    getPixelPreviewMode,
    getShaderPreviewMode,
    getStagePreviewVariant,
    previewModeDatasetValue,
    getDebugOverlayBaseMode,
    effectiveRenderPreviewMode,
    setPreviewMode,
    cyclePixelPreviewMode,
    cycleShaderPreviewMode,
    syncPreviewModeControls
  };
}
