function nowMs() {
  return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
}

export function createOutputAdapterBase(id, options = {}) {
  const fpsLimit = Math.max(1, Number(options.fpsLimit || 30));
  const reconnectMs = Math.max(100, Number(options.reconnectMs || 1000));
  const maxQueue = Math.max(1, Number(options.maxQueue || 4));

  let running = false;
  let connected = false;
  let reconnectAt = 0;
  let sent = 0;
  let dropped = 0;
  let lastSendMs = 0;
  let lastLatencyMs = 0;
  let lastError = '';
  let lastSentAt = 0;

  const queue = [];

  function pruneQueue() {
    let pruned = 0;
    while (queue.length > maxQueue) {
      queue.shift();
      dropped += 1;
      pruned += 1;
    }
    return pruned;
  }

  function scheduleReconnect() {
    reconnectAt = nowMs() + reconnectMs;
    connected = false;
  }

  function start() {
    running = true;
    connected = true;
    reconnectAt = 0;
  }

  function stop() {
    running = false;
    connected = false;
    queue.length = 0;
  }

  function pushFrame(frame) {
    if (!running) return false;
    queue.push({ frame, enqueuedAt: nowMs() });
    const pruned = pruneQueue();
    return pruned === 0;
  }

  function processOne(sendFn) {
    if (!running) return;
    if (!connected) {
      if (reconnectAt > 0 && nowMs() >= reconnectAt) connected = true;
      if (!connected) return;
    }
    const item = queue.shift();
    if (!item) return;

    const startAt = nowMs();
    try {
      sendFn(item.frame);
      const endAt = nowMs();
      sent += 1;
      lastSendMs = Math.max(0, endAt - startAt);
      lastLatencyMs = Math.max(0, startAt - item.enqueuedAt);
      lastSentAt = endAt;
      lastError = '';
    } catch (error) {
      lastError = String(error?.message || error || 'send_failed');
      scheduleReconnect();
    }
  }

  function getStatus() {
    return {
      id,
      running,
      connected,
      fpsLimit,
      reconnectMs,
      queueDepth: queue.length,
      sent,
      dropped,
      lastSendMs,
      lastLatencyMs,
      lastSentAt,
      reconnectAt,
      lastError
    };
  }

  return {
    id,
    start,
    stop,
    pushFrame,
    processOne,
    getStatus
  };
}
