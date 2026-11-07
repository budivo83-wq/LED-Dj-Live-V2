export function bindRuntimeStateSync(deps) {
  const {
    windowRef,
    state,
    settingsKey,
    mappingKey,
    serialKey,
    storageKey,
    animationLibrarySyncKey,
    restoreSettings,
    syncSettingsControls,
    restoreMapping,
    restoreSerialSettings,
    reloadRuntimeStateFromStorage,
    refreshAnimationLibraryRuntime,
    onLedPower,
    applyState,
    loadSelectedModules,
    scheduleCpuPrewarm,
    syncControls
  } = deps;

  const applyIncomingStateSync = async (nextState) => {
    if (!nextState || typeof nextState !== "object") {
      reloadRuntimeStateFromStorage();
      return;
    }
    const prevFiles = {
      l1Anim: state?.l1?.animFile,
      l1Palette: state?.l1?.paletteFile,
      l2Anim: state?.l2?.animFile,
      l2Palette: state?.l2?.paletteFile
    };
    applyState(nextState);
    const moduleSelectionChanged = prevFiles.l1Anim !== state?.l1?.animFile
      || prevFiles.l1Palette !== state?.l1?.paletteFile
      || prevFiles.l2Anim !== state?.l2?.animFile
      || prevFiles.l2Palette !== state?.l2?.paletteFile;
    if (moduleSelectionChanged) {
      await loadSelectedModules?.().catch(() => {});
      scheduleCpuPrewarm?.();
    }
    syncControls?.();
  };

  windowRef.addEventListener("storage", (event) => {
    if (event.key === settingsKey) {
      restoreSettings();
      syncSettingsControls();
    }
    if (event.key === mappingKey) {
      restoreMapping();
    }
    if (event.key === serialKey) {
      restoreSerialSettings();
    }
    if (event.key === storageKey) {
      reloadRuntimeStateFromStorage();
    }
    if (event.key === animationLibrarySyncKey) {
      refreshAnimationLibraryRuntime?.();
    }
  });

  windowRef.addEventListener("message", (event) => {
    const message = event.data;
    if (!message || typeof message !== "object") return;
    if (message.type === "led-state-sync") {
      applyIncomingStateSync(message.state).catch(() => {
        reloadRuntimeStateFromStorage();
      });
      if (message.reason === "runtime-profile") {
        fetch("/api/runtime-profile")
          .then((response) => response.ok ? response.json() : null)
          .then((profile) => {
            if (profile && typeof profile === "object") {
              Object.assign(windowRef.RUNTIME_PROFILE || {}, profile);
              windowRef.RUNTIME_PROFILE = windowRef.RUNTIME_PROFILE || profile;
              windowRef.dispatchEvent(new CustomEvent("runtime-profile-updated", { detail: profile }));
            }
          })
          .catch(() => {});
      }
      return;
    }
    if (message.type === "led-animation-library-sync") {
      refreshAnimationLibraryRuntime?.();
      return;
    }
    if (message.type !== "led-power") return;
    onLedPower(message);
  });
}
