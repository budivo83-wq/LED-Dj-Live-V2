export function toggleCenterMenuRuntimeAction(controls, toggleCenterMenuRuntime) {
  toggleCenterMenuRuntime(controls.centerMenuStrip);
}

export function handleOutsideMenuClickRuntimeAction(event, controls, handleOutsideMenuClickRuntime) {
  handleOutsideMenuClickRuntime(event, controls.centerMenuStrip);
}

export function setMasterFlashRuntimeAction(state, active, syncControls, commitState) {
  state.fxMaster.flash = active;
  syncControls();
  commitState();
}
