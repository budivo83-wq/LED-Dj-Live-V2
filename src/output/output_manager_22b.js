import { createSerialOutputAdapter } from './adapters/serial/index.js';

function normalizeMode(value) {
  const mode = String(value || 'preview').toLowerCase();
  if (mode === 'raw' || mode === 'raw_serial' || mode === 'serial') return 'serial';
  if (mode === 'blx' || mode === 'blx_serial') return 'blx';
  if (mode === 'artnet' || mode === 'udp') return 'artnet';
  if (mode === 'preview' || mode === 'none' || mode === 'off') return 'preview';
  return 'preview';
}

function nowMs() {
  return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
}

function createLazyAdapterRegistry(config = {}) {
  const adapters = {
    serial: createSerialOutputAdapter(config.serial || {})
  };

  function getAdapter(mode) {
    const key = normalizeMode(mode);
    return adapters[key] || null;
  }

  function start(mode) {
    const adapter = getAdapter(mode);
    if (!adapter) return false;
    adapter.start();
    return true;
  }

  function stop(mode) {
    const adapter = getAdapter(mode);
    if (!adapter) return false;
    adapter.stop();
    return true;
  }

  function pushFrame(mode, frame) {
    const adapter = getAdapter(mode);
    if (!adapter) return false;
    return adapter.pushFrame(frame);
  }

  function tick(mode) {
    const adapter = getAdapter(mode);
    if (adapter) adapter.processOne();
  }

  function getAllStatus() {
    return Object.fromEntries(Object.entries(adapters).map(([key, adapter]) => [key, adapter.getStatus()]));
  }

  return { getAdapter, start, stop, pushFrame, tick, getAllStatus };
}

export function createOutputManager22B(config = {}) {
  const registry = createLazyAdapterRegistry(config.adapters || config);
  const enabled = new Set(Array.isArray(config.enabled) && config.enabled.length ? config.enabled.map(normalizeMode) : ['serial']);
  let active = normalizeMode(config.active || config.mode || 'serial');
  let started = false;
  let pushed = 0;
  let dropped = 0;
  let lastFrameId = 0;
  let lastDecision = 'init';
  let lastAt = 0;

  function setEnabled(mode, value = true) {
    const key = normalizeMode(mode);
    if (key === 'preview') return false;
    if (value) enabled.add(key);
    else enabled.delete(key);
    return true;
  }

  function setActive(mode) {
    const key = normalizeMode(mode);
    if (key === 'preview') {
      active = key;
      return active;
    }
    if (!registry.getAdapter(key)) return active;
    active = key;
    enabled.add(key);
    if (started) registry.start(key);
    return active;
  }

  function start() {
    started = true;
    for (const mode of enabled) registry.start(mode);
    if (active !== 'preview') registry.start(active);
    lastDecision = 'started';
  }

  function stop() {
    for (const mode of Array.from(enabled)) registry.stop(mode);
    started = false;
    lastDecision = 'stopped';
  }

  function sendFrame(frame, options = {}) {
    if (options.mode || options.transport || options.output) setActive(options.mode || options.transport || options.output);
    if (!started) start();
    lastFrameId = Number(frame?.frameId ?? lastFrameId);
    lastAt = nowMs();

    if (active === 'preview') {
      pushed += 1;
      lastDecision = 'preview-only';
      return { ok: true, output: 'preview', previewOnly: true };
    }

    const ok = registry.pushFrame(active, frame);
    registry.tick(active);
    if (ok === false) {
      dropped += 1;
      lastDecision = `drop:${active}`;
      return { ok: false, output: active, reason: 'adapter_rejected_frame' };
    }

    pushed += 1;
    lastDecision = `sent:${active}`;
    return { ok: true, output: active };
  }

  function tick() {
    if (!started) return;
    for (const mode of enabled) registry.tick(mode);
  }

  function getStatus() {
    return {
      version: 'STEP22B_OUTPUT_MANAGER_ADAPTER_REGISTRY',
      active,
      enabled: Array.from(enabled),
      started,
      pushed,
      dropped,
      lastFrameId,
      lastAt,
      lastDecision,
      adapters: registry.getAllStatus()
    };
  }

  return {
    start,
    stop,
    tick,
    sendFrame,
    setActive,
    setEnabled,
    getStatus,
    getAdapter: registry.getAdapter
  };
}
