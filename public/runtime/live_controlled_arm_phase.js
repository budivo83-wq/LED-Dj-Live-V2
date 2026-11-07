// STEP 11R — Controlled Arm Phase
// Dry-run only. Produces a deterministic arming decision/token for a future live
// executor while keeping all physical output guards locked. This module must never
// write to serial, network, sockets, filesystem, DOM, or output adapters.

export const LIVE_CONTROLLED_ARM_PHASE_VERSION = "11R-live-controlled-arm-phase";

function asNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function freezeList(values) {
  return Object.freeze([...(Array.isArray(values) ? values : [])]);
}

function hasAnyGuardTrip(...values) {
  return values.some((value) => Boolean(
    value?.physicalWriteAllowed ||
    value?.outputTouched ||
    value?.networkTouched ||
    value?.serialTouched ||
    value?.writeTouched ||
    value?.socketTouched ||
    value?.liveWriteEnabled
  ));
}

function normalizeIntent(intent = null) {
  if (!intent || typeof intent !== "object") return Object.freeze({ requested: false, mode: "none", source: "none" });
  const requested = Boolean(intent.requested || intent.armRequested || intent.operatorConfirmed || intent.enableArm);
  const mode = String(intent.mode || intent.phase || "controlled-arm").toLowerCase();
  const source = String(intent.source || intent.requestSource || "operator").toLowerCase();
  const confirmed = Boolean(intent.operatorConfirmed || intent.confirmed || intent.secondConfirm);
  const dryRunAcknowledged = intent.dryRunAcknowledged !== false;
  return Object.freeze({ requested, mode, source, confirmed, dryRunAcknowledged });
}

function digestString(input) {
  const text = String(input || "");
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

export function runLiveControlledArmPhase({
  enabled = false,
  operatorIntent = null,
  liveExecutorPreflight = null,
  liveFrameMirrorValidation = null,
  executionReadinessGate = null,
  executionCommitPreview = null,
  frameId = 0,
  nowMs = Date.now(),
  holdoffMs = 1000,
  lastDisarmMs = null,
  previousArmToken = null,
  allowWarnings = true
} = {}) {
  if (!enabled) {
    return Object.freeze({
      version: LIVE_CONTROLLED_ARM_PHASE_VERSION,
      enabled: false,
      ok: false,
      canEnterControlledArm: false,
      status: "OFF",
      decision: "DISABLED",
      severity: "off",
      frameId: asNumber(frameId, 0),
      token: null,
      checks: Object.freeze({}),
      metrics: Object.freeze({}),
      warnings: freezeList([]),
      blocked: freezeList([]),
      blockerCount: 0,
      warningCount: 0,
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

  const intent = normalizeIntent(operatorIntent);
  if (!intent.requested) addBlock("ARM_INTENT_MISSING");
  if (!intent.confirmed) addBlock("OPERATOR_CONFIRMATION_MISSING");
  if (!intent.dryRunAcknowledged) addBlock("DRY_RUN_ACK_MISSING");

  const safeFrameId = asNumber(frameId || liveExecutorPreflight?.frameId || liveFrameMirrorValidation?.frameId || executionReadinessGate?.frameId, 0);

  const preflightOk = Boolean(liveExecutorPreflight?.ok && liveExecutorPreflight?.canArmLive);
  if (!preflightOk) addBlock("PREFLIGHT_NOT_OK");

  const mirrorOk = Boolean(liveFrameMirrorValidation?.ok && liveFrameMirrorValidation?.canValidateLiveMirror);
  if (!mirrorOk) addBlock("MIRROR_NOT_VALIDATED");

  const readinessOk = Boolean(
    executionReadinessGate?.ok ||
    executionReadinessGate?.readyForDryRunCommit ||
    executionReadinessGate?.status === "READY_DRY_RUN" ||
    executionReadinessGate?.status === "READY_DRY_RUN_WITH_WARNINGS"
  );
  if (!readinessOk) addBlock("READINESS_GATE_NOT_READY");

  const commitPreviewOk = executionCommitPreview ? Boolean(executionCommitPreview?.ok || executionCommitPreview?.operationCount > 0 || executionCommitPreview?.preview?.operationCount > 0) : true;
  if (!commitPreviewOk) addBlock("COMMIT_PREVIEW_NOT_OK");

  const preflightFrameId = asNumber(liveExecutorPreflight?.frameId, safeFrameId);
  const mirrorFrameId = asNumber(liveFrameMirrorValidation?.frameId, safeFrameId);
  const gateFrameId = asNumber(executionReadinessGate?.frameId, safeFrameId);
  const commitFrameId = asNumber(executionCommitPreview?.frameId ?? executionCommitPreview?.preview?.frameId, safeFrameId);
  const frameIdsAligned = [preflightFrameId, mirrorFrameId, gateFrameId, commitFrameId].every((id) => id === safeFrameId);
  if (!frameIdsAligned) addBlock("ARM_FRAME_ID_MISMATCH");

  const now = asNumber(nowMs, Date.now());
  const lastDisarm = lastDisarmMs == null ? null : asNumber(lastDisarmMs, null);
  const holdoffRemainingMs = lastDisarm == null ? 0 : Math.max(0, asNumber(holdoffMs, 1000) - Math.max(0, now - lastDisarm));
  if (holdoffRemainingMs > 0) addBlock("ARM_HOLDOFF_ACTIVE");

  if (!allowWarnings) {
    const warningCount = asNumber(liveExecutorPreflight?.warningCount, 0) + asNumber(liveFrameMirrorValidation?.warningCount, 0);
    if (warningCount > 0) addBlock("WARNINGS_NOT_ALLOWED");
  } else if (asNumber(liveExecutorPreflight?.warningCount, 0) + asNumber(liveFrameMirrorValidation?.warningCount, 0) > 0) {
    addWarn("ARM_WITH_WARNINGS");
  }

  const guardTrip = hasAnyGuardTrip(liveExecutorPreflight, liveFrameMirrorValidation, executionReadinessGate, executionCommitPreview, operatorIntent);
  if (guardTrip) addBlock("ARM_GUARD_VIOLATION");

  const dryRunProtected = !guardTrip && executionReadinessGate?.dryRunOnly !== false && liveExecutorPreflight?.dryRunOnly !== false && liveFrameMirrorValidation?.dryRunOnly !== false;
  if (!dryRunProtected) addBlock("DRY_RUN_PROTECTION_MISSING");

  const stableDigest = [
    "arm11r",
    safeFrameId,
    liveExecutorPreflight?.digest || "preflight-none",
    liveFrameMirrorValidation?.digest || "mirror-none",
    executionReadinessGate?.digest || "gate-none",
    executionCommitPreview?.digest || "commit-none",
    intent.source,
    intent.mode
  ].join(":");
  const token = blocked.length === 0 ? `ARM11R-${safeFrameId}-${digestString(stableDigest)}` : null;
  if (previousArmToken && token && previousArmToken !== token) addWarn("ARM_TOKEN_CHANGED");

  const checks = Object.freeze({
    armIntentPresent: intent.requested,
    operatorConfirmed: intent.confirmed,
    dryRunAcknowledged: intent.dryRunAcknowledged,
    preflightOk,
    mirrorOk,
    readinessOk,
    commitPreviewOk,
    frameIdsAligned,
    holdoffClear: holdoffRemainingMs <= 0,
    dryRunProtected
  });
  const metrics = Object.freeze({
    frameId: safeFrameId,
    holdoffRemainingMs,
    preflightWarnings: asNumber(liveExecutorPreflight?.warningCount, 0),
    mirrorWarnings: asNumber(liveFrameMirrorValidation?.warningCount, 0),
    commitOperations: asNumber(executionCommitPreview?.operationCount ?? executionCommitPreview?.preview?.operationCount, 0)
  });

  const ok = blocked.length === 0;
  const status = ok ? (warnings.length ? "CONTROLLED_ARM_READY_WITH_WARNINGS" : "CONTROLLED_ARM_READY") : "BLOCKED";
  const severity = ok ? (warnings.length ? "warning" : "ok") : "error";
  const decision = ok ? "CONTROLLED_ARM_TOKEN_DRY_RUN" : "CONTROLLED_ARM_BLOCKED";

  return Object.freeze({
    version: LIVE_CONTROLLED_ARM_PHASE_VERSION,
    enabled: true,
    ok,
    canEnterControlledArm: ok,
    status,
    decision,
    severity,
    frameId: safeFrameId,
    token,
    intent,
    checks,
    metrics,
    warnings: freezeList(warnings),
    blocked: freezeList(blocked),
    blockerCount: blocked.length,
    warningCount: warnings.length,
    digest: ["controlled-arm", safeFrameId, status, token || "blocked", blocked.join("+") || "none", warnings.join("+") || "none"].join(":"),
    dryRunOnly: true,
    physicalWriteAllowed: false,
    outputTouched: false,
    networkTouched: false,
    serialTouched: false,
    safety: "11R controlled arm phase is dry-run only; it creates an arm token but never writes to physical output"
  });
}
