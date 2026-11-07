# Frame Pipeline Orchestrator (Skeleton)

Bod 5 zavadi centralni orchestrator s pevnym poradi kroku:

`UPDATE -> RENDER -> MAP -> OUTPUT -> PREVIEW`

## Implementace

- `src/pipeline/orchestrator.js`
- `src/pipeline/index.js`

## Dulezite vlastnosti

1. Output je enqueue/dequeue pres ring buffer.
2. Render tick neceka na output transport.
3. Drain outputu je bounded (max 1 batch / tick).
4. Queue depth se propaguje do central state (`output.queueDepth`).

## Poznamka k migraci

Aktualne jde o skeleton API vrstvu pro postupnou migraci z `public/app.js`.
Neprepina zatim produkcni runtime.


---

# Production Runtime Note — STEP 8A

The current production browser runtime still uses `public/runtime/render_pipeline.js`, not the skeleton `src/pipeline/orchestrator.js`.

As of STEP 8A, composed runtime frames are published through:

```text
render_pipeline producer -> frame_authority -> frame_bus -> preview/output/debug
```

`frame_authority.js` is now the canonical publishing boundary for composed frames. It validates dimensions, clones pooled CPU buffers into immutable snapshots, attaches authority metadata and only then publishes to `frame_bus`.

The output safety path may still produce a fresh frame when the document is hidden/minimized, but this is no longer a separate bus contract: it also goes through Frame Authority and remains visible through the same frameId/debug trace.


## STEP 8B – Frame Authority Producer Ledger

Doplněna evidence frame producerů v `frame_authority.js`. Autoritativní frame publikace nyní nese jasný producer typ a authority statistiky ukazují publish/reject počty podle zdroje. Detail: [STEP_8B_FRAME_AUTHORITY_PRODUCER_LEDGER.md](STEP_8B_FRAME_AUTHORITY_PRODUCER_LEDGER.md).

## STEP 8C — Frame Authority Policy Gate

Composed frame publishing now passes through `frame_authority_policy.js` before `frame_authority.js` writes into the runtime frame bus. This does not change pixels yet; it records `policyVersion`, `policyDecision` and `policyReason` so preview/output mismatches can be diagnosed before removing fallback render paths.


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


## STEP 8I — Frame Authority Composed API

`render_pipeline.js` no longer calls the raw `frameAuthority.publishFrame()` entry directly. Composed runtime frames now go through `frameAuthority.publishComposedFrame()`, which remains inside the existing Frame Authority module to avoid the startup/import fragility discovered in STEP 8F.


## STEP 8J — Output read boundary

Output-side frame selection now reads the latest frame through `Frame Authority` via `getAuthoritativeFramePacket()` in `render_pipeline.js`. This keeps the low-level frame bus as the transport/statistics layer while moving output frame choice behind the same authority boundary used for publishing.


## STEP 8K — Frame Authority Consumer Read Ledger

Viz `docs/STEP_8K_FRAME_AUTHORITY_CONSUMER_LEDGER.md`. Tento krok přidává pasivní ledger čtenářů authoritative frame přes Frame Authority. Output loop je nově explicitní consumer `output-loop`, takže lze měřit, jaký frameId skutečně používá, bez změny startupu nebo animací.


## STEP 8L — Frame Authority Consumer Subscribe Ledger

Viz `docs/STEP_8L_FRAME_AUTHORITY_SUBSCRIBE_LEDGER.md`. Tento krok přesouvá první subscription consumer (`preview3d-frame-bridge`) z raw `frame_bus.subscribe()` na `frameAuthority.subscribe()`. Startup, animace ani output fallback se nemění; přidává se pouze dohledatelnost subscriberů přes consumer ledger.


## STEP 8M — Frame Authority Telemetry Snapshot

Frame Authority diagnostics are now included in runtime performance/telemetry snapshots without changing startup, animation loading, render timing, or output fallback behavior. See `docs/STEP_8M_FRAME_AUTHORITY_TELEMETRY_SNAPSHOT.md`.


## STEP 8N — Frame Authority Consumer Contracts

STEP 8N keeps the stable 8M runtime path and adds named Frame Authority consumer contracts. Output and 3D preview no longer hard-code consumer names; they use `FRAME_CONSUMERS`. A raw consumer audit now guards against runtime code reading or subscribing to `frameBus` directly outside `frame_authority.js` / `frame_bus.js`.
