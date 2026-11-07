export function createRuntimeFpsAccessors({ fpsGovernor, clampInt, minRuntimeFps, maxRuntimeFps, defaultRuntimeFps, fpsDomains, resolveOutputFps = null }) {
  function getRuntimeTargetFps() {
    // Transport/output FPS only. This is not affected by gallery/editor/preview load.
    const resolved = typeof resolveOutputFps === "function" ? Number(resolveOutputFps()) : Number.NaN;
    if (Number.isFinite(resolved) && resolved > 0) {
      return clampInt(resolved, minRuntimeFps, maxRuntimeFps, defaultRuntimeFps);
    }
    return clampInt(fpsGovernor.outputFps(), minRuntimeFps, maxRuntimeFps, defaultRuntimeFps);
  }

  function getRuntimeTargetFrameMs() {
    return 1000 / Math.max(1, getRuntimeTargetFps());
  }

  function getRuntimePreviewTargetFrameMs() {
    return fpsGovernor.frameMs(fpsDomains.PREVIEW);
  }

  function getRuntimeShaderPreviewFps() {
    return fpsGovernor.shaderPreviewFps();
  }

  return {
    getRuntimeTargetFps,
    getRuntimeTargetFrameMs,
    getRuntimePreviewTargetFrameMs,
    getRuntimeShaderPreviewFps
  };
}
