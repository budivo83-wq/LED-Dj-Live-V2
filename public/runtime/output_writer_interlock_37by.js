/* STEP37BY: hard physical-output writer interlock.
   37BX only reported conflicts. 37BY actively rejects low-trust writers
   (preview/debug/test/fallback/probe) from touching physical output while a
   real live route is active, and exposes one compact diagnostic snapshot. */
(function(){
  const NAME = '__budilightOutputWriterInterlock37BY';
  const VERSION = 'STEP37BY_OUTPUT_WRITER_INTERLOCK';
  const LOW_TRUST_PATTERNS = [
    'preview', 'debug', 'probe', 'test', 'self-test', 'fallback', 'startup-fallback',
    'visible-chase', 'gallery', 'thumb', 'thumbnail', 'inspector', 'editor'
  ];
  const TRUSTED_PATTERNS = [
    'artnet-master-framebus-mirror', 'live-serial-app-mirror', 'multi-output-router',
    'output-runner', 'artnet-sync-live-sender', 'raw-serial', 'master-framebus'
  ];
  const state = window[NAME] && window[NAME].version === VERSION && window[NAME]._state
    ? window[NAME]._state
    : {
        version: VERSION,
        installedAt: Date.now(),
        updatedAt: 0,
        registryWrapped: false,
        denied: 0,
        allowed: 0,
        lowTrustDenied: 0,
        packetSourceDenied: 0,
        lastDeniedOwner: '',
        lastDeniedReason: '',
        lastAllowedOwner: '',
        recent: []
      };

  function now(){ try { return performance.now(); } catch { return Date.now(); } }
  function isDebugActive(){ try { const text = `${location.pathname || ''} ${location.search || ''} ${location.hash || ''}`.toLowerCase(); return text.includes('debug') || text.includes('health') || window.__budilightWriterInterlockAlwaysOn37CV === true; } catch { return false; } }
  function epoch(){ return Date.now(); }
  function s(value){ return String(value == null ? '' : value).trim(); }
  function norm(value){ return s(value).toLowerCase(); }
  function containsAny(value, patterns){ const text = norm(value); return patterns.some((p) => text.includes(p)); }
  function isLowTrustOwner(owner){ return containsAny(owner, LOW_TRUST_PATTERNS) && !containsAny(owner, TRUSTED_PATTERNS); }
  function isTrustedOwner(owner){ return containsAny(owner, TRUSTED_PATTERNS) && !isLowTrustOwner(owner); }
  function family(owner){
    const text = norm(owner);
    if (text.includes('artnet') || text.includes('sacn') || text.includes('udp')) return 'artnet';
    if (text.includes('serial') || text.includes('raw')) return 'serial';
    if (text.includes('ddp')) return 'ddp';
    if (text.includes('preview')) return 'preview';
    if (text.includes('fallback') || text.includes('chase') || text.includes('test')) return 'fallback-test';
    return text.split(/[_.:-]/)[0] || '';
  }
  function push(type, owner, allowed, reason){
    const item = { at: epoch(), t: Math.round(now()), type: s(type).slice(0,40), owner: s(owner).slice(0,100), allowed: allowed === true, reason: s(reason).slice(0,160) };
    state.recent.push(item);
    while (state.recent.length > 48) state.recent.shift();
    if (allowed) { state.allowed += 1; state.lastAllowedOwner = item.owner; }
    else { state.denied += 1; state.lastDeniedOwner = item.owner; state.lastDeniedReason = item.reason; }
    state.updatedAt = epoch();
  }
  function registry(){ try { return window.__budilightOutputRouteRegistry37BB || null; } catch { return null; } }
  function registrySnapshot(){
    try {
      const reg = registry();
      if (reg && typeof reg.snapshot === 'function') return reg.snapshot();
      if (typeof window.__budilightOutputRouteRegistrySnapshot37BB === 'function') return window.__budilightOutputRouteRegistrySnapshot37BB();
    } catch {}
    return null;
  }
  function activeTrustedOwner(snapshot){
    const snap = snapshot || registrySnapshot() || {};
    const owner = s(snap.owner || '');
    if (snap.active === true && owner && isTrustedOwner(owner)) return owner;
    try {
      const lock = window.__budilightOutputLock37AP;
      const lockOwner = s(lock && lock.active === true ? lock.owner : '');
      if (lockOwner && isTrustedOwner(lockOwner)) return lockOwner;
    } catch {}
    return '';
  }
  function shouldDenyOwner(owner, action, data){
    const ownerName = s(owner || 'unknown');
    const snap = registrySnapshot();
    const activeOwner = activeTrustedOwner(snap);
    if (isLowTrustOwner(ownerName) && activeOwner) {
      return { deny: true, reason: `low-trust-writer-blocked-by-${activeOwner}`, activeOwner };
    }
    const ownerFam = family(ownerName);
    const activeFam = family(activeOwner);
    if (activeOwner && ownerFam && activeFam && ownerFam !== activeFam && !isTrustedOwner(ownerName)) {
      return { deny: true, reason: `family-conflict-${ownerFam}-vs-${activeFam}`, activeOwner };
    }
    return { deny: false, reason: 'ok', activeOwner };
  }
  function denyDecision(owner, reason){
    state.lowTrustDenied += 1;
    push('registry-deny', owner, false, reason);
    return { allowed: false, owner: activeTrustedOwner() || '', reason, interlockVersion: VERSION };
  }
  function wrapRegistry(){
    const reg = registry();
    if (!reg || reg.__writerInterlockWrapped37BY === true) return;
    ['claim', 'canWrite', 'markWrite'].forEach((method) => {
      const original = reg[method];
      if (typeof original !== 'function') return;
      reg[method] = function interlockedRegistryMethod(owner){
        const block = shouldDenyOwner(owner, method, arguments[1]);
        if (block.deny) return denyDecision(owner, block.reason);
        const result = original.apply(this, arguments);
        push(method, owner, result && result.allowed === true, (result && result.reason) || 'registry');
        return result;
      };
    });
    reg.__writerInterlockWrapped37BY = true;
    state.registryWrapped = true;
    push('install', 'output-route-registry', true, 'wrapped');
  }
  function packetSource(packet){
    try { return s(packet && (packet.source || packet.producer || packet.meta?.source || packet.meta?.producer || '')); } catch { return ''; }
  }
  function shouldBlockPacketSource(packet, owner){
    const source = packetSource(packet);
    const activeOwner = activeTrustedOwner();
    if (!activeOwner || !source) return { blocked: false, reason: 'no-active-owner-or-source', source, activeOwner };
    if (containsAny(source, ['preview-render', 'output-startup-fallback', 'fallback', 'visible-chase', 'test-generator', 'debug', 'probe'])) {
      state.packetSourceDenied += 1;
      const reason = `packet-source-${source}-blocked-by-${activeOwner}`;
      push('packet-source-deny', owner || source, false, reason);
      return { blocked: true, reason, source, activeOwner };
    }
    return { blocked: false, reason: 'ok', source, activeOwner };
  }
  function snapshot(){
    const out = {
      version: VERSION,
      installedAt: state.installedAt,
      updatedAt: state.updatedAt || epoch(),
      registryWrapped: state.registryWrapped,
      activeTrustedOwner: activeTrustedOwner(),
      denied: state.denied,
      allowed: state.allowed,
      lowTrustDenied: state.lowTrustDenied,
      packetSourceDenied: state.packetSourceDenied,
      lastDeniedOwner: state.lastDeniedOwner,
      lastDeniedReason: state.lastDeniedReason,
      lastAllowedOwner: state.lastAllowedOwner,
      registry: registrySnapshot(),
      recent: state.recent.slice(-24)
    };
    try { window.__budilightOutputWriterInterlockSnapshot37BY = out; } catch {}
    return out;
  }
  const api = { version: VERSION, _state: state, wrapRegistry, shouldDenyOwner, shouldBlockPacketSource, snapshot };
  try { window[NAME] = api; } catch {}
  wrapRegistry();
  // STEP37CZ: writer-interlock heartbeat is diagnostic/housekeeping only.
  // Route it through the shared loop registry so it slows down during live
  // output and when this page iframe is hidden/inactive. This avoids a fixed
  // 1.8s wakeup competing with preview/output without changing the actual
  // writer-blocking logic.
  const heartbeat37CZ = () => {
    wrapRegistry();
    if (isDebugActive()) { snapshot(); return; }
    state.updatedAt = epoch();
    try {
      window.__budilightOutputWriterInterlockSnapshot37BY = {
        version: VERSION, updatedAt: state.updatedAt, registryWrapped: state.registryWrapped,
        activeTrustedOwner: activeTrustedOwner(), denied: state.denied, allowed: state.allowed, passive: true
      };
    } catch {}
  };
  try {
    const loops = window.__budilightRuntimeLoopRegistry37CE;
    if (loops && typeof loops.adaptiveInterval === 'function') {
      loops.adaptiveInterval('writer-interlock:heartbeat', heartbeat37CZ, 1800, { group: 'writer-interlock', liveFactor: 2.5, hiddenFactor: 5, maxMs: 10000 });
    } else {
      setInterval(heartbeat37CZ, 2800);
    }
  } catch {}
  try {
    const loops = window.__budilightRuntimeLoopRegistry37CE;
    const initial = () => { wrapRegistry(); snapshot(); };
    if (loops && typeof loops.timeout === 'function') loops.timeout('writer-interlock:initial-snapshot', initial, 120, { group: 'writer-interlock', managed: false });
    else setTimeout(initial, 120);
  } catch {}
})();
