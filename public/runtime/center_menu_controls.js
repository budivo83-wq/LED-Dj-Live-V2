export function initCenterMenuControlsRuntime(deps) {
  const {
    controls,
    documentRef = document,
    locationRef = location,
    windowRef = window,
    fetchRef = fetch,
    toggleCenterMenuRuntime,
    handleOutsideMenuClickRuntime,
    toggleFullscreenRuntime,
    syncFullscreenButtonLabel,
    toggleCenterMenuRuntimeAction,
    handleOutsideMenuClickRuntimeAction
  } = deps || {};

  if (!controls) return;

  const toggleCenterMenu = () => {
    toggleCenterMenuRuntimeAction?.(controls, toggleCenterMenuRuntime);
  };

  const handleOutsideMenuClick = (event) => {
    handleOutsideMenuClickRuntimeAction?.(event, controls, handleOutsideMenuClickRuntime);
  };

  controls.menuBtn?.addEventListener("click", toggleCenterMenu);
  documentRef.querySelectorAll?.("#centerMenuStrip [data-href]").forEach((button) => {
    button.addEventListener("click", () => {
      locationRef.href = button.dataset.href;
    });
  });
  controls.menuFullscreenBtn?.addEventListener("click", async () => {
    await toggleFullscreenRuntime?.(documentRef);
    syncFullscreenButtonLabel?.(controls.menuFullscreenBtn, documentRef);
  });
  controls.menuQuitBtn?.addEventListener("click", async () => {
    controls.menuQuitBtn.disabled = true;
    controls.menuQuitBtn.textContent = "UKONČUJI…";
    const body = new Blob(["{}"], { type: "application/json" });
    let sent = false;
    try { sent = Boolean(windowRef.navigator?.sendBeacon?.("/api/device/quit", body)); } catch {}
    if (!sent) await fetchRef("/api/device/quit", { method: "POST", body: "{}", keepalive: true, headers: { "Content-Type": "application/json" } }).catch(() => {});
    windowRef.setTimeout?.(() => windowRef.close?.(), 50);
  });
  const syncFullscreenLabel = () => {
    syncFullscreenButtonLabel?.(controls.menuFullscreenBtn, documentRef);
  };
  documentRef.addEventListener("fullscreenchange", syncFullscreenLabel);
  try {
    const topDocument = windowRef?.top?.document;
    if (topDocument && topDocument !== documentRef) {
      topDocument.addEventListener("fullscreenchange", syncFullscreenLabel);
    }
  } catch {
    // Ignore cross-origin or denied access.
  }
  documentRef.addEventListener("click", handleOutsideMenuClick, true);
}
