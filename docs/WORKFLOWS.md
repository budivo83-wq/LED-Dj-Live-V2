# Workflows

This document describes the current day-to-day workflows in the project without forcing readers through the full step history.

## Performance

1. Open `public/index.html`.
2. Use `L1` and `L2` controls, FX, BPM, and the output settings in the shell.
3. Keep output checks and debug telemetry in mind when changing runtime behavior.

## Gallery and editor

1. Open `public/animations.html`.
2. Use the gallery to filter, select, assign layers, reorder, archive, or duplicate animations.
3. Use the editor tab for user animation code, preview it in isolation, and save as a new copy or overwrite a user-owned item.
4. Use batch selection when several items need the same layer/archive/order change.

## Shadertoy

1. Open the Shadertoy tab in `public/animations.html`.
2. Paste, import, or load a draft shader.
3. Validate the draft, inspect actionable errors, and preview in the sandbox.
4. Transfer the draft to the editor when it should become a bridge module for further work.

## Mapping

1. Open `public/mapping.html`.
2. Work in the mapping editor, diagnostics, and calibration preview.
3. Keep the live output path gated and rely on the documented mapping QA steps before any risky change.

## Settings and output

1. Open `public/settings.html`.
2. Configure serial, BLX, and other output-related runtime settings.
3. Keep the preview-only vs external-output distinction clear.

## Launcher and shutdown

1. Start the app through `Start_LED_Engine.cmd` or `launch.vbs`.
2. Let the launcher manage the Node and browser process lifecycle on Windows.
3. Use the documented debug shutdown endpoint only for local smoke tests.

## Validation

- Run `npm run check` for baseline syntax and contract coverage.
- Use the gallery, mapping, and output QA scripts when touching their corresponding areas.
- When in doubt, prefer the step archive for details and the workflow guide for execution order.
