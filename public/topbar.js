import { applyAppearance, bindAppearanceStorage } from "./appearance.js";
import { createOutputBus } from "./runtime/output_bus.js";
const SETTINGS_KEY = "led-engine-settings-v1";
const outputBus = createOutputBus();

function loopRegistry37CE() {
  try { return window.__budilightRuntimeLoopRegistry37CE || null; } catch { return null; }
}
function managedInterval37CE(name, fn, baseMs, opts = {}) {
  const loops = loopRegistry37CE();
  if (loops?.adaptiveInterval) return loops.adaptiveInterval(`topbar:${name}`, fn, baseMs, { group: 'topbar', ...opts });
  return window.setInterval(fn, Math.max(1, Number(baseMs) || 1));
}
function managedTimeout37CE(name, fn, delayMs, opts = {}) {
  const loops = loopRegistry37CE();
  if (loops?.timeout) return loops.timeout(`topbar:${name}`, fn, delayMs, { group: 'topbar', ...opts });
  return window.setTimeout(fn, Math.max(0, Number(delayMs) || 0));
}

applyAppearance();
bindAppearanceStorage();
redirectStandalonePageToShell();
initPageFade();
initSymmetricUiScale();
ensureTopbarViewButtons();
initPowerButton();
initFullscreenPersistence();
initPageZoomAndPan();
initHardwareStatusCard();

function initPageFade() {
  document.documentElement.classList.add("page-fade-ready");
}

function initSymmetricUiScale() {
  if (!document.body.classList.contains("ui-pro")) return;
  document.documentElement.style.setProperty("--ui-scale", "1");
  document.documentElement.style.setProperty("--ui-offset-y", "0px");
}

function ensureTopbarViewButtons() {
  // Topbar buttons are authored directly in each page template.
}

function initPowerButton() {
  const path = currentPage();
  if (path === "index.html") return;

  const button = document.getElementById("onoff");
  if (!button) return;

  const key = "led-engine-state-v3";
  let enabled = readEnabled();
  sync();

  button.addEventListener("click", () => {
    enabled = !enabled;
    const state = readState();
    state.enabled = enabled;
    localStorage.setItem(key, JSON.stringify(state));
    broadcastPowerState(enabled);
    sync();
  });

  window.addEventListener("storage", (event) => {
    if (event.key !== key) return;
    enabled = readEnabled();
    sync();
  });

  function sync() {
    button.textContent = enabled ? "ON" : "OFF";
    button.classList.toggle("is-off", !enabled);
  }

  function broadcastPowerState(nextEnabled) {
    window.postMessage({ type: "led-power", enabled: nextEnabled }, "*");
    outputBus?.post({ type: "led-power", enabled: nextEnabled });
  }

  function readEnabled() {
    return readState().enabled !== false;
  }

  function readState() {
    try {
      const stored = JSON.parse(localStorage.getItem(key));
      return stored && typeof stored === "object" ? stored : {};
    } catch {
      return {};
    }
  }
}

function initFullscreenPersistence() {
  const fullscreenDocument = resolveFullscreenDocument(document);
  const preferred = readSettings().fullscreenPreferred === true;
  fullscreenDocument.addEventListener("fullscreenchange", () => {
    const active = fullscreenDocument.fullscreenElement ? "1" : "0";
    // STEP37DE: fullscreen events can fire repeatedly during shell/view transitions.
    // Avoid storage writes when the stored value is already correct.
    if (sessionStorage.getItem("led-engine-fullscreen") !== active) {
      sessionStorage.setItem("led-engine-fullscreen", active);
    }
    saveSettings({ fullscreenPreferred: active === "1" });
  });

  if ((sessionStorage.getItem("led-engine-fullscreen") === "1" || preferred) && !fullscreenDocument.fullscreenElement) {
    fullscreenDocument.documentElement.requestFullscreen?.().catch(() => {});
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest?.("button");
    const wantsFullscreen = button?.id === "fullBtn" || button?.getAttribute("onclick")?.includes("requestFullscreen");
    if (!wantsFullscreen) return;
    event.preventDefault();
    event.stopPropagation();
    toggleFullscreen();
  }, true);
}

function initPageZoomAndPan() {
  // Hard reset to default size on every boot. The responsive UI scale handles
  // window shrinking; page zoom should not persist between launches.
  const key = "led-engine-page-zoom";
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore storage failures.
  }

  document.documentElement.style.zoom = "1";

  window.addEventListener("wheel", (event) => {
    if (!event.ctrlKey) return;
    event.preventDefault();
    document.documentElement.style.zoom = "1";
  }, { passive: false });
}

function initHardwareStatusCard() {
  const main = document.getElementById("hardwareMain");
  const detail = document.getElementById("hardwareDetail");
  if (!main || !detail) return;

  let stopped = false;
  const authority = window.__ledRuntimeModeAuthority?.get?.() || {};
  const mode = String(authority.mode || window.RUNTIME_PROFILE?.mode || (window.RUNTIME_PROFILE?.raspi ? "raspi-safe" : "normal")).toLowerCase();
  const constrained = mode !== "normal";
  let delayMs = Number(window.RUNTIME_PROFILE?.hardwareStatsPollMs || (constrained ? 5000 : 2500));
  if (!Number.isFinite(delayMs) || delayMs < 1500) delayMs = 2500;

  let lastHardwareText37CZ = "";
  let hardwarePollInFlight37CZ = false;
  async function poll() {
    if (stopped || hardwarePollInFlight37CZ) return;
    // STEP37DE: hardware stats are not needed while the document is hidden.
    // This prevents background tabs/iframes from waking the server and DOM.
    if (document.hidden) {
      managedTimeout37CE('hardware-stats-poll-hidden', poll, Math.max(delayMs * 2, 10000), { liveFactor: 3, hiddenFactor: 5, maxMs: 30000 });
      return;
    }
    hardwarePollInFlight37CZ = true;
    try {
      // STEP37CZ: hardware stats are cosmetic. While live output is running, do
      // not let repeated fetches pile up or force DOM writes when values did not
      // visibly change.
      const response = await fetch("/api/hardware-stats?source=topbar", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const stats = await response.json();
      renderHardwareStats(stats);
    } catch {
      const text = "HW --|stats offline";
      if (lastHardwareText37CZ !== text) {
        lastHardwareText37CZ = text;
        main.textContent = "HW --";
        detail.textContent = "stats offline";
        main.closest(".hardware-card")?.classList.add("is-warn");
      }
    } finally {
      hardwarePollInFlight37CZ = false;
      managedTimeout37CE('hardware-stats-poll', poll, delayMs, { liveFactor: 2.5, hiddenFactor: 5, maxMs: 20000 });
    }
  }

  function renderHardwareStats(stats) {
    const cpu = clampPercent(stats?.cpuPercent);
    const mem = clampPercent(stats?.memPercent);
    const temp = Number(stats?.tempC);
    const hasTemp = stats?.tempAvailable === true && Number.isFinite(temp) && temp > 0;
    const card = main.closest(".hardware-card");

    const mainText = `CPU ${cpu}%`;
    const tempText = hasTemp ? ` Â| ${temp.toFixed(1)}Â°C` : " Â| temp --";
    const detailText = `RAM ${mem}% Â| ${stats?.uptime || "--"}${tempText}`;
    const warn = cpu >= 75 || mem >= 85 || (hasTemp && temp >= 70);
    const bad = cpu >= 90 || mem >= 95 || (hasTemp && temp >= 80);
    const textKey = `${mainText}|${detailText}|${warn ? 1 : 0}|${bad ? 1 : 0}`;
    if (lastHardwareText37CZ === textKey) return;
    lastHardwareText37CZ = textKey;

    main.textContent = mainText;
    detail.textContent = detailText;
    card?.classList.toggle("is-warn", warn);
    card?.classList.toggle("is-bad", bad);
  }

  window.addEventListener("pagehide", () => {
    stopped = true;
  }, { once: true });

  poll();
}

function clampPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function readSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
  } catch {
    return {};
  }
}

function saveSettings(next) {
  const current = readSettings();
  const merged = { ...current, ...next };
  // STEP37DE: guard cosmetic settings writes; repeated identical writes can
  // create small stalls on slower tablets while navigating/fullscreen toggling.
  try {
    const before = JSON.stringify(current);
    const after = JSON.stringify(merged);
    if (before === after) return;
    localStorage.setItem(SETTINGS_KEY, after);
  } catch {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
  }
}

function toggleFullscreen() {
  const fullscreenDocument = resolveFullscreenDocument(document);
  if (fullscreenDocument.fullscreenElement) {
    sessionStorage.setItem("led-engine-fullscreen", "0");
    fullscreenDocument.exitFullscreen?.().catch(() => {});
    return;
  }
  sessionStorage.setItem("led-engine-fullscreen", "1");
  fullscreenDocument.documentElement.requestFullscreen?.().catch(() => {});
}

function resolveFullscreenDocument(documentRef) {
  try {
    const topDocument = window?.top?.document;
    if (topDocument?.documentElement) return topDocument;
  } catch {
    // Ignore cross-origin or denied access.
  }
  return documentRef;
}

function currentPage() {
  return location.pathname.split("/").pop() || "index.html";
}

function redirectStandalonePageToShell() {
  if (window.top !== window) return;
  const page = currentPage();
  const shellPages = new Set(["index.html", "animations.html", "mapping.html", "settings.html", "shorts.html"]);
  if (!shellPages.has(page)) return;
  const shellUrl = `shell.html?view=${encodeURIComponent(page)}`;
  location.replace(shellUrl);
}

export function startFpsMeter() {
  const fpsValue = document.getElementById("fpsValue");
  const renderFpsValue = document.getElementById("renderFpsValue");
  if (!fpsValue) return;

  let frames = 0;
  let uiFrames = 0;
  let lastSample = performance.now();
  let lastFrameAt = 0;
  let lastDetail = null;

  const recordFrame = (detail = {}) => {
    frames += 1;
    lastFrameAt = performance.now();
    lastDetail = detail;
    try { window.__ledTelemetryStore?.ingestOutputDetail?.(detail); } catch {}
  };

  outputBus?.subscribe((message) => {
    if (message?.type === "led-output-frame") recordFrame(message.detail);
  });
  window.addEventListener("led-output-frame", (event) => recordFrame(event.detail));
  window.addEventListener("message", (event) => {
    if (event.data?.type === "led-output-frame") recordFrame(event.data.detail);
  });

  // STEP37CY: topbar FPS badge position is cosmetic. Raw scroll/resize
  // events can arrive in bursts and force layout reads while output/preview is
  // painting. Coalesce them into a single RAF/timer update.
  let fpsPositionScheduled37CY = 0;
  function scheduleFpsPositionUpdate37CY(reason = "event") {
    try {
      window.__budilightTopbarPositionGovernor37CY = window.__budilightTopbarPositionGovernor37CY || {
        version: "STEP37CY_TOPBAR_POSITION_GOVERNOR", calls: 0, applied: 0, coalesced: 0, pending: false, reason: ""
      };
      const diag = window.__budilightTopbarPositionGovernor37CY;
      diag.calls += 1; diag.reason = reason; diag.pending = true;
      if (fpsPositionScheduled37CY) { diag.coalesced += 1; return; }
      const apply = () => {
        fpsPositionScheduled37CY = 0;
        try { diag.applied += 1; diag.pending = false; diag.lastAppliedAt = performance.now(); } catch {}
        updateFpsPosition();
      };
      if (typeof requestAnimationFrame === "function" && document.hidden !== true) fpsPositionScheduled37CY = requestAnimationFrame(apply);
      else fpsPositionScheduled37CY = managedTimeout37CE('fps-position', apply, 180, { hiddenFactor: 4, maxMs: 1200 });
    } catch { updateFpsPosition(); }
  }

  updateFpsPosition();
  window.addEventListener("scroll", () => scheduleFpsPositionUpdate37CY("scroll"), { passive: true });
  window.addEventListener("resize", () => scheduleFpsPositionUpdate37CY("resize"), { passive: true });

  function publishSnapshot(now) {
    try {
      const gate = window.__budilightLiveOutputGate37BW;
      if (gate && gate.isUiActive && gate.isUiActive() === false) return;
    } catch {}
    const elapsed = Math.max(1, now - lastSample);
    const live = lastFrameAt && now - lastFrameAt < 1600;
    const outputFps = outputFpsFromDetail(lastDetail);
    const relayFps = Math.round(frames * 1000 / elapsed);
    const renderFps = renderFpsFromRuntime();
    const serialFps = serialFpsFromDetail(lastDetail);
    // STEP37AL: the topbar used to run its own requestAnimationFrame loop only
    // to update text once per second and estimate UI FPS. That extra RAF
    // competed with preview/output on low-power Chromium. Sample from a timer
    // instead; live output FPS still comes from real led-output-frame events.
    const uiFps = Number(window.__ledTopbarFpsSnapshot?.uiFps || 0);
    fpsValue.textContent = live ? Math.round(outputFps || relayFps) : "--";
    if (renderFpsValue) renderFpsValue.textContent = renderFps > 0 ? String(Math.round(renderFps)) : "--";
    window.__ledTopbarFpsSnapshot = {
      source: "topbar",
      updatedAt: now,
      live: Boolean(live),
      outFps: Number(outputFps || relayFps || 0),
      renderFps: Number(renderFps || 0),
      serialFps: Number(serialFps || 0),
      uiFps,
      relayFps: Number(relayFps || 0),
      status: outputStatusText(live, lastDetail)
    };
    try {
      // STEP37AX: topbar snapshot is already stored on window; the DOM event is
      // diagnostic only, so do not wake listeners more often than the 1s sampler.
      const t = performance.now();
      const liveLocked = Boolean(window.__budilightOutputLock37AP?.active || window.__budilightArtNetMasterMirror22EJ?.enabled);
      const last = Number(window.__budilightTopbarEventGovernor37AX?.lastEventAt || 0);
      if (!liveLocked || t - last >= 1000) {
        window.__budilightTopbarEventGovernor37AX = { version: "STEP37AX_TOPBAR_EVENT_GOVERNOR", live: liveLocked, lastEventAt: t, updatedAt: t };
        window.dispatchEvent(new CustomEvent("led-topbar-fps-snapshot", { detail: window.__ledTopbarFpsSnapshot }));
      }
    } catch {}
    frames = 0;
    uiFrames = 0;
    lastSample = now;
  }

  const sampleMs = 1000;
  managedInterval37CE('fps-snapshot', () => {
    try {
      const gate = window.__budilightLiveOutputGate37BW;
      if (gate && gate.shouldRun && gate.shouldRun("topbar-fps-snapshot", sampleMs, { liveFactor: 1.5, hiddenFactor: 4, maxMs: 5000 }) === false) return;
    } catch {}
    publishSnapshot(performance.now());
  }, sampleMs, { liveFactor: 1.5, hiddenFactor: 4, maxMs: 5000 });
}


function renderFpsFromRuntime() {
  const snapshot = window.__ledTelemetryStore?.getSnapshot?.() || {};
  const perf = snapshot.perf || {};
  const telemetry = snapshot.telemetry || {};
  return Number(perf.renderFps || telemetry.renderFps || 0);
}

function serialFpsFromDetail(detail) {
  const snapshot = window.__ledTelemetryStore?.getSnapshot?.() || {};
  const storeDetail = snapshot.detail || {};
  const sourceDetail = (storeDetail && typeof storeDetail === "object" && Object.keys(storeDetail).length)
    ? storeDetail
    : ((detail && typeof detail === "object") ? detail : {});
  const serialFps = Number(sourceDetail?.serialFps || sourceDetail?.serialSettings?.fps || sourceDetail?.perf?.serialFps || 0);
  return Number.isFinite(serialFps) && serialFps > 0 ? serialFps : 0;
}

function outputFpsFromDetail(detail) {
  const snapshot = window.__ledTelemetryStore?.getSnapshot?.() || {};
  const storeDetail = snapshot.detail || {};
  const storePerf = snapshot.perf || {};
  const sourceDetail = (storeDetail && typeof storeDetail === "object" && Object.keys(storeDetail).length)
    ? storeDetail
    : ((detail && typeof detail === "object") ? detail : {});
  const perf = sourceDetail?.perf || storePerf || {};
  const outputTickFps = Number(perf.outputTickFps || sourceDetail?.outputTickFps || 0);
  const mirror = window.__budilightArtNetMasterMirror22EJ || null;
  const mirrorActualFps = Number(mirror?.actualFps || 0);
  const mode = String(sourceDetail?.outputMode || detail?.outputMode || "").toLowerCase();
  const artnetRouteActive = sourceDetail?.artnetEnabled === true
    || sourceDetail?.routerArtnetEnabled === true
    || ["artnet", "sacn", "wifi", "espnow"].includes(mode);
  // STEP22MF: in ArtNet master-mirror mode, visible LED motion cannot be smoother
  // than the browser -> server MASTER mirror. Do not show 60+ FPS from the render
  // loop when the fresh MASTER upload cadence is lower or stalled.
  if (artnetRouteActive && Number.isFinite(mirrorActualFps) && mirrorActualFps > 0) {
    return Number.isFinite(outputTickFps) && outputTickFps > 0 ? Math.min(outputTickFps, mirrorActualFps) : mirrorActualFps;
  }
  if (Number.isFinite(outputTickFps) && outputTickFps > 0) return outputTickFps;

  // STEP 13BU-AO: Topbar must show real transport/output FPS, not UI relay FPS.
  // In shell view the led-output-frame message is intentionally throttled, so the
  // number of received UI events can be ~2 FPS even while serial output is 25-30 FPS.
  // Prefer the runtime serial/output field carried inside the latest detail packet.
  const serialFps = Number(sourceDetail?.serialFps || sourceDetail?.serialSettings?.fps || 0);
  if (sourceDetail?.serial === true && Number.isFinite(serialFps) && serialFps > 0) return serialFps;

  const targetFps = Number(sourceDetail?.targetFps || 0);
  if (Number.isFinite(targetFps) && targetFps > 0) return targetFps;
  return 0;
}

function outputStatusText(live, detail) {
  if (!live || !detail) return "WAIT";
  const output = String(detail.outputMode || "preview").toUpperCase();
  const serialFps = Math.max(0, Math.round(Number(detail.serialFps || 0) || 0));
  const serial = detail.serial ? `SER ${serialFps || "ON"}` : "SER OFF";
  return `${output} | ${serial}`;
}

function updateFpsPosition() {
  const group = document.querySelector(".group.center");
  if (!group) return;
  const documentHeight = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
  const viewportBottom = window.scrollY + window.innerHeight;
  const overlap = Math.max(0, viewportBottom + 12 - documentHeight);
  group.style.setProperty("--fps-bottom", `${10 + overlap}px`);
}
