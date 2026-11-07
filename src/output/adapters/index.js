import { createSerialOutputAdapter } from './serial/index.js';
import { createBlxOutputAdapter } from './blx/index.js';
import { createArtnetOutputAdapter } from './artnet/index.js';

export function createOutputAdapterRegistry(config = {}) {
  const adapters = {
    serial: createSerialOutputAdapter(config.serial || {}),
    blx: createBlxOutputAdapter(config.blx || {}),
    artnet: createArtnetOutputAdapter(config.artnet || {})
  };

  function getAdapter(mode) {
    const key = String(mode || '').toLowerCase();
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
    if (!adapter) return;
    adapter.processOne();
  }

  function getStatus(mode) {
    const adapter = getAdapter(mode);
    return adapter ? adapter.getStatus() : null;
  }

  function getAllStatus() {
    return Object.fromEntries(Object.entries(adapters).map(([key, adapter]) => [key, adapter.getStatus()]));
  }

  return {
    getAdapter,
    start,
    stop,
    pushFrame,
    tick,
    getStatus,
    getAllStatus
  };
}
