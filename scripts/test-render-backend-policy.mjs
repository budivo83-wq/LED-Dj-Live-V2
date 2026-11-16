import assert from "node:assert/strict";
import { decideRenderBackend } from "../public/runtime/render_backend_policy.js";

const gpu = { gpuAllowed: true, gpuSceneAvailable: true };

assert.equal(decideRenderBackend({ ...gpu, previewMode: "shader" }).backend, "gpu");
assert.equal(decideRenderBackend({ ...gpu, previewMode: "shader" }).needsCpuFrame, false);
assert.equal(decideRenderBackend({ ...gpu, previewMode: "pixel" }).needsCpuFrame, true);
assert.equal(decideRenderBackend({ ...gpu, previewMode: "pixel" }).needsGpuReadback, true);
assert.equal(decideRenderBackend({ ...gpu, previewMode: "shader", shaderPreviewSize: "led" }).needsCpuFrame, true);
assert.equal(decideRenderBackend({ ...gpu, previewMode: "dual" }).needsCpuFrame, true);
assert.equal(decideRenderBackend({ ...gpu, forceCpuRender: true, previewMode: "shader" }).backend, "cpu");
assert.equal(decideRenderBackend({ ...gpu, outputActive: true, previewMode: "shader" }).needsGpuReadback, true);

console.log("Render backend policy contract passed.");
