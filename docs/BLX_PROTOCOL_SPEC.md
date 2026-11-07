# BLX Protocol Specification

Status: FINAL for BLX-Lite + BLX-v1 baseline, EXTENDED roadmap for BLX-v2+
Last updated: 2026-05-26

## 1. Scope

This document defines BLX protocol family and staged evolution:

- BLX-Lite (stable Arduino serial)
- BLX-v1 Serial (stable framed serial)
- BLX-v2 UDP (extended network + distributed features)

Target pipeline:

Performance renderer -> FrameBus -> OutputManager -> BLXOutput -> serial/udp -> node

## 2. Protocol Versioning

- BLX-Lite is versionless and identified by first byte `0xAA`.
- BLX-v1 uses `MAGIC="BX"` and `VERSION=0x01`.
- BLX-v2 uses `MAGIC="BX"` and `VERSION=0x02`.
- Receiver on version mismatch:
  - MUST reject packet (`ERR_VERSION_UNSUPPORTED`)
  - SHOULD keep transport alive (no hard reset)

Compatibility policy:

- Wire-incompatible header/layout changes require a major version.
- New packet types may be added if unsupported types are safely rejected.
- Capability negotiation (v2) is authoritative for optional features.

## 3. BLX-Lite (Frozen)

### 3.1 Purpose

Minimal stable mode for Arduino-class receivers and quick diagnostics.

### 3.2 Wire format

`0xAA + BRIGHTNESS(1) + RGBRGBRGB...`

- `0xAA` start marker
- `BRIGHTNESS` in `0..255`
- RGB payload, 3 bytes per pixel
- no frame id, no CRC

### 3.3 Fixed pixel targets

- 40 px: `122` bytes/frame (`1 + 1 + 120`)
- 60 px: `182` bytes/frame (`1 + 1 + 180`)

### 3.4 Timeout and fallback

- frame timeout: `250 ms`
- default fallback: `BLACKOUT`
- optional fallback: `HOLD_LAST`
- reconnect resumes on first valid full frame

## 4. BLX-v1 Serial (Stable Baseline)

### 4.1 Header

`MAGIC(2) + VERSION(1) + TYPE(1) + FLAGS(2) + SEQ(4) + NODE_ID(2) + CHANNEL(1) + LENGTH(2) + PAYLOAD(N) + CRC16(2)`

- `MAGIC`: `0x42 0x58` (`B`,`X`)
- `VERSION`: `0x01`
- `CRC16`: CCITT-FALSE over `VERSION..PAYLOAD` (MAGIC excluded)

### 4.2 CRC profile

- Poly `0x1021`
- Init `0xFFFF`
- RefIn/RefOut false
- XorOut `0x0000`

### 4.3 Packet types (minimum)

- `0x10` PIXEL_FRAME
- `0x20` SYNC
- `0x40` STATUS_REQUEST
- `0x41` STATUS_REPLY
- `0x50` ACK
- `0x51` NACK
- `0x60` ERROR

### 4.4 QoS flags (v1 FLAGS)

`FLAGS` bitmask (`uint16`):

- bit0 `REQUIRE_ACK`
- bit1 `IMPORTANT`
- bit2 `COMPRESSED`
- bit3 `DELTA`
- bit4 `FRAME_START`
- bit5 `FRAME_END`
- bit6 `LOW_LATENCY`
- bit7 `TELEMETRY_REPLY`

Guidance:

- control/preset packets SHOULD use `REQUIRE_ACK`
- high-rate frame packets SHOULD default to no ACK

### 4.5 Payload formats (v1)

#### PIXEL_FRAME (`0x10`)

`FRAME_ID(4 LE) + PIXEL_COUNT(2 LE) + COLOR_ORDER(1) + BRIGHTNESS(1) + RGB_BYTES(PIXEL_COUNT*3)`

#### SYNC (`0x20`)

`FRAME_ID(4 LE) + DEADLINE_MS(2 LE)`

#### STATUS_REQUEST (`0x40`)

`REQUEST_ID(2 LE)`

#### STATUS_REPLY (`0x41`)

`REQUEST_ID(2 LE) + STATUS_CODE(2 LE) + NODE_UPTIME_MS(4 LE) + TEMP_C_X10(2 LE) + VIN_MV(2 LE) + FALLBACK_STATE(1) + RX_FPS(1) + DROPPED_FRAMES(2 LE)`

Extended watchdog metrics (BLX 1.1):

`RX_BUFFER_USAGE(1) + CPU_LOAD(1) + SERIAL_OVERFLOW(2 LE) + WATCHDOG_RESETS(2 LE) + LAST_PACKET_AGE_MS(2 LE) + FREE_RAM(4 LE)`

### 4.6 Sequence, timeout, fallback

- sender increments `SEQ`
- receiver tracks last `SEQ` per `(NODE_ID, CHANNEL)`
- duplicate `SEQ` MAY ACK but MUST NOT reapply frame
- stale/invalid order SHOULD return NACK `ERR_SEQ_STALE`

Default timing:

- ACK timeout `30 ms`
- resend `2`
- link idle timeout `250 ms`
- status reply timeout `100 ms`

Fallback states:

- `0` NORMAL
- `1` HOLD_LAST
- `2` BLACKOUT
- `3` TEST_PATTERN

## 5. BLX-v2 UDP (Extended)

### 5.1 Capability system

New packets:

- `0x03` CAPABILITY_REQUEST
- `0x04` CAPABILITY_REPLY

Payload:

`CAP_FLAGS uint32`

Capability bits:

- bit0 RGB
- bit1 GRB
- bit2 DELTA
- bit3 SEGMENT
- bit4 TELEMETRY
- bit5 PRESET
- bit6 TEMP
- bit7 VOLTAGE
- bit8 SERIAL
- bit9 UDP
- bit10 ETH
- bit11 HOLD_LAST
- bit12 TEST_PATTERN

### 5.2 Packet types

Core:

- `0x01` HELLO
- `0x02` HELLO_REPLY
- `0x03` CAPABILITY_REQUEST
- `0x04` CAPABILITY_REPLY

Pixel/control:

- `0x11` PIXEL_SEGMENT
- `0x12` PIXEL_DELTA
- `0x13` PIXEL_FILL
- `0x14` PIXEL_COMPRESSED

Timing/group:

- `0x22` CLOCK_MASTER
- `0x23` CLOCK_REPLY
- `0x24` NODE_GROUP_ASSIGN

Config/preset/runtime:

- `0x31` PARAM_UPDATE
- `0x32` PRESET_TRIGGER
- `0x33` CONFIG_READ
- `0x34` CONFIG_WRITE
- `0x35` SHADER_PARAM
- `0x36` FAILOVER_TARGET

### 5.3 Clock sync (multi-node)

- `0x22` CLOCK_MASTER
- `0x23` CLOCK_REPLY

Clock payload:

`MASTER_TIME_US uint64 + LOCAL_TIME_US uint64 + OFFSET_US int32`

Goal:

- frame-perfect sync
- drift reduction for larger installs

### 5.4 Delta threshold engine

`PIXEL_DELTA` mode adds `DELTA_THRESHOLD`.

Rule:

- if channel delta `< DELTA_THRESHOLD`, sender SHOULD skip pixel update

Typical value:

- `DELTA_THRESHOLD=3`

### 5.5 Compressed frame

`0x14 PIXEL_COMPRESSED`

Payload:

`FRAME_ID + PIXEL_COUNT + CODEC + DATA`

`CODEC`:

- `0` RAW
- `1` RLE
- `2` DELTA_RLE

### 5.6 Node groups

`0x24 NODE_GROUP_ASSIGN`

Payload:

`NODE_ID + GROUP_ID`

Group-targeted sync/control is allowed (example: ceiling/stage/bar grouping).

### 5.7 Remote config

- `0x33 CONFIG_READ`
- `0x34 CONFIG_WRITE`

Config payload:

`PIXEL_COUNT + BRIGHTNESS_LIMIT + FPS_CAP + COLOR_ORDER + FALLBACK_MODE`

### 5.8 Shader mode

`0x35 SHADER_PARAM`

Payload:

`ANIM_ID + P1 + P2 + P3 + P4 + TIME`

Node renders locally from shader params instead of full pixel stream.

### 5.9 Failover target

`0x36 FAILOVER_TARGET`

Allows primary/backup route metadata for node-side failover handling.

### 5.10 Discovery broadcast

UDP broadcast target:

- `255.255.255.255`

Discovery flow:

- HELLO: `BLX_NODE`
- reply includes: `NODE_ID`, `FW_VERSION`, `CAP_FLAGS`, `PIXEL_COUNT`, `IP`, `FPS`

## 6. Status and Error Codes

Status (`uint16`):

- `0x0000` OK
- `0x0001` ACCEPTED
- `0x0002` APPLIED
- `0x0003` QUEUED
- `0x0010` FALLBACK_ACTIVE
- `0x0011` ARMED
- `0x0012` DISARMED
- `0x0013` BUSY

Error (`uint16`):

- `0x1001` ERR_MAGIC
- `0x1002` ERR_VERSION_UNSUPPORTED
- `0x1003` ERR_TYPE_UNSUPPORTED
- `0x1004` ERR_LENGTH
- `0x1005` ERR_CRC
- `0x1006` ERR_SEQ_STALE
- `0x1007` ERR_SEQ_GAP
- `0x1008` ERR_NODE_ID
- `0x1009` ERR_CHANNEL
- `0x100A` ERR_TIMEOUT
- `0x100B` ERR_NOT_ARMED
- `0x100C` ERR_OVERFLOW
- `0x100D` ERR_INTERNAL

## 7. Runtime Requirements

BLX runtime MUST support:

- enable/disable per protocol
- FPS limiter
- latest-only queue
- backpressure guard
- brightness limiter
- emergency blackout

Priority queue classes:

- `0` CRITICAL
- `1` CONTROL
- `2` FRAME
- `3` TELEMETRY

Overload policy:

- drop TELEMETRY first
- never drop SYNC-class critical timing packets

## 8. JS Module Structure

`src/output/blx/`

- `blx_constants.js`
- `blx_crc.js`
- `blx_packet_builder.js`
- `blx_packet_parser.js`
- `blx_serial_transport.js`
- `blx_udp_transport.js`
- `blx_mapping.js`

## 9. Firmware Targets

BLX-Lite:

- `arduino/blx_lite_40px_receiver.ino`
- `arduino/blx_lite_60px_receiver.ino`

BLX-v1/v2:

- `firmware/teensy_blx_v1_receiver/`
- `firmware/esp32_blx_udp_node/` (planned)
- `firmware/teensy_eth_blx_node/` (planned)

## 10. Validation Scenarios

Mandatory baseline:

- BLX-Lite 40 px serial
- BLX-Lite 60 px serial
- BLX-v1 serial single frame
- BLX-v1 serial 20 FPS
- BLX-v1 serial 60 FPS (Teensy)
- disconnect/reconnect without server restart
- bad CRC / broken frame / bad packet type
- fallback timeout
- blackout
- brightness limiter
- burn-in 30 min + 2 h

Extended:

- capability negotiation matrix (Arduino/Teensy)
- clock offset stability drift test
- delta threshold throughput benchmark
- compressed payload ratio benchmark
- priority queue overload behavior
- discovery and group routing test

## 11. Versioned Roadmap

### BLX 1.1

- capability negotiation
- watchdog metrics extension
- QoS flags
- config write/read

### BLX 1.2

- delta threshold engine
- compressed frame codecs
- runtime priority queue

### BLX 2.0

- discovery broadcast
- node groups
- clock sync
- shader mode

### BLX 3.0

- local node render as primary path
- distributed rendering across nodes
- failover routing orchestration
