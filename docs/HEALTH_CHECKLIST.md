# Health Checklist (Commit Gate)

Pouzij pred kazdym refactor commitem. Vysledek se zapisuje jako PASS/FAIL.

## Baseline Control Gates

1. `npm run check`
- [ ] PASS
- [ ] FAIL

2. Login smoke
- [ ] `public/login.html` se nacetl
- [ ] validni login presmeruje do shell/performance
- [ ] PASS
- [ ] FAIL

3. Performance screen smoke
- [ ] performance screen se nacetl po loginu
- [ ] bez blokujici JS chyby
- [ ] PASS
- [ ] FAIL

4. WebSocket smoke
- [ ] WS se pripoji
- [ ] alespon 1 zmena stavu se propaguje klientum
- [ ] PASS
- [ ] FAIL

5. List API smoke
- [ ] `GET /api/list/l1_anims` vraci 200 + non-empty array
- [ ] `GET /api/list/l1_palettes` vraci 200 + non-empty array
- [ ] PASS
- [ ] FAIL

## Commit Record Template

Vypln pro kazdy commit v refactor vetvi:

- Commit: `<hash nebo WIP>`
- Date: `YYYY-MM-DD`
- Scope: `<co se menilo>`
- `npm run check`: `PASS/FAIL`
- Login smoke: `PASS/FAIL`
- Performance smoke: `PASS/FAIL`
- WebSocket smoke: `PASS/FAIL`
- List API smoke: `PASS/FAIL`
- Notes/Risks: `<kratce>`

## Stop Rule

Pokud je cokoliv FAIL, commit se nepovazuje za gate-passing a musi nasledovat fix alebo rollback pred dalsi refactor etapou.

## Commit Record

- Commit: `WIP (bod 3 + bod 4 refactor bridge/runtime)`
- Date: `2026-05-18`
- Scope: `Rozdeleni app.js do runtime modulu + jednotna src/public bridge boundary + import guardrails`
- `npm run check`: `PASS`
- Login smoke: `PASS` (`POST /api/auth/login` = 200 s credentials `admin` / poskytnute heslo)
- Performance smoke: `PASS` (`GET /` a `GET /shell.html` po loginu = 200)
- WebSocket smoke: `PASS` (2 autorizovani WS klienti; `type:update` se propaguje na druhy klient)
- List API smoke: `PASS` (`GET /api/list/l1_anims` = 200, count 48; `GET /api/list/l1_palettes` = 200, count 37)
- Notes/Risks: `QA pipeline PASS: check, check:layers, audit:imports, test:contracts, test:migration-flags. WS ingest/broadcast fix v server.js (spravne rozliseni binary/text a UTF-8 parse).`
