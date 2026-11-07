/* STEP37BE: single-writer watchdog.
   Reads the combined browser/server route health and turns persistent route
   conflicts into a cheap write gate for physical browser writers. This does not
   own rendering; it only prevents a browser mirror from feeding LEDs when the
   backend reports that another physical route is already active. */
(function(){
  const NAME = '__budilightSingleWriterWatchdog37BE';
  const VERSION = 'STEP37BE_SINGLE_WRITER_WATCHDOG';
  const TICK_MS = 420;
  const HIDDEN_TICK_MS = 5000;
  const MISMATCH_GRACE_MS = 950;
  const CLEAR_GRACE_MS = 1250;

  function isShellViewOnly(){
    try {
      const params = new URLSearchParams(location.search || '');
      return params.get('shellView') === '1' && params.get('headless') !== '1';
    } catch {
      return false;
    }
  }

  function epoch(){ return Date.now(); }
  function gate(){ try { return window.__budilightLiveOutputGate37BW || null; } catch { return null; } }
  function gateShouldRun(key, baseMs, opts){ try { return gate()?.shouldRun?.(key, baseMs, opts) !== false; } catch { return true; } }
  function gateUiActive(){ try { return gate()?.isUiActive?.() !== false; } catch { return true; } }
  function norm(value){ return String(value || '').trim(); }
  function family(owner){
    const s = norm(owner).toLowerCase();
    if (!s) return '';
    if (s.includes('artnet') || s.includes('sacn') || s.includes('udp')) return 'artnet';
    if (s.includes('serial') || s.includes('raw')) return 'serial';
    if (s.includes('ddp')) return 'ddp';
    return s.split(/[_.:-]/)[0] || s;
  }
  function readHealth(){
    try {
      const api = window.__budilightOutputRouteHealth37BD;
      if (api && typeof api.snapshot === 'function') return api.snapshot();
      return window.__budilightOutputRouteHealthSnapshot37BD || null;
    } catch { return null; }
  }
  function readRegistry(){
    try {
      const reg = window.__budilightOutputRouteRegistry37BB;
      if (reg && typeof reg.snapshot === 'function') return reg.snapshot();
      if (typeof window.__budilightOutputRouteRegistrySnapshot37BB === 'function') return window.__budilightOutputRouteRegistrySnapshot37BB();
    } catch {}
    return null;
  }

  const state = {
    version: VERSION,
    startedAt: epoch(),
    updatedAt: 0,
    status: 'BOOT',
    action: 'observe',
    reason: 'initializing',
    active: false,
    enforcedFamily: '',
    enforcedOwner: '',
    mismatchSince: 0,
    clearSince: 0,
    blockedWrites: 0,
    allowedWrites: 0,
    lastBlockedOwner: '',
    lastBlockedReason: '',
    lastHealthStatus: '',
    lastBrowserOwner: '',
    lastServerOwner: '',
    lastTickAt: 0
  };

  function chooseAction(health){
    const status = String(health && health.status || 'UNKNOWN').toUpperCase();
    const browserOwner = norm(health && health.browser && health.browser.active ? health.browser.owner : '');
    const serverOwner = norm(health && health.server && health.server.active ? health.server.owner : '');
    const serverFamily = family(serverOwner);
    const browserFamily = family(browserOwner);
    const now = epoch();
    state.lastHealthStatus = status;
    state.lastBrowserOwner = browserOwner;
    state.lastServerOwner = serverOwner;

    const hardConflict = status === 'MISMATCH' || status === 'SERVER_ONLY';
    const familyConflict = hardConflict && serverFamily && browserFamily && serverFamily !== browserFamily;
    const serverOnly = status === 'SERVER_ONLY' && serverFamily;
    if (familyConflict || serverOnly) {
      if (!state.mismatchSince) state.mismatchSince = now;
      state.clearSince = 0;
      if (now - state.mismatchSince >= MISMATCH_GRACE_MS) {
        state.active = true;
        state.enforcedFamily = serverFamily;
        state.enforcedOwner = serverOwner;
        state.status = 'ENFORCING_SERVER_OWNER';
        state.action = 'block-other-browser-writers';
        state.reason = status.toLowerCase() + ':' + (browserOwner || 'browser-off') + '->' + serverOwner;
        return;
      }
      state.active = false;
      state.status = 'GRACE';
      state.action = 'observe';
      state.reason = 'waiting-for-route-health-to-settle';
      return;
    }

    state.mismatchSince = 0;
    if (state.active) {
      if (!state.clearSince) state.clearSince = now;
      if (now - state.clearSince < CLEAR_GRACE_MS) {
        state.status = 'CLEARING';
        state.action = 'hold-last-gate';
        state.reason = 'clear-grace';
        return;
      }
    }
    state.active = false;
    state.enforcedFamily = '';
    state.enforcedOwner = '';
    state.clearSince = 0;
    state.status = status === 'MATCH' ? 'OK_MATCH' : (status || 'OK');
    state.action = status === 'BROWSER_ONLY' ? 'observe-browser-only' : 'observe';
    state.reason = String(health && health.reason || 'route-health-ok');
  }

  function tick(){
    const baseMs = gateUiActive() ? TICK_MS : HIDDEN_TICK_MS;
    if (!gateShouldRun('single-writer-watchdog', baseMs, { liveFactor: 1.75, hiddenFactor: 4, maxMs: HIDDEN_TICK_MS })) return;
    const health = readHealth();
    if (!health) {
      state.status = 'NO_HEALTH';
      state.action = 'observe';
      state.reason = 'route-health-unavailable';
      state.active = false;
      state.updatedAt = epoch();
      return;
    }
    chooseAction(health);
    state.lastTickAt = epoch();
    state.updatedAt = state.lastTickAt;
    try { window.__budilightSingleWriterWatchdogSnapshot37BE = snapshot(); } catch {}
  }

  function isWriteAllowed(owner){
    tick();
    const ownerFamily = family(owner);
    if (state.active && state.enforcedFamily && ownerFamily && ownerFamily !== state.enforcedFamily) {
      state.blockedWrites += 1;
      state.lastBlockedOwner = norm(owner);
      state.lastBlockedReason = 'server-owner-family-' + state.enforcedFamily;
      return { allowed: false, reason: state.lastBlockedReason, enforcedOwner: state.enforcedOwner, enforcedFamily: state.enforcedFamily };
    }
    state.allowedWrites += 1;
    return { allowed: true, reason: state.status || 'ok', enforcedOwner: state.enforcedOwner, enforcedFamily: state.enforcedFamily };
  }

  function snapshot(){
    return {
      version: VERSION,
      updatedAt: state.updatedAt,
      status: state.status,
      action: state.action,
      reason: state.reason,
      active: state.active,
      enforcedFamily: state.enforcedFamily,
      enforcedOwner: state.enforcedOwner,
      mismatchAgeMs: state.mismatchSince ? Math.max(0, epoch() - state.mismatchSince) : 0,
      blockedWrites: state.blockedWrites,
      allowedWrites: state.allowedWrites,
      lastBlockedOwner: state.lastBlockedOwner,
      lastBlockedReason: state.lastBlockedReason,
      lastHealthStatus: state.lastHealthStatus,
      lastBrowserOwner: state.lastBrowserOwner,
      lastServerOwner: state.lastServerOwner,
      registry: readRegistry()
    };
  }

  const api = { version: VERSION, snapshot, isWriteAllowed, tick };
  try { window[NAME] = api; } catch {}
  function managedWatchdogInterval37CY(name, fn, baseMs, opts = {}) {
    try {
      const loops = window.__budilightRuntimeLoopRegistry37CE;
      if (loops && typeof loops.adaptiveInterval === 'function') {
        return loops.adaptiveInterval(`single-writer-watchdog:${name}`, fn, baseMs, Object.assign({ group: 'single-writer-watchdog', liveFactor: 1.8, hiddenFactor: 4, maxMs: 8000 }, opts || {}));
      }
    } catch {}
    return setInterval(fn, Math.max(1, Number(baseMs) || 1));
  }

  if (isShellViewOnly()) {
    state.status = 'SHELL_VIEW_PASSIVE';
    state.action = 'observe';
    state.reason = 'hidden-runner-owns-single-writer-watchdog';
    state.updatedAt = epoch();
    try { window.__budilightSingleWriterWatchdogSnapshot37BE = snapshot(); } catch {}
    managedWatchdogInterval37CY('passive-snapshot', () => { state.updatedAt = epoch(); try { window.__budilightSingleWriterWatchdogSnapshot37BE = snapshot(); } catch {} }, HIDDEN_TICK_MS, { liveFactor: 3, hiddenFactor: 6, maxMs: 15000 });
    return;
  }
  managedWatchdogInterval37CY('tick', tick, TICK_MS, { liveFactor: 1, hiddenFactor: 3, maxMs: 3000, critical: true });
  try {
    const loops = window.__budilightRuntimeLoopRegistry37CE;
    if (loops && typeof loops.timeout === 'function') loops.timeout('single-writer-watchdog:initial-tick', tick, 180, { group: 'single-writer-watchdog', managed: false });
    else setTimeout(tick, 180);
  } catch { try { setTimeout(tick, 180); } catch {} }
})();
