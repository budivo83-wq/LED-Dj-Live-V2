# Mapping Engine

Mapping engine je subsystém mezi renderem a fyzickým outputem.

```text
Shader / Animation Space
        ↓
Virtual Canvas / Render Frame
        ↓
Mapping Space
        ↓
Physical Segments
        ↓
Packet Outputs
```

## Aktuální produkční stav

Produkční browser runtime zatím používá legacy mapping uložený v `localStorage` pod klíčem:

```text
led-engine-mapping-v1
```

Ten je editovaný přes:

```text
public/mapping.html
public/mapping.js
```

Aktuální legacy model umí hlavně:

- počet stripů,
- pixely na strip,
- reverse per strip,
- enable per strip,
- brightness per strip,
- output route per strip,
- universe/start address metadata,
- jednoduchý 2D náhled.

Runtime čtení legacy mappingu probíhá v `public/state.js`, kde se převádí na row arrays pro output transform:

- reversed rows,
- enabled rows,
- brightness rows,
- pixel limits,
- output routes.

Samotná transformace payloadu je v:

```text
public/runtime/mapping_transform.js
public/serial_output.js
public/serial_output_worker.js
```

## Existující skeleton

V `src/mapping` už existuje extrahovaný skeleton budoucího mapping enginu:

```text
src/mapping/model/constants.js
src/mapping/model/normalize.js
src/mapping/model/validate.js
src/mapping/pipeline/execute.js
src/mapping/mapping_api.js
```

Tento skeleton popisuje cílový princip, ale není zatím hlavní produkční mapping cesta browser runtime.

## Cílový směr

Cílový mapping nemá být pouze UI formulář. Má být verzovaný model:

```text
Mapping JSON
   ↓ normalize
Validated Mapping Model
   ↓ compile
Runtime Mapping Plan
   ↓ consume by preview/output/debug
```

## Segment model

Cílový segment má obsahovat minimálně:

- `id`,
- `label`,
- `enabled`,
- `groupId`,
- `objectType`,
- `source` / UV sampling,
- `physical.pixelCount`,
- `physical.direction`,
- `physical.brightness`,
- `physical.gamma`,
- `physical.colorOrder`,
- `transform`,
- `patch.outputId`,
- `patch.nodeId`,
- `patch.portId`,
- `patch.universe`,
- `patch.channel`,
- `patch.splitPolicy`.

## Upgrade plán

Detailní plán upgrade na sofistikovaný mapping systém je v:

```text
docs/STEP_9A_SOPHISTICATED_MAPPING_SYSTEM_PLAN.md
```

## Bezpečnostní pravidlo

Legacy `led-engine-mapping-v1` se nesmí odstranit ani přepsat bez bridge/fallback vrstvy. Nový mapping systém musí nejdřív běžet paralelně, potom preview-only, potom dry-run output a teprve potom gated live output.

## STEP 9B runtime foundation

Od Step 9B existuje browser-safe runtime modul `public/runtime/mapping_v2.js`.

Tento modul zavádí čtyři vrstvy:

1. `migrateLegacyMappingToV2()` — převede současný jednoduchý mapping na V2 model.
2. `normalizeMappingV2()` — sjednotí a ořeže hodnoty do bezpečných rozsahů.
3. `validateMappingV2()` — hlídá strukturální chyby, duplicitní ID a překryvy adres.
4. `compileMappingV2()` — vytvoří runtime output pro staré i nové adaptéry.

Mapping stránka zatím zůstává jednoduchá, ale její JSON export už obsahuje `mappingV2` a `compiled`.

Důležité pravidlo: live output pipeline se na Mapping V2 nesmí přepnout naráz. Nejdřív musí projít přes preview-only a dry-run režim.

## Step 9C – Mapping V2 store, presets, import/export

Step 9C introduces the first user-facing safety layer around Mapping V2.

Added runtime module:

- `public/runtime/mapping_v2_store.js`

Responsibilities:

- load Mapping V2 from `led-engine-mapping-v2`
- migrate old `led-engine-mapping-v1` when needed
- save normalized Mapping V2 with compiled validation data
- create safe presets such as `8x300`, `4x300`, `2x300`, `8x144`
- export/import JSON documents with an explicit safety note

Important safety rule:

> Importing or saving a mapping document does not directly enable live output routing. Runtime output application must remain behind a separate gated step.

The mapping screen now shows:

- preset selector
- validation panel
- route summary
- JSON export copy
- JSON import prompt

This is still a foundation step. It prepares the UI and data contract for the later visual editor and live-output compiler gate.

## Step 9D status — editor shell

Mapping stránka má od Step 9D tři editační režimy:

- `PHYSICAL` pro output adresaci a fyzické vlastnosti pásků,
- `SPATIAL` pro virtuální zdroj, objekt, sampling a základní transformaci,
- `CALIBRATION` pro jas, gamma, white limit a tagy.

Důležité: Mapping V2 editor je zatím stále **preview-only**. Export i runtime metadata obsahují `liveOutputApply: false` a `previewOnly: true`. Skutečný output tedy zatím zůstává na původní bezpečné cestě.

Další doporučený krok je oddělit canvas preview renderer do `public/runtime/mapping_v2_preview.js` a kreslit přímo z compiled Mapping V2 modelu.

## Step 9F — Routing mode

Mapping page now includes a dedicated `ROUTING` editor mode. This mode is intended for fast physical output setup after the spatial/physical model is defined.

Core controls:

- `BULK OUTPUT` — assigns selected output type to every active segment.
- `START UNIVERSE` — first universe used by the automatic router.
- `UNIVERSE SIZE PX` — pixel capacity of one universe block; default is 150 px.
- `AUTO ROUTE ACTIVE` — sequentially packs enabled segments into universes and writes `universe`, `startAddress`, and `pixelStart`.
- `ROUTES` table — human-readable output/universe/address/pixel summary.

The editor still writes both Mapping V2 and legacy-compatible storage keys.


## Step 9G — Segment Tools

Mapping V2 editor nyní obsahuje základní segment authoring: přidání segmentu, duplikaci posledního segmentu, rozdělení posledního segmentu, odstranění posledního segmentu a compact routing. Každý segment má vlastní `label` a `tags`, které se ukládají do Mapping V2 dokumentu a zůstávají dostupné pro budoucí skupinové operace, filtry a device/node profily.


## Step 9H — Inspector & diagnostics

Mapping editor nově obsahuje vybraný segment, route conflict summary, ruční validaci, normalizaci adres a renumber segmentů. Tohle je základ pro bezpečnou práci s více výstupy, protože uživatel vidí přesnou adresu, universe a conflict stav před uložením.

## Step 9I — Calibration preview

Mapping V2 nyní obsahuje bezpečnou kalibrační preview vrstvu: selected segment, solid, address gradient, universe colors, RGB order test a chase pattern. Kalibrace zatím nezasahuje přímo do live output gate; slouží pro diagnostiku a přípravu fyzického test módu.


## Step 9J — Live test output guard

Mapping V2 má od Step 9J samostatný fyzický test výstupu. Kalibrační pattern se neukládá jako součást běžného mappingu, ale přes runtime-only klíč `led-engine-mapping-v2-test-output`. Output pipeline tento stav čte těsně před sestavením serial/BLX payloadu. Pokud není test explicitně armovaný, fyzický výstup dál používá normální render frame.

Bezpečnostní pravidlo:

```js
armed === true && pattern !== "off"
```

Tím se odděluje běžné uložení mappingu od fyzické kalibrace.

## STEP 9K — UI scroll guard

Mapping editor teď chrání segmentové inputy/selecty před bubláním kliků do celé segmentové karty. Test patterny a větší editorové akce používají `preserveViewport()`, takže stránka při ovládání segmentů ani při spuštění test patternu sama neskáče/neroluje.
