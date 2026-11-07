(function () {
  const state = {
    telemetry: null,
    perf: null,
    detail: null,
    updatedAt: 0
  };

  function clone(value) {
    // Live telemetry is read-only operator data. Keep object references by
    // default and only clone arrays shallowly to avoid unbounded accidental edits.
    if (!value || typeof value !== "object") return value;
    return Array.isArray(value) ? value.slice(0, 64) : value;
  }

  function markUpdated() {
    state.updatedAt = Date.now();
  }

  function ingestTelemetry(snapshot) {
    if (!snapshot || typeof snapshot !== "object") return;
    state.telemetry = clone(snapshot);
    markUpdated();
  }

  function ingestPerf(perf) {
    if (!perf || typeof perf !== "object") return;
    state.perf = clone(perf);
    markUpdated();
  }

  function ingestOutputDetail(detail) {
    if (!detail || typeof detail !== "object") return;
    state.detail = clone(detail);
    markUpdated();
  }

  function pollRuntimeSources() {
    try {
      if (window.__ledTelemetryBus?.snapshot) ingestTelemetry(window.__ledTelemetryBus.snapshot({ source: "telemetry-store" }));
      else if (window.__ledTelemetryBus?.getLastSnapshot) ingestTelemetry(window.__ledTelemetryBus.getLastSnapshot());
    } catch {}
    try {
      if (window.__ledPerfBaseline && typeof window.__ledPerfBaseline === "object") ingestPerf(window.__ledPerfBaseline);
    } catch {}
  }

  const sharedSnapshot = { telemetry: {}, perf: {}, detail: {}, updatedAt: 0 };

  function getSnapshot() {
    sharedSnapshot.telemetry = state.telemetry || {};
    sharedSnapshot.perf = state.perf || {};
    sharedSnapshot.detail = state.detail || {};
    sharedSnapshot.updatedAt = state.updatedAt;
    return sharedSnapshot;
  }

  window.__ledTelemetryStore = {
    ingestTelemetry,
    ingestPerf,
    ingestOutputDetail,
    getSnapshot
  };

  let lastOutputDetailIngestAt = 0;
  function ingestOutputDetailThrottled(detail) {
    const now = performance.now?.() || Date.now();
    if (now - lastOutputDetailIngestAt < Math.max(100, Number(window.RUNTIME_PROFILE?.telemetryOutputDetailMinGapMs || 180))) return;
    lastOutputDetailIngestAt = now;
    ingestOutputDetail(detail || {});
  }

  window.addEventListener("led-output-frame", (event) => ingestOutputDetailThrottled(event?.detail || {}));
  window.addEventListener("message", (event) => {
    if (event?.data?.type === "led-output-frame") ingestOutputDetailThrottled(event.data.detail || {});
  });
  window.addEventListener("led-perf-baseline", (event) => ingestPerf(event?.detail || {}));

  function isLiveOutputActive() {
    try {
      const gate = window.__ledOutputConsumerGate || {};
      const last = window.__ledRenderCoreLastPublish || {};
      const mirror = window.__budilightArtNetMasterMirror22EJ || {};
      return gate.outputEnabled === true || last.outputEnabled === true || (mirror.enabled === true && Number(mirror.sent || 0) > 0);
    } catch {
      return false;
    }
  }

  let telemetryPollTimer = 0;
  function scheduleTelemetryPoll() {
    const baseMs = Math.max(1000, Number(window.RUNTIME_PROFILE?.telemetryStorePollMs || 1500));
    const liveMs = Math.max(baseMs, Number(window.RUNTIME_PROFILE?.telemetryStoreLivePollMs || 2500));
    const hiddenMs = Math.max(liveMs, Number(window.RUNTIME_PROFILE?.telemetryStoreHiddenPollMs || 4000));
    const delay = document.hidden ? hiddenMs : (isLiveOutputActive() ? liveMs : baseMs);
    telemetryPollTimer = setTimeout(() => {
      telemetryPollTimer = 0;
      pollRuntimeSources();
      scheduleTelemetryPoll();
    }, delay);
  }

  pollRuntimeSources();
  scheduleTelemetryPoll();
  window.__ledTelemetryStorePoller22MI = {
    version: "22MI",
    get active() { return Boolean(telemetryPollTimer); },
    runNow: pollRuntimeSources
  };
})();
