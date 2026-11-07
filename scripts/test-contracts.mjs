import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

const requiredFiles = [
  "server.js",
  "public/index.html",
  "public/login.html",
  "public/mapping.html",
  "public/settings.html",
  "public/animations.html",
  "public/app.js",
  "public/runtime/startup_sequence.js",
  "public/runtime/selected_modules_loader.js",
  "src/server/main_routes_registry.js",
  "src/server/auth_routes.js",
  "src/server/meta_routes.js",
  "src/server/live_routes.js"
];

const requiredPatterns = [
  {
    file: "src/server/auth_routes.js",
    pattern: /app\.post\("\/api\/auth\/login"/,
    note: "login route must stay registered"
  },
  {
    file: "src/server/meta_routes.js",
    pattern: /app\.get\("\/api\/list\/:folder"/,
    note: "module list API must stay registered"
  },
  {
    file: "src/server/live_routes.js",
    pattern: /app\.get\("\/api\/live\/state"/,
    note: "live state API must stay registered"
  },
  {
    file: "public/app.js",
    pattern: /runStartupSequence\(/,
    note: "performance boot must use startup sequence orchestration"
  },
  {
    file: "public/app.js",
    pattern: /loadSelectedModulesRuntime\(/,
    note: "performance boot must delegate selected module loading"
  },
  {
    file: "public/runtime/selected_modules_loader.js",
    pattern: /loadSelectedModulesRuntime/,
    note: "selected module loader runtime contract must exist"
  }
];

const failures = [];

for (const file of requiredFiles) {
  if (!existsSync(join(root, file))) failures.push(`${file} missing`);
}

for (const entry of requiredPatterns) {
  const full = join(root, entry.file);
  if (!existsSync(full)) {
    failures.push(`${entry.file} missing (${entry.note})`);
    continue;
  }
  const source = readFileSync(full, "utf8");
  if (!entry.pattern.test(source)) failures.push(`${entry.file} contract failed: ${entry.note}`);
}

if (failures.length) {
  console.error("Contract guard failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Contract guard passed (${requiredFiles.length} files, ${requiredPatterns.length} assertions).`);
