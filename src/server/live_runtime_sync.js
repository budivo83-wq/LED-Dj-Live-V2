export const LIVE_RUNTIME_SYNC_VERSION = "12K-runtime-server-live-state-sync";

function latestAuditEvent(auditLog) {
  try {
    const audit = auditLog?.read?.({ limit: 1 }) || null;
    const entries = Array.isArray(audit?.entries) ? audit.entries : [];
    return entries[0] || null;
  } catch {
    return null;
  }
}

function list(value) {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function statusOfLive(live = {}) {
  if (live.emergencyStopLatched) return "STOPPED";
  return String(live.status || "DISARMED").toUpperCase();
}

function tokenDigest(tokenGate = {}) {
  return String(tokenGate.tokenDigest || tokenGate.digest || "none");
}

export function createLiveRuntimeSync({
  liveStateStore,
  liveReadinessSummary = null,
  liveFullEnableTokenGate = null,
  liveAuditLog = null
} = {}) {
  if (!liveStateStore) throw new Error("live runtime sync requires liveStateStore");

  function read() {
    const live = liveStateStore.read();
    const readiness = liveReadinessSummary?.read?.() || null;
    const tokenGate = liveFullEnableTokenGate?.snapshot?.() || readiness?.tokenGate || null;
    const latestAudit = latestAuditEvent(liveAuditLog);

    const mismatches = [];
    const warnings = [];
    const liveStatus = statusOfLive(live);
    const readinessStatus = String(readiness?.status || "UNKNOWN").toUpperCase();

    if (readiness?.live) {
      const embeddedStatus = statusOfLive(readiness.live);
      if (embeddedStatus !== liveStatus) mismatches.push(`LIVE_STATUS_MISMATCH:${liveStatus}/${embeddedStatus}`);
      if (Boolean(readiness.live.emergencyStopLatched) !== Boolean(live.emergencyStopLatched)) {
        mismatches.push("EMERGENCY_STOP_MISMATCH");
      }
    } else {
      warnings.push("READINESS_LIVE_EMBED_MISSING");
    }

    if (live.emergencyStopLatched && readinessStatus !== "STOPPED") {
      mismatches.push(`READINESS_STOP_STATUS_MISMATCH:${readinessStatus}`);
    }
    if (!live.emergencyStopLatched && readinessStatus === "STOPPED") {
      mismatches.push("READINESS_STOPPED_WITHOUT_LATCH");
    }

    if (live.physicalWriteAllowed === true || readiness?.physicalWriteAllowed === true) {
      mismatches.push("PHYSICAL_WRITE_UNEXPECTEDLY_ALLOWED");
    }
    if (readiness?.outputTouched || readiness?.serialTouched || readiness?.networkTouched) {
      mismatches.push("READINESS_SIDE_EFFECT_TOUCHED");
    }

    const liveDigest = String(live.armTokenDigest || "none");
    const gateDigest = tokenDigest(tokenGate);
    if (tokenGate?.active && gateDigest === "none") warnings.push("TOKEN_ACTIVE_WITHOUT_DIGEST");
    if (liveDigest !== "none" && tokenGate?.active && gateDigest !== "none" && liveDigest === gateDigest) {
      warnings.push("INTENT_DIGEST_EQUALS_FULL_TOKEN_DIGEST");
    }

    const ok = mismatches.length === 0;
    return Object.freeze({
      version: LIVE_RUNTIME_SYNC_VERSION,
      ok,
      status: ok ? "SYNCED" : "DESYNC",
      decision: ok ? "LIVE_RUNTIME_SERVER_SYNC_OK" : "LIVE_RUNTIME_SERVER_DESYNC",
      liveStatus,
      readinessStatus,
      emergencyStopLatched: Boolean(live.emergencyStopLatched),
      tokenDigest: gateDigest,
      blockers: list(readiness?.blockers),
      mismatches: Object.freeze(mismatches),
      warnings: Object.freeze(warnings),
      live,
      readiness,
      tokenGate,
      latestAudit,
      physicalWriteAllowed: false,
      outputTouched: false,
      serialTouched: false,
      networkTouched: false,
      safety: "12K compares browser/server-facing live state snapshots only; no physical write is performed"
    });
  }

  return Object.freeze({
    version: LIVE_RUNTIME_SYNC_VERSION,
    read
  });
}
