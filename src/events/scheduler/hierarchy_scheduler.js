function clampBpm(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 120;
  return Math.max(1, Math.min(999, n));
}

/**
 * Emits event hierarchy:
 * tick -> beat -> bar -> phrase
 */
export function createEventScheduler(options = {}) {
  const bus = options.bus;
  const beatsPerBar = Math.max(1, Number(options.beatsPerBar || 4));
  const barsPerPhrase = Math.max(1, Number(options.barsPerPhrase || 8));

  let lastNow = 0;
  let beatCount = 0;
  let barCount = 0;
  let phraseCount = 0;
  let beatPhase = 0;

  function tick(now, bpm = 120) {
    const t = Number(now);
    if (!Number.isFinite(t)) return;
    const dtMs = lastNow > 0 ? Math.max(0, t - lastNow) : 0;
    lastNow = t;

    const clampedBpm = clampBpm(bpm);
    const beatsPerSec = clampedBpm / 60;
    const dtBeats = (dtMs / 1000) * beatsPerSec;

    beatPhase += dtBeats;

    bus?.emit('tick', {
      now: t,
      dtMs,
      bpm: clampedBpm,
      beatPhase,
      beatCount,
      barCount,
      phraseCount
    });

    while (beatPhase >= 1) {
      beatPhase -= 1;
      beatCount += 1;
      bus?.emit('beat', {
        now: t,
        bpm: clampedBpm,
        beatCount,
        barCount,
        phraseCount
      });

      if (beatCount % beatsPerBar === 0) {
        barCount += 1;
        bus?.emit('bar', {
          now: t,
          bpm: clampedBpm,
          beatCount,
          barCount,
          phraseCount
        });

        if (barCount % barsPerPhrase === 0) {
          phraseCount += 1;
          bus?.emit('phrase', {
            now: t,
            bpm: clampedBpm,
            beatCount,
            barCount,
            phraseCount
          });
        }
      }
    }
  }

  function getState() {
    return {
      beatCount,
      barCount,
      phraseCount,
      beatPhase,
      beatsPerBar,
      barsPerPhrase
    };
  }

  return {
    tick,
    getState
  };
}
