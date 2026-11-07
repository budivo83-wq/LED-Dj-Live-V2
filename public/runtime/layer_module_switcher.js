import { resolveModulePath } from "../core/module_loader.js";

export function createLayerModuleSwitcher({
  state,
  modules,
  lists,
  pendingModuleLoads,
  rawPreviewSignature,
  rawPreviewLastAt,
  strictStartupPrewarm,
  performanceRef,
  loadModule,
  cloneLayerState,
  captureLayerModules,
  syncControls,
  commitState,
  closeAnimationPicker,
  closePalettePicker,
  shaderSwitchCpuFallbackMs,
  setForceCpuPreviewUntil,
  setLastOutputFrameAt,
  setGpuReady,
  getShaderPreloadManager,
  schedulerDebugState,
  preloadNeighborShaders,
  rememberShaderWarmupScene,
  rememberShaderModuleWarmup,
  warmupCurrentShaderScene,
  setCpuPrewarmDone,
  scheduleCpuPrewarm,
  scheduleNearbyWarmup,
  startLayerTransition,
  renderPipeline,
  shellViewOnly = false,
  isOutputEnabled = () => false
}) {
  let pendingUiFrame = 0;
  let pendingUiTimer = 0;
  let pendingCommitTimer = 0;

  function managedTimeout37CE(name, fn, delayMs, opts = {}) {
    try {
      const loops = window.__budilightRuntimeLoopRegistry37CE;
      if (loops?.timeout) return loops.timeout(`layer-switch:${name}`, fn, delayMs, { group: 'layer-switch', ...opts });
    } catch {}
    return setTimeout(fn, Math.max(0, Number(delayMs) || 0));
  }
  function clearManaged37CE(id) {
    try { window.__budilightRuntimeLoopRegistry37CE?.clear?.(id); } catch {}
    try { clearTimeout(id); } catch {}
  }

  function scheduleUiSync(delayMs = 0) {
    if (pendingUiFrame || pendingUiTimer) return;
    const run = () => {
      pendingUiTimer = 0;
      try {
        pendingUiFrame = requestAnimationFrame(() => {
          pendingUiFrame = 0;
          try { syncControls(); } catch {}
        });
      } catch {
        pendingUiFrame = 0;
        managedTimeout37CE('ui-sync-fallback', () => { try { syncControls(); } catch {} }, 0, { managed: false });
      }
    };
    if (delayMs > 0) pendingUiTimer = managedTimeout37CE('ui-sync', run, delayMs, { liveFactor: 1.3, hiddenFactor: 3, maxMs: 1000 });
    else run();
  }

  function scheduleCommit(delayMs = 0) {
    if (pendingCommitTimer) return;
    const run = () => {
      pendingCommitTimer = 0;
      try { commitState(); } catch {}
    };
    if (delayMs > 0) pendingCommitTimer = managedTimeout37CE('commit', run, delayMs, { liveFactor: 1.2, hiddenFactor: 2, maxMs: 800 });
    else run();
  }

  async function switchLayerModule(layer, stateKey, folder, moduleKey, file, options = {}) {
    if (!file) return;
    const previousModules = captureLayerModules(layer);
    const previousState = cloneLayerState(state[layer]);

    // STEP22OA: live-safe switch path. Do not do heavy DOM sync twice in the
    // same click task; on Electron/RPi this was enough to stall the output clock
    // during animation changes. State is committed immediately, UI sync is
    // deferred to the next paint so the output loop can keep ticking.
    const shouldSyncUi = options.ui !== false;
    const shouldCommit = options.commit !== false;
    const boundaryDelayMs = Math.max(0, Number(options.commitDelayMs ?? options.delayMs ?? 0));
    const liveOutputMonitorMode = Boolean(shellViewOnly && isOutputEnabled?.());
    const allowWarmup = options.warmup !== false && !liveOutputMonitorMode;
    rawPreviewSignature[layer] = "";
    rawPreviewLastAt[layer] = 0;
    if (!strictStartupPrewarm) {
      setForceCpuPreviewUntil(performanceRef.now() + shaderSwitchCpuFallbackMs());
    }
    setLastOutputFrameAt(0);
    state[layer][stateKey] = file;
    if (shouldCommit) scheduleCommit(boundaryDelayMs);
    if (shouldSyncUi) scheduleUiSync(boundaryDelayMs);

    const loadId = (pendingModuleLoads[layer][moduleKey] || 0) + 1;
    pendingModuleLoads[layer][moduleKey] = loadId;
    const sourceList = moduleKey === "anim" ? lists?.[`${layer}Anims`] : lists?.[`${layer}Palettes`];
    // Yield one frame before the dynamic import. This lets any currently due
    // output tick run before the browser evaluates a new shader/animation module.
    await new Promise((resolve) => {
      try { requestAnimationFrame(() => managedTimeout37CE('next-frame-resolve', resolve, 0, { managed: false })); }
      catch { managedTimeout37CE('next-frame-resolve-fallback', resolve, 0, { managed: false }); }
    });
    const loadedModule = await loadModule(resolveModulePath(folder, file, sourceList));

    if (pendingModuleLoads[layer][moduleKey] !== loadId) {
      if (options.closePicker) closeAnimationPicker();
      if (options.closePalettePicker) closePalettePicker();
      return;
    }
    if (state[layer][stateKey] !== file) {
      if (options.closePicker) closeAnimationPicker();
      if (options.closePalettePicker) closePalettePicker();
      return;
    }
    if (!loadedModule) {
      if (options.closePicker) closeAnimationPicker();
      if (options.closePalettePicker) closePalettePicker();
      return;
    }

    modules[layer][moduleKey] = loadedModule;
    if (moduleKey === "anim" && !strictStartupPrewarm) setGpuReady(false);
    if (moduleKey === "anim") {
      const switchedAt = performanceRef.now();
      getShaderPreloadManager?.()?.markShaderSwitch?.(switchedAt);
      schedulerDebugState.lastShaderSwitchAt = switchedAt;
    }
    // STEP22NY: keep the animation switch hot path output-safe.  The old path
    // did neighbor shader preload, current-scene warmup and CPU prewarm right
    // inside the click/change await chain; on Raspberry/Chromium that produces
    // the visible 0.5-2s freeze and drops the ArtNet stream.  Commit the module
    // first, start the fade, and let warmups run later only when the browser is idle.
    const deferWarmup = (cb, delay = 650) => {
      const run = () => { try { cb?.(); } catch (error) { console.warn("deferred switch warmup failed", error); } };
      if (typeof requestIdleCallback === "function") managedTimeout37CE('deferred-warmup-idle', () => requestIdleCallback(run, { timeout: 1200 }), delay, { liveFactor: 1.8, hiddenFactor: 3, maxMs: 5000 });
      else managedTimeout37CE('deferred-warmup', run, delay, { liveFactor: 1.8, hiddenFactor: 3, maxMs: 5000 });
    };
    if (moduleKey === "anim") {
      rememberShaderWarmupScene();
      rememberShaderModuleWarmup(layer, folder, options.files, file);
      if (allowWarmup) deferWarmup(() => preloadNeighborShaders(layer, folder, lists[`${layer}Anims`], file), 900);
    }
    if (allowWarmup && !strictStartupPrewarm) deferWarmup(() => warmupCurrentShaderScene(), 750);
    setCpuPrewarmDone(false);
    if (allowWarmup) deferWarmup(() => scheduleCpuPrewarm(), 1200);
    // STEP22OA: pre-import only the two neighbours after the switch has settled.
    // This removes most freezes on +/- / random without compiling shaders in the
    // click path. The queue itself is idle-chunked in module_warmup.js.
    if (allowWarmup && options.files && typeof scheduleNearbyWarmup === "function") {
      deferWarmup(() => scheduleNearbyWarmup(folder, options.files, file), 1800);
    }
    // Run configured fade transition between previous and newly loaded module.
    startLayerTransition(layer, previousModules, previousState);
    rawPreviewSignature[layer] = "";
    rawPreviewLastAt[layer] = 0;
    if (!strictStartupPrewarm) {
      setForceCpuPreviewUntil(performanceRef.now() + shaderSwitchCpuFallbackMs());
    }
    setLastOutputFrameAt(0);
    if (shouldSyncUi) scheduleUiSync();
    // Do not force an immediate full preview draw inside the animation switch.
    // The output loop owns the next frame and the preview loop will catch up on
    // its own throttled cadence.
    // Disabled: aggressive GPU prewarm can block the main thread.
    if (options.closePicker) closeAnimationPicker();
    if (options.closePalettePicker) closePalettePicker();
  }

  return { switchLayerModule };
}
