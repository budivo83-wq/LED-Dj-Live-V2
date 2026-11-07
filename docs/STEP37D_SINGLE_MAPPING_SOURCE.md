# STEP37D - Single Mapping Source

## Goal
Mapping screen is now the authoritative source for the ArtNet master patch.

## Changes
- `compileArtNetPatchFromMappingV2()` now returns a finalized canonical patch with:
  - `patchSource`
  - `routeCount`
  - `universeFirst`
  - `universeLast`
  - `mappingPatchSignature`
- Mapping `SAVE + APPLY` stores the exact master patch into:
  - `led-engine-artnet-master-patch-v1`
- Performance ArtNet output now prefers the saved master patch instead of silently compiling a separate patch path.
- Settings ArtNet start now uses the same saved master patch. If missing, it compiles once from mapping_v2 and stores it.
- Legacy mapping export remains only for compatibility; it is no longer treated as the primary ArtNet patch source.

## Expected behavior
1. Open Mapping.
2. Use Auto Route / Validate.
3. Press SAVE + APPLY.
4. Mapping, Probe, Settings and Performance should use the same `mappingPatchSignature`.

## Why
This reduces the risk that preview/probe/performance use different route calculations and helps isolate real hardware/mapping issues from stale localStorage or legacy compiled mapping data.
