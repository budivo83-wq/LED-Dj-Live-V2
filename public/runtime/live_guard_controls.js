export function createLiveGuardControlsController({
  fetchRef,
  postJson,
  refs,
  storage,
  controlledArmIntent,
  storeIntent,
  clearIntent,
  renderLivePanel,
  renderPreflightSummary,
  renderFullTokenSummary,
  renderHardwareTestOutputSummary,
  renderAuditSummary,
  summarizeActionableStatus,
  buildPreflightProbeRequest,
  buildHardwareTestOutputRequest,
  getGuardContext,
  updateGuardState
} = {}) {
  async function refreshAudit() {
    const context = getGuardContext();
    try {
      const auditResponse = await fetchRef("/api/live/audit?limit=8");
      if (!auditResponse.ok) throw new Error(`/api/live/audit ${auditResponse.status}`);
      const auditData = await auditResponse.json();
      const latestAudit = auditData.audit || null;
      updateGuardState({ latestAudit });
      renderAuditSummary(refs, latestAudit, "AUDIT EMPTY");
      summarizeActionableStatus(refs, {
        live: context.latestLive,
        readiness: context.latestReadiness,
        sync: context.latestSync,
        hardwareTestOutput: context.latestHardwareTestOutput || context.latestOutputSmokeTest,
        audit: latestAudit
      });
      return latestAudit;
    } catch (error) {
      updateGuardState({ latestAudit: null });
      renderAuditSummary(refs, null, `AUDIT UNAVAILABLE: ${error?.message || error}`);
      summarizeActionableStatus(refs, {
        live: context.latestLive,
        readiness: context.latestReadiness,
        sync: context.latestSync,
        hardwareTestOutput: context.latestHardwareTestOutput,
        audit: null
      });
      return null;
    }
  }

  function bind() {
    refs.liveArmButton?.addEventListener?.("click", async () => {
      if (!refs.liveArmConfirm?.checked) {
        renderLivePanel(refs, null, "ARM DRY requires confirmation checkbox");
        return;
      }
      const intent = controlledArmIntent("live-ops-ui-12N");
      storeIntent(storage, intent);
      try {
        const data = await postJson(fetchRef, "/api/live/intent", intent);
        renderLivePanel(refs, data.live, "dry arm intent recorded; physical write remains blocked");
      } catch (error) {
        renderLivePanel(refs, null, `arm intent failed: ${error?.message || error}`);
      }
    });

    refs.liveDisarmButton?.addEventListener?.("click", async () => {
      clearIntent(storage);
      refs.liveArmConfirm && (refs.liveArmConfirm.checked = false);
      try {
        const data = await postJson(fetchRef, "/api/live/disarm", { reason: "operator_disarm_12N" });
        renderLivePanel(refs, data.live, "disarmed; local controlled-arm intent cleared");
      } catch (error) {
        renderLivePanel(refs, null, `disarm failed: ${error?.message || error}`);
      }
    });

    refs.liveStopButton?.addEventListener?.("click", async () => {
      clearIntent(storage);
      refs.liveArmConfirm && (refs.liveArmConfirm.checked = false);
      try {
        const data = await postJson(fetchRef, "/api/live/stop", { reason: "operator_emergency_stop_12N" });
        const stop = data.interlock?.status ? ` | interlock ${data.interlock.status}` : "";
        renderLivePanel(refs, data.live, `emergency stop latched; all live writes blocked${stop}`);
      } catch (error) {
        renderLivePanel(refs, null, `emergency stop failed: ${error?.message || error}`);
      }
    });

    refs.liveStopClearButton?.addEventListener?.("click", async () => {
      try {
        const data = await postJson(fetchRef, "/api/live/stop/clear", { reason: "operator_clear_emergency_stop_12N_ui" });
        const clear = data.interlock?.status ? ` | interlock ${data.interlock.status}` : "";
        renderLivePanel(refs, data.live, `emergency stop cleared; live remains guarded${clear}`);
      } catch (error) {
        renderLivePanel(refs, null, `clear emergency stop failed: ${error?.message || error}`);
      }
    });

    refs.livePhysicalPreflightButton?.addEventListener?.("click", async () => {
      const context = getGuardContext();
      const request = buildPreflightProbeRequest(context.latestReadiness, context.latestIssuedToken);
      try {
        const data = await postJson(fetchRef, "/api/live/physical-release/preflight", request);
        renderPreflightSummary(refs, data.preflight || null, "PREFLIGHT RESPONSE EMPTY");
      } catch (error) {
        renderPreflightSummary(refs, null, `PREFLIGHT FAILED: ${error?.message || error}`);
      }
    });

    refs.liveHardwareTestOutputButton?.addEventListener?.("click", async () => {
      const context = getGuardContext();
      const request = buildHardwareTestOutputRequest(context.latestReadiness, context.latestIssuedToken);
      try {
        const data = await postJson(fetchRef, "/api/live/hardware-test/output", request);
        const latestHardwareTestOutput = data.hardwareTestOutput || null;
        updateGuardState({ latestHardwareTestOutput });
        renderHardwareTestOutputSummary(refs, latestHardwareTestOutput, "HW TEST RESPONSE EMPTY");
        summarizeActionableStatus(refs, {
          live: context.latestLive,
          readiness: context.latestReadiness,
          sync: context.latestSync,
          hardwareTestOutput: latestHardwareTestOutput || context.latestOutputSmokeTest,
          audit: context.latestAudit
        });
      } catch (error) {
        updateGuardState({ latestHardwareTestOutput: null });
        renderHardwareTestOutputSummary(refs, null, `HW TEST FAILED: ${error?.message || error}`);
        summarizeActionableStatus(refs, {
          live: context.latestLive,
          readiness: context.latestReadiness,
          sync: context.latestSync,
          hardwareTestOutput: null,
          audit: context.latestAudit,
          error: "HW_TEST_FAILED"
        });
      }
    });

    refs.liveFullTokenIssueButton?.addEventListener?.("click", async () => {
      const context = getGuardContext();
      const preflightContext = buildPreflightProbeRequest(context.latestReadiness);
      const request = {
        mappingDigest: preflightContext.mappingDigest,
        transportPlanDigest: preflightContext.transportPlanDigest,
        outputMode: preflightContext.outputMode,
        operatorConfirmed: true,
        confirmation: "CONFIRM_FULL_LIVE_ENABLE"
      };
      try {
        const data = await postJson(fetchRef, "/api/live/full-token/issue", request);
        updateGuardState({ latestIssuedToken: String(data.tokenGate?.token || "") });
        renderFullTokenSummary(refs, data.tokenGate || null, "TOKEN ISSUE EMPTY");
      } catch (error) {
        renderFullTokenSummary(refs, null, `TOKEN ISSUE FAILED: ${error?.message || error}`);
      }
    });

    refs.liveFullTokenValidateButton?.addEventListener?.("click", async () => {
      const context = getGuardContext();
      const preflightContext = buildPreflightProbeRequest(context.latestReadiness);
      const request = {
        token: context.latestIssuedToken,
        mappingDigest: preflightContext.mappingDigest,
        transportPlanDigest: preflightContext.transportPlanDigest,
        outputMode: preflightContext.outputMode,
        operatorConfirmed: true,
        confirmation: "CONFIRM_FULL_LIVE_ENABLE"
      };
      try {
        const data = await postJson(fetchRef, "/api/live/full-token/validate", request);
        renderFullTokenSummary(refs, data.tokenGate || null, "TOKEN VALIDATE EMPTY");
      } catch (error) {
        renderFullTokenSummary(refs, null, `TOKEN VALIDATE FAILED: ${error?.message || error}`);
      }
    });

    refs.liveFullTokenRevokeButton?.addEventListener?.("click", async () => {
      updateGuardState({ latestIssuedToken: "" });
      try {
        const data = await postJson(fetchRef, "/api/live/full-token/revoke", { reason: "operator_revoke_12N_ui" });
        renderFullTokenSummary(refs, data.tokenGate || null, "TOKEN REVOKE EMPTY");
      } catch (error) {
        renderFullTokenSummary(refs, null, `TOKEN REVOKE FAILED: ${error?.message || error}`);
      }
    });

    refs.liveAuditRefreshButton?.addEventListener?.("click", async () => {
      await refreshAudit();
    });

    refs.liveAuditClearButton?.addEventListener?.("click", async () => {
      try {
        const data = await postJson(fetchRef, "/api/live/audit/clear", { reason: "operator_clear_audit_12N_ui" });
        renderAuditSummary(refs, { entries: [data.auditEntry].filter(Boolean), count: 0 }, "AUDIT CLEARED");
      } catch (error) {
        renderAuditSummary(refs, null, `AUDIT CLEAR FAILED: ${error?.message || error}`);
      }
    });
  }

  return Object.freeze({
    bind,
    refreshAudit
  });
}
