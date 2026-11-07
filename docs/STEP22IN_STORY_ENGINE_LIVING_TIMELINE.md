# STEP22IN — Story Engine + Living Timeline

Tento krok přidává skutečnou dramaturgickou vrstvu nad Universe Mode.

## Princip

Místo pevného pořadí scén vzniká živá timeline:

Discovery → Exploration → Conflict → Peak → Resolution

Každý krok má:

- universe
- world
- target weather
- délku v minutách
- energy
- chaos
- density
- story phase

## Director Rewrite

Director sleduje:

- pressure
- fatigue
- novelty

A podle toho umí:

- podržet aktuální timeline
- vložit recovery corridor
- vložit discovery signal
- prodloužit peak

## Performance Bridge

Story Engine neřídí pixely přímo. Do Performance vrstvy ukládá intent payload do localStorage:

`budilight.performance.bridge.pro`

Renderer si dál může zachovat vlastní animace, palety, blendy a event engine.
