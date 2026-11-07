function getController(context = {}) {
  return context.artnetScheduler22P || null;
}

function requireController(context = {}) {
  const controller = getController(context);
  if (!controller) {
    const error = new Error('AUTHORITATIVE_ARTNET_SCHEDULER_UNAVAILABLE');
    error.statusCode = 503;
    throw error;
  }
  return controller;
}

export function registerArtNetSchedulerRoutes22P(app, context = {}) {
  const jsonParser = context.expressRef?.json?.({ limit: '2mb' });

  app.get('/api/artnet-scheduler/22p/status', (_req, res) => {
    try { res.json(requireController(context).getStatus()); }
    catch (error) { res.status(error.statusCode || 400).json({ ok: false, error: String(error?.message || error) }); }
  });

  app.post('/api/artnet-scheduler/22p/validate', jsonParser, (req, res) => {
    try {
      const controller = requireController(context);
      const body = req.body || {};
      const hasFrame = body.rgb || body.frame || body.payload;
      const frame = hasFrame ? body : { rgb: controller.buildTestFrame?.(body.pattern || 'segment-markers') };
      const validation = controller.validateFrame(frame);
      res.status(validation.ok ? 200 : 400).json(validation);
    }
    catch (error) { res.status(error.statusCode || 400).json({ ok: false, error: String(error?.message || error) }); }
  });

  app.post('/api/artnet-scheduler/22p/send-test-frame', jsonParser, (_req, res) => {
    res.status(409).json({ ok:false, disabled:true, version:'STEP22MC_SINGLE_WRITER_LOCK', error:'ALT_ARTNET_SCHEDULER_SEND_DISABLED', message:'Use /api/artnet/sync-live/* only.' });
  });


  app.post('/api/artnet-scheduler/22p/dry-run', jsonParser, (_req, res) => {
    res.status(409).json({ ok:false, disabled:true, version:'STEP22MC_SINGLE_WRITER_LOCK', error:'ALT_ARTNET_SCHEDULER_CONTROL_DISABLED' });
  });

  app.post('/api/artnet-scheduler/22p/arm-live', jsonParser, (_req, res) => {
    res.status(409).json({ ok:false, disabled:true, version:'STEP22MC_SINGLE_WRITER_LOCK', error:'ALT_ARTNET_SCHEDULER_ARM_DISABLED' });
  });

  app.post('/api/artnet-scheduler/22p/panic-blackout', jsonParser, (_req, res) => {
    res.status(409).json({ ok:false, disabled:true, version:'STEP22MC_SINGLE_WRITER_LOCK', error:'ALT_ARTNET_SCHEDULER_BLACKOUT_DISABLED' });
  });



  app.get('/api/artnet-scheduler/22p/frame-sync/22t', (_req, res) => {
    try { res.json(requireController(context).getFrameSyncMonitor22T?.() || { ok: false, error: 'FRAME_SYNC_MONITOR_22T_UNAVAILABLE' }); }
    catch (error) { res.status(error.statusCode || 400).json({ ok: false, error: String(error?.message || error) }); }
  });

  app.post('/api/artnet-scheduler/22p/frame-sync/22t/reset', jsonParser, (req, res) => {
    try { res.json(requireController(context).resetFrameSyncMonitor22T?.(req.body?.reason || 'api-reset') || { ok: false, error: 'FRAME_SYNC_MONITOR_22T_UNAVAILABLE' }); }
    catch (error) { res.status(error.statusCode || 400).json({ ok: false, error: String(error?.message || error) }); }
  });

  app.post('/api/artnet-scheduler/22p/poll', jsonParser, (_req, res) => {
    try {
      const controller = requireController(context);
      res.json({ ok: controller.poll(), nodes: controller.getDiscoveredNodes() });
    }
    catch (error) { res.status(error.statusCode || 400).json({ ok: false, error: String(error?.message || error) }); }
  });
}
