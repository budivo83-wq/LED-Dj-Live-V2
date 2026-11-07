import { createPerformanceScreen } from './screens/performance/index.js';
import { createMappingScreen } from './screens/mapping/index.js';
import { createSettingsScreen } from './screens/settings/index.js';
import { createDebugScreen } from './screens/debug/index.js';

const SCREEN_FACTORIES = Object.freeze({
  performance: createPerformanceScreen,
  mapping: createMappingScreen,
  settings: createSettingsScreen,
  debug: createDebugScreen
});

export function createUiScreenManager(ctx = {}) {
  const screens = new Map();
  let active = null;

  function getOrCreate(name) {
    const key = String(name || '').toLowerCase();
    if (screens.has(key)) return screens.get(key);
    const factory = SCREEN_FACTORIES[key];
    if (!factory) return null;
    const screen = factory();
    screens.set(key, screen);
    return screen;
  }

  function activate(name) {
    const next = getOrCreate(name);
    if (!next) return false;
    if (active && active !== next) active.unmount(ctx);
    active = next;
    active.mount(ctx);
    return true;
  }

  function deactivate() {
    if (!active) return;
    active.unmount(ctx);
    active = null;
  }

  function getActive() {
    return active?.name || null;
  }

  return {
    activate,
    deactivate,
    getActive,
    listAvailable() {
      return Object.keys(SCREEN_FACTORIES);
    }
  };
}
