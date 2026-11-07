/* STEP37BX: single-writer deep report.
   Non-invasive diagnostics around physical LED writers. It does not send frames
   and it does not change ownership decisions; it only wraps the existing route
   registry to keep a compact rolling timeline and exposes one clear snapshot. */
(function(){
  const NAME = '__budilightSingleWriterDeepReport37BX';
  const VERSION = 'STEP37BX_SINGLE_WRITER_DEEP_REPORT';
  const MAX_EVENTS = 96;
  const SERVER_REFRESH_MS = 1800;
  const SNAPSHOT_MS = 900;
  const PASSIVE_SERVER_REFRESH_MS = 9000;
  const PASSIVE_SNAPSHOT_MS = 8000;
  const PASSIVE_IDLE_SNAPSHOT_MS = 15000;
  const PASSIVE_IDLE_SERVER_REFRESH_MS = 20000;

  function epoch(){ return Date.now(); }
  function perf(){ try { return performance.now(); } catch { return Date.now(); } }
  function safeString(value, fallback = ''){ return String(value == null ? fallback : value).slice(0, 240); }
  function num(value, fallback = 0){ const n = Number(value); return Number.isFinite(n) ? n : fallback; }
  function bool(value){ return value === true; }
  function isDebugActive(){
    try { if (window.__budilightDeepReportAlwaysOn37CV === true) return true; } catch {}
    try {
      const text = `${location.pathname || ''} ${location.search || ''} ${location.hash || ''}`.toLowerCase();
      return text.includes('debug') || text.includes('health');
    } catch { return false; }
  }
  function isLiveOutputActive(){
    try { return window.__budilightLiveOutputGate37BW?.isLive?.() === true; } catch {}
    try { return window.__ledOutputConsumerGate?.outputEnabled === true; } catch {}
    try { return window.__budilightOutputRouteRegistry37BB?.snapshot?.()?.active === true; } catch {}
    return false;
  }
  function cloneJson(value){ try { return JSON.parse(JSON.stringify(value)); } catch { return null; } }

  const state = window[NAME] && window[NAME].version === VERSION && window[NAME]._state
    ? window[NAME]._state
    : {
        version: VERSION,
        installedAt: epoch(),
        lastSnapshotAt: 0,
        lastServerPollAt: 0,
        registryWrapped: false,
        wrapErrors: 0,
        events: [],
        counts: {},
        lastDecision: '',
        lastConflict: null,
        lastWrite: null,
        server: {
          syncLive: null,
          masterMirror: null,
          rawSerial: null,
          lastOkAt: 0,
          lastError: ''
        },
        summary: null
      };

  function pushEvent(type, data){
    const item = {
      at: epoch(),
      t: Math.round(perf()),
      type: safeString(type, 'event'),
      owner: safeString(data && data.owner, ''),
      allowed: data && data.allowed === true,
      deniedBy: safeString(data && data.deniedBy, ''),
      reason: safeString(data && data.reason, ''),
      bytes: Math.max(0, Math.round(num(data && data.bytes, 0))),
      routeOwner: safeString(data && data.routeOwner, ''),
      routeActive: data && data.routeActive === true
    };
    state.events.push(item);
    while (state.events.length > MAX_EVENTS) state.events.shift();
    const key = `${item.type}:${item.owner || '-'}`;
    state.counts[key] = num(state.counts[key], 0) + 1;
    if (item.type === 'markWrite' && item.allowed) state.lastWrite = item;
    if (!item.allowed && (item.type === 'claim' || item.type === 'canWrite' || item.type === 'markWrite')) state.lastConflict = item;
    state.lastDecision = `${item.type}:${item.owner}:${item.allowed ? 'allowed' : 'denied'}:${item.reason}`;
  }

  function registry(){
    try { return window.__budilightOutputRouteRegistry37BB || null; } catch { return null; }
  }
  function registrySnapshot(){
    try {
      const reg = registry();
      if (reg && typeof reg.snapshot === 'function') return reg.snapshot();
      if (typeof window.__budilightOutputRouteRegistrySnapshot37BB === 'function') return window.__budilightOutputRouteRegistrySnapshot37BB();
    } catch {}
    return null;
  }
  function wrapRegistry(){
    const reg = registry();
    if (!reg || reg.__deepReportWrapped37BX === true) return;
    try {
      ['claim', 'canWrite', 'markWrite', 'release'].forEach((method) => {
        const original = reg[method];
        if (typeof original !== 'function') return;
        reg[method] = function wrappedRegistryMethod(owner, dataOrBytes, maybeReason){
          const result = original.apply(this, arguments);
          try {
            const snap = registrySnapshot() || {};
            const routeOwner = safeString(snap.owner || '');
            const decisionAllowed = method === 'release' ? false : (result && result.allowed === true);
            const reason = safeString((result && result.reason) || (method === 'release' ? maybeReason || dataOrBytes : '') || snap.lastDecision || '');
            pushEvent(method, {
              owner,
              allowed: decisionAllowed,
              deniedBy: safeString((result && result.owner) || snap.lastDeniedBy || ''),
              reason,
              bytes: method === 'markWrite' ? dataOrBytes : 0,
              routeOwner,
              routeActive: snap.active === true
            });
          } catch {}
          return result;
        };
      });
      reg.__deepReportWrapped37BX = true;
      state.registryWrapped = true;
      pushEvent('install', { owner: 'output-route-registry', allowed: true, reason: 'wrapped' });
    } catch (error) {
      state.wrapErrors += 1;
      pushEvent('install-error', { owner: 'output-route-registry', allowed: false, reason: error && error.message || error });
    }
  }

  function getGlobal(name){ try { return window[name] || null; } catch { return null; } }
  function compactFrameBus(){
    try {
      const bus = window.__ledFrameBus;
      const stats = bus && typeof bus.getStats === 'function' ? bus.getStats() : null;
      return stats ? {
        hasFrame: bool(stats.hasFrame),
        latestFrameId: num(stats.latestFrameId),
        byteLength: num(stats.byteLength),
        lastSource: safeString(stats.lastSource),
        lastProducer: safeString(stats.lastProducer),
        lastFrameAgeMs: num(stats.lastFrameAgeMs),
        listenerCount: num(stats.listenerCount),
        consumerCount: num(stats.consumerCount),
        health: cloneJson(stats.health)
      } : null;
    } catch { return null; }
  }
  function compactMirror(raw, name){
    if (!raw || typeof raw !== 'object') return null;
    return {
      name,
      version: safeString(raw.version),
      enabled: bool(raw.enabled) || bool(raw.configCacheEnabled),
      sent: num(raw.sent),
      skipped: num(raw.skipped),
      errors: num(raw.errors),
      lastFrameId: num(raw.lastFrameId),
      lastBytes: num(raw.lastBytes),
      lastError: safeString(raw.lastError),
      lastSkipReason: safeString(raw.lastSkipReason || raw.lastError),
      routeRegistryAllowed: bool(raw.routeRegistryAllowed),
      routeRegistryOwner: safeString(raw.routeRegistryOwner),
      routeRegistryDenied: num(raw.routeRegistryDenied),
      routeRegistryWrites: num(raw.routeRegistryWrites),
      watchdogAllowed: raw.singleWriterWatchdogAllowed37BE !== false,
      watchdogReason: safeString(raw.singleWriterWatchdogReason37BE),
      actualFps: num(raw.actualFps),
      transport: safeString(raw.lastStatus && raw.lastStatus.transport)
    };
  }
  function activeWriters(snap, artnet, serial){
    const list = [];
    if (snap && snap.active && snap.owner) list.push({ owner: safeString(snap.owner), type: safeString(snap.ownerType), source: 'route-registry' });
    if (artnet && artnet.enabled && (artnet.sent > 0 || artnet.routeRegistryWrites > 0)) list.push({ owner: 'artnet-master-framebus-mirror', type: 'artnet', source: 'browser-artnet-mirror' });
    if (serial && serial.enabled && (serial.sent > 0 || serial.routeRegistryWrites > 0)) list.push({ owner: 'live-serial-app-mirror', type: 'serial', source: 'browser-serial-mirror' });
    const srv = state.server.syncLive;
    if (srv && (srv.running === true || srv.started === true || srv.status === 'running')) list.push({ owner: 'artnet-sync-live-sender-22dq', type: 'server-artnet', source: 'server-sync-live' });
    return list;
  }
  function verdict(snap, writers){
    const registryOwner = safeString(snap && snap.owner || '');
    const unique = Array.from(new Set((writers || []).map((w) => safeString(w.owner)).filter(Boolean)));
    if (!unique.length) return { status: 'IDLE', ok: true, message: 'no physical writer active' };
    if (unique.length === 1) return { status: 'OK_SINGLE_WRITER', ok: true, owner: unique[0], message: `single writer: ${unique[0]}` };
    const browserFamilies = unique.filter((name) => name !== 'artnet-sync-live-sender-22dq');
    if (registryOwner && browserFamilies.length <= 1) return { status: 'SERVER_BROWSER_PAIR', ok: true, owner: registryOwner, message: 'browser uploader and server sender pair detected' };
    return { status: 'CONFLICT_RISK', ok: false, owners: unique, message: `multiple writer owners: ${unique.join(', ')}` };
  }
  function snapshot(){
    wrapRegistry();
    const snap = registrySnapshot();
    const watchdog = (() => { try { const w = window.__budilightSingleWriterWatchdog37BE; return w && typeof w.snapshot === 'function' ? w.snapshot() : getGlobal('__budilightSingleWriterWatchdogSnapshot37BE'); } catch { return null; } })();
    const artnet = compactMirror(getGlobal('__budilightArtNetMasterMirror22EJ'), 'artnet-master-framebus-mirror');
    const serial = compactMirror(getGlobal('__budilightLiveSerialMirror22CR') || getGlobal('__budilightLiveSerialAppMirror22CR'), 'live-serial-app-mirror');
    const writers = activeWriters(snap, artnet, serial);
    const out = {
      version: VERSION,
      installedAt: state.installedAt,
      updatedAt: epoch(),
      registryWrapped: state.registryWrapped,
      wrapErrors: state.wrapErrors,
      verdict: verdict(snap, writers),
      activeWriters: writers,
      lastWrite: state.lastWrite,
      lastConflict: state.lastConflict,
      lastDecision: state.lastDecision,
      registry: snap,
      watchdog: cloneJson(watchdog),
      frameBus: compactFrameBus(),
      browser: { artnet, serial },
      server: cloneJson(state.server),
      counts: { ...state.counts },
      recentEvents: state.events.slice(-32)
    };
    state.summary = out;
    state.lastSnapshotAt = out.updatedAt;
    try { window.__budilightSingleWriterDeepReportSnapshot37BX = out; } catch {}
    return out;
  }

  async function fetchJson(url){
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText || ''}`.trim());
    return res.json();
  }
  async function pollServer(){
    const now = epoch();
    if (now - num(state.lastServerPollAt) < SERVER_REFRESH_MS) return;
    state.lastServerPollAt = now;
    try {
      const [syncLive, masterMirror] = await Promise.all([
        fetchJson('/api/artnet/sync-live/status').catch((error) => ({ ok:false, error:String(error && error.message || error) })),
        fetchJson('/api/artnet/master-mirror/status').catch((error) => ({ ok:false, error:String(error && error.message || error) }))
      ]);
      state.server.syncLive = syncLive;
      state.server.masterMirror = masterMirror;
      state.server.lastOkAt = epoch();
      state.server.lastError = '';
    } catch (error) {
      state.server.lastError = safeString(error && error.message || error);
    }
  }

  const api = {
    version: VERSION,
    _state: state,
    snapshot,
    recentEvents: () => state.events.slice(),
    clear(){ state.events.length = 0; state.counts = {}; state.lastConflict = null; state.lastWrite = null; state.lastDecision = ''; return snapshot(); },
    pollServer
  };
  try { window[NAME] = api; } catch {}
  wrapRegistry();

  function maybeSnapshot(){
    // STEP37DF: keep passive browser snapshots cheap. When the page/iframe is
    // hidden and Debug is not open, there is no operator-visible value in
    // rebuilding the deep report; let the adaptive loop wake it later.
    try {
      const hidden = (typeof document !== 'undefined' && document.hidden === true);
      if (hidden && !isDebugActive()) return;
    } catch {}
    const due = isLiveOutputActive() ? PASSIVE_SNAPSHOT_MS : PASSIVE_IDLE_SNAPSHOT_MS;
    try { if (isDebugActive() || epoch() - num(state.lastSnapshotAt) >= due) snapshot(); } catch {}
  }
  function maybePollServer(){
    // STEP37CX: server polling is useful only when Debug/Health is open.
    // Keeping fetches alive during Performance output caused tiny, periodic
    // main-thread/network spikes with no operator value. Browser snapshots
    // remain available passively; server detail is refreshed on Debug demand.
    try { if (isDebugActive()) pollServer().catch(()=>{}); } catch {}
  }
  try {
    const loops = window.__budilightRuntimeLoopRegistry37CE;
    if (loops && typeof loops.adaptiveInterval === 'function') {
      loops.adaptiveInterval('deep-report:snapshot', maybeSnapshot, SNAPSHOT_MS, { group: 'deep-report', liveFactor: 2.5, hiddenFactor: 5, maxMs: PASSIVE_IDLE_SNAPSHOT_MS });
      loops.adaptiveInterval('deep-report:server-poll', maybePollServer, SERVER_REFRESH_MS, { group: 'deep-report', liveFactor: 3, hiddenFactor: 6, maxMs: PASSIVE_IDLE_SERVER_REFRESH_MS });
    } else {
      setInterval(maybeSnapshot, SNAPSHOT_MS);
      setInterval(maybePollServer, SERVER_REFRESH_MS);
    }
  } catch {}
  try {
    const loops = window.__budilightRuntimeLoopRegistry37CE;
    const initial = () => { snapshot(); if (isDebugActive()) pollServer().catch(()=>{}); };
    if (loops && typeof loops.timeout === 'function') loops.timeout('deep-report:initial-snapshot', initial, 250, { group: 'deep-report', managed: false });
    else setTimeout(initial, 250);
  } catch {}
})();
