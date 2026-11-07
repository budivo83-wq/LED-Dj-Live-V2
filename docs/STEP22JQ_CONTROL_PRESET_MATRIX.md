# STEP22JQ — Control Preset Matrix

Další krok po STEP22JP Control Authority. Cíl je zachovat plnou nastavitelnost a škálovatelnost SHOW OS, ale zabránit tomu, aby se z Director AI stal neřízený autopilot.

## Přidáno

- `public/control-authority-pro.html` — nová stránka pro řízení autority, limitů, měřítka a presetů.
- `public/control-authority-pro.js` — UI logika pro načtení, změnu, ukládání a aplikaci presetů.
- `public/control-authority-pro.css` — samostatný neon/dark layout.
- `data/control-authority-pro-22jq.json` — persistentní lokální konfigurace.
- `src/server/show_control_routes_22jq.js` — API pro konfiguraci, presety a bridge payload.
- registrace API v `src/server/main_routes_registry.js`.

## API

- `GET /api/show-control/22jq/config`
- `POST /api/show-control/22jq/config`
- `POST /api/show-control/22jq/apply-preset`
- `GET /api/show-control/22jq/bridge-payload`

## Princip

Director AI nemá absolutní moc. Vždy prochází přes:

1. authority mode,
2. operator lock,
3. safety limits,
4. feature gates,
5. scale profile,
6. controlled bridge payload.

## Režimy

### MANUAL

Director pouze doporučuje. Operátor řídí show ručně.

### ASSIST

Director připravuje návrhy, ale změny se aplikují pouze v mantinelech.

### AUTO_LIMITED

Director může provádět změny automaticky, ale jen uvnitř explicitně nastavených limitů a zapnutých feature gates.

## Proč je to důležité

Universe / Story / Ecosystem vrstvy mohou být velmi silné. Bez Control Preset Matrix by systém časem začal působit jako samostatný program, který si dělá, co chce. Tato vrstva zavádí profesionální show-control model: autonomní nápady ano, neomezená kontrola ne.
