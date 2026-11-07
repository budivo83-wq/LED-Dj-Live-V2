import { connectSocketBridge, commitStateBridge } from "./websocket_bridge.js";

export function createStateSyncController(deps) {
  const {
    locationRef,
    windowRef,
    state,
    applyState,
    loadSelectedModules,
    scheduleCpuPrewarm,
    syncControls,
    saveLocalState,
    syncRemoteUi = true,
    persistRemoteState = true
  } = deps;

  let socket = null;
  let preferLocalStateOnBoot = false;
  let applyingRemoteState = false;
  let saveTimer = 0;
  let syncTimer = 0;
  let lastSyncAt = 0;

  function connect() {
    connectSocketBridge({
      locationRef,
      state,
      getPreferLocalStateOnBoot: () => preferLocalStateOnBoot,
      setPreferLocalStateOnBoot: (value) => { preferLocalStateOnBoot = value; },
      getSocket: () => socket,
      setSocket: (next) => { socket = next; },
      applyState,
      loadSelectedModules,
      scheduleCpuPrewarm,
      syncControls,
      saveLocalState,
      setApplyingRemoteState: (value) => { applyingRemoteState = value; },
      syncRemoteUi,
      persistRemoteState
    });
  }

  function commit(options = {}) {
    commitStateBridge({
      applyingRemoteState: () => applyingRemoteState,
      getSocket: () => socket,
      state,
      clearSaveTimer: () => windowRef.clearTimeout(saveTimer),
      armSaveTimer: (timer) => { saveTimer = timer; },
      clearSyncTimer: () => {
        if (!syncTimer) return;
        windowRef.clearTimeout(syncTimer);
        syncTimer = 0;
      },
      armSyncTimer: (timer) => { syncTimer = timer; },
      hasSyncTimer: () => Boolean(syncTimer),
      getLastSyncAt: () => lastSyncAt,
      setLastSyncAt: (value) => { lastSyncAt = value; },
      saveLocalState,
      transport: options.transport || options.mode || "update",
      persist: options.persist !== false,
      volatile: options.volatile === true,
      reason: String(options.reason || "state-sync"),
      commandKind: options.commandKind || options.kind || null
    });
  }

  return {
    connect,
    commit,
    getSocket: () => socket,
    isApplyingRemoteState: () => applyingRemoteState,
    setPreferLocalStateOnBoot: (value) => { preferLocalStateOnBoot = value; }
  };
}
