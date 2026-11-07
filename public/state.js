import {
  createDefaultSettings,
  createDefaultState,
  createDefaultTransitionSettings,
  createModuleSlots,
  createTransitionSlots
} from "./core/defaults.js";

export function createAppState() {
  return {
    state: createDefaultState(),
    settings: createDefaultSettings(),
    transitionSettings: createDefaultTransitionSettings(),
    modules: createModuleSlots(),
    transitions: createTransitionSlots()
  };
}

export function createStateBridge(deps) {
  const {
    state,
    settings,
    transitionSettings,
    storageKey,
    settingsKey,
    transitionKey,
    mappingKey,
    serialKey,
    blendModes,
    clamp01,
    clampInt,
    bpmValue,
    beatStartedAtValue,
    clampResetId,
    gammaValue,
    contrastValue,
    transitionSecondsValue,
    normalizeManualPalette,
    normalizeManualPaletteActive,
    getLastBeatResetId,
    setLastBeatResetId,
    setViewportSize,
    setSerialReversedRows,
    setSerialEnabledRows,
    setSerialBrightnessRows,
    setSerialPixelLimitRows,
    setSerialOutputRouteRows,
    setSerialColorOrderRows,
    onViewportChanged,
    getSerialSettings,
    setSerialSettings,
    setLayerPreviewDisabled
  } = deps;

  function outputModeValue(value) {
    return ["preview", "artnet", "sacn", "wifi", "espnow"].includes(value) ? value : "preview";
  }

  function gpuModeValue(value, fallback = "auto") {
    return ["auto", "on", "cpu"].includes(value) ? value : fallback;
  }

  function previewDimensions(mapping) {
    const stripPixels = Array.isArray(mapping?.strips)
      ? mapping.strips.map((segment) => clampInt(segment?.pixels ?? 0, 1, 20000, 1))
      : [];
    const derivedPixels = stripPixels.length ? Math.max(...stripPixels) : 0;
    const pixelsPerStrip = clampInt(derivedPixels || (mapping?.pixelsPerStrip ?? 30), 1, 20000, 30);
    const count = clampInt(mapping?.count ?? 10, 1, 256, 10);
    return { width: pixelsPerStrip, height: count };
  }

  function restoreLocalState() {
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey));
      if (!stored || typeof stored !== "object") return false;
      applyState(stored);
      return true;
    } catch {
      return false;
    }
  }

  function restoreSettings() {
    try {
      const stored = JSON.parse(localStorage.getItem(settingsKey));
      settings.outputMode = outputModeValue(stored?.outputMode ?? settings.outputMode);
      settings.targetIp = String(stored?.targetIp || settings.targetIp || "192.168.1.50");
      settings.wifiPort = clampInt(stored?.wifiPort ?? settings.wifiPort, 1, 65535, 7777);
      settings.blxEnabled = stored?.blxEnabled === true || stored?.blxEnabled === "true";
      settings.blxTransport = stored?.blxTransport === "net" ? "net" : "serial";
      settings.blxTargetIp = String(stored?.blxTargetIp || settings.blxTargetIp || "192.168.1.50");
      settings.blxPort = clampInt(stored?.blxPort ?? settings.blxPort, 1, 65535, 7777);
      settings.blxSerialBaud = clampInt(stored?.blxSerialBaud ?? settings.blxSerialBaud, 9600, 3000000, 1000000);
      settings.fps = clampInt(stored?.fps ?? settings.fps, 1, 120, 60);
      settings.previewFps = clampInt(stored?.previewFps ?? settings.previewFps ?? 30, 1, 60, 30);
      settings.gamma = gammaValue(stored?.gamma ?? settings.gamma);
      settings.brightnessLimit = clamp01(stored?.brightnessLimit ?? settings.brightnessLimit);
      settings.contrast = contrastValue(stored?.contrast ?? settings.contrast);
      const crossSensitivity = Number(stored?.crossMouseSensitivity ?? settings.crossMouseSensitivity ?? 2.2);
      settings.crossMouseSensitivity = Number.isFinite(crossSensitivity)
        ? Math.max(0.6, Math.min(4.5, crossSensitivity))
        : 2.2;
      settings.crossfaderPlacement = stored?.crossfaderPlacement === "topbar" ? "topbar" : "normal";
      settings.shaderPreviewFps = clampInt(stored?.shaderPreviewFps ?? settings.shaderPreviewFps ?? 20, 1, 60, 20);
      settings.layerPreviewEnabled = stored?.layerPreviewEnabled ?? settings.layerPreviewEnabled;
      settings.gpuMode = gpuModeValue(stored?.gpuMode ?? (stored?.gpuEnabled === false ? "cpu" : "auto"));
      settings.gpuEnabled = settings.gpuMode !== "cpu";
      settings.welcomeEnabled = stored?.welcomeEnabled !== false;
      settings.welcomeText = String(stored?.welcomeText || settings.welcomeText || "vítej borče").trim().slice(0, 48) || "vítej borče";
      settings.ledStartOff = stored?.ledStartOff !== false;
      settings.artnetEnabled = stored?.artnetEnabled === true || stored?.artnetEnabled === "true" || stored?.routerArtnetEnabled === true || stored?.routerArtnetEnabled === "true";
      settings.routerArtnetEnabled = settings.artnetEnabled;
      settings.routerSerialEnabled = stored?.routerSerialEnabled === true || stored?.routerSerialEnabled === "true";
      settings.usbDmxEnabled = stored?.usbDmxEnabled === true || stored?.usbDmxEnabled === "true";
    } catch {
      settings.outputMode = "preview";
      settings.targetIp = "192.168.1.50";
      settings.wifiPort = 7777;
      settings.blxEnabled = false;
      settings.blxTransport = "serial";
      settings.blxTargetIp = "192.168.1.50";
      settings.blxPort = 7777;
      settings.blxSerialBaud = 1000000;
      settings.fps = 60;
      settings.previewFps = 30;
      settings.gamma = 2.2;
      settings.brightnessLimit = 1;
      settings.contrast = 1.35;
      settings.crossMouseSensitivity = 2.2;
      settings.crossfaderPlacement = "normal";
      settings.shaderPreviewFps = 20;
      settings.layerPreviewEnabled = true;
      settings.gpuMode = "auto";
      settings.gpuEnabled = true;
      settings.welcomeEnabled = true;
      settings.welcomeText = "vítej borče";
      settings.ledStartOff = true;
      settings.artnetEnabled = false;
      settings.routerArtnetEnabled = false;
      settings.routerSerialEnabled = false;
      settings.usbDmxEnabled = false;
    }
    setLayerPreviewDisabled?.(!settings.layerPreviewEnabled);
  }

  function restoreTransitionSettings() {
    try {
      const stored = JSON.parse(localStorage.getItem(transitionKey));
      transitionSettings.enabled = Boolean(stored?.enabled);
      transitionSettings.seconds = transitionSecondsValue(stored?.seconds ?? transitionSettings.seconds);
    } catch {
      transitionSettings.enabled = false;
      transitionSettings.seconds = 1.5;
    }
  }

  function restoreMapping() {
    try {
      const mapping = JSON.parse(localStorage.getItem(mappingKey));
      const dimensions = previewDimensions(mapping);
      setViewportSize(dimensions.width, dimensions.height);
      const stripCount = clampInt(mapping?.count ?? dimensions.height, 1, 64, dimensions.height);
      const strips = Array.isArray(mapping?.strips) ? mapping.strips : [];
      const reversed = Array.from({ length: stripCount }, (_, index) => {
        if (strips[index] && typeof strips[index] === "object") return Boolean(strips[index].reversed);
        return Boolean(mapping?.reversed?.[index]);
      });
      const enabled = Array.from({ length: stripCount }, (_, index) => {
        if (strips[index] && typeof strips[index] === "object") return strips[index].enabled !== false;
        return mapping?.enabled?.[index] !== false;
      });
      const brightness = Array.from({ length: stripCount }, (_, index) => {
        const value = strips[index]?.brightness ?? mapping?.brightness?.[index] ?? 1;
        return clamp01(value);
      });
      const pixelLimits = Array.from({ length: stripCount }, (_, index) => {
        const value = strips[index]?.pixels ?? mapping?.pixelsPerStrip ?? dimensions.width;
        return clampInt(value, 1, 20000, dimensions.width);
      });
      const routes = Array.from({ length: stripCount }, (_, index) => {
        const raw = String(strips[index]?.output ?? mapping?.outputs?.[index] ?? "none").toLowerCase();
        if (["none", "serial", "blx", "artnet", "sacn", "dmx"].includes(raw)) return raw;
        return "none";
      });
      const colorOrders = Array.from({ length: stripCount }, (_, index) => {
        return String(strips[index]?.colorOrder ?? mapping?.colorOrder?.[index] ?? "RGB").toUpperCase();
      });
      setSerialReversedRows(reversed);
      setSerialEnabledRows?.(enabled);
      setSerialBrightnessRows?.(brightness);
      setSerialPixelLimitRows?.(pixelLimits);
      setSerialOutputRouteRows?.(routes);
      setSerialColorOrderRows?.(colorOrders);
    } catch {
      setViewportSize(30, 10);
      setSerialReversedRows([]);
      setSerialEnabledRows?.([]);
      setSerialBrightnessRows?.([]);
      setSerialPixelLimitRows?.([]);
      setSerialOutputRouteRows?.([]);
      setSerialColorOrderRows?.([]);
    }
    onViewportChanged?.();
  }

  function normalizeSerialProtocol(value) {
    const protocol = String(value || "aa_len_rgb").toLowerCase();
    return protocol === "aa_len_rgb" ? protocol : "aa_len_rgb";
  }

  function restoreSerialSettings() {
    try {
      const stored = JSON.parse(localStorage.getItem(serialKey));
      setSerialSettings({
        enabled: stored?.enabled === true || stored?.enabled === "true",
        path: String(stored?.path || ""),
        baudRate: clampInt(stored?.baudRate ?? 115200, 9600, 3000000, 115200),
        fps: clampInt(stored?.fps ?? 60, 1, 120, 60),
        protocol: normalizeSerialProtocol(stored?.protocol),
        simpleAaPixels: clampInt(stored?.simpleAaPixels ?? stored?.aaPixels ?? 160, 1, 2400, 160),
        aaPixels: clampInt(stored?.aaPixels ?? stored?.simpleAaPixels ?? 160, 1, 2400, 160),
        brightness: clampInt(stored?.brightness ?? stored?.testBrightness ?? 20, 0, 255, 20),
        testBrightness: clampInt(stored?.testBrightness ?? stored?.brightness ?? 20, 0, 255, 20)
      });
    } catch {
      setSerialSettings({
        enabled: false,
        path: "",
        baudRate: 115200,
        fps: 60,
        protocol: "aa_len_rgb",
        simpleAaPixels: 160,
        aaPixels: 160,
        brightness: 20,
        testBrightness: 20
      });
    }
  }

  function saveSettings() {
    let stored = {};
    try {
      stored = JSON.parse(localStorage.getItem(settingsKey)) || {};
    } catch {
      stored = {};
    }
    localStorage.setItem(settingsKey, JSON.stringify({ ...stored, ...settings }));
  }

  function saveTransitionSettings() {
    localStorage.setItem(transitionKey, JSON.stringify(transitionSettings));
  }

  // STEP37AY: live-save governor. Serializing the full state and writing it to
  // localStorage is a synchronous main-thread operation. During ArtNet/Serial
  // output this can show up as a tiny hitch even when the renderer itself is
  // fine. Keep persistence reliable, but coalesce writes and prefer idle time
  // while a physical output lock is active.
  let saveLocalStateTimer37AY = 0;
  let saveLocalStateIdleHandle37AY = 0;
  let lastSavedLocalStateJson37AY = "";
  let pendingLocalStateReason37AY = "";
  let saveLocalStateStats37AY = { scheduled: 0, written: 0, skipped: 0, lastMs: 0, pending: false, mode: "sync" };

  function isPhysicalOutputActive37AY() {
    try { if (globalThis.__budilightOutputLock37AP?.active === true) return true; } catch {}
    try { if (globalThis.__budilightArtNetMasterMirror22EJ?.enabled === true) return true; } catch {}
    try { if (globalThis.__budilightSerialMirror22CR?.enabled === true) return true; } catch {}
    return false;
  }

  function writeLocalStateNow37AY(mode = "sync") {
    if (saveLocalStateTimer37AY) {
      try { clearTimeout(saveLocalStateTimer37AY); } catch {}
      saveLocalStateTimer37AY = 0;
    }
    saveLocalStateIdleHandle37AY = 0;
    const t0 = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
    try {
      const json = JSON.stringify(state);
      if (json === lastSavedLocalStateJson37AY) {
        saveLocalStateStats37AY.skipped += 1;
        saveLocalStateStats37AY.pending = false;
        saveLocalStateStats37AY.mode = mode + "-same";
        globalThis.__budilightLocalSaveGovernor37AY = { ...saveLocalStateStats37AY, reason: pendingLocalStateReason37AY };
        return;
      }
      localStorage.setItem(storageKey, json);
      lastSavedLocalStateJson37AY = json;
      saveLocalStateStats37AY.written += 1;
      saveLocalStateStats37AY.lastMs = Math.round((((typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now()) - t0) * 10) / 10;
      saveLocalStateStats37AY.pending = false;
      saveLocalStateStats37AY.mode = mode;
      globalThis.__budilightLocalSaveGovernor37AY = { ...saveLocalStateStats37AY, reason: pendingLocalStateReason37AY };
    } catch {
      saveLocalStateStats37AY.pending = false;
      saveLocalStateStats37AY.mode = mode + "-error";
      try { globalThis.__budilightLocalSaveGovernor37AY = { ...saveLocalStateStats37AY, reason: pendingLocalStateReason37AY }; } catch {}
    }
  }

  function saveLocalState(reason = "state") {
    pendingLocalStateReason37AY = String(reason || "state");
    saveLocalStateStats37AY.scheduled += 1;

    if (!isPhysicalOutputActive37AY()) {
      writeLocalStateNow37AY("sync");
      return;
    }

    saveLocalStateStats37AY.pending = true;
    saveLocalStateStats37AY.mode = "idle-pending";
    try { globalThis.__budilightLocalSaveGovernor37AY = { ...saveLocalStateStats37AY, reason: pendingLocalStateReason37AY }; } catch {}

    if (saveLocalStateTimer37AY || saveLocalStateIdleHandle37AY) return;

    const run = () => writeLocalStateNow37AY("idle");
    if (typeof requestIdleCallback === "function") {
      try {
        saveLocalStateIdleHandle37AY = requestIdleCallback(run, { timeout: 900 });
        return;
      } catch {}
    }
    saveLocalStateTimer37AY = setTimeout(run, 650);
  }

  function applyFxState(target, source) {
    if (!source || typeof source !== "object") return;
    target.mode = ["none", "pulse", "strobe", "shimmer", "spark", "gate", "wave", "crush", "invert", "strobeGate", "beatCut", "glitchMix"].includes(source.mode) ? source.mode : target.mode;
    target.amount = clamp01(source.amount ?? target.amount);
    target.rate = clamp01(source.rate ?? target.rate);
    target.flash = Boolean(source.flash);
    target.hold = Boolean(source.hold);
  }

  function applyManualPaletteState(target, source) {
    if (!target || !source || typeof source !== "object") return;
    target.enabled = Boolean(source.enabled);
    target.selected = clampInt(source.selected ?? target.selected, 0, 2, 0);
    target.colors = normalizeManualPalette(source);
    target.active = normalizeManualPaletteActive(source);
  }

  function applyLayerState(target, source) {
    if (!source || typeof source !== "object") return;
    target.animFile = source.animFile || target.animFile;
    target.paletteFile = source.paletteFile || target.paletteFile;
    target.master = clamp01(source.master ?? target.master);
    target.enabled = source.enabled ?? target.enabled;
    target.beatSync = Boolean(source.beatSync);
    target.blackout = Boolean(source.blackout);
    target.flash = Boolean(source.flash);
    target.reverse = Boolean(source.reverse);
    target.mirrorX = Boolean(source.mirrorX);
    target.mirrorY = Boolean(source.mirrorY);
    target.previewOn = source.previewOn ?? target.previewOn;
    applyManualPaletteState(target.manualPalette, source.manualPalette);
    if (Array.isArray(source.params)) {
      [0, 1, 2, 3].forEach((index) => {
        target.params[index] = clamp01(source.params[index] ?? target.params[index]);
      });
    }
  }

  function applyState(nextState) {
    if (!nextState || typeof nextState !== "object") return;
    state.enabled = nextState.enabled ?? state.enabled;
    state.previewOpen = nextState.previewOpen ?? state.previewOpen;
    const previewMode = String(nextState.previewMode ?? state.previewMode ?? "pixel").toLowerCase();
    state.previewMode = ["stage", "pixel", "shader", "debug"].includes(previewMode) ? previewMode : "pixel";
    const pixelPreviewMode = String(nextState.pixelPreviewMode ?? state.pixelPreviewMode ?? "big").toLowerCase();
    state.pixelPreviewMode = ["off", "big", "small"].includes(pixelPreviewMode) ? pixelPreviewMode : "big";
    const shaderPreviewMode = String(nextState.shaderPreviewMode ?? state.shaderPreviewMode ?? "big").toLowerCase();
    state.shaderPreviewMode = ["big", "small"].includes(shaderPreviewMode) ? shaderPreviewMode : "big";
    state.cross = clamp01(nextState.cross ?? state.cross);
    state.master = clamp01(nextState.master ?? state.master);
    state.bpm = bpmValue(nextState.bpm ?? state.bpm);
    state.beat.resetId = clampResetId(nextState.beat?.resetId ?? state.beat.resetId);
    state.beat.startedAt = beatStartedAtValue(nextState.beat?.startedAt ?? state.beat.startedAt);
    if (state.beat.resetId !== getLastBeatResetId()) {
      setLastBeatResetId(state.beat.resetId);
      state.beat.startedAt = beatStartedAtValue(nextState.beat?.startedAt ?? Date.now());
    }
    state.blendMode = nextState.blendMode || state.blendMode;
    if (!blendModes.includes(state.blendMode)) state.blendMode = "add";
    applyFxState(state.fx1, nextState.fx1);
    applyFxState(state.fx2, nextState.fx2);
    applyFxState(state.fxMaster, nextState.fxMaster);
    applyFxState(state.fxMaster2, nextState.fxMaster2);
    applyLayerState(state.l1, nextState.l1);
    applyLayerState(state.l2, nextState.l2);
  }

  return {
    outputModeValue,
    previewDimensions,
    restoreLocalState,
    restoreSettings,
    restoreTransitionSettings,
    restoreMapping,
    restoreSerialSettings,
    saveSettings,
    saveTransitionSettings,
    saveLocalState,
    applyFxState,
    applyManualPaletteState,
    applyLayerState,
    applyState
  };
}
