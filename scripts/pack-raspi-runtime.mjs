import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outDir = path.join(root, "dist");
const stage = path.join(outDir, "LED_Dj_live_raspi_runtime");
const zipPath = path.join(outDir, "LED_Dj_live_raspi_runtime.zip");

const include = [
  "package.json",
  "package-lock.json",
  "server.js",
  "auth.json",
  "engine-state.json",
  ".env.local",
  "public",
  "src",
  "data/animation-library.json",
  "data/live-state.json",
  "arduino",
  "README.md",
  "docs/STEP_13AG_RASPI_RUNTIME_ONLY.md"
];

fs.rmSync(stage, { recursive: true, force: true });
fs.mkdirSync(stage, { recursive: true });

function copyEntry(rel) {
  const src = path.join(root, rel);
  if (!fs.existsSync(src)) return;
  const dst = path.join(stage, rel);
  const stat = fs.statSync(src);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  if (stat.isDirectory()) {
    fs.cpSync(src, dst, {
      recursive: true,
      filter: (entry) => !entry.includes(`${path.sep}node_modules${path.sep}`)
        && !entry.includes(`${path.sep}.git${path.sep}`)
        && !entry.includes(`${path.sep}dist${path.sep}`)
    });
  } else {
    fs.copyFileSync(src, dst);
  }
}

for (const rel of include) copyEntry(rel);

fs.mkdirSync(path.join(stage, "data"), { recursive: true });
fs.writeFileSync(path.join(stage, "data", "live-audit-log.json"), "[]\n");

fs.rmSync(zipPath, { force: true });
try {
  execFileSync("zip", ["-qr", zipPath, "LED_Dj_live_raspi_runtime"], { cwd: outDir, stdio: "inherit" });
  console.log(`[pack:raspi] ${zipPath}`);
} catch (error) {
  console.log(`[pack:raspi] staged runtime at ${stage}`);
  console.log("[pack:raspi] zip command was not available; copy the staged folder manually.");
}
