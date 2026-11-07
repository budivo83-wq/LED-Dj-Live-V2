# STEP38P — Generator Music Modes

Tento krok přidává hudební režimy generátoru. Režim není jen preset: při aplikaci nastaví patch, node graph a curve lanes, a během běhu generátoru jemně moduluje makra podle beatu a frázového průběhu.

## Nové soubory

- `public/runtime/generator_music_modes.js`
- `scripts/test-generator-step38p.mjs`

## Upravené soubory

- `public/generator.html`
- `public/generator.js`
- `public/generator.css`
- `package.json`

## Režimy

- `Manual / Patch` — bez hudebního runtime přepisu.
- `Ambient` — pomalý měkký pohyb bez tvrdého gate.
- `Build` — roste energy, density, warp a pulse přes frázi.
- `Groove` — stabilní beat pulse a perkusivní jiskry.
- `Drop` — silnější gate, pulse a shimmer na downbeaty.
- `Break` — ztlumení a prostor před návratem.
- `Psy Chaos` — kaleido/warp/random shimmer, ale clampnuté hodnoty.
- `Afterhours` — tmavý pomalý režim.

## Ovládání v Generatoru

Nový panel `05 Music Modes` obsahuje:

- výběr režimu,
- `APPLY MODE`,
- `RUNTIME ON/OFF`,
- `BUILD NOW`,
- `DROP NOW`,
- `COPY MUSIC REPORT`.

`APPLY MODE` nastaví patch/graph/curves. `RUNTIME ON` pak při běhu generátoru moduluje hodnoty podle beatu/fráze. Při `Manual / Patch` runtime nic nepřepisuje.

## Bezpečnost výstupu

Tento krok nepřidává žádný nový UDP writer. Music mode ovlivňuje pouze Generator frame před publikací přes existující `LIVE MASTER bridge`. Takeover, Settings FPS, Stability Watchdog a Output Truth zůstávají zachované.

## Ověření

```bash
npm run check:js
npm run check:full
npm run check:layers
npm run qa:core
npm run test:generator-step38p
```

Všechny předchozí generator guardy `STEP38E` až `STEP38O` zůstaly průchozí.
