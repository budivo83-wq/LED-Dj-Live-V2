function num(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function registerArtNetLiveInputRoutes22GN(app, { expressRef, liveInput22GN, liveSender22DQ } = {}) {
  const jsonParser = expressRef?.json ? expressRef.json({ limit: '64kb' }) : (_req, _res, next) => next();

  app.get('/api/artnet/live-input/status', (_req, res) => {
    const input = liveInput22GN?.status?.() || { ok: false, error: 'live_input_not_available' };
    const output = liveSender22DQ?.status?.() || null;
    res.json({ ...input, output });
  });

  app.post('/api/artnet/live-input/start', jsonParser, (req, res) => {
    try {
      const body = req.body || {};
      const input = liveInput22GN.start(body);
      let output = null;
      if (liveSender22DQ?.start) {
        output = liveSender22DQ.start({
          mode: 'udp-armed',
          armed: true,
          visualPattern: 'master-framebus',
          sourceMode: 'live-input',
          outputIp: body.outputIp || process.env.LED_ARTNET_TARGET_IP || '2.1.1.30',
          bindIp: body.outputBindIp ?? body.txBindIp ?? process.env.LED_ARTNET_BIND_IP ?? '',
          port: num(body.outputPort ?? process.env.LED_ARTNET_TARGET_PORT, 6454),
          fps: num(body.fps ?? process.env.LED_ARTNET_FPS, 30),
          stripCount: num(body.stripCount, 8),
          pixelsPerStrip: num(body.pixelsPerStrip, 300),
          pixelsPerUniverse: num(body.pixelsPerUniverse, 170),
          startUniverse: num(body.startUniverse ?? body.universeStart, 0),
          universeStart: num(body.startUniverse ?? body.universeStart, 0),
          masterMaxAgeMs: num(body.masterMaxAgeMs, 500),
          lastGoodHoldMs: num(body.lastGoodHoldMs, 1500),
          blackoutAfterHold: body.blackoutAfterHold || 'off',
          maxLiveFps: num(body.maxLiveFps ?? body.fps, 30),
          packetPaceMs: num(body.packetPaceMs, 0),
          packetsPerBurst: num(body.packetsPerBurst, 16),
          callbackMode: body.callbackMode || 'lightweight',
          artSyncMode: body.artSyncMode || 'every-frame'
        });
      }
      res.json({ ...input, output, bridge: { ok: true, mode: 'live-input-to-master-framebus-to-artnet-output', outputSource: 'master-framebus' } });
    } catch (error) {
      res.status(500).json({ ok: false, error: error?.message || String(error) });
    }
  });

  app.post('/api/artnet/live-input/stop', jsonParser, (_req, res) => {
    try {
      const input = liveInput22GN.stop();
      const output = liveSender22DQ?.stop ? liveSender22DQ.stop() : null;
      res.json({ ...input, output });
    } catch (error) {
      res.status(500).json({ ok: false, error: error?.message || String(error) });
    }
  });
}
