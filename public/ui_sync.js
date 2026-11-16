import { BLEND_MODE_DESCRIPTIONS } from "./core/constants.js";

export function createUiSync(deps) {
  const {
    controls,
    state,
    settings,
    modules,
    layerButtons,
    transitionSettings,
    defaultParamLabels,
    blendGroups,
    blendModes,
    option,
    blendModeLabel,
    setSelectValue,
    clampInt,
    normalizeManualPalette,
    normalizeManualPaletteActive,
    drawManualPaletteWheel
  } = deps;

  function syncRenderModeControls(gpuReady) {
    void gpuReady;
  }

  function syncLayerTools(layer, byId) {
    byId(`${layer}_reverse`).checked = state[layer].reverse;
    byId(`${layer}_mirror_x`).checked = state[layer].mirrorX;
    byId(`${layer}_mirror_y`).checked = state[layer].mirrorY;
  }

  function updateParamLabels(layer, documentRef = document) {
    const labels = modules[layer].anim?.meta?.params || defaultParamLabels;
    for (let index = 0; index < 4; index += 1) {
      const label = documentRef.querySelector(`[data-param-label="${layer}_p${index + 1}"]`);
      if (label) label.textContent = labels[index] || defaultParamLabels[index];
    }
  }

  function syncSettingsControls() {
    if (controls.fps) controls.fps.value = settings.fps;
    if (controls.previewFps) controls.previewFps.value = settings.previewFps || 30;
    if (controls.gamma) controls.gamma.value = settings.gamma;
    if (controls.contrast) controls.contrast.value = settings.contrast;
    if (controls.gpuMode) controls.gpuMode.value = settings.gpuMode || "auto";
    document.body.classList.toggle("layer-preview-disabled", !settings.layerPreviewEnabled);
  }

  function syncTransitionControls() {
    if (!controls.transitionToggle || !controls.transitionSeconds) return;
    controls.transitionToggle.textContent = transitionSettings.enabled ? "FADE ON" : "FADE OFF";
    controls.transitionToggle.classList.toggle("active", transitionSettings.enabled);
    controls.transitionSeconds.value = transitionSettings.seconds;
  }

  function renderBlendOptions() {
    controls.blend.replaceChildren();
    for (const [group, modes] of Object.entries(blendGroups)) {
      const optgroup = document.createElement("optgroup");
      optgroup.label = `/${group}`;
      modes
        .filter((mode, index) => modes.indexOf(mode) === index && blendModes.includes(mode))
        .forEach((mode) => {
          const entry = option(mode, blendModeLabel(mode));
          const description = BLEND_MODE_DESCRIPTIONS[mode] || "Speciální kombinace obou layerů.";
          entry.title = description;
          entry.dataset.description = description;
          optgroup.appendChild(entry);
        });
      controls.blend.appendChild(optgroup);
    }
    syncBlendDescription();
  }

  function syncBlendDescription() {
    const mode = String(state.blendMode || "");
    const description = BLEND_MODE_DESCRIPTIONS[mode] || "Speciální kombinace obou layerů.";
    if (controls.blendDescription) controls.blendDescription.textContent = description;
    if (controls.blend) controls.blend.title = `${blendModeLabel(mode)} — ${description}`;
  }

  return {
    syncRenderModeControls,
    syncLayerTools,
    updateParamLabels,
    syncSettingsControls,
    syncTransitionControls,
    renderBlendOptions,
    syncBlendDescription
  };
}

