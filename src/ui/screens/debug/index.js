import { createScreenModule } from '../base.js';

export function createDebugScreen() {
  let unsub = null;

  return createScreenModule('debug', {
    mount(ctx) {
      unsub = this.subscribe(ctx);
    },
    unmount() {
      if (typeof unsub === 'function') unsub();
      unsub = null;
    },
    subscribe(ctx) {
      if (!ctx?.store) return () => {};
      return ctx.store.subscribe((state) => {
        if (state.ui.screen !== 'debug') return;
        // TODO: bind debug panel consumers.
      });
    }
  });
}
