import crypto from "crypto";

export const LIVE_FULL_ENABLE_TOKEN_VERSION = "12E-full-live-explicit-arm-token";

const REQUIRED_CONFIRMATION = "CONFIRM_FULL_LIVE_ENABLE";
const DEFAULT_TTL_MS = 60_000;

function digestText(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex").slice(0, 16);
}

function normalizeContext(value = {}) {
  return Object.freeze({
    mappingDigest: String(value.mappingDigest || ""),
    transportPlanDigest: String(value.transportPlanDigest || ""),
    outputMode: String(value.outputMode || ""),
    operatorConfirmed: Boolean(value.operatorConfirmed),
    confirmation: String(value.confirmation || "")
  });
}

function contextReady(context) {
  return Boolean(
    context.mappingDigest
    && context.transportPlanDigest
    && context.outputMode
    && context.operatorConfirmed
    && context.confirmation === REQUIRED_CONFIRMATION
  );
}

export function createLiveFullEnableTokenGate({
  liveStateStore,
  now = () => Date.now(),
  ttlMs = DEFAULT_TTL_MS
} = {}) {
  if (!liveStateStore) throw new Error("full live token gate requires liveStateStore");
  let active = null;

  function revoke(reason = "revoked") {
    const previous = active;
    active = null;
    return Object.freeze({
      version: LIVE_FULL_ENABLE_TOKEN_VERSION,
      ok: true,
      decision: "FULL_LIVE_TOKEN_REVOKED",
      reason: String(reason || "revoked"),
      revokedDigest: previous?.digest || "none",
      physicalWriteAllowed: false
    });
  }

  function issue(request = {}) {
    const context = normalizeContext(request);
    const live = liveStateStore.read();
    const blocked = [];

    if (live.emergencyStopLatched) blocked.push("EMERGENCY_STOP_LATCHED");
    if (!contextReady(context)) blocked.push("FULL_LIVE_CONFIRMATION_OR_CONTEXT_MISSING");

    if (blocked.length) {
      return Object.freeze({
        version: LIVE_FULL_ENABLE_TOKEN_VERSION,
        ok: false,
        decision: "FULL_LIVE_TOKEN_BLOCKED",
        token: null,
        tokenDigest: "none",
        expiresAt: null,
        context,
        blocked: Object.freeze(blocked),
        physicalWriteAllowed: false,
        safety: "12E token issue blocked; no physical write is enabled"
      });
    }

    const expiresAt = now() + Math.max(1_000, Number(ttlMs || DEFAULT_TTL_MS));
    const raw = crypto.randomBytes(24).toString("hex");
    const digest = digestText(`${raw}:${JSON.stringify(context)}:${expiresAt}`);
    active = Object.freeze({ raw, digest, context, expiresAt, issuedAt: now() });

    return Object.freeze({
      version: LIVE_FULL_ENABLE_TOKEN_VERSION,
      ok: true,
      decision: "FULL_LIVE_TOKEN_ISSUED",
      token: raw,
      tokenDigest: digest,
      expiresAt,
      context,
      blocked: Object.freeze([]),
      physicalWriteAllowed: false,
      safety: "12E issued an explicit full-live arm token, but physical write remains blocked until a future boundary release"
    });
  }

  function validate(request = {}) {
    const context = normalizeContext(request);
    const token = String(request.token || "");
    const blocked = [];
    const live = liveStateStore.read();

    if (!active) blocked.push("FULL_LIVE_TOKEN_MISSING");
    if (live.emergencyStopLatched) blocked.push("EMERGENCY_STOP_LATCHED");
    if (active && now() > active.expiresAt) blocked.push("FULL_LIVE_TOKEN_EXPIRED");
    if (active && token !== active.raw) blocked.push("FULL_LIVE_TOKEN_MISMATCH");
    if (active && JSON.stringify(context) !== JSON.stringify(active.context)) blocked.push("FULL_LIVE_CONTEXT_CHANGED");

    const ok = blocked.length === 0;
    return Object.freeze({
      version: LIVE_FULL_ENABLE_TOKEN_VERSION,
      ok,
      decision: ok ? "FULL_LIVE_TOKEN_VALID" : "FULL_LIVE_TOKEN_INVALID",
      tokenDigest: active?.digest || "none",
      expiresAt: active?.expiresAt || null,
      context,
      blocked: Object.freeze(blocked),
      physicalWriteAllowed: false,
      outputTouched: false,
      serialTouched: false,
      networkTouched: false,
      safety: "12E validates explicit full-live token only; physical write remains blocked"
    });
  }

  function snapshot() {
    return Object.freeze({
      version: LIVE_FULL_ENABLE_TOKEN_VERSION,
      active: Boolean(active),
      tokenDigest: active?.digest || "none",
      expiresAt: active?.expiresAt || null,
      context: active?.context || null,
      physicalWriteAllowed: false
    });
  }

  return Object.freeze({
    version: LIVE_FULL_ENABLE_TOKEN_VERSION,
    issue,
    validate,
    revoke,
    snapshot
  });
}
