# STEP38V — Generator Beat Intelligence

STEP38V přidává do Generatoru hudební časovací vrstvu. Nejde o nový render engine ani nový ArtNet/UDP writer. Beat Intelligence pouze počítá beat/bar/phrase/drop akcenty a předává je do stávající Generator pipeline.

```text
Beat Intelligence
→ Curves / Music Modes / Generator Engine beatContext
→ Generator frame
→ LIVE MASTER bridge
→ server MASTER mirror
→ ArtNet sender
→ LED
```

## Přidané soubory

- `public/runtime/generator_beat_intelligence.js`
- `scripts/test-generator-step38v.mjs`
- `docs/STEP38V_GENERATOR_BEAT_INTELLIGENCE.md`
- `START_HERE_STEP38V_GENERATOR_BEAT_INTELLIGENCE.txt`

## UI

V `generator.html` je nový panel:

```text
05B Beat Intelligence
```

Obsahuje:

- `BEAT INTEL ON/OFF`
- `TAP BEAT`
- `PHRASE RESET`
- `DROP MARK`
- `Phrase beats`
- `Accent amount`
- `Drop hold`
- `COPY BEAT REPORT`

## Co to dělá

Beat Intelligence počítá:

- beat phase,
- bar phase,
- phrase progress,
- downbeat accent,
- bar accent,
- phrase accent,
- drop accent,
- tap-tempo BPM suggestion.

Tyto hodnoty pak jemně ovlivňují:

- `energy`,
- `pulse`,
- `shimmer`,
- `warp`,
- `colorShift`,
- `audioPulseField`,
- gate/drop boost v render enginu.

## MIDI

Do MIDI/APC mapování přibyly bezpečné akce:

```text
Note 60 → Beat tap
Note 61 → Phrase reset
Note 62 → Drop mark
```

Akce nepřidávají žádný output writer. Jen ovládají Beat Intelligence vrstvu.

## Bezpečnost výstupu

STEP38V nemění output ownership model:

- Performance se stále při Generator LIVE potlačí.
- Generator stále publikuje přes LIVE MASTER bridge.
- ArtNet UDP posílá stále existující ArtNet sender.
- Beat Intelligence nemůže sama zapnout fyzický output.

## Test

```bash
npm run test:generator-step38v
```

Test ověřuje:

- config storage,
- tap tempo,
- phrase reset,
- drop marker,
- makro akcenty,
- beatContext v render enginu,
- MIDI mapování pro Beat tap / Drop mark.
