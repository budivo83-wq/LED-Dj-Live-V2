export function createLiveOutputWorkflowController({
  fetchRef,
  postJson,
  refs,
  renderOutputSendHistorySummary,
  renderOutputVerificationSummary,
  renderOutputStreamTelemetrySummary,
  renderOutputReliabilityGateSummary,
  renderOutputPhysicalArmSummary,
  renderOutputSmokeSummary,
  renderOutputTargetSummary,
  renderOutputTestRunSummary,
  renderOutputMinimalFrameSummary,
  renderOutputMultiFrameStreamSummary,
  buildOutputSmokeRequest,
  buildOutputTargetRequest,
  buildOutputTestRunRequest,
  buildOutputMinimalFrameRequest,
  buildOutputMultiFrameStreamRequest,
  buildOutputStreamTelemetryRequest,
  summarizeActionableStatus,
  getWorkflowContext,
  updateWorkflowState
} = {}) {
  async function refreshOutputSendHistory() {
    try {
      const response = await fetchRef("/api/live/output/send-history");
      if (!response.ok) throw new Error(`/api/live/output/send-history ${response.status}`);
      const data = await response.json();
      const latestOutputSendHistory = data.outputSendHistory || null;
      updateWorkflowState({ latestOutputSendHistory });
      renderOutputSendHistorySummary(refs, latestOutputSendHistory, "SEND HISTORY EMPTY");
      return latestOutputSendHistory;
    } catch (error) {
      updateWorkflowState({ latestOutputSendHistory: null });
      renderOutputSendHistorySummary(refs, null, `SEND HISTORY UNAVAILABLE: ${error?.message || error}`);
      return null;
    }
  }

  async function refreshOutputVerification() {
    try {
      const response = await fetchRef("/api/live/output/verification");
      if (!response.ok) throw new Error(`/api/live/output/verification ${response.status}`);
      const data = await response.json();
      const latestOutputVerification = data.outputVerification || null;
      updateWorkflowState({ latestOutputVerification });
      renderOutputVerificationSummary(refs, latestOutputVerification, "VERIFY EMPTY");
      return latestOutputVerification;
    } catch (error) {
      updateWorkflowState({ latestOutputVerification: null });
      renderOutputVerificationSummary(refs, null, `VERIFY UNAVAILABLE: ${error?.message || error}`);
      return null;
    }
  }

  async function refreshOutputStreamTelemetry() {
    try {
      const response = await fetchRef("/api/live/output/stream-telemetry");
      if (!response.ok) throw new Error(`/api/live/output/stream-telemetry ${response.status}`);
      const data = await response.json();
      const latestOutputStreamTelemetry = data.outputStreamTelemetry || null;
      updateWorkflowState({ latestOutputStreamTelemetry });
      renderOutputStreamTelemetrySummary(refs, latestOutputStreamTelemetry, "STREAM TELEMETRY EMPTY");
      return latestOutputStreamTelemetry;
    } catch (error) {
      updateWorkflowState({ latestOutputStreamTelemetry: null });
      renderOutputStreamTelemetrySummary(refs, null, `STREAM TELEMETRY UNAVAILABLE: ${error?.message || error}`);
      return null;
    }
  }

  async function refreshOutputReliabilityGate(evaluate = false) {
    try {
      const data = evaluate
        ? await postJson(fetchRef, "/api/live/output/reliability-gate/evaluate", {})
        : await (async () => {
            const response = await fetchRef("/api/live/output/reliability-gate");
            if (!response.ok) throw new Error(`/api/live/output/reliability-gate ${response.status}`);
            return response.json();
          })();
      const latestOutputReliabilityGate = data.outputReliabilityGate || null;
      updateWorkflowState({ latestOutputReliabilityGate });
      renderOutputReliabilityGateSummary(refs, latestOutputReliabilityGate, "RELIABILITY EMPTY");
      return latestOutputReliabilityGate;
    } catch (error) {
      updateWorkflowState({ latestOutputReliabilityGate: null });
      renderOutputReliabilityGateSummary(refs, null, `RELIABILITY UNAVAILABLE: ${error?.message || error}`);
      return null;
    }
  }

  async function refreshOutputPhysicalArm() {
    try {
      const response = await fetchRef("/api/live/output/physical-arm");
      if (!response.ok) throw new Error(`/api/live/output/physical-arm ${response.status}`);
      const data = await response.json();
      const latestOutputPhysicalArm = data.outputPhysicalArm || null;
      updateWorkflowState({ latestOutputPhysicalArm });
      renderOutputPhysicalArmSummary(refs, latestOutputPhysicalArm, "PHYSICAL ARM EMPTY");
      return latestOutputPhysicalArm;
    } catch (error) {
      updateWorkflowState({ latestOutputPhysicalArm: null });
      renderOutputPhysicalArmSummary(refs, null, `PHYSICAL ARM UNAVAILABLE: ${error?.message || error}`);
      return null;
    }
  }

  function summarize(hardwareTestOutput, error = "") {
    const context = getWorkflowContext();
    summarizeActionableStatus(refs, {
      live: context.latestLive,
      readiness: context.latestReadiness,
      sync: context.latestSync,
      hardwareTestOutput,
      audit: context.latestAudit,
      error
    });
  }

  async function runOutputSmoke(transportKind) {
    const context = getWorkflowContext();
    const request = buildOutputSmokeRequest(context.latestReadiness, context.latestIssuedToken, transportKind);
    try {
      const data = await postJson(fetchRef, "/api/live/output/smoke-test", request);
      const latestOutputSmokeTest = data.outputSmokeTest || null;
      updateWorkflowState({ latestOutputSmokeTest });
      renderOutputSmokeSummary(refs, latestOutputSmokeTest, "SMOKE RESPONSE EMPTY");
      await refreshOutputSendHistory();
      summarize(latestOutputSmokeTest);
    } catch (error) {
      updateWorkflowState({ latestOutputSmokeTest: null });
      renderOutputSmokeSummary(refs, null, `SMOKE FAILED: ${error?.message || error}`);
      summarize(null, "OUTPUT_SMOKE_FAILED");
    }
  }

  async function runOutputTarget(transportKind) {
    const context = getWorkflowContext();
    const request = buildOutputTargetRequest(context.latestReadiness, transportKind);
    try {
      const data = await postJson(fetchRef, "/api/live/output/target-config", request);
      const latestOutputTargetConfig = data.outputTargetConfig || null;
      updateWorkflowState({ latestOutputTargetConfig });
      renderOutputTargetSummary(refs, latestOutputTargetConfig, "TARGET RESPONSE EMPTY");
      summarize(context.latestOutputSmokeTest || context.latestHardwareTestOutput);
    } catch (error) {
      updateWorkflowState({ latestOutputTargetConfig: null });
      renderOutputTargetSummary(refs, null, `TARGET FAILED: ${error?.message || error}`);
    }
  }

  async function armPhysicalOutput(transportKind) {
    try {
      const data = await postJson(fetchRef, "/api/live/output/physical-arm", {
        transportKind,
        ttlMs: 90000,
        operatorConfirmed: true,
        confirmation: "CONFIRM_PHYSICAL_OUTPUT_ARM_LOW_BRIGHTNESS",
        reason: `operator_arm_${transportKind}_12U`
      });
      const latestOutputPhysicalArm = data.outputPhysicalArm || null;
      updateWorkflowState({ latestOutputPhysicalArm });
      renderOutputPhysicalArmSummary(refs, latestOutputPhysicalArm, "PHYSICAL ARM RESPONSE EMPTY");
    } catch (error) {
      renderOutputPhysicalArmSummary(refs, null, `PHYSICAL ARM FAILED: ${error?.message || error}`);
    }
  }

  async function disarmPhysicalOutput() {
    try {
      const data = await postJson(fetchRef, "/api/live/output/physical-arm/disarm", { reason: "operator_disarm_output_12U" });
      const latestOutputPhysicalArm = data.outputPhysicalArm || null;
      updateWorkflowState({ latestOutputPhysicalArm });
      renderOutputPhysicalArmSummary(refs, latestOutputPhysicalArm, "PHYSICAL ARM DISARMED");
    } catch (error) {
      renderOutputPhysicalArmSummary(refs, null, `PHYSICAL DISARM FAILED: ${error?.message || error}`);
    }
  }

  async function runOutputTestRun(transportKind, physical = false) {
    const context = getWorkflowContext();
    const request = buildOutputTestRunRequest(context.latestReadiness, context.latestIssuedToken, transportKind, physical);
    try {
      const data = await postJson(fetchRef, "/api/live/output/test-run", request);
      const latestOutputTestRun = data.outputTestRun || null;
      updateWorkflowState({ latestOutputTestRun });
      renderOutputTestRunSummary(refs, latestOutputTestRun, "TEST RUN RESPONSE EMPTY");
      if (latestOutputTestRun?.targetConfig) renderOutputTargetSummary(refs, latestOutputTestRun.targetConfig, "TARGET FROM TEST RUN");
      if (latestOutputTestRun?.outputSmokeTest) renderOutputSmokeSummary(refs, latestOutputTestRun.outputSmokeTest, "SMOKE FROM TEST RUN");
      if (latestOutputTestRun?.physicalArm) renderOutputPhysicalArmSummary(refs, latestOutputTestRun.physicalArm, "ARM FROM TEST RUN");
      await refreshOutputSendHistory();
      await refreshOutputVerification();
      summarize(latestOutputTestRun?.outputSmokeTest || context.latestOutputSmokeTest || context.latestHardwareTestOutput);
    } catch (error) {
      updateWorkflowState({ latestOutputTestRun: null });
      renderOutputTestRunSummary(refs, null, `TEST RUN FAILED: ${error?.message || error}`);
    }
  }

  async function runOutputMinimalFrame(transportKind, physical = false) {
    const context = getWorkflowContext();
    const request = buildOutputMinimalFrameRequest(context.latestReadiness, context.latestIssuedToken, transportKind, physical);
    try {
      const data = await postJson(fetchRef, "/api/live/output/minimal-frame", request);
      const latestOutputMinimalFrame = data.outputMinimalFrame || null;
      updateWorkflowState({ latestOutputMinimalFrame });
      renderOutputMinimalFrameSummary(refs, latestOutputMinimalFrame, "MIN FRAME RESPONSE EMPTY");
      if (latestOutputMinimalFrame?.targetConfig) renderOutputTargetSummary(refs, latestOutputMinimalFrame.targetConfig, "TARGET FROM MIN FRAME");
      if (latestOutputMinimalFrame?.outputSmokeTest) renderOutputSmokeSummary(refs, latestOutputMinimalFrame.outputSmokeTest, "SMOKE FROM MIN FRAME");
      if (latestOutputMinimalFrame?.physicalArm) renderOutputPhysicalArmSummary(refs, latestOutputMinimalFrame.physicalArm, "ARM FROM MIN FRAME");
      await refreshOutputSendHistory();
      await refreshOutputVerification();
      summarize(latestOutputMinimalFrame?.outputSmokeTest || context.latestOutputSmokeTest || context.latestHardwareTestOutput);
    } catch (error) {
      updateWorkflowState({ latestOutputMinimalFrame: null });
      renderOutputMinimalFrameSummary(refs, null, `MIN FRAME FAILED: ${error?.message || error}`);
    }
  }

  async function runOutputMultiFrameStream(transportKind, physical = false) {
    const context = getWorkflowContext();
    const request = buildOutputMultiFrameStreamRequest(context.latestReadiness, context.latestIssuedToken, transportKind, physical);
    try {
      const data = await postJson(fetchRef, "/api/live/output/multiframe-stream", request);
      const latestOutputMultiFrameStream = data.outputMultiFrameStream || null;
      updateWorkflowState({ latestOutputMultiFrameStream });
      renderOutputMultiFrameStreamSummary(refs, latestOutputMultiFrameStream, "STREAM RESPONSE EMPTY");
      await refreshOutputSendHistory();
      await refreshOutputVerification();
      summarize(latestOutputMultiFrameStream || context.latestOutputMinimalFrame?.outputSmokeTest || context.latestOutputSmokeTest || context.latestHardwareTestOutput);
    } catch (error) {
      updateWorkflowState({ latestOutputMultiFrameStream: null });
      renderOutputMultiFrameStreamSummary(refs, null, `STREAM FAILED: ${error?.message || error}`);
    }
  }

  async function runOutputStreamTelemetry(transportKind) {
    const context = getWorkflowContext();
    const request = buildOutputStreamTelemetryRequest(context.latestReadiness, context.latestIssuedToken, transportKind);
    try {
      const data = await postJson(fetchRef, "/api/live/output/stream-telemetry/run", request);
      const latestOutputStreamTelemetry = data.outputStreamTelemetry || null;
      updateWorkflowState({ latestOutputStreamTelemetry });
      renderOutputStreamTelemetrySummary(refs, latestOutputStreamTelemetry, "STREAM TELEMETRY RESPONSE EMPTY");
      await refreshOutputSendHistory();
      await refreshOutputVerification();
      await refreshOutputReliabilityGate(true);
      summarize(latestOutputStreamTelemetry?.lastRun || context.latestOutputMultiFrameStream || context.latestHardwareTestOutput);
    } catch (error) {
      updateWorkflowState({ latestOutputStreamTelemetry: null });
      renderOutputStreamTelemetrySummary(refs, null, `STREAM TELEMETRY FAILED: ${error?.message || error}`);
    }
  }

  async function stopOutputStreamTelemetry() {
    try {
      const data = await postJson(fetchRef, "/api/live/output/stream-telemetry/stop", { reason: "operator_stop_stream_12Z_ui" });
      renderOutputStreamTelemetrySummary(refs, data.outputStreamStop || null, "STREAM STOP REQUESTED");
      await refreshOutputStreamTelemetry();
    } catch (error) {
      renderOutputStreamTelemetrySummary(refs, null, `STREAM STOP FAILED: ${error?.message || error}`);
    }
  }

  function bind() {
    refs.liveOutputTargetSerialButton?.addEventListener?.("click", async () => { await runOutputTarget("serial"); });
    refs.liveOutputTargetArtnetButton?.addEventListener?.("click", async () => { await runOutputTarget("artnet"); });
    refs.liveOutputSmokeSerialButton?.addEventListener?.("click", async () => { await runOutputSmoke("serial"); });
    refs.liveOutputSmokeArtnetButton?.addEventListener?.("click", async () => { await runOutputSmoke("artnet"); });
    refs.liveOutputSendHistoryButton?.addEventListener?.("click", async () => { await refreshOutputSendHistory(); });
    refs.liveOutputSendHistoryClearButton?.addEventListener?.("click", async () => {
      try {
        const data = await postJson(fetchRef, "/api/live/output/send-history/clear", { reason: "operator_clear_send_history_12T" });
        const latestOutputSendHistory = data.outputSendHistory || null;
        updateWorkflowState({ latestOutputSendHistory });
        renderOutputSendHistorySummary(refs, latestOutputSendHistory, "SEND HISTORY CLEARED");
      } catch (error) {
        renderOutputSendHistorySummary(refs, null, `CLEAR SEND HISTORY FAILED: ${error?.message || error}`);
      }
    });
    refs.liveOutputPhysicalArmSerialButton?.addEventListener?.("click", async () => { await armPhysicalOutput("serial"); });
    refs.liveOutputPhysicalArmArtnetButton?.addEventListener?.("click", async () => { await armPhysicalOutput("artnet"); });
    refs.liveOutputPhysicalDisarmButton?.addEventListener?.("click", async () => { await disarmPhysicalOutput(); });
    refs.liveOutputTestRunSerialDryButton?.addEventListener?.("click", async () => { await runOutputTestRun("serial", false); });
    refs.liveOutputTestRunArtnetDryButton?.addEventListener?.("click", async () => { await runOutputTestRun("artnet", false); });
    refs.liveOutputTestRunSerialPhysicalButton?.addEventListener?.("click", async () => { await runOutputTestRun("serial", true); });
    refs.liveOutputTestRunArtnetPhysicalButton?.addEventListener?.("click", async () => { await runOutputTestRun("artnet", true); });
    refs.liveOutputVerificationButton?.addEventListener?.("click", async () => { await refreshOutputVerification(); });
    refs.liveOutputMinimalFrameSerialDryButton?.addEventListener?.("click", async () => { await runOutputMinimalFrame("serial", false); });
    refs.liveOutputMinimalFrameArtnetDryButton?.addEventListener?.("click", async () => { await runOutputMinimalFrame("artnet", false); });
    refs.liveOutputMinimalFrameSerialPhysicalButton?.addEventListener?.("click", async () => { await runOutputMinimalFrame("serial", true); });
    refs.liveOutputMinimalFrameArtnetPhysicalButton?.addEventListener?.("click", async () => { await runOutputMinimalFrame("artnet", true); });
    refs.liveOutputMultiFrameSerialDryButton?.addEventListener?.("click", async () => { await runOutputMultiFrameStream("serial", false); });
    refs.liveOutputMultiFrameArtnetDryButton?.addEventListener?.("click", async () => { await runOutputMultiFrameStream("artnet", false); });
    refs.liveOutputMultiFrameSerialPhysicalButton?.addEventListener?.("click", async () => { await runOutputMultiFrameStream("serial", true); });
    refs.liveOutputMultiFrameArtnetPhysicalButton?.addEventListener?.("click", async () => { await runOutputMultiFrameStream("artnet", true); });
    refs.liveOutputStreamTelemetrySerialDryButton?.addEventListener?.("click", async () => { await runOutputStreamTelemetry("serial"); });
    refs.liveOutputStreamTelemetryArtnetDryButton?.addEventListener?.("click", async () => { await runOutputStreamTelemetry("artnet"); });
    refs.liveOutputStreamTelemetryStopButton?.addEventListener?.("click", async () => { await stopOutputStreamTelemetry(); });
    refs.liveOutputStreamTelemetryRefreshButton?.addEventListener?.("click", async () => {
      await refreshOutputStreamTelemetry();
      await refreshOutputReliabilityGate(false);
    });
    refs.liveOutputReliabilityGateButton?.addEventListener?.("click", async () => { await refreshOutputReliabilityGate(true); });
  }

  return Object.freeze({
    bind,
    refreshOutputSendHistory,
    refreshOutputVerification,
    refreshOutputStreamTelemetry,
    refreshOutputReliabilityGate,
    refreshOutputPhysicalArm
  });
}
