/* STEP37CE: central registry for non-critical browser loops/timers.
   It does not replace the physical output scheduler. It gives UI/debug/health
   loops a shared live-output/hidden-view throttle and exposes one diagnostic
   snapshot. */
(function(){
  'use strict';
  const NAME = '__budilightRuntimeLoopRegistry37CE';
  const VERSION = 'STEP37CE_RUNTIME_LOOP_REGISTRY';
  const loops = new Map();
  let seq = 1;

  function now(){ try { return performance.now(); } catch { return Date.now(); } }
  function gate(){ try { return window.__budilightLiveOutputGate37BW || null; } catch { return null; } }
  function readLive(){
    try { const g = gate(); if (g?.isLive) return g.isLive() === true; } catch {}
    try { return window.__ledOutputConsumerGate?.outputEnabled === true; } catch { return false; }
  }
  function readUiActive(){
    try { const g = gate(); if (g?.isUiActive) return g.isUiActive() === true; } catch {}
    try { return document.hidden !== true; } catch { return true; }
  }
  function computeDelay(baseMs, opts){
    const base = Math.max(1, Number(baseMs) || 1);
    const live = readLive();
    const uiActive = readUiActive();
    const liveFactor = Math.max(1, Number(opts?.liveFactor || 1));
    const hiddenFactor = Math.max(1, Number(opts?.hiddenFactor || 1));
    const maxMs = Math.max(base, Number(opts?.maxMs || base * liveFactor * hiddenFactor || base));
    let ms = base;
    if (live) ms *= liveFactor;
    if (!uiActive || document.hidden === true) ms *= hiddenFactor;
    return Math.min(maxMs, Math.max(1, Math.round(ms)));
  }
  function record(id, patch){
    const item = loops.get(id);
    if (!item) return;
    Object.assign(item, patch || {}, { updatedAt: Date.now() });
  }
  function createLoop(meta){
    const id = `${String(meta.kind || 'loop')}:${String(meta.name || 'unnamed')}:${seq++}`;
    loops.set(id, {
      id,
      kind: meta.kind || 'loop',
      name: meta.name || 'unnamed',
      group: meta.group || 'misc',
      critical: meta.critical === true,
      baseMs: Number(meta.baseMs || 0),
      liveFactor: Number(meta.liveFactor || 1),
      hiddenFactor: Number(meta.hiddenFactor || 1),
      maxMs: Number(meta.maxMs || 0),
      runs: 0,
      skipped: 0,
      lastRunAt: 0,
      nextRunAt: 0,
      lastDurationMs: 0,
      maxDurationMs: 0,
      active: true,
      timerId: 0,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
    return id;
  }
  function clear(id){
    const item = loops.get(id);
    if (!item) return;
    item.active = false;
    if (item.timerId) { try { clearTimeout(item.timerId); } catch {} }
    item.timerId = 0;
    item.updatedAt = Date.now();
  }
  function timeout(name, fn, delayMs, opts = {}){
    const id = createLoop({ ...opts, kind: 'timeout', name, baseMs: delayMs });
    const actualDelay = opts.managed === false ? Math.max(0, Number(delayMs) || 0) : computeDelay(delayMs, opts);
    record(id, { nextRunAt: now() + actualDelay });
    const tid = setTimeout(() => {
      const item = loops.get(id);
      if (!item || item.active === false) return;
      const t0 = now();
      try { fn?.(); } finally {
        const dt = now() - t0;
        record(id, { active: false, runs: item.runs + 1, lastRunAt: t0, lastDurationMs: Number(dt.toFixed(2)), maxDurationMs: Math.max(item.maxDurationMs || 0, Number(dt.toFixed(2))), timerId: 0 });
      }
    }, actualDelay);
    record(id, { timerId: tid });
    return id;
  }
  function adaptiveInterval(name, fn, baseMs, opts = {}){
    const id = createLoop({ ...opts, kind: 'adaptiveInterval', name, baseMs });
    function step(){
      const item = loops.get(id);
      if (!item || item.active === false) return;
      const live = readLive();
      const uiActive = readUiActive();
      if (opts.skipWhenHidden === true && !uiActive && !item.critical) {
        item.skipped += 1;
      } else if (opts.skipWhenLive === true && live && !item.critical) {
        item.skipped += 1;
      } else {
        const t0 = now();
        try { fn?.({ live, uiActive, id }); } finally {
          const dt = now() - t0;
          item.runs += 1;
          item.lastRunAt = t0;
          item.lastDurationMs = Number(dt.toFixed(2));
          item.maxDurationMs = Math.max(item.maxDurationMs || 0, item.lastDurationMs);
        }
      }
      const delay = computeDelay(baseMs, opts);
      item.nextRunAt = now() + delay;
      item.timerId = setTimeout(step, delay);
      item.updatedAt = Date.now();
    }
    const firstDelay = Math.max(0, Number(opts.firstDelayMs ?? baseMs) || 0);
    record(id, { nextRunAt: now() + firstDelay });
    const tid = setTimeout(step, firstDelay);
    record(id, { timerId: tid });
    return id;
  }
  function snapshot(){
    const t = now();
    const items = Array.from(loops.values()).map((item) => ({
      ...item,
      timerId: item.timerId ? 1 : 0,
      nextInMs: item.active ? Math.max(0, Math.round(Number(item.nextRunAt || 0) - t)) : 0
    }));
    const active = items.filter((x) => x.active).length;
    const slow = items.filter((x) => Number(x.maxDurationMs || 0) >= 8).sort((a,b)=>Number(b.maxDurationMs||0)-Number(a.maxDurationMs||0)).slice(0, 12);
    return { version: VERSION, live: readLive(), uiActive: readUiActive(), active, total: items.length, slow, items };
  }
  const api = { version: VERSION, timeout, adaptiveInterval, clear, snapshot, computeDelay };
  try { window[NAME] = api; } catch {}
})();
