# STEP37BB – Output Route Registry

Tahle verze přidává společný browser-side registry pro fyzické output writery.

## Cíl

Odstranit stav, kdy dvě cesty současně sahají na fyzický LED výstup:

- ArtNet master mirror
- RAW Serial app mirror
- případné další output routy později

Preview/debug/render UI mohou běžet dál, ale fyzický writer musí být jeden.

## Nový soubor

- `public/runtime/output_route_registry_37bb.js`

Globální diagnostika:

- `window.__budilightOutputRouteRegistry37BB`
- `window.__budilightOutputRouteRegistrySnapshot37BB()`

## Upravené soubory

- `public/index.html`
  - registry se načítá před serial/artnet mirrory
- `public/runtime/artnet_master_framebus_mirror_22ej.js`
  - ArtNet mirror si nárokuje route `artnet-master-framebus-mirror`
  - před WS/fetch write kontroluje `canWrite()` / `markWrite()`
- `public/runtime/live_serial_app_mirror_22cr.js`
  - serial mirror si nárokuje route `live-serial-app-mirror`
  - pokud ArtNet drží route, serial write se potlačí
- `public/debug_panel.js`
  - Output Stability detail ukazuje `route <owner> c<conflicts>/d<denied>`

## Očekávaný stav při ArtNet live outputu

V Debug → Output Stability by mělo být něco ve stylu:

`route artnet-master-fra... c0/d0`

Když současně zapneš Serial mirror, registry by měl Serial potlačit a naroste `d` nebo `c`, ale ArtNet má dál držet output.

## Proč je to důležité

Starý STEP37AP lock byl užitečný, ale byl jen jeden globální objekt. Registry je lepší mezikrok k budoucímu jednotnému multi-output routeru, protože uchovává přehled všech writerů, konfliktů, denied write pokusů a vlastnictví outputu.
