import { connectSocketRuntime, commitStateRuntime } from "./websocket_sync.js";

export function connectSocketBridge(deps) {
  const {
    locationRef,
    state,
    getPreferLocalStateOnBoot,
    setPreferLocalStateOnBoot,
    getSocket,
    setSocket,
    applyState,
    loadSelectedModules,
    scheduleCpuPrewarm,
    syncControls,
    saveLocalState,
    setApplyingRemoteState,
    syncRemoteUi,
    persistRemoteState
  } = deps;

  connectSocketRuntime({
    locationRef,
    state,
    getPreferLocalStateOnBoot,
    setPreferLocalStateOnBoot,
    getSocket,
    setSocket,
    applyState,
    loadSelectedModules,
    scheduleCpuPrewarm,
    syncControls,
    saveLocalState,
    setApplyingRemoteState,
    syncRemoteUi,
    persistRemoteState
  });
}

export function commitStateBridge(deps) {
  const {
    applyingRemoteState,
    getSocket,
    state,
    clearSaveTimer,
    armSaveTimer,
    clearSyncTimer,
    armSyncTimer,
    hasSyncTimer,
    getLastSyncAt,
    setLastSyncAt,
    saveLocalState,
    transport,
    persist,
    volatile,
    reason,
    commandKind
  } = deps;

  commitStateRuntime({
    applyingRemoteState,
    getSocket,
    state,
    clearSaveTimer,
    armSaveTimer,
    clearSyncTimer,
    armSyncTimer,
    hasSyncTimer,
    getLastSyncAt,
    setLastSyncAt,
    saveLocalState,
    transport,
    persist,
    volatile,
    reason,
    commandKind
  });
}
