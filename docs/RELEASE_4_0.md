# LED DJ LIVE 4.0

Updated: 2026-05-18

Version `4.0.0` aligns runtime, launcher, documentation, and startup behavior into one consistent operating model.

## What Changed

- Central graceful shutdown for `SIGINT`, `SIGTERM`, `SIGBREAK`, `unhandledRejection`, and `uncaughtException`.
- `server.js` was split into focused modules for auth, serial, WebSocket, ops routes, static assets, transport, startup logging, and runtime hooks.
- Thumbnails are pre-generated during startup so the picker is ready when opened.
- Launcher/server flow documentation is now explicit and canonical.
- Runtime reference points for shell, output runner, and startup warmup were aligned.

## Operating Properties

- Node.js backend listens on `0.0.0.0:3000`.
- LAN HTTP access is allowed, but application routes are protected by the auth gate.
- WebSocket sync shares state between clients.
- Serial and BLX transport depend on the central serial controller and UDP adapter.
- Startup flow preloads shaders, runtime modules, and thumbnails.
- The Windows launcher starts Node + Edge and cleans up processes and ports on exit.

## Requirements

- Windows 10/11 for the full launcher flow.
- Node.js 20 or newer.
- `npm install` before first start.
- Microsoft Edge or a compatible Chromium browser.
- Connected target hardware and correct port settings for serial/BLX features.

## First Run Checklist

1. Install dependencies with `npm install`.
2. Start the app with `npm start`.
3. Confirm the backend prints `http://localhost:3000/`.
4. Open the launcher or go directly to `http://localhost:3000/`.
5. Log in with valid credentials.
6. Verify the shell opens and the performance view loads.
7. Open animation and palette pickers once and confirm thumbnails are already available.
8. If serial or BLX output is needed, configure the correct port and baud rate in Settings.

## Key Features

- Performance shell with a persistent top-level layout.
- Two LED layers (`L1 BASE`, `L2 OVERLAY`) with animations, palettes, and parameters.
- Crossfader, blend modes, BPM/TAP, flash, blackout, and FX.
- Mapping editor for LED layout.
- Output settings for preview, serial, and BLX workflows.
- Login, password change, and logout flow.
- Startup overlay, greeting, and runtime telemetry.

## Main Files

- `server.js` - backend composition root.
- `public/app.js` - main performance runtime.
- `public/shell.js` - shell router for iframe and view lifecycle.
- `public/output_runner.js` - persistent output host.
- `public/runtime/` - runtime support modules.
- `src/server/` - backend controllers, routes, and transport wiring modules.

## Launcher Flow

- `Start_LED_Engine.cmd` calls `launch.vbs`.
- `launch.vbs` generates and runs `.launch_leddj.ps1`.
- The PowerShell script starts `node server.js` and then launches Edge in `--app` mode at `http://localhost:3000`.
- Cleanup closes both Edge and Node process trees.

See [Launcher Server Flow](./LAUNCHER_SERVER_FLOW.md) for the full flow.

## Operational Notes

- `server.js` is a composition root; runtime functionality lives in `src/server/*`.
- The thumbnail picker prepares render results during startup.
- `npm run check` is the syntactic baseline gate.
- `POST /api/debug/shutdown` is available for localhost smoke tests when `LED_DEBUG_API=1`.

## Main Risks

- A stale Node process can keep port 3000 busy.
- Serial or UDP resources can linger if shutdown is bypassed.
- Launcher cleanup is required to fully release Edge and Node process trees.

