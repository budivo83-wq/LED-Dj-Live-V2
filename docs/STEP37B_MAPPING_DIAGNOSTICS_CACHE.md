# STEP37B Mapping Diagnostics + Patch Cache

## Scope
- Mapping screen only.
- No rewrite of the performance renderer or Art-Net sender.
- The goal is better observability and safer patch application before deeper routing cleanup.

## Added
- Mapping Diagnostics card with active strip count, total pixels, Art-Net universe count, route part count, and patch health summary.
- Universe Heatmap showing Art-Net universe occupancy and basic gap/overlap/overfull detection.
- Lightweight mapping cache in `public/mapping.js` for:
  - `compileMappingV2(state.mapping)`
  - `validateMappingV2(state.mapping)`
  - `compileArtNetPatchFromMappingV2(state.mapping)`

## Fixed
- `duplicateSelectedSegment()` inserted the duplicate strip twice. It now inserts it once.

## Verified
- `node --check public/mapping.js`
- `node --check public/runtime/mapping_v2.js`
- `node scripts/test-artnet-continuous-packing.mjs`
