# STEP38L — Generator Output Takeover Fix

## Problem

When `Generator LIVE MASTER` was enabled, Performance could still upload its own master frames through the browser master-framebus mirror. The server accepted both sources, so hardware output mostly stayed on Performance and only occasionally showed Generator frames.

## Fix

STEP38L makes Generator LIVE a real master-output owner:

1. `public/runtime/generator_bridge.js`
   - bumps the bridge version to `STEP38L_GENERATOR_TAKES_MASTER_OUTPUT_LOCK`.
   - refreshes `budilight.generator.live.lock.v1` on every published Generator LIVE frame, not only on start.

2. `public/runtime/artnet_master_framebus_mirror_22ej.js`
   - Performance master mirror reads `budilight.generator.live.lock.v1`.
   - while the Generator lock is active and fresh, Performance upload is suppressed before WS/fetch upload.

3. `src/output/artnet_master_frame_store_22ej.js`
   - server-side arbitration keeps a fresh Generator LIVE frame as master owner.
   - incoming Performance WS/fetch frames are dropped for a short window while Generator LIVE is fresh.
   - status exposes `arbitrationDropCount38L` and `lastArbitrationDrop38L`.

4. `src/server/ws_controller.js`
   - if the store drops a Performance WS frame, the direct WS→ArtNet fast path is not triggered.

5. `src/server/artnet_master_frame_routes_22ej.js`
   - if a fetch-posted Performance frame is dropped, the route returns `202` and does not trigger ArtNet send.

## Expected behavior

- Generator OFF: Performance can feed the output as before.
- Generator PREVIEW: Performance can feed the output as before.
- Generator LIVE MASTER: Generator becomes the authoritative master source. Performance frames are blocked/suppressed and must not fight the LEDs.
- Generator OFF again: Performance resumes after the Generator live lock expires/release clears it.

## Test

```bash
npm run test:generator-step38l
```
