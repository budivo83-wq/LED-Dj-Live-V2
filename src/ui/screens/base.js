export function createScreenModule(name, impl = {}) {
  const api = {
    name,
    mount: impl.mount || (() => {}),
    unmount: impl.unmount || (() => {}),
    subscribe: impl.subscribe || (() => (() => {}))
  };
  return api;
}
