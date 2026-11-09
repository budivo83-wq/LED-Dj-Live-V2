import assert from "node:assert/strict";
import { createRuntimeProfile } from "../src/server/runtime_profile.js";

const profile = createRuntimeProfile();

assert.equal(profile.mode, "normal", "default desktop profile must be NORMAL");
assert.equal(profile.startupThumbPreload, true, "desktop startup must preload thumbnails");
assert.equal(profile.disableThumbWarmup, false, "desktop startup must keep thumbnail warmup enabled");
assert.equal(profile.runtimeThumbRender, true, "desktop runtime thumbnail rendering must stay enabled");

console.log("Runtime profile contract passed (desktop picker cache is enabled at startup).");
