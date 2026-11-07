# STEP38T — Generator Node Graph UI v2

Tento krok rozšiřuje Generator Node Graph z jednoduchého `enable/mix/intensity/order` editoru na praktičtější patchovací UI.

## Přidáno

- `ADD NODE` z katalogu SOURCE / MODIFIER / COLOR / FX.
- `DUP` pro duplikování existujícího node.
- `BYPASS / ON` pro rychlé vypnutí/zapnutí konkrétního node.
- `SOLO` pro ponechání jednoho node aktivního.
- `CLEAR SOLO / ENABLE ALL` pro návrat k aktivnímu graphu.
- `DEL` pro odstranění custom node nebo skrytí core node.
- `COPY GRAPH REPORT` pro rychlý textový report node graphu.
- Stage strip ukazující počty aktivních SOURCE / MODIFIER / COLOR / FX / OUTPUT bloků.

## Důležité bezpečnostní pravidlo

STEP38T nepřidává žádný nový UDP/ArtNet writer. Node Graph UI pouze mění Generator graph, který se dál renderuje přes existující řetězec:

```text
Generator Node Graph
→ Generator render
→ LIVE MASTER bridge
→ server MASTER mirror
→ ArtNet sender
→ LED
```

## Render kontrakt

Custom/duplikované nody mají `moduleId`, takže se jejich váha agreguje do existujícího renderer modulu. Například duplikovaný `plasma` node nepřidává nový engine mimo kontrolu, ale zesílí/rozšíří váhu `plasma` modulu v render planu.

## Test

```text
npm run test:generator-step38t
```

Ověřuje katalog, add/duplicate/delete/solo/clear solo, agregované module weights, render viditelného framu a textový graph report.
