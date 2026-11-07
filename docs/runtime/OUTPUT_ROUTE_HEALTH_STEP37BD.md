# STEP37BD – Output Route Health

Navazuje na STEP37BB/STEP37BC.

Cíl: mít v jednom Debug řádku vidět, jestli se browser-side output registry a server-side output registry shodují.

## Přidáno

- `public/runtime/output_route_health_37bd.js`
  - čte browser registry `__budilightOutputRouteRegistry37BB`
  - polluje server endpoint `/api/output/server-route-registry`
  - vytváří kombinovaný snapshot `window.__budilightOutputRouteHealth37BD.snapshot()`
  - posílá event `budilight-output-route-health-37bd`

- `public/debug_panel.js`
  - Output Stability detail nově ukazuje:
    - `routeHealth match ...`
    - `routeHealth browser_only ...`
    - `routeHealth server_only ...`
    - `routeHealth mismatch ...`

## Jak číst stav

- `match` = browser i server drží stejnou rodinu výstupu, například ArtNet/ArtNet.
- `idle` = nic fyzicky neposílá.
- `browser_only` = browser si myslí, že output vlastní, ale server lock není aktivní. To může být normální krátce po startu nebo při preview-only módu.
- `server_only` = server drží fyzický output bez odpovídajícího browser locku. To je podezřelé.
- `mismatch` = browser a server ukazují rozdílné writery. To je riziko konfliktu.
- `server_unknown` = debug stránka nedokázala přečíst server endpoint.

## Test

1. Spusť aplikaci.
2. Zapni ArtNet output.
3. Otevři Debug → Output Stability.
4. Sleduj `routeHealth`.

Při zdravém ArtNet výstupu čekej přibližně:

`route artnet... | routeHealth match b:artnet.../s:artnet...`

Pokud uvidíš `server_only` nebo `mismatch`, další krok je najít writer, který obchází registry.
