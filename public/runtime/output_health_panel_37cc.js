/* STEP37DJ_LEGACY_HEALTH_PANEL_DISABLED: superseded by output_health_panel_37cd.js.
   Keep this file as a harmless compatibility stub if an old cached page imports it. */
(function(){
  try { window.__budilightLegacyOutputHealthDisabled37DJ = { version:'STEP37DJ_LEGACY_HEALTH_PANEL_DISABLED', file:'output_health_panel_37cc.js', updatedAt:Date.now() }; } catch {}
  return;
})();
/* STEP37CC: Output Health moved into the Debug preview tab.
   Replaces the old floating Performance health widget with one clean Debug screen.
   Passive only: reads runtime/server snapshots, never publishes frames or claims output. */
(function(){
  const NAME = '__budilightOutputHealth37CC';
  const VERSION = 'STEP37CC_DEBUG_HEALTH_ONLY_GATE';
  const POLL_MS = 1800;
  const RENDER_MS = 900;

  const state = window[NAME] && window[NAME].version === VERSION && window[NAME]._state
    ? window[NAME]._state
    : {
        installedAt: Date.now(), updatedAt: 0, lastPipeline: null, lastServerPollAt: 0,
        server: { syncLive: null, masterMirror: null, error: '', okAt: 0 },
        lastSnapshot: null, lastRenderSig: ''
      };

  function now(){ return Date.now(); }
  function s(v, fallback=''){ return String(v == null ? fallback : v); }
  function n(v, fallback=0){ const x = Number(v); return Number.isFinite(x) ? x : fallback; }
  function clone(v){ try { return JSON.parse(JSON.stringify(v)); } catch { return null; } }
  function get(name){ try { return window[name] || null; } catch { return null; } }
  function isDebugActive(){
    try {
      if (document.hidden) return false;
      if (document.body?.dataset?.previewMode === 'debug') return true;
      const btn = document.getElementById('previewTabDebug');
      return !!btn?.classList?.contains('active');
    } catch { return false; }
  }
  function publishInactive(){
    try { window.__budilightOutputHealthSnapshot37CC = { version: VERSION, active:false, reason:'debug-tab-inactive', updatedAt: now() }; } catch {}
  }
  function callSnapshot(obj){ try { return obj && typeof obj.snapshot === 'function' ? obj.snapshot() : null; } catch { return null; } }
  function ageMs(ts){ const t = n(ts, 0); return t ? Math.max(0, now() - t) : null; }
  function fmtFps(v){ const x = n(v, NaN); return Number.isFinite(x) && x > 0 ? `${x.toFixed(x >= 10 ? 1 : 2)} fps` : '--'; }
  function fmtMs(v){ const x = n(v, NaN); return Number.isFinite(x) ? `${Math.round(x)} ms` : '--'; }
  function esc(v){ return s(v).replace(/[&<>"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch])); }
  function cls(level){ const x = s(level).toUpperCase(); return x === 'OK' || x === 'LIVE' ? 'ok' : x === 'WARN' || x === 'WAIT' || x === 'IDLE' ? 'warn' : 'bad'; }

  function registrySnapshot(){
    const reg = get('__budilightOutputRouteRegistry37BB');
    const snap = callSnapshot(reg) || clone(get('__budilightOutputRouteRegistrySnapshot37BB'));
    if (snap) return snap;
    const lock = get('__budilightOutputLock37AP');
    return lock ? { active: !!lock.active, owner: lock.owner || lock.source || 'legacy-lock', updatedAt: lock.updatedAt || 0 } : null;
  }
  function frameBusSnapshot(){
    const bus = get('__budilightFrameBus');
    if (!bus) return null;
    const snap = callSnapshot(bus) || (typeof bus.getSnapshot === 'function' ? bus.getSnapshot() : null);
    if (snap) return snap;
    const last = bus.lastFrame || bus.frame || null;
    return { hasFrame: !!last, lastSource: last?.source || bus.lastSource || '', lastFrameAgeMs: ageMs(last?.timestamp || bus.lastFrameAt || bus.updatedAt) };
  }
  function mirrorSnapshot(name){
    const m = get(name);
    if (!m) return null;
    return callSnapshot(m) || clone(m.lastStatus || m.status || m.snapshot || m);
  }
  function artnetMetrics(){
    const candidates = [
      get('__budilightArtnetMasterFramebusMirror22EJ'),
      get('__budilightArtNetMasterMirror22EJ'),
      get('__budilightArtnetBrowserMirror22EJ')
    ].filter(Boolean);
    for (const c of candidates) {
      const snap = callSnapshot(c) || clone(c.lastStatus || c.status || c);
      if (snap) return snap;
    }
    return null;
  }
  function pipelineFromEvent(detail){ if (detail && typeof detail === 'object') state.lastPipeline = { ...detail, receivedAt: now() }; }
  try { window.addEventListener('led-output-pipeline-stats', ev => pipelineFromEvent(ev && ev.detail)); } catch {}

  async function fetchJson(url){
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText || ''}`.trim());
    return res.json();
  }
  async function pollServer(force=false){
    if (!force && !isDebugActive()) { publishInactive(); return; }
    if (!force && now() - n(state.lastServerPollAt) < POLL_MS) return;
    state.lastServerPollAt = now();
    try {
      const [syncLive, masterMirror] = await Promise.all([
        fetchJson('/api/artnet/sync-live/status').catch(error => ({ ok:false, error:s(error && error.message || error) })),
        fetchJson('/api/artnet/master-mirror/status').catch(error => ({ ok:false, error:s(error && error.message || error) }))
      ]);
      state.server = { syncLive, masterMirror, error: '', okAt: now() };
    } catch (error) {
      state.server.error = s(error && error.message || error);
    }
  }

  function deriveVerdict(parts){
    const registry = parts.registry || {};
    const interlock = parts.interlock || {};
    const deep = parts.deep || {};
    const syncLive = parts.server?.syncLive || {};
    const guard = syncLive.backendWriterGuard37BZ || syncLive.lastSendResult?.backendWriterGuard37BZ || null;
    const pipeline = parts.pipeline || {};
    const frameBus = parts.frameBus || {};
    const problems = [];
    const warnings = [];
    if (deep?.verdict && deep.verdict.ok === false) problems.push(deep.verdict.message || deep.verdict.status || 'writer conflict');
    if (registry.active === true && interlock.activeTrustedOwner && registry.owner && registry.owner !== interlock.activeTrustedOwner) warnings.push(`registry owner ${registry.owner}`);
    const blocked = n(interlock.lowTrustDenied) + n(interlock.packetSourceDenied);
    if (blocked > 0) warnings.push(`blocked ${blocked} low-trust writes`);
    if (guard && guard.allowed === false) problems.push(guard.reason || 'backend writer blocked');
    if (syncLive.running && n(syncLive.actualFps) > 0 && n(syncLive.actualFps) < 45) warnings.push(`backend FPS ${fmtFps(syncLive.actualFps)}`);
    if (pipeline.health && !['OK','IDLE','READY'].includes(s(pipeline.health).toUpperCase())) warnings.push(`pipeline ${pipeline.health}`);
    if (frameBus?.hasFrame && n(frameBus.lastFrameAgeMs) > 750) warnings.push(`old master frame ${fmtMs(frameBus.lastFrameAgeMs)}`);
    if (parts.server?.error) warnings.push(`server poll ${parts.server.error}`);
    return { ok: problems.length === 0, level: problems.length ? 'BAD' : warnings.length ? 'WARN' : 'OK', message: problems[0] || warnings[0] || 'single writer path clean', problems, warnings };
  }

  function snapshot(){
    const parts = {
      version: VERSION,
      active: isDebugActive(),
      installedAt: state.installedAt,
      updatedAt: now(),
      pipeline: clone(state.lastPipeline),
      registry: registrySnapshot(),
      watchdog: callSnapshot(get('__budilightSingleWriterWatchdog37BE')) || clone(get('__budilightSingleWriterWatchdogSnapshot37BE')),
      deep: callSnapshot(get('__budilightSingleWriterDeepReport37BX')) || clone(get('__budilightSingleWriterDeepReportSnapshot37BX')),
      interlock: callSnapshot(get('__budilightOutputWriterInterlock37BY')) || clone(get('__budilightOutputWriterInterlockSnapshot37BY')),
      liveGate: callSnapshot(get('__budilightLiveOutputGate37BW')) || clone(get('__budilightLiveOutputGateSnapshot37BW')),
      frameBus: frameBusSnapshot(),
      browser: { artnet: artnetMetrics(), serial: mirrorSnapshot('__budilightLiveSerialMirror22CR') || mirrorSnapshot('__budilightLiveSerialAppMirror22CR') },
      server: clone(state.server)
    };
    parts.verdict = deriveVerdict(parts);
    state.updatedAt = parts.updatedAt;
    state.lastSnapshot = parts;
    try { window.__budilightOutputHealthSnapshot37CC = parts; } catch {}
    return parts;
  }

  function styleOnce(){
    if (document.getElementById('outputHealthStyle37CC')) return;
    const st = document.createElement('style');
    st.id = 'outputHealthStyle37CC';
    st.textContent = `
      .debug-output-health-37cc{padding:14px;overflow:auto;background:radial-gradient(circle at 12% 0%,rgba(0,255,210,.12),transparent 34%),rgba(0,0,0,.22)}
      .debug-output-health-mount-37cc{display:grid;gap:12px;min-height:100%;font:12px/1.35 system-ui,-apple-system,Segoe UI,sans-serif;color:#dff}
      .oh37cc-hero{display:grid;grid-template-columns:1.1fr .9fr;gap:12px;align-items:stretch}.oh37cc-card{border:1px solid rgba(255,255,255,.10);background:rgba(3,10,18,.76);border-radius:16px;padding:13px;box-shadow:0 12px 34px rgba(0,0,0,.25)}
      .oh37cc-verdict{display:flex;align-items:center;gap:12px}.oh37cc-dot{width:18px;height:18px;border-radius:50%;background:#7b8794;box-shadow:0 0 18px currentColor}.oh37cc-verdict.ok .oh37cc-dot{background:#20f3a2;color:#20f3a2}.oh37cc-verdict.warn .oh37cc-dot{background:#ffc857;color:#ffc857}.oh37cc-verdict.bad .oh37cc-dot{background:#ff4f6d;color:#ff4f6d}.oh37cc-verdict strong{display:block;font-size:24px;letter-spacing:.05em}.oh37cc-verdict small{display:block;opacity:.72;margin-top:2px}
      .oh37cc-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.oh37cc-kpi{border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.035);border-radius:13px;padding:10px;min-height:58px}.oh37cc-kpi span{display:block;opacity:.58;font-size:10px;text-transform:uppercase;letter-spacing:.09em}.oh37cc-kpi b{display:block;font-size:17px;margin-top:4px;font-variant-numeric:tabular-nums}.oh37cc-kpi small{display:block;opacity:.55;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .oh37cc-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.oh37cc-table{display:grid;gap:5px}.oh37cc-row{display:flex;justify-content:space-between;gap:12px;border-bottom:1px solid rgba(255,255,255,.07);padding:5px 0}.oh37cc-row span{opacity:.62}.oh37cc-row b{text-align:right;font-variant-numeric:tabular-nums}.oh37cc-list{display:grid;gap:7px}.oh37cc-chip{border:1px solid rgba(255,255,255,.09);border-radius:999px;padding:7px 10px;background:rgba(255,255,255,.035)}.oh37cc-chip.ok{border-color:rgba(32,243,162,.28)}.oh37cc-chip.warn{border-color:rgba(255,200,87,.32)}.oh37cc-chip.bad{border-color:rgba(255,79,109,.34)}
      .oh37cc-actions{display:flex;gap:8px;flex-wrap:wrap}.oh37cc-actions button{border:1px solid rgba(255,255,255,.14);border-radius:999px;background:rgba(255,255,255,.06);color:#dff;padding:8px 11px;cursor:pointer}.oh37cc-pre{max-height:260px;overflow:auto;white-space:pre-wrap;font:11px/1.35 ui-monospace,SFMono-Regular,Consolas,monospace;color:#bde;background:rgba(0,0,0,.25);border-radius:12px;padding:10px;border:1px solid rgba(255,255,255,.08)}
      .debug-output-health-loading-37cc{border:1px dashed rgba(0,255,210,.25);border-radius:14px;padding:16px;background:rgba(0,0,0,.22)}
      @media(max-width:900px){.oh37cc-hero,.oh37cc-grid{grid-template-columns:1fr}.oh37cc-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}}
    `;
    document.head.appendChild(st);
  }
  function row(k,v){ return `<div class="oh37cc-row"><span>${esc(k)}</span><b>${esc(v)}</b></div>`; }
  function kpi(k,v,sub=''){ return `<article class="oh37cc-kpi"><span>${esc(k)}</span><b>${esc(v)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</article>`; }
  function chip(text, level='ok'){ return `<div class="oh37cc-chip ${cls(level)}">${esc(text)}</div>`; }

  function render(snap){
    styleOnce();
    const mount = document.getElementById('debugOutputHealthMount37CC');
    const pill = document.getElementById('dbgOutputHealthPill37CC');
    if (!mount || !snap) return;
    if (!isDebugActive()) {
      if (pill) { pill.textContent = 'SLEEP'; pill.className = 'debug-live-pill oh37cc-pill-warn'; }
      const sigSleep = 'sleep';
      if (state.lastRenderSig !== sigSleep) {
        state.lastRenderSig = sigSleep;
        mount.innerHTML = `<article class="debug-output-health-loading-37cc"><strong>Output Health sleeping</strong><small>Aktivuj DEBUG tab. Metriky jsou schválně uspané mimo Debug, aby nebrzdily output.</small></article>`;
      }
      return;
    }
    const verdict = snap.verdict || {};
    if (pill) { pill.textContent = s(verdict.level || 'WAIT'); pill.className = `debug-live-pill oh37cc-pill-${cls(verdict.level)}`; }
    const pipeline = snap.pipeline || {};
    const registry = snap.registry || {};
    const syncLive = snap.server?.syncLive || {};
    const masterMirror = snap.server?.masterMirror || {};
    const guard = syncLive.backendWriterGuard37BZ || syncLive.lastSendResult?.backendWriterGuard37BZ || {};
    const frameBus = snap.frameBus || {};
    const interlock = snap.interlock || {};
    const deep = snap.deep || {};
    const watchdog = snap.watchdog || {};
    const gate = snap.liveGate || {};
    const artnet = snap.browser?.artnet || {};
    const serial = snap.browser?.serial || {};
    const warnings = [...(verdict.problems || []).map(x => [x,'bad']), ...(verdict.warnings || []).map(x => [x,'warn'])];
    const sig = JSON.stringify({ level: verdict.level, msg: verdict.message, p:pipeline, r:registry, s:syncLive, g:guard, f:frameBus, i:interlock, w:warnings });
    if (sig === state.lastRenderSig) return;
    state.lastRenderSig = sig;
    mount.innerHTML = `
      <div class="oh37cc-hero">
        <article class="oh37cc-card oh37cc-verdict ${cls(verdict.level)}">
          <span class="oh37cc-dot"></span>
          <div><strong>${esc(verdict.level || 'WAIT')}</strong><small>${esc(verdict.message || 'waiting for output health')}</small></div>
        </article>
        <article class="oh37cc-card oh37cc-actions">
          <button type="button" data-oh37cc="copy">Copy snapshot</button>
          <button type="button" data-oh37cc="log">Log to console</button>
          <button type="button" data-oh37cc="poll">Refresh server</button>
        </article>
      </div>
      <section class="oh37cc-kpis">
        ${kpi('Backend FPS', fmtFps(syncLive.actualFps), syncLive.running ? 'sync-live running' : 'sync-live idle')}
        ${kpi('Pipeline FPS', fmtFps(pipeline.sentFps || pipeline.targetFps), pipeline.schedulerActive ? `scheduler ${fmtMs(pipeline.schedulerDelayMs)}` : 'scheduler idle')}
        ${kpi('Frame age', frameBus.hasFrame ? fmtMs(frameBus.lastFrameAgeMs) : '--', frameBus.lastSource || 'no master frame')}
        ${kpi('Blocked writes', String(n(interlock.lowTrustDenied) + n(interlock.packetSourceDenied)), 'frontend interlock')}
      </section>
      <section class="oh37cc-grid">
        <article class="oh37cc-card"><h4>Writer / FrameBus</h4><div class="oh37cc-table">
          ${row('Registry owner', registry.active ? s(registry.owner || 'active') : 'idle')}
          ${row('Trusted owner', s(interlock.activeTrustedOwner || '--'))}
          ${row('Frame source', s(frameBus.lastSource || '--'))}
          ${row('FrameBus status', s(frameBus.gates?.status || frameBus.health || (frameBus.hasFrame ? 'HAS_FRAME' : 'NO_FRAME')))}
          ${row('Watchdog', s(watchdog.verdict?.level || watchdog.status || watchdog.health || '--'))}
          ${row('Deep report', s(deep.verdict?.level || deep.verdict?.status || '--'))}
        </div></article>
        <article class="oh37cc-card"><h4>Backend / Guard</h4><div class="oh37cc-table">
          ${row('Sync-live', syncLive.running ? 'RUNNING' : 'IDLE')}
          ${row('Master mirror', masterMirror.running || masterMirror.enabled ? 'RUNNING' : s(masterMirror.status || 'IDLE'))}
          ${row('Backend guard', `${n(guard.allowedCount)} ok / ${n(guard.blockedCount)} block`)}
          ${row('Last guard allowed', guard.allowed === false ? 'NO' : guard.allowed === true ? 'YES' : '--')}
          ${row('Server poll', snap.server?.error ? `ERR ${snap.server.error}` : (snap.server?.okAt ? `${fmtMs(ageMs(snap.server.okAt))} ago` : '--'))}
          ${row('Live gate', gate.live ? 'LIVE' : s(gate.mode || gate.status || 'idle'))}
        </div></article>
        <article class="oh37cc-card"><h4>Scheduler / Queue</h4><div class="oh37cc-table">
          ${row('Pipeline health', s(pipeline.health || '--'))}
          ${row('Pressure', s(pipeline.pressure || '--'))}
          ${row('Queue depth', String(n(pipeline.queueDepth)))}
          ${row('Late frames', String(n(pipeline.lateFrames)))}
          ${row('Dropped frames', String(n(pipeline.droppedFrames || pipeline.drops)))}
          ${row('Latency avg/max', `${fmtMs(pipeline.latencyAvgMs)} / ${fmtMs(pipeline.latencyMaxMs)}`)}
        </div></article>
        <article class="oh37cc-card"><h4>Browser mirrors</h4><div class="oh37cc-table">
          ${row('ArtNet browser', artnet.enabled || artnet.ok ? 'ON' : s(artnet.status || 'idle'))}
          ${row('ArtNet fps', fmtFps(artnet.fps || artnet.actualFps || artnet.sentFps))}
          ${row('Serial browser', serial.enabled || serial.ok ? 'ON' : s(serial.status || 'idle'))}
          ${row('Serial fps', fmtFps(serial.fps || serial.actualFps || serial.sentFps))}
          ${row('Updated', `${fmtMs(ageMs(snap.updatedAt))} ago`)}
          ${row('Version', VERSION.replace('STEP37CC_',''))}
        </div></article>
      </section>
      <article class="oh37cc-card"><h4>Warnings / conflicts</h4><div class="oh37cc-list">${warnings.length ? warnings.map(([x,l]) => chip(x,l)).join('') : chip('No active writer conflict detected','ok')}</div></article>
      <details class="oh37cc-card"><summary>Raw snapshot</summary><pre class="oh37cc-pre">${esc(JSON.stringify(snap, null, 2))}</pre></details>
    `;
    mount.querySelector('[data-oh37cc="copy"]')?.addEventListener('click', async () => {
      const text = JSON.stringify(snapshot(), null, 2);
      try { await navigator.clipboard.writeText(text); } catch { console.log('[37CC Output Health]', text); }
    });
    mount.querySelector('[data-oh37cc="log"]')?.addEventListener('click', () => console.log('[37CC Output Health]', snapshot()));
    mount.querySelector('[data-oh37cc="poll"]')?.addEventListener('click', () => pollServer(true).finally(() => render(snapshot())));
  }

  const api = { version: VERSION, _state: state, snapshot, render: () => render(snapshot()), pollServer };
  try { window[NAME] = api; } catch {}
  try { window.__budilightOutputHealthSnapshot37CC = snapshot(); } catch {}
  // STEP37DG: legacy health panel polling is debug/control-plane work.
  // Keep the same visible panel behavior, but let the central loop registry
  // slow it down during live output and when the view is hidden.
  function healthTick37DG() { pollServer(false).finally(() => render(snapshot())); }
  try {
    const loops = window.__budilightRuntimeLoopRegistry37CE;
    if (loops && typeof loops.timeout === 'function') loops.timeout('output-health:37cc:initial', () => pollServer(false).finally(() => render(snapshot())), 300, { group: 'output-health', managed: false });
    else setTimeout(() => pollServer(false).finally(() => render(snapshot())), 300);
  } catch {}
  try {
    const loops = window.__budilightRuntimeLoopRegistry37CE;
    if (loops && typeof loops.adaptiveInterval === 'function') {
      loops.adaptiveInterval('output-health:37cc:poll', healthTick37DG, RENDER_MS, { group: 'output-health', liveFactor: 2.5, hiddenFactor: 6, maxMs: 10000, skipWhenHidden: true });
    } else {
      setInterval(healthTick37DG, RENDER_MS);
    }
  } catch { try { setInterval(healthTick37DG, RENDER_MS); } catch {} }
})();
