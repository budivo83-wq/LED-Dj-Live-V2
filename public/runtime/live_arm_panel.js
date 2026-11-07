import { createLiveTransportDebugController } from "./live_transport_debug.js";
import { createLiveGuardControlsController } from "./live_guard_controls.js";
import { createLiveOutputWorkflowController } from "./live_output_workflow.js";
import { createLivePanelDiagnosticsController } from "./live_panel_diagnostics.js";
import { createLivePanelBootstrapController } from "./live_panel_bootstrap.js";
import { resolveLiveArmPanelRefs } from "./live_panel_refs.js";
import {
  setText,
  renderLivePanel,
  renderPreflightSummary,
  renderFullTokenSummary,
  renderSyncSummary,
  renderSerialDiagnosticsSummary,
  renderSerialDirectTestSummary,
  renderArtnetDiagnosticsSummary,
  renderOutputTargetSummary,
  buildOutputTargetRequest,
  renderOutputSmokeSummary,
  renderOutputSendHistorySummary,
  renderOutputPhysicalArmSummary,
  renderHardwareTestOutputSummary,
  buildOutputSmokeRequest,
  renderOutputTestRunSummary,
  renderOutputVerificationSummary,
  buildOutputTestRunRequest,
  renderOutputMinimalFrameSummary,
  buildOutputMinimalFrameRequest,
  renderOutputMultiFrameStreamSummary,
  buildOutputMultiFrameStreamRequest,
  renderOutputStreamTelemetrySummary,
  buildOutputStreamTelemetryRequest,
  renderOutputReliabilityGateSummary,
  buildHardwareTestOutputRequest,
  summarizeActionableStatus,
  renderAuditSummary,
  buildPreflightProbeRequest
} from "./live_panel_helpers.js";

export const LIVE_ARM_PANEL_VERSION = "12O-health-snapshot-debug + 12R-output-smoke-test-debug + 12S-output-target-config-debug + 12T-output-send-history-debug + 12U-physical-output-arm-debug + 12V-output-test-run-flow-debug + 12W-output-verification-debug + 12X-minimal-frame-output-debug + 12Y-multiframe-stream-debug + 12Z-stream-telemetry-debug + 13A-stream-reliability-gate-debug + 13C-serial-port-diagnostics-debug + 13D-artnet-target-diagnostics-debug";
export const LIVE_ARM_INTENT_KEY = "led-engine-next-controlled-arm-v1";

function controlledArmIntent(source = "live-ops-ui") {
  return {
    requested: true,
    operatorConfirmed: true,
    dryRunAcknowledged: true,
    source,
    mode: "controlled-arm",
    step: "12J"
  };
}

function storeIntent(storage, intent) {
  storage?.setItem?.(LIVE_ARM_INTENT_KEY, JSON.stringify(intent));
}

function clearIntent(storage) {
  storage?.removeItem?.(LIVE_ARM_INTENT_KEY);
}

async function postJson(fetchRef, url, body = {}) {
  const response = await fetchRef(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(`${url} ${response.status}`);
  return response.json();
}

export function initLiveArmPanel({
  documentRef = document,
  fetchRef = fetch,
  storage = localStorage,
  windowRef = window,
  controls = {}
} = {}) {
  const refs = resolveLiveArmPanelRefs(documentRef, controls);
  let latestReadiness = null;
  let latestLive = null;
  let latestSync = null;
  let latestAudit = null;
  let latestHardwareTestOutput = null;
  let latestOutputSmokeTest = null;
  let latestSerialDiagnostics = null;
  let latestArtnetDiagnostics = null;
  let latestOutputTargetConfig = null;
  let latestOutputSendHistory = null;
  let latestOutputPhysicalArm = null;
  let latestOutputTestRun = null;
  let latestOutputVerification = null;
  let latestOutputMinimalFrame = null;
  let latestOutputMultiFrameStream = null;
  let latestOutputStreamTelemetry = null;
  let latestOutputReliabilityGate = null;
  let latestIssuedToken = "";

  const diagnostics = createLivePanelDiagnosticsController({
    fetchRef,
    refs,
    renderSyncSummary,
    renderSerialDiagnosticsSummary,
    renderArtnetDiagnosticsSummary,
    summarizeActionableStatus,
    getDiagnosticsContext: () => ({
      latestLive,
      latestReadiness,
      latestSync,
      latestHardwareTestOutput,
      latestOutputSmokeTest,
      latestAudit
    }),
    updateDiagnosticsState: (next = {}) => {
      if (Object.prototype.hasOwnProperty.call(next, "latestSync")) latestSync = next.latestSync;
      if (Object.prototype.hasOwnProperty.call(next, "latestSerialDiagnostics")) latestSerialDiagnostics = next.latestSerialDiagnostics;
      if (Object.prototype.hasOwnProperty.call(next, "latestArtnetDiagnostics")) latestArtnetDiagnostics = next.latestArtnetDiagnostics;
    }
  });

  const transportDebug = createLiveTransportDebugController({
    fetchRef,
    refs,
    setText,
    postJson,
    renderArtnetDiagnosticsSummary,
    getLatestArtnetDiagnostics: () => latestArtnetDiagnostics
  });
  const outputWorkflow = createLiveOutputWorkflowController({
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
    getWorkflowContext: () => ({
      latestLive,
      latestReadiness,
      latestSync,
      latestAudit,
      latestIssuedToken,
      latestOutputSmokeTest,
      latestHardwareTestOutput,
      latestOutputMinimalFrame,
      latestOutputMultiFrameStream
    }),
    updateWorkflowState: (next = {}) => {
      if (Object.prototype.hasOwnProperty.call(next, "latestOutputSendHistory")) latestOutputSendHistory = next.latestOutputSendHistory;
      if (Object.prototype.hasOwnProperty.call(next, "latestOutputVerification")) latestOutputVerification = next.latestOutputVerification;
      if (Object.prototype.hasOwnProperty.call(next, "latestOutputStreamTelemetry")) latestOutputStreamTelemetry = next.latestOutputStreamTelemetry;
      if (Object.prototype.hasOwnProperty.call(next, "latestOutputReliabilityGate")) latestOutputReliabilityGate = next.latestOutputReliabilityGate;
      if (Object.prototype.hasOwnProperty.call(next, "latestOutputPhysicalArm")) latestOutputPhysicalArm = next.latestOutputPhysicalArm;
      if (Object.prototype.hasOwnProperty.call(next, "latestOutputSmokeTest")) latestOutputSmokeTest = next.latestOutputSmokeTest;
      if (Object.prototype.hasOwnProperty.call(next, "latestOutputTargetConfig")) latestOutputTargetConfig = next.latestOutputTargetConfig;
      if (Object.prototype.hasOwnProperty.call(next, "latestOutputTestRun")) latestOutputTestRun = next.latestOutputTestRun;
      if (Object.prototype.hasOwnProperty.call(next, "latestOutputMinimalFrame")) latestOutputMinimalFrame = next.latestOutputMinimalFrame;
      if (Object.prototype.hasOwnProperty.call(next, "latestOutputMultiFrameStream")) latestOutputMultiFrameStream = next.latestOutputMultiFrameStream;
    }
  });
  const guardControls = createLiveGuardControlsController({
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
    getGuardContext: () => ({
      latestLive,
      latestReadiness,
      latestSync,
      latestAudit,
      latestHardwareTestOutput,
      latestOutputSmokeTest,
      latestIssuedToken
    }),
    updateGuardState: (next = {}) => {
      if (Object.prototype.hasOwnProperty.call(next, "latestAudit")) latestAudit = next.latestAudit;
      if (Object.prototype.hasOwnProperty.call(next, "latestHardwareTestOutput")) latestHardwareTestOutput = next.latestHardwareTestOutput;
      if (Object.prototype.hasOwnProperty.call(next, "latestIssuedToken")) latestIssuedToken = next.latestIssuedToken;
    }
  });
  const bootstrap = createLivePanelBootstrapController({
    fetchRef,
    refs,
    setText,
    renderLivePanel,
    renderFullTokenSummary,
    renderPreflightSummary,
    renderHardwareTestOutputSummary,
    renderOutputSmokeSummary,
    summarizeActionableStatus,
    version: LIVE_ARM_PANEL_VERSION,
    getBootstrapContext: () => ({
      latestLive,
      latestReadiness,
      latestSync,
      latestAudit,
      latestHardwareTestOutput,
      latestOutputSmokeTest
    }),
    updateBootstrapState: (next = {}) => {
      if (Object.prototype.hasOwnProperty.call(next, "latestLive")) latestLive = next.latestLive;
      if (Object.prototype.hasOwnProperty.call(next, "latestReadiness")) latestReadiness = next.latestReadiness;
      if (Object.prototype.hasOwnProperty.call(next, "latestHardwareTestOutput")) latestHardwareTestOutput = next.latestHardwareTestOutput;
      if (Object.prototype.hasOwnProperty.call(next, "latestOutputSmokeTest")) latestOutputSmokeTest = next.latestOutputSmokeTest;
    }
  });

  async function refresh() {
    const live = await bootstrap.refreshLiveState();
    if (!live) {
      return null;
    }
    try {
      await diagnostics.refreshSync();
      await diagnostics.refreshSerialDiagnostics();
      await diagnostics.refreshArtnetDiagnostics();
      await transportDebug.refreshBlxRuntimeStatus();
      await outputWorkflow.refreshOutputSendHistory();
      await outputWorkflow.refreshOutputPhysicalArm();
      await outputWorkflow.refreshOutputStreamTelemetry();
      await guardControls.refreshAudit();
      return live;
    } catch (error) {
      renderLivePanel(refs, live, `refresh incomplete: ${error?.message || error}`);
      return live;
    }
  }

  refs.liveSerialDirectTestButton?.addEventListener?.("click", async () => {
    try {
      renderSerialDirectTestSummary(refs, null, "DIRECT SERIAL SENDING...");
      const data = await postJson(fetchRef, "/api/live/output/serial-direct-test", {
        pattern: "rgb-pulse",
        pixels: 60,
        brightness: 20,
        frames: 8,
        intervalMs: 220
      });
      renderSerialDirectTestSummary(refs, data.serialDirectTest || null, "DIRECT SERIAL RESPONSE EMPTY");
      await outputWorkflow.refreshOutputSendHistory();
    } catch (error) {
      renderSerialDirectTestSummary(refs, null, `DIRECT SERIAL FAILED: ${error?.message || error}`);
    }
  });

  diagnostics.bind();
  transportDebug.bind();
  guardControls.bind();
  outputWorkflow.bind();

  refs.livePanelRefreshButton?.addEventListener?.("click", async () => {
    await refresh();
    setText(refs.liveArmDetail, "manual refresh completed 12N");
  });

  let transportAutoRefreshBusy = false;
  const transportAutoRefreshMs = 3000;
  let lastLiveTransportRefreshAt = 0;
  function liveOutputActiveForTransportRelief() {
    try {
      const gate = windowRef.__ledOutputConsumerGate || {};
      const mirror = windowRef.__budilightArtNetMasterMirror22EJ || {};
      return gate.outputEnabled === true || (mirror.enabled === true && Number(mirror.sent || 0) > 0);
    } catch {
      return false;
    }
  }
  const transportAutoRefreshTick37DF = async () => {
    if (transportAutoRefreshBusy) return;
    if (documentRef?.hidden) return;
    const liveOutput = liveOutputActiveForTransportRelief();
    const now = Date.now();
    if (liveOutput && now - lastLiveTransportRefreshAt < 12000) return;
    lastLiveTransportRefreshAt = now;
    transportAutoRefreshBusy = true;
    try {
      await transportDebug.refreshArtnetRuntimeStatus();
      await transportDebug.refreshBlxRuntimeStatus();
      // Node discovery/status polling is network + DOM noise. During live output
      // keep the actual runtime status, but avoid heavy node refresh bursts.
      if (!liveOutput) {
        await transportDebug.refreshArtnetNodes();
        await transportDebug.refreshBlxNodes();
      }
    } catch {
      // keep loop alive; statuses already contain details on failure
    } finally {
      transportAutoRefreshBusy = false;
    }
  };
  let transportAutoRefreshTimer = 0;
  try {
    const loops = windowRef?.__budilightRuntimeLoopRegistry37CE;
    if (loops?.adaptiveInterval) {
      transportAutoRefreshTimer = loops.adaptiveInterval('live-arm:transport-auto-refresh', transportAutoRefreshTick37DF, transportAutoRefreshMs, {
        group: 'live-arm',
        liveFactor: 4,
        hiddenFactor: 6,
        maxMs: 18000,
        skipWhenHidden: true
      });
    } else {
      transportAutoRefreshTimer = setInterval(transportAutoRefreshTick37DF, transportAutoRefreshMs);
      transportAutoRefreshTimer?.unref?.();
    }
  } catch {
    transportAutoRefreshTimer = setInterval(transportAutoRefreshTick37DF, transportAutoRefreshMs);
    transportAutoRefreshTimer?.unref?.();
  }

  function dispose() {
    try { windowRef?.__budilightRuntimeLoopRegistry37CE?.clear?.(transportAutoRefreshTimer); } catch {}
    try { clearInterval(transportAutoRefreshTimer); } catch {}
  }

  refresh();
  return Object.freeze({
    version: LIVE_ARM_PANEL_VERSION,
    refresh,
    refreshAudit: guardControls.refreshAudit,
    refreshSync: diagnostics.refreshSync,
    controlledArmIntent,
    dispose
  });
}
