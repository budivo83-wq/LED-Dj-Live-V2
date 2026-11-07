export function createCrossControl({
  documentRef = document,
  windowRef = window,
  state,
  settings,
  controls,
  clamp01,
  isTypingTarget,
  syncControls,
  commitState
} = {}) {
  let mouseControl = false;
  let altControl = false;
  let commitFrame = 0;

  function isActive() {
    return mouseControl || altControl;
  }

  function sync() {
    const active = isActive();
    documentRef.body?.classList.toggle("cross-control-active", active);
    controls.crossMouseToggle?.classList.toggle("active", mouseControl);
  }

  function syncCrossInput() {
    if (!controls.cross) return;
    controls.cross.value = state.cross;
    controls.cross.style.setProperty("--cross-pos", `${state.cross * 100}%`);
  }

  function scheduleCommit() {
    if (!commitState || commitFrame) return;
    if (typeof windowRef.requestAnimationFrame !== "function") {
      commitState();
      return;
    }
    commitFrame = windowRef.requestAnimationFrame(() => {
      commitFrame = 0;
      commitState();
    });
  }

  function setMouseControl(active) {
    mouseControl = Boolean(active);
    sync();
  }

  function toggleMouseControl() {
    setMouseControl(!mouseControl);
  }

  function setAltControl(active) {
    altControl = Boolean(active);
    sync();
  }

  function handlePointerMove(event) {
    if (!isActive()) return;
    if (isTypingTarget?.(event.target)) return;
    event.preventDefault();
    const movement = Number.isFinite(event.movementX) ? event.movementX : 0;
    const fallback = event.clientX / Math.max(1, windowRef.innerWidth) - state.cross;
    const delta = movement ? movement / Math.max(1, windowRef.innerWidth) : fallback;
    const sensitivity = Number.isFinite(Number(settings.crossMouseSensitivity)) ? Number(settings.crossMouseSensitivity) : 2.2;
    state.cross = clamp01(state.cross + delta * sensitivity);
    syncCrossInput();
    scheduleCommit();
  }

  function blockPointer(event) {
    if (!isActive()) return;
    if (!altControl) return;
    if (event.target === controls.crossMouseToggle || event.target === controls.cross) return;
    event.preventDefault();
    event.stopPropagation();
  }

  function handleDoubleClick(event) {
    if (!mouseControl) return;
    if (event.target === controls.crossMouseToggle) return;
    mouseControl = false;
    sync();
    event.preventDefault();
    event.stopPropagation();
  }

  function bindDocumentEvents() {
    documentRef.addEventListener("pointermove", handlePointerMove, { passive: false });
    documentRef.addEventListener("pointerdown", blockPointer, true);
    documentRef.addEventListener("click", blockPointer, true);
    documentRef.addEventListener("dblclick", handleDoubleClick, true);
  }

  return {
    bindDocumentEvents,
    toggleMouseControl,
    setAltControl,
    sync,
    handlePointerMove,
    blockPointer,
    handleDoubleClick,
    isActive
  };
}
