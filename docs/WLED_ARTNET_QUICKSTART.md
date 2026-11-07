# WLED Art-Net Quickstart (LED Dj)

Last updated: 2026-05-26

## Goal

Run WLED reliably over Wi-Fi using Art-Net and verify that LED Dj is really sending UDP frames.

## 1) WLED setup

1. Open WLED web UI.
2. Go to `Config -> Sync Interfaces`.
3. Set realtime input mode to `Art-Net`.
4. Save and reboot WLED.
5. In `Config -> LED Preferences`, verify:
   - correct LED count
   - correct color order (often `GRB` for WS2812B)

## 2) LED Dj setup

1. Open `settings.html`.
2. In `OUTPUT ROUTING`, set `MODE = ART-NET`.
3. In `ART-NET / sACN`:
   - `TARGET IP` = WLED IP
   - `UNIVERSE = 0`
   - `NET = 0`
   - `SUBNET = 0`
4. Click `ARTNET START`.
5. Click `VALIDATE TARGET`.
6. Click `SEND RED`, `SEND GREEN`, `SEND BLUE`, `SEND BLACKOUT`.

## 3) How to verify data is really leaving LED Dj

Use the Art-Net status line in settings:

- expected: `ARTNET RUNNING`
- expected: `target <ip>:6454`
- expected: `tx <N> / <bytes>` where `N` increases after every send/test

If `tx` does not increase, output is not being sent from app.
If `tx` increases but WLED does not react, issue is network/firewall/WLED sync mode.

## 4) Discovery note (important)

`ARTNET DISCOVERY` / `nodes 0` is not a hard failure.
Some routers/APs block ArtPoll reply broadcast behavior.
Unicast send to `TARGET IP` can still work perfectly.

## 5) Common failure checklist

1. Wrong WLED mode (not Art-Net in Sync Interfaces).
2. Wrong target IP.
3. Different subnet or Guest Wi-Fi isolation.
4. Host firewall blocking UDP 6454.
5. Universe mismatch between sender and WLED expectation.
6. Mapping not routed to `artnet`.

## 6) Minimal smoke test

1. `ARTNET START`
2. `SEND RED`
3. `SEND GREEN`
4. `SEND BLUE`
5. `SEND BLACKOUT`

Pass criteria:
- status stays `RUNNING`
- `tx` counter increases after each send
- LEDs change accordingly.
