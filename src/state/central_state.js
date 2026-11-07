import { createStateStore } from './store.js';
import { createStateActions } from './actions.js';
import { selectors } from './selectors.js';

export function createCentralState(seed = null) {
  const store = createStateStore(seed);
  const actions = createStateActions(store);
  return {
    store,
    actions,
    selectors
  };
}
