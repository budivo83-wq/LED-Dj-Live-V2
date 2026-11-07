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
    await fetchRef("/api/device/quit", { method: "POST" }).catch(() => {});
    windowRef.close?.();
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
