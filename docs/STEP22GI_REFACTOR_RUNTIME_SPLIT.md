# STEP22GI – Runtime/server split

Navazuje na funkční STEP22GH, kde bylo potvrzené, že shader i pixel preview zase běží.

## Co se refaktorovalo

- `server.js` už přímo neskládá celý live hardware stack po jednotlivých třídách.
- Live služby se skládají v `src/server/live_services_factory.js`.
- Runtime profile API a validace presetů jsou přesunuté do `src/server/runtime_profile_routes.js`.
- Původní server je uložený v `archive/server_refactor_step22gi/server_before_step22gi.js`.

## Co se záměrně neměnilo

- Render loop.
- Shader preview.
- Pixel preview / master-frame cesta.
- ArtNet master-frame routes.
- Serial/ArtNet parallel router.
- Mapping 8×300 logika.

## Smysl změny

Cílem bylo zmenšit riziko dalšího refaktoru: `server.js` je kratší a live hardware závislosti jsou na jednom místě. Další krok může být podobně oddělit ArtNet/Serial output bootstrap.
