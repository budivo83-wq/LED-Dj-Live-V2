export function createStateActions(store) {
  const patchSlice = (slice, patch, type) => {
    store.setState((prev) => ({
      ...prev,
      [slice]: {
        ...prev[slice],
        ...patch
      }
    }), { type });
  };

  return {
    setRuntime(patch) {
      patchSlice('runtime', patch, 'runtime/set');
    },
    setRender(patch) {
      patchSlice('render', patch, 'render/set');
    },
    setMapping(patch) {
      patchSlice('mapping', patch, 'mapping/set');
    },
    setOutput(patch) {
      patchSlice('output', patch, 'output/set');
    },
    setUi(patch) {
      patchSlice('ui', patch, 'ui/set');
    },
    tickFrame(now, dt) {
      store.setState((prev) => ({
        ...prev,
        runtime: {
          ...prev.runtime,
          now,
          dt,
          frame: Number(prev.runtime.frame || 0) + 1
        }
      }), { type: 'runtime/tick' });
    }
  };
}
