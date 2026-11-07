# Architecture

- Render pipeline
- Frame bus
- Output sync


## Central Frame Authority — STEP 8A

Runtime composed frames now have an explicit publishing boundary. Pixel producers must publish through `public/runtime/frame_authority.js`; consumers read from `frame_bus`. This starts the migration from multiple implicit render/output paths toward one authoritative frame contract.

Current contract:

```text
producer pixels -> Frame Authority -> Frame Bus -> preview/output/debug
```

The authority validates frame size, clones pooled CPU buffers, attaches trace metadata and rejects invalid packets.


## STEP 8B – Frame Authority Producer Ledger

Doplněna evidence frame producerů v `frame_authority.js`. Autoritativní frame publikace nyní nese jasný producer typ a authority statistiky ukazují publish/reject počty podle zdroje. Detail: [STEP_8B_FRAME_AUTHORITY_PRODUCER_LEDGER.md](STEP_8B_FRAME_AUTHORITY_PRODUCER_LEDGER.md).

## STEP 8C — Frame publish policy

The central frame authority now has a soft policy gate. Producers still create frames, but the decision to accept/reject a publish is centralized in `public/runtime/frame_authority_policy.js`. This prepares the project for gradually removing duplicate render producers without breaking hidden/minimized output safety.


## STEP 8D — Output Render Policy Mode

- `docs/STEP_8D_OUTPUT_RENDER_POLICY_MODE.md`
- Output-owned render decision je přesunutý do `evaluateOutputRenderPolicy()`.
- Output fallback zůstává bezpečně zachovaný, ale je teď policy-controlled a viditelný v diagnostice.

## STEP 8E — Output Freshness Guard

- `docs/STEP_8E_OUTPUT_FRESHNESS_GUARD.md`
- `document.hidden` už automaticky nevytváří separátní output-owned render.
- Output použije latest authoritative frame, pokud je čerstvý.
- Safety fallback render zůstává jen pro missing/stale frame.

## STEP 8G — Render Path Audit Guard

STEP 8G is based on the last known stable runtime base, STEP 8E. STEP 8F was not carried forward because it caused a browser startup regression where the app could load without animations. 8G adds a passive QA guard for render-path bypass detection without changing runtime behavior. See `docs/STEP_8G_RENDER_PATH_AUDIT_GUARD.md`.



## STEP 8H note — Frame metadata passthrough

`publishComposedFrame()` must forward caller `meta` into Frame Authority. Output fallback policy diagnostics are part of the authoritative frame packet, not only local scheduler debug state.


## STEP 8I Runtime Boundary Note

Frame Authority version `8I-composed-frame-authority-api` introduces a named composed-frame publishing API. This keeps the stable 8E startup path while removing the temporary audit exception that allowed `render_pipeline.js` to call the raw `publishFrame()` method directly.


## Output frame read boundary

As of STEP 8J, output policy and output frame selection read the latest authoritative packet through Frame Authority instead of directly from `frame_bus`. Direct bus access remains allowed for telemetry/statistics and subscription bridges, but output frame choice is now routed through the authority boundary.


## STEP 8K — Frame Authority Consumer Read Ledger

Viz `docs/STEP_8K_FRAME_AUTHORITY_CONSUMER_LEDGER.md`. Tento krok přidává pasivní ledger čtenářů authoritative frame přes Frame Authority. Output loop je nově explicitní consumer `output-loop`, takže lze měřit, jaký frameId skutečně používá, bez změny startupu nebo animací.


## STEP 8L — Frame Authority Consumer Subscribe Ledger

Viz `docs/STEP_8L_FRAME_AUTHORITY_SUBSCRIBE_LEDGER.md`. Tento krok přesouvá první subscription consumer (`preview3d-frame-bridge`) z raw `frame_bus.subscribe()` na `frameAuthority.subscribe()`. Startup, animace ani output fallback se nemění; přidává se pouze dohledatelnost subscriberů přes consumer ledger.


## STEP 8M — Frame Authority Telemetry Snapshot

Frame Authority diagnostics are now included in runtime performance/telemetry snapshots without changing startup, animation loading, render timing, or output fallback behavior. See `docs/STEP_8M_FRAME_AUTHORITY_TELEMETRY_SNAPSHOT.md`.


## STEP 8N — Frame Authority Consumer Contracts

STEP 8N keeps the stable 8M runtime path and adds named Frame Authority consumer contracts. Output and 3D preview no longer hard-code consumer names; they use `FRAME_CONSUMERS`. A raw consumer audit now guards against runtime code reading or subscribing to `frameBus` directly outside `frame_authority.js` / `frame_bus.js`.
