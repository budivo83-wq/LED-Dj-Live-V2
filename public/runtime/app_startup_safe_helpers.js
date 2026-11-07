export function isTypingTargetRuntime(target) {
  return ["INPUT", "SELECT", "TEXTAREA"].includes(target?.tagName) || Boolean(target?.isContentEditable);
}

export function createShaderSwitchCpuFallbackMs({ headless = false, shellViewOnly = false } = {}) {
  return function shaderSwitchCpuFallbackMsRuntime() {
    if (headless) return 0;
    if (shellViewOnly) return 0;
    return 250;
  };
}

export function initPostLoginTransitionRuntime({ sessionStorageRef, documentRef, windowRef } = {}) {
  if (sessionStorageRef?.getItem("led-login-transition") !== "1") return;
  sessionStorageRef.removeItem("led-login-transition");
  documentRef?.documentElement?.classList?.add("post-login-enter");
  windowRef?.setTimeout?.(() => documentRef?.documentElement?.classList?.remove("post-login-enter"), 520);
}
