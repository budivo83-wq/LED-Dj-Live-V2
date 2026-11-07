export function createLivePanelBootstrapController({
  fetchRef,
  refs,
  setText,
  renderLivePanel,
  renderFullTokenSummary,
  renderPreflightSummary,
  renderHardwareTestOutputSummary,
  renderOutputSmokeSummary,
  summarizeActionableStatus,
  version,
  getBootstrapContext,
  updateBootstrapState
} = {}) {
  async function refreshLiveState() {
    try {
      const data = await fetchRef("/api/live/state");
      const parsed = await data.json();
      const latestLive = parsed.live || null;
      updateBootstrapState({ latestLive });
      renderLivePanel(refs, latestLive, version);
      try {
        const readyResponse = await fetchRef("/api/live/readiness");
        if (readyResponse.ok) {
          const ready = await readyResponse.json();
          const summary = ready.readiness || {};
          updateBootstrapState({
            latestReadiness: summary,
            latestHardwareTestOutput: null,
            latestOutputSmokeTest: null
          });
          setText(refs.liveReadinessStatus, `${String(summary.status || "SAFE_BLOCKED").toUpperCase()} | ${String(summary.decision || "LIVE_PHYSICAL_WRITE_BLOCKED")} | ${(summary.blockers || []).slice(0, 4).join(",") || "-"}`);
          renderFullTokenSummary(refs, summary.tokenGate || null, "INACTIVE");
          renderPreflightSummary(refs, null, `PREFLIGHT IDLE | token ${(summary.tokenGate?.tokenDigest || "none")} | boundary ${summary.boundary?.decision || "n/a"}`);
          renderHardwareTestOutputSummary(refs, null, "HW TEST IDLE | no write prepared");
          renderOutputSmokeSummary(refs, null, "SMOKE IDLE | serial/artnet dry-run");
          const context = getBootstrapContext();
          summarizeActionableStatus(refs, {
            live: context.latestLive,
            readiness: context.latestReadiness,
            sync: context.latestSync,
            hardwareTestOutput: context.latestHardwareTestOutput || context.latestOutputSmokeTest,
            audit: context.latestAudit
          });
        }
      } catch {
        updateBootstrapState({
          latestReadiness: null,
          latestHardwareTestOutput: null
        });
        setText(refs.liveReadinessStatus, "READINESS UNAVAILABLE");
        renderFullTokenSummary(refs, null, "TOKEN UNAVAILABLE");
        renderPreflightSummary(refs, null, "PREFLIGHT UNAVAILABLE");
        renderHardwareTestOutputSummary(refs, null, "HW TEST UNAVAILABLE");
        const context = getBootstrapContext();
        summarizeActionableStatus(refs, {
          live: context.latestLive,
          readiness: context.latestReadiness,
          sync: context.latestSync,
          hardwareTestOutput: context.latestHardwareTestOutput,
          audit: context.latestAudit,
          error: "READINESS_UNAVAILABLE"
        });
      }
      return parsed.live;
    } catch (error) {
      updateBootstrapState({ latestLive: null });
      const context = getBootstrapContext();
      renderLivePanel(refs, null, `state unavailable: ${error?.message || error}`);
      summarizeActionableStatus(refs, {
        live: null,
        readiness: context.latestReadiness,
        sync: context.latestSync,
        hardwareTestOutput: context.latestHardwareTestOutput,
        audit: context.latestAudit,
        error: "LIVE_STATE_UNAVAILABLE"
      });
      return null;
    }
  }

  return Object.freeze({
    refreshLiveState
  });
}
