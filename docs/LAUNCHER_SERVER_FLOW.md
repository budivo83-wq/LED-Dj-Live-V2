# Launcher <-> Server Flow

Tento dokument popisuje, jak se na Windows spousti aplikace a jak je propojen launcher s `server.js`, aby runtime fungoval stabilne.

## Spousteci retezec (Windows)

1. `Start_LED_Engine.cmd`
- prepne working directory na root projektu (`cd /d "%~dp0"`)
- spusti `wscript.exe launch.vbs`

2. `launch.vbs`
- sestavi PowerShell skript a ulozi ho do `.launch_leddj.ps1`
- spusti ho skryte (`powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ...`)

3. `.launch_leddj.ps1` (generovany/aktualni launcher runtime)
- nastavi:
  - `project` = root projektu
  - `url` = `http://localhost:3000`
- spusti backend:
  - `node.exe server.js` (hidden window)
- ceka na HTTP odpoved z `http://localhost:3000` s timeoutem 30 s
- spusti Microsoft Edge v app rezimu:
  - `--app=http://localhost:3000`
  - izolovany profil `--user-data-dir=.edge-app-profile`
  - fixed window size/position
- pri chybě zapise detail do `launcher.log` a zobrazí dialog s hláškou

## Lifecycle a cleanup

Launcher drzi dva hlavni procesy:
- `node.exe` (backend)
- `msedge.exe` (UI okno)

Pri ukonceni PowerShell hostu (event `PowerShell.Exiting`) bezi `Cleanup`:
- ukonci Edge procesovy strom
- ukonci Node procesovy strom
- fallback: dohleda a ukonci dalsi `node.exe`, ktere patri k tomuto projektu (podle `CommandLine` obsahujici project path)

To je dulezite, aby po zavreni UI nezustaly viset:
- HTTP port 3000
- serial port handly
- UDP/WS sockets

## Co dela `server.js` a co launcher

Launcher:
- proces orchestrator (start/stop Node + browser okno)
- neimplementuje aplikacni logiku

`server.js`:
- HTTP API + static files
- auth/session gate
- WebSocket sync mezi klienty
- serial + BLX bridge
- graceful shutdown controller

Oddeleni zodpovednosti:
- launcher ridi OS procesy
- server ridi runtime resources uvnitr Node procesu

## URL a auth flow

- Edge otevre `http://localhost:3000`.
- Server middleware:
  - neautorizovany pristup na `/` presmeruje na `/login.html`
  - po loginu jde redirect na `/shell.html?view=index.html`
- shell pak hostuje hlavni performance view a dalsi obrazovky.

## Debug shutdown endpoint

`POST /api/debug/shutdown` je urceny pro lokalni test shutdown flow:
- povolen jen z localhost (`127.0.0.1`/`::1`)
- navic jen s `LED_DEBUG_API=1`

Pouziti:
- automatizovany smoke test teardownu bez zavislosti na OS signalech

## Nejcastejsi provozni problemy

1. Port 3000 je obsazeny:
- vetsinou zustal bezici starsi `node.exe`
- reseni: zavrit launcher okno a znovu spustit launcher (cleanup fallback to ma uklidit)

2. UI nabehne, ale backend neodpovida:
- typicky Node nenastartoval nebo spadl pred otevrenim Edge
- zkontrolovat `launcher.log` a `server.err.log` v rootu projektu

3. Po restartu lag/problik/reconnect issue:
- bez graceful shutdownu zustavaji viset handles
- aktualni shutdown controller zavira WS/HTTP/UDP/serial centralne

