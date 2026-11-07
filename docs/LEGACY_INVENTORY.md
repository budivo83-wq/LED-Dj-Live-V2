# Legacy and Skeleton Inventory

This document separates what is canonical today from what is still a bridge, compatibility layer, or migration skeleton.

## Canonical runtime

These files are the active runtime entrypoints and should be treated as the source of truth:

- `public/shell.html`
- `public/shell.js`
- `public/app.js`
- `public/runtime/render_pipeline.js`
- `public/runtime/output_pipeline.js`
- `public/runtime/output_bus.js`
- `public/output-runner.html`
- `public/output_runner.js`
- `public/topbar.js`
- `public/serial_output.js`

## Active bridge and compatibility modules

These files are still imported by the live app and are not safe to delete yet:

- `public/runtime/src_bridge.js` - single boundary bridge for `public/` to future `src/` runtime APIs; keep as only allowed crossing point
- `public/serial_output.js` - live serial/BLX bridge, currently exposes only `sendSerialFrame()` and `getDebugInfo()`
- `public/runtime_boot.js` - startup bootstrap helpers for preload/profiling
- `public/renderer_loop.js` - tiny render-loop state holder used by `public/app.js`
- `public/ui_bindings.js`
- `public/ui_layers.js`
- `public/ui_sync.js`
- `public/preview_tabs.js`
- `public/performance_controls.js`
- `public/fx_controls.js`
- `public/sequencer_bridge.js`
- `public/serial_output_worker.js`

## Migration skeletons in `src/`

These modules are intentionally staged and still partial:

- `src/core`
- `src/render`
- `src/mapping`
- `src/output`
- `src/preview`
- `src/debug`
- `src/events`
- `src/fx`
- `src/sequencer`
- `src/transport`
- `src/ui`
- `src/migration`

## Runtime data and state

Do not confuse runtime state with source files:

- `engine-state.json`
- `auth.json`
- browser `localStorage` keys used by `public/app.js` and `public/settings.js`

## Cleanup rules

1. Do not add a second `public/render_pipeline.js`.
2. Do not reintroduce output hosting into the UI pages.
3. Do not delete bridge modules until their callers are moved to `src/` or a new runtime path.
4. If a file is only a placeholder, document it here before removing it.
5. Do not add direct `public/` <-> `src/` imports; crossing is allowed only via `public/runtime/src_bridge.js`.
