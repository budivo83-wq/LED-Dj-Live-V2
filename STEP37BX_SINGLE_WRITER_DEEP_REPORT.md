# STEP37BX – Single-writer deep report

Cíl: doplnit přesnou diagnostiku fyzických writerů bez změny output cesty.

## Přidáno

- `public/runtime/output_writer_deep_report_37bx.js`
- načteno v `public/index.html` za route registry/watchdog a před ArtNet/Serial mirrory
- globální diagnostika:
  - `window.__budilightSingleWriterDeepReport37BX.snapshot()`
  - `window.__budilightSingleWriterDeepReportSnapshot37BX`

## Co report sleduje

- claim/canWrite/markWrite/release volání v `output_route_registry_37bb.js`
- aktivního browser writera
- ArtNet master mirror stav
- Serial app mirror stav
- route registry snapshot
- single-writer watchdog snapshot
- FrameBus snapshot
- serverový `/api/artnet/sync-live/status`
- serverový `/api/artnet/master-mirror/status`

## Verdikty

- `IDLE` – žádný fyzický writer není aktivní
- `OK_SINGLE_WRITER` – aktivní je jeden vlastník
- `SERVER_BROWSER_PAIR` – běžný pár browser uploader + server UDP sender
- `CONFLICT_RISK` – riziko více writerů proti fyzickému výstupu

## Poznámka

Tento krok neposílá žádné framy a nemění ownership rozhodnutí. Je to čistě auditní vrstva nad existujícím registry/watchdogem.
