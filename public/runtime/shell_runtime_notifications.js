export function createShellRuntimeNotifications({
  headless,
  shellViewOnly,
  windowRef,
  performanceRef,
  getGpuReady
}) {
  function canNotifyParent() {
    return Boolean((headless || shellViewOnly) && windowRef?.parent && windowRef.parent !== windowRef);
  }

  function notifyLoading(percent, label) {
    if (!canNotifyParent()) return;
    windowRef.parent.postMessage({
      type: headless ? "led-runner-loading" : "led-ui-loading",
      detail: {
        percent: Math.max(0, Math.min(100, Math.round(Number(percent) || 0))),
        label: String(label || "Loading")
      }
    }, "*");
  }

  function notifyReady() {
    if (!canNotifyParent()) return;
    windowRef.parent.postMessage({
      type: headless ? "led-runner-ready" : "led-ui-ready",
      detail: {
        gpuReady: Boolean(getGpuReady?.()),
        at: performanceRef?.now?.() ?? Date.now()
      }
    }, "*");
  }

  return {
    notifyLoading,
    notifyReady
  };
}
