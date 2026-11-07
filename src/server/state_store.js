import fs from "fs";

export function createStateStore({ stateFile } = {}) {
  function sanitizeState(nextState) {
    return JSON.parse(JSON.stringify(nextState || {}));
  }

  function startupState(nextState) {
    const state = sanitizeState(nextState || {});
    state.beat = typeof state.beat === "object" && state.beat !== null ? state.beat : {};
    state.beat.startedAt = Number.isFinite(Number(state.beat.startedAt)) ? Number(state.beat.startedAt) : Date.now();
    state.beat.resetId = Number.isFinite(Number(state.beat.resetId)) ? Number(state.beat.resetId) : 0;
    return state;
  }

  function load() {
    try {
      return JSON.parse(fs.readFileSync(stateFile, "utf8"));
    } catch {
      return {};
    }
  }

  function save(nextState) {
    fs.writeFile(stateFile, JSON.stringify(nextState, null, 2), () => {});
  }

  return {
    load,
    save,
    startupState
  };
}
