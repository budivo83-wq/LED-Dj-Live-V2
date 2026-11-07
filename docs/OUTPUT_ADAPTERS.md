# Output Adapters (Modular Skeleton)

Bod 7 zavadi modularni output vrstvu s jednotnym adapter kontraktem.

## Adapter contract

Kazdy adapter implementuje:

- `start()`
- `stop()`
- `pushFrame(frame)`
- `processOne()`
- `getStatus()`

## Implementovane adaptery (skeleton)

- `serial`
- `blx`
- `artnet`

## Soubory

- `src/output/adapters/base.js` - sdilena queue/reconnect/fps logika
- `src/output/adapters/serial/index.js`
- `src/output/adapters/blx/index.js`
- `src/output/adapters/artnet/index.js`
- `src/output/adapters/index.js` - registry

## Chovani

1. Kazdy adapter ma vlastni queue a reconnect timer.
2. `output_api.push()` uz nepracuje primo s internim stavem; routuje pres adapter registry.
3. Render pipeline zustava neblokovana (enqueue + bounded process step).

## Poznamka

Transport send funkce jsou zatim stub (`TODO`) a budou napojeny v dalsim migration kroku.
