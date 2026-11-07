function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function cloneSyncValue(value) {
  if (!isPlainObject(value) && !Array.isArray(value)) return value;
  try { return typeof structuredClone === "function" ? structuredClone(value) : JSON.parse(JSON.stringify(value)); }
  catch { return Array.isArray(value) ? value.slice() : { ...value }; }
}

function mergeSyncPatch(base, patch) {
  const out = cloneSyncValue(base || {});
  if (!isPlainObject(patch)) return out;
  Object.entries(patch).forEach(([key, value]) => {
    if (isPlainObject(value) && isPlainObject(out[key])) out[key] = mergeSyncPatch(out[key], value);
    else out[key] = cloneSyncValue(value);
  });
  return out;
}

function buildSyncPatch(previous, next) {
  if (previous === next) return null;
  if (Array.isArray(previous) || Array.isArray(next)) {
    const a = Array.isArray(previous) ? previous : [];
    const b = Array.isArray(next) ? next : [];
    if (a.length === b.length && a.every((value, index) => value === b[index])) return null;
    return cloneSyncValue(next);
  }
  if (isPlainObject(previous) && isPlainObject(next)) {
    const patch = {};
    const keys = new Set([...Object.keys(previous), ...Object.keys(next)]);
    keys.forEach((key) => {
      const diff = buildSyncPatch(previous[key], next[key]);
      if (diff !== null) patch[key] = diff;
    });
    return Object.keys(patch).length ? patch : null;
  }
  return previous === next ? null : cloneSyncValue(next);
}

export function connectSocketRuntime(deps) {
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
    syncRemoteUi = true,
    persistRemoteState = true
  } = deps;

  const protocol = locationRef.protocol === "https:" ? "wss" : "ws";
  const socket = new WebSocket(`${protocol}://${locationRef.host}`);
  setSocket(socket);

  socket.addEventListener("message", async (event) => {
    try {
      const message = JSON.parse(event.data);
      const isCommand = message?.type === "command";
      const command = isCommand && isPlainObject(message.command) ? message.command : null;
      const commandPatch = isPlainObject(command?.patch) ? command.patch : (isPlainObject(message.patch) ? message.patch : null);
      const commandPersist = command?.persist !== false && message.persist !== false;
      if (!["init", "update", "command"].includes(message?.type)) return;
      const incomingState = message.state || (commandPatch ? mergeSyncPatch(state, commandPatch) : null);
      if (isCommand && command && typeof window !== "undefined") {
        try {
          window.dispatchEvent(new CustomEvent("budilight:command", {
            detail: {
              kind: String(command.kind || "command"),
              payload: isPlainObject(command.payload) ? command.payload : {},
              patch: commandPatch || null,
              persist: command?.persist !== false && message.persist !== false,
              reason: String(command.reason || message.reason || command.kind || "command")
            }
          }));
        } catch {}
      }
      if (!incomingState) return;

      if (message.type === "init" && getPreferLocalStateOnBoot()) {
        setPreferLocalStateOnBoot(false);
        if (getSocket()?.readyState === WebSocket.OPEN) {
          getSocket().send(JSON.stringify({ type: "update", state }));
        }
        return;
      }

      setApplyingRemoteState(true);
      const prevFiles = {
        l1Anim: state?.l1?.animFile,
        l1Palette: state?.l1?.paletteFile,
        l2Anim: state?.l2?.animFile,
        l2Palette: state?.l2?.paletteFile
      };
      applyState(incomingState);
      const moduleSelectionChanged = prevFiles.l1Anim !== state?.l1?.animFile
        || prevFiles.l1Palette !== state?.l1?.paletteFile
        || prevFiles.l2Anim !== state?.l2?.animFile
        || prevFiles.l2Palette !== state?.l2?.paletteFile;
      if (moduleSelectionChanged) {
        await loadSelectedModules();
        scheduleCpuPrewarm();
      }
      if (syncRemoteUi) syncControls();
      setApplyingRemoteState(false);
      if (persistRemoteState && commandPersist) saveLocalState();
    } catch (error) {
      console.warn("Bad websocket message", error);
      setApplyingRemoteState(false);
    }
  });
}

export function commitStateRuntime(deps) {
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
    transport = "update",
    persist = true,
    volatile = false,
    reason = "state-sync",
    commandKind = null
  } = deps;

  if (!commitStateRuntime._lastSentState) commitStateRuntime._lastSentState = cloneSyncValue(state);
  // STEP37BR: keep a separate persisted baseline. Volatile/live-param commits
  // are allowed to update the live WS baseline so slider drags stay tiny, but
  // they must NOT advance the persisted baseline. Otherwise the final
  // mouseup/touchend state-patch can diff to empty and the server never saves
  // the last value.
  if (!commitStateRuntime._lastPersistedSentState) commitStateRuntime._lastPersistedSentState = cloneSyncValue(state);

  clearSaveTimer();
  if (!volatile && persist !== false) {
    armSaveTimer(window.setTimeout(saveLocalState, Math.max(250, Number(window.RUNTIME_PROFILE?.stateSaveIdleMs || 350))));
  }

  if (applyingRemoteState() || getSocket()?.readyState !== WebSocket.OPEN) return;

  const now = performance.now();
  const minSyncGapMs = 33;
  const elapsed = now - Number(getLastSyncAt?.() || 0);

  const sendLatestState = () => {
    clearSyncTimer?.();
    const socket = getSocket();
    if (applyingRemoteState() || socket?.readyState !== WebSocket.OPEN) return;
    const useCommandBus = transport === "command" || volatile === true;
    const persistThisCommit = persist !== false && !volatile;
    const diffBase = persistThisCommit ? commitStateRuntime._lastPersistedSentState : commitStateRuntime._lastSentState;
    const patch = buildSyncPatch(diffBase, state);
    if (!patch) return;
    // STEP37AI: output-smoothness sync trim. Do not stringify the full runtime
    // state on every small UI change just to compare lengths. That full
    // JSON.stringify was visible as a main-thread spike while preview/output
    // were also running. Normal commits now send the already-computed patch;
    // INIT/local-boot recovery still uses a full-state message above.
    if (Number(socket.bufferedAmount || 0) > Math.max(256000, Number(window.RUNTIME_PROFILE?.wsStateBufferedSkipBytes || 512000))) {
      armSyncTimer?.(window.setTimeout(sendLatestState, Math.max(80, Number(window.RUNTIME_PROFILE?.wsStateBackpressureRetryMs || 120))));
      return;
    }
    const kind = useCommandBus
      ? String(commandKind || (volatile ? "live-param" : "state-patch"))
      : "update";
    const envelope = useCommandBus
      ? { type: "command", command: { kind, patch, persist: persistThisCommit, reason } }
      : { type: "update", patch };
    socket.send(JSON.stringify(envelope));
    commitStateRuntime._lastSentState = cloneSyncValue(state);
    if (persistThisCommit || !useCommandBus) commitStateRuntime._lastPersistedSentState = cloneSyncValue(state);
    setLastSyncAt?.(performance.now());
    try {
      window.__budilightCommandBus37BK = {
        version: "STEP37BK_COMMAND_BUS",
        lastTransport: useCommandBus ? "command" : "update",
        lastKind: kind,
        lastReason: reason,
        lastPersist: persistThisCommit,
        lastPatchKeys: Object.keys(patch || {}),
        lastSentAt: performance.now(),
        bufferedAmount: Number(socket.bufferedAmount || 0)
      };
    } catch {}
  };

  if (elapsed >= minSyncGapMs) {
    sendLatestState();
    return;
  }

  if (hasSyncTimer?.()) return;
  armSyncTimer?.(window.setTimeout(sendLatestState, Math.max(0, minSyncGapMs - elapsed)));
}
