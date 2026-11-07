import { freezeUniqueList } from "./list_utils.js";

export function createShaderPreloadManager(deps) {
  const {
    pathsForFolder,
    listsRef,
    loadModule,
    startupStep,
    startupTimingState,
    prewarmAllGpuCombos,
    warmupLayerPreviewShaders,
    getGpuShaderStats
  } = deps;

  const status = {
    phase: "idle",
    moduleTotal: 0,
    moduleDone: 0,
    compileDone: 0,
    compileTotal: 0,
    lastSwitchAt: 0,
    lazyQueued: 0
  };

  function setStatus(patch) {
    Object.assign(status, patch);
  }

  function setStartupTiming(patch) {
    if (!startupTimingState) return;
    Object.assign(startupTimingState, patch);
  }

  async function startupPreloadAll() {
    const lists = listsRef();
    const modulePaths = [
      ...pathsForFolder("l1_anims", lists.l1Anims),
      ...pathsForFolder("l2_anims", lists.l2Anims),
      ...pathsForFolder("l1_palettes", lists.l1Palettes),
      ...pathsForFolder("l2_palettes", lists.l2Palettes)
    ];

    setStatus({ phase: "modules", moduleTotal: modulePaths.length, moduleDone: 0 });
    setStartupTiming({ phase: "modules", progress: 0, item: 0, total: modulePaths.length, waitMs: 0 });
    startupStep?.(80, "Preloading modules");

    for (let index = 0; index < modulePaths.length; index += 1) {
      await loadModule(modulePaths[index]);
      if (index % 6 === 5 || index === modulePaths.length - 1) {
        const done = index + 1;
        const ratio = done / Math.max(1, modulePaths.length);
        setStatus({ moduleDone: done });
        setStartupTiming({ phase: "modules", progress: ratio, item: done, total: modulePaths.length, waitMs: 0 });
        startupStep?.(80 + ratio * 6, `Preloading modules ${done}/${modulePaths.length}`);
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    setStatus({ phase: "gpu-banks", compileDone: 0, compileTotal: 0 });
    startupStep?.(86, "Compiling realtime render banks");
    await prewarmAllGpuCombos?.((done, total) => {
      const ratio = total ? done / total : 1;
      setStatus({ compileDone: done, compileTotal: total });
      setStartupTiming({ phase: "gpu-banks", progress: ratio, item: done, total, waitMs: 0 });
      startupStep?.(86 + ratio * 2, `Compiling render banks ${done}/${total}`);
    });

    setStatus({ phase: "preview-shaders" });
    startupStep?.(88, "Compiling preview shaders");
    await warmupLayerPreviewShaders?.((done, total) => {
      const ratio = total ? done / total : 1;
      setStartupTiming({ phase: "preview-shaders", progress: ratio, item: done, total, waitMs: 0 });
      startupStep?.(88 + ratio * 4, `Compiling preview shaders ${done}/${total}`);
    });
    setStatus({ phase: "ready" });
  }

  async function lazyPrewarmModules(paths) {
    const unique = freezeUniqueList((paths || []).filter(Boolean));
    if (!unique.length) return;
    setStatus({ lazyQueued: unique.length });
    for (const path of unique) {
      await loadModule(path);
      setStatus({ lazyQueued: Math.max(0, status.lazyQueued - 1) });
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  function markShaderSwitch(at = performance.now()) {
    setStatus({ lastSwitchAt: at });
  }

  function getStatus() {
    const shader = getGpuShaderStats?.() || {};
    return {
      ...status,
      shader
    };
  }

  return {
    startupPreloadAll,
    lazyPrewarmModules,
    markShaderSwitch,
    getStatus
  };
}
