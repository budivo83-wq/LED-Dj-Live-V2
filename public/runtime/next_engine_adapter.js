import { freezeUniqueList } from "./list_utils.js";
import { getRuntimeFrameAuthority } from "./frame_authority.js";
import { loadCompiledMappingV2, loadMappingV2 } from "./mapping_v2_store.js";
import { createIdleNextOutputWriter, evaluateNextOutputWriterSkeleton, NEXT_OUTPUT_WRITER_VERSION } from "./next_output_writer.js";

const FEATURE_FLAGS_KEY = "led-engine-feature-flags-v1";
const FEATURE_FLAG_DEFAULTS = Object.freeze({
  useNewCentralState: false,
  useNewFramePipeline: false,
  nextEngineShadowMode: false,
  nextEngineMirrorMode: false,
  nextEngineBufferOwnershipProbe: false,
  nextEngineMappedSnapshotProbe: false,
  nextEngineDryPacketizerProbe: false,
  nextEnginePacketPlanCompareProbe: false,
  nextEngineManualArmGate: false,
  nextEngineManualArmedDryRun: false,
  nextEngineOutputHandoffProbe: false,
  nextEngineOutputWriteInterlock: false,
  nextEngineOutputWriterSkeleton: false,
  nextEngineMockOutputTransport: false,
  nextEngineLiveOutputWriteGate: false,
  nextEngineSerialGuardedAdapter: false,
  nextEngineNetworkGuardedAdapter: false,
  nextEngineLiveOutputCommitPlan: false,
  nextEngineTransportCapabilityRegistry: false,
  nextEngineMultiOutputRouter: false,
  nextEngineBatchExecutionScheduler: false,
  nextEngineExecutionCommitPreview: false,
  nextEngineExecutionAuditSnapshot: false,
  nextEngineExecutionAuditHistory: false,
  nextEngineExecutionAuditExport: false,
  nextEngineExecutionDebugPayload: false,
  nextEngineExecutionSanityMonitor: false,
  nextEngineExecutionHealthSummary: false,
  nextEngineExecutionHealthTrend: false,
  nextEngineExecutionReadinessGate: false,
  nextEngineLiveExecutorPreflight: false,
  nextEngineLiveFrameMirrorValidation: false,
  nextEngineLiveControlledArmPhase: false,
  nextEngineLiveExecutorSkeleton: false,
  nextEngineLiveExecutorDiagnostics: false,
  nextEngineLiveStateMachine: false,
  useNewFramePipelineShadow: false,
  useNewMapping: false,
  useNewOutput: false,
  useNewPreview: false,
  useNewEvents: false,
  useNewTelemetry: false
});

function readFeatureFlags(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem?.(FEATURE_FLAGS_KEY);
    if (!raw) return { ...FEATURE_FLAG_DEFAULTS };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return { ...FEATURE_FLAG_DEFAULTS };
    const next = { ...FEATURE_FLAG_DEFAULTS };
    for (const key of Object.keys(next)) {
      if (Object.prototype.hasOwnProperty.call(parsed, key)) {
        next[key] = Boolean(parsed[key]);
      }
    }
    return next;
  } catch {
    return { ...FEATURE_FLAG_DEFAULTS };
  }
}

export const NEXT_ENGINE_SHADOW_ADAPTER_VERSION = "10B-next-engine-shadow-adapter";
export const NEXT_ENGINE_MAPPING_PROBE_VERSION = "10E-next-mapping-probe";
export const NEXT_ENGINE_OUTPUT_ROUTE_PROBE_VERSION = "10F-next-output-route-probe";
export const NEXT_ENGINE_OUTPUT_ROUTE_COMPARE_VERSION = "10G-next-output-route-compare";
export const NEXT_ENGINE_ROUTE_WARNING_VERSION = "10H-route-mismatch-warning";
export const NEXT_ENGINE_PREFLIGHT_GATE_VERSION = "10I-next-engine-preflight-gate";
export const NEXT_ENGINE_ACTIVATION_SNAPSHOT_VERSION = "10J-next-engine-activation-snapshot";
export const NEXT_ENGINE_MIRROR_VERSION = "10K-next-engine-frame-mirror";
export const NEXT_ENGINE_BUFFER_OWNERSHIP_VERSION = "10L-next-engine-buffer-ownership-probe";
export const NEXT_ENGINE_MAPPED_SNAPSHOT_VERSION = "10M-next-engine-mapped-snapshot-probe";
export const NEXT_ENGINE_DRY_PACKETIZER_VERSION = "10N-next-engine-dry-packetizer-probe";
export const NEXT_ENGINE_PACKET_PLAN_COMPARE_VERSION = "10O-next-engine-packet-plan-compare";
export const NEXT_ENGINE_MANUAL_ARM_GATE_VERSION = "10P-next-engine-manual-arm-gate";
export const NEXT_ENGINE_MANUAL_ARMED_DRY_RUN_VERSION = "10Q-next-engine-manual-armed-dry-run";
export const NEXT_ENGINE_OUTPUT_HANDOFF_PROBE_VERSION = "10R-next-engine-output-handoff-probe";
export const NEXT_ENGINE_OUTPUT_WRITE_INTERLOCK_VERSION = "10S-next-engine-output-write-interlock";
export const NEXT_ENGINE_OUTPUT_WRITER_VERSION = NEXT_OUTPUT_WRITER_VERSION;
export const NEXT_ENGINE_SHADOW_CONSUMER = "next-engine-shadow-adapter";


function readControlledArmIntent(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem?.("led-engine-next-controlled-arm-v1");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function nowMs(performanceRef = globalThis.performance) {
  if (performanceRef && typeof performanceRef.now === "function") return performanceRef.now();
  return Date.now();
}

function cloneBytes(bytes) {
  return bytes instanceof Uint8Array ? new Uint8Array(bytes) : null;
}

export function checksumFrame(bytes) {
  if (!(bytes instanceof Uint8Array)) return 0;
  // Small deterministic checksum for debug/QA. It is intentionally cheap so it
  // can run during live preview without becoming another render workload.
  let hash = 2166136261 >>> 0;
  const len = bytes.byteLength;
  const stride = Math.max(1, Math.floor(len / 2048));
  for (let i = 0; i < len; i += stride) {
    hash ^= bytes[i];
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  hash ^= len & 0xff;
  hash = Math.imul(hash, 16777619) >>> 0;
  hash ^= (len >>> 8) & 0xff;
  return hash >>> 0;
}









function createIdleOutputWriteInterlock(reason = "idle") {
  return Object.freeze({
    version: NEXT_ENGINE_OUTPUT_WRITE_INTERLOCK_VERSION,
    enabled: false,
    ran: false,
    ok: false,
    decision: "LOCKED",
    writeAllowed: false,
    hardLocked: true,
    requiresHandoffReady: true,
    requiresManualArmedDryRun: true,
    requiresExplicitLiveFlag: true,
    explicitLiveFlagPresent: false,
    packetCount: 0,
    payloadBytes: 0,
    protocols: [],
    backendPlan: [],
    outputTouched: false,
    networkTouched: false,
    serialTouched: false,
    frameAuthorityTouched: false,
    reason,
    safety: "write interlock only; write is blocked unless a future explicit live flag exists and all gates pass"
  });
}

function readOutputWriteInterlockFlag(storage) {
  const flags = readFeatureFlags(storage);
  return Boolean(flags.nextEngineOutputWriteInterlock);
}

function runOutputWriteInterlockReadOnly({ storage, outputHandoffProbe, manualArmedDryRun }) {
  const enabled = readOutputWriteInterlockFlag(storage);
  if (!enabled) return createIdleOutputWriteInterlock("output_write_interlock_disabled");

  const handoffReady = Boolean(outputHandoffProbe?.ok && outputHandoffProbe?.handoffReady);
  const armedDryRunReady = Boolean(manualArmedDryRun?.ok && manualArmedDryRun?.decision === "ARMED_DRY_RUN");

  // Deliberately future-only: this flag is not part of this step's defaults, UI,
  // or QA enablement. That means 10S can prove the path reaches the final write
  // boundary while still forcing the write decision to remain LOCKED.
  const flags = readFeatureFlags(storage);
  const explicitLiveFlagPresent = Boolean(flags.nextEngineLiveOutputWrite === true);
  const writeAllowed = Boolean(handoffReady && armedDryRunReady && explicitLiveFlagPresent);

  return Object.freeze({
    version: NEXT_ENGINE_OUTPUT_WRITE_INTERLOCK_VERSION,
    enabled: true,
    ran: true,
    ok: handoffReady && armedDryRunReady,
    decision: writeAllowed ? "WRITE_ALLOWED_FUTURE" : "LOCKED",
    writeAllowed,
    hardLocked: !writeAllowed,
    requiresHandoffReady: true,
    requiresManualArmedDryRun: true,
    requiresExplicitLiveFlag: true,
    explicitLiveFlagPresent,
    packetCount: Number(outputHandoffProbe?.packetCount || manualArmedDryRun?.packetCount || 0),
    payloadBytes: Number(outputHandoffProbe?.payloadBytes || manualArmedDryRun?.payloadBytes || 0),
    protocols: Array.isArray(outputHandoffProbe?.protocols) ? outputHandoffProbe.protocols.map(String).slice(0, 12) : [],
    backendPlan: Array.isArray(outputHandoffProbe?.backendPlan) ? outputHandoffProbe.backendPlan.map(String).slice(0, 12) : [],
    outputTouched: false,
    networkTouched: false,
    serialTouched: false,
    frameAuthorityTouched: false,
    reason: writeAllowed ? "future_live_write_flag_present" : (!handoffReady ? "handoff_not_ready" : (!armedDryRunReady ? "manual_dry_run_not_ready" : "explicit_live_write_flag_missing")),
    safety: "10S write interlock stops before serial/network/frame-authority write; no transport open"
  });
}

function createIdleOutputHandoffProbe(reason = "idle") {
  return Object.freeze({
    version: NEXT_ENGINE_OUTPUT_HANDOFF_PROBE_VERSION,
    enabled: false,
    ran: false,
    ok: false,
    decision: "HOLD",
    handoffReady: false,
    armedDryRunRequired: true,
    liveOutputEnabled: false,
    transportOpenAllowed: false,
    packetCount: 0,
    payloadBytes: 0,
    protocols: [],
    backendPlan: [],
    outputTouched: false,
    networkTouched: false,
    serialTouched: false,
    frameAuthorityTouched: false,
    reason,
    safety: "output handoff probe only; no serial/network write and no transport open"
  });
}

function readOutputHandoffProbeFlag(storage) {
  const flags = readFeatureFlags(storage);
  return Boolean(flags.nextEngineOutputHandoffProbe);
}

function buildBackendPlanFromProtocols(protocols) {
  if (!Array.isArray(protocols)) return [];
  const seen = new Set();
  const plan = [];
  for (const item of protocols) {
    const raw = String(item || "");
    const key = raw.split(":")[0];
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const backend = key === "serial" ? "serial-adapter" : `${key}-network-adapter`;
    plan.push(`${key}->${backend}`);
  }
  return plan.slice(0, 12);
}

function runOutputHandoffProbeReadOnly({ storage, manualArmedDryRun, dryPacketizerProbe }) {
  const enabled = readOutputHandoffProbeFlag(storage);
  if (!enabled) return createIdleOutputHandoffProbe("output_handoff_probe_disabled");

  if (!manualArmedDryRun?.ok || manualArmedDryRun?.decision !== "ARMED_DRY_RUN") {
    return Object.freeze({
      ...createIdleOutputHandoffProbe("manual_armed_dry_run_not_ready"),
      enabled: true,
      ran: true,
      packetCount: Number(manualArmedDryRun?.packetCount || dryPacketizerProbe?.packetCount || 0),
      payloadBytes: Number(manualArmedDryRun?.payloadBytes || dryPacketizerProbe?.totalPayloadBytes || 0),
      protocols: Array.isArray(manualArmedDryRun?.protocols) ? manualArmedDryRun.protocols.map(String).slice(0, 12) : []
    });
  }

  const protocols = Array.isArray(manualArmedDryRun.protocols)
    ? manualArmedDryRun.protocols.map(String).slice(0, 12)
    : [];
  const backendPlan = buildBackendPlanFromProtocols(protocols);
  const packetCount = Number(manualArmedDryRun.packetCount || 0);
  const payloadBytes = Number(manualArmedDryRun.payloadBytes || 0);
  const handoffReady = packetCount > 0 && payloadBytes > 0 && backendPlan.length > 0;

  return Object.freeze({
    version: NEXT_ENGINE_OUTPUT_HANDOFF_PROBE_VERSION,
    enabled: true,
    ran: true,
    ok: handoffReady,
    decision: handoffReady ? "HANDOFF_READY_DRY" : "HOLD",
    handoffReady,
    armedDryRunRequired: true,
    liveOutputEnabled: false,
    transportOpenAllowed: false,
    packetCount,
    payloadBytes,
    protocols,
    backendPlan,
    outputTouched: false,
    networkTouched: false,
    serialTouched: false,
    frameAuthorityTouched: false,
    reason: handoffReady ? "handoff_plan_ready_dry" : "handoff_plan_empty",
    safety: "output handoff probe only; no serial/network write and no transport open"
  });
}

function createIdleManualArmedDryRun(reason = "idle") {
  return Object.freeze({
    version: NEXT_ENGINE_MANUAL_ARMED_DRY_RUN_VERSION,
    enabled: false,
    ran: false,
    ok: false,
    decision: "HOLD",
    armed: false,
    dryRun: true,
    discardOnly: true,
    manualOnly: true,
    requiresArmableGate: true,
    packetCount: 0,
    payloadBytes: 0,
    protocols: [],
    copiedPacketPlan: false,
    outputTouched: false,
    networkTouched: false,
    serialTouched: false,
    frameAuthorityTouched: false,
    reason,
    safety: "manual armed dry-run only; packet plan is copied then discarded; no output, no transport open"
  });
}

function readManualArmedDryRunFlag(storage) {
  const flags = readFeatureFlags(storage);
  return Boolean(flags.nextEngineManualArmedDryRun);
}

function runManualArmedDryRunReadOnly({ storage, manualArmGate, dryPacketizerProbe }) {
  const enabled = readManualArmedDryRunFlag(storage);
  if (!enabled) return createIdleManualArmedDryRun("manual_armed_dry_run_disabled");

  if (!manualArmGate?.armable || manualArmGate?.decision !== "ARMABLE") {
    return Object.freeze({
      ...createIdleManualArmedDryRun("manual_arm_gate_not_armable"),
      enabled: true,
      ran: true,
      decision: "HOLD"
    });
  }

  if (!dryPacketizerProbe?.ok || !dryPacketizerProbe?.ownsPacketPlan) {
    return Object.freeze({
      ...createIdleManualArmedDryRun("dry_packetizer_not_ready"),
      enabled: true,
      ran: true,
      decision: "HOLD"
    });
  }

  const protocols = Array.isArray(dryPacketizerProbe.protocols)
    ? dryPacketizerProbe.protocols.map(String).slice(0, 12)
    : [];
  const packetCount = Number(dryPacketizerProbe.packetCount || 0);
  const payloadBytes = Number(dryPacketizerProbe.totalPayloadBytes || 0);

  // Intentionally copy only the dry packet-plan metadata. No adapter, socket,
  // serial port, network transport, or frame-authority producer is touched here.
  const dryPlanCopy = Object.freeze({
    packetCount,
    payloadBytes,
    protocols
  });

  return Object.freeze({
    version: NEXT_ENGINE_MANUAL_ARMED_DRY_RUN_VERSION,
    enabled: true,
    ran: true,
    ok: true,
    decision: "ARMED_DRY_RUN",
    armed: true,
    dryRun: true,
    discardOnly: true,
    manualOnly: true,
    requiresArmableGate: true,
    packetCount: dryPlanCopy.packetCount,
    payloadBytes: dryPlanCopy.payloadBytes,
    protocols: dryPlanCopy.protocols,
    copiedPacketPlan: true,
    outputTouched: false,
    networkTouched: false,
    serialTouched: false,
    frameAuthorityTouched: false,
    reason: "armed_dry_run_discarded",
    safety: "manual armed dry-run only; packet plan is copied then discarded; no output, no transport open"
  });
}

function createIdleManualArmGate(reason = "idle") {
  return Object.freeze({
    version: NEXT_ENGINE_MANUAL_ARM_GATE_VERSION,
    enabled: false,
    ran: false,
    ok: false,
    decision: "HOLD",
    armable: false,
    armed: false,
    manualOnly: true,
    requiresUserAction: true,
    blockerCount: 0,
    warningCount: 0,
    blockers: [],
    warnings: [],
    packetPlanMatch: false,
    activationReady: false,
    dryPacketizerReady: false,
    mappedSnapshotReady: false,
    outputTouched: false,
    networkTouched: false,
    serialTouched: false,
    frameAuthorityTouched: false,
    suggestedAction: "keep next output path disarmed",
    reason,
    safety: "manual arm gate only; no output switch, no transport open"
  });
}

function readManualArmGateFlag(storage) {
  const flags = readFeatureFlags(storage);
  return Boolean(flags.nextEngineManualArmGate);
}

function evaluateManualArmGateReadOnly({ storage, activationSnapshot, packetPlanCompareProbe, dryPacketizerProbe, mappedSnapshotProbe }) {
  const enabled = readManualArmGateFlag(storage);
  if (!enabled) return createIdleManualArmGate("manual_arm_gate_disabled");
  const blockers = [];
  const warnings = [];
  const activationReady = Boolean(activationSnapshot?.canActivate && activationSnapshot?.decision === "READY_FOR_MANUAL_ARM");
  const packetPlanMatch = Boolean(packetPlanCompareProbe?.ok && packetPlanCompareProbe?.match);
  const dryPacketizerReady = Boolean(dryPacketizerProbe?.ok && dryPacketizerProbe?.ownsPacketPlan);
  const mappedSnapshotReady = Boolean(mappedSnapshotProbe?.ok && mappedSnapshotProbe?.ownsMappedBuffer);

  if (!activationReady) blockers.push("activation_snapshot_not_ready");
  if (!packetPlanMatch) blockers.push("packet_plan_not_matching");
  if (!dryPacketizerReady) blockers.push("dry_packetizer_not_ready");
  if (!mappedSnapshotReady) blockers.push("next_snapshot_not_ready");
  if (Number(packetPlanCompareProbe?.nextPacketCount || 0) <= 0) warnings.push("next_packet_plan_empty_or_preview_only");
  if (Array.isArray(packetPlanCompareProbe?.missingProtocols) && packetPlanCompareProbe.missingProtocols.length) blockers.push("missing_protocols_in_next_plan");
  if (Array.isArray(packetPlanCompareProbe?.extraProtocols) && packetPlanCompareProbe.extraProtocols.length) blockers.push("extra_protocols_in_next_plan");

  const armable = blockers.length === 0;
  return Object.freeze({
    version: NEXT_ENGINE_MANUAL_ARM_GATE_VERSION,
    enabled: true,
    ran: true,
    ok: armable,
    decision: armable ? "ARMABLE" : "HOLD",
    armable,
    armed: false,
    manualOnly: true,
    requiresUserAction: true,
    blockerCount: blockers.length,
    warningCount: warnings.length,
    blockers,
    warnings,
    packetPlanMatch,
    activationReady,
    dryPacketizerReady,
    mappedSnapshotReady,
    outputTouched: false,
    networkTouched: false,
    serialTouched: false,
    frameAuthorityTouched: false,
    suggestedAction: armable
      ? "manual operator may arm next output path in a later step; this gate still does not switch output"
      : "resolve blockers before adding any next-engine output switch",
    reason: armable ? "ready_for_manual_arm" : blockers[0] || "blocked",
    safety: "manual arm gate only; no output switch, no transport open"
  });
}

function createIdlePacketPlanCompareProbe(reason = "idle") {
  return Object.freeze({
    version: NEXT_ENGINE_PACKET_PLAN_COMPARE_VERSION,
    enabled: false,
    ran: false,
    ok: false,
    match: false,
    legacyPacketCount: 0,
    nextPacketCount: 0,
    legacyPayloadBytes: 0,
    nextPayloadBytes: 0,
    missingProtocols: [],
    extraProtocols: [],
    sharedProtocols: [],
    packetDelta: 0,
    payloadDelta: 0,
    outputTouched: false,
    networkTouched: false,
    serialTouched: false,
    frameAuthorityTouched: false,
    reason,
    safety: "read-only packet plan compare; no transport is opened"
  });
}

function readPacketPlanCompareFlag(storage) {
  const flags = readFeatureFlags(storage);
  return Boolean(flags.nextEnginePacketPlanCompareProbe);
}

function parseDryProtocolKeys(protocols) {
  if (!Array.isArray(protocols)) return [];
  return protocols
    .map((item) => String(item || "").split(":")[0])
    .filter(Boolean);
}

function inferLegacyPacketPlanReadOnly({ storage, dryPacketizerProbe }) {
  const outputRouteProbe = probeOutputRoutesReadOnly({ storage });
  const activeKeys = Array.isArray(outputRouteProbe.outputs)
    ? outputRouteProbe.outputs.map((item) => String(item || "").split(":")[0]).filter(Boolean)
    : [];
  const nextProtocols = parseDryProtocolKeys(dryPacketizerProbe?.protocols);
  const protocols = activeKeys.length ? activeKeys : nextProtocols;
  const packetCount = Number(dryPacketizerProbe?.packetCount || 0);
  const payloadBytes = Number(dryPacketizerProbe?.totalPayloadBytes || 0);
  return Object.freeze({
    packetCount,
    payloadBytes,
    protocols: protocols.slice(0, 12),
    reason: protocols.length ? "legacy_route_intent" : "legacy_no_active_output"
  });
}

function comparePacketPlansReadOnly({ storage, dryPacketizerProbe }) {
  const enabled = readPacketPlanCompareFlag(storage);
  if (!enabled) return createIdlePacketPlanCompareProbe("packet_plan_compare_disabled");
  try {
    if (!dryPacketizerProbe?.ran || !dryPacketizerProbe?.ok) {
      return Object.freeze({
        ...createIdlePacketPlanCompareProbe("dry_packetizer_not_ready"),
        enabled: true,
        ran: true,
        nextPacketCount: Number(dryPacketizerProbe?.packetCount || 0),
        nextPayloadBytes: Number(dryPacketizerProbe?.totalPayloadBytes || 0)
      });
    }
    const legacy = inferLegacyPacketPlanReadOnly({ storage, dryPacketizerProbe });
    const legacyProtocols = legacy.protocols;
    const nextProtocols = parseDryProtocolKeys(dryPacketizerProbe.protocols);
    const missingProtocols = legacyProtocols.filter((key) => !nextProtocols.includes(key));
    const extraProtocols = nextProtocols.filter((key) => !legacyProtocols.includes(key));
    const sharedProtocols = legacyProtocols.filter((key) => nextProtocols.includes(key));
    const legacyPacketCount = Number(legacy.packetCount || 0);
    const nextPacketCount = Number(dryPacketizerProbe.packetCount || 0);
    const legacyPayloadBytes = Number(legacy.payloadBytes || 0);
    const nextPayloadBytes = Number(dryPacketizerProbe.totalPayloadBytes || 0);
    const packetDelta = nextPacketCount - legacyPacketCount;
    const payloadDelta = nextPayloadBytes - legacyPayloadBytes;
    const match = missingProtocols.length === 0 && extraProtocols.length === 0 && packetDelta === 0 && payloadDelta === 0;
    return Object.freeze({
      version: NEXT_ENGINE_PACKET_PLAN_COMPARE_VERSION,
      enabled: true,
      ran: true,
      ok: match,
      match,
      legacyPacketCount,
      nextPacketCount,
      legacyPayloadBytes,
      nextPayloadBytes,
      missingProtocols,
      extraProtocols,
      sharedProtocols,
      packetDelta,
      payloadDelta,
      outputTouched: false,
      networkTouched: false,
      serialTouched: false,
      frameAuthorityTouched: false,
      reason: match ? "packet_plan_match" : "packet_plan_mismatch",
      safety: "read-only packet plan compare; no transport is opened"
    });
  } catch (error) {
    return Object.freeze({
      ...createIdlePacketPlanCompareProbe(String(error?.message || error)),
      enabled: true,
      ran: true,
      reason: String(error?.message || error)
    });
  }
}

function createIdleDryPacketizerProbe(reason = "idle") {
  return Object.freeze({
    version: NEXT_ENGINE_DRY_PACKETIZER_VERSION,
    enabled: false,
    ran: false,
    ok: false,
    ownsPacketPlan: false,
    outputTouched: false,
    networkTouched: false,
    serialTouched: false,
    frameAuthorityTouched: false,
    sourceFrameId: 0,
    mappedBytes: 0,
    packetCount: 0,
    serialPackets: 0,
    networkPackets: 0,
    totalPayloadBytes: 0,
    maxPacketBytes: 0,
    routeCount: 0,
    activeRouteCount: 0,
    protocols: [],
    buildMs: 0,
    totalMs: 0,
    reason,
    safety: "dry packetizer only; packet plan is discarded before transport"
  });
}

function readDryPacketizerFlag(storage) {
  const flags = readFeatureFlags(storage);
  return Boolean(flags.nextEngineDryPacketizerProbe);
}

function protocolPacketSize(protocol) {
  if (protocol === "artnet" || protocol === "sacn" || protocol === "dmx") return 510;
  if (protocol === "blx") return 512;
  return 4096;
}

function buildDryPacketPlan({ compiled, mappedSnapshotProbe, performanceRef }) {
  const startedAt = nowMs(performanceRef);
  const routes = compiled?.routes && typeof compiled.routes === "object" ? compiled.routes : {};
  const protocols = [];
  let packetCount = 0;
  let serialPackets = 0;
  let networkPackets = 0;
  let totalPayloadBytes = 0;
  let maxPacketBytes = 0;
  let activeRouteCount = 0;

  const buildStart = nowMs(performanceRef);
  for (const [key, segments] of Object.entries(routes)) {
    if (key === "none" || !Array.isArray(segments)) continue;
    const enabledSegments = segments.filter((segment) => segment?.enabled !== false);
    if (!enabledSegments.length) continue;
    activeRouteCount += 1;
    let routeBytes = 0;
    for (const segment of enabledSegments) {
      const pixels = Number(segment?.pixelCount || segment?.physical?.pixelCount || segment?.physical?.length || segment?.virtual?.length || 0);
      routeBytes += Math.max(0, pixels * 3);
    }
    const maxPayload = protocolPacketSize(key);
    const routePackets = Math.max(1, Math.ceil(routeBytes / maxPayload));
    packetCount += routePackets;
    totalPayloadBytes += routeBytes;
    maxPacketBytes = Math.max(maxPacketBytes, Math.min(maxPayload, Math.max(0, routeBytes)));
    if (key === "serial") serialPackets += routePackets;
    else networkPackets += routePackets;
    protocols.push(`${key}:${routePackets}/${routeBytes}`);
  }
  const buildMs = Math.max(0, nowMs(performanceRef) - buildStart);
  const mappedBytes = Number(mappedSnapshotProbe?.mappedBytes || 0);
  const ok = Boolean(compiled?.ok) && Boolean(mappedSnapshotProbe?.ok) && packetCount >= 0 && totalPayloadBytes <= Math.max(mappedBytes, totalPayloadBytes);
  return Object.freeze({
    version: NEXT_ENGINE_DRY_PACKETIZER_VERSION,
    enabled: true,
    ran: true,
    ok,
    ownsPacketPlan: true,
    outputTouched: false,
    networkTouched: false,
    serialTouched: false,
    frameAuthorityTouched: false,
    sourceFrameId: Number(mappedSnapshotProbe?.sourceFrameId || 0),
    mappedBytes,
    packetCount,
    serialPackets,
    networkPackets,
    totalPayloadBytes,
    maxPacketBytes,
    routeCount: Object.keys(routes).length,
    activeRouteCount,
    protocols: protocols.slice(0, 12),
    buildMs: Number(buildMs.toFixed(3)),
    totalMs: Number(Math.max(0, nowMs(performanceRef) - startedAt).toFixed(3)),
    reason: ok ? (packetCount ? "packet_plan_ready" : "no_active_output_packets") : "packet_plan_blocked",
    safety: "dry packetizer only; packet plan is discarded before transport"
  });
}

function runDryPacketizerProbeReadOnly({ storage, mappedSnapshotProbe, performanceRef }) {
  const enabled = readDryPacketizerFlag(storage);
  if (!enabled) return createIdleDryPacketizerProbe("dry_packetizer_disabled");
  try {
    if (!mappedSnapshotProbe?.ran || !mappedSnapshotProbe?.ok) {
      return Object.freeze({
        ...createIdleDryPacketizerProbe("mapped_snapshot_not_ready"),
        enabled: true,
        ran: true,
        sourceFrameId: Number(mappedSnapshotProbe?.sourceFrameId || 0),
        mappedBytes: Number(mappedSnapshotProbe?.mappedBytes || 0)
      });
    }
    const compiled = loadCompiledMappingV2(storage);
    return buildDryPacketPlan({ compiled, mappedSnapshotProbe, performanceRef });
  } catch (error) {
    return Object.freeze({
      ...createIdleDryPacketizerProbe(String(error?.message || error)),
      enabled: true,
      ran: true,
      reason: String(error?.message || error)
    });
  }
}


function createIdleMappedSnapshotProbe(reason = "idle") {
  return Object.freeze({
    version: NEXT_ENGINE_MAPPED_SNAPSHOT_VERSION,
    enabled: false,
    ran: false,
    ok: false,
    ownsMappedBuffer: false,
    outputTouched: false,
    frameAuthorityTouched: false,
    sourceFrameId: 0,
    sourceBytes: 0,
    mappedBytes: 0,
    mappedChecksum: 0,
    mappedCapacity: 0,
    routeCount: 0,
    activeRouteCount: 0,
    allocateCount: 0,
    reuseCount: 0,
    mapCopyMs: 0,
    totalMs: 0,
    reason,
    safety: "owned mapped snapshot only; discard before output"
  });
}

function readMappedSnapshotFlag(storage) {
  const flags = readFeatureFlags(storage);
  return Boolean(flags.nextEngineMappedSnapshotProbe);
}

function estimateMappedBytesFromRoutes(compiled) {
  const routes = compiled?.routes && typeof compiled.routes === "object" ? compiled.routes : {};
  let activeRouteCount = 0;
  let mappedBytes = 0;
  for (const [key, segments] of Object.entries(routes)) {
    if (key === "none" || !Array.isArray(segments)) continue;
    const enabledSegments = segments.filter((segment) => segment?.enabled !== false);
    if (!enabledSegments.length) continue;
    activeRouteCount += 1;
    for (const segment of enabledSegments) {
      const pixels = Number(segment?.pixelCount || segment?.physical?.pixelCount || segment?.physical?.length || segment?.virtual?.length || 0);
      mappedBytes += Math.max(0, pixels * 3);
    }
  }
  return { routeCount: Object.keys(routes).length, activeRouteCount, mappedBytes };
}

function runMappedSnapshotProbeReadOnly({ storage, framePacket, performanceRef, mappedState }) {
  const enabled = readMappedSnapshotFlag(storage);
  if (!enabled) return createIdleMappedSnapshotProbe("mapped_snapshot_disabled");
  const startedAt = nowMs(performanceRef);
  try {
    if (!framePacket || !(framePacket.frame instanceof Uint8Array)) {
      return Object.freeze({ ...createIdleMappedSnapshotProbe("no_authoritative_frame"), enabled: true, ran: true });
    }
    const source = framePacket.frame;
    const sourceBytes = Number(source.byteLength || 0);
    const compiled = loadCompiledMappingV2(storage);
    const estimate = estimateMappedBytesFromRoutes(compiled);
    const mappedBytes = Math.max(0, Number(estimate.mappedBytes || 0));
    const targetBytes = Math.max(sourceBytes, mappedBytes);
    const needsAllocate = !(mappedState.buffer instanceof Uint8Array) || mappedState.buffer.byteLength < targetBytes;
    if (needsAllocate) {
      mappedState.buffer = new Uint8Array(targetBytes);
      mappedState.allocateCount = Number(mappedState.allocateCount || 0) + 1;
    } else {
      mappedState.reuseCount = Number(mappedState.reuseCount || 0) + 1;
    }

    const copyStart = nowMs(performanceRef);
    const mappedView = mappedState.buffer.subarray(0, targetBytes);
    mappedView.fill(0);
    mappedView.set(source.subarray(0, Math.min(sourceBytes, targetBytes)), 0);
    const mapCopyMs = Math.max(0, nowMs(performanceRef) - copyStart);
    const mappedChecksum = checksumFrame(mappedView);
    const ok = Boolean(compiled?.ok) && targetBytes > 0 && mappedChecksum !== 0;
    return Object.freeze({
      version: NEXT_ENGINE_MAPPED_SNAPSHOT_VERSION,
      enabled: true,
      ran: true,
      ok,
      ownsMappedBuffer: mappedState.buffer instanceof Uint8Array,
      outputTouched: false,
      frameAuthorityTouched: false,
      sourceFrameId: Number(framePacket.frameId || 0),
      sourceBytes,
      mappedBytes: targetBytes,
      mappedChecksum,
      mappedCapacity: Number(mappedState.buffer?.byteLength || 0),
      routeCount: Number(estimate.routeCount || 0),
      activeRouteCount: Number(estimate.activeRouteCount || 0),
      allocateCount: Number(mappedState.allocateCount || 0),
      reuseCount: Number(mappedState.reuseCount || 0),
      mapCopyMs: Number(mapCopyMs.toFixed(3)),
      totalMs: Number(Math.max(0, nowMs(performanceRef) - startedAt).toFixed(3)),
      reason: ok ? (needsAllocate ? "allocated_mapped_snapshot" : "reused_mapped_snapshot") : (compiled?.ok ? "empty_mapped_snapshot" : "mapping_invalid"),
      safety: "owned mapped snapshot only; discard before output"
    });
  } catch (error) {
    return Object.freeze({
      ...createIdleMappedSnapshotProbe(String(error?.message || error)),
      enabled: true,
      ran: true,
      reason: String(error?.message || error)
    });
  }
}


function createIdleBufferOwnershipProbe(reason = "idle") {
  return Object.freeze({
    version: NEXT_ENGINE_BUFFER_OWNERSHIP_VERSION,
    enabled: false,
    ran: false,
    ok: false,
    ownsScratchBuffer: false,
    borrowedAuthoritative: false,
    authoritativeMutated: false,
    sourceFrameId: 0,
    sourceBytes: 0,
    ownedBytes: 0,
    ownedChecksum: 0,
    sourceChecksumBefore: 0,
    sourceChecksumAfter: 0,
    reuseCount: 0,
    allocateCount: 0,
    bufferCapacity: 0,
    copyMs: 0,
    totalMs: 0,
    reason,
    safety: "owned scratch buffer only; output and frame authority stay unchanged"
  });
}

function readBufferOwnershipFlag(storage) {
  const flags = readFeatureFlags(storage);
  return Boolean(flags.nextEngineBufferOwnershipProbe);
}

function runBufferOwnershipProbeReadOnly({ storage, framePacket, performanceRef, ownedState }) {
  const enabled = readBufferOwnershipFlag(storage);
  if (!enabled) return createIdleBufferOwnershipProbe("buffer_ownership_disabled");
  const startedAt = nowMs(performanceRef);
  try {
    if (!framePacket || !(framePacket.frame instanceof Uint8Array)) {
      return Object.freeze({ ...createIdleBufferOwnershipProbe("no_authoritative_frame"), enabled: true, ran: true });
    }
    const source = framePacket.frame;
    const sourceBytes = Number(source.byteLength || 0);
    const before = checksumFrame(source);
    const needsAllocate = !(ownedState.buffer instanceof Uint8Array) || ownedState.buffer.byteLength < sourceBytes;
    if (needsAllocate) {
      ownedState.buffer = new Uint8Array(sourceBytes);
      ownedState.allocateCount = Number(ownedState.allocateCount || 0) + 1;
    } else {
      ownedState.reuseCount = Number(ownedState.reuseCount || 0) + 1;
    }
    const copyStart = nowMs(performanceRef);
    ownedState.buffer.set(source.subarray(0, sourceBytes), 0);
    const ownedView = ownedState.buffer.subarray(0, sourceBytes);
    const copyMs = Math.max(0, nowMs(performanceRef) - copyStart);
    const ownedChecksum = checksumFrame(ownedView);
    const after = checksumFrame(source);
    const authoritativeMutated = before !== after;
    const ok = sourceBytes > 0 && before === ownedChecksum && !authoritativeMutated;
    return Object.freeze({
      version: NEXT_ENGINE_BUFFER_OWNERSHIP_VERSION,
      enabled: true,
      ran: true,
      ok,
      ownsScratchBuffer: ownedState.buffer instanceof Uint8Array,
      borrowedAuthoritative: false,
      authoritativeMutated,
      sourceFrameId: Number(framePacket.frameId || 0),
      sourceBytes,
      ownedBytes: Number(ownedView.byteLength || 0),
      ownedChecksum,
      sourceChecksumBefore: before,
      sourceChecksumAfter: after,
      reuseCount: Number(ownedState.reuseCount || 0),
      allocateCount: Number(ownedState.allocateCount || 0),
      bufferCapacity: Number(ownedState.buffer?.byteLength || 0),
      copyMs: Number(copyMs.toFixed(3)),
      totalMs: Number(Math.max(0, nowMs(performanceRef) - startedAt).toFixed(3)),
      reason: ok ? (needsAllocate ? "allocated_owned_buffer" : "reused_owned_buffer") : "buffer_integrity_failed",
      safety: "owned scratch buffer only; output and frame authority stay unchanged"
    });
  } catch (error) {
    return Object.freeze({
      ...createIdleBufferOwnershipProbe(String(error?.message || error)),
      enabled: true,
      ran: true,
      reason: String(error?.message || error)
    });
  }
}

function createIdleMirrorProbe(reason = "idle") {
  return Object.freeze({
    version: NEXT_ENGINE_MIRROR_VERSION,
    enabled: false,
    ran: false,
    ok: false,
    integrity: false,
    frameId: 0,
    source: "none",
    width: 0,
    height: 0,
    byteLength: 0,
    checksum: 0,
    cloneChecksum: 0,
    mappedBytes: 0,
    routeCount: 0,
    activeRouteCount: 0,
    consumeMs: 0,
    mappingMs: 0,
    totalMs: 0,
    reason,
    safety: "read-only mirror; mapped result is discarded"
  });
}

function readMirrorFlag(storage) {
  const flags = readFeatureFlags(storage);
  return Boolean(flags.nextEngineMirrorMode);
}

function runFrameMirrorReadOnly({ storage, framePacket, performanceRef }) {
  const enabled = readMirrorFlag(storage);
  if (!enabled) return createIdleMirrorProbe("mirror_disabled");
  const startedAt = nowMs(performanceRef);
  try {
    if (!framePacket || !(framePacket.frame instanceof Uint8Array)) {
      return Object.freeze({ ...createIdleMirrorProbe("no_authoritative_frame"), enabled: true, ran: true });
    }
    const c0 = nowMs(performanceRef);
    const mirroredFrame = cloneBytes(framePacket.frame);
    const consumeMs = Math.max(0, nowMs(performanceRef) - c0);
    const checksum = checksumFrame(framePacket.frame);
    const cloneChecksum = checksumFrame(mirroredFrame);

    const m0 = nowMs(performanceRef);
    const compiled = loadCompiledMappingV2(storage);
    const activeRoutes = Object.entries(compiled?.routes || {}).filter(([key, segments]) => key !== "none" && Array.isArray(segments) && segments.some((segment) => segment?.enabled !== false));
    const mappedBytes = activeRoutes.reduce((sum, [, segments]) => {
      return sum + segments.reduce((routeSum, segment) => {
        if (segment?.enabled === false) return routeSum;
        const physicalLength = Number(segment?.pixelCount || segment?.physical?.pixelCount || segment?.physical?.length || segment?.virtual?.length || 0);
        return routeSum + Math.max(0, physicalLength * 3);
      }, 0);
    }, 0);
    const mappingMs = Math.max(0, nowMs(performanceRef) - m0);
    const totalMs = Math.max(0, nowMs(performanceRef) - startedAt);
    const integrity = checksum !== 0 && checksum === cloneChecksum && mirroredFrame?.byteLength === framePacket.frame.byteLength;
    return Object.freeze({
      version: NEXT_ENGINE_MIRROR_VERSION,
      enabled: true,
      ran: true,
      ok: Boolean(compiled?.ok) && integrity,
      integrity,
      frameId: Number(framePacket.frameId || 0),
      source: String(framePacket.source || "unknown"),
      width: Number(framePacket.width || 0),
      height: Number(framePacket.height || 0),
      byteLength: Number(framePacket.frame.byteLength || 0),
      checksum,
      cloneChecksum,
      mappedBytes,
      routeCount: Object.keys(compiled?.routes || {}).length,
      activeRouteCount: activeRoutes.length,
      consumeMs: Number(consumeMs.toFixed(3)),
      mappingMs: Number(mappingMs.toFixed(3)),
      totalMs: Number(totalMs.toFixed(3)),
      reason: integrity ? "ok" : "frame_integrity_failed",
      safety: "read-only mirror; mapped result is discarded"
    });
  } catch (error) {
    return Object.freeze({
      ...createIdleMirrorProbe(String(error?.message || error)),
      enabled: true,
      ran: true,
      reason: String(error?.message || error)
    });
  }
}

function createIdleActivationSnapshot(reason = "idle") {
  return Object.freeze({
    version: NEXT_ENGINE_ACTIVATION_SNAPSHOT_VERSION,
    enabled: false,
    ran: false,
    decision: "HOLD",
    canActivate: false,
    confidence: "none",
    blockerCount: 0,
    warningCount: 0,
    blockers: [],
    warnings: [],
    reason,
    nextStep: "keep next engine in shadow mode",
    safety: "read-only; no runtime output switch is performed"
  });
}

function createActivationSnapshotFromPreflight({ preflightGate, outputRouteCompare, mappingProbe, outputRouteProbe } = {}) {
  if (!preflightGate?.ran) return createIdleActivationSnapshot("preflight_idle");
  const blockers = Array.isArray(preflightGate.blockers) ? preflightGate.blockers.map(String).slice(0, 12) : [];
  const warnings = Array.isArray(preflightGate.warnings) ? preflightGate.warnings.map(String).slice(0, 12) : [];
  const canActivate = Boolean(preflightGate.ready) && blockers.length === 0;
  const routeMatch = Boolean(outputRouteCompare?.match || !outputRouteCompare?.legacyActiveOutputs?.length);
  const mappingOk = Boolean(mappingProbe?.ok && mappingProbe?.compatible);
  const outputOk = Boolean(outputRouteProbe?.ok);
  let confidence = "low";
  if (canActivate && routeMatch && mappingOk && outputOk && warnings.length === 0) confidence = "high";
  else if (canActivate) confidence = "medium";
  const decision = canActivate ? "READY_FOR_MANUAL_ARM" : "HOLD";
  return Object.freeze({
    version: NEXT_ENGINE_ACTIVATION_SNAPSHOT_VERSION,
    enabled: Boolean(preflightGate.enabled),
    ran: true,
    decision,
    canActivate,
    confidence,
    blockerCount: blockers.length,
    warningCount: warnings.length,
    blockers,
    warnings,
    reason: String(preflightGate.reason || (canActivate ? "preflight_ready" : "blocked")),
    nextStep: canActivate
      ? "manual-only next step: add an explicit arming flag; do not auto-switch output"
      : `resolve ${blockers[0] || preflightGate.reason || "preflight_blocker"} before adding any arming path`,
    safety: "read-only; no runtime output switch is performed"
  });
}

function createIdlePreflightGate(reason = "idle") {
  return Object.freeze({
    version: NEXT_ENGINE_PREFLIGHT_GATE_VERSION,
    enabled: false,
    ran: false,
    ready: false,
    status: "IDLE",
    level: "info",
    blockers: [],
    warnings: [],
    reason,
    suggestedAction: "keep shadow mode enabled and wait for a valid authoritative frame"
  });
}

function evaluateNextEnginePreflightGate({ enabled, authoritative, legacyChecksum, nextChecksum, mappingProbe, outputRouteProbe, outputRouteCompare, errorCount = 0 } = {}) {
  if (!enabled) return createIdlePreflightGate("shadow_disabled");

  const blockers = [];
  const warnings = [];
  const frameBytes = Number(authoritative?.frame?.byteLength || 0);
  const frameId = Number(authoritative?.frameId || 0);

  if (!authoritative || !(authoritative.frame instanceof Uint8Array)) blockers.push("no_authoritative_frame");
  if (frameBytes <= 0) blockers.push("empty_frame");
  if (frameId <= 0) warnings.push("frame_id_missing");
  if (!legacyChecksum || !nextChecksum) blockers.push("checksum_missing");
  if (legacyChecksum && nextChecksum && legacyChecksum !== nextChecksum) blockers.push("checksum_mismatch");
  if (!mappingProbe?.ran) blockers.push("mapping_probe_idle");
  if (mappingProbe?.ran && !mappingProbe?.ok) blockers.push("mapping_invalid");
  if (mappingProbe?.ran && !mappingProbe?.compatible) blockers.push("mapping_frame_size_probe");
  if (Number(mappingProbe?.errors || 0) > 0) blockers.push("mapping_errors");
  if (Number(mappingProbe?.warnings || 0) > 0) warnings.push("mapping_warnings");
  if (!outputRouteProbe?.ran) blockers.push("output_route_probe_idle");
  if (outputRouteProbe?.ran && !outputRouteProbe?.ok) blockers.push("output_route_invalid");
  if (Array.isArray(outputRouteProbe?.unsupportedRoutes) && outputRouteProbe.unsupportedRoutes.length) blockers.push("unsupported_output_routes");
  if (!outputRouteCompare?.ran) blockers.push("output_route_compare_idle");
  if (outputRouteCompare?.ran && !outputRouteCompare?.ok) blockers.push("output_route_mismatch");
  if (String(outputRouteCompare?.warningLevel || "none") !== "none") warnings.push(`route_${String(outputRouteCompare.warningLevel)}`);
  if (Number(errorCount || 0) > 0) warnings.push("adapter_previous_errors");

  const ready = blockers.length === 0;
  return Object.freeze({
    version: NEXT_ENGINE_PREFLIGHT_GATE_VERSION,
    enabled: true,
    ran: true,
    ready,
    status: ready ? "READY" : "BLOCKED",
    level: ready ? (warnings.length ? "warn" : "ok") : "bad",
    blockers: blockers.slice(0, 12),
    warnings: warnings.slice(0, 12),
    reason: ready ? "preflight_ready" : blockers[0],
    suggestedAction: ready
      ? "safe to continue with the next read-only migration step; do not switch output automatically"
      : `fix ${blockers[0]} before enabling any next-engine output path`
  });
}

function createIdleOutputRouteCompare() {
  return Object.freeze({
    version: NEXT_ENGINE_OUTPUT_ROUTE_COMPARE_VERSION,
    enabled: false,
    ran: false,
    ok: false,
    match: false,
    legacyMode: "none",
    legacyActiveOutputs: [],
    nextActiveOutputs: [],
    missingInNext: [],
    extraInNext: [],
    sharedOutputs: [],
    legacySerialEnabled: false,
    legacyBlxEnabled: false,
    legacyBlxTransport: "serial",
    warningLevel: "none",
    warning: "none",
    suggestedFix: "none",
    suggestion: "none",
    reason: "idle"
  });
}

function buildOutputRouteWarning({ missingInNext = [], extraInNext = [], legacyActive = [], nextActive = [], legacyMode = "none", hasLegacyOutput = false } = {}) {
  if (!hasLegacyOutput) {
    return Object.freeze({
      version: NEXT_ENGINE_ROUTE_WARNING_VERSION,
      warningLevel: "info",
      warning: "legacy output is off; next route probe stays read-only",
      suggestedFix: "none",
      suggestion: "No action needed. Keep using shadow mode until you intentionally enable an output."
    });
  }
  if (!missingInNext.length && !extraInNext.length) {
    return Object.freeze({
      version: NEXT_ENGINE_ROUTE_WARNING_VERSION,
      warningLevel: "none",
      warning: "none",
      suggestedFix: "none",
      suggestion: "Routes match. Do not change anything automatically."
    });
  }
  const missing = missingInNext.join(",") || "none";
  const extra = extraInNext.join(",") || "none";
  const legacy = legacyActive.join(",") || "none";
  const next = nextActive.join(",") || "none";
  let suggestedFix = "open Mapping V2 and align segment physical.output with legacy output settings";
  if (missingInNext.includes("serial")) suggestedFix = "assign the intended segments to physical.output=serial in Mapping V2, or disable legacy serial before switching";
  if (missingInNext.includes("blx")) suggestedFix = "assign the intended segments to physical.output=blx in Mapping V2, or disable legacy BLX before switching";
  if (extraInNext.length && !missingInNext.length) suggestedFix = "remove extra Mapping V2 output routes or enable the matching legacy output before migration";
  return Object.freeze({
    version: NEXT_ENGINE_ROUTE_WARNING_VERSION,
    warningLevel: "warn",
    warning: `route mismatch: legacy=${legacyMode}:${legacy} next=${next} missing=${missing} extra=${extra}`,
    suggestedFix,
    suggestion: `${suggestedFix}. This is read-only diagnostics; no setting was changed automatically.`
  });
}

function readJsonStorage(storage, key) {
  try {
    const raw = storage?.getItem?.(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function uniqSorted(values) {
  return Object.freeze([...freezeUniqueList(values.map((value) => String(value || "none")).filter(Boolean))].sort());
}

function inferLegacyActiveOutputs({ storage, nextProbe }) {
  const settings = readJsonStorage(storage, "led-engine-settings-v1") || {};
  const serial = readJsonStorage(storage, "led-engine-serial-v1") || {};
  const serialEnabled = serial.enabled === true || serial.enabled === "true";
  const blxEnabled = settings.blxEnabled === true || settings.blxEnabled === "true";
  const blxTransport = settings.blxTransport === "net" ? "net" : "serial";
  const outputMode = String(settings.outputMode || "preview");
  const active = [];

  if (serialEnabled) active.push("serial");
  if (blxEnabled) active.push("blx");
  if (["artnet", "sacn", "dmx"].includes(outputMode)) active.push(outputMode);

  // In the current legacy runtime, BLX overrides outputMode when enabled and
  // legacy serial can coexist as the serial pipeline. The route probe is still
  // read-only; this only describes the old runtime's intended output families.
  const legacyMode = blxEnabled ? (blxTransport === "net" ? "blx_net" : "blx_serial") : outputMode;
  const nextActive = Array.isArray(nextProbe?.outputs)
    ? nextProbe.outputs.map((item) => String(item).split(":")[0]).filter((key) => key && key !== "none")
    : [];

  return Object.freeze({
    mode: legacyMode,
    activeOutputs: uniqSorted(active),
    nextActiveOutputs: uniqSorted(nextActive),
    serialEnabled,
    blxEnabled,
    blxTransport
  });
}

function compareOutputRoutesReadOnly({ storage, outputRouteProbe }) {
  try {
    const legacy = inferLegacyActiveOutputs({ storage, nextProbe: outputRouteProbe });
    const legacyActive = legacy.activeOutputs;
    const nextActive = legacy.nextActiveOutputs;
    const missingInNext = legacyActive.filter((key) => !nextActive.includes(key));
    const extraInNext = nextActive.filter((key) => !legacyActive.includes(key));
    const sharedOutputs = legacyActive.filter((key) => nextActive.includes(key));
    const hasLegacyOutput = legacyActive.length > 0;
    const match = missingInNext.length === 0 && extraInNext.length === 0;
    const ok = Boolean(outputRouteProbe?.ok) && (match || !hasLegacyOutput);
    const warningInfo = buildOutputRouteWarning({
      missingInNext,
      extraInNext,
      legacyActive,
      nextActive,
      legacyMode: legacy.mode,
      hasLegacyOutput
    });
    return Object.freeze({
      version: NEXT_ENGINE_OUTPUT_ROUTE_COMPARE_VERSION,
      enabled: true,
      ran: true,
      ok,
      match,
      legacyMode: legacy.mode,
      legacyActiveOutputs: legacyActive,
      nextActiveOutputs: nextActive,
      missingInNext,
      extraInNext,
      sharedOutputs,
      legacySerialEnabled: legacy.serialEnabled,
      legacyBlxEnabled: legacy.blxEnabled,
      legacyBlxTransport: legacy.blxTransport,
      warningVersion: warningInfo.version,
      warningLevel: warningInfo.warningLevel,
      warning: warningInfo.warning,
      suggestedFix: warningInfo.suggestedFix,
      suggestion: warningInfo.suggestion,
      reason: match ? "match" : (hasLegacyOutput ? "route_mismatch" : "legacy_output_off")
    });
  } catch (error) {
    return Object.freeze({
      ...createIdleOutputRouteCompare(),
      enabled: true,
      ran: true,
      reason: String(error?.message || error)
    });
  }
}

function createIdleOutputRouteProbe() {
  return Object.freeze({
    version: NEXT_ENGINE_OUTPUT_ROUTE_PROBE_VERSION,
    enabled: false,
    ran: false,
    ok: false,
    routeCount: 0,
    activeRouteCount: 0,
    totalSegments: 0,
    enabledSegments: 0,
    totalPixels: 0,
    estimatedBytes: 0,
    outputs: [],
    serialSegments: 0,
    networkSegments: 0,
    noneSegments: 0,
    unsupportedRoutes: [],
    maxUniverse: 0,
    errors: 0,
    warnings: 0,
    reason: "idle"
  });
}

function probeOutputRoutesReadOnly({ storage }) {
  try {
    const compiled = loadCompiledMappingV2(storage);
    const validation = compiled?.validation || {};
    const routes = compiled?.routes && typeof compiled.routes === "object" ? compiled.routes : {};
    const outputEntries = Object.entries(routes).map(([key, list]) => {
      const segments = Array.isArray(list) ? list : [];
      const enabledSegments = segments.filter((segment) => segment?.enabled !== false);
      const pixels = enabledSegments.reduce((sum, segment) => sum + Math.max(0, Number(segment?.pixelCount || 0)), 0);
      const maxUniverse = enabledSegments.reduce((max, segment) => Math.max(max, Number(segment?.universe || 0)), 0);
      return Object.freeze({
        key: String(key || "none"),
        segments: segments.length,
        enabledSegments: enabledSegments.length,
        pixels,
        estimatedBytes: pixels * 3,
        maxUniverse
      });
    });
    const activeOutputs = outputEntries.filter((entry) => entry.key !== "none" && entry.enabledSegments > 0);
    const unsupportedRoutes = activeOutputs
      .map((entry) => entry.key)
      .filter((key) => !["serial", "blx", "artnet", "sacn", "dmx"].includes(key));
    const totalPixels = activeOutputs.reduce((sum, entry) => sum + entry.pixels, 0);
    const maxUniverse = activeOutputs.reduce((max, entry) => Math.max(max, entry.maxUniverse), 0);
    const errors = Array.isArray(validation.errors) ? validation.errors.length : 0;
    const warnings = Array.isArray(validation.warnings) ? validation.warnings.length : 0;
    const ok = Boolean(compiled?.ok) && unsupportedRoutes.length === 0;
    return Object.freeze({
      version: NEXT_ENGINE_OUTPUT_ROUTE_PROBE_VERSION,
      enabled: true,
      ran: true,
      ok,
      routeCount: outputEntries.length,
      activeRouteCount: activeOutputs.length,
      totalSegments: Number(compiled?.summary?.segments || 0),
      enabledSegments: Number(compiled?.summary?.enabled || 0),
      totalPixels,
      estimatedBytes: totalPixels * 3,
      outputs: activeOutputs.map((entry) => `${entry.key}:${entry.enabledSegments}/${entry.pixels}`).slice(0, 12),
      serialSegments: activeOutputs.filter((entry) => entry.key === "serial").reduce((sum, entry) => sum + entry.enabledSegments, 0),
      networkSegments: activeOutputs.filter((entry) => ["blx", "artnet", "sacn", "dmx"].includes(entry.key)).reduce((sum, entry) => sum + entry.enabledSegments, 0),
      noneSegments: outputEntries.filter((entry) => entry.key === "none").reduce((sum, entry) => sum + entry.enabledSegments, 0),
      unsupportedRoutes,
      maxUniverse,
      errors,
      warnings,
      reason: ok ? (activeOutputs.length ? "ok" : "no_active_output") : (unsupportedRoutes.length ? "unsupported_route" : "mapping_invalid")
    });
  } catch (error) {
    return Object.freeze({
      ...createIdleOutputRouteProbe(),
      enabled: true,
      ran: true,
      reason: String(error?.message || error)
    });
  }
}

function createIdleMappingProbe() {
  return Object.freeze({
    version: NEXT_ENGINE_MAPPING_PROBE_VERSION,
    enabled: false,
    ran: false,
    ok: false,
    compatible: false,
    segments: 0,
    enabledSegments: 0,
    physicalPixels: 0,
    virtualWidth: 0,
    virtualHeight: 0,
    expectedFrameBytes: 0,
    actualFrameBytes: 0,
    routeKeys: [],
    errors: 0,
    warnings: 0,
    reason: "idle"
  });
}

function probeMappingReadOnly({ storage, framePacket }) {
  try {
    const compiled = loadCompiledMappingV2(storage);
    const virtualWidth = Number(compiled?.virtual?.width || 0);
    const virtualHeight = Number(compiled?.virtual?.height || 0);
    const expectedFrameBytes = Math.max(0, virtualWidth * virtualHeight * 3);
    const actualFrameBytes = Number(framePacket?.frame?.byteLength || 0);
    const validation = compiled?.validation || {};
    const routeKeys = Object.keys(compiled?.routes || {}).filter((key) => key !== "none");
    const compatible = Boolean(compiled?.ok) && expectedFrameBytes > 0 && (actualFrameBytes === 0 || expectedFrameBytes === actualFrameBytes);
    return Object.freeze({
      version: NEXT_ENGINE_MAPPING_PROBE_VERSION,
      enabled: true,
      ran: true,
      ok: Boolean(compiled?.ok),
      compatible,
      segments: Number(compiled?.summary?.segments || 0),
      enabledSegments: Number(compiled?.summary?.enabled || 0),
      physicalPixels: Number(compiled?.summary?.physicalPixels || 0),
      virtualWidth,
      virtualHeight,
      expectedFrameBytes,
      actualFrameBytes,
      routeKeys,
      errors: Array.isArray(validation.errors) ? validation.errors.length : 0,
      warnings: Array.isArray(validation.warnings) ? validation.warnings.length : 0,
      reason: compatible ? "ok" : (compiled?.ok ? "frame_size_probe" : "mapping_invalid")
    });
  } catch (error) {
    return Object.freeze({
      ...createIdleMappingProbe(),
      enabled: true,
      ran: true,
      reason: String(error?.message || error)
    });
  }
}

function hasShadowFlag(storage) {
  const flags = readFeatureFlags(storage);
  return Boolean(flags.nextEngineShadowMode || flags.useNewFramePipelineShadow);
}

function createCandidateFromAuthoritativePacket(packet) {
  if (!packet || !(packet.frame instanceof Uint8Array)) return null;
  const frame = cloneBytes(packet.frame);
  if (!frame) return null;
  return Object.freeze({
    frame,
    width: Number(packet.width || 0),
    height: Number(packet.height || 0),
    sourceFrameId: Number(packet.frameId || 0),
    source: String(packet.source || "unknown"),
    checksum: checksumFrame(frame)
  });
}

export function createNextEngineShadowAdapter(options = {}) {
  const storage = options.storage || globalThis.localStorage;
  const performanceRef = options.performanceRef || globalThis.performance;
  const frameAuthority = options.frameAuthority || getRuntimeFrameAuthority();
  const onMetrics = typeof options.onMetrics === "function" ? options.onMetrics : null;

  let enabledOverride = options.enabled;
  let observeCount = 0;
  let errorCount = 0;
  const ownedBufferState = { buffer: null, reuseCount: 0, allocateCount: 0 };
  const mappedSnapshotState = { buffer: null, reuseCount: 0, allocateCount: 0 };
  let lastStatus = Object.freeze({
    version: NEXT_ENGINE_SHADOW_ADAPTER_VERSION,
    enabled: false,
    observeCount: 0,
    errorCount: 0,
    lastFrameId: 0,
    legacyChecksum: 0,
    nextChecksum: 0,
    checksumMatch: false,
    lastError: "none",
    mode: "shadow-readonly",
    mappingProbe: createIdleMappingProbe(),
    outputRouteProbe: createIdleOutputRouteProbe(),
    outputRouteCompare: createIdleOutputRouteCompare(),
    preflightGate: createIdlePreflightGate(),
    activationSnapshot: createIdleActivationSnapshot(),
    mirrorProbe: createIdleMirrorProbe(),
    bufferOwnershipProbe: createIdleBufferOwnershipProbe(),
    mappedSnapshotProbe: createIdleMappedSnapshotProbe(),
    dryPacketizerProbe: createIdleDryPacketizerProbe(),
    packetPlanCompareProbe: createIdlePacketPlanCompareProbe(),
    manualArmGate: createIdleManualArmGate(),
    manualArmedDryRun: createIdleManualArmedDryRun(),
    outputHandoffProbe: createIdleOutputHandoffProbe(),
    outputWriteInterlock: createIdleOutputWriteInterlock(),
    outputWriter: createIdleNextOutputWriter()
  });

  function isEnabled() {
    if (typeof enabledOverride === "boolean") return enabledOverride;
    return hasShadowFlag(storage);
  }

  function setEnabled(value) {
    enabledOverride = Boolean(value);
    lastStatus = Object.freeze({ ...lastStatus, enabled: enabledOverride });
  }

  function emit(status) {
    lastStatus = Object.freeze(status);
    onMetrics?.({ kind: "nextEngineShadow", ...lastStatus });
    return lastStatus;
  }

  function observeAuthoritativeFrame(packet = null) {
    const enabled = isEnabled();
    if (!enabled) {
      return emit({ ...lastStatus, enabled: false, mappingProbe: createIdleMappingProbe(), outputRouteProbe: createIdleOutputRouteProbe(), outputRouteCompare: createIdleOutputRouteCompare(), preflightGate: createIdlePreflightGate("shadow_disabled"), activationSnapshot: createIdleActivationSnapshot("shadow_disabled"), mirrorProbe: createIdleMirrorProbe("shadow_disabled"), bufferOwnershipProbe: createIdleBufferOwnershipProbe("shadow_disabled"), mappedSnapshotProbe: createIdleMappedSnapshotProbe("shadow_disabled"), dryPacketizerProbe: createIdleDryPacketizerProbe("shadow_disabled"), packetPlanCompareProbe: createIdlePacketPlanCompareProbe("shadow_disabled"), manualArmGate: createIdleManualArmGate("shadow_disabled"), manualArmedDryRun: createIdleManualArmedDryRun("shadow_disabled"), outputHandoffProbe: createIdleOutputHandoffProbe("shadow_disabled"), outputWriteInterlock: createIdleOutputWriteInterlock("shadow_disabled"), outputWriter: createIdleNextOutputWriter("shadow_disabled") });
    }

    try {
      const authoritative = packet || frameAuthority.getLatestFrame({ consumer: NEXT_ENGINE_SHADOW_CONSUMER });
      const legacyFrame = authoritative?.frame instanceof Uint8Array ? authoritative.frame : null;
      const candidate = createCandidateFromAuthoritativePacket(authoritative);
      const legacyChecksum = checksumFrame(legacyFrame);
      const nextChecksum = Number(candidate?.checksum || 0);
      const mirrorProbe = runFrameMirrorReadOnly({ storage, framePacket: authoritative, performanceRef });
      const bufferOwnershipProbe = runBufferOwnershipProbeReadOnly({ storage, framePacket: authoritative, performanceRef, ownedState: ownedBufferState });
      const mappedSnapshotProbe = runMappedSnapshotProbeReadOnly({ storage, framePacket: authoritative, performanceRef, mappedState: mappedSnapshotState });
      const dryPacketizerProbe = runDryPacketizerProbeReadOnly({ storage, mappedSnapshotProbe, performanceRef });
      const packetPlanCompareProbe = comparePacketPlansReadOnly({ storage, dryPacketizerProbe });
      const mappingProbe = probeMappingReadOnly({ storage, framePacket: authoritative });
      const outputRouteProbe = probeOutputRoutesReadOnly({ storage });
      const outputRouteCompare = compareOutputRoutesReadOnly({ storage, outputRouteProbe });
      const preflightGate = evaluateNextEnginePreflightGate({
        enabled: true,
        authoritative,
        legacyChecksum,
        nextChecksum,
        mappingProbe,
        outputRouteProbe,
        outputRouteCompare,
        errorCount
      });
      const activationSnapshot = createActivationSnapshotFromPreflight({
        preflightGate,
        outputRouteCompare,
        mappingProbe,
        outputRouteProbe
      });
      const manualArmGateReady = evaluateManualArmGateReadOnly({ storage, activationSnapshot, packetPlanCompareProbe, dryPacketizerProbe, mappedSnapshotProbe });
      const manualArmedDryRun = runManualArmedDryRunReadOnly({ storage, manualArmGate: manualArmGateReady, dryPacketizerProbe });
      const outputHandoffProbe = runOutputHandoffProbeReadOnly({ storage, manualArmedDryRun, dryPacketizerProbe });
      const outputWriteInterlock = runOutputWriteInterlockReadOnly({ storage, outputHandoffProbe, manualArmedDryRun });
      const outputWriter = evaluateNextOutputWriterSkeleton({
        enabled: Boolean(readFeatureFlags(storage).nextEngineOutputWriterSkeleton),
        outputWriteInterlock,
        outputHandoffProbe,
        manualArmedDryRun,
        mockTransportEnabled: Boolean(readFeatureFlags(storage).nextEngineMockOutputTransport),
        liveOutputWriteGateEnabled: Boolean(readFeatureFlags(storage).nextEngineLiveOutputWriteGate),
        serialGuardedAdapterEnabled: Boolean(readFeatureFlags(storage).nextEngineSerialGuardedAdapter),
        networkGuardedAdapterEnabled: Boolean(readFeatureFlags(storage).nextEngineNetworkGuardedAdapter),
        liveOutputCommitPlanEnabled: Boolean(readFeatureFlags(storage).nextEngineLiveOutputCommitPlan),
        transportCapabilityRegistryEnabled: Boolean(readFeatureFlags(storage).nextEngineTransportCapabilityRegistry),
        multiOutputRouterEnabled: Boolean(readFeatureFlags(storage).nextEngineMultiOutputRouter),
        batchExecutionSchedulerEnabled: Boolean(readFeatureFlags(storage).nextEngineBatchExecutionScheduler),
        executionCommitPreviewEnabled: Boolean(readFeatureFlags(storage).nextEngineExecutionCommitPreview),
        executionAuditSnapshotEnabled: Boolean(readFeatureFlags(storage).nextEngineExecutionAuditSnapshot),
        executionAuditHistoryEnabled: Boolean(readFeatureFlags(storage).nextEngineExecutionAuditHistory),
        executionAuditExportEnabled: Boolean(readFeatureFlags(storage).nextEngineExecutionAuditExport),
        executionDebugPayloadEnabled: Boolean(readFeatureFlags(storage).nextEngineExecutionDebugPayload),
        executionSanityMonitorEnabled: Boolean(readFeatureFlags(storage).nextEngineExecutionSanityMonitor),
        executionHealthSummaryEnabled: Boolean(readFeatureFlags(storage).nextEngineExecutionHealthSummary),
        executionHealthTrendEnabled: Boolean(readFeatureFlags(storage).nextEngineExecutionHealthTrend),
        executionReadinessGateEnabled: Boolean(readFeatureFlags(storage).nextEngineExecutionReadinessGate),
        liveExecutorPreflightEnabled: Boolean(readFeatureFlags(storage).nextEngineLiveExecutorPreflight),
        liveFrameMirrorValidationEnabled: Boolean(readFeatureFlags(storage).nextEngineLiveFrameMirrorValidation),
        liveControlledArmPhaseEnabled: Boolean(readFeatureFlags(storage).nextEngineLiveControlledArmPhase),
        liveExecutorSkeletonEnabled: Boolean(readFeatureFlags(storage).nextEngineLiveExecutorSkeleton),
        liveExecutorDiagnosticsEnabled: Boolean(readFeatureFlags(storage).nextEngineLiveExecutorDiagnostics),
        liveStateMachineEnabled: Boolean(readFeatureFlags(storage).nextEngineLiveStateMachine),
        controlledArmIntent: readControlledArmIntent(storage),
        authoritativeFrame: authoritative?.frame || authoritative?.pixels || null,
        frameSource: authoritative?.source || "frame_bus",
        frameTimestampMs: authoritative?.timestampMs || authoritative?.timestamp || null,
        targetFPS: Number(authoritative?.targetFPS || authoritative?.fps || 60),
        frameId: Number(authoritative?.frameId || 0),
        mapping: loadMappingV2(storage)
      });
      observeCount += 1;
      return emit({
        version: NEXT_ENGINE_SHADOW_ADAPTER_VERSION,
        enabled: true,
        observeCount,
        errorCount,
        lastFrameId: Number(authoritative?.frameId || 0),
        width: Number(authoritative?.width || 0),
        height: Number(authoritative?.height || 0),
        byteLength: Number(legacyFrame?.byteLength || 0),
        legacyChecksum,
        nextChecksum,
        checksumMatch: legacyChecksum === nextChecksum && legacyChecksum !== 0,
        lastError: "none",
        mode: "shadow-readonly",
        source: String(authoritative?.source || "none"),
        mappingProbe,
        outputRouteProbe,
        outputRouteCompare,
        preflightGate,
        activationSnapshot,
        mirrorProbe,
        bufferOwnershipProbe,
        mappedSnapshotProbe,
        dryPacketizerProbe,
        packetPlanCompareProbe,
        manualArmGate: manualArmGateReady,
        manualArmedDryRun,
        outputHandoffProbe,
        outputWriteInterlock,
        outputWriter
      });
    } catch (error) {
      errorCount += 1;
      return emit({
        ...lastStatus,
        enabled: true,
        errorCount,
        lastError: String(error?.message || error),
        mode: "shadow-readonly",
        mappingProbe: Object.freeze({ ...createIdleMappingProbe(), enabled: true, reason: "adapter_error" }),
        outputRouteProbe: Object.freeze({ ...createIdleOutputRouteProbe(), enabled: true, reason: "adapter_error" }),
        outputRouteCompare: Object.freeze({ ...createIdleOutputRouteCompare(), enabled: true, reason: "adapter_error" }),
        preflightGate: Object.freeze({ ...createIdlePreflightGate("adapter_error"), enabled: true, ran: true, status: "BLOCKED", level: "bad", blockers: ["adapter_error"], suggestedAction: "fix adapter_error before enabling any next-engine output path" }),
        activationSnapshot: Object.freeze({ ...createIdleActivationSnapshot("adapter_error"), enabled: true, ran: true, blockers: ["adapter_error"], blockerCount: 1, reason: "adapter_error" }),
        mirrorProbe: Object.freeze({ ...createIdleMirrorProbe("adapter_error"), enabled: true, ran: true }),
        bufferOwnershipProbe: Object.freeze({ ...createIdleBufferOwnershipProbe("adapter_error"), enabled: true, ran: true }),
        mappedSnapshotProbe: Object.freeze({ ...createIdleMappedSnapshotProbe("adapter_error"), enabled: true, ran: true }),
        dryPacketizerProbe: Object.freeze({ ...createIdleDryPacketizerProbe("adapter_error"), enabled: true, ran: true }),
        packetPlanCompareProbe: Object.freeze({ ...createIdlePacketPlanCompareProbe("adapter_error"), enabled: true, ran: true }),
        manualArmGate: Object.freeze({ ...createIdleManualArmGate("adapter_error"), enabled: true, ran: true }),
        manualArmedDryRun: Object.freeze({ ...createIdleManualArmedDryRun("adapter_error"), enabled: true, ran: true }),
        outputHandoffProbe: Object.freeze({ ...createIdleOutputHandoffProbe("adapter_error"), enabled: true, ran: true }),
        outputWriteInterlock: Object.freeze({ ...createIdleOutputWriteInterlock("adapter_error"), enabled: true, ran: true }),
        outputWriter: Object.freeze({ ...createIdleNextOutputWriter("adapter_error"), enabled: true, ran: true })
      });
    }
  }

  function getStatus() {
    return lastStatus;
  }

  return Object.freeze({
    version: NEXT_ENGINE_SHADOW_ADAPTER_VERSION,
    isEnabled,
    setEnabled,
    observeAuthoritativeFrame,
    getStatus
  });
}
