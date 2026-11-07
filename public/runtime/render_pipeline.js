import { getRuntimeFrameBus } from "./frame_bus.js";
import { FRAME_CONSUMERS, FRAME_PRODUCERS, getRuntimeFrameAuthority } from "./frame_authority.js";
import { OUTPUT_RENDER_DECISIONS, evaluateOutputRenderPolicy } from "./frame_authority_policy.js";
import { initPreview3dFrameBridge } from "./preview3d_frame_bridge.js";
import { createNextEngineShadowAdapter } from "./next_engine_adapter.js";
import { createOutputClockAuthority } from "./output_clock_authority.js";

const NO_FX_STATE = Object.freeze({ mode: "none", amount: 0, rate: 0.5, flash: false, hold: false });
const DEFAULT_TELEMETRY_STATS_MS = 250;
const DEFAULT_METRICS_EMIT_MS = 200;

export function createRenderPipeline(deps) {
  // STEP 2C: render loop publishes composed frames; output consumes the
  // latest stable frame bus packet instead of rendering independently.
  const frameBus = getRuntimeFrameBus();
  const frameAuthority = getRuntimeFrameAuthority();
  let nextEngineShadowAdapter = null;
  initPreview3dFrameBridge(frameAuthority);
  const {
    windowRef,
    documentRef,
    targetFrameMs,
    previewTargetFrameMs,
    getTargetFrameMs,
    getPreviewTargetFrameMs,
    getRenderSchedulerNextAt,
    setRenderSchedulerNextAt,
    getLastOutputFrameAt,
    setLastOutputFrameAt,
    getForceCpuPreviewUntil,
    getPreviewMode,
    getShaderPreviewFps,
    isSerialPipelineEnabled,
    createGpuScene,
    resizeShaderPreviewCanvas,
    shaderPreviewRenderer,
    previewRenderer,
    headless = false,
    shellViewOnly = false,
    getDimensions,
    isOutputEnabled,
    shouldRefreshPreviewFrame,
    renderPixelColor,
    enqueueOutputFrame,
    reportOutputFrame,
    drawLayerRawPreview,
    getBeatPosition,
    setRenderTime,
    updateStartupOverlayHealth,
    getLastPreviewRenderer,
    setLastPreviewRenderer,
    schedulerDebugState,
    applySingleFx,
    beginFrameComposition,
    blend,
    applyOutputCorrection,
    getState,
    getTransitions,
    onGpuDrawFailed,
    onMetrics,
    runtimeProfile = globalThis.RUNTIME_PROFILE || {}
  } = deps;

  function runtimeLoopRegistry37CF() {
    try { return windowRef.__budilightRuntimeLoopRegistry37CE || windowRef.__budilightRuntimeLoopRegistry37CF || null; } catch { return null; }
  }
  function managedPreviewTimeout37CF(name, fn, delayMs, opts = {}) {
    const reg = runtimeLoopRegistry37CF();
    if (reg?.timeout) return reg.timeout(name, fn, delayMs, { group: 'render-preview', liveFactor: 2, hiddenFactor: 4, maxMs: 1800, ...opts });
    return windowRef.setTimeout(fn, Math.max(0, Math.round(Number(delayMs) || 0)));
  }
  function clearPreviewTimer37CF(id) {
    if (!id) return;
    const reg = runtimeLoopRegistry37CF();
    if (typeof id === 'string' && reg?.clear) { try { reg.clear(id); return; } catch {} }
    try { windowRef.clearTimeout(id); } catch {}
  }
  let drawTimerId = 0;
  let outputTimerId = 0;
  let outputNextAt = 0;
  let lastPreviewFrameAt = 0;
  let backgroundDrawWorker = null;
  let backgroundDrawWorkerArmed = false;
  let backgroundOutputWorker = null;
  let backgroundOutputWorkerArmed = false;
  let cpuFrameBufferPool = [null, null];
  let cpuFrameBufferSize = 0;
  let cpuFrameBufferIndex = 0;
  let latestComposedFrame = null;
  let latestComposedFrameSize = 0;
  let lastShaderPreviewAt = 0;
  let lastShellPreviewReportAt = 0;
  let lastShellMonitorBlitAt = 0;
  let lastShellMonitorRenderAt = 0;
  let previewBudgetPressureUntil = 0;
  const shellPreviewQuietUntil = shellViewOnly ? performance.now() + 4200 : 0;
  const shellRawPreviewQuietUntil = shellViewOnly ? performance.now() + 6200 : 0;
  let lastShellRawPreviewAt = 0;
  const outputClock = createOutputClockAuthority({ performanceRef: performance, runtimeProfile });
  const telemetryStatsIntervalMs = Math.max(0, Number(runtimeProfile.telemetryStatsMs) || DEFAULT_TELEMETRY_STATS_MS);
  const metricsEmitIntervalMs = Math.max(0, Number(runtimeProfile.metricsEmitMs) || DEFAULT_METRICS_EMIT_MS);
  let lastFrameBusStatsAt = 0;
  let lastFrameAuthorityStatsAt = 0;
  let cachedFrameBusStats = null;
  let cachedFrameAuthorityStats = null;
  let lastRenderMetricsAt = 0;
  let lastOutputMetricsAt = 0;
  let adaptiveSoftState = null;
  const shellViewActivity = windowRef.__ledShellViewActivity = windowRef.__ledShellViewActivity || {
    version: "37BI",
    active: !shellViewOnly,
    view: "",
    currentView: "",
    changedAt: performance.now(),
    skippedPreviewFrames: 0,
    lastSkipAt: 0,
    lastMessageAt: 0
  };
  if (shellViewOnly && typeof shellViewActivity.active !== "boolean") shellViewActivity.active = true;

  function isShellViewActive() {
    return !shellViewOnly || shellViewActivity.active !== false;
  }

  function shellInactivePreviewGapMs() {
    return Math.max(500, Number(runtimeProfile.shellInactivePreviewMs || 1200));
  }

  try {
    windowRef.addEventListener?.("message", (event) => {
      const message = event?.data;
      if (!message || typeof message !== "object" || message.type !== "led-shell-view-active") return;
      shellViewActivity.active = message.active !== false;
      shellViewActivity.view = String(message.view || "");
      shellViewActivity.currentView = String(message.currentView || "");
      shellViewActivity.changedAt = performance.now();
      shellViewActivity.lastMessageAt = shellViewActivity.changedAt;
      try {
        documentRef?.documentElement?.classList.toggle("shell-view-inactive", !shellViewActivity.active);
        documentRef?.body?.classList.toggle("shell-view-inactive", !shellViewActivity.active);
      } catch {}
      if (shellViewActivity.active && drawTimerId) {
        clearPreviewTimer37CF(drawTimerId);
        drawTimerId = 0;
        setRenderSchedulerNextAt(performance.now());
        scheduleNextDraw(performance.now());
      }
    });
  } catch {}

  // STEP37AN: cache operator-facing FPS/settings lookups. These helpers are
  // called from preview/output metadata paths; repeated localStorage + JSON.parse
  // during live output can create small GC spikes. Storage events invalidate the
  // cache, and a short TTL keeps manual console edits recoverable.
  let previewSettingsCacheAt = 0;
  let previewSettingsCache = null;
  let networkOutputRouteCacheAt = 0;
  let networkOutputRouteCache = null;
  let lastSerialConsumerDiagAt = 0;
  let lastOutputGateDiagAt = 0;
  let cachedOutputGateDetail = null;
  const DIAG_EVENT_MIN_MS = Math.max(250, Number(runtimeProfile.diagEventMinMs || 750));
  try {
    windowRef.addEventListener?.("storage", (event) => {
      const key = String(event?.key || "");
      if (!key
        || key === "led-engine-settings-v1"
        || key === "budilightArtNetMasterMirror22EJ"
        || key === "budilightOutputPriorityPreview37AR"
        || key === "budilightOutputPriorityPreviewFps37AR"
        || key.includes("Preview") || key.includes("preview") || key.includes("Monitor") || key.includes("monitor")) {
        previewSettingsCacheAt = 0;
        previewSettingsCache = null;
        networkOutputRouteCacheAt = 0;
        networkOutputRouteCache = null;
      }
    });
  } catch {}

  function readPreviewSettingsCache(now = performance.now()) {
    if (previewSettingsCache && now - previewSettingsCacheAt < 2000) return previewSettingsCache;
    let parsedSettings = null;
    try {
      const rawSettings = globalThis.localStorage?.getItem?.("led-engine-settings-v1");
      parsedSettings = rawSettings ? JSON.parse(rawSettings) : null;
    } catch {
      parsedSettings = null;
    }
    function readNumberKey(key, fallback = 0) {
      try {
        const raw = globalThis.localStorage?.getItem?.(key);
        const n = Number(raw);
        return Number.isFinite(n) ? n : fallback;
      } catch {
        return fallback;
      }
    }
    previewSettingsCache = {
      previewFps: Number(parsedSettings?.previewFps || 0),
      layerPreviewFps: Number(parsedSettings?.layerPreviewFps || 0),
      livePreviewFpsCap: readNumberKey("budilightLivePreviewFpsCap", readNumberKey("budilightShellLivePreviewFpsCap", Number(runtimeProfile.livePreviewFpsCap || 0))),
      shellLiveMonitorRenderFps: readNumberKey("budilightShellLiveMonitorRenderFps", 0),
      shellLiveCanvasMonitorFps: readNumberKey("budilightShellLiveCanvasMonitorFps", 0),
      shellLiveRawPreviewGapMs: readNumberKey("budilightShellLiveRawPreviewGapMs", readNumberKey("budilightLiveRawPreviewGapMs", 0)),
      // STEP37AV: these flags are read inside the live render/output scheduler.
      // Keep them in the same short-lived cache as the preview settings instead
      // of touching localStorage from every output/preview decision.
      outputPriorityPreviewFps: readNumberKey("budilightOutputPriorityPreviewFps37AR", 24),
      outputPriorityPreviewEnabled: (() => { try { return globalThis.localStorage?.getItem?.("budilightOutputPriorityPreview37AR") !== "0"; } catch { return true; } })(),
      artnetMasterMirrorEnabled: (() => { try { return globalThis.localStorage?.getItem?.("budilightArtNetMasterMirror22EJ") !== "0"; } catch { return true; } })(),
      shellCanvasMonitorEnabled: (() => { try { return globalThis.localStorage?.getItem?.("budilightShellLiveCanvasMonitor22OF") === "1"; } catch { return false; } })(),
      shellRawPreviewEnabled: (() => { try { return globalThis.localStorage?.getItem?.("budilightShellLiveRawPreviewMonitor") !== "0"; } catch { return true; } })()
    };
    previewSettingsCacheAt = now;
    return previewSettingsCache;
  }

  try {
    windowRef.addEventListener?.("led-adaptive-soft-state", (event) => {
      adaptiveSoftState = event?.detail || null;
      schedulerDebugState.adaptiveSoft = adaptiveSoftState;
    });
  } catch {
    adaptiveSoftState = null;
  }

  function isNetworkOutputClockRoute() {
    const now = performance.now();
    if (networkOutputRouteCache != null && now - networkOutputRouteCacheAt < 250) return networkOutputRouteCache;
    let result = true;
    try {
      const st = typeof getState === "function" ? getState() : null;
      const mode = String(st?.outputMode || st?.runtimeOutputMode || st?.settings?.outputMode || "").toLowerCase();
      if (["artnet", "sacn", "wifi", "network", "espnow"].includes(mode)) result = true;
      else if (mode) result = false;
    } catch {}
    if (result) try {
      // ArtNet master mirror is the current Performance -> server -> UDP route.
      // STEP37AV: use the cached runtime flag instead of a localStorage read in
      // the hot scheduler path. The cache is invalidated by storage events and
      // refreshed every ~2 seconds as a safety net.
      result = readPreviewSettingsCache().artnetMasterMirrorEnabled !== false;
    } catch {
      result = true;
    }
    networkOutputRouteCacheAt = now;
    networkOutputRouteCache = result;
    return result;
  }

  function workerPreferred() {
    if (headless || documentRef.hidden) return true;
    // STEP22NW: keep the physical ArtNet/network clock off the busy UI timer
    // queue even while the Performance screen is visible. The callback still
    // runs on the main thread, but the cadence is armed from a Worker so heavy
    // canvas/debug/layout work is less likely to stretch the transport to
    // ~25 FPS. Serial can opt into its own conservative timing elsewhere.
    try {
      if (Boolean(isOutputEnabled?.())
        && isNetworkOutputClockRoute()
        && runtimeProfile.outputClockWorkerDuringLive !== false) return true;
    } catch {}
    return false;
  }

  function currentTargetFrameMs() {
    const baseMs = Math.max(1, Number(getTargetFrameMs?.() || targetFrameMs || 16.67));
    // STEP22NV: hard output-clock guard for ArtNet/network routes.
    // If live output is ON but the serial pipeline is not the active route, the
    // physical output must not inherit any preview/safe-profile cadence. Several
    // old profiles can still feed 25/30 FPS into getTargetFrameMs(), which makes
    // the debug UI show mixed FPS values while the real ArtNet stream steps.
    // Network output is cheap enough for 60 FPS; keep UI/preview throttles separate.
    try {
      if (Boolean(isOutputEnabled?.()) && isNetworkOutputClockRoute()) {
        const forcedMs = 1000 / 60;
        return Math.max(1, Math.min(baseMs, forcedMs));
      }
    } catch {}
    return baseMs;
  }


  function livePreviewFpsCap(fallback = 30) {
    const cached = readPreviewSettingsCache();
    const stored = Number(cached.previewFps || 0);
    if (Number.isFinite(stored) && stored > 0) return Math.max(1, Math.min(60, Math.round(stored)));
    const cap = Number(cached.livePreviewFpsCap || runtimeProfile.livePreviewFpsCap || fallback);
    return Math.max(1, Math.min(60, Math.round(Number.isFinite(cap) && cap > 0 ? cap : fallback)));
  }

  function isOutputLockActive() {
    try {
      const lock = globalThis.__budilightOutputLock37AP;
      return lock?.active === true && String(lock.owner || "") !== "";
    } catch { return false; }
  }

  function readOutputPriorityPreviewFps(fallback = 24) {
    const cached = readPreviewSettingsCache();
    const raw = Number(cached.outputPriorityPreviewFps || globalThis?.localStorage?.getItem?.('budilightOutputPriorityPreviewFps37AR') || fallback);
    const safe = Number.isFinite(raw) && raw > 0 ? raw : fallback;
    return Math.max(18, Math.min(30, Math.round(safe)));
  }

  function outputPriorityPreviewActive() {
    try {
      return Boolean(isPhysicalOutputActive()) && isOutputLockActive()
        && readPreviewSettingsCache().outputPriorityPreviewEnabled !== false;
    } catch { return false; }
  }

  function currentPreviewFrameMs() {
    // STEP22OB: the hidden output-runner has no operator-facing preview.
    // Its output loop renders/publishes fresh frames; the preview loop is only
    // bookkeeping and must not compete for CPU/DOM/canvas time.
    try {
      if (headless && Boolean(isOutputEnabled?.())) return 500;
    } catch {}
    const softPreviewFps = Number(adaptiveSoftState?.recommendations?.previewFps || 0);
    if (adaptiveSoftState?.active && softPreviewFps > 0) {
      return 1000 / Math.max(1, softPreviewFps);
    }
    const base = Math.max(1, Number(getPreviewTargetFrameMs?.() || getTargetFrameMs?.() || previewTargetFrameMs || targetFrameMs || 16.67));
    // STEP22MD: když běží fyzický výstup, preview je jen monitor/consumer.
    // Nemá smysl kreslit canvas 60 FPS a brát čas ArtNet fast-pathu.
    // Výstupový render zůstává na svém FPS; škrtíme pouze viditelný náhled.
    try {
      if (outputPriorityPreviewActive()) {
        // STEP37AR: physical output owns timing. Visible preview remains useful,
        // but it must never inherit a 30/60 FPS UI cap while ArtNet/Serial is
        // the performance-critical path. Default monitor cap is 24 FPS and can
        // be overridden by budilightOutputPriorityPreviewFps37AR / settings.
        const capFps = readOutputPriorityPreviewFps(24);
        schedulerDebugState.previewOutputPriority = true;
        schedulerDebugState.previewOutputPriorityFps = capFps;
        return 1000 / capFps;
      }
      if (isPhysicalOutputActive() && shellViewOnly) {
        // STEP37DZ: Main Performance preview FPS is operator-configurable again.
        // Older live-output guard forced this monitor preview down to max 15 FPS,
        // so Settings > PREVIEW FPS appeared to do nothing during ArtNet/Serial output.
        // Output priority mode can still use its own safety cap above; otherwise obey Settings.
        const capFps = livePreviewFpsCap(Number(runtimeProfile.previewFps || 30));
        return 1000 / capFps;
      }
      if (isLiveOutputClockActive()) {
        const capFps = livePreviewFpsCap(Number(runtimeProfile.previewFps || 30));
        return 1000 / capFps;
      }
    } catch {}
    return base;
  }

  function getNextEngineShadowAdapter() {
    if (nextEngineShadowAdapter) return nextEngineShadowAdapter;
    try {
      nextEngineShadowAdapter = createNextEngineShadowAdapter({ frameAuthority, onMetrics });
    } catch (error) {
      console.warn("next engine shadow adapter unavailable", error);
      nextEngineShadowAdapter = Object.freeze({
        observeAuthoritativeFrame: () => null,
        getStatus: () => Object.freeze({
          version: "10B-next-engine-shadow-adapter",
          enabled: false,
          mode: "shadow-readonly",
          lastError: String(error?.message || error)
        })
      });
    }
    return nextEngineShadowAdapter;
  }

  function markPreviewConsumer(reason = "preview-draw", packet = null) {
    const latest = packet || frameBus.peekLatestFrame?.() || frameBus.getLatestFrame?.({ consumer: "preview-consumer", reason });
    const stats = frameBus.markConsumerRead?.("preview-consumer", {
      reason,
      detail: {
        previewMode: getPreviewMode(),
        renderer: getLastPreviewRenderer?.() || "unknown",
        shellViewOnly,
        documentHidden: Boolean(documentRef.hidden)
      }
    });
    schedulerDebugState.previewConsumer = {
      step: "13BT-C",
      reason,
      frameId: Number(latest?.frameId || 0),
      ageMs: Number(stats?.lastAgeMs || 0),
      health: stats?.health || "NO_FRAME",
      renderer: getLastPreviewRenderer?.() || "unknown",
      previewMode: getPreviewMode(),
      reads: Number(stats?.reads || 0),
      skippedFrames: Number(stats?.skippedFrames || 0),
      duplicateReads: Number(stats?.duplicateReads || 0),
      updatedAt: performance.now()
    };
    return stats;
  }

  function markSerialConsumer(packet, reason = "serial-enqueue") {
    const stats = frameBus.markConsumerRead?.("serial-consumer", {
      reason,
      detail: {
        outputEnabled: Boolean(isOutputEnabled()),
        serialPipelineEnabled: Boolean(isSerialPipelineEnabled()),
        outputMode: String(getState?.()?.outputMode || "unknown"),
        documentHidden: Boolean(documentRef.hidden),
        source: String(packet?.source || "--")
      }
    });
    schedulerDebugState.serialConsumer = {
      step: "13BT-D",
      reason,
      frameId: Number(packet?.frameId || 0),
      source: String(packet?.source || "--"),
      ageMs: Number(stats?.lastAgeMs || 0),
      health: stats?.health || "NO_FRAME",
      reads: Number(stats?.reads || 0),
      skippedFrames: Number(stats?.skippedFrames || 0),
      duplicateReads: Number(stats?.duplicateReads || 0),
      byteLength: Number(packet?.byteLength || packet?.frame?.byteLength || 0),
      outputEnabled: Boolean(isOutputEnabled()),
      serialPipelineEnabled: Boolean(isSerialPipelineEnabled()),
      updatedAt: performance.now()
    };
    try {
      const diagNow = performance.now();
      globalThis.__ledSerialConsumerStats = schedulerDebugState.serialConsumer;
      if (diagNow - lastSerialConsumerDiagAt >= DIAG_EVENT_MIN_MS && shouldEmitLiveDiagEvent37AX()) {
        lastSerialConsumerDiagAt = diagNow;
        globalThis.dispatchEvent?.(new CustomEvent("led-serial-consumer-stats", { detail: schedulerDebugState.serialConsumer }));
      }
    } catch {
      // diagnostics only
    }
    return stats;
  }

  function updateOutputConsumerGateDiagnostics(packet, reason = "output-tick") {
    const diagNow = performance.now();
    if (cachedOutputGateDetail && diagNow - lastOutputGateDiagAt < DIAG_EVENT_MIN_MS) {
      cachedOutputGateDetail.reason = reason;
      cachedOutputGateDetail.frameId = Number(packet?.frameId || cachedOutputGateDetail.frameId || 0);
      cachedOutputGateDetail.frameAgeMs = packet?.timestamp ? Math.max(0, Math.round(diagNow - Number(packet.timestamp))) : Number(cachedOutputGateDetail.frameAgeMs || 0);
      cachedOutputGateDetail.frameSource = String(packet?.source || cachedOutputGateDetail.frameSource || "--");
      cachedOutputGateDetail.outputEnabled = Boolean(isOutputEnabled());
      cachedOutputGateDetail.serialPipelineEnabled = Boolean(isSerialPipelineEnabled());
      schedulerDebugState.outputConsumerGate = cachedOutputGateDetail;
      return cachedOutputGateDetail;
    }
    lastOutputGateDiagAt = diagNow;
    const stats = readFrameBusStats(diagNow);
    const gates = stats.gates || {};
    const gateStatus = String(gates.status || stats.health || "UNKNOWN");
    const serialStats = schedulerDebugState.serialConsumer || {};
    const detail = {
      step: "13BT-K",
      reason,
      gateStatus,
      gateOk: gates.ok === true,
      warningCount: Number(gates.warningCount || 0),
      errorCount: Number(gates.errorCount || 0),
      warnings: Array.isArray(gates.warnings) ? gates.warnings.slice(0, 6) : [],
      errors: Array.isArray(gates.errors) ? gates.errors.slice(0, 6) : [],
      frameId: Number(packet?.frameId || 0),
      frameAgeMs: packet?.timestamp ? Math.max(0, Math.round(performance.now() - Number(packet.timestamp))) : 0,
      frameSource: String(packet?.source || "--"),
      serialFrameId: Number(serialStats.frameId || 0),
      serialAgeMs: Number(serialStats.ageMs || 0),
      serialHealth: String(serialStats.health || "--"),
      outputEnabled: Boolean(isOutputEnabled()),
      serialPipelineEnabled: Boolean(isSerialPipelineEnabled()),
      observedAt: diagNow
    };
    cachedOutputGateDetail = detail;
    schedulerDebugState.outputConsumerGate = detail;
    try {
      globalThis.__ledOutputConsumerGate = detail;
      if (shouldEmitLiveDiagEvent37AX()) {
        globalThis.dispatchEvent?.(new CustomEvent("led-output-consumer-gate", { detail }));
      }
    } catch {
      // diagnostics only
    }
    return detail;
  }

  function shouldRefreshTelemetryCache(lastAt, now = performance.now()) {
    return !lastAt || telemetryStatsIntervalMs === 0 || now - lastAt >= telemetryStatsIntervalMs;
  }


function isLiveOutputLocked37AX() {
  try {
    const lock = globalThis.__budilightOutputLock37AP;
    if (lock?.active === true) return true;
    const mirror = globalThis.__budilightArtNetMasterMirror22EJ;
    if (mirror?.enabled === true || mirror?.lastStatus?.ok === true) return true;
    const serial = globalThis.__budilightLiveSerialMirror22CR || globalThis.__budilightLiveSerialAppMirror22CR;
    if (serial?.enabled === true || serial?.lastStatus?.ok === true) return true;
  } catch {}
  return false;
}

function shouldEmitLiveDiagEvent37AX(force = false) {
  if (force) return true;
  if (!isLiveOutputLocked37AX()) return true;
  const now = performance.now();
  if (now - lastLiveDiagEventAt37AX < LIVE_DIAG_EVENT_MIN_MS_37AX) return false;
  lastLiveDiagEventAt37AX = now;
  try {
    globalThis.__budilightRuntimeDiagEventGovernor37AX = {
      version: "STEP37AX_RUNTIME_DIAG_EVENT_GOVERNOR",
      live: true,
      minIntervalMs: LIVE_DIAG_EVENT_MIN_MS_37AX,
      lastEventAt: lastLiveDiagEventAt37AX,
      updatedAt: now
    };
  } catch {}
  return true;
}

  function readFrameBusStats(now = performance.now()) {
    if (shouldRefreshTelemetryCache(lastFrameBusStatsAt, now)) {
      cachedFrameBusStats = frameBus.getStats?.() || {};
      lastFrameBusStatsAt = now;
    }
    return cachedFrameBusStats || {};
  }

  function readFrameAuthorityStats(now = performance.now()) {
    if (shouldRefreshTelemetryCache(lastFrameAuthorityStatsAt, now)) {
      cachedFrameAuthorityStats = frameAuthority.getStats?.() || {};
      lastFrameAuthorityStatsAt = now;
    }
    return cachedFrameAuthorityStats || {};
  }

  function emitMetrics(kind, detail, now = performance.now()) {
    if (typeof onMetrics !== "function") return;
    const lastAt = kind === "render" ? lastRenderMetricsAt : lastOutputMetricsAt;
    const shouldEmitTelemetry = !(metricsEmitIntervalMs > 0 && lastAt && now - lastAt < metricsEmitIntervalMs);
    if (shouldEmitTelemetry) {
      if (kind === "render") lastRenderMetricsAt = now;
      else lastOutputMetricsAt = now;
    }
    onMetrics({
      ...detail,
      sampleOnly: !shouldEmitTelemetry
    });
  }

  function isPhysicalOutputActive() {
    return Boolean(isOutputEnabled());
  }

  function isLiveOutputClockActive() {
    // STEP22OE: only the headless runner owns the live output clock. The visible
    // shell UI is monitor-only; it must not publish/mirror frames into ArtNet.
    // It may still draw a throttled monitor preview, handled separately below.
    return Boolean(isOutputEnabled()) && !shellViewOnly;
  }

  function allowShellCanvasMonitorDuringLiveOutput() {
    return readPreviewSettingsCache().shellCanvasMonitorEnabled === true;
  }

  function isPreviewBudgetUnderPressure(now = performance.now()) {
    return now < previewBudgetPressureUntil;
  }

  function armPreviewBudgetPressure(now, previewFrameMs, previewDrawMs, renderMs) {
    if (!isPhysicalOutputActive()) return;
    const frameBudgetMs = Math.max(1, Number(previewFrameMs) || 1);
    const overrunMs = Math.max(0, Number(previewDrawMs) || 0, Number(renderMs) || 0) - frameBudgetMs;
    if (overrunMs <= 0) return;
    const pressureMs = Math.max(180, Math.min(900, Math.round(overrunMs * 8)));
    previewBudgetPressureUntil = Math.max(previewBudgetPressureUntil, now + pressureMs);
  }

  function readStoredLiveMonitorFps(fallback = 4) {
    const cached = readPreviewSettingsCache();
    const stored = Number(cached.previewFps || 0);
    if (Number.isFinite(stored) && stored > 0) return Math.max(1, Math.min(20, Math.round(stored)));
    const raw = Number(cached.shellLiveMonitorRenderFps || fallback);
    return Math.max(1, Math.min(20, Math.round(Number.isFinite(raw) ? raw : fallback)));
  }

  function readStoredLayerPreviewFps(fallback = 6) {
    const cached = readPreviewSettingsCache();
    const stored = Number(cached.layerPreviewFps || 0);
    if (Number.isFinite(stored) && stored > 0) return Math.max(1, Math.min(20, Math.round(stored)));
    const gapMs = Number(cached.shellLiveRawPreviewGapMs || 0);
    if (Number.isFinite(gapMs) && gapMs > 0) return Math.max(1, Math.min(20, Math.round(1000 / gapMs)));
    return fallback;
  }

  function shellCanvasMonitorGapMs() {
    const cached = readPreviewSettingsCache();
    const fps = Number(cached.shellLiveCanvasMonitorFps || readStoredLiveMonitorFps(4));
    const safeFps = Math.max(1, Math.min(20, Math.round(Number.isFinite(fps) ? fps : 4)));
    return Math.max(80, Math.round(1000 / safeFps));
  }

  function shellMonitorRenderGapMs() {
    try {
      const fps = readStoredLiveMonitorFps(2);
      const safeFps = Math.max(1, Math.min(20, Math.round(Number.isFinite(fps) ? fps : 2)));
      return Math.max(50, Math.round(1000 / safeFps));
    } catch {
      return 500;
    }
  }

  function allowShellRawPreviewDuringLiveOutput() {
    return readPreviewSettingsCache().shellRawPreviewEnabled !== false;
  }

  function draw(now = performance.now()) {
    if (!isShellViewActive()) {
      shellViewActivity.skippedPreviewFrames += 1;
      shellViewActivity.lastSkipAt = now;
      try { setLastPreviewRenderer?.("shell-inactive"); } catch {}
      if (!getRenderSchedulerNextAt()) setRenderSchedulerNextAt(now + shellInactivePreviewGapMs());
      setRenderSchedulerNextAt(now + shellInactivePreviewGapMs());
      scheduleNextDraw(now);
      return;
    }
    const previewFrameMs = currentPreviewFrameMs();
    const scheduledAt = getRenderSchedulerNextAt() || now;
    if (now + 0.25 < scheduledAt) {
      scheduleNextDraw(now);
      return;
    }

    if (now - lastPreviewFrameAt < previewFrameMs) {
      scheduleNextDraw(now);
      return;
    }
    lastPreviewFrameAt = now;

    let previewDrawMs = 0;
    try {
      let frame = latestComposedFrame;
      const previewMode = getPreviewMode();
      const previewStartedAt = performance.now();
      const quietShellMount = shellViewOnly && now < shellPreviewQuietUntil;
      const liveOutputClockActive = isLiveOutputClockActive();
      const physicalOutputActive = isPhysicalOutputActive();
      const previewBudgetPressured = isPreviewBudgetUnderPressure(now);
      const shellLiveMonitorOnly = shellViewOnly && physicalOutputActive;
      const shellMonitorRenderDue = !shellLiveMonitorOnly || (now - lastShellMonitorRenderAt >= shellMonitorRenderGapMs());

      // STEP 13BU-AQ: when real LED output is active, the visible preview must
      // mirror the authoritative output-clock frame instead of rendering its own
      // independent preview-time frame. This removes the 1–2 s drift where the
      // center preview showed the same animation but at a different time than
      // the LEDs. Preview is now a consumer of the output frame; only when live
      // output is not active does preview render its own fresh frame.
      if (liveOutputClockActive || shellLiveMonitorOnly) {
        const packet = getAuthoritativeFramePacket();
        if (isUsableFramePacket(packet)) {
          frame = packet.frame;
          updateLatestComposedFrame(frame);
          schedulerDebugState.previewClockSource = String(packet.source || "output-authority");
          schedulerDebugState.previewOutputFrameId = Number(packet.frameId || 0);
          schedulerDebugState.previewOutputFrameAgeMs = packet.timestamp ? Math.max(0, Math.round(performance.now() - Number(packet.timestamp))) : 0;
        }
      }

      const needsFreshFrame = !quietShellMount
        && !liveOutputClockActive
        && (!shellLiveMonitorOnly || shellMonitorRenderDue)
        && (!frame || shouldRefreshPreviewFrame?.() === true || (!shellViewOnly && isOutputEnabled()));
      if (needsFreshFrame) {
        setRenderTime(getBeatPosition());
        const rendered = renderCpuFrame();
        frame = rendered.frame;
        updateLatestComposedFrame(frame);
        if (shellLiveMonitorOnly) lastShellMonitorRenderAt = now;
        // STEP22OE: shell-view is monitor-only. Publishing its preview frames
        // into Frame Authority lets the visible UI compete with the headless
        // output runner and can create extra ArtNet mirror attempts. The hidden
        // runner remains the only live master-frame publisher.
        if (!shellViewOnly && !shellLiveMonitorOnly) {
          publishComposedFrame(frame, { source: FRAME_PRODUCERS.PREVIEW_RENDER, renderMs: rendered.renderMs });
        }
      }
      if (!frame) {
        const { width: W, height: H } = getDimensions();
        frame = new Uint8Array(Math.max(0, W * H * 3));
        updateLatestComposedFrame(frame);
      }

      if (quietShellMount) {
        setLastPreviewRenderer("shell-quiet");
      } else if (previewMode === "shader") {
        const softShaderFps = Number(adaptiveSoftState?.recommendations?.shaderPreviewFps || 0);
        const shaderCapDuringOutput = outputPriorityPreviewActive() ? 15 : 120;
        const shaderFps = Math.max(1, Math.min(shaderCapDuringOutput, Number((adaptiveSoftState?.active && softShaderFps > 0) ? softShaderFps : (getShaderPreviewFps?.() || (1000 / previewFrameMs) || 20))));
        const shaderPreviewFrameMs = 1000 / shaderFps;
        const shaderDue = now - lastShaderPreviewAt >= shaderPreviewFrameMs;
        if (shaderDue) {
          resizeShaderPreviewCanvas();
          let usedGpuPreview = false;
          // STEP37EE: Shader tab is an inspector, not a pixel-output monitor.
          // Before this fix live output forced shader preview to draw the low
          // resolution master LED frame, so the SHADER tab looked like enlarged
          // LED pixels. Always try the full-resolution GPU shader scene here;
          // it draws only into the visible preview canvas and does not publish
          // or modify the ArtNet/Serial frame bus.
          const gpuScene = now >= getForceCpuPreviewUntil() ? createGpuScene() : null;
          if (gpuScene && shaderPreviewRenderer?.drawShaderScene) {
            usedGpuPreview = shaderPreviewRenderer.drawShaderScene(gpuScene) !== false;
            if (!usedGpuPreview) onGpuDrawFailed?.("shader-preview");
          }
          if (usedGpuPreview) {
            setLastPreviewRenderer(liveOutputClockActive
              ? (shaderPreviewRenderer.kind === "webgl" ? "webgl:shader-original-live" : "gpu-shader-original-live")
              : (shaderPreviewRenderer.kind === "webgl" ? "webgl:shader" : "gpu-shader"));
          } else if (liveOutputClockActive) {
            // A single failed/CPU-only module must not make Perform look dead.
            // Keep the shader canvas alive with the authoritative CPU frame
            // until the GPU scene becomes available again.
            drawShaderPreview(frame, null);
            setLastPreviewRenderer("2d:shader-cpu-fallback-live");
          } else {
            drawShaderPreview(frame, null);
            setLastPreviewRenderer("2d:shader-buffer");
          }
          lastShaderPreviewAt = now;
        }
      } else {
        // STEP22OB: headless output runner must never spend time blitting a
        // hidden 2D canvas. Visible shell preview can still monitor at its own
        // throttled cadence, but the runner is transport-only.
        const mirrorActual = Number(globalThis.__budilightArtNetMasterMirror22EJ?.actualFps || 0);
        const shellMonitorDue = !shellLiveMonitorOnly
          || (allowShellCanvasMonitorDuringLiveOutput() && now - lastShellMonitorBlitAt >= shellCanvasMonitorGapMs())
          || (!allowShellCanvasMonitorDuringLiveOutput() && now - lastShellMonitorBlitAt >= shellCanvasMonitorGapMs());
        const skipMonitorBlit = headless
          || (liveOutputClockActive && mirrorActual > 0 && mirrorActual < 55)
          || !shellMonitorDue
          || previewBudgetPressured;
        if (!skipMonitorBlit) {
          drawCenterPreviewCpu(frame);
          if (shellLiveMonitorOnly) lastShellMonitorBlitAt = now;
        }
        setLastPreviewRenderer(headless ? "headless-output-no-preview-blit" : (skipMonitorBlit ? "2d:buffer-skipped-output-priority" : "2d:buffer"));
      }

      markPreviewConsumer(`preview:${previewMode}`);
      reportShellPreviewFrame(now);
      reportOutputFrame();
      if (!quietShellMount) {
        // STEP22NS: when physical output is active, the raw side previews are
        // monitor-only. Drawing L1 + L2 raw canvases on every visible preview
        // frame steals main-thread time from the output-owned render clock and
        // shows up as ArtNet jitter even when average FPS looks acceptable.
        // Keep them alive, but throttle them hard while live output owns timing.
        const liveOutputActiveForRawPreview = isPhysicalOutputActive();
        const shellRawPreviewAllowed = (!previewBudgetPressured)
          && (!shellViewOnly || !liveOutputActiveForRawPreview || allowShellRawPreviewDuringLiveOutput());
        const shellRawPreviewFps = readStoredLayerPreviewFps(outputPriorityPreviewActive() ? 8 : 6);
        const rawPreviewMinGapMs = headless
          ? 1000000
          : (liveOutputActiveForRawPreview && shellViewOnly)
          ? Math.max(50, Math.round(1000 / Math.max(1, shellRawPreviewFps)))
          : liveOutputActiveForRawPreview
          ? Math.max(50, Math.round(1000 / Math.max(1, shellRawPreviewFps)))
          : 0;
        const rawPreviewDue = !shellRawPreviewAllowed
          ? false
          : liveOutputActiveForRawPreview
          ? now - lastShellRawPreviewAt >= rawPreviewMinGapMs
          : (!shellViewOnly || now >= shellRawPreviewQuietUntil || now - lastShellRawPreviewAt >= 1000);
        if (rawPreviewDue) {
          drawLayerRawPreview("l1");
          drawLayerRawPreview("l2");
          lastShellRawPreviewAt = now;
        }
        setRenderTime(getBeatPosition());
      }
      updateStartupOverlayHealth(now);
      previewDrawMs = Math.max(0, performance.now() - previewStartedAt);
    } catch (error) {
      console.warn("draw loop error", error);
    } finally {
      const finishedAt = performance.now();
      const renderMs = Math.max(0, finishedAt - now);
      armPreviewBudgetPressure(finishedAt, previewFrameMs, previewDrawMs, renderMs);
      schedulerDebugState.renderMs = Math.max(0, Math.round(renderMs));
      schedulerDebugState.previewBudgetPressureUntil = Math.max(0, Math.round(previewBudgetPressureUntil));
      schedulerDebugState.previewBudgetPressured = Boolean(isPreviewBudgetUnderPressure(finishedAt));
      const lateBy = finishedAt - scheduledAt;
      if (lateBy > previewFrameMs) {
        setRenderSchedulerNextAt(finishedAt + previewFrameMs);
        schedulerDebugState.skipped += 1;
      } else {
        setRenderSchedulerNextAt(scheduledAt + previewFrameMs);
      }
      schedulerDebugState.nextAt = Math.round(getRenderSchedulerNextAt());
      schedulerDebugState.delayMs = Math.max(0, Math.round(getRenderSchedulerNextAt() - finishedAt));
      const frameBusStats = readFrameBusStats(finishedAt);
      const frameAuthorityStats = readFrameAuthorityStats(finishedAt);
      emitMetrics("render", {
        kind: "render",
        now: finishedAt,
        frameBus: frameBusStats,
        frameAuthority: frameAuthorityStats,
        outputConsumerGate: schedulerDebugState.outputConsumerGate || null,
        latestFrameId: frameAuthority.getLatestFrameId(),
        renderMs,
        previewDrawMs,
        lateByMs: lateBy,
        previewTargetMs: previewFrameMs,
        previewOutputPriority: Boolean(schedulerDebugState.previewOutputPriority),
        previewOutputPriorityFps: Number(schedulerDebugState.previewOutputPriorityFps || 0),
        adaptiveSoft: adaptiveSoftState || null,
        skipped: lateBy > previewFrameMs ? 1 : 0
      }, finishedAt);
      scheduleNextDraw(finishedAt);
    }
  }

  function renderCpuFrame() {
    const renderStartedAt = performance.now();
    beginFrameComposition?.();
    const frame = acquireCpuFrameBuffer();
    frame.fill(0);
    const state = getState();
    const { width: W, height: H } = getDimensions();
    const fx1 = state.fx1 || NO_FX_STATE;
    const fx2 = state.fx2 || NO_FX_STATE;
    const fxMaster = state.fxMaster || NO_FX_STATE;
    const fxMaster2 = state.fxMaster2 || NO_FX_STATE;
    const fx1Active = isFxActive(fx1);
    const fx2Active = isFxActive(fx2);
    const fxMasterActive = isFxActive(fxMaster);
    const fxMaster2Active = isFxActive(fxMaster2);
    // STEP22GC: always compose the master frame while the global engine is ON.
    // The previous condition used isOutputEnabled(), which became tied to the
    // live transport gate during the Serial/ArtNet cleanup. Result: layer cards
    // still rendered, but the center master frame stayed black and the output
    // router had no useful frame to send.
    if (state.enabled !== false) {
      for (let y = 0; y < H; y += 1) {
        for (let x = 0; x < W; x += 1) {
          const c1Mix = state.l1.flash || state.fx1.flash ? 1 : 1 - state.cross;
          const c2Mix = state.l2.flash || state.fx2.flash ? 1 : state.cross;
          const c1Base = renderPixelColor("l1", x, y, c1Mix);
          const c2Base = renderPixelColor("l2", x, y, c2Mix);
          const c1 = fx1Active ? applySingleFx(c1Base, fx1, x, y, 0) : c1Base;
          const c2 = fx2Active ? applySingleFx(c2Base, fx2, x, y, 1) : c2Base;
          const blended = blend(c1, c2);
          const postFx1 = fxMasterActive ? applySingleFx(blended, fxMaster, x, y, 2) : blended;
          const postFx2 = fxMaster2Active ? applySingleFx(postFx1, fxMaster2, x, y, 3) : postFx1;
          const color = applyOutputCorrection(postFx2);
          frame[(y * W + x) * 3] = color[0] | 0;
          frame[(y * W + x) * 3 + 1] = color[1] | 0;
          frame[(y * W + x) * 3 + 2] = color[2] | 0;
        }
      }
    }
    return { frame, renderMs: Math.max(0, performance.now() - renderStartedAt) };
  }

  function acquireCpuFrameBuffer() {
    const { width: W, height: H } = getDimensions();
    const size = W * H * 3;
    if (cpuFrameBufferSize !== size) {
      cpuFrameBufferSize = size;
      cpuFrameBufferPool = [new Uint8Array(size), new Uint8Array(size)];
      cpuFrameBufferIndex = 0;
    }
    const index = cpuFrameBufferIndex;
    let frame = cpuFrameBufferPool[index];
    if (!frame || frame.byteLength !== size) {
      frame = new Uint8Array(size);
      cpuFrameBufferPool[index] = frame;
    }
    cpuFrameBufferIndex = (index + 1) % cpuFrameBufferPool.length;
    return frame;
  }

  function isFxActive(fx) {
    return Boolean(fx && (fx.flash || fx.hold) && fx.mode !== "none" && Number(fx.amount || 0) > 0);
  }

  function isPreviewFrameEnabled() {
    // STEP22GH: the visible pixel preview is a monitor of the master frame, not
    // a live-output transport. After the parallel router refactor isOutputEnabled()
    // means “some hardware output is armed”, so using it here blanked the pixel
    // canvas while shader preview still worked. Pixel preview should draw whenever
    // the performance engine is ON; hardware gates are handled later by router.
    const state = getState?.() || {};
    return state.enabled !== false;
  }

  function drawShaderPreview(frame, gpuScene) {
    if (!shaderPreviewRenderer) return;
    if (gpuScene && shaderPreviewRenderer.drawShaderScene) {
      shaderPreviewRenderer.drawShaderScene(gpuScene);
      return;
    }
    if (frame?.length) {
      const { width: W, height: H } = getDimensions();
      shaderPreviewRenderer.draw(frame, W, H, isPreviewFrameEnabled());
    }
  }

  function drawCenterPreviewCpu(frame) {
    const { width: W, height: H } = getDimensions();
    previewRenderer.draw(frame, W, H, isPreviewFrameEnabled());
  }

  function scheduleNextDraw(now = performance.now()) {
    const previewFrameMs = isShellViewActive() ? currentPreviewFrameMs() : shellInactivePreviewGapMs();
    if (drawTimerId) {
      clearPreviewTimer37CF(drawTimerId);
      drawTimerId = 0;
    }
    if (!getRenderSchedulerNextAt()) setRenderSchedulerNextAt(now + previewFrameMs);
    const delay = Math.max(0, getRenderSchedulerNextAt() - now);
    if (workerPreferred() && backgroundDrawWorker) {
      armBackgroundDrawWorker(delay);
      return;
    }
    armFrameTimer(delay > 0 ? delay : 0);
  }

  function updateLatestComposedFrame(frame) {
    if (!(frame instanceof Uint8Array)) return;
    // STEP22MH: keep a reference to the latest composed frame instead of
    // copying the whole RGB buffer again on every preview/output tick. The
    // immutable publish clone is created later by Frame Authority; this local
    // cache only feeds the next preview draw path.
    latestComposedFrame = frame;
    latestComposedFrameSize = frame.byteLength;
  }

  function publishComposedFrame(frame, options = {}) {
    if (!(frame instanceof Uint8Array)) return null;
    const { width: W, height: H } = getDimensions();

    // STEP 8I: all composed frame producers publish through Frame Authority
    // using the named composed-frame API. The raw publishFrame entry stays
    // internal to authority/tests, so render_pipeline cannot accidentally
    // bypass composed-frame diagnostics again.
    // STEP 8A: all composed frame producers publish through Frame Authority.
    // The authority performs validation + immutable clone before writing to
    // frame_bus, so preview/output/debug keep one authoritative packet contract.
    const previewMode = getPreviewMode();
    const outputEnabled = Boolean(isOutputEnabled());
    const serialPipelineEnabled = Boolean(isSerialPipelineEnabled());
    const renderMs = Number(options.renderMs) || 0;
    const source = typeof options.source === "string" ? options.source : FRAME_PRODUCERS.RENDER_PIPELINE;
    const state = getState?.() || {};
    const beat = Number(getBeatPosition?.() || 0);
    const targetMs = currentTargetFrameMs();
    const previewMs = currentPreviewFrameMs();
    const packet = frameAuthority.publishComposedFrame({
      frame,
      dimensions: { width: W, height: H },
      renderMs,
      source,
      producer: source,
      meta: {
        ...(options.meta && typeof options.meta === "object" ? options.meta : {}),
        step: "13BT-B",
        renderCore: true,
        shellViewOnly,
        documentHidden: Boolean(documentRef.hidden),
        outputEnabled,
        serialPipelineEnabled,
        previewMode,
        outputMode: typeof state.outputMode === "string" ? state.outputMode : "unknown",
        targetFrameMs: targetMs,
        previewFrameMs: previewMs,
        targetFps: targetMs > 0 ? 1000 / targetMs : null,
        previewFps: previewMs > 0 ? 1000 / previewMs : null,
        beat,
        latestPreviewRenderer: getLastPreviewRenderer?.() || "unknown",
        stateEnabled: Boolean(state.enabled)
      },
      outputEnabled,
      serialPipelineEnabled,
      previewMode,
      outputMode: typeof state.outputMode === "string" ? state.outputMode : "unknown",
      targetFps: targetMs > 0 ? 1000 / targetMs : null,
      beat,
      renderer: getLastPreviewRenderer?.() || "unknown"
    });
    getNextEngineShadowAdapter().observeAuthoritativeFrame(packet);
    if (packet) {
      schedulerDebugState.frameBusPublish = {
        step: "13BT-B",
        frameId: Number(packet.frameId || 0),
        source,
        renderMs,
        byteLength: Number(packet.byteLength || 0),
        width: W,
        height: H,
        previewMode,
        outputEnabled,
        serialPipelineEnabled,
        targetFps: targetMs > 0 ? 1000 / targetMs : 0,
        beat,
        publishedAt: performance.now()
      };
    }
    return packet;
  }

  function scheduleOutputTick(now = performance.now()) {
    if (outputTimerId) {
      windowRef.clearTimeout(outputTimerId);
      outputTimerId = 0;
    }
    const frameMs = currentTargetFrameMs();
    const plan = outputClock.plan(now, frameMs);
    outputNextAt = plan.scheduledAt;
    const delay = plan.delayMs;

    // STEP 6A.4: when the host window is minimized/hidden, normal timers may be
    // clamped by the browser. Keep output ticks armed from a worker so the LED
    // transport does not blink or freeze just because the visible UI is hidden.
    if (workerPreferred()) {
      armBackgroundOutputWorker(delay);
      return;
    }

    outputTimerId = windowRef.setTimeout(() => {
      outputTimerId = 0;
      runOutputTick(performance.now());
    }, Math.max(0, Math.round(delay)));
  }

  function runOutputTick(now = performance.now()) {
    const startedAt = performance.now();
    let outputEnabled = false;
    let serialEnabled = false;
    let blockedReason = "unknown";
    try {
      outputEnabled = Boolean(isOutputEnabled());
      serialEnabled = Boolean(isSerialPipelineEnabled());
      schedulerDebugState.outputEnabled = outputEnabled;
      schedulerDebugState.serialEnabled = serialEnabled;

      if (outputEnabled) {
        // STEP 6A.5: the LED output path must not depend on the visible preview
        // draw loop. When the window/iframe is minimized, browser preview timers
        // can be heavily throttled; rendering a fresh output-owned CPU frame here
        // keeps the serial/BLX transport animated instead of replaying a stale
        // first frame or blinking between old frames.
        setRenderTime(getBeatPosition());
        const outputPolicy = getOutputRenderPolicy();
        schedulerDebugState.outputRenderPolicyDecision = String(outputPolicy.decision || "--");
        schedulerDebugState.outputRenderPolicyReason = String(outputPolicy.reason || "--");
        schedulerDebugState.outputRenderPolicyStaleLimitMs = Math.round(Number(outputPolicy.staleLimitMs || 0));
        const packet = getOutputFramePacket({ policy: outputPolicy });
        updateOutputConsumerGateDiagnostics(packet, "output-enabled");
        schedulerDebugState.outputFrameId = Number(packet?.frameId || 0);
        schedulerDebugState.outputFrameSource = String(packet?.source || "--");
        schedulerDebugState.outputFrameAgeMs = packet?.timestamp ? Math.max(0, Math.round(performance.now() - Number(packet.timestamp))) : 0;
        schedulerDebugState.outputBlockedReason = serialEnabled ? "none" : "network-output-clock-active";
        if (!serialEnabled && packet) markSerialConsumer(packet, "network-output-observed");
        if (packet?.frame instanceof Uint8Array) {
          setLastOutputFrameAt(performance.now());
          if (serialEnabled) {
            markSerialConsumer(packet, "serial-enqueue");
            enqueueOutputFrame(packet);
          }
        }
        reportOutputFrame();
      } else {
        const packet = getAuthoritativeFramePacket();
        updateOutputConsumerGateDiagnostics(packet, "output-disabled");
        schedulerDebugState.outputFrameId = Number(packet?.frameId || 0);
        schedulerDebugState.outputFrameSource = String(packet?.source || "--");
        schedulerDebugState.outputFrameAgeMs = packet?.timestamp ? Math.max(0, Math.round(performance.now() - Number(packet.timestamp))) : 0;
        blockedReason = serialEnabled ? "render output disabled" : "render output + serial disabled";
        schedulerDebugState.outputBlockedReason = blockedReason;
        reportOutputFrame();
      }
    } catch (error) {
      schedulerDebugState.outputBlockedReason = `error: ${error?.message || error}`;
      console.warn("output loop error", error);
    } finally {
      const frameMs = currentTargetFrameMs();
      const finishedAt = performance.now();
      const clockStep = outputClock.complete(finishedAt, frameMs);
      outputNextAt = clockStep.nextAt;
      const clockStats = outputClock.getStats();
      schedulerDebugState.outputClock = clockStats;
      const next = clockStats.nextAt;
      const frameBusStats = readFrameBusStats(finishedAt);
      const frameAuthorityStats = readFrameAuthorityStats(finishedAt);
      emitMetrics("output", {
        kind: "outputTick",
        now: finishedAt,
        frameBus: frameBusStats,
        frameAuthority: frameAuthorityStats,
        latestFrameId: frameAuthority.getLatestFrameId(),
        outputFrameId: Number(schedulerDebugState.outputFrameId || 0),
        outputFrameSource: String(schedulerDebugState.outputFrameSource || "--"),
        outputFrameAgeMs: Number(schedulerDebugState.outputFrameAgeMs || 0),
        outputEnabled: Boolean(schedulerDebugState.outputEnabled),
        serialEnabled: Boolean(schedulerDebugState.serialEnabled),
        outputBlockedReason: String(schedulerDebugState.outputBlockedReason || "--"),
        tickMs: Math.max(0, finishedAt - startedAt),
        driftMs: Number(clockStep.driftMs || 0),
        targetMs: frameMs,
        targetFps: Number(clockStep.fps || 0),
        clockAuthority: clockStats,
        clockMissedTicks: Number(clockStep.missedTicks || 0),
        clockCatchupTicks: Number(clockStep.catchupTicks || 0)
      }, finishedAt);
      scheduleOutputTick(finishedAt);
    }
  }



  function getAuthoritativeFramePacket() {
    // STEP 8J: output-side frame reads go through Frame Authority instead of
    // reading frame_bus directly. The frame_bus remains the low-level transport
    // and telemetry source, but output selection now uses the same authority
    // boundary as publishing.
    return frameAuthority.getLatestFrame({ consumer: FRAME_CONSUMERS.OUTPUT_LOOP });
  }

  function hasActiveFadeTransition() {
    const transitions = typeof getTransitions === "function" ? getTransitions() : null;
    if (!transitions || typeof transitions !== "object") return false;
    const now = performance.now();
    return ["l1", "l2", "blend"].some((key) => {
      const transition = transitions[key];
      if (!transition) return false;
      const duration = Math.max(1, Number(transition.duration || 0));
      const startedAt = Number(transition.startedAt || 0);
      if (!Number.isFinite(startedAt) || startedAt <= 0) return true;
      return now - startedAt < duration + 80;
    });
  }

  function getOutputRenderPolicy() {
    const packet = getAuthoritativeFramePacket();
    const hasUsableFrame = isUsableFramePacket(packet);
    const frameAgeMs = packet?.timestamp ? Math.max(0, performance.now() - Number(packet.timestamp)) : Number.POSITIVE_INFINITY;
    const policy = evaluateOutputRenderPolicy({
      outputEnabled: isOutputEnabled(),
      hasUsableFrame,
      documentHidden: documentRef.hidden === true,
      frameAgeMs,
      targetFrameMs: currentTargetFrameMs()
    });
    // STEP22NQ: ArtNet/sACN/live network output must be output-clock owned too.
    // The previous guard forced fresh frames only when the serial pipeline was
    // active. With ArtNet selected, the output timer was running but it mostly
    // replayed preview-owned packets, so real LED motion fell back to the
    // preview cadence (~20-30 FPS) and looked choppy while the UI showed many
    // different FPS numbers. If Output is ON, this clock is the authority for
    // fresh composed frames; serial enqueue remains conditional below.
    if (Boolean(isOutputEnabled())) {
      return {
        ...policy,
        decision: OUTPUT_RENDER_DECISIONS.RENDER_FRESH,
        reason: `live-output-clock-authority:${policy.reason || "fresh-output-priority"}`,
        transitionActive: hasActiveFadeTransition(),
        outputClockAuthoritative: true
      };
    }
    if (hasActiveFadeTransition()) {
      return {
        ...policy,
        decision: OUTPUT_RENDER_DECISIONS.RENDER_FRESH,
        reason: `active-fade-transition:${policy.reason || "fresh-output-priority"}`,
        transitionActive: true
      };
    }
    return policy;
  }

  function getOutputFramePacket(options) {
    const policy = options?.policy || getOutputRenderPolicy();
    const transitionActive = hasActiveFadeTransition();
    const preferFresh = policy.decision === OUTPUT_RENDER_DECISIONS.RENDER_FRESH || transitionActive;
    const packet = getAuthoritativeFramePacket();
    if (!preferFresh && isUsableFramePacket(packet)) return packet;

    // STEP 13BU-AP: FADE ON is output-first. During any L1/L2/blend transition
    // the serial/output loop must render its own fresh transition frame instead
    // of replaying the latest preview packet. Preview may be throttled or may
    // draw only the side raw-preview canvases; LED output must still receive the
    // eased in-between frames at the configured output FPS.

    // Startup/minimized safety fallback: output may need to produce its own
    // frame when the visible preview is sleeping. STEP 8D centralizes that
    // decision in evaluateOutputRenderPolicy(), while the published frame still
    // passes through Frame Authority and receives one shared frameId.
    const rendered = renderCpuFrame();
    const { frame } = rendered;
    updateLatestComposedFrame(frame);
    return publishComposedFrame(frame, {
      // QA contract marker for the cold-start branch: source: "output-startup-fallback"
      source: policy.reason === "no-usable-frame" ? FRAME_PRODUCERS.OUTPUT_STARTUP_FALLBACK : FRAME_PRODUCERS.OUTPUT_OWNED_RENDER,
      renderMs: rendered.renderMs,
      meta: {
        outputRenderPolicyDecision: policy.decision,
        outputRenderPolicyReason: policy.reason,
        outputRenderPolicyVersion: policy.policyVersion,
        outputRenderPolicyStaleLimitMs: policy.staleLimitMs,
        outputFadeActive: transitionActive
      }
    });
  }

  function isUsableFramePacket(packet) {
    if (!packet || !(packet.frame instanceof Uint8Array)) return false;
    const { width: W, height: H } = getDimensions();
    const expectedSize = Math.max(0, W * H * 3);
    return packet.width === W && packet.height === H && packet.frame.byteLength === expectedSize;
  }

  function startOutputLoop(now = performance.now()) {
    outputNextAt = now;
    outputClock.reset(now);
    scheduleOutputTick(now);
  }

  function stopOutputLoop() {
    if (outputTimerId) {
      windowRef.clearTimeout(outputTimerId);
      outputTimerId = 0;
    }
    stopBackgroundOutputWorker();
  }

  function initBackgroundDrawWorker() {
    initBackgroundOutputWorker();
    if (backgroundDrawWorker) return;
    try {
      const src = `
        let timer = 0;
        self.onmessage = (event) => {
          const data = event?.data || {};
          if (data.cmd === "arm") {
            const delay = Math.max(0, Number(data.delay) || 0);
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => {
              timer = 0;
              self.postMessage({ type: "tick" });
            }, delay);
            return;
          }
          if (data.cmd === "stop") {
            if (timer) clearTimeout(timer);
            timer = 0;
          }
        };
      `;
      const blob = new Blob([src], { type: "application/javascript" });
      backgroundDrawWorker = new Worker(URL.createObjectURL(blob));
      backgroundDrawWorker.onmessage = (event) => {
        if (event?.data?.type !== "tick") return;
        backgroundDrawWorkerArmed = false;
        if (workerPreferred()) draw(performance.now());
      };
    } catch (error) {
      console.warn("Background draw worker unavailable", error);
      backgroundDrawWorker = null;
    }
  }

  function initBackgroundOutputWorker() {
    if (backgroundOutputWorker) return;
    try {
      const src = `
        let timer = 0;
        self.onmessage = (event) => {
          const data = event?.data || {};
          if (data.cmd === "arm") {
            const delay = Math.max(0, Number(data.delay) || 0);
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => {
              timer = 0;
              self.postMessage({ type: "tick" });
            }, delay);
            return;
          }
          if (data.cmd === "stop") {
            if (timer) clearTimeout(timer);
            timer = 0;
          }
        };
      `;
      const blob = new Blob([src], { type: "application/javascript" });
      backgroundOutputWorker = new Worker(URL.createObjectURL(blob));
      backgroundOutputWorker.onmessage = (event) => {
        if (event?.data?.type !== "tick") return;
        backgroundOutputWorkerArmed = false;
        runOutputTick(performance.now());
      };
    } catch (error) {
      console.warn("Background output worker unavailable", error);
      backgroundOutputWorker = null;
    }
  }

  function armBackgroundOutputWorker(delay) {
    if (!backgroundOutputWorker) {
      outputTimerId = windowRef.setTimeout(() => {
        outputTimerId = 0;
        runOutputTick(performance.now());
      }, Math.max(0, Math.round(delay)));
      return;
    }
    if (!backgroundOutputWorkerArmed) backgroundOutputWorkerArmed = true;
    backgroundOutputWorker.postMessage({ cmd: "arm", delay: Math.max(0, Math.round(delay)) });
  }

  function stopBackgroundOutputWorker() {
    backgroundOutputWorkerArmed = false;
    if (!backgroundOutputWorker) return;
    backgroundOutputWorker.postMessage({ cmd: "stop" });
  }

  function stopBackgroundDrawWorker() {
    backgroundDrawWorkerArmed = false;
    if (!backgroundDrawWorker) return;
    backgroundDrawWorker.postMessage({ cmd: "stop" });
  }

  function armFrameTimer(delay) {
    if (drawTimerId) {
      clearPreviewTimer37CF(drawTimerId);
      drawTimerId = 0;
    }
    drawTimerId = managedPreviewTimeout37CF('render:preview-draw', () => {
      drawTimerId = 0;
      draw(performance.now());
    }, Math.max(0, Math.round(delay)), { maxMs: 1200 });
  }

  function armBackgroundDrawWorker(delay) {
    if (!backgroundDrawWorker) {
      armFrameTimer(delay);
      return;
    }
    if (!backgroundDrawWorkerArmed) backgroundDrawWorkerArmed = true;
    backgroundDrawWorker.postMessage({ cmd: "arm", delay: Math.max(0, Math.round(delay)) });
  }

  function reportShellPreviewFrame(now) {
    if (!shellViewOnly || !windowRef.parent || windowRef.parent === windowRef) return;
    if (now - lastShellPreviewReportAt < 250) return;
    lastShellPreviewReportAt = now;
    try {
      windowRef.parent.postMessage({
        type: "led-preview-frame",
        detail: {
          renderer: getLastPreviewRenderer?.() || "--",
          timestamp: now
        }
      }, "*");
    } catch {
      // ignore shell preview telemetry failures
    }
  }

  return {
    draw,
    scheduleNextDraw,
    initBackgroundDrawWorker,
    stopBackgroundDrawWorker,
    startOutputLoop,
    stopOutputLoop,
    getNextEngineShadowStatus: () => getNextEngineShadowAdapter().getStatus()
  };
}
