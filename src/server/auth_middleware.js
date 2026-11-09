export function createAuthGate({
  authController,
  publicPaths,
  canUseDebugApi
} = {}) {
  return function authGate(req, res, next) {
    // The shell launcher and the local QUIT action must still work when the
    // browser session has expired. Keep these two control-plane endpoints
    // local-only; all UI/data APIs remain behind the normal auth gate.
    const remoteAddress = String(req.socket?.remoteAddress || req.ip || "");
    const loopback = remoteAddress === "127.0.0.1"
      || remoteAddress === "::1"
      || remoteAddress === "::ffff:127.0.0.1";
    if (loopback && (req.path === "/api/health" || req.path === "/api/device/quit")) return next();
    if (req.path === "/api/debug/shutdown" && canUseDebugApi(req)) return next();
    if (req.path.startsWith("/api/auth") || publicPaths.has(req.path)) return next();
    if (req.path === "/") {
      return authController.isAuthenticated(req)
        ? res.redirect("/shell.html?view=index.html")
        : res.redirect("/login.html");
    }
    if (authController.isAuthenticated(req)) return next();
    if (req.path.startsWith("/api/")) return res.status(401).json({ ok: false });
    return res.redirect("/login.html");
  };
}
