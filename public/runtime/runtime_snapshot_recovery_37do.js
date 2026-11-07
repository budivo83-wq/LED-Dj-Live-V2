/* STEP37DP: recovery provider disabled.
   The 37DO emergency snapshot provider was too expensive and still did not fix the panel
   because the real issue was a syntax error in output_health_panel_37cd.js.
   Keep a tiny no-op marker only; do not run timers or clone snapshots. */
(function(){
  try { window.__budilightRuntimeSnapshotRecovery37DO = { version:'STEP37DP_DISABLED_NO_TIMERS', disabled:true, updatedAt:Date.now() }; } catch {}
})();
