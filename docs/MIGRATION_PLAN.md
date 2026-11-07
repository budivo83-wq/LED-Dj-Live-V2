# Migration Plan (Stabilization First)

## Faze 0: Freeze + baseline

Status: `IN PROGRESS`

Deliverables:

1. `ARCHITECTURE.md` guardrails.
2. `HEALTH_CHECKLIST.md` povinny gate pred mergem.
3. Baseline metriky zapsane v tomto souboru.

## Faze 0.5: Repo skeleton pro cilovou architekturu

Status: `DONE`

Deliverables:

1. Vytvoren `src/` strom pro subsystémy:
   - `core`, `render`, `mapping`, `output`, `preview`, `ui`, `debug`, `events`, `fx`, `sequencer`, `transport`, `utils`
2. Pridane zakladni `index.js` vstupy pro kazdou domenu.
3. Pridany root barrel `src/index.js`.

## Baseline metriky

Vypln po 3 behach (cold start + normal live prace):

| Metric | Run 1 | Run 2 | Run 3 | Target |
|---|---:|---:|---:|---:|
| Render FPS (avg) |  |  |  | >= 55 |
| Render frame avg (ms) |  |  |  | <= 18 |
| Render frame max (ms) |  |  |  | <= 33 |
| Render dropped |  |  |  | 0 trend |
| Output queue depth |  |  |  | <= 2 |
| Output latency (ms) |  |  |  | <= 25 |
| Shader switch freeze (ms) |  |  |  | <= 150 |
| UI sync avg (ms) |  |  |  | <= 2 |
| Debug sync avg (ms) |  |  |  | <= 2 |

Zdroj metrik:

- Debug panel: `RENDER BUDGET`, `OUTPUT BUDGET`
- `window.__ledPerfBaseline` event stream

## Faze 1: Core/Render/Output boundary cleanup

1. Explicitni API kontrakty mezi castmi.
2. Presun side effectu z UI handleru do action vrstvy.
3. Render loop strict: `UPDATE -> RENDER -> MAP -> OUTPUT -> PREVIEW`.
4. `public/` <-> `src/` boundary: pouzivej jen jednotny bridge `public/runtime/src_bridge.js` (bez ad-hoc direct importu).

## Faze 2: Mapping subsystem extraction

1. Mapping model schema.
2. Mapping transform pipeline mimo UI.
3. Per-output packet preparation mimo render.

## Faze 3: UI modularizace

1. Screen-level moduly (`performance`, `mapping`, `settings`, `debug`).
2. Lazy subscriptions.
3. Kazdy screen vlastni cleanup lifecycle.

## Faze 4: Migration flags

Status: `DONE`

Deliverables:

1. `src/migration/feature_flags.js` - storage-backed feature flags.
2. `src/migration/runtime_switch.js` - compat switch legacy/next.
3. `public/settings.js` - UI pro flagy.
4. `docs/MIGRATION_FLAGS.md` - contract a pravidla.

Canonical runtime note:

- Aktivni render pipeline je `public/runtime/render_pipeline.js`.
- `public/render_pipeline.js` v aktualnim tree neni a nesmi se znovu zavest jako paralelni zdroj pravdy.
