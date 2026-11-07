# UI Modular Screens (Skeleton)

Bod 10 zavadi modularni UI screen vrstvu v `src/ui`.

## Screen moduly

- `performance`
- `mapping`
- `settings`
- `debug`
- `sequencer`

Kazdy screen ma lifecycle:

- `mount(ctx)`
- `unmount(ctx)`
- `subscribe(ctx)`

## Screen manager

- `src/ui/screen_manager.js`
- API:
  - `activate(name)`
  - `deactivate()`
  - `getActive()`
  - `listAvailable()`

## Cile

1. Oddelit screen-level subscriptions.
2. Umožnit lazy inicializaci po aktivaci screenu.
3. Zabránit globalnimu monolitu v jedne strance.

## Poznamka

Jde o migration skeleton, produkcni `public/*.js` screeny zatim bezi separatne.
