import { createOutputRouter22F } from '../output/output_router_22f.js';

function getRouter(context = {}) {
  return context.outputRouter22F || context.outputRouter || null;
}

function requireRouter(context = {}) {
  const router = getRouter(context);
  if (!router) {
    const error = new Error('AUTHORITATIVE_OUTPUT_ROUTER_UNAVAILABLE');
    error.statusCode = 503;
    throw error;
  }
  return router;
}

function makeTestFrame(pixelCount = 160, frameId = 1) {
  const count = Math.max(1, Math.min(2400, Math.floor(Number(pixelCount) || 160)));
  const rgb = new Array(count * 3).fill(0);
  for (let i = 0; i < count; i += 1) {
    const o = i * 3;
    rgb[o] = i % 2 ? 0 : 32;
    rgb[o + 1] = i % 2 ? 32 : 0;
    rgb[o + 2] = 0;
  }
  return { rgb, pixelCount: count, frameId };
}

export function registerOutputRouterRoutes22F(app, context = {}) {
  const jsonParser = context.expressRef?.json?.({ limit: '512kb' });

  app.get('/api/output-router/22f/status', (_req, res) => {
    try {
      res.json(requireRouter(context).getStatus());
    } catch (error) {
      res.status(error.statusCode || 400).json({ ok: false, error: String(error?.message || error) });
    }
  });

  app.post('/api/output-router/22f/profile', jsonParser, (req, res) => {
    try {
      const router = requireRouter(context);
      res.json(router.setProfile(req.body?.profile || req.body?.profileId || 'ESP32_4x40_RAW_SERIAL', req.body?.overrides || {}));
    } catch (error) {
      res.status(error.statusCode || 400).json({ ok: false, error: String(error?.message || error) });
    }
  });

  app.post('/api/output-router/22f/route-test-frame', jsonParser, (req, res) => {
    try {
      const router = requireRouter(context);
      const pixels = req.body?.pixels ?? req.body?.pixelCount ?? 160;
      const frame = req.body?.frame || makeTestFrame(pixels, req.body?.frameId || Date.now());
      const result = router.routeFrame(frame, {
        mode: req.body?.mode || req.body?.output || req.body?.transport,
        overrides: req.body?.overrides || {}
      });
      res.json({ ok: result.ok !== false, result, status: router.getStatus() });
    } catch (error) {
      res.status(error.statusCode || 400).json({ ok: false, error: String(error?.message || error) });
    }
  });
}
