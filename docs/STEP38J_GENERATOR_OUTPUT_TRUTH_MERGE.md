# STEP38J — Generator Output Truth Merge

## Cíl

STEP38J přidává do `Generator` stránky panel **06 Output Truth**, aby nebylo nutné při živém testu přepínat do Settings jen kvůli kontrole ArtNet řetězce.

Panel čte stejnou diagnostiku jako Live Testing Chain a zobrazuje konkrétní fyzickou pravdu:

- MASTER source,
- ArtNet source policy,
- bind IP / target IP / port,
- socket ready stav,
- route patch summary,
- universe/route řádky,
- sender FPS,
- poslední UDP výsledek,
- praktické důvody, proč LED nemusí svítit.

## Nové soubory

- `public/runtime/generator_output_truth_panel.js`
- `docs/STEP38J_GENERATOR_OUTPUT_TRUTH_MERGE.md`

## Upravené soubory

- `public/generator.html`
- `public/generator.js`
- `public/generator.css`
- `package.json`

## Důležité chování

Output Truth panel je pouze čtecí diagnostika. Neposílá UDP, nespouští ArtNet sender, nemění routes ani nepřebírá writer.

Generator Live pořád funguje stejně:

1. `LIVE MASTER` publikuje frame do MASTER mirroru.
2. ArtNet sender se spouští přes Settings / SAFE MASTER LIVE cestu.
3. Output Truth jen ukáže, kde se řetězec případně zastavil.

## Nejčastější verdikty

- `OUTPUT GREEN` — Generator → MASTER mirror → ArtNet sender → UDP funguje.
- `OUTPUT BLOCKED · NO_MASTER_FRAME` — Generator neposílá čerstvý MASTER frame.
- `OUTPUT BLOCKED · ARTNET_SOCKET_WAIT` — ArtNet sender běží, ale UDP socket není ready.
- `OUTPUT BLOCKED · ARTNET_NOT_SENT` — socket existuje, ale poslední frame neodešel.
- `OUTPUT READY_FOR_ARTNET` — Generator frame je v MASTER mirroru, ale ArtNet sender neběží.

## Test

```bash
```

Ověřuje:

- standardní ArtNet port 6454,
- bind/target síťovou pravdu,
- route/universe výpis,
- GREEN stav,
- blokovaný stav bez patchů,
- varování pro non-standard port,
- varování pro socket-not-ready.
