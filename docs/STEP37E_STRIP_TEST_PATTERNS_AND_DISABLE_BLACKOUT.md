# STEP37E - Strip test patterns and real strip disable

## Added

- More mapping probe patterns for physical verification:
  - START 20PX
  - MIDDLE 20PX
  - END 20PX
  - PART BOUNDARIES
  - 25/50/75 MARKS
  - EVERY 10PX
- Selected strip ON/OFF buttons.
- All strips ON/OFF buttons.
- Disabled Art-Net strips are now kept in the canonical Art-Net patch as `forceBlack` routes.

## Why

Removing a disabled strip from the patch can leave stale DMX/Art-Net values on the receiver. A disabled strip now still owns its physical route, but the Art-Net packet builder outputs zeros for that route. This makes per-strip OFF behave like a real blackout instead of merely hiding the strip from the route table.

## Technical notes

- `compileArtNetPatchFromMappingV2()` keeps routes for disabled Art-Net segments and marks them `forceBlack: true`.
- `artnet_core.js` includes `forceBlack` routes in the universe plan, zero-fills the universe buffer, and skips copying source pixels for those routes.
- `artnet_master_frame_store_22ej.js` preserves `enabled`, `forceBlack`, and `universeSize` in the server-side patch store.
- RGB wizard now writes to `physical.colorOrder`, not to a non-canonical correction field.

## Validation

- `node --check public/mapping.js`
- `node --check public/runtime/mapping_v2.js`
- `node --check src/output/artnet_core.js`
- `node --check src/output/artnet_master_frame_store_22ej.js`
- `node scripts/test-artnet-continuous-packing.mjs`
- Disabled-strip patch smoke test: disabled strip routes are present with `forceBlack: true`.
