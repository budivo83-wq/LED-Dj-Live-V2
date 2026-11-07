# STEP38Q — Generator Scene Morph

## Cíl

STEP38Q přidává plynulý morph mezi dvěma generativními stavy bez nového UDP writeru a bez obcházení `LIVE MASTER` takeoveru.

Nový tok zůstává:

```text
Generator render state
→ Scene Morph mixer
→ Generator frame
→ LIVE MASTER bridge
→ server MASTER mirror
→ ArtNet sender
→ LED
```

## Co je nové

### Panel `06 Scene Morph`

V Generatoru je nový panel pro plynulé přechody do:

- hudebních režimů: Ambient, Build, Groove, Drop, Break, Psy Chaos, Afterhours,
- factory presetů,
- custom presetů uložených v preset banku.

Nastavení:

- `Target` — cílový režim/preset,
- `Duration` — délka morphu,
- `Time mode` — beats nebo seconds,
- `Curve` — smooth/ease/linear/ease-in/ease-out,
- `Commit target` — po dokončení uloží cílový stav jako nový aktuální generator patch.

### Runtime modul

Nový soubor:

```text
public/runtime/generator_scene_morph.js
```

Exportuje:

- `listGeneratorSceneMorphTargets`,
- `armGeneratorSceneMorph`,
- `applyGeneratorSceneMorph`,
- `cancelGeneratorSceneMorph`,
- `buildGeneratorSceneMorphStatus`,
- `buildGeneratorSceneMorphReport`.

### Co se morphuje

Morph neinterpoluje pouze jeden slider. Interpoluje celý generator stav:

- patch hodnoty: energy, density, speed, colorShift, feedback, warp, pulse, shimmer,
- node graph: mix, intensity, enabled stav,
- křivky: value, rate, depth, smooth,
- cílový music mode.

Curve mode (`manual/lfo/beat/random`) se přepíná okolo druhé půlky morphu, aby se zachovala stabilita.

## Bezpečnost

STEP38Q nepřidává žádný paralelní ArtNet/UDP writer. Pokud je Generator v `LIVE MASTER`, morph jen mění frame, který už jde přes existující bezpečný `Generator LIVE MASTER bridge`.

Pokud je Generator vypnutý a uživatel spustí morph, stránka se přepne do `PREVIEW`, aby bylo hned vidět, kam morph míří, ale fyzický output se nezapne sám.

## Test

Nový guard:

```bash
npm run test:generator-step38q
```

Kontroluje:

- seznam morph targetů,
- resolve music/preset targetu,
- armování morphu,
- průběžnou interpolaci,
- render 300×8 framu během morphu,
- dokončení a commit cílového stavu,
- report a cancel workflow.
