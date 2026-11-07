import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const source = readFileSync(join(root, "public", "runtime", "render_pipeline.js"), "utf8");

const failures = [];

function expect(pattern, note) {
  if (!pattern.test(source)) failures.push(note);
}

function reject(pattern, note) {
  if (pattern.test(source)) failures.push(note);
}

expect(/const capFps = livePreviewFpsCap\(Number\(runtimeProfile\.previewFps \|\| 30\)\);/, "visible preview should use the Settings main preview FPS");
expect(/const shaderLedFrame = documentRef\?\.body\?\.dataset\?\.shaderPreviewSize === "led";/, "shader LED frame mode should be explicit");
expect(/const shaderCap = shaderLedFrame \? \(1000 \/ Math\.max\(1, previewFrameMs\)\) : 120;/, "shader LED frame should follow the main preview FPS");
expect(/const gpuScene = !shaderLedFrame && now >= getForceCpuPreviewUntil\(\) \? createGpuScene\(\) : null;/, "shader LED frame should bypass the full-resolution shader scene");
reject(/const shaderCapDuringOutput = outputPriorityPreviewActive\(\) \? 15 : 120;/, "legacy shader output cap must be removed");
expect(/const shellRawPreviewFps = readStoredLayerPreviewFps\(outputPriorityPreviewActive\(\) \? 8 : 6\);/, "raw layer preview should use the 8 FPS output cap");

if (failures.length) {
  console.error("Preview FPS contract failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Preview FPS contract passed.");
