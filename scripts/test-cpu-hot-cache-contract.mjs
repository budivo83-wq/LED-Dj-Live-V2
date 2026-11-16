import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("public/layer_runtime.js", "utf8");
assert.match(source, /invWidth: frameWidth > 1/);
assert.match(source, /invHeight: frameHeight > 1/);
assert.match(source, /normalizedParams\(params\)/);
assert.match(source, /layerCoordX\(layerState, x, hot\)/);
assert.match(source, /layerCoordY\(layerState, y, hot\)/);
assert.doesNotMatch(source, /x \/ \(W - 1\)/);
assert.doesNotMatch(source, /y \/ \(H - 1\)/);

console.log("CPU hot-cache contract passed.");
