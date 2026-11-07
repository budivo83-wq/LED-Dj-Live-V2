
function managedLiveInputInterval37CG(name, fn, baseMs, opts = {}) {
  try {
    const reg = window.__budilightRuntimeLoopRegistry37CE;
    if (reg && typeof reg.adaptiveInterval === 'function') {
      return reg.adaptiveInterval(name, fn, baseMs, Object.assign({ group: 'live-input', liveFactor: 3, hiddenFactor: 4, maxMs: 8000 }, opts || {}));
    }
  } catch {}
  return setInterval(fn, Math.max(1, Number(baseMs) || 1));
}
function managedLiveInputTimeout37CG(name, fn, delayMs, opts = {}) {
  try {
    const reg = window.__budilightRuntimeLoopRegistry37CE;
    if (reg && typeof reg.timeout === 'function') return reg.timeout(name, fn, delayMs, Object.assign({ group: 'live-input', liveFactor: 2, hiddenFactor: 3, maxMs: 2000 }, opts || {}));
  } catch {}
  return setTimeout(fn, Math.max(0, Number(delayMs) || 0));
}
let shellViewActive37BQ = true;
const liveInputPerf37BQ = { version: 'STEP37BQ_LIVE_INPUT_ACTIVE_REFRESH_GATE', active: true, skipped: 0, lastRefreshAt: 0 };
try { window.__budilightLiveInputPerf37BQ = liveInputPerf37BQ; } catch {}
try {
  window.addEventListener('message', (event) => {
    const data = event?.data || {};
    if (data?.type !== 'led-shell-view-active') return;
    shellViewActive37BQ = data.active !== false;
    liveInputPerf37BQ.active = shellViewActive37BQ;
    liveInputPerf37BQ.updatedAt = Date.now();
    if (shellViewActive37BQ) managedLiveInputTimeout37CG('live-input:defer-refresh', () => { try { refresh(); } catch {} }, 0, { managed: false });
  });
} catch {}
const $ = (id) => document.getElementById(id);
function num(id){ return Number($(id).value || 0); }
function payload(){ return { bindIp: $('bindIp').value.trim(), port:num('port'), stripCount:num('stripCount'), pixelsPerStrip:num('pixelsPerStrip'), startUniverse:num('startUniverse'), pixelsPerUniverse:num('pixelsPerUniverse'), outputIp:$('outputIp').value.trim() || '2.1.1.30', fps:num('fps') || 30 }; }
async function api(path, body){ const res=await fetch(path,{method:body?'POST':'GET',headers:{'content-type':'application/json'},body:body?JSON.stringify(body):undefined}); return res.json(); }
function metric(k,v,cls=''){ return `<div class="metric"><b>${k}</b><span class="${cls}">${v ?? '—'}</span></div>`; }
function render(s){
  $('metrics').innerHTML = [
    metric('INPUT', s.running?'YES':'NO', s.running?'ok':'bad'), metric('OUTPUT', s.output?.running?'MASTER LIVE':'OFF', s.output?.running?'ok':'bad'), metric('SOURCE', s.output?.lastSummary?.frameSource || s.output?.options?.visualPattern || '—', (s.output?.lastSummary?.frameSource==='master-framebus')?'ok':''), metric('PACKETS IN', s.packetCount), metric('PUBLISHED', s.publishCount), metric('PENDING U', `${s.pendingUniverses}/${s.expectedUniverses}`), metric('UNIVERSES', s.universeRange), metric('LAST INPUT', s.lastPacketAgeMs==null?'—':`${s.lastPacketAgeMs} ms`), metric('LAST PUBLISH', s.lastPublishAgeMs==null?'—':`${s.lastPublishAgeMs} ms`), metric('REMOTE', s.lastRemote || '—')
  ].join('');
  $('raw').textContent = JSON.stringify(s,null,2);
}
async function refresh(){ liveInputPerf37BQ.lastRefreshAt = Date.now(); render(await api('/api/artnet/live-input/status')); }
$('startBtn').onclick=async()=>{ render(await api('/api/artnet/live-input/start', payload())); };
$('stopBtn').onclick=async()=>{ render(await api('/api/artnet/live-input/stop', {})); };
$('refreshBtn').onclick=refresh;
managedLiveInputInterval37CG('live-input:refresh', () => { if (!shellViewActive37BQ) { liveInputPerf37BQ.skipped += 1; return; } refresh(); }, 1000, { liveFactor: 3, hiddenFactor: 4, maxMs: 8000 }); refresh();
