# Debug Telemetry Engine (Baseline)

Bod 12 zavadi samostatny debug/telemetrie subsystĂ©m.

## Soubory

- `src/debug/telemetry/collector.js`
- `src/debug/debug_engine.js`
- `src/debug/index.js`

## Co se sbira

- Performance:
  - FPS
  - frame count
  - dropped count
  - render/map/preview avg+max ms
- Output:
  - queue depth
  - send latency avg+max
  - output latency avg+max
- Shader:
  - cache hits/misses
  - compile count/failures
  - avg/last compile ms

## Integrace

`src/pipeline/orchestrator.js` markeruje telemetry v kazde fazi pipeline.


## STEP 8M — Frame Authority Telemetry Snapshot

Frame Authority diagnostics are now included in runtime performance/telemetry snapshots without changing startup, animation loading, render timing, or output fallback behavior. See `docs/STEP_8M_FRAME_AUTHORITY_TELEMETRY_SNAPSHOT.md`.
