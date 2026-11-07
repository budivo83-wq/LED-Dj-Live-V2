# STEP22LH · Sequencer Page Purge

Tento krok kompletně odstraňuje samostatnou stránku Sequenceru a její aktivní runtime pozůstatky.

## Odstraněno

- `public/sequencer.html`
- `public/sequencer.css`
- `public/sequencer.js`
- staré záložní/bridge/programmer/overlay soubory sequenceru v `public/`
- `public/runtime/sequencer_runtime.js`
- `src/sequencer/`
- `src/ui/screens/sequencer/`
- odkazy na Sequencer z horní navigace a center menu
- napojení sequencer modulace z `render_pipeline.js`
- import a bootstrap `createSequencerBridge`
- top sequencer DOM references / UI sync remnants
- aktivní dokumentace k LA/LB/LG sequencer krokům

## Výsledek

Performance opět běží jako čistý zdroj master frame bez zásahu sequencer vrstvy.

Aktivní JS kontrola proběhla přes:

```bash
npm run check:js
find public src scripts -name "*.js" -o -name "*.mjs" | xargs -n1 node --check
```
