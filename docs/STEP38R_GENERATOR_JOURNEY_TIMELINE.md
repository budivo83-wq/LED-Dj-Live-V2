# STEP38R — Generator Journey Timeline

## Cíl

STEP38R přidává do Generatoru vrstvu **Journey Timeline**. Nejde o nový výstupní writer ani o nový ArtNet sender. Journey je režie nad existujícími částmi:

```text
Journey Timeline → Scene Morph → Generator frame → LIVE MASTER bridge → server MASTER mirror → ArtNet sender
```

Tím zůstává zachovaná single-writer bezpečnost z předchozích kroků.

## Co přibylo

### Nový panel v Generatoru

Panel `07 Journey Timeline` umí:

- vybrat factory journey,
- zapnout/vypnout loop,
- automaticky přepnout Generator z OFF do PREVIEW při startu,
- commitovat cílový stav po dokončení každého kroku,
- spustit / zastavit journey,
- zobrazit kroky, aktivní krok a progress,
- zkopírovat journey report.

### Factory journeys

Přidané základní cesty:

- `Psy Trip · Calm → Build → Drop → Chaos`
- `Techno Groove · Pulse Journey`
- `Safe Demo · Preview Friendly`

Každý krok definuje:

```js
{
  label,
  targetId,       // např. music:build nebo preset:factory-...
  durationBeats, // délka morphu
  holdBeats,     // jak dlouho po morphu držet scénu
  curve           // smooth/ease/ease-in/ease-out/linear
}
```

### Bezpečnost

- Journey sama nezapíná fyzický LED výstup.
- Když je Generator OFF a startuje Journey, přepne se jen do PREVIEW, pokud je `Auto PREVIEW z OFF` zapnuté.
- Pokud je Generator už v LIVE MASTER, Journey se projeví na fyzickém výstupu přes existující Generator LIVE cestu.
- Journey nepřidává žádný nový UDP writer.
- STOP JOURNEY zastaví budoucí kroky, ale schválně automaticky neruší právě běžící Scene Morph. K tomu slouží existující `CANCEL MORPH`.

## Nové soubory

```text
public/runtime/generator_journey_timeline.js
scripts/test-generator-step38r.mjs
docs/STEP38R_GENERATOR_JOURNEY_TIMELINE.md
START_HERE_STEP38R_GENERATOR_JOURNEY_TIMELINE.txt
```

## Test

```bash
npm run test:generator-step38r
```

Součást ověření:

- factory journeys existují,
- kroky mají validní Scene Morph targety,
- journey umí start,
- první krok spouští morph,
- po dokončení morphu přejde do hold fáze,
- po hold fázi přejde na další krok,
- report a snapshot fungují.

## Doporučený ruční test

1. Otevřít Generator.
2. Nechat režim PREVIEW.
3. Vybrat `Safe Demo · Preview Friendly`.
4. Kliknout `START JOURNEY`.
5. Sledovat, že Scene Morph postupně přechází mezi kroky.
6. Až po ověření zapnout `LIVE MASTER`.
