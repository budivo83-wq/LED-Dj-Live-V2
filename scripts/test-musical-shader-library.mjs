import assert from "node:assert/strict";
import { LOCAL_MODULE_MANIFEST as serverManifest } from "../src/server/local_module_manifest.js";
import { LOCAL_MODULE_MANIFEST as clientManifest } from "../public/runtime/local_module_manifest.js";

const files = [
  "shader_melodic_constellation.js",
  "shader_polyrhythm_ribbons.js",
  "shader_chordal_bloom.js",
  "shader_golden_arpeggio.js",
  "shader_synthwave_tides.js",
  "shader_echo_chimes.js",
  "shader_broken_beat_orbits.js",
  "shader_harmonic_veil.js",
  "shader_luminous_counterpoint.js",
  "shader_dream_sequence.js"
];

for (const file of files) {
  assert.ok(serverManifest.l1_anims.includes(file), `${file} must be available for server layer 1`);
  assert.ok(serverManifest.l2_anims.includes(file), `${file} must be available for server layer 2`);
  assert.ok(clientManifest.l1_anims.includes(file), `${file} must be available for client layer 1`);
  assert.ok(clientManifest.l2_anims.includes(file), `${file} must be available for client layer 2`);

  const module = await import(`../public/l1_anims/${file}`);
  assert.ok(module.meta?.name, `${file} must expose a display name`);
  assert.equal(typeof module.render, "function", `${file} must expose render()`);
  for (const [x, y, t] of [[0.12, 0.24, 0], [0.5, 0.5, 1.73], [0.87, 0.66, 4.91]]) {
    const rgb = module.render(x, y, t, [0.42, 0.63, 0.57, 0.71]);
    assert.equal(rgb.length, 3, `${file} must return RGB`);
    assert.ok(rgb.every((value) => Number.isFinite(value) && value >= 0 && value <= 255), `${file} returned invalid RGB`);
  }
}

console.log("MUSICAL_SHADER_LIBRARY: PASS (10 modules, both layers)");
