import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const source = readFileSync(join(root, "public", "runtime", "render_pipeline.js"), "utf8");
const fpsSource = readFileSync(join(root, "public", "runtime", "fps_governor.js"), "utf8");
const appSource = readFileSync(join(root, "public", "app.js"), "utf8");
const startupSource = readFileSync(join(root, "public", "runtime", "startup_sequence.js"), "utf8");

const failures = [];

function expect(pattern, note) {
  if (!pattern.test(source)) failures.push(note);
}

function reject(pattern, note) {
  if (pattern.test(source)) failures.push(note);
}

expect(/const capFps = livePreviewFpsCap\(60\);/, "visible preview should use the Settings main preview FPS");
expect(/const shaderLedFrame = documentRef\?\.body\?\.dataset\?\.shaderPreviewSize === "led";/, "shader LED frame mode should be explicit");
expect(/const shaderCap = shaderLedFrame \? \(1000 \/ Math\.max\(1, previewFrameMs\)\) : 120;/, "shader LED frame should follow the main preview FPS");
expect(/const gpuScene = !shaderLedFrame && now >= getForceCpuPreviewUntil\(\) \? createGpuScene\(\) : null;/, "shader LED frame should bypass the full-resolution shader scene");
reject(/const shaderCapDuringOutput = outputPriorityPreviewActive\(\) \? 15 : 120;/, "legacy shader output cap must be removed");
expect(/const shellRawPreviewFps = readStoredLayerPreviewFps\(outputPriorityPreviewActive\(\) \? 8 : 60\);/, "raw layer preview should use the Settings 60 FPS default");
expect(/const previewMode = String\(getPreviewMode\?\.\(\) \|\| ""\)\.toLowerCase\(\);/, "preview cadence should inspect the active mode");
expect(/if \(previewMode === "shader"\)/, "shader preview should not inherit the low live-output monitor cap");
expect(/const shaderFps = Number\(getShaderPreviewFps\?\.\(\) \|\| 60\);/, "shader cadence should use the configured shader FPS");
expect(/setRenderTime\(getBeatPosition\(\)\);/, "shader draws should refresh animation time independently of the CPU monitor frame");
expect(/Math\.min\(60, Math\.round\(stored\)\)/, "main Performance preview should allow the configured 60 FPS");
expect(/const safeFps = Math\.max\(1, Math\.min\(60, Math\.round\(Number\.isFinite\(fps\) \? fps : 4\)\)\);/, "shell canvas monitor should allow the configured 60 FPS");
expect(/group: 'render-preview', liveFactor: 1, hiddenFactor: 4/, "visible preview timer must not be slowed during live output");
expect(/windowRef\.dispatchEvent\(new CustomEvent\("led-preview-frame"/, "topbar should receive local preview frame telemetry");
expect(/windowRef\.requestAnimationFrame\(waitForPaint\)/, "visible preview should follow the browser paint clock");
expect(/budilight-preview-fps-changed/, "preview settings changes should invalidate the runtime cache");
expect(/new windowRef\.BroadcastChannel\("budilight-settings"\)/, "preview settings should sync across shell iframes");
expect(/legacy safety profile value \(historically 6 FPS\)/, "legacy 6 FPS profile must not override visible preview cadence");
if (!/return cap;/.test(fpsSource)) {
  failures.push("preview FPS must not be capped by transport/output FPS");
}
expect(/const quietShellMount = false;/, "startup must not suppress the first visible shell frame");
expect(/function initialShellViewActive37CF\(\)/, "shell startup should recover active state from the visible iframe");
expect(/active: initialShellViewActive37CF\(\),/, "visible Performance iframe should start active even if the shell message races");
if (!/function scheduleNextDraw\(now = performance\.now\(\), force = false\)/.test(appSource)
  || !/renderPipeline\?\.scheduleNextDraw\(now, force\);/.test(appSource)) {
  failures.push("startup and visibility refreshes should forward the forced preview restart");
}
if (!/state\.previewMode = "shader";/.test(startupSource)
  || !/state\.shaderPreviewMode = "big";/.test(startupSource)
  || !/renderPipeline\?\.draw\?\.\(performance\.now\(\)\);/.test(startupSource)) {
  failures.push("startup should select shader BIG and draw the first preview frame");
}
if (!/scheduleNextDraw\(activeAt, true\);/.test(source)) {
  failures.push("activating the Performance shell view should force an immediate preview draw");
}

if (failures.length) {
  console.error("Preview FPS contract failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Preview FPS contract passed.");
