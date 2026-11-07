export function evaluateStartupOverlayHealthRuntime({
  now,
  startupReadyAt,
  startupFrameCount,
  startupLastFrameAt,
  startupStableSince,
  stallGapMs,
  minFrames,
  stableMsThreshold,
  minWarmupMs,
  progressStableMs,
  progressAfterReadyMs
}) {
  const nextFrameCount = startupFrameCount + 1;
  const gap = startupLastFrameAt ? (now - startupLastFrameAt) : 0;
  const nextLastFrameAt = now;

  let nextStableSince = startupStableSince;
  if (gap > stallGapMs) nextStableSince = 0;
  else if (!nextStableSince) nextStableSince = now;

  const stableMs = nextStableSince ? (now - nextStableSince) : 0;
  const afterReadyMs = now - startupReadyAt;
  const enoughFrames = nextFrameCount >= minFrames;
  const enoughStable = stableMs >= stableMsThreshold;
  const enoughWarmupTime = afterReadyMs >= minWarmupMs;
  const progressRatio = Math.max(
    0,
    Math.min(
      1,
      Math.max(
        nextFrameCount / minFrames,
        stableMs / progressStableMs,
        afterReadyMs / progressAfterReadyMs
      )
    )
  );

  return {
    startupFrameCount: nextFrameCount,
    startupLastFrameAt: nextLastFrameAt,
    startupStableSince: nextStableSince,
    enoughFrames,
    enoughStable,
    enoughWarmupTime,
    progressRatio
  };
}
