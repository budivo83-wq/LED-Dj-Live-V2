# Migration Flags (Step 14)

Tato vrstva dovoluje postupnou migraci bez big-bang prepisu.

## Storage key

- `led-engine-feature-flags-v1`

## Dostupne flagy

- `useNewCentralState`
- `useNewFramePipeline`
- `useNewMapping`
- `useNewOutput`
- `useNewPreview`
- `useNewEvents`
- `useNewTelemetry`

## Pravidla

1. Default je `false` pro vsechny flagy.
2. Legacy runtime zustava aktivni, dokud neni explicitne zapnuty novy stack.
3. `createMigrationRuntime()` umí prepnout mezi `legacy` a `next` podle flags.
4. Nikdy nesmis zapnout vice nekompatibilnich casti bez odpovidajiciho fallbacku.

## Pouziti

```js
import { createMigrationRuntime, writeFeatureFlags } from "../src/migration/index.js";

writeFeatureFlags({ useNewFramePipeline: true });
const runtime = createMigrationRuntime({ legacy, next });
runtime.start();
```

## Status

Výchozí produkční cesta zustava legacy. Novy stack se zapina ciste pres flags.

## nextEngineExecutionHealthTrend

Disabled by default. Enables STEP 11N dry-run health trend diagnostics for the next output writer. It only observes recent execution health summaries and exposes trend/stability state; it does not enable physical output writes.

## nextEngineExecutionReadinessGate

Disabled by default. Enables STEP 11O dry-run readiness gate diagnostics for the next output writer. It only evaluates whether validation, schedule, sanity, health summary, and health trend are coherent enough for a dry-run commit preview. It does not enable physical output writes.
