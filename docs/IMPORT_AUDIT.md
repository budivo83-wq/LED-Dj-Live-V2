# Import Graph Audit

This audit records what is actually reachable from the current runtime entrypoints and what should not be deleted yet.

## Root entrypoints

- `public/shell.html` -> `public/shell.js`
- `public/index.html` -> `public/app.js`
- `public/login.html` -> `public/login.js`
- `public/mapping.html` -> `public/mapping.js`
- `public/settings.html` -> `public/settings.js`
- `public/shorts.html` -> `public/shorts.js`
- `src/index.js` -> staged architecture exports

## Findings

1. No safe runtime delete candidate was confirmed in the current tree.
2. `public/app.js` still imports the bridge/runtime helpers directly, so those files remain active.
3. Animation and palette modules under `public/l1_anims` and `public/l1_palettes` are loaded dynamically through `public/core/module_loader.js`.
4. Because of dynamic loading, a plain static import scan will mislabel those asset modules as unused.
5. `src/` is a staged migration tree. It is not runtime-dead just because the HTML entrypoints do not import it.

## Bridge modules that are still live

These are not dead even though they look legacy:

- `public/output-runner.html` / `public/output_runner.js` are now the persistent output host and relay, not UI-page content.
- `public/runtime/output_bus.js` is the shared transport between UI pages and the runner.
- `public/shell.html` / `public/shell.js` are the persistent top-level shell and view router.
- `public/serial_output.js` and `public/serial_output_worker.js` stay live as the serial/BLX bridge and worker fallback path.
- `public/runtime_boot.js` stays live as the startup/preload bootstrap layer.
- `public/renderer_loop.js` stays live as the minimal render-loop state helper.
- `public/ui_bindings.js`
- `public/ui_layers.js`
- `public/ui_sync.js`
- `public/preview_tabs.js`
- `public/performance_controls.js`
- `public/fx_controls.js`
- `public/sequencer_bridge.js`
- `public/serial_output_worker.js`

## Cleanup rules

1. Do not delete a file until both static and dynamic usage are checked.
2. Treat `public/core/module_loader.js` as the canonical reason why `l1_*` folders stay live.
3. Keep `src/` in the staged bucket until the migration runtime actually replaces the legacy `public/` runtime.
4. Keep `docs/LEGACY_INVENTORY.md` updated when a bridge module is actually retired.
