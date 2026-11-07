import { initialState } from './initial_state.js';

function cloneInitialState() {
  return structuredClone ? structuredClone(initialState) : JSON.parse(JSON.stringify(initialState));
}

export function createStateStore(seed = null) {
  let state = seed ? { ...cloneInitialState(), ...seed } : cloneInitialState();
  const subscribers = new Set();

  const getState = () => state;

  const setState = (updater, meta = {}) => {
    const prev = state;
    const next = typeof updater === 'function' ? updater(prev) : updater;
    if (!next || next === prev) return;
    state = next;
    for (const fn of subscribers) fn(state, prev, meta);
  };

  const subscribe = (listener) => {
    subscribers.add(listener);
    return () => subscribers.delete(listener);
  };

  const select = (selector) => selector(state);

  return {
    getState,
    setState,
    subscribe,
    select
  };
}
