import { createScreenModule } from '../base.js';

export function createPerformanceScreen() {
  let unsub = null;

  return createScreenModule('performance', {
    mount(ctx) {
      unsub = this.subscribe(ctx);
    },
    unmount() {
      if (typeof unsub === 'function') unsub();
      unsub = null;
    },
    subscribe(ctx) {
      if (!ctx?.store) return () => {};
      return ctx.store.subscribe((state, prev, meta) => {
        void prev;
        void meta;
        if (state.ui.screen !== 'performance') return;
        // TODO: bind performance controls/view renderer.
      });
    }
  });
}
