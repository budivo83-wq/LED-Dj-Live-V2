# STEP38B Generator Safe Preview

## Summary

This step adds a new standalone Generator workspace and the first preview-only generative engine. It also adds the STEP38A ArtNet stabilization layer around port safety, 8x300 route reset, and output truth diagnostics.

## Added files

- `public/generator.html`
- `public/generator.css`
- `public/generator.js`
- `public/runtime/generator_engine.js`
- `public/runtime/generator_graph.js`
- `public/runtime/generator_curves.js`
- `public/runtime/generator_bridge.js`

## Safety boundary

Generator is preview-only in this step. It does not write to physical LED output and does not replace the Performance writer. The LIVE button is intentionally locked until the single-writer framebus bridge is implemented.

## ArtNet stabilization

- `scripts/check-js.mjs` now checks files in parallel.
- ArtNet live config default port is restored to `6454`.
- Settings warn when using a non-standard port.
- Settings provide `SAFE RESET 8×300 / 6454`.
- MultiOut editor now exposes 16 slots for the 8×300 split route table.
- Settings include `OUTPUT TRUTH STEP38A`, showing active port, bind IP, target, and routes.

## Verified

- `npm run check:js`
- `npm run test:artnet-settings-boundary`
- `npm run test:artnet-server-boundary`
- `npm run test:artnet-live-source-policy`
- `npm run test:ui-staged-boundary`
- `npm run test:migration-flags`
- `npm run test:contracts`
- `npm run test:shell-runner-output-contract`
- `npm run test:preview-fps-contract`
- `npm run test:output-route-registry`
