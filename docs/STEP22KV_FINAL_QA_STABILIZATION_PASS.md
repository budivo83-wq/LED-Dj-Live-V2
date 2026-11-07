# STEP22KV — Final QA & Stabilization Pass

Stabilizační balík před společným průchodem celé aplikace. Nepřidává další kreativní vrstvu, ale přidává kontrolní panel, jasné verdikty a fallback drill.

## Přidáno

- sekce **Final QA** v Show OS
- QA depth: FAST / FULL / FIELD
- Verdict Board
- Blockers / Watch list
- Module QA Matrix
- Fallback Drill
- export `budilight-step22kv-final-qa-report.json`

## Proč

Po STEP22KU už má systém dost funkcí. Další správný krok je ověřit stabilitu, přehlednost a bezpečné operátorské řízení.

## Doporučený test

1. `npm install`
2. `npm run check:js`
3. `npm start`
4. Otevřít `show-os.html`
5. Navigation profile: TEST
6. Field Test RC → RUN FIELD TEST RC
7. Final QA → RUN FINAL QA
8. Pokud score < 70 %, nejdřív řešit BLOCKER/WATCH, až potom pokračovat ve vývoji.

## Zásada

Žádná destruktivní akce. Žádné mazání modulů. Pouze měření, verdikty a bezpečný provozní postup.
