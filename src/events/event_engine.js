import { createEventBus } from './core/bus.js';
import { createEventScheduler } from './scheduler/hierarchy_scheduler.js';

export function createEventEngine(options = {}) {
  const bus = createEventBus();
  const scheduler = createEventScheduler({
    bus,
    beatsPerBar: options.beatsPerBar || 4,
    barsPerPhrase: options.barsPerPhrase || 8
  });

  return {
    on: bus.on,
    emit: bus.emit,
    tick(now, bpm) {
      scheduler.tick(now, bpm);
    },
    getState() {
      return scheduler.getState();
    },
    clear() {
      bus.clear();
    }
  };
}

