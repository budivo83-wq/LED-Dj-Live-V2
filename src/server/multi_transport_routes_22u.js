function getManager(context = {}) {
  return context.multiTransport22U || null;
}

function requireManager(context = {}) {
  const manager = getManager(context);
  if (!manager) {
    const error = new Error('AUTHORITATIVE_MULTI_TRANSPORT_UNAVAILABLE');
    error.statusCode = 503;
    throw error;
  }
  return manager;
}

export function registerMultiTransportRoutes22U(app, context = {}) {
  const jsonParser = context.expressRef?.json?.({ limit: '8mb' });
  app.get('/api/output/multi-transport/22u/status', (_req, res) => {
    try { res.json(requireManager(context).getStatus()); }
    catch (error) { res.status(error.statusCode || 400).json({ ok: false, error: String(error?.message || error) }); }
  });
  app.post('/api/output/multi-transport/22u/start', jsonParser, (_req, res) => {
    res.status(409).json({ ok:false, disabled:true, version:'STEP22MC_SINGLE_WRITER_LOCK', error:'MULTI_TRANSPORT_START_DISABLED' });
  });
  app.post('/api/output/multi-transport/22u/stop', jsonParser, (_req, res) => {
    try { res.json(requireManager(context).stop()); }
    catch (error) { res.status(error.statusCode || 400).json({ ok: false, error: String(error?.message || error) }); }
  });
  app.post('/api/output/multi-transport/22u/enabled', jsonParser, (_req, res) => {
    res.status(409).json({ ok:false, disabled:true, version:'STEP22MC_SINGLE_WRITER_LOCK', error:'MULTI_TRANSPORT_CONTROL_DISABLED' });
  });
  app.post('/api/output/multi-transport/22u/send-frame', jsonParser, (_req, res) => {
    res.status(409).json({ ok:false, disabled:true, version:'STEP22MC_SINGLE_WRITER_LOCK', error:'MULTI_TRANSPORT_SEND_DISABLED' });
  });
  app.post('/api/output/multi-transport/22u/panic-blackout', jsonParser, (_req, res) => {
    res.status(409).json({ ok:false, disabled:true, version:'STEP22MC_SINGLE_WRITER_LOCK', error:'MULTI_TRANSPORT_BLACKOUT_DISABLED' });
  });
}
