export function createLayerModuleNavigation({
  lists,
  state,
  randomItem,
  switchLayerModule
}) {
  if (!lists || !state || typeof switchLayerModule !== "function") {
    throw new Error("createLayerModuleNavigation requires lists, state and switchLayerModule");
  }

  const laneState = new Map();

  function laneKey(layer, moduleKey) {
    return `${String(layer)}:${String(moduleKey)}`;
  }

  function readLane(layer, moduleKey) {
    const key = laneKey(layer, moduleKey);
    let lane = laneState.get(key);
    if (!lane) {
      lane = {
        busy: false,
        pending: null,
        timer: 0
      };
      laneState.set(key, lane);
    }
    return lane;
  }

  async function runQueuedSwitch(layer, moduleKey, execute, options = {}) {
    const lane = readLane(layer, moduleKey);
    const coalesce = options.coalesce !== false;
    const debounceMs = Math.max(0, Number(options.debounceMs || 0));

    if (lane.busy && coalesce) {
      // STEP37DY: performance pads such as DROP may be pressed several times
      // while a previous shader import is still settling. For live use we must
      // not build a tail of pending imports/warmups; that is what produced the
      // long 10-30s freeze after repeated DROP taps. dropIfBusy means: keep the
      // current switch and ignore this extra request.
      if (options.dropIfBusy === true) return;
      lane.pending = { execute, options };
      return;
    }

    if (lane.timer && coalesce) {
      if (options.dropIfBusy === true) return;
      lane.pending = { execute, options };
      return;
    }

    const start = async (job = { execute, options }) => {
      lane.timer = 0;
      lane.busy = true;
      try {
        await job.execute();
      } finally {
        lane.busy = false;
        if (lane.pending) {
          const next = lane.pending;
          lane.pending = null;
          await runQueuedSwitch(layer, moduleKey, next.execute, next.options);
        }
      }
    };

    if (coalesce && debounceMs > 0) {
      lane.pending = { execute, options };
      lane.timer = setTimeout(() => {
        const next = lane.pending;
        lane.pending = null;
        if (!next) return;
        start(next);
      }, debounceMs);
      return;
    }

    await start();
  }

  async function stepFile(layer, stateKey, listKey, folder, moduleKey, direction, options = {}) {
    const files = lists[listKey];
    if (!files?.length) return;

    await runQueuedSwitch(layer, moduleKey, async () => {
      const current = Math.max(0, files.indexOf(state[layer][stateKey]));
      const next = (current + direction + files.length) % files.length;
      await switchLayerModule(layer, stateKey, folder, moduleKey, files[next], { ...options, files });
    }, options);
  }

  async function randomizeSingleFile(layer, stateKey, listKey, folder, moduleKey, options = {}) {
    const files = lists[listKey];
    if (!files?.length) return;
    if (typeof randomItem !== "function") return;

    await runQueuedSwitch(layer, moduleKey, async () => {
      await switchLayerModule(layer, stateKey, folder, moduleKey, randomItem(files), { ...options, files });
    }, options);
  }

  return {
    stepFile,
    randomizeSingleFile
  };
}
