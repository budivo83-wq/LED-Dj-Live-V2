export function createGpuWarmupQueueRuntime({
  windowRef,
  gpuWarmupQueue,
  gpuWarmupSeen,
  gpuWarmupClock,
  schedulerDebugState,
  rememberShaderWarmupScene,
  warmupScene,
  canAutoEnableGpu,
  isGpuEnabled,
  onGpuReady,
  getGpuWarmupScheduled,
  setGpuWarmupScheduled
}) {
  function processGpuWarmupQueue() {
    setGpuWarmupScheduled(false);
    while (gpuWarmupQueue.length) {
      const scene = gpuWarmupQueue.shift();
      schedulerDebugState.warmupQueue = gpuWarmupQueue.length;
      schedulerDebugState.shaderWarmupQueue = gpuWarmupQueue.length;
      const warmed = warmupScene(scene);
      if (warmed && isGpuEnabled() && canAutoEnableGpu()) {
        onGpuReady();
      }
      break;
    }
    if (gpuWarmupQueue.length) {
      setGpuWarmupScheduled(true);
      const delay = gpuWarmupClock.delay();
      gpuWarmupClock.advance();
      schedulerDebugState.gpuWarmupDelayMs = Math.round(delay);
      schedulerDebugState.gpuWarmupNextAt = Math.round(gpuWarmupClock.peekNextAt?.() || 0);
      windowRef.setTimeout(processGpuWarmupQueue, delay > 0 ? delay : 0);
    }
  }

  function scheduleGpuWarmup(scene) {
    if (!scene?.layers?.[0]?.gpu?.functionName || !scene?.layers?.[1]?.gpu?.functionName) return;
    rememberShaderWarmupScene(scene);
    const key = [
      scene.layers[0].gpu.functionName,
      scene.layers[1].gpu.functionName,
      scene.layers[0].transition?.gpu?.functionName || "-",
      scene.layers[1].transition?.gpu?.functionName || "-"
    ].join("|");
    if (gpuWarmupSeen.has(key)) {
      schedulerDebugState.shaderWarmupHits += 1;
      return;
    }
    // Warmup is speculative. Never let a backlog of obsolete scenes delay the
    // currently selected shader; the live renderer can compile the latest
    // scene lazily while this one-item queue warms it in the background.
    if (gpuWarmupQueue.length) {
      schedulerDebugState.shaderWarmupDropped = Number(schedulerDebugState.shaderWarmupDropped || 0) + gpuWarmupQueue.length;
      gpuWarmupQueue.length = 0;
    }
    gpuWarmupSeen.add(key);
    gpuWarmupQueue.push(scene);
    schedulerDebugState.warmupQueue = gpuWarmupQueue.length;
    schedulerDebugState.shaderWarmupQueue = gpuWarmupQueue.length;
    if (getGpuWarmupScheduled()) return;
    setGpuWarmupScheduled(true);
    const delay = gpuWarmupClock.delay();
    schedulerDebugState.gpuWarmupDelayMs = Math.round(delay);
    schedulerDebugState.gpuWarmupNextAt = Math.round(gpuWarmupClock.peekNextAt?.() || 0);
    windowRef.setTimeout(processGpuWarmupQueue, delay > 0 ? delay : 0);
  }

  return {
    scheduleGpuWarmup,
    processGpuWarmupQueue
  };
}
