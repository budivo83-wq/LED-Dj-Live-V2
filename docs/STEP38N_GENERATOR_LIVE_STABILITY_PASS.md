# STEP38N — Generator Live Stability Pass

Tento krok navazuje na STEP38L/M: Generator už umí převzít MASTER output a FPS bere ze Settings. STEP38N přidává diagnostiku, která operátorovi přímo v Generatoru ukáže, jestli je takeover opravdu stabilní.

## Přidáno

- Nový runtime modul:
  - `public/runtime/generator_live_stability.js`
- Nový panel v `generator.html`:
  - `05 Live Stability Watchdog`
- Nový guard test:
  - `npm run test:generator-step38n`

## Co panel sleduje

- Generator output lock
- Performance mute / suppression
- Generator publish FPS
- server MASTER mirror source
- server upload chyby
- ArtNet sender FPS
- UDP socket / poslední send
- route count
- stale frame / frame continuity

## Cílový zelený stav

```text
LIVE OWNER: GENERATOR
PERFORMANCE: MUTED
MASTER MIRROR: GENERATOR FRESH
GENERATOR PUBLISH: Settings FPS
ARTNET SENDER: sending
```

## Praktický přínos

Když LED blikají, stojí nebo mají nízké FPS, už není potřeba hádat, jestli je problém v Generatoru, Performance, server MASTER mirroru nebo ArtNet senderu. Panel vypíše konkrétní stav a další doporučený krok.

## Bezpečnost

STEP38N nepřidává žádný další UDP writer. Vše je pouze diagnostika nad už existujícím řetězcem:

```text
Generator frame → LIVE MASTER bridge → server MASTER mirror → ArtNet sender
```
