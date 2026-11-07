# Refactor Scope Freeze

Date: 2026-05-18
Status: Active (must hold until explicit unfreeze)

## Goal

Refactor runtime structure without changing live behavior in these protected areas:

1. Live output behavior
2. Mapping behavior
3. Login/auth flow
4. WebSocket state sync behavior

## Freeze Scope (Must Not Change Functionally)

1. Live output (`public/output_runner.js`, `public/runtime/output_pipeline.js`, `public/serial_output.js`)
- Same frame delivery semantics and timing class (no intentional throttling change).
- Same output adapter routing behavior for active outputs.
- No user-visible change in output runner control behavior.

2. Mapping (`public/mapping.js`, `public/runtime/mapping_transform.js`, `src/mapping/*`)
- Same mapping result for identical input data.
- No schema change for persisted mapping payloads unless explicitly versioned.
- No UI flow change in mapping screen interactions.

3. Login (`public/login.html`, `public/login.js`, `server.js`, `auth.json`)
- Same login endpoint contract and response semantics.
- Same redirect/auth guard behavior from login to performance shell.
- No weakening of auth checks or session gating.

4. WebSocket sync (`server.js`, `public/runtime/websocket_sync.js`)
- Same message types and baseline payload shape used by current clients.
- Same reconnect behavior class (auto-reconnect still works).
- Same cross-client state propagation for main runtime controls.

## Acceptance Criteria (Point 1 Exit Gate)

A change is accepted only if all criteria below pass:

1. `npm run check` passes.
2. Login smoke:
- `public/login.html` loads.
- Valid credentials still enter runtime shell.
3. Performance shell smoke:
- Main performance screen loads after login with no blocking runtime error.
4. WebSocket smoke:
- Client establishes WS connection.
- Basic state update still propagates between at least two connected clients.
5. List API smoke:
- `/api/list/l1_anims` returns OK with non-empty array.
- `/api/list/l1_palettes` returns OK with non-empty array.
6. Output smoke:
- Output runner page loads and can receive runtime frames.

## Change Control During Freeze

1. Allowed: file splits, moves, extraction to modules, dependency inversion, naming cleanup.
2. Not allowed without explicit approval: protocol/schema changes, UI behavior changes, timing model changes, auth/session model changes.
3. Any required behavior change must be documented first as a scoped exception in this file.
