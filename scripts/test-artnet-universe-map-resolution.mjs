import { buildDefaultEightStripUniverseMap, resolveUniverseMap } from "../src/output/artnet_core.js";
import { createOutputManager } from "../src/output/output_manager.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const customUniverseMap = Object.freeze({
  version: "custom-map",
  stripCount: 1,
  pixelsPerStrip: 2,
  pixelsPerUniverse: 2,
  totalPixels: 2,
  universeCount: 1,
  enabledUniverses: Object.freeze([
    Object.freeze({
      strip: 0,
      universe: 7,
      startPixel: 0,
      globalPixelStart: 0,
      length: 2,
      outputIp: "127.0.0.1",
      enabled: true
    })
  ]),
  strips: Object.freeze([]),
  universes: Object.freeze([])
});

const resolvedExplicit = resolveUniverseMap({ universeMap: customUniverseMap });
assert(resolvedExplicit === customUniverseMap, "resolveUniverseMap must preserve an explicit universe map");

const resolvedDefault = resolveUniverseMap({ map: { stripCount: 2, pixelsPerStrip: 3, pixelsPerUniverse: 3 } });
assert(resolvedDefault.version === "artnet-universe-map-v2-continuous", "resolveUniverseMap must build the default ArtNet map");
assert(resolvedDefault.stripCount === 2, "resolveUniverseMap must forward map options");
assert(resolvedDefault.pixelsPerStrip === 3, "resolveUniverseMap must forward pixelsPerStrip");

const defaultMap = buildDefaultEightStripUniverseMap({ stripCount: 1, pixelsPerStrip: 2, pixelsPerUniverse: 2 });
assert(defaultMap.universeCount === 1, "buildDefaultEightStripUniverseMap sanity check failed");

const manager = createOutputManager({
  transport: "artnet",
  universeMap: customUniverseMap,
  artnet: { universeMap: customUniverseMap }
});

const artnetStatus = manager.getOutput("artnet").getStats();
assert(artnetStatus.universeCount === 1, "createOutputManager must pass the explicit universe map into the ArtNet adapter");

console.log("ArtNet universe map resolution test passed.");
