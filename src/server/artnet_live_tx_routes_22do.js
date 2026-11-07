import { buildArtnetDryRunFrame, buildStep22DoPlan, STEP22DO_ARTNET_TX_VERSION } from '../output/artnet_live_tx_22do.js';

export function registerArtNetLiveTxRoutes22DO(app, { expressRef } = {}) {
  const jsonParser = expressRef?.json?.({ limit: '8mb' });

  app.get('/api/artnet/live-tx/plan', (req, res) => {
    try {
      const plan = buildStep22DoPlan(req.query || {});
      res.json(plan);
    } catch (error) {
      res.status(400).json({ ok: false, version: STEP22DO_ARTNET_TX_VERSION, error: error.message });
    }
  });

  app.post('/api/artnet/live-tx/dry-frame', jsonParser, (req, res) => {
    try {
      const body = req.body || {};
      const result = buildArtnetDryRunFrame({ ...body, rgb: body.rgb || body.frame || body.payload });
      res.json({
        ok: true,
        version: STEP22DO_ARTNET_TX_VERSION,
        summary: result.summary,
        map: result.map,
        packetPreview: result.packets.slice(0, 3).map((packet) => ({
          universe: packet.universe ?? null,
          opCode: packet.opCode,
          packetBytes: packet.packetBytes,
          firstBytes: Array.from(packet.packet.slice(0, 18)).map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join(' ')
        }))
      });
    } catch (error) {
      res.status(400).json({ ok: false, version: STEP22DO_ARTNET_TX_VERSION, error: error.message });
    }
  });
}
