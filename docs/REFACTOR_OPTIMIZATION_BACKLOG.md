# Refactor a optimalizace — pracovní backlog

## Výchozí stav (2026-11-08)

- Audit: 533 textových/kódových souborů, 3,74 MiB.
- `check:full`: 519 JavaScript souborů bez chyb.
- `qa:core`: prošel.
- Step38V test generátoru: prošel.
- Největší aktivní hotspoty: `public/performance.css`, `public/generator.js`, `public/animations.js`, `src/output/artnet_sync_live_sender_22dq.js`, `public/runtime/quick_step_automator.js`, `public/app.js`.
- Existující změna uživatele v `data/artnet-live-config.json` zůstává mimo rozsah commitů.

## Prioritní úkoly

### P0 — bezpečnost a regresní ochrana

- [x] Změřit výchozí stav auditem, full JS checkem a core QA.
- [x] Přidat pracovní backlog s měřitelnými akceptačními podmínkami.
- [ ] U každého hotpath refaktoru doplnit nebo rozšířit kontraktní test.
- [ ] Ověřit, že start/stop runtime neinstaluje duplicitní timer nebo listener.
- [ ] Zkontrolovat hranice live outputu: single-writer, backpressure, shutdown a recovery.

### P1 — render a output hotpath

- [x] Zabránit opakované normalizaci neměnné výchozí konfigurace beat intelligence.
- [ ] Změřit alokace a dobu `renderGeneratorFrame` před/po změnách.
- [ ] Oddělit výpočet neměnných frame závislostí od per-layer práce v `render_pipeline.js`.
- [ ] Prověřit serializaci diagnostiky a snapshotů mimo kritickou render/output cestu.
- [ ] Sjednotit scheduler wake-up a cancellation logiku v output pipeline.

### P1 — runtime architektura

- [ ] Zmapovat veřejné API aktivního runtime a historické/staged moduly.
- [ ] Sloučit duplicitní helpery pro timeout, deep clone, storage a JSON snapshoty.
- [ ] Rozdělit největší orchestration soubory podle odpovědnosti bez změny import kontraktů.
- [ ] Odstranit pouze prokazatelně nedosažitelné větve po potvrzení import auditem.

### P2 — UI a diagnostika

- [ ] Omezit DOM rebuildy diagnostických panelů na změnu signatury stavu.
- [ ] Prověřit `innerHTML` v aktivních smyčkách a přesunout statické části do šablon.
- [ ] Sjednotit telemetry budget a obnovovací periody podle aktivní obrazovky.
- [ ] Přidat jednoduchý benchmark pro preview FPS, output FPS a queue pressure.

## Pravidla postupného provádění

1. Jeden tematicky izolovaný zásah na commit.
2. Před změnou uložit výchozí test; po změně spustit cílený test, `check:full` a core QA podle rizika.
3. Necommitovat uživatelské runtime konfigurace ani `.env` soubory.
4. Commit message ve tvaru `optimize: ...`, `refactor: ...` nebo `test: ...`.
5. Při zhoršení metrik nebo regresi změnu vrátit dříve, než se začne další hotspot.

## Metriky úspěchu

- žádná regrese existujících kontraktů a core QA;
- méně alokací v per-frame cestě;
- stabilní preview/output FPS při stejném nastavení;
- žádné duplicitní timer/listener instance po opakovaném start/stop;
- menší počet odpovědností v největších aktivních modulech bez změny veřejných kontraktů.
