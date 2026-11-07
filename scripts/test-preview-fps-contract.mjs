import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const source = readFileSync(join(root, "public", "runtime", "render_pipeline.js"), "utf8");

const failures = [];

function expect(pattern, note) {
  if (!pattern.test(source)) failures.push(note);
}

expect(/function readOutputPriorityPreviewFps\(fallback = 24\)/, "output priority preview should default to 24 FPS");
expect(/return Math\.max\(18, Math\.min\(30, Math\.round\(safe\)\)\);/, "output priority preview should stay in the 18-30 FPS band");
expect(/const capFps = readOutputPriorityPreviewFps\(24\);/, "visible preview should use the 24 FPS output-priority cap");
expect(/const shaderCapDuringOutput = outputPriorityPreviewActive\(\) \? 15 : 120;/, "shader preview should use the 15 FPS output cap");
expect(/const shellRawPreviewFps = readStoredLayerPreviewFps\(outputPriorityPreviewActive\(\) \? 8 : 6\);/, "raw layer preview should use the 8 FPS output cap");

if (failures.length) {
  console.error("Preview FPS contract failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Preview FPS contract passed.");
