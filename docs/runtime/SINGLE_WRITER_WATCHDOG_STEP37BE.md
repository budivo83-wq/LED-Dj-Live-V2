# STEP37BE – Single Writer Watchdog

Navazuje na STEP37BB/BC/BD.

## Cíl

Nejen zobrazit konflikt fyzických writerů, ale při opakovaném konfliktu bezpečně zablokovat browser writer, který neodpovídá aktuálnímu server-side vlastníkovi.

## Přidané soubory

- `public/runtime/output_single_writer_watchdog_37be.js`

## Zapojení

- `public/index.html` načítá watchdog po `output_route_health_37bd.js`.
- `public/runtime/artnet_master_framebus_mirror_22ej.js` kontroluje watchdog před odesláním ArtNet frame.
- `public/runtime/live_serial_app_mirror_22cr.js` kontroluje watchdog před odesláním Serial frame.
- `public/debug_panel.js` ukazuje `writerDog ...` v Output Stability.

## Chování

- `MATCH`, `IDLE`, `BROWSER_ONLY`: pouze sleduje, neblokuje.
- `SERVER_ONLY` nebo tvrdý `MISMATCH` s jinou output rodinou: po krátké grace době vynutí server owner family.
- Pokud server drží například ArtNet, serial browser mirror se zablokuje.
- Pokud server drží Serial, ArtNet browser mirror se zablokuje.

## Debug

V konzoli:

```js
window.__budilightSingleWriterWatchdog37BE.snapshot()
```

V Debug panelu:

```text
writerDog ok_match b0
writerDog block:artnet b12
```

`b` je počet zablokovaných write pokusů.
