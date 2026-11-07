import fs from "node:fs";
import path from "node:path";

export function loadLocalEnv({ rootDir = process.cwd(), files = [".env.local", ".env"] } = {}) {
  const loaded = [];
  for (const file of files) {
    const full = path.join(rootDir, file);
    if (!fs.existsSync(full)) continue;
    const text = fs.readFileSync(full, "utf8");
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!m) continue;
      const key = m[1];
      let value = m[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
    loaded.push(file);
  }
  return Object.freeze({ ok: true, loaded });
}
