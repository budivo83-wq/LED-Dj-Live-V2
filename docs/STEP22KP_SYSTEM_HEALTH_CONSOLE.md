# STEP22KP — System Health Console

Cíl: připravit aplikaci na společné testování, ladění výkonu a následný cleanup pass.

Přidáno:

- nová sekce **Health Console** v Show OS
- RUN HEALTH SCAN
- module checklist
- bridge inspector pro intent/performance/physics/stability/health payloady
- cleanup radar
- export health reportu do JSON
- `budilight.health.bridge` a `budilight.health.report` v localStorage

Doporučený test:

1. Otevři `show-os.html`.
2. V Physics Core dej `SEND PHYSICS BRIDGE`.
3. Ve Stability Lab dej `SEND STABILITY BRIDGE`.
4. V Health Console dej `RUN HEALTH SCAN`.
5. Pokud score spadne pod 75 %, nejdřív řeš položky v Priority Fixes.

Poznámka: Health Console nic automaticky nepřebírá. Jen čte stav, vyhodnocuje rizika a ukládá report.
