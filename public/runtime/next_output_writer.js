import { createTransportRegistry, resolveTransportCapabilities } from "./transport_registry.js";
import { buildMultiOutputRoutes, createIdleMultiOutputRouter } from "./multi_output_router.js";
import { runLiveControlledArmPhase } from "./live_controlled_arm_phase.js";
import { runLiveExecutorSkeleton } from "./live_executor_skeleton.js";
import { buildLiveExecutorDiagnostics, createIdleLiveExecutorDiagnostics } from "./live_executor_diagnostics.js";
import { evaluateLiveStateMachine, createIdleLiveStateMachine } from "./live_state_machine.js";

export const NEXT_OUTPUT_WRITER_VERSION = "11P-live-executor-preflight";

export function createIdleNextOutputWriter(reason = "idle") {
  return Object.freeze({
    version: NEXT_OUTPUT_WRITER_VERSION,
    enabled: false,
    ran: false,
    ok: false,
    writerReady: false,
    decision: "BLOCKED",
    wouldWritePackets: 0,
    wouldWritePayloadBytes: 0,
    transportSelected: "none",
    selectedTransports: [],
    blockedReason: reason,
    outputTouched: false,
    networkTouched: false,
    serialTouched: false,
    frameAuthorityTouched: false,
    dryRunOnly: true,
    mockTransportEnabled: false,
    mockTransportTouched: false,
    mockWriteCount: 0,
    mockPayloadBytes: 0,
    mockProtocols: [],
    mockDigest: "none",
    liveOutputWriteGateEnabled: false,
    liveWriteRequested: false,
    liveExecutorImplemented: false,
    physicalWriteAllowed: false,
    liveBlockedReason: reason,
    serialGuardedAdapterEnabled: false,
    serialAdapterReady: false,
    serialAdapterDecision: "DISABLED",
    serialAdapterWouldWritePackets: 0,
    serialAdapterWouldWritePayloadBytes: 0,
    serialAdapterTouched: false,
    serialAdapterBlockedReason: reason,
    networkGuardedAdapterEnabled: false,
    networkAdapterReady: false,
    networkAdapterDecision: "DISABLED",
    networkAdapterWouldWritePackets: 0,
    networkAdapterWouldWritePayloadBytes: 0,
    networkAdapterTouched: false,
    networkAdapterBlockedReason: reason,
    liveOutputCommitPlanEnabled: false,
    transportCapabilityRegistryEnabled: false,
    transportRegistryReady: false,
    transportRegistryDecision: "DISABLED",
    transportRegistrySelected: [],
    transportRegistryReason: reason,
    multiOutputRouterEnabled: false,
    multiOutputRouter: createIdleMultiOutputRouter(reason),
    commitPlanReady: false,
    commitPlanDecision: "DISABLED",
    commitPlanPackets: 0,
    commitPlanPayloadBytes: 0,
    commitPlanTransports: [],
    commitPlanDigest: "none",
    commitPlanTouched: false,
    commitPlanBlockedReason: reason,
    transportBatchCount: 0,
    transportBatches: [],
    transportBatchDigest: "none",
    transportBatchValidationOk: false,
    transportBatchValidationDecision: "DISABLED",
    transportBatchValidationIssues: [],
    transportBatchValidationDigest: "none",
    batchExecutionSchedulerEnabled: false,
    batchExecutionScheduleOk: false,
    batchExecutionScheduleDecision: "DISABLED",
    batchExecutionScheduleCount: 0,
    batchExecutionSchedule: [],
    batchExecutionScheduleDigest: "none",
    executionCommitPreviewEnabled: false,
    executionCommitPreviewOk: false,
    executionCommitPreviewDecision: "DISABLED",
    executionCommitPreview: null,
    executionCommitPreviewDigest: "none",
    executionAuditSnapshotEnabled: false,
    executionAuditSnapshotOk: false,
    executionAuditSnapshotDecision: "DISABLED",
    executionAuditSnapshot: null,
    executionAuditSnapshotDigest: "none",
    executionAuditHistoryEnabled: false,
    executionAuditHistoryOk: false,
    executionAuditHistoryDecision: "DISABLED",
    executionAuditHistoryCount: 0,
    executionAuditHistory: [],
    executionAuditHistoryDigest: "none",
    executionAuditExportEnabled: false,
    executionAuditExportOk: false,
    executionAuditExportDecision: "DISABLED",
    executionAuditExport: null,
    executionAuditExportSizeBytes: 0,
    executionAuditExportDigest: "none",
    executionDebugPayloadEnabled: false,
    executionDebugPayloadOk: false,
    executionDebugPayloadDecision: "DISABLED",
    executionDebugPayload: null,
    executionDebugPayloadDigest: "none",
    executionSanityMonitorEnabled: false,
    executionSanityMonitorOk: false,
    executionSanityMonitorDecision: "DISABLED",
    executionSanityMonitorIssueCount: 0,
    executionSanityMonitorIssues: [],
    executionSanityMonitorDigest: "none",
    executionHealthSummaryEnabled: false,
    executionHealthSummaryOk: false,
    executionHealthSummaryDecision: "DISABLED",
    executionHealthSummaryStatus: "OFF",
    executionHealthSummarySeverity: "off",
    executionHealthSummary: null,
    executionHealthSummaryDigest: "none",
    executionHealthTrendEnabled: false,
    executionHealthTrendOk: false,
    executionHealthTrendDecision: "DISABLED",
    executionHealthTrendStatus: "OFF",
    executionHealthTrendSeverity: "off",
    executionHealthTrend: null,
    executionHealthTrendDigest: "none",
    executionReadinessGateEnabled: false,
    executionReadinessGateOk: false,
    executionReadinessGateDecision: "DISABLED",
    executionReadinessGateStatus: "OFF",
    executionReadinessGateSeverity: "off",
    executionReadinessGate: null,
    executionReadinessGateDigest: "none",
    liveExecutorPreflightEnabled: false,
    liveExecutorPreflightOk: false,
    liveExecutorPreflightDecision: "DISABLED",
    liveExecutorPreflightStatus: "OFF",
    liveExecutorPreflightSeverity: "off",
    liveExecutorPreflightCanArmLive: false,
    liveExecutorPreflightBlockerCount: 0,
    liveExecutorPreflightWarningCount: 0,
    liveExecutorPreflight: null,
    liveExecutorPreflightDigest: "none",
    liveFrameMirrorValidationEnabled: false,
    liveFrameMirrorValidationOk: false,
    liveFrameMirrorValidationDecision: "DISABLED",
    liveFrameMirrorValidationStatus: "OFF",
    liveFrameMirrorValidationSeverity: "off",
    liveFrameMirrorValidation: null,
    liveFrameMirrorValidationDigest: "none",
    liveControlledArmPhaseEnabled: false,
    liveControlledArmPhaseOk: false,
    liveControlledArmPhaseDecision: "DISABLED",
    liveControlledArmPhaseStatus: "OFF",
    liveControlledArmPhaseSeverity: "off",
    liveControlledArmCanEnter: false,
    liveControlledArmToken: null,
    liveControlledArmBlocked: [reason],
    liveControlledArmWarnings: [],
    liveControlledArmPhase: null,
    liveControlledArmPhaseDigest: "none",
    controlledArmRuntimeWired: false,
    liveExecutorSkeletonEnabled: false,
    liveExecutorSkeletonOk: false,
    liveExecutorSkeletonDecision: "DISABLED",
    liveExecutorSkeletonStatus: "OFF",
    liveExecutorSkeletonSeverity: "off",
    liveExecutorReady: false,
    liveExecutorTokenAccepted: false,
    liveExecutorPlannedBatchCount: 0,
    liveExecutorPlannedPacketCount: 0,
    liveExecutorPlannedPayloadBytes: 0,
    liveExecutorPlannedTransports: [],
    liveExecutorNullTransportTouched: false,
    liveExecutorMockExecuteCount: 0,
    liveExecutorSkeleton: null,
    liveExecutorSkeletonDigest: "none",
    liveExecutorDiagnosticsEnabled: false,
    liveExecutorDiagnosticsOk: false,
    liveExecutorDiagnosticsDecision: "DISABLED",
    liveExecutorDiagnosticsStatus: "OFF",
    liveExecutorDiagnosticsSeverity: "off",
    liveExecutorDiagnosticsContractReady: false,
    liveExecutorDiagnosticsAllowedTransports: [],
    liveExecutorDiagnosticsBlocked: [reason],
    liveExecutorDiagnosticsWarnings: [],
    liveExecutorDiagnostics: createIdleLiveExecutorDiagnostics(reason),
    liveExecutorDiagnosticsDigest: "none",
    liveStateMachineEnabled: false,
    liveStateMachineOk: false,
    liveStateMachineState: "locked",
    liveStateMachineDecision: "DISABLED",
    liveStateMachineStatus: "OFF",
    liveStateMachineSeverity: "off",
    liveStateCanArm: false,
    liveStateIsArmed: false,
    liveStateCanExecute: false,
    liveStateWouldExecute: false,
    liveStateMachineBlocked: [reason],
    liveStateMachineWarnings: [],
    liveStateMachine: createIdleLiveStateMachine(reason),
    liveStateMachineDigest: "none",
    safety: "11W controlled arm/runtime executor idle; no serial/network/socket/write API is called"
  });
}

function splitProtocol(entry) {
  const raw = String(entry || "");
  const key = raw.split(":")[0].trim();
  return key || "unknown";
}

function uniqueProtocols(protocols) {
  const out = [];
  const seen = new Set();
  for (const entry of Array.isArray(protocols) ? protocols : []) {
    const key = splitProtocol(entry);
    if (!key || key === "unknown" || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out.slice(0, 12);
}

export function evaluateNextOutputWriterSkeleton({
  enabled = false,
  outputWriteInterlock = null,
  outputHandoffProbe = null,
  manualArmedDryRun = null,
  mockTransportEnabled = false,
  liveOutputWriteGateEnabled = false,
  serialGuardedAdapterEnabled = false,
  networkGuardedAdapterEnabled = false,
  liveOutputCommitPlanEnabled = false,
  transportCapabilityRegistryEnabled = false,
  multiOutputRouterEnabled = false,
  batchExecutionSchedulerEnabled = false,
  executionCommitPreviewEnabled = false,
  executionAuditSnapshotEnabled = false,
  executionAuditHistoryEnabled = false,
  executionAuditExportEnabled = false,
  executionDebugPayloadEnabled = false,
  executionSanityMonitorEnabled = false,
  executionHealthSummaryEnabled = false,
  executionHealthTrendEnabled = false,
  executionReadinessGateEnabled = false,
  liveExecutorPreflightEnabled = false,
  liveFrameMirrorValidationEnabled = false,
  liveControlledArmPhaseEnabled = false,
  liveExecutorSkeletonEnabled = false,
  liveExecutorDiagnosticsEnabled = false,
  liveStateMachineEnabled = false,
  controlledArmIntent = null,
  lastControlledDisarmMs = null,
  controlledArmHoldoffMs = 1000,
  allowControlledArmWarnings = true,
  authoritativeFrame = null,
  frameSource = "frame_bus",
  frameTimestampMs = null,
  targetFPS = 60,
  frameId = 0,
  mapping = null
} = {}) {
  if (!enabled) return createIdleNextOutputWriter("next_output_writer_disabled");

  const interlockReady = Boolean(outputWriteInterlock?.ran && outputWriteInterlock?.ok);
  const interlockAllowsWrite = Boolean(outputWriteInterlock?.writeAllowed === true);
  const handoffReady = Boolean(outputHandoffProbe?.ok && outputHandoffProbe?.handoffReady);
  const armedDryRunReady = Boolean(manualArmedDryRun?.ok && manualArmedDryRun?.decision === "ARMED_DRY_RUN");
  const packetCount = Number(outputWriteInterlock?.packetCount || outputHandoffProbe?.packetCount || manualArmedDryRun?.packetCount || 0);
  const payloadBytes = Number(outputWriteInterlock?.payloadBytes || outputHandoffProbe?.payloadBytes || manualArmedDryRun?.payloadBytes || 0);
  const selectedTransports = uniqueProtocols(outputWriteInterlock?.protocols?.length ? outputWriteInterlock.protocols : outputHandoffProbe?.protocols);
  const transportSelected = selectedTransports.length ? selectedTransports.join("+") : "none";

  const liveWriteRequested = Boolean(liveOutputWriteGateEnabled && !mockTransportEnabled);
  const liveExecutorImplemented = Boolean(serialGuardedAdapterEnabled || networkGuardedAdapterEnabled);
  const physicalWriteAllowed = false;

  let blockedReason = liveWriteRequested ? "live_executor_not_implemented" : "ready_but_live_write_not_implemented";
  if (!interlockReady) blockedReason = "write_interlock_not_ready";
  else if (!handoffReady) blockedReason = "handoff_not_ready";
  else if (!armedDryRunReady) blockedReason = "manual_armed_dry_run_not_ready";
  else if (!interlockAllowsWrite) blockedReason = String(outputWriteInterlock?.reason || "write_interlock_locked");

  const writerReady = Boolean(interlockReady && handoffReady && armedDryRunReady && packetCount > 0 && payloadBytes > 0);
  const hasSerialRoute = selectedTransports.includes("serial");
  const hasNetworkRoute = selectedTransports.some((transport) => transport === "artnet" || transport === "blx" || transport === "sacn" || transport === "udp" || transport === "network");
  const serialAdapterReady = Boolean(serialGuardedAdapterEnabled && writerReady && hasSerialRoute && liveWriteRequested);
  const networkAdapterReady = Boolean(networkGuardedAdapterEnabled && writerReady && hasNetworkRoute && liveWriteRequested);
  const serialAdapterDecision = !serialGuardedAdapterEnabled
    ? "DISABLED"
    : (!writerReady
      ? "WAITING_FOR_WRITER"
      : (!hasSerialRoute
        ? "NO_SERIAL_ROUTE"
        : (physicalWriteAllowed ? "SERIAL_WRITE_ALLOWED" : "SERIAL_GUARD_BLOCKED")));
  const serialAdapterBlockedReason = !serialGuardedAdapterEnabled
    ? "serial_adapter_disabled"
    : (!writerReady
      ? blockedReason
      : (!hasSerialRoute
        ? "no_serial_route_in_packet_plan"
        : "physical_write_not_allowed"));
  const networkAdapterDecision = !networkGuardedAdapterEnabled
    ? "DISABLED"
    : (!writerReady
      ? "WAITING_FOR_WRITER"
      : (!hasNetworkRoute
        ? "NO_NETWORK_ROUTE"
        : (physicalWriteAllowed ? "NETWORK_WRITE_ALLOWED" : "NETWORK_GUARD_BLOCKED")));
  const networkAdapterBlockedReason = !networkGuardedAdapterEnabled
    ? "network_adapter_disabled"
    : (!writerReady
      ? blockedReason
      : (!hasNetworkRoute
        ? "no_network_route_in_packet_plan"
        : "physical_write_not_allowed"));

  const guardedRouteReady = Boolean(serialAdapterReady || networkAdapterReady);
  const commitPlanReady = Boolean(liveOutputCommitPlanEnabled && writerReady && liveWriteRequested && guardedRouteReady);
  const commitPlanDecision = !liveOutputCommitPlanEnabled
    ? "DISABLED"
    : (!writerReady
      ? "WAITING_FOR_WRITER"
      : (!liveWriteRequested
        ? "WAITING_FOR_LIVE_GATE"
        : (!guardedRouteReady
          ? "NO_GUARDED_ROUTE"
          : "COMMIT_PLAN_BLOCKED")));
  const commitPlanBlockedReason = !liveOutputCommitPlanEnabled
    ? "commit_plan_disabled"
    : (!writerReady
      ? blockedReason
      : (!liveWriteRequested
        ? "live_gate_not_requested"
        : (!guardedRouteReady
          ? "no_guarded_serial_or_network_route"
          : "physical_write_not_allowed")));
  const commitPlanTransports = commitPlanReady ? selectedTransports.filter((transport) => {
    if (transport === "serial") return Boolean(serialAdapterReady);
    return Boolean(networkAdapterReady && (transport === "artnet" || transport === "blx" || transport === "sacn" || transport === "udp" || transport === "network"));
  }) : [];
  const commitPlanDigest = commitPlanReady ? `${packetCount}:${payloadBytes}:${commitPlanTransports.join("+") || "none"}` : "none";
  const transportRegistry = createTransportRegistry();
  const transportCapabilityResolution = transportCapabilityRegistryEnabled
    ? resolveTransportCapabilities({ protocols: commitPlanTransports.length ? commitPlanTransports : selectedTransports, registry: transportRegistry, requiredCapabilities: ["rgb", "frame"], allowMock: Boolean(mockTransportEnabled) })
    : null;
  const multiOutputRouter = buildMultiOutputRoutes({
    enabled: Boolean(multiOutputRouterEnabled),
    commitPlan: {
      commitPlanReady,
      commitPlanPackets: commitPlanReady ? packetCount : 0,
      commitPlanPayloadBytes: commitPlanReady ? payloadBytes : 0,
      commitPlanTransports,
      decision: commitPlanDecision
    },
    selectedTransports: transportCapabilityResolution?.selected?.length ? transportCapabilityResolution.selected : commitPlanTransports,
    registry: transportRegistry,
    mapping,
    batchExecutionSchedulerEnabled,
    executionCommitPreviewEnabled,
    executionAuditSnapshotEnabled,
    executionAuditHistoryEnabled,
    executionAuditExportEnabled,
    executionDebugPayloadEnabled,
    executionSanityMonitorEnabled,
    executionHealthSummaryEnabled,
    executionHealthTrendEnabled,
    executionReadinessGateEnabled,
    liveExecutorPreflightEnabled,
    liveFrameMirrorValidationEnabled,
    authoritativeFrame,
    frameSource,
    frameTimestampMs,
    targetFPS,
    frameId
  });

  const liveControlledArmPhase = runLiveControlledArmPhase({
    enabled: Boolean(liveControlledArmPhaseEnabled),
    frameId,
    nowMs: frameTimestampMs,
    operatorIntent: controlledArmIntent,
    liveExecutorPreflight: multiOutputRouter.liveExecutorPreflight || null,
    liveFrameMirrorValidation: multiOutputRouter.liveFrameMirrorValidation || null,
    executionReadinessGate: multiOutputRouter.executionReadinessGate || null,
    executionCommitPreview: multiOutputRouter.executionCommitPreview || null,
    lastDisarmMs: lastControlledDisarmMs,
    holdoffMs: controlledArmHoldoffMs,
    allowWarnings: allowControlledArmWarnings
  });

  const liveExecutorSkeleton = runLiveExecutorSkeleton({
    enabled: Boolean(liveExecutorSkeletonEnabled),
    controlledArmPhase: liveControlledArmPhase,
    multiOutputRouter,
    frameId
  });

  const liveExecutorDiagnostics = buildLiveExecutorDiagnostics({
    enabled: Boolean(liveExecutorDiagnosticsEnabled),
    executor: liveExecutorSkeleton,
    frameId
  });

  const liveStateMachine = evaluateLiveStateMachine({
    enabled: Boolean(liveStateMachineEnabled),
    frameId,
    readinessGate: multiOutputRouter.executionReadinessGate || null,
    mirrorValidation: multiOutputRouter.liveFrameMirrorValidation || null,
    controlledArmPhase: liveControlledArmPhase,
    executor: liveExecutorSkeleton,
    diagnostics: liveExecutorDiagnostics,
    operatorIntent: controlledArmIntent
  });

  return Object.freeze({
    version: NEXT_OUTPUT_WRITER_VERSION,
    enabled: true,
    ran: true,
    ok: writerReady,
    writerReady,
    decision: mockTransportEnabled && writerReady ? "MOCK_WRITTEN" : (commitPlanReady ? "COMMIT_PLAN_BLOCKED" : (liveWriteRequested && writerReady ? (networkGuardedAdapterEnabled && networkAdapterReady ? "NETWORK_GUARD_BLOCKED" : (serialGuardedAdapterEnabled ? "SERIAL_GUARD_BLOCKED" : (networkGuardedAdapterEnabled ? "NETWORK_GUARD_BLOCKED" : "LIVE_GATE_BLOCKED"))) : "BLOCKED")),
    wouldWritePackets: writerReady ? packetCount : 0,
    wouldWritePayloadBytes: writerReady ? payloadBytes : 0,
    transportSelected,
    selectedTransports,
    blockedReason: mockTransportEnabled && writerReady ? "mock_transport_recorded_only" : blockedReason,
    outputTouched: false,
    networkTouched: false,
    serialTouched: false,
    frameAuthorityTouched: false,
    dryRunOnly: true,
    mockTransportEnabled: Boolean(mockTransportEnabled),
    mockTransportTouched: Boolean(mockTransportEnabled && writerReady),
    mockWriteCount: mockTransportEnabled && writerReady ? packetCount : 0,
    mockPayloadBytes: mockTransportEnabled && writerReady ? payloadBytes : 0,
    mockProtocols: mockTransportEnabled && writerReady ? selectedTransports : [],
    mockDigest: mockTransportEnabled && writerReady ? `${packetCount}:${payloadBytes}:${transportSelected}` : "none",
    liveOutputWriteGateEnabled: Boolean(liveOutputWriteGateEnabled),
    liveWriteRequested: Boolean(liveWriteRequested && writerReady),
    liveExecutorImplemented,
    physicalWriteAllowed,
    liveBlockedReason: liveWriteRequested && writerReady ? (networkGuardedAdapterEnabled && networkAdapterReady ? "network_guard_blocks_physical_write" : (serialGuardedAdapterEnabled ? "serial_guard_blocks_physical_write" : (networkGuardedAdapterEnabled ? "network_guard_blocks_physical_write" : "live_executor_not_implemented"))) : blockedReason,
    serialGuardedAdapterEnabled: Boolean(serialGuardedAdapterEnabled),
    serialAdapterReady,
    serialAdapterDecision,
    serialAdapterWouldWritePackets: serialAdapterReady ? packetCount : 0,
    serialAdapterWouldWritePayloadBytes: serialAdapterReady ? payloadBytes : 0,
    serialAdapterTouched: false,
    serialAdapterBlockedReason,
    networkGuardedAdapterEnabled: Boolean(networkGuardedAdapterEnabled),
    networkAdapterReady,
    networkAdapterDecision,
    networkAdapterWouldWritePackets: networkAdapterReady ? packetCount : 0,
    networkAdapterWouldWritePayloadBytes: networkAdapterReady ? payloadBytes : 0,
    networkAdapterTouched: false,
    networkAdapterBlockedReason,
    liveOutputCommitPlanEnabled: Boolean(liveOutputCommitPlanEnabled),
    transportCapabilityRegistryEnabled: Boolean(transportCapabilityRegistryEnabled),
    transportRegistryReady: Boolean(transportCapabilityRegistryEnabled && transportCapabilityResolution?.ok),
    transportRegistryDecision: !transportCapabilityRegistryEnabled ? "DISABLED" : (transportCapabilityResolution?.ok ? "CAPABILITY_MATCH" : "NO_CAPABILITY_MATCH"),
    transportRegistrySelected: transportCapabilityResolution?.selected || [],
    transportRegistryReason: transportCapabilityResolution?.reason || "transport_registry_disabled",
    multiOutputRouterEnabled: Boolean(multiOutputRouterEnabled),
    multiOutputRouter,
    commitPlanReady,
    commitPlanDecision,
    commitPlanPackets: commitPlanReady ? packetCount : 0,
    commitPlanPayloadBytes: commitPlanReady ? payloadBytes : 0,
    commitPlanTransports,
    commitPlanDigest,
    commitPlanTouched: false,
    commitPlanBlockedReason,
    transportBatchCount: multiOutputRouter.transportBatchCount || 0,
    transportBatches: multiOutputRouter.transportBatches || [],
    transportBatchDigest: multiOutputRouter.transportBatchDigest || "none",
    transportBatchValidationOk: Boolean(multiOutputRouter.transportBatchValidationOk),
    transportBatchValidationDecision: multiOutputRouter.transportBatchValidationDecision || "DISABLED",
    transportBatchValidationIssues: multiOutputRouter.transportBatchValidationIssues || [],
    transportBatchValidationDigest: multiOutputRouter.transportBatchValidationDigest || "none",
    batchExecutionSchedulerEnabled: Boolean(batchExecutionSchedulerEnabled),
    batchExecutionScheduleOk: Boolean(multiOutputRouter.batchExecutionScheduleOk),
    batchExecutionScheduleDecision: multiOutputRouter.batchExecutionScheduleDecision || "DISABLED",
    batchExecutionScheduleCount: Number(multiOutputRouter.batchExecutionScheduleCount || 0),
    batchExecutionSchedule: multiOutputRouter.batchExecutionSchedule || [],
    batchExecutionScheduleDigest: multiOutputRouter.batchExecutionScheduleDigest || "none",
    executionCommitPreviewEnabled: Boolean(executionCommitPreviewEnabled),
    executionCommitPreviewOk: Boolean(multiOutputRouter.executionCommitPreviewOk),
    executionCommitPreviewDecision: multiOutputRouter.executionCommitPreviewDecision || "DISABLED",
    executionCommitPreview: multiOutputRouter.executionCommitPreview || null,
    executionCommitPreviewDigest: multiOutputRouter.executionCommitPreviewDigest || "none",
    executionAuditSnapshotEnabled: Boolean(executionAuditSnapshotEnabled),
    executionAuditSnapshotOk: Boolean(multiOutputRouter.executionAuditSnapshotOk),
    executionAuditSnapshotDecision: multiOutputRouter.executionAuditSnapshotDecision || "DISABLED",
    executionAuditSnapshot: multiOutputRouter.executionAuditSnapshot || null,
    executionAuditSnapshotDigest: multiOutputRouter.executionAuditSnapshotDigest || "none",
    executionAuditHistoryEnabled: Boolean(executionAuditHistoryEnabled),
    executionAuditHistoryOk: Boolean(multiOutputRouter.executionAuditHistoryOk),
    executionAuditHistoryDecision: multiOutputRouter.executionAuditHistoryDecision || "DISABLED",
    executionAuditHistoryCount: Number(multiOutputRouter.executionAuditHistoryCount || 0),
    executionAuditHistory: multiOutputRouter.executionAuditHistory || [],
    executionAuditHistoryDigest: multiOutputRouter.executionAuditHistoryDigest || "none",
    executionAuditExportEnabled: Boolean(executionAuditExportEnabled),
    executionAuditExportOk: Boolean(multiOutputRouter.executionAuditExportOk),
    executionAuditExportDecision: multiOutputRouter.executionAuditExportDecision || "DISABLED",
    executionAuditExport: multiOutputRouter.executionAuditExport || null,
    executionAuditExportSizeBytes: Number(multiOutputRouter.executionAuditExportSizeBytes || 0),
    executionAuditExportDigest: multiOutputRouter.executionAuditExportDigest || "none",
    executionDebugPayloadEnabled: Boolean(executionDebugPayloadEnabled),
    executionDebugPayloadOk: Boolean(multiOutputRouter.executionDebugPayloadOk),
    executionDebugPayloadDecision: multiOutputRouter.executionDebugPayloadDecision || "DISABLED",
    executionDebugPayload: multiOutputRouter.executionDebugPayload || null,
    executionDebugPayloadDigest: multiOutputRouter.executionDebugPayloadDigest || "none",
    executionSanityMonitorEnabled: Boolean(executionSanityMonitorEnabled),
    executionSanityMonitorOk: Boolean(multiOutputRouter.executionSanityMonitorOk),
    executionSanityMonitorDecision: multiOutputRouter.executionSanityMonitorDecision || "DISABLED",
    executionSanityMonitorIssueCount: Number(multiOutputRouter.executionSanityMonitorIssueCount || 0),
    executionSanityMonitorIssues: multiOutputRouter.executionSanityMonitorIssues || [],
    executionSanityMonitorDigest: multiOutputRouter.executionSanityMonitorDigest || "none",
    executionHealthSummaryEnabled: Boolean(executionHealthSummaryEnabled),
    executionHealthSummaryOk: Boolean(multiOutputRouter.executionHealthSummaryOk),
    executionHealthSummaryDecision: String(multiOutputRouter.executionHealthSummaryDecision || "DISABLED"),
    executionHealthSummaryStatus: String(multiOutputRouter.executionHealthSummaryStatus || "OFF"),
    executionHealthSummarySeverity: String(multiOutputRouter.executionHealthSummarySeverity || "off"),
    executionHealthSummary: multiOutputRouter.executionHealthSummary || null,
    executionHealthSummaryDigest: multiOutputRouter.executionHealthSummaryDigest || "none",
    executionHealthTrendEnabled: Boolean(executionHealthTrendEnabled),
    executionHealthTrendOk: Boolean(multiOutputRouter.executionHealthTrendOk),
    executionHealthTrendDecision: String(multiOutputRouter.executionHealthTrendDecision || "DISABLED"),
    executionHealthTrendStatus: String(multiOutputRouter.executionHealthTrendStatus || "OFF"),
    executionHealthTrendSeverity: String(multiOutputRouter.executionHealthTrendSeverity || "off"),
    executionHealthTrend: multiOutputRouter.executionHealthTrend || null,
    executionHealthTrendDigest: multiOutputRouter.executionHealthTrendDigest || "none",
    executionReadinessGateEnabled: Boolean(executionReadinessGateEnabled),
    executionReadinessGateOk: Boolean(multiOutputRouter.executionReadinessGateOk),
    executionReadinessGateDecision: String(multiOutputRouter.executionReadinessGateDecision || "DISABLED"),
    executionReadinessGateStatus: String(multiOutputRouter.executionReadinessGateStatus || "OFF"),
    executionReadinessGateSeverity: String(multiOutputRouter.executionReadinessGateSeverity || "off"),
    executionReadinessGate: multiOutputRouter.executionReadinessGate || null,
    executionReadinessGateDigest: multiOutputRouter.executionReadinessGateDigest || "none",
    liveExecutorPreflightEnabled: Boolean(multiOutputRouter.liveExecutorPreflightEnabled),
    liveExecutorPreflightOk: Boolean(multiOutputRouter.liveExecutorPreflightOk),
    liveExecutorPreflightDecision: multiOutputRouter.liveExecutorPreflightDecision || "DISABLED",
    liveExecutorPreflightStatus: multiOutputRouter.liveExecutorPreflightStatus || "OFF",
    liveExecutorPreflightSeverity: multiOutputRouter.liveExecutorPreflightSeverity || "off",
    liveExecutorPreflightCanArmLive: Boolean(multiOutputRouter.liveExecutorPreflightCanArmLive),
    liveExecutorPreflightBlockerCount: Number(multiOutputRouter.liveExecutorPreflightBlockerCount || 0),
    liveExecutorPreflightWarningCount: Number(multiOutputRouter.liveExecutorPreflightWarningCount || 0),
    liveExecutorPreflight: multiOutputRouter.liveExecutorPreflight || null,
    liveExecutorPreflightDigest: multiOutputRouter.liveExecutorPreflightDigest || "none",
    liveFrameMirrorValidationEnabled: Boolean(multiOutputRouter.liveFrameMirrorValidationEnabled),
    liveFrameMirrorValidationOk: Boolean(multiOutputRouter.liveFrameMirrorValidationOk),
    liveFrameMirrorValidationDecision: multiOutputRouter.liveFrameMirrorValidationDecision || "DISABLED",
    liveFrameMirrorValidationStatus: multiOutputRouter.liveFrameMirrorValidationStatus || "OFF",
    liveFrameMirrorValidationSeverity: multiOutputRouter.liveFrameMirrorValidationSeverity || "off",
    liveFrameMirrorValidation: multiOutputRouter.liveFrameMirrorValidation || null,
    liveFrameMirrorValidationDigest: multiOutputRouter.liveFrameMirrorValidationDigest || "none",
    liveControlledArmPhaseEnabled: Boolean(liveControlledArmPhaseEnabled),
    liveControlledArmPhaseOk: Boolean(liveControlledArmPhase.ok),
    liveControlledArmPhaseDecision: liveControlledArmPhase.enabled ? (liveControlledArmPhase.ok ? "CONTROLLED_ARM_READY" : "CONTROLLED_ARM_BLOCKED") : "DISABLED",
    liveControlledArmPhaseStatus: liveControlledArmPhase.status || "OFF",
    liveControlledArmPhaseSeverity: liveControlledArmPhase.ok ? "ready" : (liveControlledArmPhase.enabled ? "blocked" : "off"),
    liveControlledArmCanEnter: Boolean(liveControlledArmPhase.canEnterControlledArm),
    liveControlledArmToken: liveControlledArmPhase.token || null,
    liveControlledArmBlocked: liveControlledArmPhase.blocked || [],
    liveControlledArmWarnings: liveControlledArmPhase.warnings || [],
    liveControlledArmPhase,
    liveControlledArmPhaseDigest: liveControlledArmPhase.digest || "none",
    controlledArmRuntimeWired: Boolean(liveControlledArmPhaseEnabled),
    liveExecutorSkeletonEnabled: Boolean(liveExecutorSkeletonEnabled),
    liveExecutorSkeletonOk: Boolean(liveExecutorSkeleton.ok),
    liveExecutorSkeletonDecision: liveExecutorSkeleton.decision || "DISABLED",
    liveExecutorSkeletonStatus: liveExecutorSkeleton.status || "OFF",
    liveExecutorSkeletonSeverity: liveExecutorSkeleton.severity || "off",
    liveExecutorReady: Boolean(liveExecutorSkeleton.executorReady),
    liveExecutorTokenAccepted: Boolean(liveExecutorSkeleton.controlledArmTokenAccepted),
    liveExecutorPlannedBatchCount: Number(liveExecutorSkeleton.plannedBatchCount || 0),
    liveExecutorPlannedPacketCount: Number(liveExecutorSkeleton.plannedPacketCount || 0),
    liveExecutorPlannedPayloadBytes: Number(liveExecutorSkeleton.plannedPayloadBytes || 0),
    liveExecutorPlannedTransports: liveExecutorSkeleton.plannedTransports || [],
    liveExecutorNullTransportTouched: Boolean(liveExecutorSkeleton.nullTransportTouched),
    liveExecutorMockExecuteCount: Number(liveExecutorSkeleton.mockExecuteCount || 0),
    liveExecutorSkeleton,
    liveExecutorSkeletonDigest: liveExecutorSkeleton.digest || "none",
    liveExecutorDiagnosticsEnabled: Boolean(liveExecutorDiagnosticsEnabled),
    liveExecutorDiagnosticsOk: Boolean(liveExecutorDiagnostics.ok),
    liveExecutorDiagnosticsDecision: liveExecutorDiagnostics.decision || "DISABLED",
    liveExecutorDiagnosticsStatus: liveExecutorDiagnostics.status || "OFF",
    liveExecutorDiagnosticsSeverity: liveExecutorDiagnostics.severity || "off",
    liveExecutorDiagnosticsContractReady: Boolean(liveExecutorDiagnostics.contractReady),
    liveExecutorDiagnosticsAllowedTransports: liveExecutorDiagnostics.allowedTransportKinds || [],
    liveExecutorDiagnosticsBlocked: liveExecutorDiagnostics.blocked || [],
    liveExecutorDiagnosticsWarnings: liveExecutorDiagnostics.warnings || [],
    liveExecutorDiagnostics,
    liveExecutorDiagnosticsDigest: liveExecutorDiagnostics.digest || "none",
    liveStateMachineEnabled: Boolean(liveStateMachineEnabled),
    liveStateMachineOk: Boolean(liveStateMachine.ok),
    liveStateMachineState: liveStateMachine.state || "locked",
    liveStateMachineDecision: liveStateMachine.decision || "DISABLED",
    liveStateMachineStatus: liveStateMachine.status || "OFF",
    liveStateMachineSeverity: liveStateMachine.severity || "off",
    liveStateCanArm: Boolean(liveStateMachine.canArm),
    liveStateIsArmed: Boolean(liveStateMachine.isArmed),
    liveStateCanExecute: Boolean(liveStateMachine.canExecute),
    liveStateWouldExecute: Boolean(liveStateMachine.wouldExecute),
    liveStateMachineBlocked: liveStateMachine.blocked || [],
    liveStateMachineWarnings: liveStateMachine.warnings || [],
    liveStateMachine,
    liveStateMachineDigest: liveStateMachine.digest || "none",
    safety: mockTransportEnabled
      ? "10Y mock transport records a fake write only; no serial/network/socket/write API is called"
      : (commitPlanReady
        ? "11V/11W commit plan, readiness gate, preflight, live mirror validation, controlled arm, executor skeleton, diagnostics contract, and runtime state machine expose null-execution evidence, but physical write remains blocked"
      : (networkGuardedAdapterEnabled
        ? "11U network guarded adapter builds a network write candidate, but physical network write remains blocked"
        : (serialGuardedAdapterEnabled
          ? "11U serial guarded adapter builds a serial write candidate, but physical serial write remains blocked"
        : (liveWriteRequested
          ? "11U live gate can request live mode, but executor is not implemented for physical write; physical write remains blocked"
          : "11U writer validates gates and reports would-write metrics; physical write remains blocked"))))
  });
}
