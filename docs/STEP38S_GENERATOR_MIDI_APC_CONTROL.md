# STEP38S — Generator MIDI / APC Control

This step adds a Web MIDI control layer to the Generator workspace.

## Goal

Make Generator usable as a live instrument from APC40/APC mini/Oxygen/generic MIDI controllers without adding another output writer.

The MIDI layer only calls existing Generator actions:

```text
MIDI controller → Generator action → existing Generator frame pipeline → LIVE MASTER bridge → server MASTER mirror → ArtNet sender
```

It does **not** open UDP, it does **not** send ArtNet directly, and it does **not** bypass the single-writer takeover logic.

## Added files

- `public/runtime/generator_midi_apc.js`
- `scripts/test-generator-step38s.mjs`
- `docs/STEP38S_GENERATOR_MIDI_APC_CONTROL.md`
- `START_HERE_STEP38S_GENERATOR_MIDI_APC_CONTROL.txt`

## UI changes

Generator has a new panel:

```text
08 MIDI / APC Control
```

It includes:

- MIDI input selector
- `CONNECT MIDI`
- `MIDI ON/OFF`
- `LEARN NEXT`
- `RESET MAP`
- `COPY MIDI REPORT`
- last MIDI message
- last mapped action
- active mapping summary

## Default mappings

Common APC/generic mappings are included:

### Continuous controls

- CC 16–23 → Macro 1–8
- CC 48–55 → Macro 1–8 alt/fader mapping

### Pads / buttons

- Note 36 → Ambient mode
- Note 37 → Build mode
- Note 38 → Groove mode
- Note 39 → Drop mode
- Note 40 → Break mode
- Note 41 → Psy Chaos mode
- Note 42 → Afterhours mode
- Note 48 → Build now
- Note 49 → Drop now
- Note 50 → Morph to Build
- Note 51 → Morph to Drop
- Note 52 → Blackout frame
- Note 53 → Panic release
- Note 54 → LIVE toggle
- Note 55 → PREVIEW toggle
- Note 56 → Journey start
- Note 57 → Journey stop
- Note 58 → Small mutation
- Note 59 → Safe Calm scene

## Learn mode

Use `Learn action` + `LEARN NEXT`:

1. Choose an action.
2. Click `LEARN NEXT`.
3. Move a knob or press a pad.
4. The mapping is saved to localStorage.

The learned mapping replaces any previous mapping for the same action and avoids duplicate bindings on the same control.

## Storage keys

- `budilight.generator.midi.config.v1`
- `budilight.generator.midi.snapshot.v1`

## Safety behavior

- MIDI cannot automatically bypass Generator mode rules.
- `blackout` only publishes to physical output when Generator is already in `LIVE MASTER`.
- `panic-release` sends blackout if possible and releases Generator.
- `LIVE toggle` still uses the same takeover/crossfade/single-writer path.
- No new ArtNet sender is created.

## Verification

Validated with:

```text
npm run check:js
npm run check:full
npm run check:layers
npm run qa:core
npm run test:generator-step38e
npm run test:generator-step38f
npm run test:generator-step38g
npm run test:generator-step38h
npm run test:generator-step38i
npm run test:generator-step38j
npm run test:generator-step38k
npm run test:generator-step38l
npm run test:generator-step38m
npm run test:generator-step38n
npm run test:generator-step38o
npm run test:generator-step38p
npm run test:generator-step38q
npm run test:generator-step38r
npm run test:generator-step38s
```
