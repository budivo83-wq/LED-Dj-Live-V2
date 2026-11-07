# STEP38E — Generator Curves, Macros and Presets

STEP38E pokračuje nad STEP38D live master bridgem. Cílem je udělat z nové stránky Generator ovladatelný nástroj, ne jen další random preview.

## Přidané části

- 8 maker pro přímé ovládání hlavních parametrů:
  - Energy
  - Density
  - Speed
  - Color
  - Feedback
  - Warp
  - Pulse
  - Shimmer
- Curve lanes pro stejné parametry.
- Režimy křivek:
  - `manual` — hodnota stojí podle slideru
  - `lfo` — plynulé dýchání
  - `beat` — pulz podle beat/division
  - `random` — vyhlazený random walk, ne tvrdé skoky
- Smoothing každé lane zvlášť, aby změny neskákaly moc natvrdo.
- Preset bank uložený v localStorage:
  - factory presety
  - custom presety
  - uložení patch + graph + curves
- STEP38E guard test:
  - `npm run test:generator-step38e`

## Bezpečnost výstupu

Generator Live pořád používá STEP38D master bridge. Generátor neposílá ArtNet UDP přímo. V režimu LIVE MASTER publikuje 300×8 RGB frame do lokálního FrameBusu a server MASTER mirror endpointu:

```text
/api/artnet/master-mirror/frame-bin
```

Síťový ArtNet sender zůstává pod Settings / SAFE MASTER LIVE cestou.

## Soubory

- `public/generator.html`
- `public/generator.css`
- `public/generator.js`
- `public/runtime/generator_engine.js`
- `public/runtime/generator_curves.js`
- `public/runtime/generator_presets.js`
- `scripts/test-generator-step38e.mjs`

## Ověření

Doporučená kontrola po změnách:

```bash
npm run check:js
npm run check:full
npm run check:layers
npm run test:generator-step38e
```

Core QA skripty je možné spouštět jednotlivě, pokud souhrnný `qa:core` v sandboxu čeká na child process déle než samostatné skripty.
