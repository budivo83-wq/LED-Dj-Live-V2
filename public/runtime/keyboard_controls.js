export function createKeyboardControls(deps) {
  const {
    state,
    heldFxKeys,
    syncControls,
    commitState,
    tapBpm,
    resetBeat,
    randomizeSingleFile,
    stepFile,
    stepBlend,
    isTypingTarget,
    setCrossAltControl,
    syncCrossMouseControl
  } = deps;

  const SHORTCUT_PRESETS_KEY = "leddj.shortcuts.presets.v13ap";
  const SHORTCUT_ACTIVE_KEY = "leddj.shortcuts.active.v13ap";

  const fallbackMappings = {
    tapBpm: "Space",
    perfPadSync: "",
    perfPadBeatReset: "R",
    perfPadHalfSpeed: "",
    perfPadDoubleSpeed: "",
    perfPadDrop: "",
    perfPadBlackout: "B",
    perfPadL1Fx: "1",
    perfPadL2Fx: "2",
    perfPadMasterFx1: "3",
    perfPadMasterFx2: "4",
    resetBeat: "R",
    randomL1Anim: "+",
    prevL1Anim: "A",
    nextL1Anim: "S",
    randomL2Anim: "E",
    prevL2Anim: "D",
    nextL2Anim: "F",
    prevL1Palette: "Z",
    nextL1Palette: "X",
    prevL2Palette: "C",
    nextL2Palette: "V",
    crossfaderLeft: "ArrowLeft",
    crossfaderRight: "ArrowRight",
    fx1Flash: "1",
    fx2Flash: "2",
    masterFlash: "3"
  };

  function readShortcutPreset() {
    try {
      const store = JSON.parse(window.localStorage.getItem(SHORTCUT_PRESETS_KEY) || "{}");
      const activeName = window.localStorage.getItem(SHORTCUT_ACTIVE_KEY) || "Default live";
      const preset = store?.[activeName] || store?.["Default live"] || null;
      return preset?.mappings && typeof preset.mappings === "object" ? preset.mappings : fallbackMappings;
    } catch {
      return fallbackMappings;
    }
  }

  function normalizeEventKey(event) {
    const parts = [];
    if (event.ctrlKey) parts.push("Ctrl");
    if (event.altKey) parts.push("Alt");
    if (event.shiftKey) parts.push("Shift");
    if (event.metaKey) parts.push("Meta");
    const key = event.key === " " ? "Space" : event.key;
    if (!["Control", "Alt", "Shift", "Meta"].includes(key)) {
      parts.push(key.length === 1 ? key.toUpperCase() : key);
    }
    return parts.join("+") || "--";
  }

  function actionForEvent(event) {
    const eventKey = normalizeEventKey(event);
    const mappings = readShortcutPreset();
    return Object.entries(mappings).find(([, key]) => key && key === eventKey)?.[0] || "";
  }

  function setKeyboardFxFlash(key, code, active) {
    if (active) heldFxKeys.set(code, key);
    else heldFxKeys.delete(code);
    if (state[key].flash === active) return;
    state[key].flash = active;
    syncControls();
    commitState();
  }

  function handleShortcut(event) {
    if (event.key === "Alt") {
      event.preventDefault();
      setCrossAltControl(true);
      syncCrossMouseControl();
      return;
    }

    if (event.repeat || isTypingTarget(event.target)) return;

    const action = actionForEvent(event);
    if (!action) return;
    event.preventDefault();

    if (action === "tapBpm") tapBpm();
    else if (action === "resetBeat") resetBeat();
    else if (action === "randomL1Anim") randomizeSingleFile("l1", "animFile", "l1Anims", "l1_anims", "anim");
    else if (action === "prevL1Anim") stepFile?.("l1", "animFile", "l1Anims", "l1_anims", "anim", -1);
    else if (action === "nextL1Anim") stepFile?.("l1", "animFile", "l1Anims", "l1_anims", "anim", 1);
    else if (action === "randomL2Anim") randomizeSingleFile("l2", "animFile", "l2Anims", "l2_anims", "anim");
    else if (action === "prevL2Anim") stepFile?.("l2", "animFile", "l2Anims", "l2_anims", "anim", -1);
    else if (action === "nextL2Anim") stepFile?.("l2", "animFile", "l2Anims", "l2_anims", "anim", 1);
    else if (action === "prevL1Palette") stepFile?.("l1", "paletteFile", "l1Palettes", "l1_palettes", "palette", -1);
    else if (action === "nextL1Palette") stepFile?.("l1", "paletteFile", "l1Palettes", "l1_palettes", "palette", 1);
    else if (action === "prevL2Palette") stepFile?.("l2", "paletteFile", "l2Palettes", "l2_palettes", "palette", -1);
    else if (action === "nextL2Palette") stepFile?.("l2", "paletteFile", "l2Palettes", "l2_palettes", "palette", 1);
    else if (action === "crossfaderLeft") stepBlend?.(-1);
    else if (action === "crossfaderRight") stepBlend?.(1);
    else if (action === "fx1Flash") setKeyboardFxFlash("fx1", event.code, true);
    else if (action === "fx2Flash") setKeyboardFxFlash("fx2", event.code, true);
    else if (action === "masterFlash") setKeyboardFxFlash("fxMaster", event.code, true);
    else if (action === "perfPadL1Fx") setKeyboardFxFlash("fx1", event.code, true);
    else if (action === "perfPadL2Fx") setKeyboardFxFlash("fx2", event.code, true);
    else if (action === "perfPadMasterFx1") setKeyboardFxFlash("fxMaster", event.code, true);
    else if (action === "perfPadMasterFx2") setKeyboardFxFlash("fxMaster2", event.code, true);
  }

  function handleShortcutUp(event) {
    if (event.key === "Alt") {
      setCrossAltControl(false);
      syncCrossMouseControl();
      return;
    }

    const fxKey = heldFxKeys.get(event.code);
    if (fxKey) setKeyboardFxFlash(fxKey, event.code, false);
  }

  function releaseHeldFxKeys() {
    for (const [code, key] of heldFxKeys) {
      setKeyboardFxFlash(key, code, false);
    }
    setCrossAltControl(false);
    syncCrossMouseControl();
  }

  function triggerFxFlash(key) {
    setKeyboardFxFlash(key, `trigger-${key}`, true);
    window.setTimeout(() => setKeyboardFxFlash(key, `trigger-${key}`, false), 120);
  }

  return {
    handleShortcut,
    handleShortcutUp,
    releaseHeldFxKeys,
    triggerFxFlash
  };
}
