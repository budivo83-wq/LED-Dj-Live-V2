export function bindKeyboardInput(deps) {
  const { documentRef, windowRef, onKeyDown, onKeyUp, onBlur } = deps;
  documentRef.addEventListener("keydown", onKeyDown);
  documentRef.addEventListener("keyup", onKeyUp);
  windowRef.addEventListener("blur", onBlur);
}

export function bindViewportLifecycle(deps) {
  const {
    windowRef,
    documentRef,
    onResize,
    onOrientationChange,
    onVisibilityHidden,
    onVisibilityVisible
  } = deps;

  // STEP37BT: layout/resize governor for shell cached iframes.
  // Browser resize/fullscreen/orientation changes can fire in every cached page,
  // even when only one iframe is visible. Running preview canvas resize + layout
  // measurement in hidden pages causes small but visible navigation/output hitches.
  // Here we coalesce viewport work, skip hidden shell views, and run one pending
  // resize when the page becomes active again.
  const viewportDiag37BT = windowRef.__budilightViewportGovernor37BT = windowRef.__budilightViewportGovernor37BT || {
    version: "STEP37BT_VIEWPORT_RESIZE_GOVERNOR",
    resizeEvents: 0,
    orientationEvents: 0,
    applied: 0,
    coalesced: 0,
    skippedInactive: 0,
    pendingInactive: false,
    lastReason: "init",
    lastDelayMs: 0,
    lastAppliedAt: 0
  };

  const shellViewOnly = (() => {
    try { return new URLSearchParams(windowRef.location?.search || "").get("shellView") === "1"; }
    catch { return false; }
  })();

  function isShellViewActive37BT() {
    try {
      const activity = windowRef.__ledShellViewActivity;
      return !shellViewOnly || activity?.active !== false;
    } catch {
      return true;
    }
  }

  let viewportTimer37BT = 0;
  let viewportRaf37BT = 0;

  function applyViewport37BT(kind, fn) {
    viewportTimer37BT = 0;
    if (viewportRaf37BT) return;
    const raf = windowRef.requestAnimationFrame || ((cb) => windowRef.setTimeout(() => cb(Date.now()), 16));
    viewportRaf37BT = raf(() => {
      viewportRaf37BT = 0;
      if (!isShellViewActive37BT()) {
        viewportDiag37BT.skippedInactive += 1;
        viewportDiag37BT.pendingInactive = true;
        viewportDiag37BT.lastReason = `${kind}:inactive`;
        return;
      }
      try { fn(); } catch {}
      viewportDiag37BT.applied += 1;
      viewportDiag37BT.pendingInactive = false;
      viewportDiag37BT.lastReason = kind;
      try { viewportDiag37BT.lastAppliedAt = performance.now(); } catch { viewportDiag37BT.lastAppliedAt = Date.now(); }
    });
  }

  function scheduleViewport37BT(kind, fn) {
    if (kind === "orientation") viewportDiag37BT.orientationEvents += 1;
    else viewportDiag37BT.resizeEvents += 1;

    if (!isShellViewActive37BT()) {
      viewportDiag37BT.skippedInactive += 1;
      viewportDiag37BT.pendingInactive = true;
      viewportDiag37BT.lastReason = `${kind}:inactive`;
      return;
    }

    const live = (() => {
      try { return windowRef.__budilightOutputLock37AP?.active === true; } catch { return false; }
    })();
    const delay = live ? 120 : 32;
    viewportDiag37BT.lastDelayMs = delay;
    if (viewportTimer37BT || viewportRaf37BT) viewportDiag37BT.coalesced += 1;
    windowRef.clearTimeout(viewportTimer37BT);
    viewportTimer37BT = windowRef.setTimeout(() => applyViewport37BT(kind, fn), delay);
  }

  windowRef.addEventListener("resize", () => scheduleViewport37BT("resize", onResize), { passive: true });
  windowRef.addEventListener("orientationchange", () => scheduleViewport37BT("orientation", onOrientationChange), { passive: true });

  windowRef.addEventListener?.("message", (event) => {
    const data = event?.data;
    if (!data || data.type !== "led-shell-view-active") return;
    if (data.active !== false && viewportDiag37BT.pendingInactive) {
      scheduleViewport37BT("reactivate-pending", onResize);
    }
  });

  documentRef.addEventListener("visibilitychange", () => {
    if (documentRef.hidden) {
      onVisibilityHidden();
      return;
    }
    onVisibilityVisible();
    if (viewportDiag37BT.pendingInactive) scheduleViewport37BT("visibility-pending", onResize);
  });
}
