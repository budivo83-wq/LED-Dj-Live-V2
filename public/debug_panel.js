// STEP37CD: legacy Debug panel disabled.
// The old debug panel wrote dozens of DOM fields/graphs and could keep querying serial/debug state.
// Debug now belongs to Output Health only (runtime/output_health_panel_37cd.js).
let lastPublishAt37CD = 0;

function isDebugPreviewActive37CD() {
  try {
    const btn = document.getElementById('previewTabDebug');
    if (btn?.classList?.contains('active')) return true;
    if (document.body?.dataset?.previewMode === 'debug') return true;
  } catch {}
  return false;
}

function publishLegacyDisabled37CD(extra = {}) {
  const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  if (now - lastPublishAt37CD < 1500) return;
  lastPublishAt37CD = now;
  try {
    window.__budilightDebugPanel37CD = {
      version: 'STEP37CD_DEBUG_HEALTH_DIAG_ACTIONS',
      legacyPanelDisabled: true,
      active: isDebugPreviewActive37CD(),
      updatedAt: Date.now(),
      ...extra
    };
  } catch {}
}

export function syncDebugPanelRuntime(_deps, detail) {
  // Keep the public app.js call contract intact, but do not render old cards/graphs.
  // This function intentionally does not call serialOutput.getDebugInfo(), does not draw SVG graphs,
  // and does not touch removed dbg* DOM nodes.
  publishLegacyDisabled37CD({
    skippedLegacyRender: true,
    reason: isDebugPreviewActive37CD() ? 'debug-health-panel-active' : 'debug-tab-inactive',
    timestamp: detail?.timestamp || Date.now()
  });
}
