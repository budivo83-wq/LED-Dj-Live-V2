# STEP22KO — Stability & Performance Lab

Navazuje na STEP22KH–KN Visual Physics Core Pack.

## Přidáno

- nová sekce **Stability Lab** v Show OS
- výkonové profily: ECO, BALANCED, LIVE, SAFE
- runtime pressure metrika
- bridge heartbeat age
- ruční i automatický trim flow/memory zátěže
- guardy: watchdog, auto-degrade, output guard, bridge heartbeat
- Stability Bridge payload do `localStorage`

## Princip

Tahle vrstva není autopilot. Nevybírá světy ani eventy. Pouze omezuje technickou zátěž a posílá bezpečný performance/stability intent rendereru.

## Doporučený test

1. Otevři `show-os.html`.
2. Jdi do **Physics Core** a několikrát dej `INJECT ENERGY` / `FORCE TEST`.
3. Jdi do **Stability Lab`.
4. Dej `HEALTH SCAN`.
5. Vyzkoušej profily `ECO`, `BALANCED`, `LIVE`, `SAFE`.
6. Dej `SEND STABILITY BRIDGE`.

## Cíl

Připravit projekt na dlouhé testování výkonu a stability před cleanup passem celé aplikace.
