export const APP_UI_STORAGE_KEYS = {
  shaderInspectorCollapsed: "led-engine-shader-inspector-collapsed-v1",
  previewCollapsed: "led-engine-preview-collapsed-v1",
  fxPanelCollapsed: "led-engine-fx-panels-collapsed-v1",
  manualPaletteCollapsed: "led-engine-manual-palette-collapsed-v1",
  perfPadsCollapsed: "led-engine-perf-pads-collapsed-v1"
};

export const DISABLE_LIVE_GPU_AUTOSWITCH_DEFAULT = true;

export function createModuleListsState() {
  return {
    l1Anims: [],
    l1Palettes: [],
    l2Anims: [],
    l2Palettes: []
  };
}

export function createOutputPipelineMetricsState() {
  return {
    sent: 0,
    dropped: 0,
    lastLatencyMs: 0,
    lastSendMs: 0,
    pausedMs: 0,
    queueDepth: 0
  };
}

export function createPerfProfileMetricsState(performanceRef) {
  return {
    windowStartedAt: performanceRef.now(),
    renderFrames: 0,
    renderDropped: 0,
    renderMsSum: 0,
    renderMsMax: 0,
    renderLateMsSum: 0,
    previewDrawMsSum: 0,
    outputTicks: 0,
    outputTickMsSum: 0,
    outputTickMsMax: 0,
    outputDriftMsSum: 0,
    uiSyncCalls: 0,
    uiSyncMsSum: 0,
    uiSyncMsMax: 0,
    debugSyncCalls: 0,
    debugSyncMsSum: 0,
    debugSyncMsMax: 0
  };
}

export function createSchedulerDebugState() {
  return {
    nextAt: 0,
    delayMs: 0,
    skipped: 0,
    renderMs: 0,
    warmupQueue: 0,
    shaderWarmupQueue: 0,
    shaderWarmupHits: 0,
    workerSlotMs: 0,
    gpuWarmupNextAt: 0,
    gpuWarmupDelayMs: 0,
    lastShaderSwitchAt: 0,
    nextEngineShadow: {
      enabled: false,
      ran: false,
      compatible: false,
      frameId: 0,
      legacyFrameId: 0,
      checksum: 0,
      legacyChecksum: 0,
      mismatch: false,
      reason: "idle",
      updatedAt: 0,
      mappingProbe: {
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
      },
      preflightGate: {
        enabled: false,
        ran: false,
        ready: false,
        status: "IDLE",
        level: "info",
        blockers: [],
        warnings: [],
        reason: "idle",
        suggestedAction: "keep shadow mode enabled and wait for a valid authoritative frame"
      },
      mirrorProbe: {
        enabled: false,
        ran: false,
        ok: false,
        integrity: false,
        frameId: 0,
        byteLength: 0,
        mappedBytes: 0,
        routeCount: 0,
        activeRouteCount: 0,
        consumeMs: 0,
        mappingMs: 0,
        totalMs: 0,
        reason: "idle"
      },
      activationSnapshot: {
        enabled: false,
        ran: false,
        decision: "HOLD",
        canActivate: false,
        confidence: "none",
        blockerCount: 0,
        warningCount: 0,
        blockers: [],
        warnings: [],
        reason: "idle",
        nextStep: "keep next engine in shadow mode",
        safety: "read-only; no runtime output switch is performed"
      }
    },
    // STEP 10D: bounded passive compare history for the next-engine shadow
    // adapter. This is debug-only state; it must never drive render/output.
    nextEngineShadowHistory: []
  };
}

export function createStartupTimingState() {
  return {
    phase: "boot",
    progress: 0,
    item: 0,
    total: 0,
    waitMs: 0
  };
}
