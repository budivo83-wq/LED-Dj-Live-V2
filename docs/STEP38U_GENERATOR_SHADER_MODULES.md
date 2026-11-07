# STEP38U — Generator Shader / Field Modules

## Cíl

STEP38U přidává nové reálné generativní moduly do stávajícího Generator node graphu. Nejde o nový výstupní writer ani o paralelní ArtNet cestu. Všechny moduly běží uvnitř stejné pipeline:

```text
Generator Node Graph
→ Generator render
→ LIVE MASTER bridge
→ server MASTER mirror
→ ArtNet sender
→ LED
```

## Nové moduly

### SOURCE

- Liquid Glass
- Fractal Snake
- Neon Organism

### MODIFIER

- Solar Wind
- Magnetic Particles

### FX

- Electric Veins
- Digital Rain
- Audio Pulse Field

## Bezpečnost

Nové moduly jsou v defaultním graphu přítomné, ale vypnuté. Starší patche tedy po načtení nezačnou svítit jinak. Modul se aktivuje až přes Node Graph UI, factory preset nebo custom preset.

## Factory presety

Přidané factory presety:

- Liquid Glass Organism
- Electric Veins Drop
- Solar Magnetic Snake

## Test

```bash
npm run test:generator-step38u
```

Test ověřuje:

- katalog nových modulů,
- defaultně vypnutý stav nových nodů,
- render 300×8 RGB frame pro každý nový modul,
- duplikaci nových modulů jako custom node,
- nové factory presety.
