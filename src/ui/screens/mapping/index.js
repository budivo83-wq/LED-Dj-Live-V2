import { createScreenModule } from '../base.js';

export function createMappingScreen() {
  let unsub = null;

  return createScreenModule('mapping', {
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
        if (state.ui.screen !== 'mapping') return;
        // TODO: bind mapping UI renderer and interactions.
      });
    }
  });
}
