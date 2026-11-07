import { createScreenModule } from '../base.js';

export function createSettingsScreen() {
  let unsub = null;

  return createScreenModule('settings', {
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
        if (state.ui.screen !== 'settings') return;
        // TODO: bind settings forms and side effects via actions.
      });
    }
  });
}
