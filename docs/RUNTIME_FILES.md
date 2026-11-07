# Runtime Files

Tahle appka ma aktivni runtime entrypointy v `public/` a `src/`.

## Canonical runtime paths

- `public/shell.html` - persistent app shell, canonical top-level entrypoint
- `public/shell.js` - shell bootstrap and iframe/view router
- `public/app.js` - hlavni performance runtime
- `public/runtime/render_pipeline.js` - render pipeline, canonical active verze
- `public/runtime/output_pipeline.js` - output scheduler/queue
- `public/runtime/output_bus.js` - bus mezi UI page a persistentnim runnerem
- `public/output-runner.html` - persistent output host mimo UI page lifecycle
- `public/output_runner.js` - runner bootstrap + bus relay
- `public/topbar.js` - shared topbar wiring
- `public/serial_output.js` - serial/BLX packetizer

## Important note

- `public/render_pipeline.js` is not present in the current tree.
- Pokud se v budoucnu objevi jako legacy backup, musi jit do `archive/` nebo byt smazan, aby nevznikla dvojznačnost.
- UI page nesmi znovu hostovat output iframe. Pokud potrebujes output context, pouzij `output-runner.html`.
- `public/index.html`, `public/mapping.html`, `public/settings.html`, `public/shorts.html` jsou UI views, ne top-level shell entrypoints.

## Migration alignment

Vsechny zmeny render pipeline se maji delat v `public/runtime/render_pipeline.js`.
Vsechny zmeny hostingu outputu se maji delat v `public/output-runner.html` + `public/output_runner.js`.
Vsechny zmeny shell routeru se maji delat v `public/shell.html` + `public/shell.js`.
