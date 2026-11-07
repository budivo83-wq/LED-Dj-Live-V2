export function registerOpsRoutes(app, {
  canUseDebugApi,
  shutdown,
  runDevicePowerCommand,
  getHealth
} = {}) {
  app.post("/api/device/reboot", (req, res) => {
    runDevicePowerCommand("reboot");
    res.json({ ok: true });
  });

  app.post("/api/device/shutdown", (req, res) => {
    runDevicePowerCommand("shutdown");
    res.json({ ok: true });
  });

  app.post("/api/device/quit", (req, res) => {
    res.json({ ok: true });
    setTimeout(() => {
      shutdown("api:quit");
    }, 50);
  });

  app.post("/api/debug/shutdown", (req, res) => {
    if (!canUseDebugApi(req)) return res.status(403).json({ ok: false });
    res.json({ ok: true });
    setTimeout(() => {
      shutdown("api:debug");
    }, 20);
  });

  app.get("/api/health", (req, res) => {
    res.json({ ok: true, clients: getHealth().wsClients });
  });

  app.get("/api/health/details", (req, res) => {
    res.json(getHealth());
  });
}
