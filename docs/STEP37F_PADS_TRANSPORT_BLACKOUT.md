# STEP37F — Pads transport + real blackout + persistent sequencer

## Changes

- Added Performance Pads buttons:
  - `SYNC` — calls the same beat sync path as the Step Sequencer SYNC button.
  - `BEAT RESET` — resets the global beat and Step Sequencer to position 1.
  - `HHS` — half-speed BPM (`BPM × 0.5`).
  - `DS` — double-speed BPM (`BPM × 2`).
- Updated `DROP` pad:
  - no longer resets beat position;
  - only changes live combinations / parameters.
- Updated `BLACKOUT` pad:
  - publishes an immediate black frame to the master frame bus;
  - also calls the ArtNet live blackout endpoint;
  - disables animation after the black frame, so the last visible animation should not hang on output.
- Updated Step Sequencer persistence:
  - `enabled` and `follow` are now saved/restored;
  - switching away and back to Performance no longer forces the sequencer OFF.

## Files touched

- `public/index.html`
- `public/runtime/app_dom_refs.js`
- `public/ui_bindings.js`
- `public/runtime/quick_step_automator.js`
