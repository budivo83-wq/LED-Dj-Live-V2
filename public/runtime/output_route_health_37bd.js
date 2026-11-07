/* STEP37BD: combined output route health.
   Browser-side registry tells us who the UI thinks owns physical LED output.
   Server-side registry tells us who the backend is actually allowing to write.
   This file combines both into one cheap, throttled snapshot for Debug. */
(function(){
  const NAME = '__budilightOutputRouteHealth37BD';
  const VERSION = 'STEP37BD_OUTPUT_ROUTE_HEALTH';
  const SERVER_URL = '/api/output/server-route-registry';
  const FAST_MS = 650;
  const SLOW_MS = 1800;
  const FETCH_TIMEOUT_MS = 850;
  const HIDDEN_MS = 5000;

  function gate(){ try { return window.__budilightLiveOutputGate37BW || null; } catch { return null; } }
  function gateInterval(baseMs, opts){ try { return gate()?.interval?.(baseMs, opts) || baseMs; } catch { return baseMs; } }
  function gateShouldRun(key, baseMs, opts){ try { return gate()?.shouldRun?.(key, baseMs, opts) !== false; } catch { return true; } }
  function gateUiActive(){ try { return gate()?.isUiActive?.() !== false; } catch { return true; } }
  function loops37CE(){ try { return window.__budilightRuntimeLoopRegistry37CE || null; } catch { return null; } }
  function managedInterval37CE(name, fn, baseMs, opts = {}) {
    const loops = loops37CE();
    if (loops?.adaptiveInterval) return loops.adaptiveInterval(`route-health:${name}`, fn, baseMs, { group: 'output-health', ...opts });
    return setInterval(fn, baseMs);
  }
  function managedTimeout37CE(name, fn, delayMs, opts = {}) {
    const loops = loops37CE();
    if (loops?.timeout) return loops.timeout(`route-health:${name}`, fn, delayMs, { group: 'output-health', ...opts });
    return setTimeout(fn, delayMs);
  }

  function isShellViewOnly(){
    try {
      const params = new URLSearchParams(location.search || '');
      return params.get('shellView') === '1' && params.get('headless') !== '1';
    } catch {
      return false;
    }
  }

  function now(){ try { return performance.now(); } catch { return Date.now(); } }
  function epoch(){ return Date.now(); }
  function readBrowserRegistry(){
    try {
      const reg = window.__budilightOutputRouteRegistry37BB;
      if (reg && typeof reg.snapshot === 'function') return reg.snapshot();
      if (typeof window.__budilightOutputRouteRegistrySnapshot37BB === 'function') return window.__budilightOutputRouteRegistrySnapshot37BB();
    } catch {}
    return { ok: false, active: false, owner: null, reason: 'browser-registry-unavailable' };
  }
  function normalizeOwner(value){ return String(value || '').trim(); }
  function classify(browser, server){
    const browserOwner = normalizeOwner(browser && browser.active ? browser.owner : '');
    const serverOwner = normalizeOwner(server && server.active ? server.owner : '');
    const browserActive = Boolean(browserOwner);
    const serverActive = Boolean(serverOwner);
    const serverOk = Boolean(server && server.ok !== false && !server.error);
    if (!serverOk) return { status: 'SERVER_UNKNOWN', mismatch: false, reason: 'server-poll-failed' };
    if (!browserActive && !serverActive) return { status: 'IDLE', mismatch: false, reason: 'no-physical-owner' };
    if (browserActive && !serverActive) return { status: 'BROWSER_ONLY', mismatch: true, reason: 'browser-owner-without-server-owner' };
    if (!browserActive && serverActive) return { status: 'SERVER_ONLY', mismatch: true, reason: 'server-owner-without-browser-owner' };
    if (browserOwner === serverOwner || browserOwner.includes('artnet') && serverOwner.includes('artnet') || browserOwner.includes('serial') && serverOwner.includes('serial')) {
      return { status: 'MATCH', mismatch: false, reason: 'matching-output-family' };
    }
    return { status: 'MISMATCH', mismatch: true, reason: browserOwner + ' != ' + serverOwner };
  }

  const state = {
    version: VERSION,
    startedAt: epoch(),
    updatedAt: 0,
    lastPollAt: 0,
    nextPollAt: 0,
    pollCount: 0,
    errorCount: 0,
    browser: readBrowserRegistry(),
    server: null,
    status: 'BOOT',
    mismatch: false,
    reason: 'initializing',
    pending: false,
    intervalMs: SLOW_MS
  };

  function snapshot(){
    const browser = readBrowserRegistry();
    const server = state.server || { ok: false, active: false, owner: null, error: 'not-polled-yet' };
    const verdict = classify(browser, server);
    return {
      version: VERSION,
      updatedAt: state.updatedAt,
      lastPollAt: state.lastPollAt,
      pollCount: state.pollCount,
      errorCount: state.errorCount,
      pending: state.pending,
      intervalMs: state.intervalMs,
      status: verdict.status,
      mismatch: verdict.mismatch,
      reason: verdict.reason,
      browser,
      server
    };
  }

  function publish(){
    const snap = snapshot();
    Object.assign(state, {
      browser: snap.browser,
      status: snap.status,
      mismatch: snap.mismatch,
      reason: snap.reason,
      updatedAt: epoch()
    });
    try { window.__budilightOutputRouteHealthSnapshot37BD = snap; } catch {}
    try { window.dispatchEvent(new CustomEvent('budilight-output-route-health-37bd', { detail: snap })); } catch {}
    return snap;
  }

  async function fetchServer(){
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    let timer = null;
    try {
      if (controller) timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      const res = await fetch(SERVER_URL, { cache: 'no-store', signal: controller ? controller.signal : undefined });
      if (!res.ok) throw new Error('HTTP_' + res.status);
      const json = await res.json();
      state.server = json;
      state.pollCount += 1;
    } catch (err) {
      state.errorCount += 1;
      state.server = { ok: false, active: false, owner: null, error: String(err && err.message || err || 'fetch-failed') };
    } finally {
      if (timer) clearTimeout(timer);
      state.pending = false;
      state.lastPollAt = epoch();
      publish();
    }
  }

  function isDebugActive(){
    try {
      if (document.hidden) return false;
      if (document.body?.dataset?.previewMode === 'debug') return true;
      const btn = document.getElementById('previewTabDebug');
      return !!btn?.classList?.contains('active');
    } catch { return false; }
  }
  function shouldPoll(){
    const browser = readBrowserRegistry();
    const live = Boolean(browser && browser.active) || Boolean(state.server && state.server.active);
    const rawMs = live ? FAST_MS : SLOW_MS;
    state.intervalMs = gateUiActive() ? gateInterval(rawMs, { liveFactor: 2.25, hiddenFactor: 3, maxMs: HIDDEN_MS }) : HIDDEN_MS;
    // STEP37CX: avoid background /api/output/server-route-registry polling while
    // the Performance page is doing real-time output. Debug can still force it.
    if (!isDebugActive()) return false;
    return now() >= state.nextPollAt && !state.pending;
  }
  function tick(){
    if (!gateShouldRun('route-health-publish', gateUiActive() ? 500 : HIDDEN_MS, { liveFactor: 2, hiddenFactor: 4, maxMs: HIDDEN_MS })) return;
    if (shouldPoll()) {
      state.pending = true;
      state.nextPollAt = now() + state.intervalMs;
      fetchServer();
    } else {
      publish();
    }
  }

  const api = { version: VERSION, snapshot, poll: () => { if (!state.pending) { state.pending = true; return fetchServer(); } return Promise.resolve(snapshot()); } };
  try { window[NAME] = api; } catch {}
  if (isShellViewOnly()) {
    state.status = 'SHELL_VIEW_PASSIVE';
    state.reason = 'hidden-runner-owns-output-route-health';
    state.intervalMs = 4000;
    managedInterval37CE('hidden-publish', publish, HIDDEN_MS, { liveFactor: 1, hiddenFactor: 1, maxMs: HIDDEN_MS, skipWhenLive: false });
    managedTimeout37CE('initial-hidden-publish', publish, 120, { managed: false });
    return;
  }
  managedInterval37CE('tick', tick, 500, { liveFactor: 3, hiddenFactor: 5, maxMs: HIDDEN_MS });
  managedTimeout37CE('initial-tick', tick, 120, { managed: false });
})();
