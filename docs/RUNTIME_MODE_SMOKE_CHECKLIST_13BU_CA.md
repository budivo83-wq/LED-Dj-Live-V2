# Runtime Mode Smoke Checklist (13BU-CA)

## Scope
- Goal: quick manual sanity run before release.
- Order: `NORMAL -> RASPI STABLE -> RASPI SAFE -> BURN-IN`.

## Preconditions
- App starts without console/runtime fatal errors.
- `test:runtime-mode-authority-suite-13bu-bj` is passing.

## Step 1: NORMAL
- Set mode to `NORMAL`.
- Verify topbar: `MODE NORMAL FULL`, `RENDER FPS`, `OUT FPS`, `OUTPUT state` updates live.
- Verify UI is full:
  - gallery thumbnails active,
  - layer/editor preview active,
  - debug graphs active.
- Verify no RasPi-only hard throttling symptoms.

## Step 2: RASPI STABLE
- Set mode to `RASPI STABLE`.
- Verify topbar mode badge changes to `RASPI STABLE`.
- Verify UI is lightly constrained, but thumbnails and debug graphs still available.
- Verify output remains stable and responsive.

## Step 3: RASPI SAFE
- Set mode to `RASPI SAFE`.
- Verify topbar mode badge changes to `RASPI SAFE`.
- Verify thumbnails are disabled (cache/fallback only).
- Verify preview/debug cadence is reduced and output remains prioritized.

## Step 4: BURN-IN
- Set mode to `BURN-IN`.
- Verify topbar mode badge changes to `BURN-IN`.
- Verify minimum UI behavior:
  - thumbnails disabled,
  - debug graphs disabled,
  - output priority active.
- Run for at least 5 minutes and verify no escalating output instability.

## Exit Criteria
- All 4 mode steps pass without functional regression.
- Any failure is recorded with mode, timestamp, and visible symptom.
