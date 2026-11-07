export function createLivePanelDiagnosticsController({
  fetchRef,
  refs,
  renderSyncSummary,
  renderSerialDiagnosticsSummary,
  renderArtnetDiagnosticsSummary,
  summarizeActionableStatus,
  getDiagnosticsContext,
  updateDiagnosticsState
} = {}) {
  async function refreshSync() {
    const context = getDiagnosticsContext();
    try {
      const syncResponse = await fetchRef("/api/live/sync");
      if (!syncResponse.ok) throw new Error(`/api/live/sync ${syncResponse.status}`);
      const syncData = await syncResponse.json();
      const latestSync = syncData.sync || null;
      updateDiagnosticsState({ latestSync });
      renderSyncSummary(refs, latestSync, "SYNC EMPTY");
      summarizeActionableStatus(refs, {
        live: context.latestLive,
        readiness: context.latestReadiness,
        sync: latestSync,
        hardwareTestOutput: context.latestHardwareTestOutput || context.latestOutputSmokeTest,
        audit: context.latestAudit
      });
      return latestSync;
    } catch (error) {
      updateDiagnosticsState({ latestSync: null });
      renderSyncSummary(refs, null, `SYNC UNAVAILABLE: ${error?.message || error}`);
      summarizeActionableStatus(refs, {
        live: context.latestLive,
        readiness: context.latestReadiness,
        sync: null,
        hardwareTestOutput: context.latestHardwareTestOutput,
        audit: context.latestAudit,
        error: "SYNC_UNAVAILABLE"
      });
      return null;
    }
  }

  async function refreshSerialDiagnostics() {
    try {
      const response = await fetchRef("/api/live/output/serial-diagnostics");
      if (!response.ok) throw new Error(`/api/live/output/serial-diagnostics ${response.status}`);
      const data = await response.json();
      const latestSerialDiagnostics = data.serialDiagnostics || null;
      updateDiagnosticsState({ latestSerialDiagnostics });
      renderSerialDiagnosticsSummary(refs, latestSerialDiagnostics, "SERIAL DIAG EMPTY");
      return latestSerialDiagnostics;
    } catch (error) {
      updateDiagnosticsState({ latestSerialDiagnostics: null });
      renderSerialDiagnosticsSummary(refs, null, `SERIAL DIAG UNAVAILABLE: ${error?.message || error}`);
      return null;
    }
  }

  async function refreshArtnetDiagnostics() {
    try {
      const response = await fetchRef("/api/live/output/artnet-diagnostics");
      if (!response.ok) throw new Error(`/api/live/output/artnet-diagnostics ${response.status}`);
      const data = await response.json();
      const latestArtnetDiagnostics = data.artnetDiagnostics || null;
      updateDiagnosticsState({ latestArtnetDiagnostics });
      renderArtnetDiagnosticsSummary(refs, latestArtnetDiagnostics, "ARTNET DIAG EMPTY");
      return latestArtnetDiagnostics;
    } catch (error) {
      updateDiagnosticsState({ latestArtnetDiagnostics: null });
      renderArtnetDiagnosticsSummary(refs, null, `ARTNET DIAG UNAVAILABLE: ${error?.message || error}`);
      return null;
    }
  }

  function bind() {
    refs.liveSerialDiagnosticsButton?.addEventListener?.("click", async () => {
      await refreshSerialDiagnostics();
    });

    refs.liveArtnetDiagnosticsButton?.addEventListener?.("click", async () => {
      await refreshArtnetDiagnostics();
    });
  }

  return Object.freeze({
    bind,
    refreshSync,
    refreshSerialDiagnostics,
    refreshArtnetDiagnostics
  });
}
