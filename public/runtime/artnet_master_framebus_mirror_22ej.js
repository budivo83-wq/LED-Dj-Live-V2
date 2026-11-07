/* STEP22GU: browser Performance FrameBus -> server ArtNet master mirror.
   Default ON: Performance preview frames are mirrored into server Master FrameBus
   so ArtNet output can send real LED DJ Live animations, not visible-chase fallback. */
(function(){
  const FLAG = 'budilightArtNetMasterMirror22EJ';
  const FPS_KEY = 'budilightArtNetMasterMirrorFps22EJ';
  const BROADCAST_FLAG = 'budilightArtNetMasterMirrorBroadcast22EJ';
  const STATS = '__budilightArtNetMasterMirror22EJ';
  const CHANNEL_NAME = 'budilight-master-framebus-v1';
  const DEFAULT_FPS = 60;
  const OUTPUT_LOCK_FLAG = 'budilightOutputLock37AP';
  const GENERATOR_LIVE_LOCK_KEY_38L = 'budilight.generator.live.lock.v1';
  const GENERATOR_LIVE_LOCK_TTL_MS_38L = 3500;

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
      if (reg && typeof reg.timeout === 'function') return reg.timeout(name, fn, delayMs, Object.assign({ group: 'artnet-mirror', liveFactor: 1, hiddenFactor: 2, maxMs: 2000 }, opts || {}));
    } catch {}
    return setTimeout(fn, Math.max(0, Number(delayMs) || 0));
  }
  function managedInterval37CG(name, fn, baseMs, opts){
    try {
      const reg = window.__budilightRuntimeLoopRegistry37CE;
      if (reg && typeof reg.adaptiveInterval === 'function') return reg.adaptiveInterval(name, fn, baseMs, Object.assign({ group: 'artnet-mirror', liveFactor: 2, hiddenFactor: 3, maxMs: Math.max(baseMs, 30000) }, opts || {}));
    } catch {}
    return setInterval(fn, Math.max(1, Number(baseMs) || 1));
  }

  // STEP22MD: no high-frequency safety poll. Event-driven only.
  const state = {
    version: 'STEP37CG_DIRECT_FRAMEBUS_ARTNET_MIRROR_LOOP_REGISTRY',
    enabled: false,
    fps: DEFAULT_FPS,
    sent: 0,
    skipped: 0,
    errors: 0,
    inFlight: false,
    lastSentAt: 0,
    lastFrameId: 0,
    lastError: '',
    lastBytes: 0,
    lastStatus: null,
    lastSeenFrameId: 0,
    lastEventAt: 0,
    pollReads: 0,
    broadcastSent: 0,
    broadcastErrors: 0,
    lastBroadcastAt: 0,
    lastSentSignature: '',
    lastSentSignatureAt: 0,
    pollSuppressed: 0,
    duplicateSuppressed: 0,
    sendOrigin: '',
    previewSuppressed: 0,
    lastOutputOwnedAt: 0,
    lastSuppressedSource: '',
    lastQueryKey: '',
    lastQueryPrefix: '',
    windowStartedAt: 0,
    windowSent: 0,
    actualFps: 0,
    lastSkipReason: '',
    wsBackpressureSkips: 0,
    wsMaxBufferedAmount: 0,
    wsLastBufferedAmount: 0,
    nextDueAt: 0,
    minSendGapMs: 0,
    pacingMode: 'tolerant-frame-clock',
    configCacheAt: 0,
    configCacheEnabled: true,
    configCacheFps: DEFAULT_FPS,
    configCacheWsPreferred: true,
    configCacheMaxBufferedBytes: 0,
    outputLockEnabled: true,
    outputLockOwner: '',
    outputLockActive: false,
    outputLockSuppressed: 0,
    generatorLiveSuppressed38L: 0,
    generatorLiveLockOwner38L: '',
    generatorLiveLockAgeMs38L: null,
    lastLockUpdateAt: 0,
    routeRegistryAllowed: false,
    routeRegistryOwner: '',
    routeRegistryDenied: 0,
    routeRegistryWrites: 0,
    routeRegistryDecision: ''
  };
  window[STATS] = state;
  if (isShellViewOnly()) {
    state.enabled = false;
    state.version = state.version + '_SHELL_VIEW_DISABLED_37BJ';
    state.disabledReason = 'shell-view-only-hidden-runner-owns-output';
    state.lastSkipReason = 'shell-view-only';
    window.__setBudilightArtNetMasterMirror22EJ = function(){
      state.previewSuppressed += 1;
      state.lastSkipReason = 'shell-view-only-setter-ignored';
      return false;
    };
    return;
  }
  try { managedTimeout37CG('artnet:refresh-config-cache-init', () => refreshConfigCache(true), 0, { managed: false }); } catch {}


  const WS_FLAG = 'budilightArtNetMasterMirrorWs22NH';
  function refreshConfigCache(force){
    const now = performance.now();
    if (!force && state.configCacheAt && now - state.configCacheAt < 500) return;
    state.configCacheAt = now;
    try { state.configCacheEnabled = localStorage.getItem(FLAG) !== '0'; } catch { state.configCacheEnabled = true; }
    try { state.configCacheWsPreferred = localStorage.getItem(WS_FLAG) !== '0'; } catch { state.configCacheWsPreferred = true; }
    try { state.outputLockEnabled = localStorage.getItem(OUTPUT_LOCK_FLAG) !== '0'; } catch { state.outputLockEnabled = true; }
    try {
      const n = Number(localStorage.getItem(FPS_KEY) || DEFAULT_FPS);
      const runtimeFps = typeof window.getRuntimeTargetFps === 'function' ? Number(window.getRuntimeTargetFps()) : 0;
      const target = Math.max(Number.isFinite(n) ? n : 0, Number.isFinite(runtimeFps) ? runtimeFps : 0, DEFAULT_FPS, 60);
      state.configCacheFps = Math.max(1, Math.min(60, target));
    } catch { state.configCacheFps = DEFAULT_FPS; }
    try {
      const configured = Number(localStorage.getItem('budilightArtNetMasterMirrorWsMaxBuffered22NO') || '0');
      state.configCacheMaxBufferedBytes = Number.isFinite(configured) && configured > 0 ? Math.max(1024, Math.round(configured)) : 0;
    } catch { state.configCacheMaxBufferedBytes = 0; }
  }
  function wsPreferred(){ refreshConfigCache(false); return state.configCacheWsPreferred !== false; }
  function updateOutputLock(active) {
    try {
      const lock = window.__budilightOutputLock37AP || { version: 'STEP37AP_OUTPUT_LOCK', owner: '', active: false, updatedAt: 0, reason: '' };
      const enabled = state.outputLockEnabled !== false;
      if (!enabled || !active) {
        if (lock.owner === 'artnet-master-framebus-mirror') {
          lock.active = false;
          lock.reason = enabled ? 'artnet-mirror-disabled' : 'output-lock-disabled';
        }
      } else {
        lock.active = true;
        lock.owner = 'artnet-master-framebus-mirror';
        lock.reason = 'single-physical-output-writer';
      }
      lock.updatedAt = Date.now();
      window.__budilightOutputLock37AP = lock;
      state.outputLockActive = Boolean(lock.active);
      state.outputLockOwner = String(lock.owner || '');
      state.lastLockUpdateAt = lock.updatedAt;
      try {
        const registry = window.__budilightOutputRouteRegistry37BB;
        if (registry && typeof registry.claim === 'function') {
          const decision = registry.claim('artnet-master-framebus-mirror', {
            type: 'artnet',
            priority: 100,
            active: Boolean(enabled && active),
            ttlMs: 1400,
            reason: enabled && active ? 'framebus-ws-physical-output-owner' : 'artnet-mirror-disabled'
          });
          state.routeRegistryAllowed = decision && decision.allowed === true;
          state.routeRegistryOwner = String(decision && decision.owner || '');
          state.routeRegistryDecision = String(decision && decision.reason || '');
          if (enabled && active && !state.routeRegistryAllowed) state.routeRegistryDenied += 1;
        }
      } catch {}
    } catch {}
  }
  function maxWsBufferedBytes(frameBytes){
    refreshConfigCache(false);
    return state.configCacheMaxBufferedBytes > 0
      ? state.configCacheMaxBufferedBytes
      : Math.max(16 * 1024, Math.round(Number(frameBytes || 0) * 2.25));
  }
  function wsUrl(){
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${location.host}`;
  }
  function getWsRuntime(){
    if (!state.ws) state.ws = { socket: null, ready: false, connecting: false, sent: 0, fallbackFetch: 0, errors: 0, lastError: '', lastOpenAt: 0 };
    return state.ws;
  }
  function ensureWs(){
    if (!wsPreferred() || typeof WebSocket === 'undefined') return null;
    const wsState = getWsRuntime();
    const ws = wsState.socket;
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return ws;
    if (wsState.connecting) return null;
    try {
      wsState.connecting = true;
      const next = new WebSocket(wsUrl());
      next.binaryType = 'arraybuffer';
      wsState.socket = next;
      next.onopen = function(){ wsState.ready = true; wsState.connecting = false; wsState.lastOpenAt = Date.now(); wsState.lastError = ''; };
      next.onerror = function(){ wsState.errors += 1; wsState.lastError = 'ws-error'; };
      next.onclose = function(){ wsState.ready = false; wsState.connecting = false; if (wsState.socket === next) wsState.socket = null; };
      return next;
    } catch (error) {
      wsState.connecting = false;
      wsState.errors += 1;
      wsState.lastError = String(error && error.message || error || 'ws-open-failed').slice(0, 200);
      return null;
    }
  }
  function buildWsPacket(packet, d, frame){
    const bytes = frame instanceof Uint8Array ? frame : new Uint8Array(frame || []);
    const totalBytes = 24 + bytes.byteLength;
    // STEP22NK: avoid allocating a new 7.2kB WS envelope for every live frame.
    // Keep a small ring of reusable envelopes; a deeper ring gives the browser
    // more room if WS send internally snapshots asynchronously, while still
    // avoiding steady 60 FPS GC churn.
    if (!state.wsPacketPool || state.wsPacketPool.bytes !== totalBytes) {
      state.wsPacketPool = { bytes: totalBytes, index: 0, slots: Array.from({ length: 8 }, () => new Uint8Array(totalBytes)) };
    }
    const pool = state.wsPacketPool;
    const slotIndex = pool.index;
    const out = pool.slots[slotIndex];
    pool.index = (pool.index + 1) % pool.slots.length;
    out[0] = 0x4d; out[1] = 0x46; out[2] = 0x32; out[3] = 0x32; // MF22
    if (!pool.views) pool.views = pool.slots.map((slot) => new DataView(slot.buffer));
    const view = pool.views[slotIndex];
    view.setUint32(4, Math.max(0, Number(packet.frameId || 0)) >>> 0, true);
    view.setUint16(8, Math.max(1, Math.min(65535, Number(packet.width || d.width) || d.width)), true);
    view.setUint16(10, Math.max(1, Math.min(65535, Number(packet.height || d.height) || d.height)), true);
    view.setUint16(12, Math.max(1, Math.min(64, d.stripCount)), true);
    view.setUint16(14, Math.max(1, Math.min(1000, d.pixelsPerStrip)), true);
    view.setUint8(16, 1); // rgb8
    view.setUint8(17, 1); // rgb
    view.setUint32(20, bytes.byteLength >>> 0, true);
    out.set(bytes, 24);
    return out;
  }

  function isEnabled(){ refreshConfigCache(false); return state.configCacheEnabled !== false; }
  function targetFps(){ refreshConfigCache(false); return state.configCacheFps || DEFAULT_FPS; }
  function updateActualFps(now){
    if (!state.windowStartedAt || now - state.windowStartedAt > 1000) {
      state.actualFps = state.windowStartedAt ? Math.round((state.windowSent * 1000 / Math.max(1, now - state.windowStartedAt)) * 10) / 10 : 0;
      state.windowStartedAt = now;
      state.windowSent = 0;
    }
  }
  function markAccepted(now){
    if (!state.windowStartedAt) state.windowStartedAt = now;
    state.windowSent += 1;
    updateActualFps(now);
  }
  function broadcastEnabled(){
    try { return localStorage.getItem(BROADCAST_FLAG) === '1'; } catch { return false; }
  }
  function dims(packet){
    const width = Number(packet?.width || 300);
    const height = Number(packet?.height || 8);
    return {
      width: Math.max(1, Math.min(65535, Math.round(width || 300))),
      height: Math.max(1, Math.min(65535, Math.round(height || 8))),
      stripCount: Math.max(1, Math.min(64, Math.round(height || 8))),
      pixelsPerStrip: Math.max(1, Math.min(1000, Math.round(width || 300)))
    };
  }
  function queryPrefix(packet, d){
    const width = Number(packet.width || d.width);
    const height = Number(packet.height || d.height);
    const format = packet.format || 'rgb8';
    const colorOrder = packet.colorOrder || 'rgb';
    const key = `${d.stripCount}|${d.pixelsPerStrip}|${width}|${height}|${format}|${colorOrder}`;
    if (key === state.lastQueryKey && state.lastQueryPrefix) return state.lastQueryPrefix;
    const prefix = `source=performance-framebus-artnet-master&stripCount=${d.stripCount}&pixelsPerStrip=${d.pixelsPerStrip}&width=${width}&height=${height}&format=${encodeURIComponent(format)}&colorOrder=${encodeURIComponent(colorOrder)}&frameId=`;
    state.lastQueryKey = key;
    state.lastQueryPrefix = prefix;
    return prefix;
  }
  function frameSignature(packet){
    const frame = packet?.frame;
    if (!(frame instanceof Uint8Array)) return '';
    const len = frame.byteLength;
    const a = len ? frame[0] : 0;
    const b = len > 1 ? frame[Math.floor(len / 2)] : 0;
    const c = len > 2 ? frame[len - 1] : 0;
    return `${Number(packet.frameId || 0)}:${len}:${a}:${b}:${c}:${Number(packet.width || 0)}:${Number(packet.height || 0)}`;
  }
  function readGeneratorLiveLock38L(){
    try {
      const raw = localStorage.getItem(GENERATOR_LIVE_LOCK_KEY_38L);
      if (!raw) return null;
      const lock = JSON.parse(raw);
      const ageMs = Date.now() - Number(lock?.at || lock?.updatedAt || 0);
      const active = lock?.active === true && ageMs >= 0 && ageMs <= GENERATOR_LIVE_LOCK_TTL_MS_38L;
      state.generatorLiveLockOwner38L = String(lock?.owner || '');
      state.generatorLiveLockAgeMs38L = Number.isFinite(ageMs) ? ageMs : null;
      return { lock, active, ageMs };
    } catch {
      state.generatorLiveLockOwner38L = '';
      state.generatorLiveLockAgeMs38L = null;
      return null;
    }
  }
  function generatorLiveOwnsMaster38L(){
    const result = readGeneratorLiveLock38L();
    return Boolean(result?.active);
  }
  function sourceOf(packet){
    return String(packet?.source || packet?.producer || packet?.meta?.source || packet?.meta?.producer || '').trim().toLowerCase();
  }
  function outputIsActive(packet){
    try {
      if (packet?.meta && packet.meta.outputEnabled === true) return true;
      if (globalThis.__ledOutputConsumerGate?.outputEnabled === true) return true;
      if (globalThis.__ledRenderCoreLastPublish?.outputEnabled === true) return true;
    } catch {}
    return false;
  }
  function shouldSuppressPreviewProducer(packet){
    const source = sourceOf(packet);
    try {
      const interlock = window.__budilightOutputWriterInterlock37BY;
      if (interlock && typeof interlock.shouldBlockPacketSource === 'function') {
        const blocked = interlock.shouldBlockPacketSource(packet, 'artnet-master-framebus-mirror');
        if (blocked && blocked.blocked === true) {
          state.previewSuppressed += 1;
          state.skipped += 1;
          state.lastSuppressedSource = source || blocked.source || 'blocked-packet-source';
          state.lastSkipReason = blocked.reason || 'writer-interlock-packet-source';
          return true;
        }
      }
    } catch {}
    if (source === 'output-owned-render' || source === 'render-pipeline') {
      state.lastOutputOwnedAt = performance.now();
      return false;
    }
    // STEP37BY: startup fallback/chase frames must never keep feeding LEDs once
    // the real master frame path is alive. Prefer blackout/no send over a fake
    // animation fighting Performance output.
    if (source === 'output-startup-fallback' || source.includes('fallback') || source.includes('visible-chase')) {
      if (outputIsActive(packet) || performance.now() - state.lastOutputOwnedAt < 1500) {
        state.previewSuppressed += 1;
        state.skipped += 1;
        state.lastSuppressedSource = source || 'fallback';
        state.lastSkipReason = 'fallback-source-suppressed-37by';
        return true;
      }
    }
    if (source !== 'preview-render') return false;
    if (!outputIsActive(packet) && performance.now() - state.lastOutputOwnedAt > 1000) return false;
    state.previewSuppressed += 1;
    state.skipped += 1;
    state.lastSuppressedSource = source || 'preview-render';
    state.lastSkipReason = 'preview-source-suppressed-37by';
    return true;
  }
  function canSend(packet, origin){
    state.enabled = isEnabled();
    state.fps = targetFps();
    updateOutputLock(state.enabled);
    if (!state.enabled) { state.lastSkipReason = 'mirror-disabled'; return false; }
    if (!packet || !(packet.frame instanceof Uint8Array)) { state.lastSkipReason = 'no-frame'; return false; }
    if (generatorLiveOwnsMaster38L()) {
      state.generatorLiveSuppressed38L += 1;
      state.skipped += 1;
      state.lastSkipReason = 'generator-live-master-owner-active-38l';
      return false;
    }
    try {
      const watchdog = window.__budilightSingleWriterWatchdog37BE;
      if (watchdog && typeof watchdog.isWriteAllowed === 'function') {
        const gate37BE = watchdog.isWriteAllowed('artnet-master-framebus-mirror');
        state.singleWriterWatchdogAllowed37BE = gate37BE && gate37BE.allowed === true;
        state.singleWriterWatchdogReason37BE = String(gate37BE && gate37BE.reason || '');
        if (!state.singleWriterWatchdogAllowed37BE) {
          state.singleWriterWatchdogDenied37BE = Number(state.singleWriterWatchdogDenied37BE || 0) + 1;
          state.skipped += 1;
          state.lastSkipReason = 'single-writer-watchdog:' + state.singleWriterWatchdogReason37BE;
          return false;
        }
      }
    } catch {}
    try {
      const registry = window.__budilightOutputRouteRegistry37BB;
      if (registry && typeof registry.canWrite === 'function') {
        const decision = registry.canWrite('artnet-master-framebus-mirror');
        state.routeRegistryAllowed = decision && decision.allowed === true;
        state.routeRegistryOwner = String(decision && decision.owner || '');
        state.routeRegistryDecision = String(decision && decision.reason || '');
        if (!state.routeRegistryAllowed) {
          state.routeRegistryDenied += 1;
          state.skipped += 1;
          state.lastSkipReason = 'route-registry-denied:' + (state.routeRegistryOwner || 'no-owner');
          return false;
        }
      }
    } catch {}
    if (state.inFlight) {
      // STEP22OA: fetch fallback may still be completing. Keep only the latest
      // packet instead of blocking the caller and dropping into visible stutter.
      state.pendingPacket = packet;
      state.pendingOrigin = origin || 'pending-latest';
      state.skipped += 1;
      state.lastSkipReason = 'upload-in-flight-latest-queued';
      return false;
    }
    const now = performance.now();

    // STEP22MA: single-writer guard. The Performance render loop may publish
    // through both a DOM event and the safety poll. Without this guard, the same
    // MASTER frame can be uploaded twice, which looks on hardware like two
    // unsynchronised ArtNet sources fighting the same universes.
    const frameId = Number(packet.frameId || 0);
    if (frameId > 0 && frameId === Number(state.lastFrameId || 0) && now - state.lastSentSignatureAt < 250) {
      state.duplicateSuppressed += 1;
      state.skipped += 1;
      state.lastSkipReason = 'duplicate-frame-id';
      return false;
    }

    // STEP22NI: no second FPS pacing in the browser mirror. Performance/rAF is
    // already the visual clock and the server also has duplicate protection.
    // Dropping unique frames here made the strip visibly step even when counters
    // showed 50+ FPS. We keep only duplicate-frame protection and WS backpressure.
    state.minSendGapMs = 0;
    state.nextDueAt = now;
    state.lastSentSignature = String(packet.frameId || 0);
    state.lastSentSignatureAt = now;
    state.sendOrigin = String(origin || 'unknown');
    state.lastSkipReason = '';
    markAccepted(now);
    return true;
  }
  async function send(packet, origin){
    if (!canSend(packet, origin)) return;
    state.lastSentAt = performance.now();
    state.lastFrameId = Number(packet.frameId || 0);
    try {
      const d = dims(packet);
      const frame = packet.frame instanceof Uint8Array ? packet.frame : new Uint8Array(packet.frame || []);
      if (wsPreferred()) {
        const ws = ensureWs();
        if (ws && ws.readyState === WebSocket.OPEN) {
          const buffered = Number(ws.bufferedAmount || 0);
          const maxBuffered = maxWsBufferedBytes(frame.byteLength + 24);
          state.wsLastBufferedAmount = buffered;
          state.wsMaxBufferedAmount = Math.max(Number(state.wsMaxBufferedAmount || 0), buffered);
          if (buffered > maxBuffered) {
            state.wsBackpressureSkips += 1;
            state.skipped += 1;
            state.lastSkipReason = 'ws-backpressure-drop-latest-only';
            return;
          }
          try {
            const registry = window.__budilightOutputRouteRegistry37BB;
            if (registry && typeof registry.markWrite === 'function') {
              const writeDecision = registry.markWrite('artnet-master-framebus-mirror', frame.byteLength);
              if (!writeDecision.allowed) {
                state.routeRegistryDenied += 1;
                state.skipped += 1;
                state.lastSkipReason = 'route-registry-write-denied:' + String(writeDecision.owner || 'no-owner');
                return;
              }
              state.routeRegistryWrites += 1;
            }
          } catch {}
          ws.send(buildWsPacket(packet, d, frame));
          const wsState = getWsRuntime();
          wsState.sent += 1;
          state.sent += 1;
          state.lastBytes = frame.byteLength;
          state.lastStatus = { ok: true, status: 101, transport: 'websocket-master-frame' };
          state.lastError = '';
          return;
        }
      }
      const url = '/api/artnet/master-mirror/frame-bin?' + queryPrefix(packet, d) + String(packet.frameId || 0);
      try {
        const registry = window.__budilightOutputRouteRegistry37BB;
        if (registry && typeof registry.markWrite === 'function') {
          const writeDecision = registry.markWrite('artnet-master-framebus-mirror', frame.byteLength);
          if (!writeDecision.allowed) {
            state.routeRegistryDenied += 1;
            state.skipped += 1;
            state.lastSkipReason = 'route-registry-fetch-write-denied:' + String(writeDecision.owner || 'no-owner');
            return;
          }
          state.routeRegistryWrites += 1;
        }
      } catch {}
      state.inFlight = true;
      const res = await fetch(url, {
        method: 'POST',
        cache: 'no-store',
        keepalive: false,
        headers: { 'Content-Type': 'application/octet-stream' },
        body: frame
      });
      if (!res.ok) throw new Error(res.statusText || 'master mirror upload failed');
      getWsRuntime().fallbackFetch += 1;
      state.sent += 1;
      state.lastBytes = frame.byteLength;
      state.lastStatus = { ok: true, status: res.status, transport: 'fetch-fallback' };
      state.lastError = '';
    } catch (error) {
      state.errors += 1;
      state.lastError = String(error && error.message || error || 'artnet master mirror failed').slice(0, 300);
    } finally {
      state.inFlight = false;
      const pending = state.pendingPacket;
      const pendingOrigin = state.pendingOrigin || 'pending-latest';
      state.pendingPacket = null;
      state.pendingOrigin = '';
      if (pending && pending.frame instanceof Uint8Array) {
        managedTimeout37CG('artnet:pending-latest-packet', () => { try { processPacket(pending, pendingOrigin); } catch {} }, 0, { managed: false });
      }
    }
  }

  function getLatestPacket(reason){
    const bus = window.__ledFrameBus;
    if (!bus || typeof bus.getLatestFrame !== 'function') return null;
    try {
      return bus.getLatestFrame({
        consumer: 'artnet-master-mirror-22ej',
        cloneFrame: false,
        reason: reason || 'artnet-master-mirror'
      });
    } catch (error) {
      state.lastError = String(error && error.message || error || 'framebus read failed').slice(0, 300);
      return null;
    }
  }

  function processPacket(packet, origin){
    if (!packet || !(packet.frame instanceof Uint8Array)) return;
    if (shouldSuppressPreviewProducer(packet)) return;
    const frameId = Number(packet.frameId || 0);
    if (frameId > 0 && frameId === state.lastSeenFrameId && origin !== 'poll-force') return;
    if (frameId > 0) state.lastSeenFrameId = frameId;
    if (origin === 'event') state.lastEventAt = Date.now();
    broadcast(packet);
    send(packet, origin);
  }


  let channel = null;
  try {
    if (broadcastEnabled() && 'BroadcastChannel' in window) channel = new BroadcastChannel(CHANNEL_NAME);
  } catch { channel = null; }

  function broadcast(packet){
    if (!channel || !packet || !(packet.frame instanceof Uint8Array)) return;
    try {
      const d = dims(packet);
      channel.postMessage({
        type: 'master-frame',
        version: 'STEP22LF_BROWSER_MASTER_FRAME_CHANNEL',
        at: Date.now(),
        frameId: Number(packet.frameId || 0),
        source: packet.source || 'performance-framebus-browser-channel',
        stripCount: d.stripCount,
        pixelsPerStrip: d.pixelsPerStrip,
        width: Number(packet.width || d.width),
        height: Number(packet.height || d.height),
        format: packet.format || 'rgb8',
        colorOrder: packet.colorOrder || 'rgb',
        buffer: packet.frame.slice().buffer
      });
      state.broadcastSent += 1;
      state.lastBroadcastAt = Date.now();
    } catch (error) {
      state.broadcastErrors += 1;
      state.lastError = String(error && error.message || error || 'master broadcast failed').slice(0, 300);
    }
  }


  function registerDirectFrameBusConsumer(){
    try {
      if (state.directConsumerRegistered) return;
      const root = window;
      if (!Array.isArray(root.__ledFrameBusDirectConsumers)) root.__ledFrameBusDirectConsumers = [];
      root.__ledFrameBusPreferDirectPublish = true;
      const handler = function(packet){ processPacket(packet, 'direct'); };
      root.__ledFrameBusDirectConsumers.push({ name: 'artnet-master-mirror-22ej', handler });
      state.directConsumerRegistered = true;
    } catch {}
  }

  registerDirectFrameBusConsumer();

  window.addEventListener('led-framebus-publish', function(event){
    // STEP37AK: fastest possible disabled path. When the ArtNet master mirror
    // and BroadcastChannel mirror are both off, this listener must not read
    // FrameBus or allocate packet metadata on every visual frame.
    refreshConfigCache(false);
    if (state.configCacheEnabled === false && !channel) {
      state.enabled = false;
      state.lastSkipReason = 'mirror-disabled-fast-skip';
      return;
    }
    // STEP22NP: use the packet already attached to the frame-bus event.
    // The old path did a fresh getLatestFrame() on every frame, which updated
    // consumer diagnostics and allocated bookkeeping at the exact moment the
    // browser should be feeding the ArtNet WS path. Fallback stays for older
    // frame_bus versions.
    const packet = event?.detail?.packet && event.detail.packet.frame instanceof Uint8Array
      ? event.detail.packet
      : getLatestPacket('post-to-server-artnet-master-frame');
    processPacket(packet, 'event');
  });

  window.__setBudilightArtNetMasterMirror22EJ = function(enabled, fps){
    try { localStorage.setItem(FLAG, enabled ? '1' : '0'); } catch {}
    if (fps != null) { try { localStorage.setItem(FPS_KEY, String(Math.max(1, Math.min(60, Number(fps) || DEFAULT_FPS)))); } catch {} }
    state.enabled = isEnabled();
    state.fps = targetFps();
    return { ...state };
  };

  function refreshConfigStateNow(){
    refreshConfigCache(true);
    state.enabled = state.configCacheEnabled !== false;
    state.fps = state.configCacheFps || DEFAULT_FPS;
    updateOutputLock(state.enabled);
    updateActualFps(performance.now());
  }
  window.addEventListener?.('storage', function(event){
    if (!event || event.key === FLAG || event.key === FPS_KEY || event.key === GENERATOR_LIVE_LOCK_KEY_38L) refreshConfigStateNow();
  });
  managedInterval37CG('artnet:refresh-config-state', refreshConfigStateNow, 8000, { liveFactor: 2, hiddenFactor: 3, maxMs: 30000 });
  // STEP22MD: removed the old 125ms disabled poll loop completely.
  // It no longer uploaded frames, but it still woke the browser 8×/sec while
  // Performance preview and ArtNet were fighting for frame time. Master upload
  // is event-driven from led-framebus-publish only.
})();
