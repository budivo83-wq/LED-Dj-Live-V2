# STEP38G — Generator Show OS Bridge

## Cíl

SHOW OS už neposílá jen abstraktní intent do `localStorage`. STEP38G přidává překladovou vrstvu, která převádí dramaturgické hodnoty ze SHOW OS do skutečného Generator patch systému:

- Show OS `world / universe / weather / phase`
- hodnoty `energy / chaos / density / motion`
- authority limity a operator lock
- Generator `macros / curves / node graph`

Fyzický output zůstává bezpečný: Generator pořád používá LIVE MASTER bridge z předchozího kroku a neposílá UDP ArtNet napřímo.

## Nové soubory

- `public/runtime/generator_showos_bridge.js`
- `scripts/test-generator-step38g.mjs`
- `docs/STEP38G_GENERATOR_SHOWOS_BRIDGE.md`

## Upravené soubory

- `public/generator.js`
- `public/generator.html`
- `public/generator.css`
- `public/show-os.js`
- `public/show-os.html`
- `public/runtime/generator_bridge.js`
- `package.json`

## Generator UI

V Generatoru přibyl blok **Show OS Bridge**:

- `APPLY SHOW OS` — ručně aplikuje poslední Show OS bridge payload.
- `AUTO FOLLOW ON/OFF` — když je ON, Generator sleduje nové Show OS payloady a plynule je aplikuje.
- `IGNORE CURRENT` — přeskočí aktuální payload bez vypnutí auto režimu.

AUTO FOLLOW je uložený v:

```text
budilight.generator.showos.autoFollow.v1
```

Snapshot posledního překladu je uložený v:

```text
budilight.generator.showos.snapshot.v1
```

## SHOW OS UI

V SHOW OS přibyla sekce **Generator Bridge**. Umí:

- poslat Generator Bridge payload,
- zapnout/vypnout Generator AUTO FOLLOW,
- otevřít Generator stránku,
- ukázat preview překladu payloadu do Generator hodnot.

Bridge stále používá kompatibilní klíč:

```text
budilight.performance.bridge.pro
```

Generator z něj umí číst a mapovat ho do svého patch/graph/curve systému.

## Mapování

### World / Universe

- Forge / Reactor / Industrial / Peak → víc grid, scanline, particles, teplejší barva.
- Alien / Synthetic / Crystal / Cyber → víc kaleido, warp, shimmer, color flow.
- Forest / Organic / Moss → měkčí plasma, nižší grid, organická barevnost.
- Deep / Cosmic / Void / Afterhours → pomalejší pohyb, nižší density, ambient výstup.
- Ritual / Tribal / Cave / Temple → beat gate, tunnel, střední density.

### Weather

- Calm / Mist / Void → tlumí energii, gate vypnutý.
- Storm / Electrical → zvedá shimmer, gate a pohyb.
- Ritual → bezpečný beat pulse.
- Solar → jasnější otevřenější profil.

### Phase

- DROP / PEAK → gate ON, vyšší energy, pulse beat division 2.
- BUILD / TENSION → gate ON, pomalejší build, division 4.
- RECOVERY / AFTERHOURS → gate OFF, nižší output, delší křivky.
- GROOVE / FLOW / RITUAL → střední řízený pulse.

## Bezpečnost

- Authority limity ze SHOW OS omezují hodnoty ještě před mapováním.
- `operatorLock` snižuje influence, takže Show OS nemá agresivní kontrolu nad generátorem.
- LIVE režim se stále neobnovuje po reloadu automaticky.
- Generator pořád neposílá UDP ArtNet přímo.

## QA

Nový test:

```bash
npm run test:generator-step38g
```

Kontroluje:

- normalizaci Show OS payloadu,
- authority clamp limitů,
- mapování do patch hodnot,
- mapování do node graphu,
- mapování do curve režimů,
- render 300×8 frame,
- storage apply workflow,
- AUTO FOLLOW flag.
