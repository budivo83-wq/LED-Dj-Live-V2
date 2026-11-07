# STEP37C - Mapping Wizards + Single Patch Flow

## Added
- Direction wizard buttons in Mapping > Probe selected strip:
  - `DIR OK / FORWARD`
  - `FLIP DIRECTION`
- RGB order wizard helper:
  - `RGB TEST`
  - `Observed RGB order` selector
  - `SAVE OBSERVED RGB ORDER`
- Probe sender now reuses the cached Art-Net patch via `getArtNetPatch()` instead of compiling its own detached patch.
- Save/apply source tag updated to `mapping-save-apply-step37c-wizards-single-patch`.

## Intended operator flow
1. Select a strip.
2. Press `DIR TEST`.
3. If the head/end is wrong, press `FLIP DIRECTION`; otherwise press `DIR OK / FORWARD`.
4. Press `RGB TEST`.
5. Select what is physically visible in `Observed RGB order` and press `SAVE OBSERVED RGB ORDER`.
6. Press `SAVE + APPLY PATCH`.

## Safety
- No performance renderer rewrite.
- No Art-Net backend rewrite.
- Changes are limited to Mapping UI and probe/mapping state helpers.
