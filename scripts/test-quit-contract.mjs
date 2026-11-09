import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");

const launcher = read(".launch_leddj.ps1");
const vbs = read("launch.vbs");
const ops = read("src/server/ops_routes.js");
const uiFiles = [
  "public/runtime/center_menu_controls.js",
  "public/settings.js",
  "public/shorts.js"
];

assert.match(launcher, /taskkill\.exe \/PID \$pid \/T \/F/);
assert.match(launcher, /Get-Process -Id \$script:node\.Id/);
assert.match(vbs, /taskkill\.exe \/PID \$pid \/T \/F/);
assert.match(vbs, /Get-Process -Id \$script:node\.Id/);
assert.match(ops, /app\.post\("\/api\/device\/quit"/);
assert.match(ops, /shutdown\("api:quit"\)/);

for (const file of uiFiles) {
  const source = read(file);
  assert.match(source, /sendBeacon/);
  assert.match(source, /void fetch/);
  assert.match(source, /\/api\/device\/quit/);
}
assert.match(read("public/shell.js"), /led-shell-quit/);
assert.match(read("public/runtime/center_menu_controls.js"), /led-shell-quit/);

console.log(`Quit contract passed (${uiFiles.length} UI entry points, launcher cleanup, server route).`);
