// STEP 11P — Live Executor Preflight Harness
// Dry-run only. This module performs readiness checks for a future live executor arm
// without touching serial, network, sockets, files, DOM, or any physical output API.

import { freezeList, freezeUniqueList } from "./list_utils.js";

export const LIVE_EXECUTOR_PREFLIGHT_VERSION = "11P-live-executor-preflight";

function asNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function hasAnyGuardTrip(...values) {
  return values.some((value) => Boolean(
    value?.physicalWriteAllowed ||
    value?.outputTouched ||
    value?.networkTouched ||
    value?.serialTouched ||
    value?.writeTouched ||
    value?.socketTouched
  ));
}

function deriveFramePixels(frame = null) {
  if (!frame) return 0;
  if (Array.isArray(frame.pixels)) return frame.pixels.length;
  if (ArrayBuffer.isView(frame.pixels)) return Math.floor(frame.pixels.length / 3);
  if (ArrayBuffer.isView(frame)) return Math.floor(frame.length / 3);
  if (Array.isArray(frame)) return Math.floor(frame.length / 3);
  return asNumber(frame.pixelCount || frame.pixelsCount || 0, 0);
}

function deriveExpectedPixels({ mapping = null, routePlan = null, segmentManifest = null, transportBatchPlan = null } = {}) {
  const fromMapping = Array.isArray(mapping?.segments)
    ? mapping.segments.reduce((sum, seg) => sum + asNumber(seg?.physical?.pixelCount ?? seg?.pixelCount ?? seg?.pixels, 0), 0)
    : 0;
  return Math.max(
    fromMapping,
    asNumber(routePlan?.pixelCount || routePlan?.totalPixels, 0),
    asNumber(segmentManifest?.pixelCount || segmentManifest?.totalPixels, 0),
    asNumber(transportBatchPlan?.pixelCount || transportBatchPlan?.totalPixels, 0)
  );
}

function deriveFrameAgeMs({ frame = null, nowMs = Date.now(), frameTimestampMs = null } = {}) {
  const ts = asNumber(frameTimestampMs ?? frame?.timestampMs ?? frame?.timestamp ?? frame?.meta?.timestampMs ?? frame?.meta?.timestamp, 0);
  if (!ts) return 0;
  const normalized = ts < 10000000000 ? ts * 1000 : ts;
  return Math.max(0, asNumber(nowMs, Date.now()) - normalized);
}

function routeCountOf(value) {
  return asNumber(value?.routeCount ?? value?.routePlanCount ?? value?.transportBatchCount ?? 0, 0);
}

function collectTransportIds({ selectedTransports = [], routePlan = null, transportBatchPlan = null, segmentManifest = null } = {}) {
  const values = [];
  for (const id of selectedTransports || []) values.push(String(id || "").trim().toLowerCase());
  for (const route of segmentManifest?.routes || []) values.push(String(route?.output || route?.transport || "").trim().toLowerCase());
  for (const route of routePlan?.routePlans || []) values.push(String(route?.transport || "").trim().toLowerCase());
  for (const batch of transportBatchPlan?.transportBatches || []) values.push(String(batch?.transport || "").trim().toLowerCase());
  return freezeUniqueList(values.filter(Boolean).filter((id) => id !== "none" && id !== "unknown"));
}

export function runLiveExecutorPreflight({
  enabled = false,
  frame = null,
  frameSource = null,
  frameTimestampMs = null,
  nowMs = Date.now(),
  mapping = null,
  selectedTransports = [],
  resolved = null,
  registry = null,
  segmentManifest = null,
  routePlan = null,
  transportBatchPlan = null,
  validation = null,
  schedule = null,
  healthSummary = null,
  healthTrend = null,
  readinessGate = null,
  writer = null,
  adapter = null,
  targetFPS = 60,
  staleWarnMs = 100,
  staleBlockMs = 250,
  jitterWarnMs = 10,
  dropWarnRatio = 0.03,
  frameId = 0
} = {}) {
  if (!enabled) {
    return Object.freeze({
      version: LIVE_EXECUTOR_PREFLIGHT_VERSION,
      enabled: false,
      ok: false,
      canArmLive: false,
      decision: "DISABLED",
      status: "OFF",
      severity: "off",
      frameId: asNumber(frameId, 0),
      checks: Object.freeze({}),
      metrics: Object.freeze({}),
      warnings: freezeList([]),
      blocked: freezeList([]),
      blockerCount: 0,
      warningCount: 0,
      digest: "none",
      dryRunOnly: true,
      physicalWriteAllowed: false,
      outputTouched: false,
      networkTouched: false,
      serialTouched: false
    });
  }

  const blocked = [];
  const warnings = [];
  const addBlock = (code) => { if (!blocked.includes(code)) blocked.push(code); };
  const addWarn = (code) => { if (!warnings.includes(code)) warnings.push(code); };

  const source = String(frameSource || frame?.source || frame?.meta?.source || "").toLowerCase();
  const frameAuthority = source === "frame_bus" || source === "authoritative_frame" || source === "qa-authoritative-frame";
  if (!frameAuthority) addBlock("OUTPUT_RENDER_OWNERSHIP_VIOLATION");

  const frameAgeMs = deriveFrameAgeMs({ frame, nowMs, frameTimestampMs });
  if (frameAgeMs > staleBlockMs) addBlock("STALE_FRAME");
  else if (frameAgeMs > staleWarnMs) addWarn("FRAME_AGE_WARNING");

  const mappingLoaded = Boolean(mapping && Array.isArray(mapping.segments) && mapping.segments.length > 0);
  if (!mappingLoaded) addBlock("NO_ACTIVE_MAPPING");

  const transportIds = collectTransportIds({ selectedTransports, routePlan, transportBatchPlan, segmentManifest });
  const transportSelected = transportIds.length > 0;
  if (!transportSelected) addBlock("NO_TRANSPORT_SELECTED");

  const resolvedSelected = Array.isArray(resolved?.selected) ? resolved.selected.map((id) => String(id).toLowerCase()) : null;
  const transportCapable = resolvedSelected ? transportIds.every((id) => resolvedSelected.includes(id)) : true;
  if (!transportCapable) addBlock("TRANSPORT_NOT_CAPABLE");

  const routeManifest = Boolean(segmentManifest?.ok !== false && routeCountOf(segmentManifest) > 0);
  if (!routeManifest) addBlock("ROUTE_MANIFEST_MISSING");

  const routeResolved = Boolean(routePlan?.ok !== false && routeCountOf(routePlan) > 0 && transportBatchPlan?.ok !== false && routeCountOf(transportBatchPlan) > 0);
  if (!routeResolved) addBlock("ROUTE_INCOMPLETE");

  const expectedPixels = deriveExpectedPixels({ mapping, routePlan, segmentManifest, transportBatchPlan });
  const actualPixels = deriveFramePixels(frame);
  const frameSizeValid = expectedPixels <= 0 || actualPixels <= 0 || actualPixels === expectedPixels;
  if (!frameSizeValid) addBlock("FRAME_SIZE_MISMATCH");

  const packetEstimate = Math.max(
    asNumber(schedule?.totalPacketEstimate || schedule?.packetEstimate, 0),
    asNumber(transportBatchPlan?.packetEstimate, 0),
    asNumber(routePlan?.packetEstimate, 0)
  );
  const payloadBytes = Math.max(
    asNumber(schedule?.totalPayloadBytes || schedule?.payloadBytes, 0),
    asNumber(transportBatchPlan?.payloadBytes, 0),
    asNumber(routePlan?.payloadBytes, 0)
  );
  const fps = Math.max(1, asNumber(targetFPS || schedule?.targetFPS, 60));
  const bandwidthBytesPerSecond = payloadBytes * fps;
  const packetBudgetValid = packetEstimate > 0 && payloadBytes > 0;
  if (!packetBudgetValid) addBlock("PACKET_BUDGET_INVALID");
  if (packetEstimate > 64 || bandwidthBytesPerSecond > 4_000_000) addWarn("PACKET_BUDGET_HIGH");

  const schedulerHealthy = Boolean(schedule?.ok !== false && validation?.ok !== false);
  if (!schedulerHealthy) addBlock("UNSTABLE_TIMING");

  const jitterMs = asNumber(healthSummary?.summary?.jitterMs ?? healthTrend?.jitterMs ?? 0, 0);
  const droppedRatio = asNumber(healthSummary?.summary?.droppedFrameRatio ?? healthTrend?.droppedFrameRatio ?? 0, 0);
  if (jitterMs > jitterWarnMs || droppedRatio > dropWarnRatio) addWarn("TIMING_WATCH");

  const memoryHealthy = !Boolean(healthSummary?.summary?.memoryGrowthDetected || healthTrend?.memoryGrowthDetected);
  if (!memoryHealthy) addWarn("MEMORY_GROWTH_DETECTED");

  const writerReady = writer ? writer.ready !== false : true;
  const adapterReady = adapter ? adapter.ready !== false : true;
  if (!writerReady || !adapterReady) addBlock("WRITER_NOT_READY");

  const gateReady = Boolean(readinessGate?.ok || readinessGate?.readyForDryRunCommit || readinessGate?.status === "READY_DRY_RUN" || readinessGate?.status === "READY_DRY_RUN_WITH_WARNINGS");
  if (!gateReady) addBlock("READINESS_GATE_NOT_READY");

  const guardTrip = hasAnyGuardTrip(frame, resolved, segmentManifest, routePlan, transportBatchPlan, validation, schedule, healthSummary, healthTrend, readinessGate, writer, adapter);
  if (guardTrip) addBlock("UNEXPECTED_LIVE_ENABLE");

  const dryRunProtected = !guardTrip && readinessGate?.dryRunOnly !== false;
  if (!dryRunProtected) addBlock("DRY_RUN_PROTECTION_MISSING");

  const checks = Object.freeze({
    frameAuthority,
    frameFresh: frameAgeMs <= staleBlockMs,
    mappingLoaded,
    transportSelected,
    transportCapable,
    routeManifest,
    routeResolved,
    frameSizeValid,
    packetBudgetValid,
    schedulerHealthy,
    memoryHealthy,
    writerReady: writerReady && adapterReady,
    gateReady,
    dryRunProtected
  });

  const ok = blocked.length === 0;
  const status = ok ? (warnings.length ? "CAN_ARM_LIVE_WITH_WARNINGS" : "CAN_ARM_LIVE") : "BLOCKED";
  const severity = ok ? (warnings.length ? "warning" : "ok") : "error";
  const decision = ok ? "PREFLIGHT_OK_DRY_RUN" : "PREFLIGHT_BLOCKED";
  const safeFrameId = asNumber(frameId || frame?.frameId || frame?.meta?.frameId || readinessGate?.frameId, 0);
  const metrics = Object.freeze({
    frameId: safeFrameId,
    frameAgeMs,
    expectedPixels,
    actualPixels,
    packetEstimate,
    payloadBytes,
    targetFPS: fps,
    bandwidthBytesPerSecond,
    transportCount: transportIds.length,
    routeCount: Math.max(routeCountOf(segmentManifest), routeCountOf(routePlan), routeCountOf(transportBatchPlan)),
    jitterMs,
    droppedRatio
  });
  const digest = ["preflight", safeFrameId, status, blocked.join("+") || "none", warnings.join("+") || "none", packetEstimate, payloadBytes].join(":");

  return Object.freeze({
    version: LIVE_EXECUTOR_PREFLIGHT_VERSION,
    enabled: true,
    ok,
    canArmLive: ok,
    decision,
    status,
    severity,
    frameId: safeFrameId,
    checks,
    metrics,
    warnings: freezeList(warnings),
    blocked: freezeList(blocked),
    blockerCount: blocked.length,
    warningCount: warnings.length,
    digest,
    dryRunOnly: true,
    physicalWriteAllowed: false,
    outputTouched: false,
    networkTouched: false,
    serialTouched: false,
    safety: "11P preflight is dry-run only and never writes to serial/network/output"
  });
}
