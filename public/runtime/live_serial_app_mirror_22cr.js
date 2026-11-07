/* STEP22CX: optional browser FrameBus -> server app mirror.
   Performance-safe path: binary RGB POST instead of JSON Array.from/stringify.
   It is gated by localStorage so Performance never sends frames unless enabled. */
(function(){
  const FLAG = 'budilightLiveSerialMirror22CR';
  const FPS_KEY = 'budilightLiveSerialMirrorFps22CR';
  const STATS = '__budilightLiveSerialMirror22CR';
  const DEFAULT_FPS = 60; // STEP22CX: binary mirror; držíme konzervativní default

  function isShellViewOnly(){
    try {
      const params = new URLSearchParams(location.search || '');
      return params.get('shellView') === '1' && params.get('headless') !== '1';
    } catch {
      return false;
    }
  }

  function managedTimeout37CG(name, fn, delayMs, opts){
    try {
      const reg = window.__budilightRuntimeLoopRegistry37CE;
      if (reg && typeof reg.timeout === 'function') return reg.timeout(name, fn, delayMs, Object.assign({ group: 'serial-mirror', liveFactor: 1, hiddenFactor: 2, maxMs: 2000 }, opts || {}));
    } catch {}
    return setTimeout(fn, Math.max(0, Number(delayMs) || 0));
  }
  function managedInterval37CG(name, fn, baseMs, opts){
    try {
      const reg = window.__budilightRuntimeLoopRegistry37CE;
      if (reg && typeof reg.adaptiveInterval === 'function') return reg.adaptiveInterval(name, fn, baseMs, Object.assign({ group: 'serial-mirror', liveFactor: 2, hiddenFactor: 3, maxMs: Math.max(baseMs, 30000) }, opts || {}));
    } catch {}
    return setInterval(fn, Math.max(1, Number(baseMs) || 1));
  }

  const state = {
    enabled: false,
    configCacheAt: 0,
    configCacheEnabled: false,
    configCacheFps: DEFAULT_FPS,
    sent: 0,
    skipped: 0,
    errors: 0,
    lastError: '',
    lastFrameId: 0,
    lastSentAt: 0,
    inFlight: false,
    fps: DEFAULT_FPS,
    version: 'STEP37CG_DIRECT_FRAMEBUS_SERIAL_MIRROR_LOOP_REGISTRY',
    outputLockSuppressed: 0,
    lastLockOwner: '',
    routeRegistryAllowed: false,
    routeRegistryOwner: '',
    routeRegistryDenied: 0,
    routeRegistryWrites: 0,
    routeRegistryDecision: ''
  };
  window[STATS] = state;
  if (isShellViewOnly()) {
    state.enabled = false;
    state.configCacheEnabled = false;
    state.version = state.version + '_SHELL_VIEW_DISABLED_37BJ';
    state.disabledReason = 'shell-view-only-hidden-runner-owns-output';
    state.lastError = 'shell-view-only-disabled';
    return;
  }

  function refreshConfigCache(force){
    const now = performance.now();
    if (!force && state.configCacheAt && now - state.configCacheAt < 750) return;
    state.configCacheAt = now;
    try { state.configCacheEnabled = localStorage.getItem(FLAG) === '1'; } catch { state.configCacheEnabled = false; }
    try {
      const n = Number(localStorage.getItem(FPS_KEY) || DEFAULT_FPS);
      state.configCacheFps = Number.isFinite(n) ? Math.max(1, Math.min(60, n)) : DEFAULT_FPS;
    } catch { state.configCacheFps = DEFAULT_FPS; }
  }
  function isEnabled(){ refreshConfigCache(false); return state.configCacheEnabled === true; }
  function targetFps(){ refreshConfigCache(false); return state.configCacheFps || DEFAULT_FPS; }
  function canSend(packet){
    state.enabled = isEnabled();
    state.fps = targetFps();
    if (!state.enabled) {
      try {
        const registry = window.__budilightOutputRouteRegistry37BB;
        if (registry && typeof registry.release === 'function') registry.release('live-serial-app-mirror', 'serial-mirror-disabled');
      } catch {}
      return false;
    }
    try {
      const registry = window.__budilightOutputRouteRegistry37BB;
      if (registry && typeof registry.claim === 'function') {
        const decision = registry.claim('live-serial-app-mirror', {
          type: 'serial',
          priority: 90,
          active: true,
          ttlMs: 1400,
          reason: 'raw-serial-app-mirror-physical-output'
        });
        state.routeRegistryAllowed = decision && decision.allowed === true;
        state.routeRegistryOwner = String(decision && decision.owner || '');
        state.routeRegistryDecision = String(decision && decision.reason || '');
        if (!state.routeRegistryAllowed) {
          state.routeRegistryDenied += 1;
          state.outputLockSuppressed += 1;
          state.lastLockOwner = state.routeRegistryOwner || 'unknown';
          return false;
        }
      } else {
        const lock = window.__budilightOutputLock37AP;
        if (lock?.active === true && String(lock.owner || '') && String(lock.owner) !== 'live-serial-app-mirror') {
          state.outputLockSuppressed += 1;
          state.lastLockOwner = String(lock.owner || 'unknown');
          return false;
        }
      }
    } catch {}
    if (!packet || !(packet.frame instanceof Uint8Array)) return false;
    try {
      const watchdog = window.__budilightSingleWriterWatchdog37BE;
      if (watchdog && typeof watchdog.isWriteAllowed === 'function') {
        const gate37BE = watchdog.isWriteAllowed('live-serial-app-mirror');
        state.singleWriterWatchdogAllowed37BE = gate37BE && gate37BE.allowed === true;
        state.singleWriterWatchdogReason37BE = String(gate37BE && gate37BE.reason || '');
        if (!state.singleWriterWatchdogAllowed37BE) {
          state.singleWriterWatchdogDenied37BE = Number(state.singleWriterWatchdogDenied37BE || 0) + 1;
          state.skipped += 1;
          state.lastError = 'single-writer-watchdog:' + state.singleWriterWatchdogReason37BE;
          return false;
        }
      }
    } catch {}
    if (state.inFlight) { state.skipped += 1; return false; }
    const now = performance.now();
    const period = Math.max(1, 1000 / state.fps);
    if (now - state.lastSentAt < period) { state.skipped += 1; return false; }
    return true;
  }
  async function send(packet){
    if (!canSend(packet)) return;
    state.lastSentAt = performance.now();
    state.inFlight = true;
    state.lastFrameId = Number(packet.frameId || 0);
    try {
      try {
        const registry = window.__budilightOutputRouteRegistry37BB;
        if (registry && typeof registry.markWrite === 'function') {
          const writeDecision = registry.markWrite('live-serial-app-mirror', packet.frame?.byteLength || 0);
          if (!writeDecision.allowed) {
            state.routeRegistryDenied += 1;
            state.skipped += 1;
            state.lastError = 'route-registry-write-denied:' + String(writeDecision.owner || 'no-owner');
            return;
          }
          state.routeRegistryWrites += 1;
        }
      } catch {}
      const qs = new URLSearchParams({
        source: 'performance-framebus-binary',
        frameId: String(packet.frameId || 0),
        width: String(packet.width || 0),
        height: String(packet.height || 0),
        format: packet.format || 'rgb8',
        colorOrder: packet.colorOrder || 'rgb'
      });
      const frame = packet.frame instanceof Uint8Array ? packet.frame : new Uint8Array(packet.frame || []);
      const res = await fetch('/api/raw-serial/app-mirror/frame-bin?' + qs.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: frame
      });
      if (!res.ok) throw new Error(await res.text());
      state.sent += 1;
      state.lastError = '';
    } catch (error) {
      state.errors += 1;
      state.lastError = String(error && error.message || error || 'mirror send failed').slice(0, 300);
    } finally {
      state.inFlight = false;
    }
  }


  function processPacket(packet){
    state.enabled = isEnabled();
    if (!state.enabled) return;
    state.fps = targetFps();
    send(packet);
  }

  function registerDirectFrameBusConsumer(){
    try {
      if (state.directConsumerRegistered) return;
      const root = window;
      if (!Array.isArray(root.__ledFrameBusDirectConsumers)) root.__ledFrameBusDirectConsumers = [];
      root.__ledFrameBusPreferDirectPublish = true;
      root.__ledFrameBusDirectConsumers.push({ name: 'live-serial-app-mirror-22cr', handler: processPacket });
      state.directConsumerRegistered = true;
    } catch {}
  }

  registerDirectFrameBusConsumer();

  window.addEventListener('led-framebus-publish', function(event){
    // STEP37AK: when the optional serial app mirror is disabled, do not touch
    // FrameBus at all. The old listener still called getLatestFrame() on every
    // render event before canSend() rejected it, adding consumer bookkeeping and
    // small allocations to the live ArtNet path.
    state.enabled = isEnabled();
    if (!state.enabled) return;
    state.fps = targetFps();
    const packet = event?.detail?.packet && event.detail.packet.frame instanceof Uint8Array
      ? event.detail.packet
      : (window.__ledFrameBus && typeof window.__ledFrameBus.getLatestFrame === 'function'
        ? window.__ledFrameBus.getLatestFrame({ consumer: 'live-serial-app-mirror-22cr', cloneFrame: false, reason: 'post-to-server-step22cx-binary-low-lag' })
        : null);
    send(packet);
  });

  try { managedTimeout37CG('serial:refresh-config-cache-init', () => refreshConfigCache(true), 0, { managed: false }); } catch {}
  function refreshConfigStateNow(){
    refreshConfigCache(true);
    state.enabled = state.configCacheEnabled === true;
    state.fps = state.configCacheFps || DEFAULT_FPS;
  }
  window.addEventListener?.('storage', function(event){
    if (!event || event.key === FLAG || event.key === FPS_KEY) refreshConfigStateNow();
  });
  managedInterval37CG('serial:refresh-config-state', refreshConfigStateNow, 8000, { liveFactor: 2, hiddenFactor: 3, maxMs: 30000 });
})();
