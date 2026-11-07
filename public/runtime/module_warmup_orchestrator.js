import { resolveModulePath } from "../core/module_loader.js";

export function preloadNeighborShadersRuntime(deps) {
  const {
    layer,
    folder,
    files,
    currentFile,
    shaderPreloadManager,
    layerTime,
    state,
    getBeatPosition,
    normalizedParams,
    windowRef,
    loadModule,
    renderShaderLayerCanvas,
    shaderNeighborWarmupCanvas
  } = deps;

  if (!Array.isArray(files) || !files.length) return;
  const currentIndex = Math.max(0, files.indexOf(currentFile));
  const prevFile = files[(currentIndex - 1 + files.length) % files.length];
  const nextFile = files[(currentIndex + 1) % files.length];
  const targets = [currentFile, nextFile, prevFile].filter(Boolean).filter((file, index, arr) => arr.indexOf(file) === index);
  const lazyPaths = [prevFile, nextFile].filter(Boolean).map((file) => `${folder}/${file}`);
  shaderPreloadManager?.lazyPrewarmModules?.(lazyPaths).catch((error) => console.warn("Lazy shader module prewarm failed", error));

  const warmupOptions = {
    time: layerTime(state[layer]),
    beat: getBeatPosition(),
    params: normalizedParams(state[layer].params),
    paletteFile: state[layer].paletteFile,
    flip: state[layer].reverse,
    mirrorX: state[layer].mirrorX,
    mirrorY: state[layer].mirrorY
  };

  windowRef.setTimeout(async () => {
    for (const file of targets) {
      try {
        const anim = await loadModule(resolveModulePath(folder, file, files));
        if (!anim?.gpu) continue;
        renderShaderLayerCanvas(shaderNeighborWarmupCanvas, anim.gpu, warmupOptions);
      } catch (error) {
        console.warn("Neighbor shader preload failed", file, error);
      }
    }
  }, 0);
}

export async function warmupStoredShaderScenesRuntime(deps) {
  const {
    previewRenderer,
    forceCpuRender,
    sessionStorageRef,
    shaderPrewarmKey,
    lists,
    buildShaderWarmupSnapshot,
    state,
    loadModule,
    createGpuWarmupScene,
    scheduleGpuWarmup
  } = deps;

  if (!previewRenderer.warmupShaderScene || forceCpuRender) return;

  let entries = [];
  try {
    const stored = JSON.parse(sessionStorageRef.getItem(shaderPrewarmKey) || "[]");
    entries = Array.isArray(stored) ? stored : [];
  } catch {
    entries = [];
  }

  const validL1 = new Set((lists.l1Anims || []).filter(Boolean));
  const validL2 = new Set((lists.l2Anims || []).filter(Boolean));
  const recent = entries
    .filter((entry) => {
      const scene = entry?.scene || entry;
      const l1Anim = String(scene?.l1?.animFile || scene?.l1 || "");
      const l2Anim = String(scene?.l2?.animFile || scene?.l2 || "");
      return Boolean(l1Anim && l2Anim && validL1.has(l1Anim) && validL2.has(l2Anim));
    })
    .slice(0, 4);

  for (const entry of recent) {
    try {
      const sceneSnapshot = entry.scene || buildShaderWarmupSnapshot({
        l1: { animFile: entry.l1, paletteFile: state.l1.paletteFile },
        l2: { animFile: entry.l2, paletteFile: state.l2.paletteFile }
      });
      const [l1Anim, l2Anim] = await Promise.all([
        loadModule(resolveModulePath("l1_anims", sceneSnapshot.l1.animFile, lists.l1Anims)),
        loadModule(resolveModulePath("l2_anims", sceneSnapshot.l2.animFile, lists.l2Anims))
      ]);
      if (!l1Anim?.gpu || !l2Anim?.gpu) continue;
      const scene = createGpuWarmupScene(l1Anim.gpu, l2Anim.gpu, sceneSnapshot);
      if (scene) scheduleGpuWarmup(scene);
    } catch (error) {
      console.warn("Stored shader warmup failed", entry, error);
    }
  }
}

export async function warmupStoredShaderModulesRuntime(deps) {
  const {
    lists,
    sessionStorageRef,
    shaderModulePrewarmKey,
    schedulerDebugState,
    layerTime,
    state,
    getBeatPosition,
    normalizedParams,
    loadModule,
    renderShaderLayerCanvas,
    shaderNeighborWarmupCanvas
  } = deps;

  if (!Array.isArray(lists.l1Anims) || !Array.isArray(lists.l2Anims)) return;

  let entries = [];
  try {
    const stored = JSON.parse(sessionStorageRef.getItem(shaderModulePrewarmKey) || "[]");
    entries = Array.isArray(stored) ? stored : [];
  } catch {
    entries = [];
  }

  const valid = {
    l1: new Set((lists.l1Anims || []).filter(Boolean)),
    l2: new Set((lists.l2Anims || []).filter(Boolean))
  };

  const recent = entries
    .filter((entry) => entry && valid[entry.layer]?.has(entry.current))
    .slice(0, 4);
  const planned = recent.reduce((total, entry) => total + [entry.prev, entry.current, entry.next].filter(Boolean).length, 0);
  schedulerDebugState.shaderWarmupQueue = planned;

  for (const entry of recent) {
    const layer = entry.layer === "l2" ? "l2" : "l1";
    const folder = layer === "l2" ? "l2_anims" : "l1_anims";
    const files = [entry.prev, entry.current, entry.next].filter(Boolean);
    const warmupOptions = {
      time: layerTime(state[layer]),
      beat: getBeatPosition(),
      params: normalizedParams(state[layer].params),
      paletteFile: state[layer].paletteFile,
      flip: state[layer].reverse,
      mirrorX: state[layer].mirrorX,
      mirrorY: state[layer].mirrorY
    };

    for (const file of files) {
      try {
        const sourceList = layer === "l2" ? lists.l2Anims : lists.l1Anims;
        const anim = await loadModule(resolveModulePath(folder, file, sourceList));
        if (anim?.gpu) {
          renderShaderLayerCanvas(shaderNeighborWarmupCanvas, anim.gpu, warmupOptions);
        }
      } catch (error) {
        console.warn("Stored shader module warmup failed", layer, file, error);
      } finally {
        schedulerDebugState.shaderWarmupQueue = Math.max(0, schedulerDebugState.shaderWarmupQueue - 1);
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}
