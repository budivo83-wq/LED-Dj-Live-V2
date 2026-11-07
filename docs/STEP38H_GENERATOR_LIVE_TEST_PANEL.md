# STEP38H — Generator Live Testing Panel

## Cíl

STEP38H přidává do stránky `GENERATOR` jeden společný diagnostický panel pro celý live řetězec:

```text
Show OS → Generator Preview → Generator LIVE MASTER bridge → Server MASTER mirror → ArtNet Patch → ArtNet Sender → UDP/LED
```

Smysl je rychle poznat, kde se fyzický výstup zastavil, bez přeskakování mezi několika stránkami a bez hádání, jestli problém vzniká v generátoru, server mirroru, ArtNet senderu, routingu nebo až mimo aplikaci.

## Nové soubory

- `public/runtime/generator_live_test_panel.js`
- `scripts/test-generator-step38h.mjs`
- `docs/STEP38H_GENERATOR_LIVE_TEST_PANEL.md`

## Upravené soubory

- `public/generator.html`
- `public/generator.js`
- `public/generator.css`
- `package.json`

## Co panel sleduje

Panel čte lokální stav z browseru:

- `budilight.generator.bridge.snapshot.v1`
- `budilight.generator.live.lock.v1`
- `budilight.generator.preview.heartbeat`
- `budilight.generator.showos.snapshot.v1`
- `budilight.performance.bridge.pro`
- `budilight.showos.intent`

A serverový stav z endpointů:

- `/api/artnet/master-mirror/status`
- `/api/artnet/master-bridge/monitor`
- `/api/artnet/sync-live/status`
- `/api/artnet/master-mirror/patch-report`

## Diagnostické stavy

Panel umí rozlišit hlavně tyto stavy:

- `IDLE` — nic čerstvého neběží.
- `SHOWOS_READY` — Show OS payload je připravený, ale nemusí být aplikovaný.
- `PREVIEW_ONLY` — Generator běží jen v preview.
- `LIVE_ARMED_NO_FRAME` — LIVE MASTER je aktivní, ale ještě neposílá platný frame.
- `NO_MASTER_FRAME` — server MASTER mirror nemá frame.
- `MASTER_STALE` — MASTER frame existuje, ale je starý.
- `MASTER_OTHER_SOURCE` — MASTER mirror je čerstvý, ale jeho zdroj není Generator.
- `READY_FOR_ARTNET` — Generator frame je v server MASTER mirroru, ale ArtNet sender neběží.
- `ARTNET_SOCKET_WAIT` — sender běží, ale UDP socket není ready.
- `ARTNET_WRONG_SOURCE` — sender pravděpodobně nečte MASTER framebus.
- `ARTNET_NOT_SENT` — sender má socket, ale poslední frame neodešel.
- `GREEN` — Generator → MASTER mirror → ArtNet sender běží.

## Ovládání v Generatoru

Nová sekce `04 Live Testing Chain` obsahuje:

- `REFRESH CHAIN` — ruční aktualizace celého řetězce.
- `MASTER SELF TEST` — pošle testovací frame přímo do server MASTER mirroru. Nespuští ArtNet sender a nemění Generator patch.
- `OPEN SETTINGS` — rychlý skok na Settings, kde se spouští SAFE MASTER LIVE.
- `OPEN SHOW OS` — rychlý skok na Show OS.

## Bezpečnost

STEP38H nespouští UDP ArtNet výstup automaticky. Panel pouze diagnostikuje řetězec a umí poslat MASTER self-test frame do server mirroru. Fyzický ArtNet sender zůstává pod kontrolou Settings / SAFE MASTER LIVE.

## Test

```bash
npm run test:generator-step38h
```

Test ověřuje:

- čtení lokálních diagnostických snapshotů,
- sběr serverových stavů,
- vyhodnocení zeleného live řetězce,
- stav `READY_FOR_ARTNET`,
- výstavbu řádků UI panelu,
- MASTER self-test helper.
