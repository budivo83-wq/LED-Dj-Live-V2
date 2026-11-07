export function registerStaticAssets(app, { publicDir, expressRef } = {}) {
  app.use(expressRef.static(publicDir, {
    etag: false,
    lastModified: false,
    setHeaders: (res, filePath) => {
      if (/\.(js|mjs|css|html)$/i.test(filePath)) {
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
      }
    }
  }));
}
