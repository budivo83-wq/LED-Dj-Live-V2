function clampNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function createArtNetFrameSyncMonitor22T(options = {}) {
  const expectedUniverses = Math.max(1, Math.trunc(clampNumber(options.expectedUniverses, 16)));
  const artSync = options.artSync !== false;
  let targetFps = Math.max(1, Math.trunc(clampNumber(options.fps, 44)));
  const expectedPackets = expectedUniverses + (artSync ? 1 : 0);
  const frameIntervalMs = () => 1000 / Math.max(1, targetFps);

  let startedAt = Date.now();
  let lastFrameAt = 0;
  let lastFrameId = 0;
  let frameTx = 0;
  let droppedFrames = 0;
  let lateFrames = 0;
  let partialCommits = 0;
  let validationBlocks = 0;
  let rateLimited = 0;
  let unsafeLiveDesync = 0;
  let jitterSamples = [];
  let universeTxTotal = 0;
  let lastRecord = null;
  const timeline = [];

  function pushTimeline(record) {
    timeline.push(Object.freeze(record));
    if (timeline.length > 96) timeline.shift();
  }

  function healthFromCounters() {
    if (unsafeLiveDesync > 0 || partialCommits > 0) return 'RED';
    const recentJitter = jitterSamples.slice(-12);
    const avgJitter = recentJitter.length ? recentJitter.reduce((a, b) => a + b, 0) / recentJitter.length : 0;
    if (lateFrames > 0 || rateLimited > 0 || avgJitter > frameIntervalMs() * 0.75) return 'YELLOW';
    return 'GREEN';
  }

  function recordFrame({ validation = null, result = null, dryRun = true, liveWriteArmed = false } = {}) {
    const now = Date.now();
    const dt = lastFrameAt ? now - lastFrameAt : 0;
    const interval = frameIntervalMs();
    const jitterMs = lastFrameAt ? Math.abs(dt - interval) : 0;
    if (lastFrameAt) {
      jitterSamples.push(jitterMs);
      if (jitterSamples.length > 120) jitterSamples = jitterSamples.slice(-120);
    }

    lastFrameAt = now;
    lastFrameId += 1;

    const ok = result?.ok === true;
    const blocked = result?.blocked === true || validation?.ok === false;
    const skipped = result?.skipped === true || result?.reason === 'rate_limited';
    const packetCount = Array.isArray(result?.packets) ? result.packets.length : 0;
    const universeCount = Array.isArray(result?.packets) ? result.packets.filter((p) => Number.isFinite(Number(p?.universe))).length : 0;
    const partial = ok && packetCount > 0 && packetCount < expectedPackets;
    const late = dt > interval * 1.5 && lastFrameId > 1;
    const unsafe = dryRun === false && liveWriteArmed === true && (partial || blocked || skipped || validation?.ok === false);

    if (ok) frameTx += 1;
    if (!ok || blocked) droppedFrames += 1;
    if (blocked) validationBlocks += 1;
    if (skipped) rateLimited += 1;
    if (late) lateFrames += 1;
    if (partial) partialCommits += 1;
    if (unsafe) unsafeLiveDesync += 1;
    universeTxTotal += universeCount;

    lastRecord = Object.freeze({
      at: now,
      frameId: lastFrameId,
      ok,
      blocked,
      skipped,
      partial,
      late,
      unsafe,
      dtMs: Math.round(dt * 100) / 100,
      jitterMs: Math.round(jitterMs * 100) / 100,
      expectedPackets,
      packetCount,
      expectedUniverses,
      universeCount,
      dryRun,
      liveWriteArmed,
      reason: result?.reason || validation?.reason || result?.error || ''
    });
    pushTimeline(lastRecord);
    return lastRecord;
  }

  function getSnapshot() {
    const now = Date.now();
    const ageMs = lastFrameAt ? now - lastFrameAt : null;
    const uptimeSec = Math.max(0.001, (now - startedAt) / 1000);
    const avgJitterMs = jitterSamples.length ? jitterSamples.reduce((a, b) => a + b, 0) / jitterSamples.length : 0;
    const outFps = frameTx / uptimeSec;
    const universeTxPerSec = universeTxTotal / uptimeSec;
    const health = healthFromCounters();
    return Object.freeze({
      ok: true,
      version: 'step22t-artnet-frame-sync-monitor',
      health,
      targetFps,
      expectedUniverses,
      expectedPackets,
      artSync,
      counters: Object.freeze({
        frameTx,
        droppedFrames,
        lateFrames,
        partialCommits,
        validationBlocks,
        rateLimited,
        unsafeLiveDesync,
        universeTxTotal
      }),
      metrics: Object.freeze({
        outFps: Math.round(outFps * 100) / 100,
        universeTxPerSec: Math.round(universeTxPerSec * 100) / 100,
        frameAgeMs: ageMs,
        avgJitterMs: Math.round(avgJitterMs * 100) / 100,
        syncDriftMs: lastRecord ? lastRecord.jitterMs : 0
      }),
      lastRecord,
      timeline: Object.freeze([...timeline])
    });
  }

  function setTargetFps(fps) {
    targetFps = Math.max(1, Math.trunc(clampNumber(fps, targetFps)));
    return getSnapshot();
  }

  function reset(reason = 'manual-reset') {
    startedAt = Date.now();
    lastFrameAt = 0;
    lastFrameId = 0;
    frameTx = 0;
    droppedFrames = 0;
    lateFrames = 0;
    partialCommits = 0;
    validationBlocks = 0;
    rateLimited = 0;
    unsafeLiveDesync = 0;
    jitterSamples = [];
    universeTxTotal = 0;
    lastRecord = Object.freeze({ at: Date.now(), frameId: 0, ok: true, reason: String(reason || 'manual-reset') });
    timeline.length = 0;
    pushTimeline(lastRecord);
    return getSnapshot();
  }

  return Object.freeze({ recordFrame, getSnapshot, setTargetFps, reset });
}
