export function createAppRuntimeTrace(context = {}) {
  const {
    windowRef = window,
    documentRef = document,
    performanceRef = performance,
    getGpuShaderStats = () => ({}),
    getRuntimeFrameBus,
    getRuntimeFrameAuthority = null,
    telemetryBus,
    perfProfileMetrics,
    getOutputPipelineMetrics = () => ({}),
    schedulerDebugState = {},
    getShaderPreloadManager = () => null,
    getState = () => ({}),
    getSettings = () => ({}),
    getSerialSettings = () => ({}),
    getStateSyncController = () => null,
    getHeadlessLeader = () => null,
    getLatestRuntimeDetail = () => null,
    setLatestRuntimeDetail = () => {},
    getWidth = () => 0,
    getHeight = () => 0,
    getLastPreviewRenderer = () => "pending",
    getLastOutputFrameAt = () => 0,
    getLastSerialFrameAt = () => 0,
    isSerialPipelineEnabled = () => false,
    effectiveOutputMode = () => "unknown",
    readPreviewMode = () => "pixel",
    isHeadless = () => false,
    isShellViewOnly = () => false,
    getGpuReady = () => false,
    getLastGpuFaultAt = () => 0,
    getLastGpuFaultKind = () => "--",
    getStartupFrameGuard = () => false,
    getOutputEnabled = () => false
  } = context;

  // STEP 13T: runtime trace may run at the render/output FPS, but shell/UI telemetry
  // does not need frame-rate transport. Keeping local CustomEvent per frame preserves
  // in-frame diagnostics, while parent postMessage is throttled to avoid hammering
  // the visible iframe during navigation/mount. Serial/output sending is independent
  // from this telemetry channel.
  const parentTraceMinIntervalMs = isHeadless() ? 250 : 500;
  const localTraceMinIntervalMs = isHeadless() ? 100 : 120;
  let lastParentTracePostAt = 0;
  let lastLocalTraceAt = 0;

  function reportOutputFrame() {
    if (isShellViewOnly()) return;
    const nowForTrace = performanceRef.now();
    if (nowForTrace - lastLocalTraceAt < localTraceMinIntervalMs) return;
    lastLocalTraceAt = nowForTrace;
    const state = getState() || {};
    const settings = getSettings() || {};
    const serialSettings = getSerialSettings() || {};
    const outputPipelineMetrics = getOutputPipelineMetrics() || {};
    const shaderStats = getGpuShaderStats?.() || {};
    const preloadStatus = getShaderPreloadManager()?.getStatus?.() || {};
    const perfSnapshot = readPerfProfileSnapshot();
    const detail = {
      enabled: Boolean(getOutputEnabled()),
      serial: isSerialPipelineEnabled(),
      targetFps: settings.fps,
      outputMode: effectiveOutputMode(),
      previewMode: String(readPreviewMode() || "pixel"),
      renderer: getLastPreviewRenderer(),
      gpuMode: settings.gpuMode,
      gpuReady: getGpuReady(),
      socketState: getStateSyncController()?.getSocket?.()?.readyState ?? -1,
      blxEnabled: settings.blxEnabled,
      blxTransport: settings.blxTransport,
      blxBaud: settings.blxSerialBaud,
      serialFps: serialSettings?.fps || 0,
      outputLatencyMs: outputPipelineMetrics.lastLatencyMs || 0,
      outputSendMs: outputPipelineMetrics.lastSendMs || 0,
      outputDropped: outputPipelineMetrics.dropped || 0,
      outputQueueDepth: outputPipelineMetrics.queueDepth || 0,
      outputPausedMs: outputPipelineMetrics.pausedMs || 0,
      mode: isHeadless() ? "RUNNER" : "MAIN",
      timestamp: nowForTrace,
      lastOutputFrameAt: getLastOutputFrameAt(),
      lastSerialFrameAt: getLastSerialFrameAt(),
      viewport: { width: getWidth(), height: getHeight() },
      windowSize: { width: windowRef.innerWidth, height: windowRef.innerHeight },
      devicePixelRatio: windowRef.devicePixelRatio || 1,
      uiScale: documentRef.documentElement.style.getPropertyValue("--ui-scale") || "1",
      shaderCacheHits: Number(shaderStats.cacheHits || 0),
      shaderCacheMisses: Number(shaderStats.cacheMisses || 0),
      shaderCompileCount: Number(shaderStats.compileCount || 0),
      shaderCompileFailures: Number(shaderStats.compileFailures || 0),
      shaderAvgCompileMs: Number(shaderStats.avgCompileMs || 0),
      shaderLastCompileMs: Number(shaderStats.lastCompileMs || 0),
      shaderLastSwitchAt: Number(preloadStatus.lastSwitchAt || schedulerDebugState.lastShaderSwitchAt || 0),
      shaderLazyQueued: Number(preloadStatus.lazyQueued || 0),
      gpuLastFaultAt: Number(getLastGpuFaultAt() || 0),
      gpuLastFaultKind: String(getLastGpuFaultKind() || "--"),
      perf: perfSnapshot
    };
    setLatestRuntimeDetail(detail);
    windowRef.dispatchEvent(new CustomEvent("led-output-frame", { detail }));
    if (windowRef.parent && windowRef.parent !== windowRef && nowForTrace - lastParentTracePostAt >= parentTraceMinIntervalMs) {
      lastParentTracePostAt = nowForTrace;
      windowRef.parent.postMessage({ type: "led-output-frame", detail }, "*");
    }
  }

  function installShellRunnerOutputFrameReceiver() {
    windowRef.addEventListener("message", (event) => {
      const message = event?.data;
      if (!message || typeof message !== "object") return;
      if (message.type !== "led-output-frame") return;
      const detail = message.detail;
      if (!detail || typeof detail !== "object") return;
      if (!isShellViewOnly()) return;
      setLatestRuntimeDetail(detail);
      windowRef.dispatchEvent(new CustomEvent("led-output-frame", { detail }));
    });
  }

  function captureUiSyncMetric(startedAt) {
    const elapsed = Math.max(0, performanceRef.now() - startedAt);
    telemetryBus.recordUiMetric("uiSync", elapsed);
    perfProfileMetrics.uiSyncCalls += 1;
    perfProfileMetrics.uiSyncMsSum += elapsed;
    if (elapsed > perfProfileMetrics.uiSyncMsMax) perfProfileMetrics.uiSyncMsMax = elapsed;
  }

  function captureDebugSyncMetric(startedAt) {
    const elapsed = Math.max(0, performanceRef.now() - startedAt);
    telemetryBus.recordUiMetric("debugSync", elapsed);
    perfProfileMetrics.debugSyncCalls += 1;
    perfProfileMetrics.debugSyncMsSum += elapsed;
    if (elapsed > perfProfileMetrics.debugSyncMsMax) perfProfileMetrics.debugSyncMsMax = elapsed;
  }

  function clonePlain(value) {
    if (!value || typeof value !== "object") return value || null;
    try { return JSON.parse(JSON.stringify(value)); }
    catch { return null; }
  }

  function normalizeNextEngineShadowMetric(metric) {
    const legacyFrameId = Number(metric.legacyFrameId || metric.frameId || 0);
    const frameId = Number(metric.nextFrameId || metric.frameId || 0);
    const legacyChecksum = Number(metric.legacyChecksum || 0);
    const checksum = Number(metric.nextChecksum || metric.checksum || 0);
    const ran = Boolean(metric.ran ?? metric.enabled);
    const compatible = Boolean(metric.compatible);
    const mismatch = Boolean(metric.mismatch ?? (ran && compatible && legacyChecksum !== checksum));
    const probe = metric.mappingProbe && typeof metric.mappingProbe === "object" ? metric.mappingProbe : null;
    const outputProbe = metric.outputRouteProbe && typeof metric.outputRouteProbe === "object" ? metric.outputRouteProbe : null;
    const outputCompare = metric.outputRouteCompare && typeof metric.outputRouteCompare === "object" ? metric.outputRouteCompare : null;
    const preflight = metric.preflightGate && typeof metric.preflightGate === "object" ? metric.preflightGate : null;
    const activation = metric.activationSnapshot && typeof metric.activationSnapshot === "object" ? metric.activationSnapshot : null;
    const mirror = metric.mirrorProbe && typeof metric.mirrorProbe === "object" ? metric.mirrorProbe : null;
    const bufferOwnership = metric.bufferOwnershipProbe && typeof metric.bufferOwnershipProbe === "object" ? metric.bufferOwnershipProbe : null;
    const mappedSnapshot = metric.mappedSnapshotProbe && typeof metric.mappedSnapshotProbe === "object" ? metric.mappedSnapshotProbe : null;
    const dryPacketizer = metric.dryPacketizerProbe && typeof metric.dryPacketizerProbe === "object" ? metric.dryPacketizerProbe : null;
    const packetPlanCompare = metric.packetPlanCompareProbe && typeof metric.packetPlanCompareProbe === "object" ? metric.packetPlanCompareProbe : null;
    const manualArmGate = metric.manualArmGate && typeof metric.manualArmGate === "object" ? metric.manualArmGate : null;
    const manualArmedDryRun = metric.manualArmedDryRun && typeof metric.manualArmedDryRun === "object" ? metric.manualArmedDryRun : null;
    const outputHandoffProbe = metric.outputHandoffProbe && typeof metric.outputHandoffProbe === "object" ? metric.outputHandoffProbe : null;
    const outputWriteInterlock = metric.outputWriteInterlock && typeof metric.outputWriteInterlock === "object" ? metric.outputWriteInterlock : null;
    const outputWriter = metric.outputWriter && typeof metric.outputWriter === "object" ? metric.outputWriter : null;
    return {
      enabled: Boolean(metric.enabled ?? ran),
      ran,
      compatible,
      frameId,
      legacyFrameId,
      checksum,
      legacyChecksum,
      mismatch,
      reason: String(metric.reason || (mismatch ? "checksum_mismatch" : ran ? "ok" : "idle")),
      updatedAt: Number(metric.timestamp || performanceRef.now()),
      mappingProbe: probe ? Object.freeze({
        enabled: Boolean(probe.enabled),
        ran: Boolean(probe.ran),
        ok: Boolean(probe.ok),
        compatible: Boolean(probe.compatible),
        segments: Number(probe.segments || 0),
        enabledSegments: Number(probe.enabledSegments || 0),
        physicalPixels: Number(probe.physicalPixels || 0),
        virtualWidth: Number(probe.virtualWidth || 0),
        virtualHeight: Number(probe.virtualHeight || 0),
        expectedFrameBytes: Number(probe.expectedFrameBytes || 0),
        actualFrameBytes: Number(probe.actualFrameBytes || 0),
        routeKeys: Array.isArray(probe.routeKeys) ? probe.routeKeys.map(String).slice(0, 12) : [],
        errors: Number(probe.errors || 0),
        warnings: Number(probe.warnings || 0),
        reason: String(probe.reason || "--")
      }) : null,
      outputRouteProbe: outputProbe ? Object.freeze({
        enabled: Boolean(outputProbe.enabled),
        ran: Boolean(outputProbe.ran),
        ok: Boolean(outputProbe.ok),
        routeCount: Number(outputProbe.routeCount || 0),
        activeRouteCount: Number(outputProbe.activeRouteCount || 0),
        totalSegments: Number(outputProbe.totalSegments || 0),
        enabledSegments: Number(outputProbe.enabledSegments || 0),
        totalPixels: Number(outputProbe.totalPixels || 0),
        estimatedBytes: Number(outputProbe.estimatedBytes || 0),
        outputs: Array.isArray(outputProbe.outputs) ? outputProbe.outputs.map(String).slice(0, 12) : [],
        serialSegments: Number(outputProbe.serialSegments || 0),
        networkSegments: Number(outputProbe.networkSegments || 0),
        noneSegments: Number(outputProbe.noneSegments || 0),
        unsupportedRoutes: Array.isArray(outputProbe.unsupportedRoutes) ? outputProbe.unsupportedRoutes.map(String).slice(0, 12) : [],
        maxUniverse: Number(outputProbe.maxUniverse || 0),
        errors: Number(outputProbe.errors || 0),
        warnings: Number(outputProbe.warnings || 0),
        reason: String(outputProbe.reason || "--")
      }) : null,
      outputRouteCompare: outputCompare ? Object.freeze({
        enabled: Boolean(outputCompare.enabled),
        ran: Boolean(outputCompare.ran),
        ok: Boolean(outputCompare.ok),
        match: Boolean(outputCompare.match),
        legacyMode: String(outputCompare.legacyMode || "none"),
        legacyActiveOutputs: Array.isArray(outputCompare.legacyActiveOutputs) ? outputCompare.legacyActiveOutputs.map(String).slice(0, 12) : [],
        nextActiveOutputs: Array.isArray(outputCompare.nextActiveOutputs) ? outputCompare.nextActiveOutputs.map(String).slice(0, 12) : [],
        missingInNext: Array.isArray(outputCompare.missingInNext) ? outputCompare.missingInNext.map(String).slice(0, 12) : [],
        extraInNext: Array.isArray(outputCompare.extraInNext) ? outputCompare.extraInNext.map(String).slice(0, 12) : [],
        sharedOutputs: Array.isArray(outputCompare.sharedOutputs) ? outputCompare.sharedOutputs.map(String).slice(0, 12) : [],
        legacySerialEnabled: Boolean(outputCompare.legacySerialEnabled),
        legacyBlxEnabled: Boolean(outputCompare.legacyBlxEnabled),
        legacyBlxTransport: String(outputCompare.legacyBlxTransport || "serial"),
        warningVersion: String(outputCompare.warningVersion || ""),
        warningLevel: String(outputCompare.warningLevel || "none"),
        warning: String(outputCompare.warning || "none"),
        suggestedFix: String(outputCompare.suggestedFix || "none"),
        suggestion: String(outputCompare.suggestion || "none"),
        reason: String(outputCompare.reason || "--")
      }) : null,
      preflightGate: preflight ? Object.freeze({
        enabled: Boolean(preflight.enabled),
        ran: Boolean(preflight.ran),
        ready: Boolean(preflight.ready),
        status: String(preflight.status || "IDLE"),
        level: String(preflight.level || "info"),
        blockers: Array.isArray(preflight.blockers) ? preflight.blockers.map(String).slice(0, 12) : [],
        warnings: Array.isArray(preflight.warnings) ? preflight.warnings.map(String).slice(0, 12) : [],
        reason: String(preflight.reason || "--"),
        suggestedAction: String(preflight.suggestedAction || "none")
      }) : null,
      mirrorProbe: mirror ? Object.freeze({
        enabled: Boolean(mirror.enabled),
        ran: Boolean(mirror.ran),
        ok: Boolean(mirror.ok),
        integrity: Boolean(mirror.integrity),
        frameId: Number(mirror.frameId || 0),
        source: String(mirror.source || "none"),
        width: Number(mirror.width || 0),
        height: Number(mirror.height || 0),
        byteLength: Number(mirror.byteLength || 0),
        checksum: Number(mirror.checksum || 0),
        cloneChecksum: Number(mirror.cloneChecksum || 0),
        mappedBytes: Number(mirror.mappedBytes || 0),
        routeCount: Number(mirror.routeCount || 0),
        activeRouteCount: Number(mirror.activeRouteCount || 0),
        consumeMs: Number(mirror.consumeMs || 0),
        mappingMs: Number(mirror.mappingMs || 0),
        totalMs: Number(mirror.totalMs || 0),
        reason: String(mirror.reason || "--"),
        safety: String(mirror.safety || "read-only")
      }) : null,
      bufferOwnershipProbe: bufferOwnership ? Object.freeze({
        enabled: Boolean(bufferOwnership.enabled),
        ran: Boolean(bufferOwnership.ran),
        ok: Boolean(bufferOwnership.ok),
        ownsScratchBuffer: Boolean(bufferOwnership.ownsScratchBuffer),
        borrowedAuthoritative: Boolean(bufferOwnership.borrowedAuthoritative),
        authoritativeMutated: Boolean(bufferOwnership.authoritativeMutated),
        sourceFrameId: Number(bufferOwnership.sourceFrameId || 0),
        sourceBytes: Number(bufferOwnership.sourceBytes || 0),
        ownedBytes: Number(bufferOwnership.ownedBytes || 0),
        ownedChecksum: Number(bufferOwnership.ownedChecksum || 0),
        sourceChecksumBefore: Number(bufferOwnership.sourceChecksumBefore || 0),
        sourceChecksumAfter: Number(bufferOwnership.sourceChecksumAfter || 0),
        reuseCount: Number(bufferOwnership.reuseCount || 0),
        allocateCount: Number(bufferOwnership.allocateCount || 0),
        bufferCapacity: Number(bufferOwnership.bufferCapacity || 0),
        copyMs: Number(bufferOwnership.copyMs || 0),
        totalMs: Number(bufferOwnership.totalMs || 0),
        reason: String(bufferOwnership.reason || "--"),
        safety: String(bufferOwnership.safety || "read-only")
      }) : null,
      mappedSnapshotProbe: mappedSnapshot ? Object.freeze({
        enabled: Boolean(mappedSnapshot.enabled),
        ran: Boolean(mappedSnapshot.ran),
        ok: Boolean(mappedSnapshot.ok),
        ownsMappedBuffer: Boolean(mappedSnapshot.ownsMappedBuffer),
        outputTouched: Boolean(mappedSnapshot.outputTouched),
        frameAuthorityTouched: Boolean(mappedSnapshot.frameAuthorityTouched),
        sourceFrameId: Number(mappedSnapshot.sourceFrameId || 0),
        sourceBytes: Number(mappedSnapshot.sourceBytes || 0),
        mappedBytes: Number(mappedSnapshot.mappedBytes || 0),
        mappedChecksum: Number(mappedSnapshot.mappedChecksum || 0),
        mappedCapacity: Number(mappedSnapshot.mappedCapacity || 0),
        routeCount: Number(mappedSnapshot.routeCount || 0),
        activeRouteCount: Number(mappedSnapshot.activeRouteCount || 0),
        allocateCount: Number(mappedSnapshot.allocateCount || 0),
        reuseCount: Number(mappedSnapshot.reuseCount || 0),
        mapCopyMs: Number(mappedSnapshot.mapCopyMs || 0),
        totalMs: Number(mappedSnapshot.totalMs || 0),
        reason: String(mappedSnapshot.reason || "--"),
        safety: String(mappedSnapshot.safety || "read-only")
      }) : null,
      dryPacketizerProbe: dryPacketizer ? Object.freeze({
        enabled: Boolean(dryPacketizer.enabled),
        ran: Boolean(dryPacketizer.ran),
        ok: Boolean(dryPacketizer.ok),
        ownsPacketPlan: Boolean(dryPacketizer.ownsPacketPlan),
        outputTouched: Boolean(dryPacketizer.outputTouched),
        networkTouched: Boolean(dryPacketizer.networkTouched),
        serialTouched: Boolean(dryPacketizer.serialTouched),
        frameAuthorityTouched: Boolean(dryPacketizer.frameAuthorityTouched),
        sourceFrameId: Number(dryPacketizer.sourceFrameId || 0),
        mappedBytes: Number(dryPacketizer.mappedBytes || 0),
        packetCount: Number(dryPacketizer.packetCount || 0),
        serialPackets: Number(dryPacketizer.serialPackets || 0),
        networkPackets: Number(dryPacketizer.networkPackets || 0),
        totalPayloadBytes: Number(dryPacketizer.totalPayloadBytes || 0),
        maxPacketBytes: Number(dryPacketizer.maxPacketBytes || 0),
        routeCount: Number(dryPacketizer.routeCount || 0),
        activeRouteCount: Number(dryPacketizer.activeRouteCount || 0),
        protocols: Array.isArray(dryPacketizer.protocols) ? dryPacketizer.protocols.map(String).slice(0, 12) : [],
        buildMs: Number(dryPacketizer.buildMs || 0),
        totalMs: Number(dryPacketizer.totalMs || 0),
        reason: String(dryPacketizer.reason || "--"),
        safety: String(dryPacketizer.safety || "read-only")
      }) : null,
      packetPlanCompareProbe: packetPlanCompare ? Object.freeze({
        enabled: Boolean(packetPlanCompare.enabled),
        ran: Boolean(packetPlanCompare.ran),
        ok: Boolean(packetPlanCompare.ok),
        match: Boolean(packetPlanCompare.match),
        legacyPacketCount: Number(packetPlanCompare.legacyPacketCount || 0),
        nextPacketCount: Number(packetPlanCompare.nextPacketCount || 0),
        legacyPayloadBytes: Number(packetPlanCompare.legacyPayloadBytes || 0),
        nextPayloadBytes: Number(packetPlanCompare.nextPayloadBytes || 0),
        missingProtocols: Array.isArray(packetPlanCompare.missingProtocols) ? packetPlanCompare.missingProtocols.map(String).slice(0, 12) : [],
        extraProtocols: Array.isArray(packetPlanCompare.extraProtocols) ? packetPlanCompare.extraProtocols.map(String).slice(0, 12) : [],
        sharedProtocols: Array.isArray(packetPlanCompare.sharedProtocols) ? packetPlanCompare.sharedProtocols.map(String).slice(0, 12) : [],
        packetDelta: Number(packetPlanCompare.packetDelta || 0),
        payloadDelta: Number(packetPlanCompare.payloadDelta || 0),
        outputTouched: Boolean(packetPlanCompare.outputTouched),
        networkTouched: Boolean(packetPlanCompare.networkTouched),
        serialTouched: Boolean(packetPlanCompare.serialTouched),
        frameAuthorityTouched: Boolean(packetPlanCompare.frameAuthorityTouched),
        reason: String(packetPlanCompare.reason || "--"),
        safety: String(packetPlanCompare.safety || "read-only")
      }) : null,
      manualArmGate: manualArmGate ? Object.freeze({
        enabled: Boolean(manualArmGate.enabled),
        ran: Boolean(manualArmGate.ran),
        ok: Boolean(manualArmGate.ok),
        decision: String(manualArmGate.decision || "HOLD"),
        armable: Boolean(manualArmGate.armable),
        armed: Boolean(manualArmGate.armed),
        manualOnly: Boolean(manualArmGate.manualOnly),
        requiresUserAction: Boolean(manualArmGate.requiresUserAction),
        blockerCount: Number(manualArmGate.blockerCount || 0),
        warningCount: Number(manualArmGate.warningCount || 0),
        blockers: Array.isArray(manualArmGate.blockers) ? manualArmGate.blockers.map(String).slice(0, 12) : [],
        warnings: Array.isArray(manualArmGate.warnings) ? manualArmGate.warnings.map(String).slice(0, 12) : [],
        packetPlanMatch: Boolean(manualArmGate.packetPlanMatch),
        activationReady: Boolean(manualArmGate.activationReady),
        dryPacketizerReady: Boolean(manualArmGate.dryPacketizerReady),
        mappedSnapshotReady: Boolean(manualArmGate.mappedSnapshotReady),
        outputTouched: Boolean(manualArmGate.outputTouched),
        networkTouched: Boolean(manualArmGate.networkTouched),
        serialTouched: Boolean(manualArmGate.serialTouched),
        frameAuthorityTouched: Boolean(manualArmGate.frameAuthorityTouched),
        suggestedAction: String(manualArmGate.suggestedAction || "keep next output path disarmed"),
        reason: String(manualArmGate.reason || "--"),
        safety: String(manualArmGate.safety || "manual arm gate only")
      }) : null,

      manualArmedDryRun: manualArmedDryRun ? Object.freeze({
        enabled: Boolean(manualArmedDryRun.enabled),
        ran: Boolean(manualArmedDryRun.ran),
        ok: Boolean(manualArmedDryRun.ok),
        decision: String(manualArmedDryRun.decision || "HOLD"),
        armed: Boolean(manualArmedDryRun.armed),
        dryRun: Boolean(manualArmedDryRun.dryRun),
        discardOnly: Boolean(manualArmedDryRun.discardOnly),
        manualOnly: Boolean(manualArmedDryRun.manualOnly),
        requiresArmableGate: Boolean(manualArmedDryRun.requiresArmableGate),
        packetCount: Number(manualArmedDryRun.packetCount || 0),
        payloadBytes: Number(manualArmedDryRun.payloadBytes || 0),
        protocols: Array.isArray(manualArmedDryRun.protocols) ? manualArmedDryRun.protocols.map(String).slice(0, 12) : [],
        copiedPacketPlan: Boolean(manualArmedDryRun.copiedPacketPlan),
        outputTouched: Boolean(manualArmedDryRun.outputTouched),
        networkTouched: Boolean(manualArmedDryRun.networkTouched),
        serialTouched: Boolean(manualArmedDryRun.serialTouched),
        frameAuthorityTouched: Boolean(manualArmedDryRun.frameAuthorityTouched),
        reason: String(manualArmedDryRun.reason || "--"),
        safety: String(manualArmedDryRun.safety || "manual armed dry-run only")
      }) : null,
      outputHandoffProbe: outputHandoffProbe ? Object.freeze({
        enabled: Boolean(outputHandoffProbe.enabled),
        ran: Boolean(outputHandoffProbe.ran),
        ok: Boolean(outputHandoffProbe.ok),
        decision: String(outputHandoffProbe.decision || "HOLD"),
        handoffReady: Boolean(outputHandoffProbe.handoffReady),
        armedDryRunRequired: Boolean(outputHandoffProbe.armedDryRunRequired),
        liveOutputEnabled: Boolean(outputHandoffProbe.liveOutputEnabled),
        transportOpenAllowed: Boolean(outputHandoffProbe.transportOpenAllowed),
        packetCount: Number(outputHandoffProbe.packetCount || 0),
        payloadBytes: Number(outputHandoffProbe.payloadBytes || 0),
        protocols: Array.isArray(outputHandoffProbe.protocols) ? outputHandoffProbe.protocols.map(String).slice(0, 12) : [],
        backendPlan: Array.isArray(outputHandoffProbe.backendPlan) ? outputHandoffProbe.backendPlan.map(String).slice(0, 12) : [],
        outputTouched: Boolean(outputHandoffProbe.outputTouched),
        networkTouched: Boolean(outputHandoffProbe.networkTouched),
        serialTouched: Boolean(outputHandoffProbe.serialTouched),
        frameAuthorityTouched: Boolean(outputHandoffProbe.frameAuthorityTouched),
        reason: String(outputHandoffProbe.reason || "--"),
        safety: String(outputHandoffProbe.safety || "output handoff probe only")
      }) : null,

      outputWriteInterlock: outputWriteInterlock ? Object.freeze({
        enabled: Boolean(outputWriteInterlock.enabled),
        ran: Boolean(outputWriteInterlock.ran),
        ok: Boolean(outputWriteInterlock.ok),
        decision: String(outputWriteInterlock.decision || "LOCKED"),
        writeAllowed: Boolean(outputWriteInterlock.writeAllowed),
        hardLocked: Boolean(outputWriteInterlock.hardLocked),
        requiresHandoffReady: Boolean(outputWriteInterlock.requiresHandoffReady),
        requiresManualArmedDryRun: Boolean(outputWriteInterlock.requiresManualArmedDryRun),
        requiresExplicitLiveFlag: Boolean(outputWriteInterlock.requiresExplicitLiveFlag),
        explicitLiveFlagPresent: Boolean(outputWriteInterlock.explicitLiveFlagPresent),
        packetCount: Number(outputWriteInterlock.packetCount || 0),
        payloadBytes: Number(outputWriteInterlock.payloadBytes || 0),
        protocols: Array.isArray(outputWriteInterlock.protocols) ? outputWriteInterlock.protocols.map(String).slice(0, 12) : [],
        backendPlan: Array.isArray(outputWriteInterlock.backendPlan) ? outputWriteInterlock.backendPlan.map(String).slice(0, 12) : [],
        outputTouched: Boolean(outputWriteInterlock.outputTouched),
        networkTouched: Boolean(outputWriteInterlock.networkTouched),
        serialTouched: Boolean(outputWriteInterlock.serialTouched),
        frameAuthorityTouched: Boolean(outputWriteInterlock.frameAuthorityTouched),
        reason: String(outputWriteInterlock.reason || "--"),
        safety: String(outputWriteInterlock.safety || "write interlock only")
      }) : null,

      outputWriter: outputWriter ? Object.freeze({
        enabled: Boolean(outputWriter.enabled),
        ran: Boolean(outputWriter.ran),
        ok: Boolean(outputWriter.ok),
        writerReady: Boolean(outputWriter.writerReady),
        decision: String(outputWriter.decision || "BLOCKED"),
        wouldWritePackets: Number(outputWriter.wouldWritePackets || 0),
        wouldWritePayloadBytes: Number(outputWriter.wouldWritePayloadBytes || 0),
        transportSelected: String(outputWriter.transportSelected || "none"),
        selectedTransports: Array.isArray(outputWriter.selectedTransports) ? outputWriter.selectedTransports.map(String).slice(0, 12) : [],
        blockedReason: String(outputWriter.blockedReason || "--"),
        outputTouched: Boolean(outputWriter.outputTouched),
        networkTouched: Boolean(outputWriter.networkTouched),
        serialTouched: Boolean(outputWriter.serialTouched),
        frameAuthorityTouched: Boolean(outputWriter.frameAuthorityTouched),
        dryRunOnly: Boolean(outputWriter.dryRunOnly),
        mockTransportEnabled: Boolean(outputWriter.mockTransportEnabled),
        mockTransportTouched: Boolean(outputWriter.mockTransportTouched),
        mockWriteCount: Number(outputWriter.mockWriteCount || 0),
        mockPayloadBytes: Number(outputWriter.mockPayloadBytes || 0),
        mockProtocols: Array.isArray(outputWriter.mockProtocols) ? outputWriter.mockProtocols.map(String).slice(0, 12) : [],
        mockDigest: String(outputWriter.mockDigest || "none"),
        liveOutputWriteGateEnabled: Boolean(outputWriter.liveOutputWriteGateEnabled),
        liveWriteRequested: Boolean(outputWriter.liveWriteRequested),
        liveExecutorImplemented: Boolean(outputWriter.liveExecutorImplemented),
        physicalWriteAllowed: Boolean(outputWriter.physicalWriteAllowed),
        liveBlockedReason: String(outputWriter.liveBlockedReason || "--"),
        serialGuardedAdapterEnabled: Boolean(outputWriter.serialGuardedAdapterEnabled),
        serialAdapterReady: Boolean(outputWriter.serialAdapterReady),
        serialAdapterDecision: String(outputWriter.serialAdapterDecision || "DISABLED"),
        serialAdapterWouldWritePackets: Number(outputWriter.serialAdapterWouldWritePackets || 0),
        serialAdapterWouldWritePayloadBytes: Number(outputWriter.serialAdapterWouldWritePayloadBytes || 0),
        serialAdapterTouched: Boolean(outputWriter.serialAdapterTouched),
        serialAdapterBlockedReason: String(outputWriter.serialAdapterBlockedReason || "--"),
        networkGuardedAdapterEnabled: Boolean(outputWriter.networkGuardedAdapterEnabled),
        networkAdapterReady: Boolean(outputWriter.networkAdapterReady),
        networkAdapterDecision: String(outputWriter.networkAdapterDecision || "DISABLED"),
        networkAdapterWouldWritePackets: Number(outputWriter.networkAdapterWouldWritePackets || 0),
        networkAdapterWouldWritePayloadBytes: Number(outputWriter.networkAdapterWouldWritePayloadBytes || 0),
        networkAdapterTouched: Boolean(outputWriter.networkAdapterTouched),
        networkAdapterBlockedReason: String(outputWriter.networkAdapterBlockedReason || "--"),
        liveOutputCommitPlanEnabled: Boolean(outputWriter.liveOutputCommitPlanEnabled),
        transportCapabilityRegistryEnabled: Boolean(outputWriter.transportCapabilityRegistryEnabled),
        transportRegistryReady: Boolean(outputWriter.transportRegistryReady),
        transportRegistryDecision: String(outputWriter.transportRegistryDecision || "DISABLED"),
        transportRegistrySelected: Array.isArray(outputWriter.transportRegistrySelected) ? outputWriter.transportRegistrySelected.map(String).slice(0, 12) : [],
        multiOutputRouterEnabled: Boolean(outputWriter.multiOutputRouterEnabled),
        multiOutputRouter: outputWriter.multiOutputRouter && typeof outputWriter.multiOutputRouter === "object" ? outputWriter.multiOutputRouter : null,
        commitPlanReady: Boolean(outputWriter.commitPlanReady),
        commitPlanDecision: String(outputWriter.commitPlanDecision || "DISABLED"),
        commitPlanPackets: Number(outputWriter.commitPlanPackets || 0),
        commitPlanPayloadBytes: Number(outputWriter.commitPlanPayloadBytes || 0),
        commitPlanTransports: Array.isArray(outputWriter.commitPlanTransports) ? outputWriter.commitPlanTransports.map(String).slice(0, 12) : [],
        commitPlanDigest: String(outputWriter.commitPlanDigest || "none"),
        commitPlanTouched: Boolean(outputWriter.commitPlanTouched),
        commitPlanBlockedReason: String(outputWriter.commitPlanBlockedReason || "--"),
        executionAuditExportEnabled: Boolean(outputWriter.executionAuditExportEnabled),
        executionAuditExportOk: Boolean(outputWriter.executionAuditExportOk),
        executionAuditExportDecision: String(outputWriter.executionAuditExportDecision || "DISABLED"),
        executionAuditExportSizeBytes: Number(outputWriter.executionAuditExportSizeBytes || 0),
        executionAuditExportDigest: String(outputWriter.executionAuditExportDigest || "none"),
        executionDebugPayloadEnabled: Boolean(outputWriter.executionDebugPayloadEnabled),
        executionDebugPayloadOk: Boolean(outputWriter.executionDebugPayloadOk),
        executionDebugPayloadDecision: String(outputWriter.executionDebugPayloadDecision || "DISABLED"),
        executionDebugPayload: outputWriter.executionDebugPayload && typeof outputWriter.executionDebugPayload === "object" ? outputWriter.executionDebugPayload : null,
        executionDebugPayloadDigest: String(outputWriter.executionDebugPayloadDigest || "none"),
        executionSanityMonitorEnabled: Boolean(outputWriter.executionSanityMonitorEnabled),
        executionSanityMonitorOk: Boolean(outputWriter.executionSanityMonitorOk),
        executionSanityMonitorDecision: String(outputWriter.executionSanityMonitorDecision || "DISABLED"),
        executionSanityMonitorIssueCount: Number(outputWriter.executionSanityMonitorIssueCount || 0),
        executionSanityMonitorIssues: Array.isArray(outputWriter.executionSanityMonitorIssues) ? outputWriter.executionSanityMonitorIssues : [],
        executionSanityMonitorDigest: String(outputWriter.executionSanityMonitorDigest || "none"),
        executionHealthSummaryEnabled: Boolean(outputWriter.executionHealthSummaryEnabled),
        executionHealthSummaryOk: Boolean(outputWriter.executionHealthSummaryOk),
        executionHealthSummaryDecision: String(outputWriter.executionHealthSummaryDecision || "DISABLED"),
        executionHealthSummaryStatus: String(outputWriter.executionHealthSummaryStatus || "OFF"),
        executionHealthSummarySeverity: String(outputWriter.executionHealthSummarySeverity || "off"),
        executionHealthSummary: outputWriter.executionHealthSummary && typeof outputWriter.executionHealthSummary === "object" ? outputWriter.executionHealthSummary : null,
        executionHealthSummaryDigest: String(outputWriter.executionHealthSummaryDigest || "none"),
        executionHealthTrendEnabled: Boolean(outputWriter.executionHealthTrendEnabled),
        executionHealthTrendOk: Boolean(outputWriter.executionHealthTrendOk),
        executionHealthTrendDecision: String(outputWriter.executionHealthTrendDecision || "DISABLED"),
        executionHealthTrendStatus: String(outputWriter.executionHealthTrendStatus || "OFF"),
        executionHealthTrendSeverity: String(outputWriter.executionHealthTrendSeverity || "off"),
        executionHealthTrend: outputWriter.executionHealthTrend && typeof outputWriter.executionHealthTrend === "object" ? outputWriter.executionHealthTrend : null,
        executionHealthTrendDigest: String(outputWriter.executionHealthTrendDigest || "none"),
        executionReadinessGateEnabled: Boolean(outputWriter.executionReadinessGateEnabled),
        executionReadinessGateOk: Boolean(outputWriter.executionReadinessGateOk),
        executionReadinessGateDecision: String(outputWriter.executionReadinessGateDecision || "DISABLED"),
        executionReadinessGateStatus: String(outputWriter.executionReadinessGateStatus || "OFF"),
        executionReadinessGateSeverity: String(outputWriter.executionReadinessGateSeverity || "off"),
        executionReadinessGate: outputWriter.executionReadinessGate && typeof outputWriter.executionReadinessGate === "object" ? outputWriter.executionReadinessGate : null,
        executionReadinessGateDigest: String(outputWriter.executionReadinessGateDigest || "none"),
        liveExecutorPreflightEnabled: Boolean(outputWriter.liveExecutorPreflightEnabled),
        liveExecutorPreflightOk: Boolean(outputWriter.liveExecutorPreflightOk),
        liveExecutorPreflightStatus: String(outputWriter.liveExecutorPreflightStatus || "OFF"),
        liveExecutorPreflightSeverity: String(outputWriter.liveExecutorPreflightSeverity || "off"),
        liveExecutorPreflightCanArmLive: Boolean(outputWriter.liveExecutorPreflightCanArmLive),
        liveExecutorPreflightDigest: String(outputWriter.liveExecutorPreflightDigest || "none"),
        liveFrameMirrorValidationEnabled: Boolean(outputWriter.liveFrameMirrorValidationEnabled),
        liveFrameMirrorValidationOk: Boolean(outputWriter.liveFrameMirrorValidationOk),
        liveFrameMirrorValidationStatus: String(outputWriter.liveFrameMirrorValidationStatus || "OFF"),
        liveFrameMirrorValidationSeverity: String(outputWriter.liveFrameMirrorValidationSeverity || "off"),
        liveFrameMirrorValidationDigest: String(outputWriter.liveFrameMirrorValidationDigest || "none"),
        liveControlledArmPhaseEnabled: Boolean(outputWriter.liveControlledArmPhaseEnabled),
        liveControlledArmPhaseOk: Boolean(outputWriter.liveControlledArmPhaseOk),
        liveControlledArmPhaseStatus: String(outputWriter.liveControlledArmPhaseStatus || "OFF"),
        liveControlledArmPhaseSeverity: String(outputWriter.liveControlledArmPhaseSeverity || "off"),
        liveControlledArmCanEnter: Boolean(outputWriter.liveControlledArmCanEnter),
        liveControlledArmToken: outputWriter.liveControlledArmToken || null,
        liveControlledArmBlocked: Array.isArray(outputWriter.liveControlledArmBlocked) ? outputWriter.liveControlledArmBlocked.map(String).slice(0, 12) : [],
        liveControlledArmWarnings: Array.isArray(outputWriter.liveControlledArmWarnings) ? outputWriter.liveControlledArmWarnings.map(String).slice(0, 12) : [],
        liveControlledArmPhaseDigest: String(outputWriter.liveControlledArmPhaseDigest || "none"),
        liveExecutorSkeletonEnabled: Boolean(outputWriter.liveExecutorSkeletonEnabled),
        liveExecutorSkeletonOk: Boolean(outputWriter.liveExecutorSkeletonOk),
        liveExecutorSkeletonDecision: String(outputWriter.liveExecutorSkeletonDecision || "DISABLED"),
        liveExecutorSkeletonStatus: String(outputWriter.liveExecutorSkeletonStatus || "OFF"),
        liveExecutorSkeletonSeverity: String(outputWriter.liveExecutorSkeletonSeverity || "off"),
        liveExecutorReady: Boolean(outputWriter.liveExecutorReady),
        liveExecutorTokenAccepted: Boolean(outputWriter.liveExecutorTokenAccepted),
        liveExecutorPlannedBatchCount: Number(outputWriter.liveExecutorPlannedBatchCount || 0),
        liveExecutorPlannedPacketCount: Number(outputWriter.liveExecutorPlannedPacketCount || 0),
        liveExecutorPlannedPayloadBytes: Number(outputWriter.liveExecutorPlannedPayloadBytes || 0),
        liveExecutorPlannedTransports: Array.isArray(outputWriter.liveExecutorPlannedTransports) ? outputWriter.liveExecutorPlannedTransports.map(String).slice(0, 12) : [],
        liveExecutorNullTransportTouched: Boolean(outputWriter.liveExecutorNullTransportTouched),
        liveExecutorMockExecuteCount: Number(outputWriter.liveExecutorMockExecuteCount || 0),
        liveExecutorSkeletonDigest: String(outputWriter.liveExecutorSkeletonDigest || "none"),
        liveExecutorDiagnosticsEnabled: Boolean(outputWriter.liveExecutorDiagnosticsEnabled),
        liveExecutorDiagnosticsOk: Boolean(outputWriter.liveExecutorDiagnosticsOk),
        liveExecutorDiagnosticsDecision: String(outputWriter.liveExecutorDiagnosticsDecision || "DISABLED"),
        liveExecutorDiagnosticsStatus: String(outputWriter.liveExecutorDiagnosticsStatus || "OFF"),
        liveExecutorDiagnosticsSeverity: String(outputWriter.liveExecutorDiagnosticsSeverity || "off"),
        liveExecutorDiagnosticsContractReady: Boolean(outputWriter.liveExecutorDiagnosticsContractReady),
        liveExecutorDiagnosticsAllowedTransports: Array.isArray(outputWriter.liveExecutorDiagnosticsAllowedTransports) ? outputWriter.liveExecutorDiagnosticsAllowedTransports.map(String).slice(0, 12) : [],
        liveExecutorDiagnosticsDigest: String(outputWriter.liveExecutorDiagnosticsDigest || "none"),
        liveStateMachineEnabled: Boolean(outputWriter.liveStateMachineEnabled),
        liveStateMachineOk: Boolean(outputWriter.liveStateMachineOk),
        liveStateMachineState: String(outputWriter.liveStateMachineState || "locked"),
        liveStateMachineDecision: String(outputWriter.liveStateMachineDecision || "DISABLED"),
        liveStateMachineStatus: String(outputWriter.liveStateMachineStatus || "OFF"),
        liveStateMachineSeverity: String(outputWriter.liveStateMachineSeverity || "off"),
        liveStateCanArm: Boolean(outputWriter.liveStateCanArm),
        liveStateIsArmed: Boolean(outputWriter.liveStateIsArmed),
        liveStateCanExecute: Boolean(outputWriter.liveStateCanExecute),
        liveStateWouldExecute: Boolean(outputWriter.liveStateWouldExecute),
        liveStateMachineDigest: String(outputWriter.liveStateMachineDigest || "none"),
        safety: String(outputWriter.safety || "writer live gate only")
      }) : null,
      activationSnapshot: activation ? Object.freeze({
        enabled: Boolean(activation.enabled),
        ran: Boolean(activation.ran),
        decision: String(activation.decision || "HOLD"),
        canActivate: Boolean(activation.canActivate),
        confidence: String(activation.confidence || "none"),
        blockerCount: Number(activation.blockerCount || 0),
        warningCount: Number(activation.warningCount || 0),
        blockers: Array.isArray(activation.blockers) ? activation.blockers.map(String).slice(0, 12) : [],
        warnings: Array.isArray(activation.warnings) ? activation.warnings.map(String).slice(0, 12) : [],
        reason: String(activation.reason || "--"),
        nextStep: String(activation.nextStep || "keep next engine in shadow mode"),
        safety: String(activation.safety || "read-only")
      }) : null
    };
  }

  function pushNextEngineShadowHistory(snapshot) {
    if (!snapshot || typeof snapshot !== "object") return;
    const history = Array.isArray(schedulerDebugState.nextEngineShadowHistory)
      ? schedulerDebugState.nextEngineShadowHistory
      : [];
    history.push(Object.freeze({
      updatedAt: Number(snapshot.updatedAt || performanceRef.now()),
      enabled: Boolean(snapshot.enabled),
      ran: Boolean(snapshot.ran),
      compatible: Boolean(snapshot.compatible),
      mismatch: Boolean(snapshot.mismatch),
      frameId: Number(snapshot.frameId || 0),
      legacyFrameId: Number(snapshot.legacyFrameId || 0),
      checksum: Number(snapshot.checksum || 0),
      legacyChecksum: Number(snapshot.legacyChecksum || 0),
      reason: String(snapshot.reason || "--")
    }));
    while (history.length > 32) history.shift();
    schedulerDebugState.nextEngineShadowHistory = history;
  }

  function captureRenderPipelineMetric(metric) {
    if (!metric || typeof metric !== "object") return;
    const sampleOnly = metric.sampleOnly === true;
    if (metric.kind === "nextEngineShadow") {
      schedulerDebugState.nextEngineShadow = normalizeNextEngineShadowMetric(metric);
      pushNextEngineShadowHistory(schedulerDebugState.nextEngineShadow);
      if (!sampleOnly) {
        telemetryBus?.counter?.("nextEngineShadow.samples", 1);
        if (schedulerDebugState.nextEngineShadow.mismatch) telemetryBus?.counter?.("nextEngineShadow.mismatch", 1);
        telemetryBus?.emit?.("nextEngineShadow", schedulerDebugState.nextEngineShadow);
      }
      return;
    }
    if (metric.kind === "render") {
      const renderMs = Math.max(0, Number(metric.renderMs || 0));
      const previewMs = Math.max(0, Number(metric.previewDrawMs || 0));
      const lateMs = Math.max(0, Number(metric.lateByMs || 0));
      perfProfileMetrics.renderFrames += 1;
      perfProfileMetrics.renderDropped += Number(metric.skipped || 0) > 0 ? 1 : 0;
      perfProfileMetrics.renderMsSum += renderMs;
      perfProfileMetrics.previewDrawMsSum += previewMs;
      perfProfileMetrics.renderLateMsSum += lateMs;
      if (renderMs > perfProfileMetrics.renderMsMax) perfProfileMetrics.renderMsMax = renderMs;
      if (!sampleOnly) telemetryBus.recordRenderMetric(metric);
      return;
    }
    if (metric.kind === "outputTick") {
      const tickMs = Math.max(0, Number(metric.tickMs || 0));
      const driftMs = Math.max(0, Number(metric.driftMs || 0));
      perfProfileMetrics.outputTicks += 1;
      perfProfileMetrics.outputTickMsSum += tickMs;
      perfProfileMetrics.outputDriftMsSum += driftMs;
      if (tickMs > perfProfileMetrics.outputTickMsMax) perfProfileMetrics.outputTickMsMax = tickMs;
      if (!sampleOnly) telemetryBus.recordOutputTick(metric);
    }
  }

  function readPerfProfileSnapshot() {
    const now = performanceRef.now();
    const frameAuthorityStats = typeof getRuntimeFrameAuthority === "function" ? getRuntimeFrameAuthority()?.getStats?.() : null;
    const frameBusStats = frameAuthorityStats?.bus || getRuntimeFrameBus().getStats();
    const outputPipelineMetrics = getOutputPipelineMetrics() || {};
    const elapsedMs = Math.max(1, now - perfProfileMetrics.windowStartedAt);
    const elapsedSec = elapsedMs / 1000;
    const renderFps = perfProfileMetrics.renderFrames / elapsedSec;
    const outputTickFps = perfProfileMetrics.outputTicks / elapsedSec;
    const state = getState() || {};
    return {
      elapsedMs: Math.round(elapsedMs),
      renderFps: Number(renderFps.toFixed(2)),
      outputTickFps: Number(outputTickFps.toFixed(2)),
      outputTargetFps: (() => {
        const targetFpsReader = (typeof getRuntimeTargetFps === "function")
          ? getRuntimeTargetFps
          : (typeof windowRef?.getRuntimeTargetFps === "function" ? windowRef.getRuntimeTargetFps : null);
        const fpsValue = Number(targetFpsReader ? targetFpsReader() : (state.fps || 0));
        return Number.isFinite(fpsValue) ? Number(fpsValue.toFixed(2)) : 0;
      })(),
      outputClock: clonePlain(schedulerDebugState.outputClock || null),
      renderFrames: perfProfileMetrics.renderFrames,
      outputTicks: perfProfileMetrics.outputTicks,
      renderAvgMs: Number((perfProfileMetrics.renderMsSum / Math.max(1, perfProfileMetrics.renderFrames)).toFixed(2)),
      renderMaxMs: Number(perfProfileMetrics.renderMsMax.toFixed(2)),
      previewAvgMs: Number((perfProfileMetrics.previewDrawMsSum / Math.max(1, perfProfileMetrics.renderFrames)).toFixed(2)),
      lateAvgMs: Number((perfProfileMetrics.renderLateMsSum / Math.max(1, perfProfileMetrics.renderFrames)).toFixed(2)),
      renderDropped: perfProfileMetrics.renderDropped,
      outputTickAvgMs: Number((perfProfileMetrics.outputTickMsSum / Math.max(1, perfProfileMetrics.outputTicks)).toFixed(2)),
      outputTickMaxMs: Number(perfProfileMetrics.outputTickMsMax.toFixed(2)),
      outputDriftAvgMs: Number((perfProfileMetrics.outputDriftMsSum / Math.max(1, perfProfileMetrics.outputTicks)).toFixed(2)),
      outputQueueDepth: Number(outputPipelineMetrics.queueDepth || 0),
      outputDropped: Number(outputPipelineMetrics.dropped || 0),
      outputLatencyMs: Number(outputPipelineMetrics.lastLatencyMs || 0),
      outputSendMs: Number(outputPipelineMetrics.lastSendMs || 0),
      outputPausedMs: Number(outputPipelineMetrics.pausedMs || 0),
      uiSyncAvgMs: Number((perfProfileMetrics.uiSyncMsSum / Math.max(1, perfProfileMetrics.uiSyncCalls)).toFixed(3)),
      uiSyncMaxMs: Number(perfProfileMetrics.uiSyncMsMax.toFixed(3)),
      debugSyncAvgMs: Number((perfProfileMetrics.debugSyncMsSum / Math.max(1, perfProfileMetrics.debugSyncCalls)).toFixed(3)),
      debugSyncMaxMs: Number(perfProfileMetrics.debugSyncMsMax.toFixed(3)),
      uiSyncCalls: perfProfileMetrics.uiSyncCalls,
      debugSyncCalls: perfProfileMetrics.debugSyncCalls,
      frameBus: frameBusStats,
      frameAuthority: frameAuthorityStats,
      nextEngineShadow: schedulerDebugState.nextEngineShadow || null,
      nextEngineShadowHistory: Array.isArray(schedulerDebugState.nextEngineShadowHistory)
        ? schedulerDebugState.nextEngineShadowHistory.slice(-32)
        : [],
      runtimeTrace: {
        frameBus: frameBusStats,
        frameAuthority: frameAuthorityStats,
        renderFrameId: Number(frameBusStats.latestFrameId || 0),
        outputFrameId: Number(schedulerDebugState.outputFrameId || 0),
        outputSource: String(schedulerDebugState.outputFrameSource || "--"),
        outputFrameAgeMs: Number(schedulerDebugState.outputFrameAgeMs || 0),
        outputEnabled: Boolean(schedulerDebugState.outputEnabled),
        serialEnabled: Boolean(schedulerDebugState.serialEnabled),
        outputBlockedReason: String(schedulerDebugState.outputBlockedReason || "--"),
        stateEnabled: Boolean(state.enabled),
        protocolOutputEnabled: Boolean(getOutputEnabled()),
        startupFrameGuard: Boolean(getStartupFrameGuard()),
        headless: Boolean(isHeadless()),
        shellViewOnly: Boolean(isShellViewOnly()),
        headlessLeaderActive: Boolean(getHeadlessLeader()?.isActive?.()),
        effectiveOutputMode: effectiveOutputMode(),
        source: frameBusStats.lastSource || "none"
      },
      telemetry: telemetryBus.snapshot({ compact: true, frameBus: frameBusStats, frameAuthority: frameAuthorityStats })
    };
  }

  return {
    reportOutputFrame,
    installShellRunnerOutputFrameReceiver,
    captureUiSyncMetric,
    captureDebugSyncMetric,
    captureRenderPipelineMetric,
    readPerfProfileSnapshot,
    getLatestRuntimeDetail
  };
}
