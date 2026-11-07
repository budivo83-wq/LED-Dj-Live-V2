# STEP22GK Runtime Cleanup

Cíl této vlny: zrychlit a zjednodušit běžný Performance runtime bez zásahu do funkční cesty shader → pixel preview → master frame → output router.

## Změny

- Z `public/index.html` odstraněny staré debug/test/probe skripty, které se načítaly při každém otevření Performance.
- Přesunuto do archivu:
  - `raspi_debug_focus.js`
  - `debug_ui_write_lock.js`
  - `debug_rescue_13bn.js`
  - `framebus_recorder_controls_13bt_h.js`
  - `raspi_live_health_guard_13bu.js`
  - `one_click_test_runner_13bu_ab.js`
- Zachováno:
  - `app.js`
  - shader/pixel preview runtime
  - master framebus mirror pro Serial
  - master framebus mirror pro ArtNet
  - telemetry store
  - runtime badge
  - adaptive FPS governor

## Důvod

Tyto skripty byly užitečné během STEP/testovací fáze, ale v provozním UI zvyšovaly riziko vedlejších zásahů do DOMu, FPS, health stavu a output diagnostiky. Pro běžný live režim mají být mimo hlavní boot cestu.

## Návrat

Záloha je v:

`archive/runtime_debug_removed_step22gk/`
