# QA Guardrails (Step 13)

Bod 13 zavadi test/guardrail vrstvu pro migration architekturu.

## Skripty

- `npm run check`
  - syntax check pro `server.js`, `public`, `src`, `scripts`
- `npm run check:layers`
  - kontrola zakazanych cross-layer importu
- `npm run audit:imports`
  - import graph audit s oddelenim `live` / `staged` / `dead`
- `npm run test:contracts`
  - contract testy API + smoke pipeline run
- `npm run qa`
  - spusti vsechny kroky

## Commit gate evidence

- Pro kazdy refactor commit vypln `docs/HEALTH_CHECKLIST.md` (PASS/FAIL).
- Minimalni povinne brany: `npm run check` + login smoke + performance smoke + WS smoke + list API smoke.

## Co hlida `check:layers`

- UI nesmi importovat `render/output/mapping` internals.
- Render nesmi importovat `output` internals.
- Core nesmi importovat `ui/output` internals.
- `public/` nesmi importovat `src/` mimo `public/runtime/src_bridge.js`.
- `src/` nesmi importovat `public/` primo.

## Co hlida `test:contracts`

- dostupnost API metod (`core/render/mapping/output/preview/events/debug/state/pipeline`)
- smoke run orchestratoru s rAF stubem
- shader registry basic flow (`register/preload/activate/stats`)

## Co hlida `audit:imports`

- `public/` soubory jsou posuzovane podle reachability z HTML entrypointu a dynamic loaderu.
- `src/` je reportovany jako `staged`, ne jako dead, protoze jde o migracni kostru.
- `public/l1_anims` a `public/l1_palettes` se berou jako live pri aktivnim `module_loader`.

## STEP 8C guardrail

`npm run test:frame-authority-policy-gate` verifies that all accepted/rejected frame publishes go through the explicit policy gate and expose policy diagnostics in frame authority stats.


## STEP 8I Guard — Composed Frame Authority API

`npm run test:frame-authority-composed-api` verifies that `render_pipeline.js` uses `frameAuthority.publishComposedFrame()` and no longer has an audit exception for direct raw `publishFrame()` calls.
