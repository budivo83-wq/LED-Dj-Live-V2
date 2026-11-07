export function createEventBus() {
  const listeners = new Map();

  function on(event, handler) {
    const key = String(event || '');
    if (!listeners.has(key)) listeners.set(key, new Set());
    const bucket = listeners.get(key);
    bucket.add(handler);
    return () => bucket.delete(handler);
  }

  function emit(event, payload) {
    const key = String(event || '');
    const bucket = listeners.get(key);
    if (!bucket) return;
    for (const fn of bucket) fn(payload);
  }

  function clear(event) {
    if (typeof event === 'undefined') {
      listeners.clear();
      return;
    }
    listeners.delete(String(event));
  }

  return {
    on,
    emit,
    clear
  };
}
