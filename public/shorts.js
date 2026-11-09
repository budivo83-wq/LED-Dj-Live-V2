import { requestShellNavigation } from "./runtime/shell_child_navigation.js";
import { syncFullscreenButtonLabel, toggleFullscreen } from "./fullscreen.js";

const menuBtn = document.getElementById("menuBtn");
const centerMenuStrip = document.getElementById("centerMenuStrip");
const menuFullscreenBtn = document.getElementById("menuFullscreenBtn");
const menuQuitBtn = document.getElementById("menuQuitBtn");
const mappingList = document.getElementById("mappingList");
const groupFilter = document.getElementById("groupFilter");
const mappingSearch = document.getElementById("mappingSearch");
const presetSelect = document.getElementById("presetSelect");
const presetName = document.getElementById("presetName");
const savePresetBtn = document.getElementById("savePresetBtn");
const loadPresetBtn = document.getElementById("loadPresetBtn");
const resetPresetBtn = document.getElementById("resetPresetBtn");
const shortcutCount = document.getElementById("shortcutCount");
const presetState = document.getElementById("presetState");
const presetDetail = document.getElementById("presetDetail");

const faderSensitivity = document.getElementById("faderSensitivity");
const wheelSensitivity = document.getElementById("wheelSensitivity");
const fineModifier = document.getElementById("fineModifier");
const fastModifier = document.getElementById("fastModifier");

const STORAGE_KEY = "leddj.shortcuts.presets.v13ap";
const ACTIVE_KEY = "leddj.shortcuts.active.v13ap";

const defaults = {
  name: "Default live",
  settings: {
    faderSensitivity: "1.0",
    wheelSensitivity: "1.0",
    fineModifier: "CTRL",
    fastModifier: "SHIFT"
  },
  mappings: {
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
    outputToggle: "O",
    blackout: "B",
    resync: "Enter",
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
    masterUp: "ArrowUp",
    masterDown: "ArrowDown",
    fx1Flash: "1",
    fx1Pulse: "2",
    fx1Strobe: "3",
    fx2Flash: "4",
    fx2Pulse: "5",
    fx2Strobe: "6",
    masterFlash: "7",
    masterPulse: "8",
    masterStrobe: "9",
    previewToggle: "P",
    debugToggle: "F12",
    fullscreenToggle: "F11"
  }
};

const controls = [
  ["Pads", "tapBpm", "Pad TAP", "Rytmický tap pro BPM."],
  ["Pads", "perfPadSync", "Pad SYNC", "Dorovnání beatu jako sync v sequenceru."],
  ["Pads", "perfPadBeatReset", "Pad BEAT RESET", "Reset interního beatu / fráze."],
  ["Pads", "perfPadHalfSpeed", "Pad HHS", "Half speed BPM."],
  ["Pads", "perfPadDoubleSpeed", "Pad DS", "Double speed BPM."],
  ["Pads", "perfPadDrop", "Pad DROP", "Hudební změna kombinace bez posunu beatu."],
  ["Pads", "perfPadBlackout", "Pad BLACKOUT flash", "Momentary blackout bez vypnutí LED/output."],
  ["Pads", "perfPadL1Fx", "Pad L1 FX", "Momentary flash efektoru Layer 1."],
  ["Pads", "perfPadL2Fx", "Pad L2 FX", "Momentary flash efektoru Layer 2."],
  ["Pads", "perfPadMasterFx1", "Pad MASTER FX1", "Momentary flash Master FX 1."],
  ["Pads", "perfPadMasterFx2", "Pad MASTER FX2", "Momentary flash Master FX 2."],
  ["Transport", "resetBeat", "Reset beat", "Reset interního beatu / fráze."],
  ["Transport", "resync", "RESYNC", "Tvrdší synchronizace show."],
  ["Output", "outputToggle", "Output ON/OFF", "Rychlé zapnutí/vypnutí výstupu."],
  ["Output", "blackout", "Blackout", "Nouzové zhasnutí."],
  ["Layer 1", "randomL1Anim", "L1 random anim", "Náhodná animace první vrstvy."],
  ["Layer 1", "prevL1Anim", "L1 anim prev", "Předchozí animace L1."],
  ["Layer 1", "nextL1Anim", "L1 anim next", "Další animace L1."],
  ["Layer 1", "prevL1Palette", "L1 palette prev", "Předchozí paleta L1."],
  ["Layer 1", "nextL1Palette", "L1 palette next", "Další paleta L1."],
  ["Layer 2", "randomL2Anim", "L2 random anim", "Náhodná animace druhé vrstvy."],
  ["Layer 2", "prevL2Anim", "L2 anim prev", "Předchozí animace L2."],
  ["Layer 2", "nextL2Anim", "L2 anim next", "Další animace L2."],
  ["Layer 2", "prevL2Palette", "L2 palette prev", "Předchozí paleta L2."],
  ["Layer 2", "nextL2Palette", "L2 palette next", "Další paleta L2."],
  ["Mix", "crossfaderLeft", "Crossfader vlevo", "Krok crossfaderu směrem k L1."],
  ["Mix", "crossfaderRight", "Crossfader vpravo", "Krok crossfaderu směrem k L2."],
  ["Mix", "masterUp", "Master nahoru", "Zvýšení master brightness/intensity."],
  ["Mix", "masterDown", "Master dolů", "Snížení master brightness/intensity."],
  ["FX", "fx1Flash", "FX1 flash", "Krátký flash na FX1."],
  ["FX", "fx1Pulse", "FX1 pulse", "Pulse na FX1."],
  ["FX", "fx1Strobe", "FX1 strobe", "Strobe na FX1."],
  ["FX", "fx2Flash", "FX2 flash", "Krátký flash na FX2."],
  ["FX", "fx2Pulse", "FX2 pulse", "Pulse na FX2."],
  ["FX", "fx2Strobe", "FX2 strobe", "Strobe na FX2."],
  ["FX", "masterFlash", "Master flash", "Globální flash."],
  ["FX", "masterPulse", "Master pulse", "Globální pulse."],
  ["FX", "masterStrobe", "Master strobe", "Globální strobe."],
  ["UI", "previewToggle", "Preview toggle", "Zobrazit / skrýt preview."],
  ["UI", "debugToggle", "Debug toggle", "Zobrazit / skrýt debug."],
  ["UI", "fullscreenToggle", "Fullscreen", "Přepnout fullscreen."],
  ["MIDI future", "midiLearn", "MIDI learn", "Rezervováno pro budoucí MIDI learn."],
  ["OSC future", "oscArm", "OSC arm", "Rezervováno pro OSC mapping."],
  ["Gamepad future", "gamepadArm", "Gamepad learn", "Rezervováno pro gamepad mapping."]
].map(([group, id, label, help]) => ({ group, id, label, help }));

let activePreset = structuredClone(defaults);

function loadStore() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    if (parsed && typeof parsed === "object") return parsed;
  } catch {}
  return { [defaults.name]: structuredClone(defaults) };
}

function saveStore(store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function normalizeKey(event) {
  const parts = [];
  if (event.ctrlKey) parts.push("Ctrl");
  if (event.altKey) parts.push("Alt");
  if (event.shiftKey) parts.push("Shift");
  if (event.metaKey) parts.push("Meta");
  const key = event.key === " " ? "Space" : event.key;
  if (!["Control", "Alt", "Shift", "Meta"].includes(key)) parts.push(key.length === 1 ? key.toUpperCase() : key);
  return parts.join("+") || "--";
}

function setStatus(label, detail = "SAVED") {
  if (presetState) presetState.textContent = label;
  if (presetDetail) presetDetail.textContent = detail;
}

function hydrateSettings() {
  const s = activePreset.settings || defaults.settings;
  faderSensitivity.value = s.faderSensitivity ?? "1.0";
  wheelSensitivity.value = s.wheelSensitivity ?? "1.0";
  fineModifier.value = s.fineModifier ?? "CTRL";
  fastModifier.value = s.fastModifier ?? "SHIFT";
}

function collectSettings() {
  activePreset.settings = {
    faderSensitivity: faderSensitivity.value,
    wheelSensitivity: wheelSensitivity.value,
    fineModifier: fineModifier.value,
    fastModifier: fastModifier.value
  };
}

function renderPresets() {
  const store = loadStore();
  const activeName = localStorage.getItem(ACTIVE_KEY) || defaults.name;
  presetSelect.innerHTML = Object.keys(store).sort().map((name) => `<option value="${name}">${name}</option>`).join("");
  presetSelect.value = store[activeName] ? activeName : defaults.name;
}

function renderGroups() {
  const groups = [...new Set(controls.map((item) => item.group))];
  groupFilter.innerHTML = `<option value="all">Všechny skupiny</option>` + groups.map((g) => `<option value="${g}">${g}</option>`).join("");
}

function renderMappings() {
  collectSettings();
  const query = (mappingSearch.value || "").trim().toLowerCase();
  const group = groupFilter.value || "all";
  const mappings = activePreset.mappings || {};
  const visible = controls.filter((item) => {
    if (group !== "all" && item.group !== group) return false;
    if (!query) return true;
    return `${item.group} ${item.label} ${item.help} ${item.id}`.toLowerCase().includes(query);
  });

  mappingList.innerHTML = visible.map((item) => `
    <article class="mapping-row" data-group="${item.group}" data-id="${item.id}">
      <div class="mapping-info">
        <span>${item.group}</span>
        <strong>${item.label}</strong>
        <small>${item.help}</small>
      </div>
      <button class="key-capture" type="button" data-id="${item.id}">${mappings[item.id] || "nenastaveno"}</button>
      <button class="clear-key" type="button" data-id="${item.id}">×</button>
    </article>
  `).join("");

  shortcutCount.textContent = Object.values(mappings).filter(Boolean).length;
}

function loadPreset(name) {
  const store = loadStore();
  activePreset = structuredClone(store[name] || defaults);
  localStorage.setItem(ACTIVE_KEY, activePreset.name || name || defaults.name);
  hydrateSettings();
  renderMappings();
  setStatus("LOADED", activePreset.name || name || "LOCAL");
}

function saveCurrentPreset() {
  collectSettings();
  const store = loadStore();
  const name = (presetName.value || presetSelect.value || activePreset.name || defaults.name).trim();
  activePreset.name = name;
  store[name] = structuredClone(activePreset);
  saveStore(store);
  localStorage.setItem(ACTIVE_KEY, name);
  renderPresets();
  presetSelect.value = name;
  presetName.value = "";
  setStatus("SAVED", name);
}

function init() {
  syncFullscreenButtonLabel(menuFullscreenBtn, document);
  const store = loadStore();
  if (!localStorage.getItem(STORAGE_KEY)) saveStore(store);
  renderGroups();
  renderPresets();
  loadPreset(presetSelect.value || defaults.name);
}

menuBtn?.addEventListener("click", () => {
  centerMenuStrip?.classList.toggle("open");
  menuBtn.classList.toggle("active");
});

document.querySelectorAll("#centerMenuStrip [data-href]").forEach((button) => {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    requestShellNavigation(button.dataset.href, { mainReturnFast: button.dataset?.mainReturnFast === "1" });
  });
});

menuFullscreenBtn?.addEventListener("click", async () => {
  await toggleFullscreen(document);
  syncFullscreenButtonLabel(menuFullscreenBtn, document);
});

menuQuitBtn?.addEventListener("click", async () => {
  menuQuitBtn.disabled = true;
  menuQuitBtn.textContent = "UKONČUJI…";
  const body = new Blob(["{}"], { type: "application/json" });
  try { navigator.sendBeacon?.("/api/device/quit", body); } catch {}
  void fetch("/api/device/quit", { method: "POST", body: "{}", keepalive: true, headers: { "Content-Type": "application/json" } }).catch(() => {});
  try { window.top?.postMessage?.({ type: "led-shell-quit" }, "*"); } catch {}
  window.setTimeout(() => { try { window.top?.close?.(); } catch {} try { window.close(); } catch {} }, 80);
});

document.addEventListener("fullscreenchange", () => syncFullscreenButtonLabel(menuFullscreenBtn, document));

document.addEventListener("click", (event) => {
  if (!centerMenuStrip?.classList.contains("open")) return;
  const target = event.target;
  if (target.closest("#centerMenuStrip") || target.closest("#menuBtn")) return;
  centerMenuStrip.classList.remove("open");
  menuBtn?.classList.remove("active");
}, true);

mappingList?.addEventListener("click", (event) => {
  const capture = event.target.closest(".key-capture");
  const clear = event.target.closest(".clear-key");
  if (clear) {
    activePreset.mappings[clear.dataset.id] = "";
    renderMappings();
    setStatus("EDIT", "KEY CLEARED");
    return;
  }
  if (!capture) return;
  capture.textContent = "stiskni klávesu…";
  capture.classList.add("listening");
  const id = capture.dataset.id;
  const onKey = (keyEvent) => {
    keyEvent.preventDefault();
    activePreset.mappings[id] = normalizeKey(keyEvent);
    document.removeEventListener("keydown", onKey, true);
    renderMappings();
    setStatus("EDIT", "UNSAVED");
  };
  document.addEventListener("keydown", onKey, true);
});

[groupFilter, mappingSearch].forEach((el) => el?.addEventListener("input", renderMappings));
[faderSensitivity, wheelSensitivity, fineModifier, fastModifier].forEach((el) => el?.addEventListener("input", () => {
  collectSettings();
  setStatus("EDIT", "UNSAVED");
}));

savePresetBtn?.addEventListener("click", saveCurrentPreset);
loadPresetBtn?.addEventListener("click", () => loadPreset(presetSelect.value));
resetPresetBtn?.addEventListener("click", () => {
  activePreset = structuredClone(defaults);
  hydrateSettings();
  renderMappings();
  setStatus("RESET", "UNSAVED");
});
presetSelect?.addEventListener("change", () => loadPreset(presetSelect.value));

init();
