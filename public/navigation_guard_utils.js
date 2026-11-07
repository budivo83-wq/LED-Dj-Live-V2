import { requestShellNavigation } from "./runtime/shell_child_navigation.js";

export function navigateNow(target, options = {}) {
  if (!target?.href) return false;
  const {
    sessionStorageRef = globalThis.sessionStorage,
    locationRef = globalThis.location,
    mainReturnFastKey = "led-main-return-fast"
  } = options;
  return requestShellNavigation(target.href, {
    sessionStorageRef,
    locationRef,
    mainReturnFastKey,
    mainReturnFast: target.mainReturnFast
  });
}

export function hideLeaveGuardState(state = {}) {
  return { ...state, pendingNavigation: null, isVisible: false };
}

export function showLeaveGuardState(target, summary) {
  return {
    pendingNavigation: target || null,
    isVisible: true,
    message: `Neulozené zmeny: ${summary}. Ulozit zmeny, nebo odejit bez ulozeni?`
  };
}

export function shouldPromptForLeave(hasUnsavedChanges) {
  return Boolean(hasUnsavedChanges);
}
