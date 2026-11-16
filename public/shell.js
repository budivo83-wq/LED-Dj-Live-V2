import { createShellNavigationScheduler, SHELL_DEFAULT_VIEW } from "./runtime/shell_navigation_scheduler.js";
import { formatBootScopeStatus, formatReadyDetail, renderBootDiagLog } from "./runtime/shell_boot_diagnostics.js";
import { buildHardReadyActions, buildLoadedFallbackActions, buildLoadTimeoutActions } from "./runtime/shell_boot_fallbacks.js";
import { classifyShellMessage, SHELL_MESSAGE_ACTIONS } from "./runtime/shell_message_contract.js";
import { evaluateShellTelemetryRelay } from "./runtime/shell_telemetry_relay.js";

const uiFrameStack = document.getElementById("uiFrameStack");
let activeUiFrame = document.getElementById("uiFrame");
const uiFramesByView = new Map();
const uiFrame = {
  get contentWindow() { return activeUiFrame?.contentWindow || null; },
  get contentDocument() { return activeUiFrame?.contentDocument || null; },
  get src() { return activeUiFrame?.src || ""; },
  set src(value) { activateShellViewFromSrc(value); }
};
const runnerFrame = document.getElementById("runnerFrame");
const shellStatus = document.getElementById("shellStatus");
const bootLabel = document.getElementById("bootLabel");
const bootFill = document.getElementById("bootFill");
const bootDiagElapsed = document.getElementById("bootDiagElapsed");
const bootDiagShell = document.getElementById("bootDiagShell");
const bootDiagUi = document.getElementById("bootDiagUi");
const bootDiagRunner = document.getElementById("bootDiagRunner");
const bootDiagLog = document.getElementById("bootDiagLog");
const shellNavPerfPanel = document.getElementById("shellNavPerf");
const shellNavPerfState = document.getElementById("shellNavPerfState");
const shellNavPerfRoute = document.getElementById("shellNavPerfRoute");
const shellNavPerfElapsed = document.getElementById("shellNavPerfElapsed");
const shellNavPerfLoad = document.getElementById("shellNavPerfLoad");
const shellNavPerfReady = document.getElementById("shellNavPerfReady");
const shellNavPerfOutput = document.getElementById("shellNavPerfOutput");
const shellNavPerfPreview = document.getElementById("shellNavPerfPreview");

const DEFAULT_VIEW = SHELL_DEFAULT_VIEW;
const BOOT_GUARD_MS = 8500;
const BOOT_LOAD_TIMEOUT_MS = 14000;
const BOOT_HARD_TIMEOUT_MS = 18000;
const BOOT_DIAG_LIMIT = 18;
const RUNNER_WATCHDOG_POLL_MS = 1000;
const RUNNER_HEARTBEAT_TIMEOUT_MS = 4500;
const RUNNER_FRAME_STALL_MS = 5000;
const RUNNER_RELOAD_COOLDOWN_MS = 2500;
const RUNNER_FIRST_FRAME_GRACE_MS = 9000;
const navigationScheduler = createShellNavigationScheduler({
  uiFrame,
  onNavigate({ current, nextView, startedAt }) {
    uiLoaded = false;
    uiReady = false;
    navPerf = {
      current,
      nextView,
      startedAt,
      uiLoadAt: 0,
      uiReadyAt: 0,
      firstRunnerRelayAt: 0,
      lastRunnerRelayAt: 0,
      firstPreviewAt: 0
    };
    uiTelemetryQuietUntil = startedAt + VIEW_NAV_QUIET_MS;
    lastUiTelemetryRelayAt = startedAt;
    setStatus(`NAV ${nextView.toUpperCase()}`);
    recordBootEvent("shell", "view-nav", `${current || "?"} -> ${nextView}`);
    updateShellNavPerfPanel("NAV");
    startShellNavPerfRefresh();
  }
});
const {
  navigateToView,
  installChildNavigationGuard,
  isView,
  normalizeView,
  saveView,
  restoreView,
  withShellView,
  extractViewName
} = navigationScheduler;

const bootStartedAt = performance.now();
let activeView = normalizeView(new URLSearchParams(location.search).get("view") || restoreView() || DEFAULT_VIEW);
const bootDiag = [];
let runnerReady = false;
let uiReady = activeView !== "index.html";
let uiLoaded = false;
let runnerLoaded = false;
let bootGuardTimer = null;
let bootLoadTimer = null;
let bootHardTimer = null;
let bootGuardStartedAt = 0;
let bootFinishedAt = 0;
let bootDegraded = false;
let uiTelemetryQuietUntil = 0;
let lastUiTelemetryRelayAt = 0;
let navPerf = null;
let navPerfHideTimer = 0;
let navPerfRefreshTimer = 0;
let runnerWatchdogTimer = 0;
let runnerFrameNonce = 0;
let runnerReloadCount = 0;
let runnerLastReloadAt = 0;
let runnerLastReloadReason = "boot";
let lastRunnerSignalAt = 0;
let lastRunnerHeartbeatAt = 0;
let lastRunnerFrameAt = 0;
let lastRunnerReadyAt = 0;
let lastRunnerHeartbeatDetail = null;
let runnerLoadingActive = false;
let runnerLoadingStartedAt = 0;
const UI_TELEMETRY_RELAY_MS = 250;
const UI_TELEMETRY_RELAY_SECONDARY_MS = 1000;
const UI_TOPBAR_FPS_DOM_MS = 500;
const UI_TOPBAR_FPS_SECONDARY_DOM_MS = 1200;
const UI_NAV_QUIET_MS = 1800;
const VIEW_NAV_QUIET_MS = 2200;
const degradedReasons = [];

function loopRegistry37CE() {
  try { return window.__budilightRuntimeLoopRegistry37CE || null; } catch { return null; }
}
function managedInterval37CE(name, fn, baseMs, opts = {}) {
  const loops = loopRegistry37CE();
  if (loops?.adaptiveInterval) return loops.adaptiveInterval(`shell:${name}`, fn, baseMs, { group: 'shell', ...opts });
  return window.setInterval(fn, Math.max(1, Number(baseMs) || 1));
}
function managedTimeout37CE(name, fn, delayMs, opts = {}) {
  const loops = loopRegistry37CE();
  if (loops?.timeout) return loops.timeout(`shell:${name}`, fn, delayMs, { group: 'shell', ...opts });
  return window.setTimeout(fn, Math.max(0, Number(delayMs) || 0));
}
function clearManaged37CE(id) {
  try { loopRegistry37CE()?.clear?.(id); } catch {}
  try { window.clearInterval(id); } catch {}
  try { window.clearTimeout(id); } catch {}
}

const topbarOutputFpsState = {
  frames: 0,
  lastSampleAt: performance.now(),
  lastFrameAt: 0,
  lastDetail: null,
  lastValue: "--",
  lastDomWriteAt: 0,
  domWriteSkipped: 0
};

const shellTelemetryBudget37BS = {
  version: "STEP37BS_ACTIVE_VIEW_TELEMETRY_BUDGET",
  runnerFrames: 0,
  relayedToUi: 0,
  skippedRelay: 0,
  skippedReason: "",
  lastRelayAt: 0,
  lastRelayView: "",
  currentMinIntervalMs: UI_TELEMETRY_RELAY_MS,
  topbarDomWrites: 0,
  topbarDomSkipped: 0
};

function activeViewTelemetryIntervalMs37BS() {
  return activeView === DEFAULT_VIEW ? UI_TELEMETRY_RELAY_MS : UI_TELEMETRY_RELAY_SECONDARY_MS;
}

function updateShellTelemetryBudgetDebug37BS(extra = {}) {
  try {
    window.__budilightShellTelemetryBudget37BS = {
      ...shellTelemetryBudget37BS,
      activeView,
      cachedViews: Array.from(uiFramesByView.keys()),
      ...extra
    };
  } catch {}
}

function updateUiTopbarOutputFps(detail) {
  const now = performance.now();
  topbarOutputFpsState.frames += 1;
  topbarOutputFpsState.lastFrameAt = now;
  topbarOutputFpsState.lastDetail = detail || null;

  if (now - topbarOutputFpsState.lastSampleAt < 500) return;

  const elapsed = Math.max(1, now - topbarOutputFpsState.lastSampleAt);
  const relayFps = topbarOutputFpsState.frames * 1000 / elapsed;
  const outputFps = outputFpsFromShellDetail(detail) || relayFps;
  const live = topbarOutputFpsState.lastFrameAt && now - topbarOutputFpsState.lastFrameAt < 1800;
  const nextValue = live ? String(Math.max(0, Math.round(outputFps))) : "--";
  const changed = nextValue !== topbarOutputFpsState.lastValue;
  topbarOutputFpsState.lastValue = nextValue;
  topbarOutputFpsState.frames = 0;
  topbarOutputFpsState.lastSampleAt = now;

  const domGapMs = activeView === DEFAULT_VIEW ? UI_TOPBAR_FPS_DOM_MS : UI_TOPBAR_FPS_SECONDARY_DOM_MS;
  if (!changed && now - topbarOutputFpsState.lastDomWriteAt < domGapMs) {
    topbarOutputFpsState.domWriteSkipped += 1;
    shellTelemetryBudget37BS.topbarDomSkipped += 1;
    updateShellTelemetryBudgetDebug37BS();
    return;
  }
  if (now - topbarOutputFpsState.lastDomWriteAt < domGapMs) {
    topbarOutputFpsState.domWriteSkipped += 1;
    shellTelemetryBudget37BS.topbarDomSkipped += 1;
    updateShellTelemetryBudgetDebug37BS();
    return;
  }

  try {
    const doc = uiFrame?.contentDocument;
    const fpsNode = doc?.getElementById?.("fpsValue");
    if (fpsNode) {
      fpsNode.textContent = topbarOutputFpsState.lastValue;
      fpsNode.title = `Real output FPS from runner telemetry: ${topbarOutputFpsState.lastValue}`;
    }
    const card = fpsNode?.closest?.(".status-card");
    card?.classList.toggle("is-live", live);
    topbarOutputFpsState.lastDomWriteAt = now;
    shellTelemetryBudget37BS.topbarDomWrites += 1;
    updateShellTelemetryBudgetDebug37BS();
  } catch {
    // iframe can be temporarily unavailable during navigation; next telemetry tick will retry.
  }
}


function activateShellViewFromSrc(src) {
  const nextView = normalizeView(extractViewName(src), DEFAULT_VIEW);
  activateUiFrame(nextView);
}

function activateUiFrame(nextView, options = {}) {
  const viewName = normalizeView(nextView, DEFAULT_VIEW);
  if (!viewName) return null;
  const now = performance.now();
  const wasCached = uiFramesByView.has(viewName);
  const frame = getOrCreateUiFrame(viewName);
  const previousFrame = activeUiFrame;
  activeUiFrame = frame;
  activeView = viewName;
  saveView(viewName);

  for (const [cachedView, cachedFrame] of uiFramesByView.entries()) {
    const isActive = cachedView === viewName;
    cachedFrame.classList.toggle("is-hidden", !isActive);
    cachedFrame.setAttribute("aria-hidden", isActive ? "false" : "true");
    cachedFrame.tabIndex = isActive ? 0 : -1;
  }

  notifyUiFramesActive(viewName);
  installChildNavigationGuard();
  setStatus(`VIEW ${viewName.toUpperCase()}`);

  if (!options.initial && wasCached && frame === previousFrame) {
    if (navPerf && !navPerf.uiLoadAt) navPerf.uiLoadAt = now;
    if (navPerf && !navPerf.uiReadyAt) navPerf.uiReadyAt = now;
    updateShellNavPerfPanel("CACHED");
    scheduleShellNavPerfHide();
    return frame;
  }

  if (!options.initial && wasCached) {
    uiLoaded = true;
    uiReady = true;
    if (navPerf) {
      if (!navPerf.uiLoadAt) navPerf.uiLoadAt = now;
      if (!navPerf.uiReadyAt) navPerf.uiReadyAt = now;
    }
    recordBootEvent("ui", "iframe-cache-hit", viewName);
    updateShellNavPerfPanel("CACHED");
    scheduleShellNavPerfHide();
    maybeShowUi();
    return frame;
  }

  if (!frame.getAttribute("src")) {
    frame.src = withShellView(viewName);
  }
  return frame;
}

function getOrCreateUiFrame(viewName) {
  const normalized = normalizeView(viewName, DEFAULT_VIEW);
  const cached = uiFramesByView.get(normalized);
  if (cached) return cached;
  let frame = null;
  if (!uiFramesByView.size && activeUiFrame && !activeUiFrame.getAttribute("src")) {
    frame = activeUiFrame;
  } else {
    frame = document.createElement("iframe");
    frame.className = "ui is-hidden";
    frame.title = `LED UI shell - ${normalized}`;
    frame.setAttribute("aria-hidden", "true");
    frame.tabIndex = -1;
    uiFrameStack?.appendChild(frame);
  }
  frame.dataset.view = normalized;
  frame.id = normalized === DEFAULT_VIEW ? "uiFrame" : `uiFrame-${normalized.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
  attachUiFrameLoadHandler(frame);
  uiFramesByView.set(normalized, frame);
  return frame;
}

function attachUiFrameLoadHandler(frame) {
  if (!frame || frame.__ledShellLoadHandlerInstalled) return;
  frame.__ledShellLoadHandlerInstalled = true;
  frame.addEventListener("load", () => handleUiFrameLoad(frame));
}

function handleUiFrameLoad(frame) {
  const isActiveFrame = frame === activeUiFrame;
  let path = frame.dataset.view || DEFAULT_VIEW;
  try {
    path = frame.contentWindow?.location?.pathname?.split("/").pop() || path;
  } catch {
    recordBootEvent("ui", "iframe-location-unavailable");
  }
  if (isView(path)) {
    frame.dataset.view = path;
    if (!uiFramesByView.has(path)) uiFramesByView.set(path, frame);
  }

  recordBootEvent("ui", isActiveFrame ? "iframe-load" : "iframe-preload-load", frame.src);
  if (!isActiveFrame) {
    return;
  }

  uiLoaded = true;
  if (navPerf) navPerf.uiLoadAt = performance.now();
  updateShellNavPerfPanel("LOADED");
  uiTelemetryQuietUntil = performance.now() + UI_NAV_QUIET_MS;
  armBootGuard();
  if (isView(path)) {
    activeView = path;
    saveView(path);
    setStatus(`VIEW ${path.toUpperCase()}`);
  }
  installChildNavigationGuard();
  notifyUiFramesActive(activeView);
  updateBootDiag();
}

function notifyUiFramesActive(currentView) {
  for (const [viewName, frame] of uiFramesByView.entries()) {
    try {
      frame.contentWindow?.postMessage({
        type: "led-shell-view-active",
        active: viewName === currentView,
        view: viewName,
        currentView
      }, "*");
    } catch {
      // inactive/cold iframe; safe to ignore
    }
  }
}

function outputFpsFromShellDetail(detail) {
  const perf = detail?.perf || {};
  const outputTickFps = Number(perf.outputTickFps || detail?.outputTickFps || 0);
  if (Number.isFinite(outputTickFps) && outputTickFps > 0) return outputTickFps;
  const serialFps = Number(detail?.serialFps || detail?.serialSettings?.fps || 0);
  if (detail?.serial === true && Number.isFinite(serialFps) && serialFps > 0) return serialFps;
  const targetFps = Number(detail?.targetFps || 0);
  if (Number.isFinite(targetFps) && targetFps > 0) return targetFps;
  return 0;
}

window.__ledShellBoot = {
  get view() { return activeView; },
  get state() {
    return {
      view: activeView,
      cachedViews: Array.from(uiFramesByView.keys()),
      uiReady,
      runnerReady,
      uiLoaded,
      runnerLoaded,
      bootGuardActive: Boolean(bootGuardTimer),
      bootLoadTimerActive: Boolean(bootLoadTimer),
      bootHardTimerActive: Boolean(bootHardTimer),
      bootGuardStartedAt,
      bootFinishedAt,
      bootDegraded,
      degradedReasons: degradedReasons.slice(),
      runnerWatchdog: {
        reloadCount: runnerReloadCount,
        lastReloadAt: runnerLastReloadAt,
        lastReloadReason: runnerLastReloadReason,
        lastSignalAt: lastRunnerSignalAt,
        lastHeartbeatAt: lastRunnerHeartbeatAt,
        lastFrameAt: lastRunnerFrameAt,
        lastReadyAt: lastRunnerReadyAt,
        lastHeartbeatDetail: lastRunnerHeartbeatDetail
      },
      shellNavPerf: navPerf ? attachShellNavPerf({}).shellNavPerf : null,
      elapsedMs: Math.round((bootFinishedAt || performance.now()) - bootStartedAt),
      log: bootDiag.slice()
    };
  }
};

activateUiFrame(activeView, { initial: true });
reloadRunnerFrameSource("boot");
setLoading(4, "Starting shell");
setStatus("RUNNER BOOT");
recordBootEvent("shell", "boot", `view=${activeView}`);
updateBootDiag();

runnerFrame.addEventListener("load", () => {
  runnerLoaded = true;
  touchRunnerSignal();
  recordBootEvent("runner", "iframe-load", runnerFrame.src);
  armBootGuard();
  updateBootDiag();
});

armBootGuard();
armLoadTimeout();
startRunnerWatchdog();

window.addEventListener("message", (event) => {
  if (event.source === uiFrame.contentWindow && event.data?.type === "led-shell-quit") {
    setLoading(100, "Ukončuji aplikaci");
    try { navigator.sendBeacon?.("/api/device/quit", new Blob(["{}"], { type: "application/json" })); } catch {}
    void fetch("/api/device/quit", { method: "POST", body: "{}", keepalive: true, headers: { "Content-Type": "application/json" } }).catch(() => {});
    window.setTimeout(() => { try { window.close(); } catch {} }, 160);
    return;
  }
  if (event.source === uiFrame.contentWindow && event.data?.type === "led-preview-frame") {
    if (navPerf && !navPerf.firstPreviewAt) {
      navPerf.firstPreviewAt = performance.now();
      updateShellNavPerfPanel("PREVIEW");
    }
    return;
  }
  const classification = classifyShellMessage({
    source: event.source,
    data: event.data,
    uiWindow: uiFrame.contentWindow,
    runnerWindow: runnerFrame.contentWindow
  });

  if (classification.origin === "ui") {
    if (classification.action === SHELL_MESSAGE_ACTIONS.UI_NAVIGATE) {
      navigateToView(classification.view);
      return;
    }
    if (classification.action === SHELL_MESSAGE_ACTIONS.UI_LOADING) {
      const detail = classification.detail || {};
      recordBootEvent("ui", "loading", `${detail.percent || 0}% ${detail.label || ""}`.trim());
      if (bootFinishedAt) return;
      setLoading(Math.min(96, detail.percent || 0), detail.label || "Caching UI");
      setStatus(`UI LOAD ${detail.percent || 0}%`);
      updateBootDiag();
      return;
    }
    if (classification.action === SHELL_MESSAGE_ACTIONS.UI_READY) {
      uiReady = true;
      if (navPerf) navPerf.uiReadyAt = performance.now();
      updateShellNavPerfPanel("READY");
      scheduleShellNavPerfHide();
      recordBootEvent("ui", "ready", formatReadyDetail(classification.detail));
      updateBootDiag();
      maybeShowUi();
      return;
    }
    if (classification.action !== SHELL_MESSAGE_ACTIONS.UI_RELAY_TO_RUNNER) return;
    try {
      runnerFrame.contentWindow?.postMessage(classification.message, "*");
    } catch {
      recordBootEvent("shell", "relay-failed", classification.message.type);
    }
    return;
  }

  if (classification.origin !== "runner") return;
  if (classification.action === SHELL_MESSAGE_ACTIONS.RUNNER_LOADING) {
    touchRunnerSignal();
    const detail = classification.detail || {};
    runnerLoadingActive = true;
    if (!runnerLoadingStartedAt) runnerLoadingStartedAt = performance.now();
    recordBootEvent("runner", "loading", `${detail.percent || 0}% ${detail.label || ""}`.trim());
    setLoading(Math.min(96, detail.percent || 0), detail.label || "Compiling");
    setStatus(`RUNNER LOAD ${detail.percent || 0}%`);
    updateBootDiag();
    return;
  }
  if (classification.action === SHELL_MESSAGE_ACTIONS.RUNNER_READY) {
    touchRunnerSignal();
    runnerReady = true;
    runnerLoadingActive = false;
    runnerLoadingStartedAt = 0;
    lastRunnerReadyAt = performance.now();
    recordBootEvent("runner", "ready", formatReadyDetail(classification.detail));
    updateBootDiag();
    maybeShowUi();
    return;
  }
  if (classification.action === SHELL_MESSAGE_ACTIONS.RUNNER_HEARTBEAT) {
    touchRunnerSignal();
    lastRunnerHeartbeatAt = performance.now();
    lastRunnerHeartbeatDetail = classification.detail || null;
    return;
  }
  if (classification.action === SHELL_MESSAGE_ACTIONS.RUNNER_OUTPUT_FRAME) {
    const now = performance.now();
    touchRunnerSignal(now);
    lastRunnerFrameAt = now;
    if (navPerf) {
      if (!navPerf.firstRunnerRelayAt) navPerf.firstRunnerRelayAt = now;
      navPerf.lastRunnerRelayAt = now;
      updateShellNavPerfPanel("OUTPUT");
    }
    const detail = attachShellNavPerf(classification.detail);
    updateUiTopbarOutputFps(detail);
    window.dispatchEvent(new CustomEvent("led-output-frame", { detail }));
    shellTelemetryBudget37BS.runnerFrames += 1;
    const activeMinIntervalMs = activeViewTelemetryIntervalMs37BS();
    shellTelemetryBudget37BS.currentMinIntervalMs = activeMinIntervalMs;
    const relayDecision = evaluateShellTelemetryRelay({
      now,
      quietUntil: uiTelemetryQuietUntil,
      lastRelayAt: lastUiTelemetryRelayAt,
      minIntervalMs: activeMinIntervalMs
    });
    lastUiTelemetryRelayAt = relayDecision.lastRelayAt;
    if (!relayDecision.relay) {
      shellTelemetryBudget37BS.skippedRelay += 1;
      shellTelemetryBudget37BS.skippedReason = relayDecision.reason || "skip";
      updateShellTelemetryBudgetDebug37BS({ lastDecision: relayDecision.reason || "skip" });
      return;
    }
    try {
      uiFrame.contentWindow?.postMessage({ ...event.data, detail }, "*");
      shellTelemetryBudget37BS.relayedToUi += 1;
      shellTelemetryBudget37BS.lastRelayAt = now;
      shellTelemetryBudget37BS.lastRelayView = activeView;
      shellTelemetryBudget37BS.skippedReason = "";
      updateShellTelemetryBudgetDebug37BS({ lastDecision: "relay" });
    } catch {
      recordBootEvent("shell", "relay-failed", "led-output-frame");
    }
  }
});


function startShellNavPerfRefresh() {
  if (navPerfRefreshTimer) clearManaged37CE(navPerfRefreshTimer);
  navPerfRefreshTimer = managedInterval37CE('nav-perf-refresh', () => {
    if (!navPerf) {
      clearManaged37CE(navPerfRefreshTimer);
      navPerfRefreshTimer = 0;
      return;
    }
    updateShellNavPerfPanel();
  }, 120, { liveFactor: 2.5, hiddenFactor: 4, maxMs: 1500 });
}

function scheduleShellNavPerfHide() {
  if (navPerfHideTimer) clearManaged37CE(navPerfHideTimer);
  navPerfHideTimer = managedTimeout37CE('nav-perf-hide', () => {
    shellNavPerfPanel?.classList.remove("is-visible");
    if (navPerfRefreshTimer) {
      clearManaged37CE(navPerfRefreshTimer);
      navPerfRefreshTimer = 0;
    }
  }, 3200, { liveFactor: 1.2, hiddenFactor: 1, maxMs: 5000 });
}

function updateShellNavPerfPanel(stateLabel = "") {
  if (!shellNavPerfPanel || !navPerf) return;
  const now = performance.now();
  const since = (value) => value ? `${Math.max(0, Math.round(value - navPerf.startedAt))} ms` : "—";
  const elapsed = `${Math.max(0, Math.round(now - navPerf.startedAt))} ms`;
  shellNavPerfPanel.classList.add("is-visible");
  if (shellNavPerfState) shellNavPerfState.textContent = stateLabel || (navPerf.uiReadyAt ? "READY" : navPerf.uiLoadAt ? "LOADED" : "NAV");
  if (shellNavPerfRoute) shellNavPerfRoute.textContent = `${navPerf.current || "?"} → ${navPerf.nextView || "?"}`;
  if (shellNavPerfElapsed) shellNavPerfElapsed.textContent = elapsed;
  if (shellNavPerfLoad) shellNavPerfLoad.textContent = since(navPerf.uiLoadAt);
  if (shellNavPerfReady) shellNavPerfReady.textContent = since(navPerf.uiReadyAt);
  if (shellNavPerfOutput) shellNavPerfOutput.textContent = navPerf.firstRunnerRelayAt
    ? `${since(navPerf.firstRunnerRelayAt)} first / ${since(navPerf.lastRunnerRelayAt)} last`
    : "—";
  if (shellNavPerfPreview) shellNavPerfPreview.textContent = since(navPerf.firstPreviewAt);
}

function attachShellNavPerf(detail) {
  if (!navPerf) return detail;
  const now = performance.now();
  const since = (value) => value ? Math.max(0, Math.round(value - navPerf.startedAt)) : 0;
  return {
    ...(detail || {}),
    shellNavPerf: {
      current: navPerf.current || "",
      nextView: navPerf.nextView || "",
      elapsedMs: Math.max(0, Math.round(now - navPerf.startedAt)),
      uiLoadMs: since(navPerf.uiLoadAt),
      uiReadyMs: since(navPerf.uiReadyAt),
      firstPreviewMs: since(navPerf.firstPreviewAt),
      firstOutputRelayMs: since(navPerf.firstRunnerRelayAt),
      lastOutputRelayMs: since(navPerf.lastRunnerRelayAt),
      quietRemainingMs: Math.max(0, Math.round(uiTelemetryQuietUntil - now))
    }
  };
}

function reloadRunnerFrameSource(reason = "manual") {
  runnerFrameNonce += 1;
  runnerFrame.src = `output-runner.html?rev=${runnerFrameNonce}`;
  runnerLastReloadReason = reason;
}

function touchRunnerSignal(now = performance.now()) {
  lastRunnerSignalAt = now;
}

function startRunnerWatchdog() {
  if (runnerWatchdogTimer) return;
  runnerWatchdogTimer = managedInterval37CE('runner-watchdog', () => {
    checkRunnerWatchdog();
  }, RUNNER_WATCHDOG_POLL_MS, { critical: true, liveFactor: 1.25, hiddenFactor: 1.5, maxMs: 3500 });
}

function checkRunnerWatchdog() {
  if (!runnerFrame) return;
  const now = performance.now();
  if (runnerLastReloadAt && now - runnerLastReloadAt < RUNNER_RELOAD_COOLDOWN_MS) return;

  const heartbeatSilenceMs = lastRunnerHeartbeatAt > 0 ? now - lastRunnerHeartbeatAt : Number.POSITIVE_INFINITY;
  const frameSilenceMs = lastRunnerFrameAt > 0 ? now - lastRunnerFrameAt : Number.POSITIVE_INFINITY;
  const sinceRunnerReadyMs = lastRunnerReadyAt > 0 ? now - lastRunnerReadyAt : Number.POSITIVE_INFINITY;

  if (runnerReady && heartbeatSilenceMs > RUNNER_HEARTBEAT_TIMEOUT_MS) {
    recoverRunner("heartbeat-timeout");
    return;
  }

  if (runnerReady && lastRunnerFrameAt > 0 && frameSilenceMs > RUNNER_FRAME_STALL_MS) {
    recoverRunner("frame-stall");
    return;
  }

  if (runnerReady && lastRunnerFrameAt <= 0 && sinceRunnerReadyMs > RUNNER_FIRST_FRAME_GRACE_MS) {
    recoverRunner("first-frame-timeout");
    return;
  }

  const reportedFrameAgeMs = Number(lastRunnerHeartbeatDetail?.lastFrameAgeMs || 0);
  if (runnerReady && reportedFrameAgeMs > RUNNER_FRAME_STALL_MS) {
    recoverRunner("heartbeat-frame-stale");
  }
}

function recoverRunner(reason) {
  runnerReloadCount += 1;
  runnerLastReloadAt = performance.now();
  runnerReady = false;
  runnerLoaded = false;
  lastRunnerHeartbeatAt = 0;
  lastRunnerFrameAt = 0;
  lastRunnerReadyAt = 0;
  lastRunnerHeartbeatDetail = null;
  recordBootEvent("runner", "reload", reason);
  setStatus("RUNNER RECOVER");
  updateBootDiag();
  reloadRunnerFrameSource(reason);
}

function setStatus(text) {
  if (shellStatus) shellStatus.textContent = text;
  updateBootDiag();
}

function setLoading(percent, label) {
  const value = Math.max(4, Math.min(100, Math.round(Number(percent) || 0)));
  if (bootFill) bootFill.style.width = `${value}%`;
  if (bootLabel) bootLabel.textContent = label || "Loading";
}

function armBootGuard() {
  if (bootFinishedAt || bootGuardTimer) return;
  bootGuardStartedAt = performance.now();
  recordBootEvent("shell", "guard-armed", `${BOOT_GUARD_MS}ms`);
  bootGuardTimer = managedTimeout37CE('boot-guard', () => {
    bootGuardTimer = null;
    const loadingFor = runnerLoadingStartedAt ? performance.now() - runnerLoadingStartedAt : 0;
    if (runnerLoadingActive && loadingFor < 120000) {
      recordBootEvent("shell", "guard-extended", `${Math.round(loadingFor)}ms`);
      armBootGuard();
      return;
    }
    fallbackLoadedButNotReady();
    updateBootDiag();
    maybeShowUi();
  }, BOOT_GUARD_MS, { critical: true, managed: false });
  updateBootDiag();
}

function armLoadTimeout() {
  if (bootFinishedAt || bootLoadTimer) return;
  bootLoadTimer = managedTimeout37CE('boot-load', () => {
    bootLoadTimer = null;
    const loadingFor = runnerLoadingStartedAt ? performance.now() - runnerLoadingStartedAt : 0;
    if (runnerLoadingActive && loadingFor < 120000) {
      recordBootEvent("shell", "load-timeout-extended", `${Math.round(loadingFor)}ms`);
      armLoadTimeout();
      return;
    }
    buildLoadTimeoutActions({ uiLoaded, runnerLoaded }, BOOT_LOAD_TIMEOUT_MS)
      .forEach(({ scope, event, detail }) => markDegraded(scope, event, detail));
    fallbackLoadedButNotReady();
    armHardTimeout();
    updateBootDiag();
    maybeShowUi();
  }, BOOT_LOAD_TIMEOUT_MS, { critical: true, managed: false });
}

function armHardTimeout() {
  if (bootFinishedAt || bootHardTimer) return;
  bootHardTimer = managedTimeout37CE('boot-hard', () => {
    applyReadyFallbackActions(buildHardReadyActions({ uiReady, runnerReady }, BOOT_HARD_TIMEOUT_MS));
    updateBootDiag();
    maybeShowUi();
  }, Math.max(0, BOOT_HARD_TIMEOUT_MS - BOOT_LOAD_TIMEOUT_MS));
}

function fallbackLoadedButNotReady() {
  applyReadyFallbackActions(buildLoadedFallbackActions({ uiReady, uiLoaded, runnerReady, runnerLoaded }));
}

function applyReadyFallbackActions(actions) {
  for (const action of actions) {
    if (action.readyKey === "uiReady") {
      uiReady = true;
    } else if (action.readyKey === "runnerReady") {
      runnerReady = true;
    }
    markDegraded(action.scope, action.event, action.detail);
    if (action.warning) {
      console.warn(action.warning);
    }
  }
}

function markDegraded(scope, event, detail = "") {
  bootDegraded = true;
  const reason = `${scope}:${event}`;
  if (!degradedReasons.includes(reason)) degradedReasons.push(reason);
  recordBootEvent(scope, event, detail);
}

function maybeShowUi() {
  if (runnerReady && uiReady && !bootFinishedAt) {
    if (bootGuardTimer) {
      window.clearTimeout(bootGuardTimer);
      bootGuardTimer = null;
    }
    if (bootLoadTimer) {
      window.clearTimeout(bootLoadTimer);
      bootLoadTimer = null;
    }
    if (bootHardTimer) {
      window.clearTimeout(bootHardTimer);
      bootHardTimer = null;
    }
    bootFinishedAt = performance.now();
    recordBootEvent("shell", bootDegraded ? "ready-degraded" : "ready", `${Math.round(bootFinishedAt - bootStartedAt)}ms`);
  }
  if (!runnerReady || !uiReady) {
    if (!runnerReady) setStatus("WAIT RUNNER");
    else setStatus("WAIT UI CACHE");
    updateBootDiag();
    return;
  }
  setLoading(100, bootDegraded ? "Ready / degraded" : "Ready");
  setStatus(bootDegraded ? `SAFE VIEW ${activeView.toUpperCase()}` : `VIEW ${activeView.toUpperCase()}`);
  updateBootDiag();
  managedTimeout37CE('body-loading-clear', () => document.body.classList.remove("is-loading"), 140, { managed: false });
}

function recordBootEvent(scope, event, detail = "") {
  const entry = {
    at: Math.round(performance.now() - bootStartedAt),
    scope,
    event,
    detail: String(detail || "").slice(0, 140)
  };
  bootDiag.push(entry);
  if (bootDiag.length > BOOT_DIAG_LIMIT) bootDiag.shift();
  console.debug?.(`[shell boot] ${entry.at}ms ${scope}:${event}${entry.detail ? ` ${entry.detail}` : ""}`);
}

function updateBootDiag() {
  if (bootDiagElapsed) {
    const elapsed = Math.round((bootFinishedAt || performance.now()) - bootStartedAt);
    bootDiagElapsed.textContent = `${elapsed} ms`;
  }
  if (bootDiagShell) {
    const guard = bootGuardTimer ? "guard on" : "guard off";
    const degraded = bootDegraded ? " / degraded" : "";
    bootDiagShell.textContent = bootFinishedAt ? `ready ${Math.round(bootFinishedAt - bootStartedAt)}ms${degraded}` : guard;
  }
  if (bootDiagUi) {
    bootDiagUi.textContent = formatBootScopeStatus({ ready: uiReady, loaded: uiLoaded, bootDegraded, degradedReasons, scope: "ui" });
  }
  if (bootDiagRunner) {
    bootDiagRunner.textContent = formatBootScopeStatus({ ready: runnerReady, loaded: runnerLoaded, bootDegraded, degradedReasons, scope: "runner" });
  }
  if (bootDiagLog) {
    bootDiagLog.innerHTML = renderBootDiagLog(bootDiag);
  }
}
