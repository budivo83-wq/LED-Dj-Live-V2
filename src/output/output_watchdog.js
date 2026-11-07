export function createOutputWatchdog({
  ackTimeoutMs = 3000,
  reconnectAfterMs = 3000,
  fallbackTransport = "blx",
  now = Date.now
} = {}) {
  let lastAckAt = null;
  let lastFrameAt = null;
  let reconnects = 0;
  let fallbacks = 0;
  let lastDecision = "IDLE";
  let lastReason = "init";

  function markFrameSent() {
    lastFrameAt = safeNow(now);
  }

  function markAck() {
    lastAckAt = safeNow(now);
    lastDecision = "ACK_OK";
    lastReason = "ack received";
  }

  function evaluate(stats = {}) {
    const t = safeNow(now);
    const ackAt = firstFinite(stats.lastAckAt, stats.rxAckLastAt, lastAckAt);
    const frameAt = firstFinite(stats.lastFrameAt, stats.lastSentAt, lastFrameAt);
    const ackAgeMs = ackAt !== null ? Math.max(0, t - ackAt) : Number.POSITIVE_INFINITY;
    const frameAgeMs = frameAt !== null ? Math.max(0, t - frameAt) : Number.POSITIVE_INFINITY;

    if (frameAt === null) {
      lastDecision = "IDLE";
      lastReason = "no sent frame";
    } else if (ackAgeMs > ackTimeoutMs && frameAgeMs <= reconnectAfterMs * 2) {
      reconnects += 1;
      fallbacks += 1;
      lastDecision = "FALLBACK";
      lastReason = `no ACK for ${Math.round(ackAgeMs)}ms`;
    } else if (ackAgeMs > reconnectAfterMs) {
      reconnects += 1;
      lastDecision = "RECONNECT";
      lastReason = `ACK stale ${Math.round(ackAgeMs)}ms`;
    } else {
      lastDecision = "OK";
      lastReason = "watchdog healthy";
    }

    return Object.freeze({
      decision: lastDecision,
      reason: lastReason,
      ackAgeMs: Number.isFinite(ackAgeMs) ? Math.round(ackAgeMs) : 0,
      frameAgeMs: Number.isFinite(frameAgeMs) ? Math.round(frameAgeMs) : 0,
      fallbackTransport,
      reconnect: lastDecision === "RECONNECT" || lastDecision === "FALLBACK",
      fallback: lastDecision === "FALLBACK"
    });
  }

  return Object.freeze({
    markFrameSent,
    markAck,
    evaluate,
    getStats: () => Object.freeze({
      version: "output-watchdog-v1",
      lastAckAt,
      lastFrameAt,
      reconnects,
      fallbacks,
      lastDecision,
      lastReason,
      ackTimeoutMs,
      reconnectAfterMs,
      fallbackTransport
    })
  });
}

function safeNow(now) {
  const value = now();
  return Number.isFinite(value) ? Number(value) : Date.now();
}

function firstFinite(...values) {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}
