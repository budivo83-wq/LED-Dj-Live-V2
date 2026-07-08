import { readFeatureFlags, shouldPreferNextRuntime } from "./feature_flags.js";

export function createMigrationRuntime(options = {}) {
  const legacy = options.legacy || null;
  const next = options.next || null;
  const storage = options.storage || globalThis.localStorage;
  const flagSource = options.flags || null;

  let active = "legacy";
  let flags = flagSource || readFeatureFlags(storage);

  function resolveActive() {
    const preferNext = shouldPreferNextRuntime(flags);
    active = preferNext && next ? "next" : "legacy";
    return active;
  }

  function current() {
    return resolveActive() === "next" ? next : legacy;
  }

  return {
    refreshFlags(nextFlags) {
      if (nextFlags) flags = nextFlags;
      else flags = readFeatureFlags(storage);
      return resolveActive();
    },
    getFlags() {
      return { ...flags };
    },
    getActive() {
      return resolveActive();
    },
    start(...args) {
      const runtime = current();
      return runtime?.start?.(...args);
    },
    stop(...args) {
      const runtime = current();
      return runtime?.stop?.(...args);
    },
    tick(...args) {
      const runtime = current();
      return runtime?.tick?.(...args);
    },
    getStatus() {
      const runtime = current();
      return {
        active: resolveActive(),
        flags: { ...flags },
        status: runtime?.getStatus?.() || null
      };
    }
  };
}

