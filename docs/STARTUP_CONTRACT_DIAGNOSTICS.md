# Startup Contract Diagnostics

## Cíl

Shell musí vždy poznat, kde se start zastavil:

- `shell` = rodičovský loader a iframe orchestrátor
- `ui` = viditelný iframe `index.html?shellView=1`
- `runner` = skrytý iframe `output-runner.html` / headless output runtime

## Viditelné chování

Během loadingu se v boot kartě zobrazuje malý diagnostický panel:

- stav shell guardu
- stav UI iframe
- stav runner iframe
- poslední boot eventy s časem od startu

Po úspěšném startu se overlay schová stejně jako dřív.

## Konzolová diagnostika

V DevTools je dostupné:

```js
window.__ledShellBoot.state
```

Vrací aktuální stav:

```js
{
  view,
  uiReady,
  runnerReady,
  uiLoaded,
  runnerLoaded,
  bootGuardActive,
  bootGuardStartedAt,
  bootFinishedAt,
  elapsedMs,
  log
}
```

## Bezpečnostní pravidla

- `led-ui-ready` a `led-runner-ready` jsou preferovaná cesta.
- Fallback guard je pouze záchrana, když iframe proběhne `load`, ale nepošle ready message.
- Thumbnails, shader cache a volitelný preload nesmí blokovat ready contract.
- 3D/WebGL preview se nesmí připojit před ready contract, pouze deferred po startu.
