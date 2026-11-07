/**
 * Core engine boundary.
 * Core must not depend on render/output/UI implementations.
 */

/**
 * @typedef {import("../contracts/types.js").EngineFrameContext} EngineFrameContext
 */

/**
 * @typedef {Object} CoreEngineApi
 * @property {(ctx: EngineFrameContext) => void} tick
 * @property {(event: string, handler: Function) => () => void} on
 * @property {() => Record<string, any>} getSnapshot
 */

/**
 * @returns {CoreEngineApi}
 */
export function createCoreEngineApi() {
  /** @type {Map<string, Set<Function>>} */
  const listeners = new Map();
  /** @type {Record<string, any>} */
  let snapshot = {};

  return {
    tick(ctx) {
      snapshot = { ...snapshot, now: ctx.now, dt: ctx.dt, frame: ctx.frame };
      const bucket = listeners.get("tick");
      if (!bucket) return;
      for (const fn of bucket) fn(ctx);
    },
    on(event, handler) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      const bucket = listeners.get(event);
      bucket.add(handler);
      return () => bucket.delete(handler);
    },
    getSnapshot() {
      return snapshot;
    }
  };
}

