import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const file = join(root, "public", "settings.js");
const source = readFileSync(file, "utf8");

const failures = [];

const requiredPatterns = [
  {
    pattern: /const ARTNET_SYNC_LIVE_API = Object\.freeze\(\{/,
    note: "settings must define an explicit ArtNet endpoint registry",
  },
  {
    pattern: /start:\s*'\/api\/artnet\/sync-live\/start'/,
    note: "settings must start ArtNet through sync-live start route",
  },
  {
    pattern: /stop:\s*'\/api\/artnet\/sync-live\/stop'/,
    note: "settings must stop ArtNet through sync-live stop route",
  },
  {
    pattern: /sendOne:\s*'\/api\/artnet\/sync-live\/send-one'/,
    note: "settings test-frame send must use sync-live send-one route",
  },
];

for (const entry of requiredPatterns) {
  if (!entry.pattern.test(source)) failures.push(entry.note);
}

const forbiddenPatterns = [
  {
    pattern: /\/api\/live\/artnet\/start/,
    note: "settings must not call legacy /api/live/artnet/start",
  },
  {
    pattern: /\/api\/live\/artnet\/stop/,
    note: "settings must not call legacy /api/live/artnet/stop",
  },
  {
    pattern: /\/api\/live\/artnet\/frame(?!\/solid)/,
    note: "settings must not send live frames through legacy /api/live/artnet/frame",
  },
];

for (const entry of forbiddenPatterns) {
  if (entry.pattern.test(source)) failures.push(entry.note);
}

if (failures.length) {
  console.error("ArtNet settings boundary guard failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("ArtNet settings boundary guard passed.");
