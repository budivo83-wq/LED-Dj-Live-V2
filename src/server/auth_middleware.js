export function createAuthGate({
  authController,
  publicPaths,
  canUseDebugApi
} = {}) {
  return function authGate(req, res, next) {
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
