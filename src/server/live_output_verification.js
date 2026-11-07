import { freezeUniqueList } from "./live_output_common.js";

export const LIVE_OUTPUT_VERIFICATION_VERSION = "12W-output-verification-ack-diagnostics";

function bool(value) {
  return Boolean(value);
}

function upper(value, fallback = "UNKNOWN") {
  return String(value || fallback).toUpperCase();
}

function summarizeLastSend(last = null) {
  if (!last) {
    return Object.freeze({
      hasLastSend: false,
      status: "NO_SEND_HISTORY",
      decision: "OUTPUT_VERIFY_NO_HISTORY_12W",
      transportKind: "unknown",
      target: "unknown",
      dryRun: true,
      physicalWrite: false,
      outputTouched: false,
      serialTouched: false,
      networkTouched: false,
      packetCount: 0,
      packetBytes: 0,
      error: ""
    });
  }
  return Object.freeze({
    hasLastSend: true,
    status: upper(last.status),
    decision: String(last.decision || last.status || "UNKNOWN"),
    transportKind: String(last.transportKind || "unknown"),
    target: String(last.target || "unknown"),
    dryRun: bool(last.dryRun),
    physicalWrite: bool(last.physicalWrite),
    outputTouched: bool(last.outputTouched),
    serialTouched: bool(last.serialTouched),
    networkTouched: bool(last.networkTouched),
    packetCount: Number(last.packetCount || 0),
    packetBytes: Number(last.packetBytes || 0),
    error: String(last.error || ""),
    at: String(last.at || "")
  });
}

export function evaluateLiveOutputVerification({ liveOutputSendHistory = null } = {}) {
  const history = liveOutputSendHistory?.snapshot?.() || null;
  const last = summarizeLastSend(history?.last || null);
  const blocked = [];
  const warnings = [];

  if (!history) blocked.push("OUTPUT_SEND_HISTORY_UNAVAILABLE");
  if (!last.hasLastSend) warnings.push("NO_OUTPUT_ATTEMPT_RECORDED");
  if (last.error) blocked.push("LAST_OUTPUT_ERROR");
  if (last.status === "BLOCKED") blocked.push("LAST_OUTPUT_BLOCKED");
  if (last.physicalWrite && !last.outputTouched) blocked.push("PHYSICAL_WRITE_CLAIM_WITHOUT_TOUCH");
  if (last.outputTouched && !(last.serialTouched || last.networkTouched)) warnings.push("OUTPUT_TOUCHED_WITHOUT_DRIVER_KIND");
  if (!last.physicalWrite && last.dryRun) warnings.push("LAST_RUN_WAS_DRY_RUN");

  const ack = last.physicalWrite && last.outputTouched && !last.error;
  const dryVerified = !last.physicalWrite && last.dryRun && last.packetCount > 0 && !last.error;
  const status = blocked.length ? "BLOCKED" : ack ? "ACK_CONFIRMED" : dryVerified ? "DRY_VERIFIED" : last.hasLastSend ? "OBSERVED" : "IDLE";
  const nextStep = blocked.length
    ? "fix last output error/blocker before repeating physical send"
    : ack
      ? "physical send acknowledged by local driver path; verify LEDs visually, then proceed to minimal live executor"
      : dryVerified
        ? "dry-run packets verified; arm matching output before physical send"
        : "run serial/artnet dry test first";

  return Object.freeze({
    version: LIVE_OUTPUT_VERIFICATION_VERSION,
    ok: blocked.length === 0,
    status,
    decision: ack ? "OUTPUT_VERIFY_PHYSICAL_ACK_12W" : dryVerified ? "OUTPUT_VERIFY_DRY_ACK_12W" : blocked.length ? "OUTPUT_VERIFY_BLOCKED_12W" : "OUTPUT_VERIFY_OBSERVED_12W",
    ack,
    dryVerified,
    historyCount: Number(history?.count || 0),
    last,
    blocked: freezeUniqueList(blocked),
    warnings: freezeUniqueList(warnings),
    nextStep,
    safety: "12W verifies the last serial/ArtNet test-run result from send-history. It does not send packets by itself."
  });
}

export function createLiveOutputVerification({ liveOutputSendHistory = null } = {}) {
  return Object.freeze({
    version: LIVE_OUTPUT_VERIFICATION_VERSION,
    evaluate: () => evaluateLiveOutputVerification({ liveOutputSendHistory })
  });
}
