export function createUiStateSync(deps) {
  const {
    controls,
    state,
    settings,
    modules,
    layerButtons,
    sliders,
    fxControls,
    transitionSettings,
    serialSettings,
    getSerialSettings,
    defaultParamLabels,
    uiSync,
    blendModeLabel,
    setSelectValue,
    clampInt,
    normalizeManualPalette,
    normalizeManualPaletteActive,
    drawManualPaletteWheel,
    cleanModuleName,
    byIdRef,
    documentRef,
    manualPaletteCollapsed,
    refreshRangeVisuals,
    syncFullscreenButtonLabel,
    syncPreviewModeControls,
    syncMasterValue,
    syncCrossMouseControl,
    getGpuReady,
    getLastPreviewRenderer,
    applyCrossfaderPlacement
  } = deps;

  const lastUiSyncValues = new Map();


  const dirtySyncCache = new Map();

  function stableLayerSignature(layer) {
    const layerState = state?.[layer] || {};
    const palette = layerState.manualPalette || {};
    return [
      layerState.enabled, layerState.beatSync, layerState.blackout, layerState.flash, layerState.previewOn,
      layerState.animFile, layerState.paletteFile, layerState.master,
      layerState.params?.[0], layerState.params?.[1], layerState.params?.[2], layerState.params?.[3],
      palette.enabled, palette.selected, manualPaletteCollapsed?.[layer],
      ...(Array.isArray(palette.colors) ? palette.colors.slice(0, 3) : []),
      ...(Array.isArray(palette.active) ? palette.active.slice(0, 3) : []),
      modules?.[layer]?.anim?.id || modules?.[layer]?.anim?.name || modules?.[layer]?.anim?.gpu?.functionName || "",
      modules?.[layer]?.palette?.id || modules?.[layer]?.palette?.name || ""
    ].join("|");
  }

  function stableFxSignature(name) {
    const fx = state?.[name] || {};
    return [fx.mode, fx.amount, fx.rate, fx.flash, fx.hold].join("|");
  }

  function runDirtySync(region, signature, fn) {
    const next = String(signature);
    if (dirtySyncCache.get(region) === next) return false;
    dirtySyncCache.set(region, next);
    fn();
    return true;
  }

  function setSelectValueOnce(select, value, key = select) {
    if (!select) return;
    const next = String(value ?? "");
    if (String(select.value ?? "") === next && sameUiValue(`select:${key}`, next)) return;
    setSelectValue(select, value);
    lastUiSyncValues.set(`select:${key}`, next);
  }

  function sameUiValue(key, value) {
    const normalized = typeof value === "number" ? Number(value) : value;
    if (lastUiSyncValues.get(key) === normalized) return true;
    lastUiSyncValues.set(key, normalized);
    return false;
  }

  function setTextOnce(el, text, key = el) {
    if (!el) return;
    const value = String(text);
    if (sameUiValue(`text:${key}`, value)) return;
    el.textContent = value;
  }

  function setValueOnce(el, value, key = el) {
    if (!el) return;
    const next = String(value);
    if (String(el.value) === next || sameUiValue(`value:${key}`, next)) return;
    el.value = next;
  }

  function setClassOnce(el, className, active, key = el) {
    if (!el) return;
    const next = Boolean(active);
    if (sameUiValue(`class:${key}:${className}`, next)) return;
    el.classList.toggle(className, next);
  }

  function setStyleOnce(el, prop, value, key = el) {
    if (!el) return;
    const next = String(value);
    if (sameUiValue(`style:${key}:${prop}`, next)) return;
    el.style.setProperty(prop, next);
  }

  function syncOutputCards(detail) {
    const currentSerialSettings = getSerialSettings ? getSerialSettings() : serialSettings;
    const serialFps = Math.max(0, Math.round(Number(currentSerialSettings?.fps || 0) || 0));
    const serialText = detail.serial ? `SER ${serialFps || "ON"}` : "SER OFF";
    const liveOutputLiteUi = detail.enabled === true;
    documentRef.body?.classList?.toggle("live-output-lite-ui", liveOutputLiteUi);
    if (controls.outputState) setTextOnce(controls.outputState, detail.enabled ? "ON" : "OFF", "outputState");
    if (controls.outputDetail) {
      const mode = String(detail.outputMode || "preview").toUpperCase();
      const outputText = detail.enabled ? mode : "PREVIEW";
      setTextOnce(controls.outputDetail, `${outputText} | ${serialText}`, "outputDetail");
      controls.outputDetail.title = detail.serial ? `Serial output active, ${serialFps || 0} FPS` : "Serial output off";
    }
  }

  function shaderCodeText(gpu) {
    const raw = String(gpu?.code || "").trim();
    if (!raw) return "No GPU shader code";
    return raw;
  }

  function syncShaderInspector(detail = null) {
    if (!controls.shaderInspector) return;
    const l1Gpu = modules?.l1?.anim?.gpu || null;
    const l2Gpu = modules?.l2?.anim?.gpu || null;
    const renderer = detail?.renderer || getLastPreviewRenderer() || "--";
    const mode = String(settings.gpuMode || "auto").toUpperCase();
    const compileMs = Number(detail?.shaderLastCompileMs || 0).toFixed(1);
    const lazyQueued = Number(detail?.shaderLazyQueued || 0);
    const drops = Number(detail?.outputDropped || 0);
    const info = `Renderer ${renderer} | GPU ${getGpuReady() ? "READY" : "WARMUP"} | Mode ${mode} | Compile ${compileMs}ms | LazyQ ${lazyQueued} | Drop ${drops} | Blend ${state.blendMode}`;

    if (controls.shaderDebugInfo) setTextOnce(controls.shaderDebugInfo, info, "shaderDebugInfo");
    if (controls.shaderL1Name) setTextOnce(controls.shaderL1Name, l1Gpu?.functionName || state.l1.animFile || "--", "shaderL1Name");
    if (controls.shaderL1Code) setTextOnce(controls.shaderL1Code, shaderCodeText(l1Gpu), "shaderL1Code");
    if (controls.shaderL2Name) setTextOnce(controls.shaderL2Name, l2Gpu?.functionName || state.l2.animFile || "--", "shaderL2Name");
    if (controls.shaderL2Code) setTextOnce(controls.shaderL2Code, shaderCodeText(l2Gpu), "shaderL2Code");
  }

  function syncRenderModeControls(gpuReady) {
    uiSync?.syncRenderModeControls(gpuReady);
  }

  function syncLayerTools(layer) {
    uiSync?.syncLayerTools(layer, byIdRef);
  }

  function updateParamLabels(layer) {
    uiSync?.updateParamLabels(layer, documentRef);
  }

  function syncSettingsControls() {
    uiSync?.syncSettingsControls();
    applyCrossfaderPlacement?.();
  }

  function syncTransitionControls() {
    uiSync?.syncTransitionControls();
  }

  function renderBlendOptions() {
    uiSync?.renderBlendOptions();
  }

  function syncPaletteSelectPreview(select, paletteModule, file) {
    if (!select) return;
    const gradient = paletteModule?.color ? paletteSelectGradient(paletteModule) : "";
    if (gradient) {
      select.style.setProperty("--palette-swatch", gradient);
    } else {
      select.style.removeProperty("--palette-swatch");
    }
    select.title = cleanModuleName(file || select.value || "--");
  }

  function paletteSelectGradient(paletteModule) {
    if (!paletteModule?.color) return "";
    const stops = [0, 0.14, 0.28, 0.42, 0.58, 0.72, 0.86, 1];
    const parts = stops.map((value) => {
      const color = paletteModule.color(value) || [0, 0, 0];
      const rgb = color.map((component) => Math.max(0, Math.min(255, Math.round(Number(component) || 0)))).join(", ");
      return `rgb(${rgb}) ${Math.round(value * 100)}%`;
    });
    return `linear-gradient(90deg, ${parts.join(", ")})`;
  }

  function syncManualPalette(layer) {
    const palette = state[layer].manualPalette;
    const root = layerButtons[`${layer}_manual_palette`];
    const toggle = layerButtons[`${layer}_manual_palette_toggle`];
    const collapse = layerButtons[`${layer}_manual_palette_collapse`];
    const wheel = layerButtons[`${layer}_manual_palette_wheel`];
    if (!palette || !root || !toggle || !wheel) return;

    const colors = normalizeManualPalette(palette);
    const active = normalizeManualPaletteActive(palette);
    const selected = clampInt(palette.selected, 0, 2, 0);
    const selectedColor = colors[selected];
    const activeColors = colors.filter((_, index) => active[index]);
    const gradientColors = activeColors.length ? activeColors : [selectedColor];
    const manualGradient = gradientColors.length === 1
      ? `linear-gradient(180deg, ${gradientColors[0]}, color-mix(in srgb, ${gradientColors[0]} 32%, #04080f))`
      : `linear-gradient(90deg, ${gradientColors.join(", ")})`;
    palette.selected = selected;
    palette.colors = colors;
    palette.active = active;
    root.classList.toggle("active", palette.enabled);
    root.classList.toggle("is-collapsed", manualPaletteCollapsed[layer] === true);
    root.style.setProperty("--manual-selected-color", selectedColor);
    root.style.setProperty("--manual-c1", colors[0]);
    root.style.setProperty("--manual-c2", colors[1]);
    root.style.setProperty("--manual-c3", colors[2]);
    toggle.textContent = `MAN PAL ${palette.enabled ? "ON" : "OFF"}`;
    toggle.classList.toggle("active", palette.enabled);
    toggle.style.setProperty("--manual-selected-color", selectedColor);
    toggle.style.setProperty("--manual-gradient", manualGradient);
    if (collapse) {
      const collapsed = manualPaletteCollapsed[layer] === true;
      collapse.textContent = collapsed ? "▼" : "▲";
      collapse.setAttribute("aria-expanded", collapsed ? "false" : "true");
    }
    drawManualPaletteWheel(wheel, colors[selected]);

    for (let index = 0; index < 3; index += 1) {
      const button = layerButtons[`${layer}_manual_palette_slot_${index}`];
      const wrap = layerButtons[`${layer}_manual_palette_slot_wrap_${index}`];
      if (!button) continue;
      button.classList.toggle("active", selected === index);
      button.classList.toggle("enabled", active[index]);
      button.style.setProperty("--slot-color", colors[index]);
      button.title = colors[index];
      wrap?.classList.toggle("enabled", active[index]);
      wrap?.classList.toggle("selected", selected === index);
    }
  }

  function syncLayerButtons(layer) {
    const layerState = state[layer];
    setTextOnce(layerButtons[`${layer}_toggle`], `${layer.toUpperCase()} ${layerState.enabled ? "ON" : "OFF"}`, `${layer}_toggle_text`);
    setClassOnce(layerButtons[`${layer}_toggle`], "active", layerState.enabled, `${layer}_toggle`);
    setClassOnce(layerButtons[`${layer}_beatsync`], "active", layerState.beatSync, `${layer}_beatsync`);
    setClassOnce(layerButtons[`${layer}_blackout`], "active", layerState.blackout, `${layer}_blackout`);
    setClassOnce(layerButtons[`${layer}_flash`], "active", layerState.flash, `${layer}_flash`);
    setTextOnce(layerButtons[`${layer}_preview_toggle`], `PREW ${layerState.previewOn ? "ON" : "OFF"}`, `${layer}_preview_toggle_text`);
    setClassOnce(layerButtons[`${layer}_preview_toggle`], "active", layerState.previewOn, `${layer}_preview_toggle`);
    setClassOnce(layerButtons[`${layer}_raw_preview`], "is-off", !layerState.previewOn, `${layer}_raw_preview`);
    syncManualPalette(layer);
  }

  function syncFxBlock(prefix, fxStateName) {
    const fxState = state[fxStateName];
    const mode = prefix === "fxm" ? fxControls.fxm_mode : prefix === "fxm2" ? fxControls.fxm2_mode : fxControls[`${prefix}_mode`];
    const flash = prefix === "fxm" ? fxControls.fxm_flash : prefix === "fxm2" ? fxControls.fxm2_flash : fxControls[`${prefix}_flash`];
    const hold = prefix === "fxm" ? fxControls.fxm_hold : prefix === "fxm2" ? fxControls.fxm2_hold : fxControls[`${prefix}_hold`];
    setValueOnce(mode, fxState.mode, `${prefix}_mode`);
    setValueOnce(sliders[`${prefix}_amount`], fxState.amount, `${prefix}_amount`);
    setValueOnce(sliders[`${prefix}_rate`], fxState.rate, `${prefix}_rate`);
    setClassOnce(flash, "active", fxState.flash || fxState.hold, `${prefix}_flash`);
    setTextOnce(hold, fxState.hold ? "ON" : "OFF", `${prefix}_hold`);
    setClassOnce(hold, "active", fxState.hold, `${prefix}_hold`);
  }

  function syncTransportRegion() {
    setTextOnce(controls.onoff, state.enabled ? "ON" : "OFF", "onoff");
    setClassOnce(controls.onoff, "is-off", !state.enabled, "onoff");
    setClassOnce(documentRef.body, "preview-open", state.previewOpen, "body");
    setClassOnce(controls.previewPanel, "active", state.previewOpen, "previewPanel");
    setClassOnce(controls.previewBtn, "active", state.previewOpen, "previewBtn");
    syncFullscreenButtonLabel(controls.menuFullscreenBtn, documentRef);
    syncPreviewModeControls();
    setValueOnce(controls.master, state.master, "master");
    syncMasterValue();
    setValueOnce(controls.cross, state.cross, "cross");
    setStyleOnce(controls.cross, "--cross-pos", `${state.cross * 100}%`, "cross");
    syncCrossMouseControl();
    setValueOnce(controls.bpm, state.bpm, "bpm");
    setTextOnce(controls.bpmValue, state.bpm.toFixed(1), "bpmValue");
  }

  function syncLayerRegion(layer) {
    const layerState = state[layer];
    const anim = controls[`${layer}Anim`];
    const palette = controls[`${layer}Palette`];
    setSelectValueOnce(anim, layerState.animFile, `${layer}Anim`);
    setSelectValueOnce(palette, layerState.paletteFile, `${layer}Palette`);
    syncPaletteSelectPreview(palette, modules[layer].palette, layerState.paletteFile);
    for (let index = 0; index < 4; index += 1) {
      setValueOnce(sliders[`${layer}_p${index + 1}`], layerState.params[index], `${layer}_p${index + 1}`);
    }
    setValueOnce(sliders[`${layer}_master`], layerState.master, `${layer}_master`);
    syncLayerTools(layer);
    updateParamLabels(layer);
    syncLayerButtons(layer);
  }

  function syncControls() {
    // STEP37AB: preview tab clicks only mutate previewMode / preview size.
    // The dirty transport signature must include those fields, otherwise
    // syncPreviewModeControls() is skipped until some unrelated UI state changes
    // (for example leaving Performance and coming back). That caused PIXEL/SHADER/DEBUG
    // to look frozen even though the saved state had already changed.
    runDirtySync("transport", [
      state.enabled, state.previewOpen, state.master, state.cross, state.bpm,
      state.previewMode, state.pixelPreviewMode, state.shaderPreviewMode,
      state.stagePreviewVariant,
      documentRef?.fullscreenElement ? "fs" : "nofs", settings?.previewMode, settings?.masterDisplayMode
    ].join("|"), syncTransportRegion);

    runDirtySync("settings", [
      settings?.gpuMode, settings?.renderMode, settings?.crossfaderPlacement,
      transitionSettings?.enabled, transitionSettings?.duration, transitionSettings?.curve
    ].join("|"), () => {
      syncSettingsControls();
      syncRenderModeControls(getGpuReady());
      syncTransitionControls();
    });

    runDirtySync("l1", stableLayerSignature("l1"), () => syncLayerRegion("l1"));
    runDirtySync("l2", stableLayerSignature("l2"), () => syncLayerRegion("l2"));

    runDirtySync("fx1", stableFxSignature("fx1"), () => syncFxBlock("fx1", "fx1"));
    runDirtySync("fx2", stableFxSignature("fx2"), () => syncFxBlock("fx2", "fx2"));
    runDirtySync("fxm", stableFxSignature("fxMaster"), () => syncFxBlock("fxm", "fxMaster"));
    runDirtySync("fxm2", stableFxSignature("fxMaster2"), () => syncFxBlock("fxm2", "fxMaster2"));

    runDirtySync("blend", state.blendMode, () => {
      renderBlendOptions();
      setValueOnce(controls.blend, state.blendMode, "blend");
    });

    runDirtySync("rangeVisuals", [
      state.master, state.cross, state.bpm, state.l1.master, state.l2.master,
      state.fx1.amount, state.fx1.rate, state.fx2.amount, state.fx2.rate,
      state.fxMaster.amount, state.fxMaster.rate, state.fxMaster2.amount, state.fxMaster2.rate
    ].join("|"), refreshRangeVisuals);

    runDirtySync("shaderInspectorStatic", [
      state.l1.animFile, state.l2.animFile, state.blendMode, settings.gpuMode, getGpuReady(),
      modules?.l1?.anim?.gpu?.functionName || "", modules?.l2?.anim?.gpu?.functionName || ""
    ].join("|"), () => syncShaderInspector());
  }

  return {
    syncOutputCards,
    syncRenderModeControls,
    syncLayerButtons,
    syncManualPalette,
    syncPaletteSelectPreview,
    syncLayerTools,
    updateParamLabels,
    syncSettingsControls,
    syncTransitionControls,
    syncShaderInspector,
    renderBlendOptions,
    syncControls
  };
}
