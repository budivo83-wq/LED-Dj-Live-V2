import { SerialPort } from "serialport";

function normalizeBinaryPacket(value) {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) {
    return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  }
  if (ArrayBuffer.isView(value)) {
    return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  }
  if (value instanceof ArrayBuffer) return Buffer.from(value);
  return Buffer.from(value || []);
}

export function createSerialController({ logger = console } = {}) {
  let serial = null;
  let serialConfig = { path: "", baudRate: 115200 };
  let openedAtMs = 0;

  // STEP 13AT: live output can arrive through WebSocket faster than a real
  // USB/serial adapter can physically transmit it, especially on Raspberry Pi.
  // Raw serial.write() without backpressure eventually fills buffers and the
  // receiver appears to freeze on the last valid frame.  Keep only the newest
  // pending packet and write/drain one packet at a time.
  const queuedLiveWriteEnabled = String(process.env.LED_SERIAL_BACKPRESSURE_QUEUE || "1") !== "0";
  let writeBusy = false;
  let pendingPacket = null;
  let pendingPrefix = "Serial write error";
  let pendingPacketSince = 0;
  let scheduledPumpTimer = null;
  let lastWriteFinishedAt = 0;
  let activeWriteId = 0;
  let activeWatchdogTimer = null;
  let activeWriteStartedAt = 0;
  const writeStats = {
    queued: 0,
    sent: 0,
    coalesced: 0,
    failed: 0,
    busy: false,
    pending: false,
    lastBytes: 0,
    lastError: null,
    lastWriteMs: 0,
    lastDrainMs: 0,
    lastIntervalMs: 0,
    timeoutMs: 0,
    timeouts: 0,
    staleCallbacks: 0,
    recovered: 0,
    lastRecoveryAt: 0,
    lastHeartbeatAt: 0,
    busyAgeMs: 0,
    incoming: 0,
    throttled: 0,
    accepted: 0,
    throttledFps: 0,
    incomingFps: 0,
    sentFps: 0,
    coalescedFps: 0,
    recommendedFps: 0,
    wireBudgetMs: 0,
    adaptiveThrottle: false,
    lastStatsWindowAt: 0,
    windowIncoming: 0,
    windowSent: 0,
    windowCoalesced: 0,
    windowThrottled: 0,
    latestOnly: true,
    replacedPending: 0,
    stalePendingDrops: 0,
    scheduledPumps: 0,
    maxPendingAgeMs: 0,
    lastDropReason: null,
    drainMode: "write-callback",
    drainSkipped: 0,
    drainUsed: 0,
    liveMaxFps: 0,
    liveMaxIntervalMs: 0,
    stallWatchdogEnabled: false,
    stallTimeoutMs: 0,
    stallChecks: 0,
    stallRecoveries: 0,
    queueFlushes: 0,
    droppedPendingByWatchdog: 0,
    rxBytes: 0,
    rxPackets: 0,
    rxLastBytes: 0,
    rxLastAt: 0,
    rxLastIntervalMs: 0,
    rxTimeoutMs: 0,
    rxHealth: "IDLE",
    rxAgeMs: 0,
    rxFps: 0,
    rxWindowPackets: 0,
    rxErrors: 0,
    rxLastError: null,
    rxAckLines: 0,
    rxAckOk: 0,
    rxAckTimeout: 0,
    rxAckOverflow: 0,
    rxAckUnknown: 0,
    rxAckLastType: "--",
    rxAckLastLine: "",
    rxAckLastAt: 0
  };
  let rxLineBuffer = "";
  const adaptiveThrottleEnabled = String(process.env.LED_SERIAL_ADAPTIVE_THROTTLE || "1") !== "0";
  const latestOnlyEnabled = String(process.env.LED_SERIAL_LATEST_ONLY || "1") !== "0";
  const maxPendingAgeMs = Math.max(20, Number(process.env.LED_SERIAL_MAX_PENDING_AGE_MS || 250));
  // STEP 13AZ: live LED streaming must not call serial.drain() after every frame.
  // On Raspberry Pi / USB serial this can block the write loop after a few frames
  // while the receiver still shows the last valid frame.  For live output we pace
  // by calculated wire budget + write callback.  Drain remains opt-in for smoke
  // tests or very conservative transports.
  const liveDrainEnabled = String(process.env.LED_SERIAL_LIVE_DRAIN || "0") === "1";
  // STEP 13BU-AJ: remove the forced 12 FPS server cap from 13BU-AI.
  // The browser/worker now obey Serial Settings FPS, while this server still
  // enforces physical wire budget. Optional env cap remains available for hard
  // safety, e.g. LED_SERIAL_LIVE_MAX_FPS=12 npm start. Default 0 = no fixed cap.
  const configuredLiveMaxFps = Number(process.env.LED_SERIAL_LIVE_MAX_FPS || 0);
  const serialRxHeartbeatEnabled = String(process.env.LED_SERIAL_RX_HEARTBEAT || "1") !== "0";
  const serialRxTimeoutMs = Math.max(250, Number(process.env.LED_SERIAL_RX_TIMEOUT_MS || 1800));

  // STEP 13BE: coarse serial stall watchdog. The active write watchdog catches
  // a single stuck write callback; this monitor also catches old pending frames
  // and queue states that can happen after OS/USB backpressure spikes. Recovery
  // is intentionally conservative: drop only stale queued data, flush the serial
  // adapter and allow the newest incoming frame to continue.
  const stallWatchdogEnabled = String(process.env.LED_SERIAL_STALL_WATCHDOG || "1") !== "0";
  const stallWatchdogIntervalMs = Math.max(100, Number(process.env.LED_SERIAL_STALL_WATCHDOG_INTERVAL_MS || 250));
  const stallWatchdogTimeoutMs = Math.max(500, Number(process.env.LED_SERIAL_STALL_TIMEOUT_MS || 1500));
  let stallWatchdogTimer = null;
  let nextAcceptAt = 0;

  async function listPorts() {
    return SerialPort.list();
  }

  function status() {
    refreshThroughputWindow();
    refreshRxHeartbeat();
    return {
      ok: true,
      open: Boolean(serial?.isOpen),
      path: serialConfig.path,
      baudRate: serialConfig.baudRate,
      openedAtMs,
      openAgeMs: openedAtMs ? Date.now() - openedAtMs : 0,
      liveWriteQueue: {
        enabled: queuedLiveWriteEnabled,
        ...writeStats,
        busy: writeBusy,
        pending: Boolean(pendingPacket),
        busyAgeMs: writeBusy && activeWriteStartedAt ? Math.max(0, Date.now() - activeWriteStartedAt) : 0,
        heartbeatAgeMs: writeStats.lastHeartbeatAt ? Math.max(0, Date.now() - writeStats.lastHeartbeatAt) : 0,
        liveDrainEnabled,
        stallWatchdogEnabled
      },
      serialRxHeartbeat: {
        enabled: serialRxHeartbeatEnabled,
        timeoutMs: serialRxTimeoutMs,
        health: writeStats.rxHealth,
        ageMs: writeStats.rxAgeMs,
        fps: writeStats.rxFps,
        packets: writeStats.rxPackets,
        bytes: writeStats.rxBytes,
        lastAt: writeStats.rxLastAt,
        lastIntervalMs: writeStats.rxLastIntervalMs,
        lastBytes: writeStats.rxLastBytes,
        errors: writeStats.rxErrors,
        lastError: writeStats.rxLastError,
        ack: {
          lines: writeStats.rxAckLines,
          ok: writeStats.rxAckOk,
          timeout: writeStats.rxAckTimeout,
          overflow: writeStats.rxAckOverflow,
          unknown: writeStats.rxAckUnknown,
          lastType: writeStats.rxAckLastType,
          lastLine: writeStats.rxAckLastLine,
          lastAt: writeStats.rxAckLastAt,
          lastAgeMs: writeStats.rxAckLastAt ? Math.max(0, Date.now() - writeStats.rxAckLastAt) : 0
        }
      }
    };
  }

  async function open(pathValue, baudRateValue) {
    const nextPath = String(pathValue || "").trim();
    const baudRate = clampBaud(baudRateValue);
    if (!nextPath) throw new Error("missing path");

    await close();
    serialConfig = { path: nextPath, baudRate };
    serial = new SerialPort({ path: nextPath, baudRate, autoOpen: false });
    serial.on("error", (error) => logger.warn("Serial error", error.message));
    serial.on("data", (chunk) => {
      if (!serialRxHeartbeatEnabled) return;
      const now = Date.now();
      const bytes = Buffer.isBuffer(chunk) ? chunk.length : (chunk?.byteLength || 0);
      const previousAt = Number(writeStats.rxLastAt || 0);
      writeStats.rxPackets += 1;
      writeStats.rxWindowPackets += 1;
      writeStats.rxBytes += Math.max(0, Number(bytes || 0));
      writeStats.rxLastBytes = Math.max(0, Number(bytes || 0));
      writeStats.rxLastIntervalMs = previousAt > 0 ? Math.max(0, now - previousAt) : 0;
      writeStats.rxLastAt = now;
      writeStats.rxAgeMs = 0;
      writeStats.rxHealth = "OK";
      writeStats.rxTimeoutMs = serialRxTimeoutMs;
      writeStats.rxLastError = null;
      consumeRxLines(chunk);
    });
    await new Promise((resolve, reject) => serial.open((error) => (error ? reject(error) : resolve())));
    openedAtMs = Date.now();
    startStallWatchdog();
    return status();
  }

  async function close() {
    return new Promise((resolve) => {
      pendingPacket = null;
      pendingPacketSince = 0;
      writeBusy = false;
      clearScheduledPump();
      clearActiveWatchdog();
      stopStallWatchdog();
      activeWriteStartedAt = 0;
      activeWriteId += 1;
      writeStats.busy = false;
      writeStats.pending = false;
      writeStats.rxHealth = "IDLE";
      writeStats.rxAgeMs = 0;
      rxLineBuffer = "";
      if (!serial) return resolve();
      const current = serial;
      serial = null;
      openedAtMs = 0;
      if (!current.isOpen) return resolve();
      current.close(() => resolve());
    });
  }

  function write(buffer, errorPrefix = "Serial write error") {
    if (!serial?.isOpen) return false;
    if (!queuedLiveWriteEnabled) return writeDirect(buffer, errorPrefix);
    return writeLatest(buffer, errorPrefix);
  }

  function writeDirect(buffer, errorPrefix = "Serial write error") {
    if (!serial?.isOpen) return false;
    serial.write(buffer, (error) => {
      if (error) logger.warn(errorPrefix, error.message);
    });
    return true;
  }

  function writeLatest(buffer, errorPrefix = "Serial write error") {
    if (!serial?.isOpen) return false;
    const packet = normalizeBinaryPacket(buffer);
    if (!packet.length) return false;

    const now = Date.now();
    const wireBudgetMs = Math.round(minIntervalMsForPacket(packet.length));
    writeStats.latestOnly = latestOnlyEnabled;
    writeStats.maxPendingAgeMs = maxPendingAgeMs;
    writeStats.incoming += 1;
    writeStats.windowIncoming += 1;
    writeStats.wireBudgetMs = wireBudgetMs;
    writeStats.adaptiveThrottle = adaptiveThrottleEnabled;
    writeStats.recommendedFps = recommendedFpsForPacket(packet.length);

    // STEP 13AV: adaptive soft governor.  Browser/UI may still produce frames
    // faster than USB serial can physically move them.  We keep the newest
    // pending frame, but we do not endlessly churn the pending slot inside one
    // wire-time budget; that reduces CPU load and avoids apparent freezes on
    // Raspberry Pi when serial/BLX is enabled.
    if (adaptiveThrottleEnabled && now < nextAcceptAt && pendingPacket) {
      if (latestOnlyEnabled) writeStats.replacedPending += 1;
      pendingPacket = packet;
      pendingPrefix = errorPrefix;
      pendingPacketSince = now;
      writeStats.throttled += 1;
      writeStats.windowThrottled += 1;
      writeStats.pending = true;
      refreshThroughputWindow();
      if (!writeBusy) schedulePacedPump(Math.max(1, nextAcceptAt - now));
      return true;
    }

    if (pendingPacket) {
      writeStats.coalesced += 1;
      writeStats.windowCoalesced += 1;
      if (latestOnlyEnabled) writeStats.replacedPending += 1;
    }
    pendingPacket = packet;
    pendingPrefix = errorPrefix;
    pendingPacketSince = now;
    writeStats.queued += 1;
    writeStats.accepted += 1;
    writeStats.pending = true;
    nextAcceptAt = Math.max(nextAcceptAt, now + Math.max(1, wireBudgetMs));
    refreshThroughputWindow();
    schedulePacedPump(0);
    return true;
  }

  function minIntervalMsForPacket(bytes) {
    const baudRate = clampBaud(serialConfig.baudRate);
    const wireMs = (Math.max(1, Number(bytes) || 1) * 10 * 1000) / baudRate;
    const safety = Number(process.env.LED_SERIAL_WIRE_SAFETY || 1.15);
    const floorMs = Number(process.env.LED_SERIAL_MIN_INTERVAL_MS || 2);
    const safeWireInterval = Math.max(
      Number.isFinite(floorMs) ? floorMs : 2,
      wireMs * (Number.isFinite(safety) ? safety : 1.15)
    );

    // STEP 13BC: fixed 60px AA receiver on Arduino needs real idle time between
    // frames.  At 115200 baud, 182 byte packets at ~55 FPS are too close to the
    // physical limit; FastLED.show() temporarily disables interrupts and the AVR
    // RX buffer can overflow after tens of seconds.  This cap deliberately adds
    // headroom independent of browser/output FPS.
    const liveMaxFps = Number.isFinite(configuredLiveMaxFps) && configuredLiveMaxFps > 0
      ? configuredLiveMaxFps
      : 0;
    const liveMaxIntervalMs = liveMaxFps > 0 ? (1000 / liveMaxFps) : 0;
    writeStats.liveMaxFps = liveMaxFps;
    writeStats.liveMaxIntervalMs = Math.round(liveMaxIntervalMs || 0);

    return Math.max(safeWireInterval, liveMaxIntervalMs || 0);
  }



  function recommendedFpsForPacket(bytes) {
    const budget = minIntervalMsForPacket(bytes);
    const raw = budget > 0 ? Math.floor(1000 / budget) : 0;
    const cap = Number(process.env.LED_SERIAL_MAX_RECOMMENDED_FPS || 60);
    const floor = Number(process.env.LED_SERIAL_MIN_RECOMMENDED_FPS || 5);
    const bounded = Math.max(floor, Math.min(Number.isFinite(cap) ? cap : 60, raw || floor));
    return Math.max(1, Math.round(bounded));
  }

  function refreshThroughputWindow() {
    const now = Date.now();
    if (!writeStats.lastStatsWindowAt) {
      writeStats.lastStatsWindowAt = now;
      return;
    }
    const elapsed = now - writeStats.lastStatsWindowAt;
    if (elapsed < 1000) return;
    const scale = 1000 / Math.max(1, elapsed);
    writeStats.incomingFps = Math.round(writeStats.windowIncoming * scale);
    writeStats.sentFps = Math.round(writeStats.windowSent * scale);
    writeStats.coalescedFps = Math.round(writeStats.windowCoalesced * scale);
    writeStats.throttledFps = Math.round(writeStats.windowThrottled * scale);
    writeStats.windowIncoming = 0;
    writeStats.windowSent = 0;
    writeStats.windowCoalesced = 0;
    writeStats.windowThrottled = 0;
    writeStats.rxFps = Math.round(writeStats.rxWindowPackets * scale);
    writeStats.rxWindowPackets = 0;
    writeStats.lastStatsWindowAt = now;
  }

  function refreshRxHeartbeat() {
    writeStats.rxTimeoutMs = serialRxTimeoutMs;
    if (!serialRxHeartbeatEnabled) {
      writeStats.rxHealth = "DISABLED";
      writeStats.rxAgeMs = 0;
      return;
    }
    if (!serial?.isOpen) {
      writeStats.rxHealth = "IDLE";
      writeStats.rxAgeMs = 0;
      return;
    }
    const lastRxAt = Number(writeStats.rxLastAt || 0);
    if (!lastRxAt) {
      writeStats.rxHealth = writeStats.sent > 0 ? "WAIT_RX" : "IDLE";
      writeStats.rxAgeMs = 0;
      return;
    }
    const ageMs = Math.max(0, Date.now() - lastRxAt);
    writeStats.rxAgeMs = ageMs;
    if (ageMs > serialRxTimeoutMs) {
      writeStats.rxHealth = "TIMEOUT";
    } else if (ageMs > Math.round(serialRxTimeoutMs * 0.6)) {
      writeStats.rxHealth = "WARN";
    } else {
      writeStats.rxHealth = "OK";
    }
  }

  function consumeRxLines(chunk) {
    try {
      const text = Buffer.isBuffer(chunk)
        ? chunk.toString("utf8")
        : normalizeBinaryPacket(chunk).toString("utf8");
      if (!text) return;
      rxLineBuffer += text;
      const parts = rxLineBuffer.split(/\r?\n/);
      rxLineBuffer = parts.pop() || "";
      for (const rawLine of parts) processAckLine(rawLine);
    } catch (error) {
      writeStats.rxErrors += 1;
      writeStats.rxLastError = error?.message || "rx line parse error";
    }
  }

  function processAckLine(rawLine) {
    const line = String(rawLine || "").trim();
    if (!line) return;
    writeStats.rxAckLines += 1;
    writeStats.rxAckLastLine = line.slice(0, 160);
    writeStats.rxAckLastAt = Date.now();

    // STEP22CP: STEP22CM receiver posílá např.
    //   BDL_ACK frames=123 badStart=0 badLen=0 timeout=0 fps=20
    // Starší parser viděl samotné slovo "timeout" a omylem každou zdravou
    // heartbeat řádku označil jako TIMEOUT. Tady nejdřív čteme číselné counters.
    const readCounter = (name) => {
      const match = line.match(new RegExp(`\b${name}=([0-9]+)\b`, "i"));
      return match ? Number(match[1]) : null;
    };
    const isBdlAck = /^BDL_ACK\b/i.test(line);
    const timeoutCount = readCounter("timeout");
    const overflowCount = readCounter("overflow");
    const badLenCount = readCounter("badLen");
    const badStartCount = readCounter("badStart");

    let type = "UNKNOWN";
    if (isBdlAck || /\b(ack|ok|accepted|frame\s*accepted|frame\s*received|frame\s*prijat|frame\s*přijat)\b/i.test(line)) {
      type = "ACK";
      writeStats.rxAckOk += 1;
    } else if (/\b(overflow|buffer\s*overflow)\b/i.test(line)) {
      type = "OVERFLOW";
      writeStats.rxAckOverflow += 1;
    } else if (/\b(timeout|frame\s*timeout)\b/i.test(line)) {
      type = "TIMEOUT";
      writeStats.rxAckTimeout += 1;
    } else {
      writeStats.rxAckUnknown += 1;
    }

    if (isBdlAck) {
      if ((overflowCount || 0) > 0) type = "OVERFLOW";
      else if ((timeoutCount || 0) > 0) type = "TIMEOUT";
      else type = "ACK";
    }

    writeStats.rxAckLastType = type;
    if (type === "OVERFLOW") {
      writeStats.rxAckOverflow += isBdlAck && overflowCount ? 0 : 1;
      writeStats.rxHealth = "OVERFLOW";
    } else if (type === "TIMEOUT") {
      writeStats.rxAckTimeout += isBdlAck && timeoutCount ? 0 : 1;
      writeStats.rxHealth = "TIMEOUT";
    } else if (type === "ACK") {
      writeStats.rxHealth = "OK";
    }
  }

  function schedulePacedPump(delayMs = 0) {
    if (scheduledPumpTimer) return;
    const delay = Math.max(0, Math.round(Number(delayMs) || 0));
    writeStats.scheduledPumps += 1;
    scheduledPumpTimer = setTimeout(() => {
      scheduledPumpTimer = null;
      pumpLatestWrite();
    }, delay);
    scheduledPumpTimer.unref?.();
  }

  function clearScheduledPump() {
    if (scheduledPumpTimer) clearTimeout(scheduledPumpTimer);
    scheduledPumpTimer = null;
  }

  function pumpLatestWrite() {
    if (writeBusy) return;
    if (!serial?.isOpen) {
      pendingPacket = null;
      writeStats.pending = false;
      return;
    }
    const packet = pendingPacket;
    if (!packet) {
      writeStats.pending = false;
      pendingPacketSince = 0;
      return;
    }
    const pendingAge = pendingPacketSince ? Date.now() - pendingPacketSince : 0;
    if (latestOnlyEnabled && pendingAge > maxPendingAgeMs) {
      pendingPacket = null;
      pendingPacketSince = 0;
      writeStats.pending = false;
      writeStats.stalePendingDrops += 1;
      writeStats.lastDropReason = `stale pending frame ${Math.round(pendingAge)}ms`;
      return;
    }
    pendingPacket = null;
    pendingPacketSince = 0;
    writeBusy = true;
    writeStats.busy = true;
    writeStats.pending = false;
    writeStats.lastBytes = packet.length;
    const started = Date.now();
    const writeId = activeWriteId + 1;
    activeWriteId = writeId;
    activeWriteStartedAt = started;
    writeStats.lastHeartbeatAt = started;
    armActiveWatchdog(writeId, packet.length, pendingPrefix);
    serial.write(packet, (writeError) => {
      if (writeId !== activeWriteId) {
        writeStats.staleCallbacks += 1;
        return;
      }
      const wroteAt = Date.now();
      writeStats.lastWriteMs = Math.max(0, wroteAt - started);
      writeStats.lastHeartbeatAt = wroteAt;
      if (writeError) {
        clearActiveWatchdog();
        writeStats.failed += 1;
        writeStats.lastError = writeError.message;
        logger.warn(pendingPrefix, writeError.message);
        finishLatestWrite(packet.length, wroteAt);
        return;
      }
      if (!liveDrainEnabled) {
        clearActiveWatchdog();
        writeStats.drainMode = "write-callback";
        writeStats.drainSkipped += 1;
        writeStats.lastDrainMs = 0;
        writeStats.sent += 1;
        writeStats.windowSent += 1;
        writeStats.lastError = null;
        finishLatestWrite(packet.length, wroteAt);
        return;
      }

      writeStats.drainMode = "serial-drain";
      writeStats.drainUsed += 1;
      serial.drain((drainError) => {
        if (writeId !== activeWriteId) {
          writeStats.staleCallbacks += 1;
          return;
        }
        clearActiveWatchdog();
        const drainedAt = Date.now();
        writeStats.lastDrainMs = Math.max(0, drainedAt - wroteAt);
        writeStats.lastHeartbeatAt = drainedAt;
        if (drainError) {
          writeStats.failed += 1;
          writeStats.lastError = drainError.message;
          logger.warn(`${pendingPrefix} drain`, drainError.message);
        } else {
          writeStats.sent += 1;
          writeStats.windowSent += 1;
          writeStats.lastError = null;
        }
        finishLatestWrite(packet.length, drainedAt);
      });
    });
  }

  function finishLatestWrite(bytes, finishedAt) {
    const minIntervalMs = minIntervalMsForPacket(bytes);
    const previousFinishedAt = lastWriteFinishedAt || finishedAt;
    const nextDelay = Math.max(0, Math.round(minIntervalMs - Math.max(0, finishedAt - previousFinishedAt)));
    lastWriteFinishedAt = finishedAt;
    activeWriteStartedAt = 0;
    writeStats.lastIntervalMs = Math.round(minIntervalMs);
    writeBusy = false;
    writeStats.busy = false;
    if (pendingPacket) {
      schedulePacedPump(nextDelay);
    } else {
      writeStats.pending = false;
      pendingPacketSince = 0;
    }
  }

  function dynamicWriteTimeoutMs(bytes) {
    const minIntervalMs = minIntervalMsForPacket(bytes);
    const envTimeout = Number(process.env.LED_SERIAL_WRITE_TIMEOUT_MS || 0);
    if (Number.isFinite(envTimeout) && envTimeout > 0) return Math.max(50, Math.round(envTimeout));
    const dynamic = Math.round((minIntervalMs * 4) + 250);
    return Math.max(500, Math.min(5000, dynamic));
  }

  function armActiveWatchdog(writeId, bytes, errorPrefix) {
    clearActiveWatchdog();
    const timeoutMs = dynamicWriteTimeoutMs(bytes);
    writeStats.timeoutMs = timeoutMs;
    activeWatchdogTimer = setTimeout(() => {
      if (writeId !== activeWriteId || !writeBusy) return;
      writeStats.timeouts += 1;
      writeStats.failed += 1;
      writeStats.recovered += 1;
      writeStats.lastRecoveryAt = Date.now();
      writeStats.lastError = `serial write watchdog timeout after ${timeoutMs}ms`;
      logger.warn(`${errorPrefix} watchdog`, writeStats.lastError);
      recoverSerialQueue(writeStats.lastError);
      if (pendingPacket) schedulePacedPump(Number(process.env.LED_SERIAL_RECOVERY_DELAY_MS || 20));
    }, timeoutMs);
    activeWatchdogTimer.unref?.();
  }

  function clearActiveWatchdog() {
    if (activeWatchdogTimer) clearTimeout(activeWatchdogTimer);
    activeWatchdogTimer = null;
  }


  function startStallWatchdog() {
    stopStallWatchdog();
    writeStats.stallWatchdogEnabled = stallWatchdogEnabled;
    writeStats.stallTimeoutMs = stallWatchdogTimeoutMs;
    if (!stallWatchdogEnabled) return;
    stallWatchdogTimer = setInterval(runStallWatchdog, stallWatchdogIntervalMs);
    stallWatchdogTimer.unref?.();
  }

  function stopStallWatchdog() {
    if (stallWatchdogTimer) clearInterval(stallWatchdogTimer);
    stallWatchdogTimer = null;
  }

  function runStallWatchdog() {
    if (!serial?.isOpen) return;
    const now = Date.now();
    writeStats.stallChecks += 1;
    writeStats.stallWatchdogEnabled = stallWatchdogEnabled;
    writeStats.stallTimeoutMs = stallWatchdogTimeoutMs;

    const busyAge = writeBusy && activeWriteStartedAt ? now - activeWriteStartedAt : 0;
    if (busyAge > stallWatchdogTimeoutMs) {
      recoverSerialQueue(`busy write stuck ${Math.round(busyAge)}ms`);
      return;
    }

    const pendingAge = pendingPacket && pendingPacketSince ? now - pendingPacketSince : 0;
    if (pendingAge > Math.max(stallWatchdogTimeoutMs, maxPendingAgeMs * 3)) {
      recoverSerialQueue(`pending frame stale ${Math.round(pendingAge)}ms`);
    }
  }

  function recoverSerialQueue(reason = "serial watchdog recovery") {
    writeStats.stallRecoveries += 1;
    writeStats.recovered += 1;
    writeStats.queueFlushes += 1;
    writeStats.lastRecoveryAt = Date.now();
    writeStats.lastError = reason;
    writeStats.lastDropReason = reason;
    if (pendingPacket) writeStats.droppedPendingByWatchdog += 1;
    pendingPacket = null;
    pendingPacketSince = 0;
    clearScheduledPump();
    clearActiveWatchdog();
    activeWriteId += 1;
    activeWriteStartedAt = 0;
    writeBusy = false;
    writeStats.busy = false;
    writeStats.pending = false;
    try {
      serial?.flush?.(() => {});
    } catch {}
    logger.warn("Serial stall watchdog recovery", reason);
  }

  async function writeAndDrain(buffer, { errorPrefix = "Serial write error", minOpenAgeMs = 2200 } = {}) {
    if (!serial?.isOpen) return { ok: false, error: "serial closed" };
    const openAgeMs = openedAtMs ? Date.now() - openedAtMs : 0;
    const waitMs = Math.max(0, Number(minOpenAgeMs || 0) - openAgeMs);
    if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
    const packet = normalizeBinaryPacket(buffer);
    return new Promise((resolve) => {
      serial.write(packet, (writeError) => {
        if (writeError) {
          logger.warn(errorPrefix, writeError.message);
          resolve({ ok: false, error: writeError.message, waitedMs: waitMs });
          return;
        }
        serial.drain((drainError) => {
          if (drainError) {
            logger.warn(`${errorPrefix} drain`, drainError.message);
            resolve({ ok: false, error: drainError.message, waitedMs: waitMs });
            return;
          }
          resolve({ ok: true, waitedMs: waitMs, bytes: packet.length });
        });
      });
    });
  }

  return {
    listPorts,
    status,
    open,
    close,
    write,
    writeAndDrain
  };
}

function clampBaud(value) {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) && number >= 9600 && number <= 3000000 ? number : 115200;
}
