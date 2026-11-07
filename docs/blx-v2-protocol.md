# BLX V2 Protocol (Sender Spec)

## Frame Envelope

All packets use a common envelope:

`MAGIC(2) | VER(1) | TYPE(1) | FLAGS(1) | SEQ(2 LE) | LEN(2 LE) | PAYLOAD(N) | CRC16(2 LE)`

- `MAGIC`: `0x42 0x58` (`B`,`X`)
- `VER`: `0x02`
- `TYPE`: command id `0x01..0x0F`
- `FLAGS`: bit flags, currently:
  - `0x01` = ACK required
- `SEQ`: sender packet sequence (wraps at `65535`)
- `LEN`: payload byte length
- `CRC16`: CRC-16/CCITT-FALSE over `VER..PAYLOAD` (header magic excluded)

## Types

- `0x01 FRAME_FULL`
- `0x02 FRAME_PARTIAL`
- `0x03 FRAME_DELTA`
- `0x04 CONFIG_SET`
- `0x05 CONFIG_GET`
- `0x06 CONFIG_REPLY`
- `0x07 PING`
- `0x08 PONG`
- `0x09 ACK`
- `0x0A ERROR`
- `0x0B SYNC`
- `0x0C BLACKOUT`
- `0x0D BRIGHTNESS`
- `0x0E IDENTIFY`
- `0x0F CAPABILITIES`

## Implemented Sender Payloads (reference)

## `FRAME_FULL (0x01)`

Payload:

`frameId(4 LE) | segmentCount(1) | segments...`

Each segment:

`segmentId(1) | pixelCount(2 LE) | rgb(pixelCount*3)`

Notes:
- segment can have a different pixel count
- RGB byte order is `R,G,B`

## `BLACKOUT (0x0C)`

Payload:

`enabled(1)` where `0=off`, `1=on`

## `BRIGHTNESS (0x0D)`

Payload:

`brightness(2 LE)` in range `0..1000` (maps to `0.0..1.0`)

## `PING (0x07)`

Payload:

`timestampMs(4 LE)`

## `ACK (0x09)`

Payload:

`ackSeq(2 LE)`

## `CONFIG_GET (0x05)`

Payload: empty

## `CONFIG_SET (0x04)` (minimal runtime subset)

Payload:

`fps(2 LE) | master(2 LE, 0..1000) | blackout(1)`

## Sender Module

Reference implementation is in:

- `public/blx_sender_v2.js`

Main API:

- `createBlxV2Sender(options?)`
- `sender.pack(type, payload?, flags?, forcedSeq?)`
- `sender.buildFrameFullPacket(frameId, segments, flags?)`
- `sender.buildBlackoutPacket(enabled, flags?)`
- `sender.buildBrightnessPacket(brightness01, flags?)`
- `sender.buildPingPacket(timestampMs?, flags?)`
- `sender.buildAckPacket(ackSeq, flags?)`
- `sender.buildConfigGetPacket(flags?)`
- `sender.buildConfigSetPacket(config?, flags?)`

## Example

```js
import { createBlxV2Sender, BLX_V2_FLAGS } from "./blx_sender_v2.js";

const sender = createBlxV2Sender();

const segment0 = new Uint8Array([255, 0, 0, 0, 255, 0]); // 2 px
const segment1 = new Uint8Array([0, 0, 255]); // 1 px

const { packet } = sender.buildFrameFullPacket(
  1,
  [
    { segmentId: 0, pixels: segment0 },
    { segmentId: 7, pixels: segment1 }
  ],
  BLX_V2_FLAGS.ACK_REQUIRED
);
```

