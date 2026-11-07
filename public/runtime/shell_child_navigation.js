export function isShellView(locationRef = globalThis.location, parentRef = globalThis.parent, windowRef = globalThis.window) {
  try {
    const params = new URLSearchParams(locationRef?.search || "");
    if (params.get("shellView") === "1") return true;
  } catch {
    // ignore URL parsing failures
  }
  return Boolean(parentRef && windowRef && parentRef !== windowRef);
}

export function requestShellNavigation(href, options = {}) {
  const target = String(href || "").trim();
  if (!target) return false;
  const {
    locationRef = globalThis.location,
    parentRef = globalThis.parent,
    windowRef = globalThis.window,
    sessionStorageRef = globalThis.sessionStorage,
    mainReturnFastKey = "led-main-return-fast",
    mainReturnFast = false
  } = options;

  if (mainReturnFast || target === "index.html") {
    try { sessionStorageRef?.setItem?.(mainReturnFastKey, "1"); } catch { /* ignore */ }
  }

  if (isShellView(locationRef, parentRef, windowRef)) {
    try {
      parentRef?.postMessage?.({ type: "led-shell-navigate", href: target, view: target }, "*");
      return true;
    } catch {
      // fallback below
    }
  }

  try {
    locationRef.href = target;
    return true;
  } catch {
    return false;
  }
}

export function bindShellNavigationButtons(root = globalThis.document) {
  root?.querySelectorAll?.("[data-href],[data-nav-href],[data-nav],[data-shell-nav]").forEach((button) => {
    if (button.dataset?.shellNavBound === "1") return;
    if (button.dataset) button.dataset.shellNavBound = "1";
    button.addEventListener("click", (event) => {
      const href = button.dataset?.shellNav || button.dataset?.navHref || button.dataset?.nav || button.dataset?.href || button.getAttribute?.("href") || "";
      if (!href) return;
      event.preventDefault();
      event.stopPropagation();
      requestShellNavigation(href, { mainReturnFast: button.dataset?.mainReturnFast === "1" || button.dataset?.mainReturnFast === "true" });
    });
  });
}
