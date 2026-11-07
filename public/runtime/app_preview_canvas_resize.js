export function createAppPreviewCanvasResize({
  canvas,
  previewRenderer,
  shaderPreviewCanvas,
  shaderPreviewRenderer,
  previewBox,
  getDimensions,
  getCellSize,
  getDevicePixelRatio = () => window.devicePixelRatio || 1
}) {
  // STEP37AU: preview resize governor.
  // A tab switch / fullscreen / settings panel change can call resizePreviewCanvas()
  // several times in one paint. The shader branch uses getBoundingClientRect() and
  // WebGL resize(), so during physical output we coalesce it and skip identical sizes.
  // This keeps UI navigation from stealing time from the ArtNet/Serial frame path.
  const stats = {
    version: "STEP37AU_PREVIEW_RESIZE_GOVERNOR",
    callsPreview: 0,
    callsShader: 0,
    appliedPreview: 0,
    appliedShader: 0,
    skippedPreview: 0,
    skippedShader: 0,
    coalescedShader: 0,
    pendingShader: false,
    lastPreviewMs: 0,
    lastShaderMs: 0,
    lastShaderDelayMs: 0,
    lastShaderAt: 0,
    lastReason: "init",
    skippedInactivePreview: 0,
    skippedInactiveShader: 0
  };
  try { window.__budilightPreviewResizeGovernor37AU = stats; } catch {}

  let lastPreviewWidth = 0;
  let lastPreviewHeight = 0;
  let lastPreviewMatrixWidth = 0;
  let lastPreviewMatrixHeight = 0;
  let lastShaderWidth = 0;
  let lastShaderHeight = 0;
  let shaderResizeTimer = 0;
  let shaderResizeRaf = 0;
  let shaderResizeRequestedAt = 0;
  let shaderResizeReason = "init";
  let pendingPreviewBecauseInactive = false;
  let pendingShaderBecauseInactive = false;

  const shellViewOnly37BT = (() => {
    try { return new URLSearchParams(window.location?.search || "").get("shellView") === "1"; }
    catch { return false; }
  })();

  function isShellViewActive37BT() {
    try {
      const activity = window.__ledShellViewActivity;
      return !shellViewOnly37BT || activity?.active !== false;
    } catch {
      return true;
    }
  }

  try {
    window.addEventListener?.("message", (event) => {
      const data = event?.data;
      if (!data || data.type !== "led-shell-view-active") return;
      if (data.active !== false) {
        if (pendingPreviewBecauseInactive) {
          pendingPreviewBecauseInactive = false;
          try { resizePreviewCanvas(); } catch {}
        }
        if (pendingShaderBecauseInactive) {
          pendingShaderBecauseInactive = false;
          try { scheduleShaderResize("reactivate-pending"); } catch {}
        }
      }
    });
  } catch {}

  function nowMs() {
    try { return performance.now(); } catch { return Date.now(); }
  }

  function isLiveOutputActive() {
    try {
      const lock = window.__budilightOutputLock37AP;
      if (lock?.active === true) return true;
    } catch {}
    try {
      const mirror = window.__budilightArtNetMasterMirror22EJ;
      if (mirror?.enabled === true || Number(mirror?.actualFps || 0) > 0) return true;
    } catch {}
    try {
      const serial = window.__budilightLiveSerialMirror22CR;
      if (serial?.enabled === true || Number(serial?.actualFps || 0) > 0) return true;
    } catch {}
    return false;
  }

  function publishStats(reason) {
    stats.pendingShader = Boolean(shaderResizeTimer || shaderResizeRaf);
    stats.lastReason = reason || stats.lastReason;
    try { window.__budilightPreviewResizeGovernor37AU = stats; } catch {}
  }

  function measureShaderTarget() {
    const rect = previewBox?.getBoundingClientRect?.();
    const dpr = Math.max(1, getDevicePixelRatio() || 1);
    const { width: matrixWidth, height: matrixHeight } = getDimensions();
    const cellSize = getCellSize();
    const cssWidth = Math.max(
      1,
      Math.round(rect?.width || shaderPreviewCanvas?.clientWidth || previewBox?.clientWidth || matrixWidth * cellSize)
    );
    const cssHeight = Math.max(
      1,
      Math.round(rect?.height || shaderPreviewCanvas?.clientHeight || previewBox?.clientHeight || matrixHeight * cellSize)
    );
    return {
      width: Math.max(1, Math.round(cssWidth * dpr)),
      height: Math.max(1, Math.round(cssHeight * dpr))
    };
  }

  function applyShaderPreviewCanvasResize(reason = "direct") {
    const t0 = nowMs();
    if (!shaderPreviewCanvas || !shaderPreviewRenderer) {
      publishStats(reason);
      return;
    }
    const { width, height } = measureShaderTarget();
    if (width === lastShaderWidth && height === lastShaderHeight && shaderPreviewCanvas.width === width && shaderPreviewCanvas.height === height) {
      stats.skippedShader += 1;
      stats.lastShaderMs = Math.round((nowMs() - t0) * 10) / 10;
      publishStats(reason + ":same-size");
      return;
    }
    if (shaderPreviewCanvas.width !== width) shaderPreviewCanvas.width = width;
    if (shaderPreviewCanvas.height !== height) shaderPreviewCanvas.height = height;
    shaderPreviewRenderer.resize(width, height);
    lastShaderWidth = width;
    lastShaderHeight = height;
    stats.appliedShader += 1;
    stats.lastShaderAt = nowMs();
    stats.lastShaderMs = Math.round((stats.lastShaderAt - t0) * 10) / 10;
    stats.lastShaderDelayMs = Math.round(Math.max(0, t0 - shaderResizeRequestedAt) * 10) / 10;
    publishStats(reason);
  }

  function scheduleShaderResize(reason = "scheduled") {
    stats.callsShader += 1;
    if (!isShellViewActive37BT()) {
      pendingShaderBecauseInactive = true;
      stats.skippedInactiveShader += 1;
      publishStats(reason + ":inactive");
      return;
    }
    shaderResizeReason = reason;
    shaderResizeRequestedAt = shaderResizeRequestedAt || nowMs();
    const live = isLiveOutputActive();
    const minGapMs = live ? 120 : 32;
    const elapsed = nowMs() - Number(stats.lastShaderAt || 0);

    if (!live && elapsed >= minGapMs && !shaderResizeTimer && !shaderResizeRaf) {
      applyShaderPreviewCanvasResize(reason + ":direct-idle");
      shaderResizeRequestedAt = 0;
      return;
    }

    if (shaderResizeTimer || shaderResizeRaf) {
      stats.coalescedShader += 1;
      publishStats(reason + ":coalesced");
      return;
    }

    const wait = Math.max(0, minGapMs - elapsed);
    const run = () => {
      shaderResizeTimer = 0;
      shaderResizeRaf = requestAnimationFrame(() => {
        shaderResizeRaf = 0;
        applyShaderPreviewCanvasResize(shaderResizeReason);
        shaderResizeRequestedAt = 0;
      });
      publishStats(reason + ":raf");
    };
    if (wait > 0) shaderResizeTimer = window.setTimeout(run, wait);
    else run();
    publishStats(reason + ":scheduled");
  }

  function resizeShaderPreviewCanvas() {
    scheduleShaderResize("shader-request");
  }

  function resizePreviewCanvas() {
    const t0 = nowMs();
    stats.callsPreview += 1;
    if (!isShellViewActive37BT()) {
      pendingPreviewBecauseInactive = true;
      pendingShaderBecauseInactive = true;
      stats.skippedInactivePreview += 1;
      stats.lastPreviewMs = Math.round((nowMs() - t0) * 10) / 10;
      publishStats("preview-inactive");
      return;
    }
    const { width: matrixWidth, height: matrixHeight } = getDimensions();
    const cellSize = getCellSize();
    const width = Math.max(1, matrixWidth * cellSize);
    const height = Math.max(1, matrixHeight * cellSize);
    const samePreview = width === lastPreviewWidth
      && height === lastPreviewHeight
      && matrixWidth === lastPreviewMatrixWidth
      && matrixHeight === lastPreviewMatrixHeight
      && canvas.width === width
      && canvas.height === height;
    if (samePreview) {
      stats.skippedPreview += 1;
    } else {
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;
      previewRenderer.resize(width, height, matrixWidth, matrixHeight);
      lastPreviewWidth = width;
      lastPreviewHeight = height;
      lastPreviewMatrixWidth = matrixWidth;
      lastPreviewMatrixHeight = matrixHeight;
      stats.appliedPreview += 1;
    }
    stats.lastPreviewMs = Math.round((nowMs() - t0) * 10) / 10;
    // Shader resize is the expensive layout/WebGL part; coalesce it especially
    // while output lock is active. Initial render still applies quickly because
    // lastShaderAt is 0 and no live lock exists during boot.
    scheduleShaderResize(samePreview ? "preview-same" : "preview-size-change");
    publishStats(samePreview ? "preview-same" : "preview-size-change");
  }

  return {
    resizePreviewCanvas,
    resizeShaderPreviewCanvas
  };
}
