export function registerAuthRoutes(app, { authController } = {}) {
  app.post("/api/auth/login", (req, res) => {
    const token = authController.login(req.body?.username, req.body?.password);
    if (!token) return res.status(401).json({ ok: false });
    res.setHeader("Set-Cookie", `led_session=${token}; Path=/; HttpOnly; SameSite=Lax`);
    res.json({ ok: true });
  });

  app.post("/api/auth/change", (req, res) => {
    if (!authController.isAuthenticated(req)) return res.status(401).json({ ok: false });
    const ok = authController.changePassword(req.body?.oldPassword, req.body?.newPassword, req.body?.repeatPassword);
    if (!ok) return res.status(400).json({ ok: false });
    res.json({ ok: true });
  });

  app.post("/api/auth/logout", (req, res) => {
    authController.logout(req);
    res.setHeader("Set-Cookie", "led_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
    res.json({ ok: true });
  });
}
