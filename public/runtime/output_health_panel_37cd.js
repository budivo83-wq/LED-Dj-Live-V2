/* STEP37CD: Output Health in Debug tab with actionable diagnostics.
   Replaces the old floating Performance health widget with one clean Debug screen.
   Passive only: reads runtime/server snapshots, never publishes frames or claims output. */
(function(){
  const NAME = '__budilightOutputHealth37CD';
  const VERSION = 'STEP37DS_DEBUG_COMPACT_DENSE_CARDS';
  const POLL_MS = 1800;
  const RENDER_MS = 900;

  const state = window[NAME] && window[NAME].version === VERSION && window[NAME]._state
    ? window[NAME]._state
    : {
        installedAt: Date.now(), updatedAt: 0, lastPipeline: null, lastServerPollAt: 0,
        server: { syncLive: null, masterMirror: null, error: '', okAt: 0 },
        lastSnapshot: null, lastRenderSig: '', metricsEnabled: false, profileUntil: 0
      };

  function now(){ return Date.now(); }
  function s(v, fallback=''){ return String(v == null ? fallback : v); }
  function n(v, fallback=0){ const x = Number(v); return Number.isFinite(x) ? x : fallback; }
  function clone(v){ try { return JSON.parse(JSON.stringify(v)); } catch { return null; } }
  function get(name){ try { return window[name] || null; } catch { return null; } }
  function isDebugActive(){
    try {
      if (document.hidden) return false;
      const bodyMode = String(document.body?.dataset?.previewMode || document.body?.dataset?.mode || '').toLowerCase();
      if (bodyMode === 'debug' || bodyMode.includes('debug')) return true;
      const status = document.getElementById('previewModeStatus');
      const statusMode = String(status?.dataset?.previewModeStatus || status?.textContent || '').toLowerCase();
      if (statusMode.includes('debug')) return true;
      const panel = document.getElementById('debugPanel');
      if (panel && panel.offsetParent !== null) return true;
      const btn = document.getElementById('previewTabDebug');
      if (!btn) return false;
      const cls = btn.classList;
      return !!(cls?.contains('active') || cls?.contains('is-active') || btn.getAttribute('aria-selected') === 'true' || btn.getAttribute('aria-pressed') === 'true');
    } catch { return false; }
  }
  function publishInactive(){
    try { window.__budilightOutputHealthSnapshot37CD = { version: VERSION, active:false, metricsEnabled:isMetricsEnabled37DQ(), reason:'debug-metrics-inactive', updatedAt: now() }; } catch {}
  }

  function readMetricsEnabled37DQ(){
    try {
      if (localStorage.getItem('budilight.debugMetrics37DQ') === '1') return true;
    } catch {}
    return state.metricsEnabled === true;
  }
  function writeMetricsEnabled37DQ(on){
    state.metricsEnabled = !!on;
    try { localStorage.setItem('budilight.debugMetrics37DQ', on ? '1' : '0'); } catch {}
    try { window.__budilightDebugMetricsEnabled37DQ = !!on; } catch {}
  }
  function isMetricsEnabled37DQ(){
    if (state.profileUntil && now() > state.profileUntil) {
      state.profileUntil = 0;
      writeMetricsEnabled37DQ(false);
    }
    return readMetricsEnabled37DQ();
  }
  function isMetricsActive37DQ(){ return isDebugActive() && isMetricsEnabled37DQ(); }
  function profileLeft37DQ(){ return state.profileUntil ? Math.max(0, Math.ceil((state.profileUntil - now()) / 1000)) : 0; }
  function setMetrics37DQ(on, profileMs=0){
    state.profileUntil = on && profileMs ? now() + profileMs : 0;
    writeMetricsEnabled37DQ(!!on);
    try { render(on ? snapshot() : null); } catch { try { render(null); } catch {} }
  }

  function callSnapshot(obj){ try { return obj && typeof obj.snapshot === 'function' ? obj.snapshot() : null; } catch { return null; } }
  function ageMs(ts){ const t = n(ts, 0); return t ? Math.max(0, now() - t) : null; }
  function fmtFps(v){ const x = n(v, NaN); return Number.isFinite(x) && x > 0 ? `${x.toFixed(x >= 10 ? 1 : 2)} fps` : '--'; }
  function fmtMs(v){ const x = n(v, NaN); return Number.isFinite(x) ? `${Math.round(x)} ms` : '--'; }
  function esc(v){ return s(v).replace(/[&<>"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch])); }
  function cls(level){ const x = s(level).toUpperCase(); return x === 'OK' || x === 'LIVE' ? 'ok' : x === 'WARN' || x === 'WAIT' || x === 'IDLE' ? 'warn' : 'bad'; }


  function getCrossWindow(name){
    try { if (window[name]) return window[name]; } catch {}
    try { if (window.parent && window.parent !== window && window.parent[name]) return window.parent[name]; } catch {}
    try { if (window.top && window.top !== window && window.top[name]) return window.top[name]; } catch {}
    return null;
  }
  function getRegistryApi(){
    return getCrossWindow('__budilightRuntimeLoopRegistry37CE');
  }
  function normalizeLoops(raw){
    if (!raw || typeof raw !== 'object') {
      return { version: '', live: false, uiActive: !document.hidden, active: 0, total: 0, slow: [], items: [], unavailable: true };
    }
    const items = Array.isArray(raw.items) ? raw.items : [];
    const active = Number.isFinite(Number(raw.active)) ? Number(raw.active) : items.filter(x => x && x.active !== false).length;
    const total = Number.isFinite(Number(raw.total)) ? Number(raw.total) : items.length;
    const slow = Array.isArray(raw.slow) ? raw.slow : items
      .filter(x => Number(x?.maxDurationMs || x?.lastDurationMs || 0) >= 8)
      .sort((a,b)=>Number(b?.maxDurationMs||0)-Number(a?.maxDurationMs||0))
      .slice(0, 12);
    return { ...raw, active, total, slow, items };
  }
  function loopListHtml37DK(loops){
    const items = Array.isArray(loops?.items) ? loops.items.slice() : [];
    if (!items.length) {
      const msg = loops?.unavailable ? 'registry snapshot zatím nedostupný' : 'žádné registrované loopy';
      return `<div class="oh37cd-loop-list"><div class="oh37cd-loop-item"><span>${esc(msg)}</span><span>--</span><span>--</span><span>--</span></div></div>`;
    }
    const top = items
      .slice()
      .sort((a,b)=>{
        const da = Math.max(Number(a?.lastDurationMs||0), Number(a?.maxDurationMs||0));
        const db = Math.max(Number(b?.lastDurationMs||0), Number(b?.maxDurationMs||0));
        if (db !== da) return db - da;
        return String(a?.name||'').localeCompare(String(b?.name||''));
      })
      .slice(0, 12);
    return `<div class="oh37cd-loop-list">
      <div class="oh37cd-loop-item"><span><b>Loop</b></span><span><b>delay</b></span><span><b>last</b></span><span><b>max</b></span></div>
      ${top.map(item => `<div class="oh37cd-loop-item ${item.active === false ? 'is-off' : ''}"><span title="${esc(item.name || item.id || '')}">${esc(item.name || item.id || '--')}</span><span>${esc(item.active === false ? 'off' : fmtMs(item.nextInMs))}</span><span>${esc(fmtMs(item.lastDurationMs))}</span><span>${esc(fmtMs(item.maxDurationMs))}</span></div>`).join('')}
    </div>`;
  }

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

  function firstSnapshotObject(names){
    for (const name of names) {
      const obj = getCrossWindow(name);
      const snap = callSnapshot(obj) || clone(obj?.lastStatus || obj?.status || obj);
      if (snap) return snap;
    }
    return null;
  }
  function sequencerProfilerSnapshot37DL(){
    const snap = firstSnapshotObject(['__budilightStepSequencerProfiler37AP', '__budilightStepSeqPerf37BO']);
    if (!snap) return null;
    const perf = snap.renderSaveProfiler37BO || getCrossWindow('__budilightStepSeqPerf37BO') || null;
    return {
      ...snap,
      renderSaveProfiler37BO: perf ? clone(perf) : snap.renderSaveProfiler37BO || null
    };
  }
  function thumbQueueSnapshot37DL(){
    return firstSnapshotObject(['__ledThumbQueueStats', '__budilightThumbQueueStats37DL']);
  }

  function pipelineFromEvent(detail){ if (detail && typeof detail === 'object') state.lastPipeline = { ...detail, receivedAt: now() }; }
  try { window.addEventListener('led-output-pipeline-stats', ev => pipelineFromEvent(ev && ev.detail)); } catch {}

  async function fetchJson(url){
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText || ''}`.trim());
    return res.json();
  }
  function isLiveOutput37DP(){
    try { const g = getCrossWindow('__budilightLiveOutputGate37BW'); if (g?.isLive) return g.isLive() === true; } catch {}
    try { return getCrossWindow('__ledOutputConsumerGate')?.outputEnabled === true; } catch { return false; }
  }
  async function pollServer(force=false){
    if (!force && !isDebugActive()) { publishInactive(); return; }
    // STEP37DP: during live output, never run background /api polling from Debug.
    // It was diagnostic only and can steal main-thread/network time. Manual Refresh still works.
    if (!force && isLiveOutput37DP()) return;
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
    if (parts.sequencer && n(parts.sequencer.maxTotalMs) >= 8) warnings.push(`sequencer max ${fmtMs(parts.sequencer.maxTotalMs)}`);
    if (parts.thumbQueue && n(parts.thumbQueue.queueLength) > 24 && parts.thumbQueue.liveHardSleep !== true) warnings.push(`thumb queue ${n(parts.thumbQueue.queueLength)}`);
    if (frameBus?.hasFrame && n(frameBus.lastFrameAgeMs) > 750) warnings.push(`old master frame ${fmtMs(frameBus.lastFrameAgeMs)}`);
    if (parts.server?.error) warnings.push(`server poll ${parts.server.error}`);
    return { ok: problems.length === 0, level: problems.length ? 'BAD' : warnings.length ? 'WARN' : 'OK', message: problems[0] || warnings[0] || 'single writer path clean', problems, warnings };
  }

  function snapshot(){
    const parts = {
      version: VERSION,
      active: isDebugActive(),
      metricsEnabled: isMetricsEnabled37DQ(),
      installedAt: state.installedAt,
      updatedAt: now(),
      pipeline: clone(state.lastPipeline),
      registry: registrySnapshot(),
      watchdog: callSnapshot(get('__budilightSingleWriterWatchdog37BE')) || clone(get('__budilightSingleWriterWatchdogSnapshot37BE')),
      deep: callSnapshot(get('__budilightSingleWriterDeepReport37BX')) || clone(get('__budilightSingleWriterDeepReportSnapshot37BX')),
      interlock: callSnapshot(get('__budilightOutputWriterInterlock37BY')) || clone(get('__budilightOutputWriterInterlockSnapshot37BY')),
      liveGate: callSnapshot(get('__budilightLiveOutputGate37BW')) || clone(get('__budilightLiveOutputGateSnapshot37BW')),
      loops: normalizeLoops(callSnapshot(getRegistryApi()) || clone(getCrossWindow('__budilightRuntimeLoopRegistrySnapshot37CE'))),
      sequencer: sequencerProfilerSnapshot37DL(),
      thumbQueue: thumbQueueSnapshot37DL(),
      frameBus: frameBusSnapshot(),
      browser: { artnet: artnetMetrics(), serial: mirrorSnapshot('__budilightLiveSerialMirror22CR') || mirrorSnapshot('__budilightLiveSerialAppMirror22CR') },
      server: clone(state.server)
    };
    parts.verdict = deriveVerdict(parts);
    state.updatedAt = parts.updatedAt;
    state.lastSnapshot = parts;
    try { window.__budilightOutputHealthSnapshot37CD = parts; } catch {}
    return parts;
  }

  function styleOnce(){
    if (document.getElementById('outputHealthStyle37CD')) return;
    const st = document.createElement('style');
    st.id = 'outputHealthStyle37CD';
    st.textContent = `
      .debug-output-health-37cd{padding:14px;overflow:auto;background:radial-gradient(circle at 12% 0%,rgba(0,255,210,.08),transparent 30%),rgba(0,0,0,.18)}
      .debug-output-health-mount-37cd{display:grid;gap:8px;min-height:0;font:11px/1.28 system-ui,-apple-system,Segoe UI,sans-serif;color:#dff;align-content:start}
      .debug-output-health-mount-37cd.is-compact{min-height:0;align-content:start}
      .oh37cd-compact{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;max-width:980px}
      .oh37cd-compact .oh37cd-verdict strong{font-size:18px}.oh37cd-compact .oh37cd-actions{justify-content:flex-end}
      .oh37cd-hero{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:start}.oh37cd-card{border:1px solid rgba(255,255,255,.10);background:rgba(3,10,18,.76);border-radius:13px;padding:9px 10px;box-shadow:0 10px 26px rgba(0,0,0,.20);align-self:start}.oh37cd-card h4{margin:0 0 7px;font-size:11px;letter-spacing:.04em;color:#87fff1}
      .oh37cd-verdict{display:flex;align-items:center;gap:12px}.oh37cd-dot{width:18px;height:18px;border-radius:50%;background:#7b8794;box-shadow:0 0 18px currentColor}.oh37cd-verdict.ok .oh37cd-dot{background:#20f3a2;color:#20f3a2}.oh37cd-verdict.warn .oh37cd-dot{background:#ffc857;color:#ffc857}.oh37cd-verdict.bad .oh37cd-dot{background:#ff4f6d;color:#ff4f6d}.oh37cd-verdict strong{display:block;font-size:19px;letter-spacing:.05em}.oh37cd-verdict small{display:block;opacity:.72;margin-top:1px}
      .oh37cd-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}.oh37cd-kpi{border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.035);border-radius:11px;padding:7px 8px;min-height:43px}.oh37cd-kpi span{display:block;opacity:.58;font-size:9px;text-transform:uppercase;letter-spacing:.08em}.oh37cd-kpi b{display:block;font-size:14px;margin-top:2px;font-variant-numeric:tabular-nums}.oh37cd-kpi small{display:block;opacity:.55;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:10px}
      .oh37cd-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;align-items:start}.oh37cd-table{display:grid;gap:2px}.oh37cd-row{display:flex;justify-content:space-between;gap:8px;border-bottom:1px solid rgba(255,255,255,.055);padding:3px 0}.oh37cd-row span{opacity:.62}.oh37cd-row b{text-align:right;font-variant-numeric:tabular-nums}.oh37cd-list{display:grid;gap:5px}.oh37cd-chip{border:1px solid rgba(255,255,255,.09);border-radius:999px;padding:5px 8px;background:rgba(255,255,255,.035)}.oh37cd-chip.ok{border-color:rgba(32,243,162,.28)}.oh37cd-chip.warn{border-color:rgba(255,200,87,.32)}.oh37cd-chip.bad{border-color:rgba(255,79,109,.34)}
      .oh37cd-loop-list{display:grid;gap:2px;margin-top:6px;max-height:180px;overflow:auto}.oh37cd-loop-item{display:grid;grid-template-columns:1.5fr .8fr .7fr .7fr;gap:6px;border-bottom:1px solid rgba(255,255,255,.05);padding:2px 0;font-variant-numeric:tabular-nums}.oh37cd-loop-item span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;opacity:.78}.oh37cd-actions{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}.oh37cd-actions button{border:1px solid rgba(255,255,255,.14);border-radius:999px;background:rgba(255,255,255,.06);color:#dff;padding:6px 9px;cursor:pointer;font-size:11px}.oh37cd-actions button.is-on{border-color:rgba(32,243,162,.55);background:rgba(32,243,162,.14)}.oh37cd-actions button.is-off{border-color:rgba(255,200,87,.35);background:rgba(255,200,87,.08)}.oh37cd-actions button.is-profile{border-color:rgba(183,92,255,.42);background:rgba(183,92,255,.10)}.oh37cd-pre{max-height:260px;overflow:auto;white-space:pre-wrap;font:11px/1.35 ui-monospace,SFMono-Regular,Consolas,monospace;color:#bde;background:rgba(0,0,0,.25);border-radius:12px;padding:10px;border:1px solid rgba(255,255,255,.08)}
      .debug-output-health-loading-37cd{border:1px dashed rgba(0,255,210,.25);border-radius:14px;padding:16px;background:rgba(0,0,0,.22)}
      @media(max-width:1200px){.oh37cd-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:900px){.oh37cd-hero,.oh37cd-grid{grid-template-columns:1fr}.oh37cd-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}}
    `;
    document.head.appendChild(st);
  }
  function isEmptyMetric37DS(v){ const x = s(v).trim(); return !x || x === '--' || x === '-- / --' || x === '-- / 0' || x === '0 ms / --' || x === '-- 0 ms'; }
  function row(k,v, force=false){ if (!force && isEmptyMetric37DS(v)) return ''; return `<div class="oh37cd-row"><span>${esc(k)}</span><b>${esc(v)}</b></div>`; }
  function kpi(k,v,sub=''){ return `<article class="oh37cd-kpi"><span>${esc(k)}</span><b>${esc(v)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</article>`; }
  function chip(text, level='ok'){ return `<div class="oh37cd-chip ${cls(level)}">${esc(text)}</div>`; }


  function deriveActions(snap){
    const actions = [];
    const v = snap?.verdict || {};
    const pipeline = snap?.pipeline || {};
    const syncLive = snap?.server?.syncLive || {};
    const frameBus = snap?.frameBus || {};
    const interlock = snap?.interlock || {};
    const guard = syncLive.backendWriterGuard37BZ || syncLive.lastSendResult?.backendWriterGuard37BZ || {};
    const blocked = n(interlock.lowTrustDenied) + n(interlock.packetSourceDenied);
    if ((v.problems || []).length) actions.push(['BAD', 'Writer conflict', 'Nejdřív řeš zdroj konfliktu writerů. Zkontroluj Deep report + interlock blocked writes; output nesmí mít současně fallback/preview/test writer.']);
    if (guard.allowed === false || n(guard.blockedCount) > 0) actions.push(['BAD', 'Backend writer blocked', 'Backend se pokusil poslat nízkodůvěryhodný frame. Nech Performance/master frame jako jediný zdroj a vypni server test/fallback generátor.']);
    if (syncLive.running && n(syncLive.actualFps) > 0 && n(syncLive.actualFps) < 45) actions.push(['WARN', 'Backend FPS drop', 'Output loop běží pod 45 FPS. Další optimalizace má být scheduler/UDP send budget, ne UI vzhled.']);
    if (frameBus?.hasFrame && n(frameBus.lastFrameAgeMs) > 750) actions.push(['WARN', 'Old master frame', 'FrameBus má starý master frame. Hledej zaseknutý producer na Performance/Sequencer cestě, ne ArtNet mapping.']);
    if (pipeline.health && !['OK','IDLE','READY'].includes(s(pipeline.health).toUpperCase())) actions.push(['WARN', 'Pipeline pressure', 'Pipeline hlásí tlak nebo zpoždění. Zkontroluj queue depth, late/dropped frames a případné UI/timer špičky.']);
    if (snap?.sequencer && n(snap.sequencer.maxTotalMs) >= 8) actions.push(['WARN', 'Sequencer step hitch', `Quick-step max ${fmtMs(snap.sequencer.maxTotalMs)}. Další krok je rozdělit těžké step akce na menší budgetované dávky.`]);
    if (snap?.thumbQueue && n(snap.thumbQueue.queueLength) > 24 && snap.thumbQueue.liveHardSleep !== true) actions.push(['WARN', 'Thumbnail backlog', `Thumbnail queue má ${n(snap.thumbQueue.queueLength)} položek. Při live outputu ji dále uspat nebo vypnout runtime render.`]);
    if (snap?.thumbQueue?.liveHardSleep === true) actions.push(['OK', 'Thumbnail hard sleep', `Runtime thumbnail rendering je při live outputu zaparkovaný na ${fmtMs(snap.thumbQueue.liveHardSleepMs)}.`]);
    if (blocked > 0) actions.push(['OK', 'Interlock is protecting output', `Interlock už zablokoval ${blocked} nízkodůvěryhodných zápisů. Pokud obraz pořád bliká, hledej backend writer nebo fyzickou síť/ArtNet node.`]);
    if (!actions.length) actions.push(['OK', 'No immediate conflict', 'Single-writer cesta vypadá čistě. Pokud fyzické LED pořád cukají, další podezření je UDP/network timing, node buffer nebo reálný LED refresh limit.']);
    return actions.slice(0, 5);
  }

  function render(snap){
    styleOnce();
    const mount = document.getElementById('debugOutputHealthMount37CD');
    const pill = document.getElementById('dbgOutputHealthPill37CD');
    if (!mount) return;
    if (!isDebugActive()) {
      if (isMetricsEnabled37DQ()) writeMetricsEnabled37DQ(false);
      if (pill) { pill.textContent = 'SLEEP'; pill.className = 'debug-live-pill oh37cd-pill-warn'; }
      const sigSleep = 'sleep-outside-debug';
      if (state.lastRenderSig !== sigSleep) {
        state.lastRenderSig = sigSleep;
        mount.classList.add('is-compact');
        mount.innerHTML = `<div class="oh37cd-compact"><article class="oh37cd-card oh37cd-verdict warn"><span class="oh37cd-dot"></span><div><strong>Debug Metrics sleeping</strong><small>Debug tab není detekovaný jako aktivní. Tohle je jen pohotovostní stav bez sběru metrik.</small></div></article><article class="oh37cd-card oh37cd-actions"><button type="button" class="is-on" data-oh37cd="metrics-on">METRICS ON</button><button type="button" class="is-profile" data-oh37cd="profile10">PROFILE 10s</button></article></div>`;
        mount.querySelector('[data-oh37cd="metrics-on"]')?.addEventListener('click', () => setMetrics37DQ(true));
        mount.querySelector('[data-oh37cd="profile10"]')?.addEventListener('click', () => setMetrics37DQ(true, 10000));
      }
      return;
    }
    if (!isMetricsEnabled37DQ()) {
      if (pill) { pill.textContent = 'METRICS OFF'; pill.className = 'debug-live-pill oh37cd-pill-warn'; }
      const sigOff = 'metrics-off';
      if (state.lastRenderSig !== sigOff) {
        state.lastRenderSig = sigOff;
        mount.classList.add('is-compact');
        mount.innerHTML = `<div class="oh37cd-compact"><article class="oh37cd-card oh37cd-verdict warn"><span class="oh37cd-dot"></span><div><strong>Metrics OFF</strong><small>Diagnostika je vypnutá. Zapínej ji jen ručně při testu, aby live output zůstal prioritní.</small></div></article><article class="oh37cd-card oh37cd-actions"><button type="button" class="is-on" data-oh37cd="metrics-on">METRICS ON</button><button type="button" class="is-profile" data-oh37cd="profile10">PROFILE 10s</button></article></div>`;
        mount.querySelector('[data-oh37cd="metrics-on"]')?.addEventListener('click', () => setMetrics37DQ(true));
        mount.querySelector('[data-oh37cd="profile10"]')?.addEventListener('click', () => setMetrics37DQ(true, 10000));
      }
      return;
    }
    if (!snap) return;
    mount.classList.remove('is-compact');
    const verdict = snap.verdict || {};
    if (pill) { pill.textContent = s(verdict.level || 'WAIT'); pill.className = `debug-live-pill oh37cd-pill-${cls(verdict.level)}`; }
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
    const loops = snap.loops || {};
    const sequencer = snap.sequencer || {};
    const thumbQueue = snap.thumbQueue || {};
    const udpHotpath = syncLive.udpHotpath37DN || {};
    const serial = snap.browser?.serial || {};
    const warnings = [...(verdict.problems || []).map(x => [x,'bad']), ...(verdict.warnings || []).map(x => [x,'warn'])];
    const actions = deriveActions(snap);
    const sig = JSON.stringify({ level: verdict.level, msg: verdict.message, p:pipeline, r:registry, s:syncLive, g:guard, f:frameBus, i:interlock, loops:{active:loops.active,total:loops.total,slow:(loops.slow||[]).slice(0,3)}, seq:{last:sequencer.lastTotalMs,max:sequencer.maxTotalMs,heavy:sequencer.heavyQueue}, tq:{q:thumbQueue.queueLength,last:thumbQueue.lastRenderMs,p:thumbQueue.pumps,s:thumbQueue.liveSuspendedRuntime}, udp:{p:udpHotpath.lastPath,ms:udpHotpath.lastBatchMs,max:udpHotpath.maxBatchMs,slow:udpHotpath.slowBatchCount}, w:warnings });
    if (sig === state.lastRenderSig) return;
    state.lastRenderSig = sig;
    mount.innerHTML = `
      <div class="oh37cd-hero">
        <article class="oh37cd-card oh37cd-verdict ${cls(verdict.level)}">
          <span class="oh37cd-dot"></span>
          <div><strong>${esc(verdict.level || 'WAIT')}</strong><small>${esc(verdict.message || 'waiting for output health')}</small></div>
        </article>
        <article class="oh37cd-card oh37cd-actions">
          <button type="button" class="is-on" data-oh37cd="metrics-off">METRICS ON</button>
          <button type="button" class="is-profile" data-oh37cd="profile10">${profileLeft37DQ() ? `PROFILE ${profileLeft37DQ()}s` : 'PROFILE 10s'}</button>
          <button type="button" data-oh37cd="copy">Copy snapshot</button>
          <button type="button" data-oh37cd="log">Log to console</button>
          <button type="button" data-oh37cd="poll">Refresh server</button>
        </article>
      </div>
      <section class="oh37cd-kpis">
        ${kpi('Backend FPS', fmtFps(syncLive.actualFps), syncLive.running ? 'sync-live running' : 'sync-live idle')}
        ${kpi('Pipeline FPS', fmtFps(pipeline.sentFps || pipeline.targetFps), pipeline.schedulerActive ? `scheduler ${fmtMs(pipeline.schedulerDelayMs)}` : 'scheduler idle')}
        ${kpi('Frame age', frameBus.hasFrame ? fmtMs(frameBus.lastFrameAgeMs) : '--', frameBus.lastSource || 'no master frame')}
        ${kpi('Blocked writes', String(n(interlock.lowTrustDenied) + n(interlock.packetSourceDenied)), 'frontend interlock')}
        ${kpi('Runtime loops', `${n(loops.active)} / ${n(loops.total)}`, loops.live ? 'live gated' : 'idle gated')}
        ${kpi('Sequencer step', fmtMs(sequencer.lastTotalMs), `max ${fmtMs(sequencer.maxTotalMs)} / heavy ${n(sequencer.heavyQueue)}`)}
        ${kpi('Thumb queue', String(n(thumbQueue.queueLength)), thumbQueue.liveSuspendedRuntime ? `live suspend ${n(thumbQueue.liveSuspendedRuntime)}` : (thumbQueue.liveHardSleep ? `hard sleep ${fmtMs(thumbQueue.liveHardSleepMs)}` : (thumbQueue.liveOutputRelief ? `live relief ${fmtMs(thumbQueue.liveMinGapMs)}` : `last ${fmtMs(thumbQueue.lastRenderMs)}`)))}
        ${kpi('UDP hotpath', fmtMs(udpHotpath.lastBatchMs), `${s(udpHotpath.lastPath || '--')} / max ${fmtMs(udpHotpath.maxBatchMs)}`)}
      </section>
      <section class="oh37cd-grid">
        <article class="oh37cd-card"><h4>Writer / FrameBus</h4><div class="oh37cd-table">
          ${row('Registry owner', registry.active ? s(registry.owner || 'active') : 'idle')}
          ${row('Trusted owner', s(interlock.activeTrustedOwner || '--'))}
          ${row('Frame source', s(frameBus.lastSource || '--'))}
          ${row('FrameBus status', s(frameBus.gates?.status || frameBus.health || (frameBus.hasFrame ? 'HAS_FRAME' : 'NO_FRAME')))}
          ${row('Watchdog', s(watchdog.verdict?.level || watchdog.status || watchdog.health || '--'))}
          ${row('Deep report', s(deep.verdict?.level || deep.verdict?.status || '--'))}
        </div></article>
        <article class="oh37cd-card"><h4>Backend / Guard</h4><div class="oh37cd-table">
          ${row('Sync-live', syncLive.running ? 'RUNNING' : 'IDLE')}
          ${row('Master mirror', masterMirror.running || masterMirror.enabled ? 'RUNNING' : s(masterMirror.status || 'IDLE'))}
          ${row('Backend guard', `${n(guard.allowedCount)} ok / ${n(guard.blockedCount)} block`)}
          ${row('Last guard allowed', guard.allowed === false ? 'NO' : guard.allowed === true ? 'YES' : '--')}
          ${row('Server poll', snap.server?.error ? `ERR ${snap.server.error}` : (snap.server?.okAt ? `${fmtMs(ageMs(snap.server.okAt))} ago` : '--'))}
          ${row('Live gate', gate.live ? 'LIVE' : s(gate.mode || gate.status || 'idle'))}
          ${row('UDP hotpath', `${s(udpHotpath.lastPath || '--')} ${fmtMs(udpHotpath.lastBatchMs)}`)}
          ${row('UDP max / slow', `${fmtMs(udpHotpath.maxBatchMs)} / ${n(udpHotpath.slowBatchCount)}`)}
        </div></article>
        <article class="oh37cd-card"><h4>Scheduler / Queue</h4><div class="oh37cd-table">
          ${row('Pipeline health', s(pipeline.health || '--'))}
          ${row('Pressure', s(pipeline.pressure || '--'))}
          ${row('Queue depth', String(n(pipeline.queueDepth)))}
          ${row('Late frames', String(n(pipeline.lateFrames)))}
          ${row('Dropped frames', String(n(pipeline.droppedFrames || pipeline.drops)))}
          ${row('Latency avg/max', `${fmtMs(pipeline.latencyAvgMs)} / ${fmtMs(pipeline.latencyMaxMs)}`)}
        </div></article>
        <article class="oh37cd-card"><h4>Runtime loops</h4><div class="oh37cd-table">
          ${row('Registry', loops.version ? '37CE active' : 'unavailable')}
          ${row('Active / total', `${n(loops.active)} / ${n(loops.total)}`)}
          ${row('Live gate', loops.live ? 'LIVE' : 'IDLE')}
          ${row('UI active', loops.uiActive === false ? 'NO' : 'YES')}
          ${row('Slowest loop', (loops.slow && loops.slow[0]) ? `${loops.slow[0].name} ${fmtMs(loops.slow[0].maxDurationMs)}` : '--')}
          ${row('Slow loops', String((loops.slow || []).length))}
        </div>${loopListHtml37DK(loops)}</article>
        <article class="oh37cd-card"><h4>Sequencer profiler</h4><div class="oh37cd-table">
          ${row('Version', s(sequencer.version || '--'))}
          ${row('Runs', String(n(sequencer.runs)))}
          ${row('Last / max step', `${fmtMs(sequencer.lastTotalMs)} / ${fmtMs(sequencer.maxTotalMs)}`)}
          ${row('Avg step', fmtMs(sequencer.avgTotalMs))}
          ${row('Release / apply / flush', `${fmtMs(sequencer.lastReleaseMs)} / ${fmtMs(sequencer.lastApplyMs)} / ${fmtMs(sequencer.lastFlushMs)}`)}
          ${row('Changed rows', String(n(sequencer.lastChangedRows)))}
          ${row('Heavy deferred/applied', `${n(sequencer.heavyDeferred)} / ${n(sequencer.heavyApplied)}`)}
          ${row('Heavy queue/delay/ms', `${n(sequencer.heavyQueue)} / ${fmtMs(sequencer.lastHeavyDelayMs)} / ${fmtMs(sequencer.lastHeavyMs)}`)}
        </div></article>
        <article class="oh37cd-card"><h4>Thumbnail / preload queue</h4><div class="oh37cd-table">
          ${row('Version', s(thumbQueue.version || '--'))}
          ${row('Enabled / mode', `${thumbQueue.thumbsEnabled === false ? 'NO' : 'YES'} / ${s(thumbQueue.mode || '--')}`)}
          ${row('Queue / active', `${n(thumbQueue.queueLength)} / ${thumbQueue.active ? 'YES' : 'NO'}`)}
          ${row('Rendered / pumps', `${n(thumbQueue.rendered)} / ${n(thumbQueue.pumps)}`)}
          ${row('Last render/pump', `${fmtMs(thumbQueue.lastRenderMs)} / ${fmtMs(thumbQueue.lastPumpMs)}`)}
          ${row('Gap / idle', `${fmtMs(thumbQueue.minGapMs)} / ${fmtMs(thumbQueue.idleTimeoutMs)}`)}
          ${row('Live relief', thumbQueue.liveOutputRelief ? `YES ${fmtMs(thumbQueue.liveMinGapMs)}` : 'NO')}
          ${row('Hard sleep', thumbQueue.liveHardSleep ? `YES ${fmtMs(thumbQueue.liveHardSleepMs)}` : 'NO')}
          ${row('Sleep skips', String(n(thumbQueue.liveHardSleepSkips)))}
          ${row('Live suspended', `${n(thumbQueue.liveSuspendedRuntime)} / drawn ${n(thumbQueue.liveSuspendDrawnMissing)}`)}
          ${row('Dropped dup/overflow', `${n(thumbQueue.droppedDuplicate)} / ${n(thumbQueue.droppedOverflow)}`)}
        </div></article>
        <article class="oh37cd-card"><h4>Browser mirrors</h4><div class="oh37cd-table">
          ${row('ArtNet browser', artnet.enabled || artnet.ok ? 'ON' : s(artnet.status || 'idle'))}
          ${row('ArtNet fps', fmtFps(artnet.fps || artnet.actualFps || artnet.sentFps))}
          ${row('Serial browser', serial.enabled || serial.ok ? 'ON' : s(serial.status || 'idle'))}
          ${row('Serial fps', fmtFps(serial.fps || serial.actualFps || serial.sentFps))}
          ${row('Updated', `${fmtMs(ageMs(snap.updatedAt))} ago`)}
          ${row('Metrics', isMetricsEnabled37DQ() ? (profileLeft37DQ() ? `PROFILE ${profileLeft37DQ()}s` : 'ON') : 'OFF')}
          ${row('Version', VERSION.replace('STEP37CD_',''))}
        </div></article>
      </section>
      <article class="oh37cd-card"><h4>Recommended next action</h4><div class="oh37cd-list">${actions.map(([lvl,title,text]) => chip(`${title}: ${text}`, lvl)).join('')}</div></article>
      <article class="oh37cd-card"><h4>Warnings / conflicts</h4><div class="oh37cd-list">${warnings.length ? warnings.map(([x,l]) => chip(x,l)).join('') : chip('No active writer conflict detected','ok')}</div></article>
      <details class="oh37cd-card"><summary>Raw snapshot</summary><pre class="oh37cd-pre">${esc(JSON.stringify(snap, null, 2))}</pre></details>
    `;
    mount.querySelector('[data-oh37cd="metrics-off"]')?.addEventListener('click', () => setMetrics37DQ(false));
    mount.querySelector('[data-oh37cd="profile10"]')?.addEventListener('click', () => setMetrics37DQ(true, 10000));
    mount.querySelector('[data-oh37cd="copy"]')?.addEventListener('click', async () => {
      const text = JSON.stringify(snapshot(), null, 2);
      try { await navigator.clipboard.writeText(text); } catch { console.log('[37CD Output Health]', text); }
    });
    mount.querySelector('[data-oh37cd="log"]')?.addEventListener('click', () => console.log('[37CD Output Health]', snapshot()));
    mount.querySelector('[data-oh37cd="poll"]')?.addEventListener('click', () => pollServer(true).finally(() => render(snapshot())));
  }

  const api = { version: VERSION, _state: state, snapshot, render: () => render(snapshot()), pollServer };
  try { window[NAME] = api; } catch {}
  try { window.__budilightOutputHealthSnapshot37CD = isMetricsEnabled37DQ() ? snapshot() : { version: VERSION, active:isDebugActive(), metricsEnabled:false, reason:'metrics-off', updatedAt:now() }; } catch {}
  try { setTimeout(() => { try { render(snapshot()); } catch (e) { try { console.warn('[37DP Output Health render]', e); } catch {} } }, 80); } catch {}
  function debugHealthTick37CX(){
    if (!isDebugActive()) { publishInactive(); render(null); return; }
    if (!isMetricsEnabled37DQ()) { publishInactive(); render(null); return; }
    return pollServer(false).finally(() => render(snapshot()));
  }
  function scheduleHealthLoop37DO(){
    const reg = getCrossWindow('__budilightRuntimeLoopRegistry37CE');
    let scheduled = false;
    try {
      if (reg && typeof reg.timeout === 'function') {
        reg.timeout('output-health:initial-poll', debugHealthTick37CX, 300, { group: 'output-health', managed: false });
        scheduled = true;
      }
    } catch {}
    if (!scheduled) { try { setTimeout(debugHealthTick37CX, 300); } catch {} }

    scheduled = false;
    try {
      if (reg && typeof reg.adaptiveInterval === 'function') {
        reg.adaptiveInterval('output-health:render-poll', debugHealthTick37CX, RENDER_MS, { group: 'output-health', liveFactor: 6, hiddenFactor: 8, maxMs: 12000, skipWhenHidden: true });
        scheduled = true;
      }
    } catch {}
    if (!scheduled) {
      const rawLoop = () => {
        try { debugHealthTick37CX(); } catch {}
        try { setTimeout(rawLoop, isDebugActive() ? RENDER_MS : Math.max(2500, RENDER_MS * 3)); } catch {}
      };
      try { setTimeout(rawLoop, RENDER_MS); } catch {}
    }
  }
  try { window.addEventListener('led-debug-force-refresh', () => { try { render(isMetricsEnabled37DQ() ? snapshot() : null); } catch {} }); } catch {}
  try { document.getElementById('previewTabDebug')?.addEventListener('click', () => setTimeout(() => { try { render(isMetricsEnabled37DQ() ? snapshot() : null); } catch {} }, 40)); } catch {}
  try { scheduleHealthLoop37DO(); } catch { try { setTimeout(debugHealthTick37CX, 300); } catch {} }
})();
