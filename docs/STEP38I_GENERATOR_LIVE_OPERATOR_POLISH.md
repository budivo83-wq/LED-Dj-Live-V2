# STEP38I — Generator Live Operator Polish

Cíl tohoto kroku je z Generatoru udělat praktičtější nástroj pro živý test, ne jen patch editor.

## Přidáno

- nový runtime modul `public/runtime/generator_live_ops.js`
- nový panel `04 Live Operator` v `public/generator.html`
- bezpečné scény:
  - Safe Calm Plasma
  - Safe Build Tunnel
  - Safe Drop Gate
  - Safe Afterhours Void
  - Safe Diagnostic Grid
  - Blackout Patch
- Live FPS volba 15 / 30 / 45 / 60
- `BLACKOUT FRAME`
- `PANIC RELEASE`
- základní měření:
  - render ms avg / max
  - publish ms avg
  - server mirror ms avg
  - fps-gate drops a server errors

## Bezpečnostní chování

- Aplikace safe scény při aktivním LIVE režimu nejdříve přepne Generator do PREVIEW.
- `BLACKOUT FRAME` posílá fyzický blackout jen tehdy, když už je Generator v LIVE MASTER režimu.
- `PANIC RELEASE` se nejdříve pokusí poslat blackout frame a potom Generator uvolní do OFF.
- Generator stále neposílá UDP ArtNet napřímo. LIVE cesta zůstává přes MASTER mirror / existující ArtNet sender.

## Bridge metriky

`public/runtime/generator_bridge.js` teď drží také:

- `lastRenderMs`
- `avgRenderMs`
- `lastPublishMs`
- `avgPublishMs`
- `lastServerMs`
- `avgServerMs`

Tyto hodnoty jsou dostupné ve snapshotu `budilight.generator.bridge.snapshot.v1` a v UI panelu Generatoru.

## QA

Nový test:

```bash
npm run test:generator-step38i
```

Ověřuje:

- safe scene banku,
- render bezpečných scén,
- blackout frame,
- blackout patch render,
- live metriky,
- Live FPS storage clamp.
