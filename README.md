# LED Dj Live

Real-time LED performance engine with a separate gallery/editor workspace, mapping editor, and guarded output pipeline.

## Start

- Install dependencies with `npm install` if needed.
- Start the app with `npm start`.
- On Windows, use `Start_LED_Engine.cmd` or `launch.vbs`.

## Main entry points

- `public/index.html` - Performance.
- `public/animations.html` - Gallery, editor, and Shadertoy workspace.
- `public/mapping.html` - Mapping editor.
- `public/settings.html` - Output and system settings.
- `public/login.html` - Login.
- `public/shorts.html` - Shorts helper.

## Documentation

- [Documentation Index](docs/INDEX.md)
- [Architecture](docs/ARCHITECTURE.md)
- [API Contracts](docs/API_CONTRACTS.md)
- [Animation Studio](docs/ANIMATIONS_STUDIO.md)
- [Workflows](docs/WORKFLOWS.md)
- [Migration Plan](docs/MIGRATION_PLAN.md)
- [Release Notes](docs/RELEASE_4_0.md)
- [Release Notes](docs/RELEASE_4_0.md)

## Code areas

- `public/app.js` - composition root for the main performance shell.
- `public/core/` - shared constants, defaults, math, DOM helpers, and module loading.
- `public/runtime/` - startup, telemetry, queueing, and runtime orchestration.
- `src/server/` - API routes and backend wiring.

## Current focus

- Animation gallery ergonomics and workflow.
- Safe editor preview and draft handling.
- Shadertoy sandbox and bridge prep.
- Mapping and output contracts remain guarded by tests.
