# STEP38O — Generator Performance Crossfade

Purpose: make Generator LIVE takeover/release controllable instead of a hard, visually abrupt switch.

## What changed

- Added `public/runtime/generator_transition.js`.
- Generator now captures the latest server MASTER frame before LIVE takeover when a takeover fade is enabled.
- During takeover, the published Generator frame is blended with the captured Performance MASTER frame.
- During release, Generator fades its own frame down before unlocking Performance again.
- Added UI controls in `generator.html`:
  - Takeover fade: CUT / 0.5s / 0.9s / 1.5s / 2.5s
  - Release fade: CUT / 0.5s / 0.7s / 1.2s / 2.0s
  - Transition curve: smooth / ease / linear
  - Transition status + copyable report

## Safety model

This does not create a second UDP/ArtNet writer.

The flow remains:

```text
Generator rendered frame
  → transition mixer
  → LIVE MASTER bridge
  → server MASTER mirror
  → existing ArtNet sender
```

The old STEP38L/38M/38N ownership protections stay active. Performance is still muted when Generator LIVE owns the output.

## Important limitation

Takeover can crossfade from the last fresh server MASTER frame because that frame is available before Generator takes ownership.

Release fades Generator down before unlocking Performance. It does not yet live-mix with a fresh Performance frame during release, because Performance is intentionally muted while Generator owns the output.

## Test

```bash
npm run test:generator-step38o
```
