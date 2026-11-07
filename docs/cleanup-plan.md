# Cleanup Plan

## Completed in this pass

1. Sjednocene L2 assety:
- odstraneny fyzicke duplicity `public/l2_anims` a `public/l2_palettes`.
- `server.js` mapuje L2 list endpointy na L1 asset folders.
- `public/core/module_loader.js` kanonikalizuje L2 importy na L1 moduly.

2. Odstraneny mrtve/stale soubory:
- `.launch_leddj.ps1`
- `server.out.log`
- `public/password.html`
- `public/serial.html`
- `public/l1_palettes/toxic` bez `.js` pripony

3. Odstranen mrtvy kod:
- nepouzita `openChrome()` funkce v `server.js`.

4. Pridana opakovatelna kontrola:
- `npm run check` kontroluje syntaxi `server.js` a `public/**/*.js`.

## Current hotspots

1. `public/app.js` ma pres 2300 radku a zustava hlavni refactor target.
2. `public/performance.css` ma pres 80 KB a obsahuje opakovane override vrstvy.
3. `auth.json` a `engine-state.json` jsou runtime data; pro cisty repo workflow by mely byt vyresene pres template nebo ignored local soubory.
4. `docs/LEGACY_INVENTORY.md` je aktualni inventar canonical/bridge/skeleton vrstev; driv nez smazes jakykoli runtime bridge, nejdriv ho preveď na `src/` nebo zapis do inventare.

## Recommended next cleanup iteration

1. Rozdelit `public/app.js` podle runtime domen:
- output pipeline
- keyboard/input bindings
- module preload/warmup
- websocket/state sync

2. Rozdelit `public/performance.css` podle domen:
- layout
- panels
- controls
- responsive overrides

3. Pridat smoke test pres browser:
- login page loads
- performance page loads po auth
- `/api/list/l1_anims` a `/api/list/l2_anims` vraci stejnou sadu
- zakladni WebSocket connect
