# STEP38D — Generator Live Master Bridge

## Goal

Turn the new Generator workspace from preview-only into a controlled MASTER frame producer without creating a second uncontrolled ArtNet writer.

## What changed

- `public/runtime/generator_bridge.js`
  - Exposes `createGeneratorLiveBridge()`.
  - Publishes live generator frames to local `FrameAuthority` / `FrameBus` with source `generator-live-master-frame`.
  - Mirrors the same RGB frame to `/api/artnet/master-mirror/frame-bin` so the existing server MASTER mirror path can consume it.
  - Keeps a compact diagnostic snapshot in `window.__budilightGeneratorBridge38D` and `localStorage`.
  - Uses 300×8 RGB8 frame validation before publishing.

- `public/generator.js`
  - Adds real `LIVE MASTER` mode.
  - OFF releases the generator.
  - PREVIEW draws canvas only.
  - LIVE draws canvas, publishes local framebus packets, and uploads MASTER frames to the server mirror.
  - LIVE mode is not restored automatically after reload; startup always falls back to OFF for safety.

- `public/generator.html` / `public/generator.css`
  - Adds bridge diagnostics: Bridge, Server, FrameBus, Local publish count.
  - Adds RELEASE button.
  - Updates operator copy to clarify that ArtNet sender still has to run in Settings / SAFE MASTER LIVE.

## Safety model

Generator is a frame source, not a raw UDP writer. It does not directly construct ArtNet packets or bypass Mapping. The existing MASTER mirror / ArtNet sender remains the network output path.

Live bridge publishes source:

```text
source = generator-live-master-frame
owner  = generator-live-master-frame-source
size   = 300 × 8 × RGB
```

The ArtNet sender must already be configured with explicit targets/routes. If no ArtNet sender is running, Generator LIVE still updates MASTER mirror status but LEDs will not receive UDP output.

## Next recommended step

STEP38E should add a Generator-aware Output Truth card in Settings/Debug:

- active master source: Performance / Generator / Self-test / stale
- generator bridge frame age
- latest server MASTER source
- ArtNet sender state
- route target summary

After that, add patch save/load and a real curve editor.
