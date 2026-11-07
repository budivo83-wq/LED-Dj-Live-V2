import { buildStep22DrPreflight, STEP22DR_ARTNET_PREFLIGHT_VERSION } from '../output/artnet_preflight_22dr.js';

export function registerArtNetOperatorRoutes22DR(app) {
  app.get('/api/artnet/operator/preflight', (req, res) => {
    try { res.json(buildStep22DrPreflight(req.query || {})); }
    catch (error) { res.status(400).json({ ok: false, version: STEP22DR_ARTNET_PREFLIGHT_VERSION, error: error.message }); }
  });
}
