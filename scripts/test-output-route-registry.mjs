import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const failures = [];

function read(rel) {
  return readFileSync(join(root, rel), "utf8");
}

function mustMatch(source, pattern, note) {
  if (!pattern.test(source)) failures.push(note);
}

const indexHtml = read("public/index.html");
const routeRegistry = read("public/runtime/output_route_registry_37bb.js");
const routeHealth = read("public/runtime/output_route_health_37bd.js");
const watchdog = read("public/runtime/output_single_writer_watchdog_37be.js");
const writerInterlock = read("public/runtime/output_writer_interlock_37by.js");
const serverRegistry = read("src/server/server_output_registry_37bc.js");
const serverJs = read("server.js");

mustMatch(
  indexHtml,
  /<script src="runtime\/output_route_registry_37bb\.js\?v=37bb"><\/script>[\s\S]*<script src="runtime\/live_output_gate_37bw\.js\?v=37bw"><\/script>[\s\S]*<script src="runtime\/output_route_health_37bd\.js\?v=37bw"><\/script>[\s\S]*<script src="runtime\/output_writer_interlock_37by\.js\?v=37by"><\/script>[\s\S]*<script src="runtime\/output_health_panel_37cd\.js\?v=37ds"><\/script>[\s\S]*<script src="runtime\/live_serial_app_mirror_22cr\.js\?v=22cx"><\/script>/,
  "public/index.html must load route registry before route health, interlock, output health and mirror writers"
);

mustMatch(
  routeRegistry,
  /OWNER_PRIORITY\s*=\s*\{/,
  "output route registry must define explicit owner priorities"
);
mustMatch(
  routeRegistry,
  /register,\s*claim,\s*release,\s*canWrite,\s*markWrite,\s*snapshot,\s*prune/,
  "output route registry must expose the full route API"
);
mustMatch(
  routeRegistry,
  /__budilightOutputRouteRegistrySnapshot37BB/,
  "output route registry must publish a snapshot helper"
);
mustMatch(
  routeHealth,
  /__budilightOutputRouteRegistry37BB/,
  "output route health must read the browser registry"
);
mustMatch(
  routeHealth,
  /\/api\/output\/server-route-registry/,
  "output route health must poll the server route registry endpoint"
);
mustMatch(
  routeHealth,
  /dispatchEvent\(new CustomEvent\('budilight-output-route-health-37bd'/,
  "output route health must publish the combined snapshot event"
);
mustMatch(
  watchdog,
  /__budilightOutputRouteHealth37BD/,
  "single writer watchdog must read route health snapshots"
);
mustMatch(
  watchdog,
  /MISMATCH_GRACE_MS\s*=\s*950/,
  "single writer watchdog must keep the mismatch grace window"
);
mustMatch(
  watchdog,
  /function isWriteAllowed\(owner\)/,
  "single writer watchdog must expose a write gate"
);
mustMatch(
  watchdog,
  /enforcedFamily/,
  "single writer watchdog must track enforced writer family"
);
mustMatch(
  writerInterlock,
  /__budilightOutputRouteRegistry37BB/,
  "output writer interlock must wrap the route registry"
);
mustMatch(
  writerInterlock,
  /shouldBlockPacketSource/,
  "output writer interlock must expose packet-source blocking"
);
mustMatch(
  serverRegistry,
  /export function createServerOutputRegistry37BC/,
  "server output registry must expose a factory"
);
mustMatch(
  serverRegistry,
  /acquire,\s*canWrite,\s*release,\s*snapshot/,
  "server output registry must expose acquire/canWrite/release/snapshot"
);
mustMatch(
  serverJs,
  /\/api\/output\/server-route-registry/,
  "server.js must expose the server route registry endpoint"
);
mustMatch(
  serverJs,
  /serverOutputRegistry37BC\.snapshot\(\)/,
  "server.js endpoint must serve the live server registry snapshot"
);

if (failures.length) {
  console.error("Output route registry contract failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Output route registry contract passed.");
