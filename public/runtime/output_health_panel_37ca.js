/* STEP37DJ_LEGACY_HEALTH_PANEL_DISABLED: superseded by output_health_panel_37cd.js.
   Keep this file as a harmless compatibility stub if an old cached page imports it. */
(function(){
  try { window.__budilightLegacyOutputHealthDisabled37DJ = { version:'STEP37DJ_LEGACY_HEALTH_PANEL_DISABLED', file:'output_health_panel_37ca.js', updatedAt:Date.now() }; } catch {}
  return;
})();
/* STEP37CA: unified Output Health panel.
   One passive, throttled frontend snapshot for the whole physical-output path:
   scheduler, route registry, single-writer watchdog, hard interlock, deep report,
   FrameBus and backend ArtNet guards. It never sends frames and never claims output. */
(function(){
  const NAME = '__budilightOutputHealth37CA';
  const VERSION = 'STEP37CA_OUTPUT_HEALTH_PANEL';
  const POLL_MS = 1800;
  const RENDER_MS = 1200;

  const state = window[NAME] && window[NAME].version === VERSION && window[NAME]._state
    ? window[NAME]._state
    : {
        installedAt: Date.now(),
        updatedAt: 0,
        open: false,
        lastPipeline: null,
        lastServerPollAt: 0,
        server: { syncLive: null, masterMirror: null, error: '', okAt: 0 },
        dom: null,
        lastSnapshot: null
      };

  function now(){ return Date.now(); }
  function s(v, fallback=''){ return String(v == null ? fallback : v); }
  function n(v, fallback=0){ const x = Number(v); return Number.isFinite(x) ? x : fallback; }
  function b(v){ return v === true; }
  function clone(v){ try { return JSON.parse(JSON.stringify(v)); } catch { return null; } }
  function get(name){ try { return window[name] || null; } catch { return null; } }
  function callSnapshot(obj){ try { return obj && typeof obj.snapshot === 'function' ? obj.snapshot() : null; } catch { return null; } }
  function ageMs(ts){ const t = n(ts, 0); return t ? Math.max(0, now() - t) : null; }
  function fmtMs(v){ if (v == null) return '--'; const x = n(v, 0); return x >= 1000 ? `${(x/1000).toFixed(1)}s` : `${Math.round(x)}ms`; }
  function fmtFps(v){ const x = n(v, 0); return x ? x.toFixed(1) : '--'; }
  function cssStatus(ok, warn){ return ok ? 'ok' : warn ? 'warn' : 'bad'; }

  function registrySnapshot(){
    try {
      const reg = get('__budilightOutputRouteRegistry37BB');
      if (reg && typeof reg.snapshot === 'function') return reg.snapshot();
      if (typeof window.__budilightOutputRouteRegistrySnapshot37BB === 'function') return window.__budilightOutputRouteRegistrySnapshot37BB();
    } catch {}
    return null;
  }
  function frameBusSnapshot(){
    try {
      const bus = get('__ledFrameBus');
      const stats = bus && typeof bus.getStats === 'function' ? bus.getStats() : null;
      if (!stats) return null;
      return {
        hasFrame: b(stats.hasFrame),
        latestFrameId: n(stats.latestFrameId),
        byteLength: n(stats.byteLength),
        lastSource: s(stats.lastSource || stats.lastProducer || ''),
        lastFrameAgeMs: n(stats.lastFrameAgeMs, 0),
        listenerCount: n(stats.listenerCount),
        consumerCount: n(stats.consumerCount),
        health: clone(stats.health)
      };
    } catch {}
    return null;
  }
  function mirrorSnapshot(name){
    const raw = get(name);
    if (!raw) return null;
    if (typeof raw.snapshot === 'function') return clone(raw.snapshot());
    if (typeof raw.getMetrics === 'function') return clone(raw.getMetrics());
    return clone(raw);
  }
  function pipelineFromEvent(detail){
    if (!detail || typeof detail !== 'object') return;
    state.lastPipeline = { ...detail, receivedAt: now() };
  }
  try { window.addEventListener('led-output-pipeline-stats', (ev) => pipelineFromEvent(ev && ev.detail)); } catch {}

  async function fetchJson(url){
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText || ''}`.trim());
    return res.json();
  }
  async function pollServer(force=false){
    if (!force && now() - n(state.lastServerPollAt) < POLL_MS) return;
    state.lastServerPollAt = now();
    try {
      const [syncLive, masterMirror] = await Promise.all([
        fetchJson('/api/artnet/sync-live/status').catch((error) => ({ ok:false, error:s(error && error.message || error) })),
        fetchJson('/api/artnet/master-mirror/status').catch((error) => ({ ok:false, error:s(error && error.message || error) }))
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
    if (n(interlock.lowTrustDenied) > 0 || n(interlock.packetSourceDenied) > 0) warnings.push(`blocked ${n(interlock.lowTrustDenied) + n(interlock.packetSourceDenied)} low-trust writes`);
    if (guard && guard.allowed === false) problems.push(guard.reason || 'backend writer blocked');
    if (syncLive.running && n(syncLive.actualFps) > 0 && n(syncLive.actualFps) < 45) warnings.push(`backend FPS ${fmtFps(syncLive.actualFps)}`);
    if (pipeline.health && !['OK','IDLE','READY'].includes(String(pipeline.health).toUpperCase())) warnings.push(`pipeline ${pipeline.health}`);
    if (frameBus.hasFrame && n(frameBus.lastFrameAgeMs) > 750) warnings.push(`old master frame ${fmtMs(frameBus.lastFrameAgeMs)}`);
    if (parts.server?.error) warnings.push(`server poll ${parts.server.error}`);
    const ok = problems.length === 0;
    return {
      ok,
      level: problems.length ? 'BAD' : warnings.length ? 'WARN' : 'OK',
      message: problems[0] || warnings[0] || 'single writer path clean',
      problems,
      warnings
    };
  }

  function snapshot(){
    const parts = {
      version: VERSION,
      installedAt: state.installedAt,
      updatedAt: now(),
      pipeline: clone(state.lastPipeline),
      registry: registrySnapshot(),
      watchdog: callSnapshot(get('__budilightSingleWriterWatchdog37BE')) || clone(get('__budilightSingleWriterWatchdogSnapshot37BE')),
      deep: callSnapshot(get('__budilightSingleWriterDeepReport37BX')) || clone(get('__budilightSingleWriterDeepReportSnapshot37BX')),
      interlock: callSnapshot(get('__budilightOutputWriterInterlock37BY')) || clone(get('__budilightOutputWriterInterlockSnapshot37BY')),
      liveGate: callSnapshot(get('__budilightLiveOutputGate37BW')) || clone(get('__budilightLiveOutputGateSnapshot37BW')),
      frameBus: frameBusSnapshot(),
      browser: {
        artnet: mirrorSnapshot('__budilightArtNetMasterMirror22EJ'),
        serial: mirrorSnapshot('__budilightLiveSerialMirror22CR') || mirrorSnapshot('__budilightLiveSerialAppMirror22CR')
      },
      server: clone(state.server)
    };
    parts.verdict = deriveVerdict(parts);
    state.updatedAt = parts.updatedAt;
    state.lastSnapshot = parts;
    try { window.__budilightOutputHealthSnapshot37CA = parts; } catch {}
    return parts;
  }

  function ensureDom(){
    if (state.dom && document.body && document.body.contains(state.dom.root)) return state.dom;
    if (!document.body) return null;
    const style = document.createElement('style');
    style.textContent = `
      .output-health-37ca{position:fixed;right:12px;bottom:12px;z-index:99999;font:12px/1.35 system-ui,-apple-system,Segoe UI,sans-serif;color:#dff;background:rgba(4,10,18,.88);border:1px solid rgba(0,255,210,.28);box-shadow:0 10px 40px rgba(0,0,0,.45);backdrop-filter:blur(10px);border-radius:14px;overflow:hidden;max-width:min(520px,calc(100vw - 24px))}
      .output-health-37ca button{all:unset;cursor:pointer;box-sizing:border-box}.output-health-37ca .head{display:flex;gap:10px;align-items:center;padding:9px 11px}.output-health-37ca .dot{width:10px;height:10px;border-radius:50%;background:#7b8794;box-shadow:0 0 12px currentColor}.output-health-37ca.ok .dot{background:#20f3a2;color:#20f3a2}.output-health-37ca.warn .dot{background:#ffc857;color:#ffc857}.output-health-37ca.bad .dot{background:#ff4f6d;color:#ff4f6d}.output-health-37ca .title{font-weight:800;letter-spacing:.04em}.output-health-37ca .msg{opacity:.78;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:310px}.output-health-37ca .body{display:none;border-top:1px solid rgba(255,255,255,.08);padding:10px 11px 11px}.output-health-37ca.is-open .body{display:block}.output-health-37ca .grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px 12px}.output-health-37ca .kv{display:flex;justify-content:space-between;gap:8px;border-bottom:1px solid rgba(255,255,255,.055);padding:3px 0}.output-health-37ca .k{opacity:.65}.output-health-37ca .v{font-variant-numeric:tabular-nums;text-align:right}.output-health-37ca .actions{display:flex;gap:8px;margin-top:9px}.output-health-37ca .pill{padding:4px 8px;border:1px solid rgba(255,255,255,.14);border-radius:999px;background:rgba(255,255,255,.05)}
    `;
    const root = document.createElement('section');
    root.className = 'output-health-37ca';
    root.innerHTML = `<button class="head" type="button" title="Output Health 37CA"><span class="dot"></span><span class="title">OUTPUT HEALTH</span><span class="msg">starting…</span></button><div class="body"><div class="grid"></div><div class="actions"><button class="pill" type="button" data-action="copy">Copy snapshot</button><button class="pill" type="button" data-action="close">Hide</button></div></div>`;
    document.head.appendChild(style);
    document.body.appendChild(root);
    const dom = { root, head: root.querySelector('.head'), msg: root.querySelector('.msg'), grid: root.querySelector('.grid') };
    dom.head.addEventListener('click', () => { state.open = !state.open; root.classList.toggle('is-open', state.open); render(snapshot()); });
    root.querySelector('[data-action="close"]')?.addEventListener('click', () => { state.open = false; root.classList.remove('is-open'); });
    root.querySelector('[data-action="copy"]')?.addEventListener('click', async () => {
      const text = JSON.stringify(snapshot(), null, 2);
      try { await navigator.clipboard.writeText(text); dom.msg.textContent = 'snapshot copied'; } catch { console.log('[37CA Output Health]', text); dom.msg.textContent = 'snapshot logged to console'; }
    });
    state.dom = dom;
    return dom;
  }
  function kv(k,v){ return `<div class="kv"><span class="k">${k}</span><span class="v">${v}</span></div>`; }
  function render(snap){
    const dom = ensureDom();
    if (!dom || !snap) return;
    const verdict = snap.verdict || {};
    const cls = cssStatus(verdict.level === 'OK', verdict.level === 'WARN');
    dom.root.classList.remove('ok','warn','bad');
    dom.root.classList.add(cls);
    dom.root.classList.toggle('is-open', state.open);
    dom.msg.textContent = verdict.message || verdict.level || 'waiting';
    if (!state.open) return;
    const registry = snap.registry || {};
    const pipeline = snap.pipeline || {};
    const syncLive = snap.server?.syncLive || {};
    const guard = syncLive.backendWriterGuard37BZ || {};
    const frameBus = snap.frameBus || {};
    const interlock = snap.interlock || {};
    dom.grid.innerHTML = [
      kv('verdict', verdict.level || '--'),
      kv('registry', registry.active ? s(registry.owner || 'active') : 'idle'),
      kv('backend fps', fmtFps(syncLive.actualFps)),
      kv('pipeline fps', fmtFps(pipeline.sentFps || pipeline.targetFps)),
      kv('scheduler', pipeline.schedulerActive ? `active ${fmtMs(pipeline.schedulerDelayMs)}` : 'idle'),
      kv('queue / late', `${n(pipeline.queueDepth)}/${n(pipeline.lateFrames)}`),
      kv('frame age', frameBus.hasFrame ? fmtMs(frameBus.lastFrameAgeMs) : '--'),
      kv('frame source', s(frameBus.lastSource || '--').slice(0,24)),
      kv('interlock blocks', String(n(interlock.lowTrustDenied) + n(interlock.packetSourceDenied))),
      kv('backend guard', `${n(guard.allowedCount)} ok / ${n(guard.blockedCount)} block`),
      kv('server poll', snap.server?.error ? 'error' : (snap.server?.okAt ? `${fmtMs(ageMs(snap.server.okAt))} ago` : '--')),
      kv('updated', `${fmtMs(ageMs(snap.updatedAt))} ago`)
    ].join('');
  }

  const api = {
    version: VERSION,
    _state: state,
    snapshot,
    show(){ state.open = true; ensureDom()?.root.classList.add('is-open'); render(snapshot()); },
    hide(){ state.open = false; ensureDom()?.root.classList.remove('is-open'); },
    pollServer
  };
  try { window[NAME] = api; } catch {}
  try { window.__budilightOutputHealthSnapshot37CA = snapshot(); } catch {}
  try { setTimeout(() => { ensureDom(); pollServer(true).finally(() => render(snapshot())); }, 300); } catch {}
  try { setInterval(() => { pollServer(false).finally(() => render(snapshot())); }, RENDER_MS); } catch {}
})();
