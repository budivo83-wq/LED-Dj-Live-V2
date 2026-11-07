# STEP38M — Generator uses Settings Output FPS

Fixes the post-takeover issue where Generator LIVE MASTER owned the output correctly, but its own live publish gate could still run at a separate low FPS value saved by the Generator operator panel.

## What changed

- Generator LIVE FPS is no longer an independent Generator-only setting.
- Generator resolves FPS from Settings in this order:
  1. `led-engine-settings-v1.fps` — Runtime FPS in Settings.
  2. `led-engine-settings-v1.artnetMirrorFps` — ArtNet mirror FPS fallback.
  3. `budilightArtNetMasterMirrorFps22EJ` — existing master mirror compatibility key.
  4. old `budilight.generator.live.fps.v1` only as final fallback.
- On Generator boot and LIVE start, it also refreshes `/api/artnet/live-config` and applies `config.fps` when available.
- The Generator operator UI now shows `Live FPS ze Settings` and the detected source.
- During LIVE, Generator polls Settings FPS about once per second, so changing FPS in Settings is picked up without a Generator reload.

## Safety

Generator still caps the browser render/publish gate at 60 FPS. If Settings is above 60, the UI shows the cap and the real ArtNet sender can still use its own configured transport limits.

## Test

```bash
npm run test:generator-step38m
```
