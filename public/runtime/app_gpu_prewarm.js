import { resolveModulePath } from "../core/module_loader.js";

export function createGpuPrewarmHelpers({
  disableShaderPrewarm,
  headless,
  shellViewOnly,
  forceCpuRender,
  previewRenderer,
  loadModule,
  gpuSceneBankId,
  createGpuWarmupSceneDeps,
  rememberShaderWarmupScene,
  syncControls,
  setGpuReady,
  settingsRef,
  listsRef,
  chunkDefaults
}) {
  function createWarmupManualPalette(manualPalette) {
    if (!manualPalette) {
      return { enabled: false, count: 0, colors: new Float32Array(createGpuWarmupSceneDeps.manualPaletteColorSlots) };
    }
    return {
      enabled: Boolean(manualPalette.enabled),
      count: Number(manualPalette.count || 0),
      colors: new Float32Array(manualPalette.colors || [])
    };
  }

  function createGpuWarmupScene(l1Gpu, l2Gpu, snapshot = null) {
    if (!l1Gpu?.functionName || !l2Gpu?.functionName) return null;
    const s = snapshot || {};
    const l1State = s.l1 || createGpuWarmupSceneDeps.getState().l1;
    const l2State = s.l2 || createGpuWarmupSceneDeps.getState().l2;
    const beat = createGpuWarmupSceneDeps.getBeatPosition();
    const state = createGpuWarmupSceneDeps.getState();
    const settings = createGpuWarmupSceneDeps.getSettings();
    return {
      enabled: s.enabled ?? true,
      width: createGpuWarmupSceneDeps.getWidth(),
      height: createGpuWarmupSceneDeps.getHeight(),
      time: s.time ?? createGpuWarmupSceneDeps.getTime(),
      beat: s.beat ?? beat,
      cross: s.cross ?? state.cross,
      master: s.master ?? state.master,
      gamma: s.gamma ?? settings.gamma,
      brightnessLimit: s.brightnessLimit ?? settings.brightnessLimit,
      blendMode: s.blendMode ?? state.blendMode,
      blendTransition: null,
      fx1: s.fx1 || state.fx1,
      fx2: s.fx2 || state.fx2,
      fxMaster: s.fxMaster || state.fxMaster,
      fxMaster2: s.fxMaster2 || state.fxMaster2,
      layers: [
        {
          gpu: l1Gpu,
          params: createGpuWarmupSceneDeps.normalizedParams(l1State.params),
          time: createGpuWarmupSceneDeps.layerTime(l1State),
          master: l1State.master,
          visibility: createGpuWarmupSceneDeps.getLayerVisibility(l1State),
          mix: 1 - (s.cross ?? state.cross),
          paletteFile: l1State.paletteFile,
          mirrorX: l1State.mirrorX,
          mirrorY: l1State.mirrorY,
          manualPalette: createWarmupManualPalette(l1State.manualPalette),
          transition: null
        },
        {
          gpu: l2Gpu,
          params: createGpuWarmupSceneDeps.normalizedParams(l2State.params),
          time: createGpuWarmupSceneDeps.layerTime(l2State),
          master: l2State.master,
          visibility: createGpuWarmupSceneDeps.getLayerVisibility(l2State),
          mix: s.cross ?? state.cross,
          paletteFile: l2State.paletteFile,
          mirrorX: l2State.mirrorX,
          mirrorY: l2State.mirrorY,
          manualPalette: createWarmupManualPalette(l2State.manualPalette),
          transition: null
        }
      ]
    };
  }

  async function prewarmAllGpuCombos(onProgress, options = {}) {
    if (disableShaderPrewarm) return;
    if (!previewRenderer.warmupShaderScene || forceCpuRender) return;
    const lists = listsRef();
    if (!Array.isArray(lists.l1Anims) || !Array.isArray(lists.l2Anims)) return;

    const l1Files = lists.l1Anims.filter(Boolean);
    const l2Files = lists.l2Anims.filter(Boolean);
    if (!l1Files.length || !l2Files.length) return;

    const l1Banks = new Map();
    const l2Banks = new Map();
    for (const file of l1Files) {
      const anim = await loadModule(resolveModulePath("l1_anims", file, lists.l1Anims));
      if (anim?.gpu) {
        const bank = gpuSceneBankId(anim.gpu);
        if (!l1Banks.has(bank)) l1Banks.set(bank, anim);
      }
    }
    for (const file of l2Files) {
      const anim = await loadModule(resolveModulePath("l2_anims", file, lists.l2Anims));
      if (anim?.gpu) {
        const bank = gpuSceneBankId(anim.gpu);
        if (!l2Banks.has(bank)) l2Banks.set(bank, anim);
      }
    }

    const l1Warmup = Array.from(l1Banks.values());
    const l2Warmup = Array.from(l2Banks.values());
    const total = Math.max(1, l1Warmup.length * l2Warmup.length);
    const chunkSize = Math.max(1, Number(options.chunkSize || chunkDefaults.defaultChunkSize));
    const yieldMs = Math.max(0, Number(options.yieldMs || chunkDefaults.defaultYieldMs));
    let done = 0;
    onProgress?.(0, total);

    for (const l1Anim of l1Warmup) {
      for (const l2Anim of l2Warmup) {
        const scene = createGpuWarmupScene(l1Anim.gpu, l2Anim.gpu);
        if (scene) {
          rememberShaderWarmupScene(scene);
          const warmed = previewRenderer.warmupShaderScene(scene);
          if (warmed && settingsRef().gpuEnabled) setGpuReady(true);
        }
        done += 1;
        if (done % chunkSize === 0) {
          onProgress?.(done, total);
          await new Promise((resolve) => setTimeout(resolve, yieldMs));
        }
      }
    }

    onProgress?.(total, total);
    syncControls();
  }

  function scheduleFullGpuPrewarm({ restart = false, hasStartedRef, setStarted, startDelayMs, interactiveChunkSize, interactiveYieldMs }) {
    if (disableShaderPrewarm) return;
    if (restart) setStarted(false);
    if (hasStartedRef()) return;
    if (!headless || shellViewOnly || forceCpuRender || !previewRenderer.warmupShaderScene) return;
    setStarted(true);
    globalThis.window.setTimeout(() => {
      prewarmAllGpuCombos(null, {
        chunkSize: interactiveChunkSize,
        yieldMs: interactiveYieldMs
      }).catch((error) => console.warn("GPU prewarm failed", error));
    }, startDelayMs);
  }

  return {
    createGpuWarmupScene,
    prewarmAllGpuCombos,
    scheduleFullGpuPrewarm
  };
}
