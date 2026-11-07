export function createRuntimeRefreshLoops({
  windowRef,
  performanceRef,
  readPerfProfileSnapshot,
  getLatestRuntimeDetail,
  shouldRefreshShaderInspector,
  shouldRefreshDebugOverlay,
  syncOutputCards,
  syncShaderInspector,
  syncDebugPanel,
  captureUiSyncMetric,
  captureDebugSyncMetric,
  uiRefreshMs = window.RUNTIME_PROFILE?.uiRefreshMs ?? 100,
  shaderInspectorRefreshMs = window.RUNTIME_PROFILE?.shaderRefreshMs ?? 200,
  debugRefreshMs = window.RUNTIME_PROFILE?.debugRefreshMs ?? 500
}) {
  function liveOutputActiveForUiRelief() {
    try {
      const gate = windowRef.__ledOutputConsumerGate || {};
      const last = windowRef.__ledRenderCoreLastPublish || {};
      const mirror = windowRef.__budilightArtNetMasterMirror22EJ || {};
      return gate.outputEnabled === true || last.outputEnabled === true || (mirror.enabled === true && Number(mirror.sent || 0) > 0);
    } catch {
      return false;
    }
  }

  const authority = windowRef?.__ledRuntimeModeAuthority?.get?.() || {};
  const mode = String(authority.mode || windowRef?.RUNTIME_PROFILE?.mode || (windowRef?.RUNTIME_PROFILE?.raspi ? "raspi-safe" : "normal")).toLowerCase();
  const constrained = mode !== "normal";
  const shellViewOnly = (() => {
    try { return new URLSearchParams(windowRef.location?.search || "").get("shellView") === "1"; }
    catch { return false; }
  })();
  const initialShellViewActive37BI = (() => {
    if (!shellViewOnly) return true;
    try {
      const frame = windowRef.frameElement;
      if (!frame) return true;
      return !frame.classList.contains("is-hidden") && frame.getAttribute("aria-hidden") !== "true";
    } catch {
      return true;
    }
  })();
  const shellViewActivity = windowRef.__ledShellViewActivity = windowRef.__ledShellViewActivity || {
    version: "37BI",
    active: initialShellViewActive37BI,
    view: "",
    currentView: "",
    changedAt: performanceRef.now(),
    skippedUiTicks: 0,
    skippedDebugTicks: 0,
    lastMessageAt: 0
  };
  if (shellViewOnly && typeof shellViewActivity.active !== "boolean") shellViewActivity.active = true;

  function isShellUiActive() {
    return !shellViewOnly || shellViewActivity.active !== false;
  }

  try {
    windowRef.addEventListener?.("message", (event) => {
      const message = event?.data;
      if (!message || typeof message !== "object" || message.type !== "led-shell-view-active") return;
      shellViewActivity.active = message.active !== false;
      shellViewActivity.view = String(message.view || "");
      shellViewActivity.currentView = String(message.currentView || "");
      shellViewActivity.changedAt = performanceRef.now();
      shellViewActivity.lastMessageAt = shellViewActivity.changedAt;
      try {
        windowRef.document?.documentElement?.classList.toggle("shell-view-inactive", !shellViewActivity.active);
        windowRef.document?.body?.classList.toggle("shell-view-inactive", !shellViewActivity.active);
      } catch {}
    });
  } catch {}

  // STEP 13CA: declare the primary debug writer path. Rescue layer may only
  // write when this path is stale or errored.
  windowRef.__ledDebugPrimaryWriter = "runtime-refresh-loop";
  let uiRefreshTimerId = 0;
  let debugRefreshTimerId = 0;
  let shaderInspectorRefreshTimerId = 0; // kept as compatibility alias; shader refresh is coalesced into uiRefreshTimerId.
  let perfProfileReporterTimerId = 0; // compatibility alias; perf baseline is emitted from the coalesced operator scheduler.
  let perfProfileReporterActive = false;
  let perfBaselineListenerInstalled = false;

  // STEP 13BO: debug pipeline audit.
  // Exposed as window.__ledDebugPipeline so the rescue layer can show whether
  // the original refresh path is alive or blocked.
  const debugPipeline = windowRef.__ledDebugPipeline = windowRef.__ledDebugPipeline || {
    version: "13BP",
    buildDebugDetailCalls: 0,
    syncDebugCalls: 0,
    skippedNotVisible: 0,
    intervalTicks: 0,
    baselineEvents: 0,
    forcedEvents: 0,
    selfHealWrites: 0,
    visibilityOverrides: 0,
    lastBuildAt: 0,
    lastSyncAt: 0,
    lastSkipAt: 0,
    lastReason: "init",
    lastVisible: false,
    lastMode: "--",
    lastHasDetail: false,
    lastHasPerf: false,
    lastHasTelemetry: false,
    lastError: null
  };
  debugPipeline.version = "13BP";

  function isDebugDomMounted() {
    return Boolean(
      windowRef.document?.getElementById?.("dbgTelemetry") ||
      windowRef.document?.getElementById?.("dbgEngine") ||
      windowRef.document?.querySelector?.("[id^='dbg']")
    );
  }

  function isDebugTabProbablyActive() {
    const doc = windowRef.document;
    if (!doc) return false;
    const activeByButton = Boolean(
      doc.querySelector?.("#previewTabDebug.active, #previewTabDebug.is-active, #previewTabDebug[aria-selected='true']")
    );
    const bodyMode = doc.body?.dataset?.previewMode === "debug";
    const debugPaneVisible = Array.from(doc.querySelectorAll?.("#debugPanel, .debug-panel, [data-preview-panel='debug'], [data-panel='debug']") || [])
      .some((el) => {
        const rect = el.getBoundingClientRect?.();
        const style = windowRef.getComputedStyle?.(el);
        return (!style || style.display !== "none" && style.visibility !== "hidden") &&
          (!rect || rect.width > 0 && rect.height > 0);
      });
    return activeByButton || bodyMode || debugPaneVisible;
  }

  function shouldForceDebugSync() {
    // STEP 13BP:
    // If DEBUG DOM exists, do not let a broken tab-visibility heuristic starve
    // the panel forever. This is intentionally conservative: it only forces
    // sync when debug elements are mounted.
    if (!isDebugDomMounted()) return false;
    // STEP22MH: do not self-heal by rewriting the whole debug dashboard every
    // ~1.5 s just because the DOM exists. That was enough to spike render time
    // and make ArtNet look chopped. Only the actually selected DEBUG tab gets
    // live DOM writes; hidden debug gets a slow heartbeat below.
    return isDebugTabProbablyActive();
  }

  function buildDebugDetail(perfOverride = null) {
    debugPipeline.buildDebugDetailCalls += 1;
    debugPipeline.lastBuildAt = performanceRef.now();
    const baseDetail = getLatestRuntimeDetail() || {};
    const localPerf = perfOverride || readPerfProfileSnapshot?.() || null;
    const basePerf = baseDetail.perf || null;
    // In shell mode the visible UI frame is view-only. The real output loop runs
    // in output-runner.html and forwards led-output-frame messages through the
    // shell. Do not overwrite that runner perf/runtimeTrace with the UI frame's
    // local view-only snapshot, otherwise DEBUG shows stale OUT/SERIAL OFF while
    // the hidden runner is actually sending frames.
    const preferRunnerPerf = String(baseDetail.mode || "").toUpperCase() === "RUNNER" && basePerf?.runtimeTrace;
    const perf = preferRunnerPerf ? basePerf : (localPerf || basePerf || {});
    const telemetry = perf.telemetry || baseDetail.telemetry || basePerf?.telemetry || null;
    debugPipeline.lastMode = String(baseDetail.mode || perf?.runtimeTrace?.source || "--");
    debugPipeline.lastHasDetail = Boolean(Object.keys(baseDetail || {}).length);
    debugPipeline.lastHasPerf = Boolean(perf && Object.keys(perf || {}).length);
    debugPipeline.lastHasTelemetry = Boolean(telemetry);
    debugPipeline.lastReason = "build-detail";
    return {
      ...baseDetail,
      timestamp: performanceRef.now(),
      perf,
      telemetry
    };
  }

  function syncDebugFromCurrent(perfOverride = null, { force = false, reason = "manual" } = {}) {
    let visible = Boolean(shouldRefreshDebugOverlay());
    const selfHealVisible = shouldForceDebugSync();
    if (!visible && selfHealVisible) {
      visible = true;
      debugPipeline.visibilityOverrides += 1;
      debugPipeline.lastReason = `visibility-override:${reason}`;
    }
    debugPipeline.lastVisible = visible;
    if (!force && !visible) {
      debugPipeline.skippedNotVisible += 1;
      debugPipeline.lastSkipAt = performanceRef.now();
      debugPipeline.lastReason = `skip-hidden:${reason}`;
      return;
    }
    const dbgStartedAt = performanceRef.now();
    try {
      syncDebugPanel(buildDebugDetail(perfOverride));
      debugPipeline.syncDebugCalls += 1;
      debugPipeline.lastSyncAt = performanceRef.now();
      debugPipeline.lastReason = `sync:${reason}${force ? ":force" : ""}`;
      debugPipeline.lastError = null;
    } catch (error) {
      debugPipeline.lastError = error?.message || String(error);
      debugPipeline.lastReason = `error:${reason}`;
      console.warn("debug pipeline sync failed", error);
    }
    captureDebugSyncMetric(dbgStartedAt);
  }

  function publishPerfBaseline() {
    const snapshot = readPerfProfileSnapshot();
    windowRef.__ledPerfBaseline = snapshot;
    windowRef.dispatchEvent(new CustomEvent("led-perf-baseline", { detail: snapshot }));
  }


  function runtimeLoopRegistry37CE() {
    try { return windowRef.__budilightRuntimeLoopRegistry37CE || windowRef.window?.__budilightRuntimeLoopRegistry37CE || null; }
    catch { return null; }
  }

  function startAdaptiveOperatorLoop37DH(fn, baseMs) {
    const loops = runtimeLoopRegistry37CE();
    if (loops?.adaptiveInterval) {
      return loops.adaptiveInterval('operator-ui-debug-refresh', fn, baseMs, {
        group: 'operator-ui',
        liveFactor: 1.75,
        hiddenFactor: 5,
        maxMs: 2500,
        skipWhenHidden: false
      });
    }
    return windowRef.setInterval(fn, baseMs);
  }

  function scheduleOperatorTimeout37DH(name, fn, delayMs, opts = {}) {
    const loops = runtimeLoopRegistry37CE();
    if (loops?.timeout) return loops.timeout(`operator:${name}`, fn, delayMs, { group: 'operator-ui', ...opts });
    return windowRef.setTimeout(fn, Math.max(0, Number(delayMs) || 0));
  }

  function startPerfProfileReporter() {
    // STEP22MI: do not start another interval. The reporter rides on the same
    // operator scheduler as cosmetic UI/debug work, so the main thread has fewer
    // independent wakeups during live output.
    perfProfileReporterActive = true;
    perfProfileReporterTimerId = uiRefreshTimerId || 1;
  }

  function startUiRefreshLoops() {
    if (!uiRefreshTimerId) {
      // STEP22MI: single operator scheduler for cosmetic UI, shader inspector,
      // DEBUG panel heartbeat and perf-baseline publication. Keep output/render
      // authority outside of this scheduler.
      let lastLiveUiSync = 0;
      let lastShaderInspectorSync = 0;
      let lastDebugSchedulerSync = 0;
      let lastHiddenDebugSync = 0;
      let lastPerfBaselineSync = 0;
      // STEP37DE: the operator scheduler is cosmetic. Keep the floor at 75 ms
      // so it cannot wake the main thread at 20 Hz+ when output is already busy.
      const tickMs = Math.max(75, Math.min(
        Number(uiRefreshMs) || 100,
        Number(shaderInspectorRefreshMs) || 200,
        Number(debugRefreshMs) || 500
      ));
      const perfBaselineMs = () => Math.max(2000, Number(windowRef.RUNTIME_PROFILE?.perfBaselineMs || 3000));
      const hiddenRefreshMs = () => Math.max(
        debugRefreshMs,
        Number(windowRef.RUNTIME_PROFILE?.debugHiddenRefreshMs || (constrained ? 4000 : 1500))
      );

      const runDebugSchedulerTick = (now) => {
        debugPipeline.intervalTicks += 1;
        let visible = Boolean(shouldRefreshDebugOverlay());
        const selfHealVisible = shouldForceDebugSync();
        if (!visible && selfHealVisible) {
          visible = true;
          debugPipeline.visibilityOverrides += 1;
          debugPipeline.lastReason = "operator-visibility-override";
        }
        debugPipeline.lastVisible = Boolean(visible);
        if (!visible && now - lastHiddenDebugSync < hiddenRefreshMs()) {
          debugPipeline.skippedNotVisible += 1;
          debugPipeline.lastSkipAt = now;
          debugPipeline.lastReason = "operator-skip-hidden";
          return;
        }
        if (!visible) lastHiddenDebugSync = now;
        if (visible && liveOutputActiveForUiRelief()) {
          // STEP37AI: live output gets priority. DEBUG remains available, but
          // visible debug refresh is slowed during physical output so large DOM
          // text panels cannot steal a frame from ArtNet/WS dispatch.
          const liveDebugMs = Math.max(debugRefreshMs, Number(windowRef.RUNTIME_PROFILE?.debugLiveOutputRefreshMs || 2500));
          if (now - lastHiddenDebugSync < liveDebugMs) {
            debugPipeline.skippedNotVisible += 1;
            debugPipeline.lastSkipAt = now;
            debugPipeline.lastReason = "operator-skip-live-output-debug-throttle";
            return;
          }
          lastHiddenDebugSync = now;
        }
        syncDebugFromCurrent(null, { force: !visible, reason: visible ? "operator-visible" : "operator-hidden-heartbeat" });
      };

      uiRefreshTimerId = startAdaptiveOperatorLoop37DH(() => {
        const now = performanceRef.now();

        if (!isShellUiActive() || windowRef.document?.hidden === true) {
          shellViewActivity.skippedUiTicks += 1;
          shellViewActivity.lastSkipAt = now;
          debugPipeline.skippedNotVisible += 1;
          debugPipeline.lastSkipAt = now;
          debugPipeline.lastReason = windowRef.document?.hidden === true ? "document-hidden" : "shell-view-inactive";
          return;
        }

        if (perfProfileReporterActive && now - lastPerfBaselineSync >= perfBaselineMs()) {
          lastPerfBaselineSync = now;
          publishPerfBaseline();
        }

        const detail = getLatestRuntimeDetail();
        if (detail) {
          const liveOutput = liveOutputActiveForUiRelief();
          // STEP37CZ: output cards are operator telemetry, not render authority.
          // During live physical output, update them a little less often to
          // reduce DOM pressure; Debug still has its own slower refresh gate.
          // STEP37DE: while physical output is live, output cards are useful but
          // not critical. Updating around 1 Hz removes periodic DOM pressure.
          const liveUiCardsMs = Math.max(950, Number(windowRef.RUNTIME_PROFILE?.liveOutputUiCardsMs || 1100));
          if (!liveOutput || now - lastLiveUiSync >= liveUiCardsMs) {
            lastLiveUiSync = now;
            const uiStartedAt = now;
            syncOutputCards(detail);
            captureUiSyncMetric(uiStartedAt);
          }

          const shaderMs = liveOutput
            ? Math.max(1300, Number(windowRef.RUNTIME_PROFILE?.liveOutputShaderInspectorMs || 1600))
            : Math.max(120, Number(shaderInspectorRefreshMs) || 200);
          if (now - lastShaderInspectorSync >= shaderMs) {
            lastShaderInspectorSync = now;
            if (shouldRefreshShaderInspector()) syncShaderInspector(detail);
          }
        }

        if (now - lastDebugSchedulerSync >= Math.max(250, Number(debugRefreshMs) || 500)) {
          lastDebugSchedulerSync = now;
          runDebugSchedulerTick(now);
        }
      }, tickMs);
      shaderInspectorRefreshTimerId = uiRefreshTimerId;
      debugRefreshTimerId = uiRefreshTimerId;
      if (perfProfileReporterActive) perfProfileReporterTimerId = uiRefreshTimerId;

      windowRef.__ledOperatorScheduler22MI = {
        version: "37DH_ADAPTIVE_OPERATOR_UI_REFRESH",
        tickMs,
        coalesced: true,
        uiRefreshMs,
        shaderInspectorRefreshMs,
        debugRefreshMs
      };
    }
    if (!perfBaselineListenerInstalled) {
      perfBaselineListenerInstalled = true;
      windowRef.addEventListener?.("led-debug-force-refresh", () => {
        if (!isShellUiActive()) {
          debugPipeline.skippedNotVisible += 1;
          debugPipeline.lastReason = "shell-inactive-force-ignored";
          return;
        }
        debugPipeline.forcedEvents += 1;
        syncDebugFromCurrent(null, { force: true, reason: "force-event" });
      });
      windowRef.addEventListener?.("focus", () => {
        if (!isShellUiActive()) return;
        debugPipeline.forcedEvents += 1;
        syncDebugFromCurrent(null, { force: true, reason: "window-focus" });
      });
      windowRef.document?.addEventListener?.("click", (event) => {
        if (event?.target?.id === "previewTabDebug" || event?.target?.closest?.("#previewTabDebug")) {
          debugPipeline.forcedEvents += 1;
          scheduleOperatorTimeout37DH("debug-tab-click", () => syncDebugFromCurrent(null, { force: true, reason: "debug-tab-click" }), 20, { managed: false });
        }
      });
      // STEP 5J: PREW DEBUG must also update from the passive perf baseline.
      // Baseline events stay passive unless the operator is actively looking at DEBUG.
      windowRef.addEventListener?.("led-perf-baseline", (event) => {
        debugPipeline.baselineEvents += 1;
        if (shouldRefreshDebugOverlay() || isDebugTabProbablyActive()) {
          syncDebugFromCurrent(event?.detail || null, { force: false, reason: "perf-baseline" });
        }
      });
    }
  }


  return {
    startPerfProfileReporter,
    startUiRefreshLoops
  };
}
