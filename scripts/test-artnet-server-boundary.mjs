import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const mainRoutes = readFileSync(join(root, "src", "server", "main_routes_registry.js"), "utf8");
const liveRoutes = readFileSync(join(root, "src", "server", "live_routes.js"), "utf8");
const liveArmPanel = readFileSync(join(root, "public", "runtime", "live_arm_panel.js"), "utf8");
const artnetDebugRoutes = readFileSync(join(root, "src", "server", "artnet_debug_routes_22dz.js"), "utf8");
const liveTransportDebug = readFileSync(join(root, "public", "runtime", "live_transport_debug.js"), "utf8");

const failures = [];

const required = [
  {
    source: mainRoutes,
    pattern: /Primary live ArtNet control surface for Settings and shell-owned output\./,
    note: "main route registry must document sync-live as primary ArtNet control surface",
  },
  {
    source: mainRoutes,
    pattern: /registerArtNetSyncLiveRoutes22DQ\(app,\s*\{\s*expressRef,\s*liveSender22DQ\s*\}\);/,
    note: "main route registry must register sync-live routes",
  },
  {
    source: mainRoutes,
    pattern: /Legacy\/manual diagnostics surface\./,
    note: "main route registry must mark live routes as legacy/manual diagnostics surface",
  },
  {
    source: mainRoutes,
    pattern: /registerArtNetDebugRoutes22DZ\(app,\s*\{\s*artnetControlService\s*\}\);/,
    note: "main route registry must register dedicated ArtNet debug routes",
  },
  {
    source: artnetDebugRoutes,
    pattern: /export const STEP22DZ_ARTNET_DEBUG_ROUTES_VERSION = /,
    note: "dedicated ArtNet debug routes file must exist",
  },
  {
    source: liveTransportDebug,
    pattern: /status:\s*"\/api\/artnet\/sync-live\/status"/,
    note: "transport debug module must expose sync-live status",
  },
  {
    source: liveTransportDebug,
    pattern: /discovery:\s*"\/api\/artnet\/debug\/discovery"/,
    note: "transport debug module must use dedicated ArtNet debug discovery route",
  },
  {
    source: liveTransportDebug,
    pattern: /setText\(refs\.liveArtnetDiagnosticsStatus,\s*"ARTNET START MOVED \| use Settings or guarded ArtNet dry\/physical output actions"\);/,
    note: "transport debug module must not drive legacy ArtNet start directly",
  },
];

for (const entry of required) {
  if (!entry.pattern.test(entry.source)) failures.push(entry.note);
}

const forbidden = [
  {
    source: liveArmPanel,
    pattern: /\/api\/live\/artnet\/frame\/solid/,
    note: "live arm panel must not use legacy ArtNet solid-frame writer",
  },
  {
    source: liveRoutes,
    pattern: /\/api\/live\/artnet\//,
    note: "live routes must not expose ArtNet endpoints anymore",
  },
  {
    source: liveArmPanel,
    pattern: /\/api\/live\/artnet\//,
    note: "live arm panel must not use /api/live/artnet routes anymore",
  },
];

for (const entry of forbidden) {
  if (entry.pattern.test(entry.source)) failures.push(entry.note);
}

if (failures.length) {
  console.error("ArtNet server boundary guard failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("ArtNet server boundary guard passed.");
