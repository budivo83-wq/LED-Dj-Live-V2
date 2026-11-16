export const RENDER_BACKEND_POLICY_VERSION = "38A-render-backend-policy";

const CPU_FRAME_PREVIEW_MODES = new Set(["pixel", "stage", "dual", "debug"]);

function normalizedMode(value) {
  return String(value || "").trim().toLowerCase();
}

export function decideRenderBackend(options = {}) {
  const {
    forceCpuRender = false,
    gpuAllowed = false,
    gpuSceneAvailable = false,
    outputActive = false,
    previewMode = "",
    shaderPreviewSize = ""
  } = options;
  const mode = normalizedMode(previewMode);
  const shaderLedPreview = mode === "shader" && normalizedMode(shaderPreviewSize) === "led";
  const needsCpuFrame = Boolean(outputActive)
    || CPU_FRAME_PREVIEW_MODES.has(mode)
    || mode.startsWith("pixel")
    || (mode === "shader" && shaderLedPreview);
  const needsGpuScene = !forceCpuRender
    && Boolean(gpuAllowed)
    && (mode === "shader" || mode.startsWith("pixel") || mode === "dual"
      || mode === "stage" || mode === "debug" || Boolean(outputActive));
  const useGpuScene = needsGpuScene && Boolean(gpuSceneAvailable);

  return {
    mode,
    needsCpuFrame,
    needsGpuScene,
    useGpuScene,
    needsGpuReadback: needsCpuFrame && useGpuScene && Boolean(outputActive || mode !== "shader" || shaderLedPreview),
    backend: useGpuScene ? "gpu" : "cpu"
  };
}
