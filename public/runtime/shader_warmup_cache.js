export function buildShaderLayerSnapshotRuntime(deps) {
  const { layerState, normalizedParams } = deps;
  return {
    animFile: String(layerState?.animFile || ""),
    paletteFile: String(layerState?.paletteFile || ""),
    params: Array.isArray(layerState?.params) ? [...layerState.params] : normalizedParams(layerState?.params),
    master: Number(layerState?.master ?? 1),
    enabled: layerState?.enabled !== false,
    beatSync: Boolean(layerState?.beatSync),
    blackout: Boolean(layerState?.blackout),
    flash: Boolean(layerState?.flash),
    reverse: Boolean(layerState?.reverse),
    previewOn: layerState?.previewOn ?? true,
    visibility: Number(layerState?.previewOn === false ? 0 : 1),
    mix: Number(layerState?.mix ?? 0),
    mirrorX: Boolean(layerState?.mirrorX),
    mirrorY: Boolean(layerState?.mirrorY),
    manualPalette: {
      enabled: Boolean(layerState?.manualPalette?.enabled),
      count: Number(layerState?.manualPalette?.count || 0),
      colors: Array.from(layerState?.manualPalette?.colors || [])
    }
  };
}

export function buildShaderWarmupSnapshotRuntime(deps) {
  const {
    sourceScene,
    state,
    settings,
    t,
    getBeatPosition,
    buildShaderLayerSnapshot
  } = deps;

  const source = sourceScene || {};
  const l1Source = source.l1 || source.layers?.[0] || state.l1;
  const l2Source = source.l2 || source.layers?.[1] || state.l2;
  return {
    enabled: source.enabled ?? state.enabled,
    cross: source.cross ?? state.cross,
    master: source.master ?? state.master,
    gamma: source.gamma ?? settings.gamma,
    brightnessLimit: source.brightnessLimit ?? settings.brightnessLimit,
    blendMode: source.blendMode ?? state.blendMode,
    time: source.time ?? t,
    beat: source.beat ?? getBeatPosition(),
    fx1: structuredClone?.(source.fx1 ?? state.fx1) || JSON.parse(JSON.stringify(source.fx1 ?? state.fx1)),
    fx2: structuredClone?.(source.fx2 ?? state.fx2) || JSON.parse(JSON.stringify(source.fx2 ?? state.fx2)),
    fxMaster: structuredClone?.(source.fxMaster ?? state.fxMaster) || JSON.parse(JSON.stringify(source.fxMaster ?? state.fxMaster)),
    fxMaster2: structuredClone?.(source.fxMaster2 ?? state.fxMaster2) || JSON.parse(JSON.stringify(source.fxMaster2 ?? state.fxMaster2)),
    l1: buildShaderLayerSnapshot(l1Source),
    l2: buildShaderLayerSnapshot(l2Source)
  };
}

export function shaderWarmupKeyRuntime(snapshot) {
  const parts = [
    snapshot?.l1?.animFile || "--",
    snapshot?.l1?.paletteFile || "--",
    snapshot?.l2?.animFile || "--",
    snapshot?.l2?.paletteFile || "--",
    snapshot?.blendMode || "--",
    Number(snapshot?.cross ?? 0).toFixed(3),
    Number(snapshot?.master ?? 0).toFixed(3),
    Number(snapshot?.fx1?.amount ?? 0).toFixed(3),
    Number(snapshot?.fx1?.rate ?? 0).toFixed(3),
    Number(snapshot?.fx2?.amount ?? 0).toFixed(3),
    Number(snapshot?.fx2?.rate ?? 0).toFixed(3),
    Number(snapshot?.fxMaster?.amount ?? 0).toFixed(3),
    Number(snapshot?.fxMaster?.rate ?? 0).toFixed(3),
    Number(snapshot?.fxMaster2?.amount ?? 0).toFixed(3),
    Number(snapshot?.fxMaster2?.rate ?? 0).toFixed(3)
  ];
  return parts.join("|");
}

export function rememberShaderWarmupSceneRuntime(deps) {
  const {
    sourceScene,
    buildShaderWarmupSnapshot,
    shaderWarmupKey,
    sessionStorageRef,
    shaderPrewarmKey
  } = deps;

  try {
    const snapshot = buildShaderWarmupSnapshot(sourceScene);
    const key = shaderWarmupKey(snapshot);
    const stored = JSON.parse(sessionStorageRef.getItem(shaderPrewarmKey) || "[]");
    const entries = Array.isArray(stored) ? stored.filter((entry) => entry && typeof entry === "object") : [];
    const next = [{ key, scene: snapshot, at: Date.now() }, ...entries.filter((entry) => entry.key !== key)];
    sessionStorageRef.setItem(shaderPrewarmKey, JSON.stringify(next.slice(0, 8)));
  } catch {
    // ignore session cache failures
  }
}

export function rememberShaderModuleWarmupRuntime(deps) {
  const {
    layer,
    folder,
    files,
    currentFile,
    sessionStorageRef,
    shaderModulePrewarmKey
  } = deps;

  try {
    if (!layer || !folder || !Array.isArray(files) || !files.length) return;
    const currentIndex = Math.max(0, files.indexOf(currentFile));
    const prev = files[(currentIndex - 1 + files.length) % files.length];
    const next = files[(currentIndex + 1) % files.length];
    const current = String(currentFile || "").trim();
    if (!current) return;
    const key = `${layer}||${current}`;
    const stored = JSON.parse(sessionStorageRef.getItem(shaderModulePrewarmKey) || "[]");
    const entries = Array.isArray(stored) ? stored.filter((entry) => entry && typeof entry === "object") : [];
    const nextEntries = [
      { key, layer, folder, current, prev, next, at: Date.now() },
      ...entries.filter((entry) => entry.key !== key)
    ];
    sessionStorageRef.setItem(shaderModulePrewarmKey, JSON.stringify(nextEntries.slice(0, 12)));
  } catch {
    // ignore session cache failures
  }
}
