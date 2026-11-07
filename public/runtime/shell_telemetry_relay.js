export function evaluateShellTelemetryRelay({ now, quietUntil, lastRelayAt, minIntervalMs }) {
  const currentNow = Number(now) || 0;
  const quietUntilMs = Number(quietUntil) || 0;
  const previousRelayAt = Number(lastRelayAt) || 0;
  const intervalMs = Math.max(0, Number(minIntervalMs) || 0);

  if (currentNow < quietUntilMs) {
    return {
      relay: false,
      reason: "quiet-window",
      lastRelayAt: previousRelayAt
    };
  }

  if (currentNow - previousRelayAt < intervalMs) {
    return {
      relay: false,
      reason: "rate-limit",
      lastRelayAt: previousRelayAt
    };
  }

  return {
    relay: true,
    reason: "ok",
    lastRelayAt: currentNow
  };
}
