import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const failures = [];

const requiredPatterns = [
  {
    file: "src/ui/index.js",
    pattern: /export const STAGED_UI_BOUNDARY = Object\.freeze\(\{/,
    note: "src/ui must declare an explicit staged boundary marker",
  },
  {
    file: "src/ui/index.js",
    pattern: /wiredToLiveRuntime:\s*false/,
    note: "src/ui boundary must stay detached from the live runtime",
  },
  {
    file: "src/ui/screen_manager.js",
    pattern: /const SCREEN_FACTORIES = Object\.freeze\(\{/,
    note: "screen manager must expose a fixed staged registry",
  },
];

for (const entry of requiredPatterns) {
  const source = readFileSync(join(root, entry.file), "utf8");
  if (!entry.pattern.test(source)) failures.push(entry.note);
}

const runtimeFiles = [
  "server.js",
  "public/app.js",
  "public/settings.js",
  "public/shell.js",
];

for (const file of runtimeFiles) {
  const source = readFileSync(join(root, file), "utf8");
  if (/createUiScreenManager/.test(source)) {
    failures.push(`${file} must not import or call createUiScreenManager while src/ui stays staged`);
  }
  if (/from ['"][.\/]*src\/ui\//.test(source) || /from ['"][.\/]*src\/ui['"]/.test(source)) {
    failures.push(`${file} must not import staged src/ui modules`);
  }
}

if (failures.length) {
  console.error("UI staged boundary guard failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("UI staged boundary guard passed.");
