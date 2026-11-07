export function registerMiscRoutes(app) {
  app.get("/favicon.ico", (req, res) => {
    res.status(204).end();
  });
}
