# STEP22KH–KN — Visual Physics Core Pack

Tento krok doplňuje praktickou testovací vrstvu pro:

- STEP22KH Physics Variables
- STEP22KI Physics Debug / Monitor
- STEP22KJ Memory Field
- STEP22KK Attention Field
- STEP22KL Flow Network
- STEP22KM Emergent Events
- STEP22KN World Blending

## Zásada

Physics Core nepřebírá renderer. Posílá pouze safe intent přes `budilight.physics.bridge` a `budilight.performance.bridge.pro`. Performance renderer zůstává autonomní.

## Test

1. Otevři Show OS.
2. Jdi na sekci **Physics Core**.
3. Dej **DERIVE FROM SHOW**.
4. Hýbej fyzikálními slidery.
5. Dej **INJECT ENERGY**, **SCAN**, případně **FORCE TEST**.
6. Vyzkoušej **World Blending** a potom **SEND PHYSICS BRIDGE**.

## Ladění výkonu

- `quality: eco` drží jádro jako lehký intent/debug.
- Flow nodes jsou omezené na 24.
- Memory scars jsou omezené na 30.
- Event history je omezená na 40.
- Reálný renderer může číst jen agregovaný payload, nemusí vykreslovat debug mapy.
