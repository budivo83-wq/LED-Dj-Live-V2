/* STEP37BW: shared low-overhead gate for cosmetic timers.
   Purpose: keep physical output/render hot path ahead of diagnostics, route health
   polls, topbar events and other non-essential DOM/network wakeups. */
(function(){
  const NAME = '__budilightLiveOutputGate37BW';
  const VERSION = 'STEP37BW_LIVE_OUTPUT_TIMER_GATE';
  const state = {
    version: VERSION,
    startedAt: Date.now(),
    updatedAt: 0,
    lastActiveAt: 0,
    lastSampleAt: 0,
    sampleCount: 0,
    skipped: 0,
    live: false,
    shellViewOnly: false,
    shellViewActive: true,
    reason: 'boot'
  };

  function now(){ try { return performance.now(); } catch { return Date.now(); } }
  function isShellViewOnly(){
    try {
      const params = new URLSearchParams(location.search || '');
      return params.get('shellView') === '1' && params.get('headless') !== '1';
    } catch { return false; }
  }
  function readShellActive(){
    try {
      const a = window.__ledShellViewActivity;
      if (a && typeof a.active === 'boolean') return a.active !== false;
    } catch {}
    return true;
  }
  function readLive(){
    try {
      const gate = window.__ledOutputConsumerGate || {};
      const last = window.__ledRenderCoreLastPublish || {};
      const mirror = window.__budilightArtNetMasterMirror22EJ || {};
      const runner = window.__ledOutputRunnerStatus || {};
      const lock = window.__budilightOutputLock37AP || {};
      const health = window.__budilightOutputRouteHealthSnapshot37BD || {};
      const routeActive = health?.browser?.active === true || health?.server?.active === true;
      return Boolean(
        gate.outputEnabled === true ||
        last.outputEnabled === true ||
        lock.active === true ||
        routeActive ||
        runner.outputEnabled === true ||
        (mirror.enabled === true && Number(mirror.sent || mirror.frames || 0) > 0)
      );
    } catch {
      return false;
    }
  }
  function refresh(){
    const t = now();
    state.shellViewOnly = isShellViewOnly();
    state.shellViewActive = readShellActive();
    state.live = readLive();
    if (state.live) state.lastActiveAt = t;
    state.lastSampleAt = t;
    state.updatedAt = Date.now();
    state.sampleCount += 1;
    state.reason = state.shellViewOnly ? 'shell-view-only' : (!state.shellViewActive ? 'shell-view-inactive' : (state.live ? 'live-output-active' : 'idle'));
    return state;
  }
  function isLive(){ return refresh().live === true; }
  function isUiActive(){ const s = refresh(); return !s.shellViewOnly && s.shellViewActive !== false; }
  function interval(baseMs, opts){
    const s = refresh();
    const base = Math.max(1, Number(baseMs) || 1);
    const liveFactor = Math.max(1, Number(opts?.liveFactor || 1));
    const hiddenFactor = Math.max(1, Number(opts?.hiddenFactor || 1));
    let ms = base;
    if (s.live) ms *= liveFactor;
    if (s.shellViewOnly || s.shellViewActive === false) ms *= hiddenFactor;
    const maxMs = Math.max(base, Number(opts?.maxMs || ms));
    return Math.min(Math.round(ms), maxMs);
  }
  function shouldRun(key, baseMs, opts){
    const t = now();
    const k = '__gateLast_' + String(key || 'default');
    const due = interval(baseMs, opts);
    const last = Number(state[k] || 0);
    if (last && t - last < due) {
      state.skipped += 1;
      return false;
    }
    state[k] = t;
    return true;
  }
  function snapshot(){ return { ...refresh(), skipped: state.skipped }; }
  try { window[NAME] = { version: VERSION, refresh, snapshot, isLive, isUiActive, interval, shouldRun }; } catch {}
  try { refresh(); } catch {}
})();
