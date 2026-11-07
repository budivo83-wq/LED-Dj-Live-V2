export const SHELL_DEFAULT_VIEW = "index.html";
export const SHELL_VIEW_KEY = "led-shell-view-v1";
export const SHELL_VIEWS = Object.freeze([
  "index.html",
  "animations.html",
  "generator.html",
  "mapping.html",
  "settings.html",
  "shorts.html",
  "shadertoy.html",
  "live-input.html"
]);

export function createShellNavigationScheduler(deps) {
  const {
    uiFrame,
    locationRef = globalThis.location,
    storage = globalThis.localStorage,
    timer = globalThis,
    defaultView = SHELL_DEFAULT_VIEW,
    viewKey = SHELL_VIEW_KEY,
    navDelayMs = 48,
    onNavigate = () => {}
  } = deps || {};

  let pendingNavView = "";

  function navigateToView(rawView) {
    const nextView = normalizeView(extractViewName(rawView), defaultView);
    if (!nextView) return false;
    const current = currentUiView(uiFrame, defaultView);
    if (current === nextView) return true;

    pendingNavView = nextView;
    const startedAt = performance.now();
    saveView(nextView, storage, viewKey);
    onNavigate({ current, nextView, startedAt });

    timer.setTimeout(() => {
      if (pendingNavView !== nextView) return;
      uiFrame.src = withShellView(nextView);
    }, navDelayMs);
    return true;
  }

  function installChildNavigationGuard() {
    let childDocument = null;
    try {
      childDocument = uiFrame.contentWindow?.document;
    } catch {
      return;
    }
    if (!childDocument || childDocument.__ledShellNavigationGuardInstalled) return;
    childDocument.__ledShellNavigationGuardInstalled = true;

    childDocument.addEventListener("click", (event) => {
      const target = event.target?.closest?.("button,a");
      const navValue = readNavigationTarget(target);
      if (!navValue) return;
      const nextView = normalizeView(extractViewName(navValue, locationRef), defaultView);
      if (!nextView || nextView === currentUiView(uiFrame, defaultView)) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      navigateToView(nextView);
    }, true);
  }

  return {
    navigateToView,
    installChildNavigationGuard,
    currentUiView: () => currentUiView(uiFrame, defaultView),
    extractViewName: (value) => extractViewName(value, locationRef),
    isView,
    normalizeView: (value) => normalizeView(value, defaultView),
    saveView: (value) => saveView(value, storage, viewKey),
    restoreView: () => restoreView(storage, viewKey),
    withShellView
  };
}

export function currentUiView(uiFrame, defaultView = SHELL_DEFAULT_VIEW) {
  try {
    return normalizeView(uiFrame.contentWindow?.location?.pathname?.split("/").pop() || "", defaultView);
  } catch {
    return "";
  }
}

export function extractViewName(value, locationRef = globalThis.location) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw, locationRef.href);
    return url.pathname.split("/").pop() || SHELL_DEFAULT_VIEW;
  } catch {
    return raw.split("?")[0].split("#")[0].split("/").pop();
  }
}

export function readNavigationTarget(target) {
  if (!target) return "";
  const explicit = target.dataset?.shellNav || target.dataset?.navHref || target.dataset?.nav || target.dataset?.href || "";
  if (explicit) return explicit;
  const href = target.getAttribute?.("href");
  if (href && isView(extractViewName(href))) return href;
  const onclick = target.getAttribute?.("onclick") || "";
  const match = onclick.match(/location\.href\s*=\s*['"]([^'"]+)['"]/);
  return match ? match[1] : "";
}

export function isView(value) {
  return SHELL_VIEWS.includes(value);
}

export function normalizeView(value, defaultView = SHELL_DEFAULT_VIEW) {
  const candidate = String(value || "").trim().toLowerCase();
  return isView(candidate) ? candidate : defaultView;
}

export function saveView(value, storage = globalThis.localStorage, viewKey = SHELL_VIEW_KEY) {
  try {
    storage.setItem(viewKey, value);
  } catch {
    // ignore storage failures
  }
}

export function restoreView(storage = globalThis.localStorage, viewKey = SHELL_VIEW_KEY) {
  try {
    return storage.getItem(viewKey) || "";
  } catch {
    return "";
  }
}

export function withShellView(view) {
  return `${view}${view.includes("?") ? "&" : "?"}shellView=1`;
}
