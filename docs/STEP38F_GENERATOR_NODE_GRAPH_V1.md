# STEP38F — Generator Node Graph v1

This step turns the Generator from a macro/curve preview tool into a small patchable render chain.

## Added

- `public/runtime/generator_graph.js`
  - normalized node graph contract
  - node types: `source`, `modifier`, `color`, `fx`, `output`
  - render plan generation with per-node `enabled`, `mix`, `intensity`, `order`
  - safe normalization for older STEP38B/E stored graphs
- `public/runtime/generator_engine.js`
  - accepts `graph` in `renderGeneratorFrame({ patch, graph, ... })`
  - graph nodes now affect rendered pixels, not just UI flags
  - `output` node works as master generator fader
  - `gate`, `scanline`, `kaleido`, `colorFlow` are graph-addressable
- `public/generator.js`
  - Node Graph v1 UI with source → modifier → color → fx → output flow
  - per-node enable, mix, intensity
  - node up/down ordering
  - graph summary in preview heartbeat
- `public/runtime/generator_presets.js`
  - factory/custom presets now normalize and persist full graph state
  - factory presets include different node mix/intensity layouts
- `scripts/test-generator-step38f.mjs`
  - verifies graph normalization, render plan, graph-driven brightness and preset persistence

## Safety

- Generator still uses the STEP38D LIVE MASTER bridge path.
- It does not send direct UDP ArtNet.
- LIVE still starts safe/off after reload.
- Output node cannot be disabled from UI, but its mix/intensity can dim the whole generator frame.

## Test commands

```bash
npm run check:js
npm run check:full
npm run check:layers
npm run qa:core
npm run test:generator-step38e
npm run test:generator-step38f
```

