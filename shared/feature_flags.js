const FEATURE_FLAGS_KEY = "led-engine-feature-flags-v1";

export const FEATURE_FLAG_DEFAULTS = Object.freeze({
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

export const NEXT_RUNTIME_FLAG_KEYS = Object.freeze([
  "useNewFramePipeline",
  "useNewCentralState",
  "useNewMapping",
  "useNewOutput",
  "useNewPreview",
  "useNewEvents",
  "useNewTelemetry"
]);

export function cloneFeatureFlags(flags = FEATURE_FLAG_DEFAULTS) {
  return { ...flags };
}

export function mergeFeatureFlags(partial = {}) {
  const next = cloneFeatureFlags();
  for (const key of Object.keys(next)) {
    if (Object.prototype.hasOwnProperty.call(partial, key)) {
      next[key] = Boolean(partial[key]);
    }
  }
  return next;
}

export function readFeatureFlags(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem?.(FEATURE_FLAGS_KEY);
    if (!raw) return cloneFeatureFlags();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return cloneFeatureFlags();
    return mergeFeatureFlags(parsed);
  } catch {
    return cloneFeatureFlags();
  }
}

export function writeFeatureFlags(next, storage = globalThis.localStorage) {
  const merged = mergeFeatureFlags(next);
  storage?.setItem?.(FEATURE_FLAGS_KEY, JSON.stringify(merged));
  return merged;
}

export function isFeatureEnabled(flags, key) {
  return Boolean(flags?.[key]);
}

export function shouldPreferNextRuntime(flags) {
  return NEXT_RUNTIME_FLAG_KEYS.some((key) => isFeatureEnabled(flags, key));
}

export function featureFlagsStorageKey() {
  return FEATURE_FLAGS_KEY;
}
