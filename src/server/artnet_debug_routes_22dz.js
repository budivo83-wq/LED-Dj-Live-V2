export const STEP22DZ_ARTNET_DEBUG_ROUTES_VERSION = "STEP22DZ_ARTNET_DEBUG_DIAGNOSTICS_ONLY";

function unavailable(res) {
  return res.status(503).json({ ok: false, version: STEP22DZ_ARTNET_DEBUG_ROUTES_VERSION, error: "artnet debug service unavailable" });
}

export function registerArtNetDebugRoutes22DZ(app, { artnetControlService } = {}) {
  app.get("/api/artnet/debug/status", (_req, res) => {
    if (!artnetControlService) return unavailable(res);
    return res.json({ ok: true, version: STEP22DZ_ARTNET_DEBUG_ROUTES_VERSION, snapshot: artnetControlService.snapshot() });
  });

  app.post("/api/artnet/debug/stop", (req, res) => {
    if (!artnetControlService) return unavailable(res);
    return res.json({ ok: true, version: STEP22DZ_ARTNET_DEBUG_ROUTES_VERSION, snapshot: artnetControlService.stop() });
  });

  app.post("/api/artnet/debug/discovery", (req, res) => {
    if (!artnetControlService) return unavailable(res);
    const sent = artnetControlService.discoverNodes();
    const nodes = artnetControlService.getDiscoveredNodes(req.body?.maxAgeMs || 30000);
    return res.json({ ok: Boolean(sent), version: STEP22DZ_ARTNET_DEBUG_ROUTES_VERSION, sent: Boolean(sent), nodes, snapshot: artnetControlService.snapshot() });
  });

  app.get("/api/artnet/debug/nodes", (req, res) => {
    if (!artnetControlService) return unavailable(res);
    const nodes = artnetControlService.getDiscoveredNodes(req.query?.maxAgeMs || 30000);
    return res.json({ ok: true, version: STEP22DZ_ARTNET_DEBUG_ROUTES_VERSION, nodes, count: nodes.length });
  });

  app.post("/api/artnet/debug/target/validate", (req, res) => {
    if (!artnetControlService) return unavailable(res);
    artnetControlService.configureTarget?.({
      host: req.body?.host || req.body?.targetIp || "",
      port: req.body?.port || req.body?.targetPort || 0
    });
    const validation = artnetControlService.validateTarget(req.body || {});
    return res.json({ ok: validation.ok, version: STEP22DZ_ARTNET_DEBUG_ROUTES_VERSION, validation });
  });
}
