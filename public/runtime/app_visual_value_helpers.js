export function createAppVisualValueHelpers({ clamp01, settings }) {
  function contrast01(value) {
    const centered = clamp01(value);
    return clamp01((centered - 0.5) * (typeof settings === "function" ? settings() : settings).contrast + 0.5);
  }

  function gpuModeValue(value, fallback = "auto") {
    return ["auto", "on", "cpu"].includes(value) ? value : fallback;
  }

  return {
    contrast01,
    gpuModeValue
  };
}
