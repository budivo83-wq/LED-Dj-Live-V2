import { createArtNetTransportScheduler22P } from './artnet_transport_scheduler_22p.js';

function nowMs() { return Date.now(); }
function asBool(value, fallback = false) {
  if (value == null) return fallback;
  if (typeof value === 'boolean') return value;
  return !['0', 'false', 'off', 'no'].includes(String(value).toLowerCase().trim());
}
function normalizeName(value) {
  const key = String(value || '').toLowerCase().trim();
  if (key === 'raw' || key === 'raw_serial' || key === 'usb') return 'serial';
  if (key === 'art-net' || key === 'udp') return 'artnet';
  if (key === 'e131' || key === 'e1.31') return 'sacn';
  return ['serial', 'artnet', 'sacn'].includes(key) ? key : '';
}
function normalizeRgb(frame = {}) {
  const src = frame.rgb || frame.frame || frame.payload || frame.data?.rgb || frame.data || [];
  if (src instanceof Uint8Array) return src;
  if (Array.isArray(src)) return Uint8Array.from(src.map((v) => Math.max(0, Math.min(255, Number(v) || 0))));
  return new Uint8Array(0);
}

function clampInt(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function createDryRunAdapter(name, options = {}) {
  let started = false;
  let pushed = 0;
  let processed = 0;
  let dropped = 0;
  let lastFrameId = 0;
  let lastBytes = 0;
  let lastAt = 0;
  let lastDecision = 'init';
  let queued = null;
  return {
    name,
    start() { started = true; lastDecision = 'started:dry-run'; return true; },
    stop() { started = false; queued = null; lastDecision = 'stopped'; return true; },
    pushFrame(frame = {}) {
      pushed += 1;
      const rgb = normalizeRgb(frame);
      if (options.expectedBytes && rgb.length !== options.expectedBytes) {
        dropped += 1;
        lastDecision = `drop:size:${rgb.length}/${options.expectedBytes}`;
        return false;
      }
      queued = { rgb, frameId: frame.frameId ?? frame.id ?? lastFrameId + 1 };
      lastDecision = 'queued-latest';
      return true;
    },
    processOne() {
      if (!started || !queued) return false;
      processed += 1;
      lastFrameId = Number(queued.frameId || processed);
      lastBytes = queued.rgb.length;
      lastAt = nowMs();
      queued = null;
      lastDecision = 'sent:dry-run';
      return true;
    },
    getStatus() {
      return { name, type: 'dry-run', started, running: started, queued: queued ? 1 : 0, pushed, processed, sent: processed, dropped, lastFrameId, lastBytes, lastAt, lastDecision };
    }
  };
}

function createArtNetAdapter(options = {}) {
  const scheduler = options.scheduler || createArtNetTransportScheduler22P({
    host: options.host || options.targetIp || '2.1.1.30',
    port: options.port || 6454,
    fps: options.fps || 44,
    stripCount: options.stripCount || 8,
    pixelsPerStrip: options.pixelsPerStrip || 300,
    pixelsPerUniverse: options.pixelsPerUniverse || 170,
    startUniverse: options.startUniverse ?? 0,
    dryRun: options.dryRun !== false
  });
  let started = false;
  let queued = null;
  let pushed = 0;
  let sent = 0;
  let dropped = 0;
  let lastFrameId = 0;
  let lastResult = null;
  let lastDecision = 'init';
  return {
    name: 'artnet',
    start() { started = true; scheduler.connect?.(); lastDecision = 'started'; return true; },
    stop() { started = false; queued = null; scheduler.disconnect?.(); lastDecision = 'stopped'; return true; },
    pushFrame(frame = {}) {
      pushed += 1;
      const normalized = { rgb: normalizeRgb(frame), frameId: frame.frameId ?? frame.id ?? lastFrameId + 1 };
      const validation = scheduler.validateFrame?.(normalized);
      if (validation?.ok === false) {
        dropped += 1;
        lastResult = { ok: false, validation };
        lastDecision = `drop:${validation.reason || 'validation'}`;
        return false;
      }
      queued = normalized;
      lastDecision = 'queued-latest';
      return true;
    },
    processOne() {
      if (!started || !queued) return false;
      const frame = queued;
      queued = null;
      lastResult = scheduler.sendFrame(frame);
      lastFrameId = Number(frame.frameId || lastFrameId + 1);
      if (lastResult?.ok === false) { dropped += 1; lastDecision = 'drop:send'; return false; }
      sent += 1; lastDecision = 'sent:artnet-22p'; return true;
    },
    getStatus() {
      const status = scheduler.getStatus?.() || {};
      return { name: 'artnet', started, running: started, queued: queued ? 1 : 0, pushed, processed: sent, sent, dropped, lastFrameId, lastDecision, lastResult, scheduler: status, dryRun: status.dryRun === true };
    }
  };
}

function ensureAdapter(name, options = {}) {
  if (options.adapter) return options.adapter;
  if (name === 'artnet') return createArtNetAdapter(options);
  return createDryRunAdapter(name, options);
}

export function createMultiTransportOutputManager22U(options = {}) {
  const totalPixels = Math.max(1, Number(options.totalPixels || options.stripCount * options.pixelsPerStrip || 2400));
  const expectedBytes = totalPixels * 3;
  const frameBarrierTimeoutMs = Math.max(1, Number(options.frameBarrierTimeoutMs || 25));
  const tickHz = clampInt(options.tickHz || options.fps || options.artnetScheduler22P?.getStatus?.()?.config?.fps, 60, 1, 240);
  const tickIntervalMs = Math.max(1, Math.round(1000 / tickHz));
  const names = ['serial', 'artnet', 'sacn'];
  const transports = Object.fromEntries(names.map((name) => {
    const cfg = { ...(options.transports?.[name] || options[name] || {}) };
    return [name, { enabled: asBool(cfg.enabled, name === 'artnet'), adapter: ensureAdapter(name, { ...cfg, expectedBytes, scheduler: cfg.scheduler || (name === 'artnet' ? options.artnetScheduler22P : null) }) }];
  }));

  let started = false;
  let timer = null;
  let frameSeq = 0;
  let committed = 0;
  let dropped = 0;
  let lastFrameId = 0;
  let queuedFrames = 0;
  let dispatchCount = 0;
  let lastTickAt = 0;
  let lastBarrier = null;
  let lastDispatch = null;
  const history = [];
  const dispatchHistory = [];

  function enabledNames() { return names.filter((name) => transports[name]?.enabled); }
  function transportStatusEntries() {
    return names.map((name) => [name, { enabled: transports[name].enabled, status: transports[name].adapter.getStatus?.() || null }]);
  }
  function getQueueDepth(statusEntries) {
    return statusEntries.reduce((sum, [, entry]) => sum + Math.max(0, Number(entry?.status?.queued || 0)), 0);
  }
  function getActiveTransportCount(statusEntries) {
    return statusEntries.reduce((sum, [, entry]) => sum + (entry?.enabled ? 1 : 0), 0);
  }
  function getRuntimePhase(queueDepth) {
    if (!started) return 'stopped';
    if (queueDepth > 0) return timer ? 'queued-waiting-tick' : 'queued-ready';
    return timer ? 'idle-armed' : 'idle';
  }
  function pushHistory(list, entry, limit = 32) {
    list.push(entry);
    if (list.length > limit) list.shift();
  }
  function stopTimer() {
    if (!timer) return;
    clearTimeout(timer);
    timer = null;
  }
  function scheduleTick(delay = tickIntervalMs) {
    if (!started || timer) return;
    timer = setTimeout(() => {
      timer = null;
      tick();
    }, Math.max(1, Math.round(delay)));
    timer.unref?.();
  }
  function tick() {
    if (!started) return false;
    const targets = enabledNames();
    const beginAt = nowMs();
    const results = {};
    let processedAny = false;
    let okCount = 0;
    for (const name of targets) {
      const t = transports[name];
      if (!t?.enabled) {
        results[name] = { ok: false, skipped: true, reason: 'disabled' };
        continue;
      }
      const processed = t.adapter.processOne?.() === true;
      const status = t.adapter.getStatus?.() || null;
      const ok = processed === true;
      if (ok) okCount += 1;
      if (processed) processedAny = true;
      results[name] = { ok, processed, status };
    }
    const elapsedMs = nowMs() - beginAt;
    lastTickAt = beginAt;
    if (processedAny) {
      dispatchCount += 1;
      committed += 1;
      lastDispatch = Object.freeze({
        ok: okCount === targets.length,
        processedAny,
        targets,
        okCount,
        expected: targets.length,
        elapsedMs,
        at: beginAt,
        results
      });
      pushHistory(dispatchHistory, lastDispatch);
    }
    if (started) scheduleTick(processedAny ? 0 : tickIntervalMs);
    return processedAny;
  }
  function setEnabled(name, value = true) {
    const key = normalizeName(name);
    if (!key) return false;
    transports[key].enabled = value !== false;
    if (started && transports[key].enabled) transports[key].adapter.start?.();
    if (!transports[key].enabled) transports[key].adapter.stop?.();
    if (started) scheduleTick(0);
    return true;
  }
  function start() {
    if (started) return getStatus();
    started = true;
    for (const name of enabledNames()) transports[name].adapter.start?.();
    scheduleTick(0);
    return getStatus();
  }
  function stop() {
    stopTimer();
    for (const name of names) transports[name].adapter.stop?.();
    started = false;
    return getStatus();
  }
  function sendFrame(frame = {}, sendOptions = {}) {
    if (!started) start();
    frameSeq += 1;
    const frameId = Number(frame.frameId ?? frame.id ?? frameSeq);
    const rgb = normalizeRgb(frame);
    const targets = sendOptions.transports ? sendOptions.transports.map(normalizeName).filter(Boolean) : enabledNames();
    const beginAt = nowMs();
    const results = {};
    let okCount = 0;
    for (const name of targets) {
      const t = transports[name];
      if (!t?.enabled) { results[name] = { ok: false, skipped: true, reason: 'disabled' }; continue; }
      const accepted = t.adapter.pushFrame?.({ ...frame, rgb, frameId }) !== false;
      const ok = accepted;
      if (ok) okCount += 1;
      results[name] = { ok, accepted, processed: false, status: t.adapter.getStatus?.() || null };
    }
    const elapsedMs = nowMs() - beginAt;
    const ok = targets.length > 0 && okCount === targets.length && elapsedMs <= frameBarrierTimeoutMs;
    if (ok) queuedFrames += 1; else dropped += 1;
    lastFrameId = frameId;
    lastBarrier = Object.freeze({
      ok,
      phase: 'queued',
      frameId,
      targets,
      okCount,
      expected: targets.length,
      elapsedMs,
      timeoutMs: frameBarrierTimeoutMs,
      at: beginAt,
      results
    });
    pushHistory(history, lastBarrier);
    if (ok) scheduleTick(0);
    return lastBarrier;
  }
  function panicBlackout(reason = 'multi-transport-panic') {
    const rgb = new Uint8Array(expectedBytes);
    const result = sendFrame({ rgb, frameId: lastFrameId + 1, blackout: true }, {});
    tick();
    for (const name of names) transports[name].adapter.stop?.();
    stopTimer();
    started = false;
    return { ok: true, reason: String(reason || 'multi-transport-panic'), blackout: result, status: getStatus() };
  }
  function getStatus() {
    const statusEntries = transportStatusEntries();
    const queueDepth = getQueueDepth(statusEntries);
    return {
      ok: true,
      version: 'step22u-multi-transport-output-manager',
      started,
      totalPixels,
      expectedBytes,
      frameBarrierTimeoutMs,
      tickHz,
      tickIntervalMs,
      enabled: enabledNames(),
      runtime: {
        phase: getRuntimePhase(queueDepth),
        timerArmed: Boolean(timer),
        queueDepth,
        activeTransportCount: getActiveTransportCount(statusEntries),
        lastTickAgeMs: lastTickAt ? Math.max(0, nowMs() - lastTickAt) : null,
        lastFrameAgeMs: lastBarrier?.at ? Math.max(0, nowMs() - lastBarrier.at) : null,
        lastDispatchAgeMs: lastDispatch?.at ? Math.max(0, nowMs() - lastDispatch.at) : null
      },
      counters: { frameSeq, queuedFrames, dispatchCount, committed, dropped, lastFrameId, lastTickAt },
      lastBarrier,
      lastDispatch,
      transports: Object.fromEntries(statusEntries),
      history: [...history],
      dispatchHistory: [...dispatchHistory]
    };
  }
  return Object.freeze({ start, stop, tick, sendFrame, setEnabled, panicBlackout, getStatus });
}
