export function createHeadlessLeaderElection({
  headless,
  windowRef = window,
  storageRef = localStorage,
  key = "led-engine-headless-leader-v1",
  heartbeatMs = 900,
  leaseMs = 3500
} = {}) {
  const instanceId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  let active = !headless;
  let timerId = 0;
  let pollId = 0;
  let initialized = false;

  function readLease() {
    try {
      const raw = storageRef.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      return {
        owner: String(parsed.owner || ""),
        expiresAt: Number(parsed.expiresAt || 0)
      };
    } catch {
      return null;
    }
  }

  function writeLease(expiresAt) {
    try {
      storageRef.setItem(key, JSON.stringify({
        owner: instanceId,
        expiresAt: Number(expiresAt || 0)
      }));
    } catch {
      // ignore storage failures
    }
  }

  function clearLease() {
    try {
      const current = readLease();
      if (current?.owner === instanceId) {
        storageRef.removeItem(key);
      }
    } catch {
      // ignore storage failures
    }
  }

  function refreshLease() {
    const now = Date.now();
    const current = readLease();
    const stale = !current || !current.owner || current.expiresAt <= now;
    if (stale || current.owner === instanceId) {
      writeLease(now + leaseMs);
    }
    const after = readLease();
    active = after?.owner === instanceId;
  }

  function init() {
    if (!headless || initialized) return;
    initialized = true;
    writeLease(Date.now() + leaseMs);
    active = true;
    refreshLease();
    if (!timerId) {
      // STEP37AL: one slower lease timer is enough. The old pair of intervals
      // wrote/read localStorage 5-8×/s; STEP37AK made it one timer, and this
      // version reduces the remaining synchronous storage pressure further.
      const leaseTick37DJ = () => {
        const lease = readLease();
        if (!lease || lease.expiresAt <= Date.now() || lease.owner === instanceId) refreshLease();
        else active = lease.owner === instanceId;
      };
      try {
        const loops = windowRef.__budilightRuntimeLoopRegistry37CE;
        if (loops?.adaptiveInterval) {
          timerId = loops.adaptiveInterval('headless-leader:lease', leaseTick37DJ, heartbeatMs, {
            group: 'headless-leader',
            critical: true,
            liveFactor: 1.5,
            hiddenFactor: 1.5,
            maxMs: Math.min(Math.max(heartbeatMs, 1600), Math.max(heartbeatMs, leaseMs - 900))
          });
        } else {
          timerId = windowRef.setInterval(leaseTick37DJ, heartbeatMs);
        }
      } catch {
        timerId = windowRef.setInterval(leaseTick37DJ, heartbeatMs);
      }
    }
    windowRef.addEventListener("beforeunload", () => {
      clearLease();
    });
    windowRef.addEventListener("storage", (event) => {
      if (event.key !== key) return;
      refreshLease();
    });
  }

  function isActive() {
    return active;
  }

  return {
    init,
    isActive
  };
}
