export function createModuleWarmup(deps) {
  const {
    getCpuPrewarmDone,
    setCpuPrewarmDone,
    getCpuPrewarmRunning,
    setCpuPrewarmRunning,
    getDimensions,
    state,
    modules,
    renderLayerColor,
    loadModule,
    hasModule,
    windowRef,
    runtimeProfile = {}
  } = deps;

  const runtimeOnly = runtimeProfile.runtimeOnly === true;
  const lowPower = runtimeProfile.lowPower === true || runtimeOnly;
  const disableShaderPrewarm = runtimeProfile.disableShaderPrewarm === true || lowPower;
  const disableThumbWarmup = runtimeProfile.disableThumbWarmup === true || runtimeOnly;

  const preloadQueue = [];
  let preloadScheduled = false;

  function scheduleIdle(callback, timeout = 120) {
    if (windowRef.requestIdleCallback) {
      windowRef.requestIdleCallback(callback, { timeout });
      return;
    }
    windowRef.setTimeout(() => callback({ timeRemaining: () => 8 }), 16);
  }

  function scheduleCpuPrewarm() {
    if (disableShaderPrewarm) return;
    if (getCpuPrewarmDone() || getCpuPrewarmRunning()) return;
    if (!modules.l1.anim?.render || !modules.l2.anim?.render) return;
    if (!modules.l1.palette?.color || !modules.l2.palette?.color) return;

    setCpuPrewarmRunning(true);
    const { width: W, height: H } = getDimensions();
    const points = [];
    const xCount = Math.min(12, Math.max(4, W));
    const yCount = Math.min(8, Math.max(3, H));
    for (let yi = 0; yi < yCount; yi += 1) {
      for (let xi = 0; xi < xCount; xi += 1) {
        const x = Math.round((xi / Math.max(1, xCount - 1)) * Math.max(0, W - 1));
        const y = Math.round((yi / Math.max(1, yCount - 1)) * Math.max(0, H - 1));
        points.push([x, y]);
      }
    }

    const runChunk = (deadline) => {
      let budget = 0;
      while (points.length) {
        const timeLeft = typeof deadline?.timeRemaining === "function" ? deadline.timeRemaining() : 8;
        if (budget > 0 && timeLeft < 3) break;
        const [x, y] = points.pop();
        renderLayerColor("l1", state.l1, modules.l1, x, y);
        renderLayerColor("l2", state.l2, modules.l2, x, y);
        budget += 1;
        if (budget >= 24) break;
      }
      if (points.length) {
        scheduleIdle(runChunk);
        return;
      }
      setCpuPrewarmRunning(false);
      setCpuPrewarmDone(true);
    };

    scheduleIdle(runChunk);
  }

  function scheduleModuleWarmup(paths) {
    if (disableThumbWarmup || runtimeOnly) return;
    for (const path of paths || []) {
      if (!path || hasModule(path) || preloadQueue.includes(path)) continue;
      preloadQueue.push(path);
    }
    if (preloadScheduled || !preloadQueue.length) return;
    preloadScheduled = true;
    if (windowRef.requestIdleCallback) {
      windowRef.requestIdleCallback(processWarmupQueue, { timeout: 1000 });
      return;
    }
    windowRef.setTimeout(() => processWarmupQueue({ timeRemaining: () => 8 }), 120);
  }

  function processWarmupQueue(deadline) {
    preloadScheduled = false;
    const timeLeft = typeof deadline?.timeRemaining === "function" ? deadline.timeRemaining() : 8;
    if (timeLeft < 3) {
      if (preloadQueue.length) scheduleModuleWarmup([]);
      return;
    }
    const next = preloadQueue.shift();
    if (next) {
      Promise.resolve(loadModule(next)).catch(() => null).finally(() => {
        if (preloadQueue.length) windowRef.setTimeout(() => scheduleModuleWarmup([]), 220);
      });
    }
  }

  function scheduleNearbyWarmup(folder, files, currentFile) {
    if (disableThumbWarmup || runtimeOnly) return;
    if (!Array.isArray(files) || files.length < 2) return;
    const current = Math.max(0, files.indexOf(currentFile));
    const prev = files[(current - 1 + files.length) % files.length];
    const next = files[(current + 1) % files.length];
    scheduleModuleWarmup([`${folder}/${prev}`, `${folder}/${next}`]);
  }

  return {
    scheduleCpuPrewarm,
    scheduleModuleWarmup,
    scheduleNearbyWarmup
  };
}
