import fs from "fs";
import os from "os";
import path from "path";

export function registerMetaRoutes(app, { publicDir, assetFolderAliases } = {}) {
  app.get("/api/network/adapters", (req, res) => {
    const adapters = [];
    for (const [name, addresses] of Object.entries(os.networkInterfaces())) {
      for (const address of addresses || []) {
        if (address.family !== "IPv4" || address.internal) continue;
        adapters.push({
          id: `${name}|${address.address}`,
          name,
          address: address.address,
          label: `${name} - ${address.address}`
        });
      }
    }
    res.json({ ok: true, adapters });
  });

  app.get("/api/list/:folder", (req, res) => {
    const folder = assetFolderAliases[req.params.folder];
    if (!folder) return res.status(404).json([]);

    const dir = path.join(publicDir, folder);
    fs.readdir(dir, (err, files) => {
      if (err) return res.json([]);
      res.json(
        files
          .filter((file) => file.endsWith(".js"))
          .sort((a, b) => a.localeCompare(b))
      );
    });
  });
}
