import { WebSocket } from "ws";
import { serverOutputRegistry37BC } from "./server_output_registry_37bc.js";
import { classifyAaLen16RgbPayload } from "./aa_len16_guard.js";

const OUTPUT_REPLAY_INTERVAL_MS = 16;
const OUTPUT_REPLAY_STALL_MS = 120;
const OUTPUT_REPLAY_TARGET_MS = 33;
const OUTPUT_REPLAY_MAX_AGE_MS = 2500;
const LEGACY_OUTPUT_LOCKDOWN_REASON = "legacy_output_locked_by_11T";
const SAFE_BLX_LOCKDOWN_ENABLED = String(process.env.LED_ALLOW_SAFE_BLX_IN_LOCKDOWN || "1") !== "0";
const SAFE_AA_VARIABLE_LENGTH_ENABLED = String(process.env.LED_SAFE_AA_VARIABLE_LENGTH || "0") === "1";
const SAFE_AA_PIXELS = Math.max(1, Math.min(2400, Number.parseInt(process.env.LED_SAFE_AA_PIXELS || process.env.LED_SIMPLE_AA_PIXELS || "160", 10) || 160));
const SAFE_AA_EXPECTED_BYTES = 3 + SAFE_AA_PIXELS * 3;
const STEP37BC_SERIAL_WS_OWNER = "serial-ws-safe-aa";


export function attachWsController({
  wss,
  isAuthenticated,
  getState,
  setState,
  saveState,
  parseBlxPacket,
  onBlxSerial,
  onBlxNet,
  onSerial,
  logger = console,
  legacyOutputEnabled = false,
  artnetMasterFrameStore = null,
  onMasterFrameWs = null
} = {}) {
  let latestOutputPacket = null;
  let latestOutputPacketAt = 0;
  let latestOutputPacketCopied = false;
  let pendingStateSaveTimer = null;
  let pendingStateSave = null;
  let latestReplayAt = 0;
  let replayTimer = null;
  let replayCount = 0;
  let legacyOutputBlockedCount = 0;
  let legacyOutputLastBlockedSource = null;
  let safeAaAllowedCount = 0;
  let safeAaRejectedLengthCount = 0;
  let safeAaLastRejectedBytes = 0;
  let safeBlxSerialAllowedCount = 0;
  let safeBlxNetAllowedCount = 0;
  let safeBlxRejectedCount = 0;
  let masterFrameWsAcceptedCount = 0;
  let masterFrameWsRejectedCount = 0;
  let masterFrameWsLastAt = 0;
  let masterFrameWsLastError = null;
  let volatileCommandRelayCount37BR = 0;
  let volatileCommandPatchRelayCount37BR = 0;
  let persistentCommandPatchCount37BR = 0;
  let updatePatchCount37BR = 0;
  const MASTER_FRAME_WS_MAGIC = Buffer.from("MF22");
  const reusableMasterFrameLatest = {};

  function routeMasterFrameWsPacket(msg) {
    if (!artnetMasterFrameStore || !Buffer.isBuffer(msg)) return false;
    if (msg.length < 24) return false;
    if (msg[0] !== MASTER_FRAME_WS_MAGIC[0] || msg[1] !== MASTER_FRAME_WS_MAGIC[1] || msg[2] !== MASTER_FRAME_WS_MAGIC[2] || msg[3] !== MASTER_FRAME_WS_MAGIC[3]) return false;
    try {
      const frameId = msg.readUInt32LE(4);
      const width = msg.readUInt16LE(8);
      const height = msg.readUInt16LE(10);
      const stripCount = msg.readUInt16LE(12);
      const pixelsPerStrip = msg.readUInt16LE(14);
      const formatCode = msg.readUInt8(16);
      const colorOrderCode = msg.readUInt8(17);
      const frameBytes = msg.readUInt32LE(20);
      const frameStart = 24;
      const frameEnd = frameStart + frameBytes;
      if (!frameBytes || frameEnd > msg.length || frameBytes > 16 * 1024 * 1024) throw new Error(`bad-master-frame-ws-length:${frameBytes}/${msg.length}`);
      // Use a zero-copy view into the WS message for the immediate ArtNet path.
      // The master store may still keep the frame for status/fallback, but the
      // live sender no longer pays a second getLatest()/normalize pass before
      // sending the just-arrived frame.
      const frame = msg.subarray(frameStart, frameEnd);
      const resolvedStripCount = Math.max(1, Math.min(64, stripCount || height || 8));
      const resolvedPixelsPerStrip = Math.max(1, Math.min(1000, pixelsPerStrip || width || 300));
      const resolvedWidth = Math.max(1, width || pixelsPerStrip || 300);
      const resolvedHeight = Math.max(1, height || stripCount || 8);
      const now = Date.now();
      const expectedFrameBytes = resolvedStripCount * resolvedPixelsPerStrip * 3;
      const publishResult = (artnetMasterFrameStore.publishFast || artnetMasterFrameStore.publish)({
        frame,
        source: "performance-framebus-artnet-master-ws",
        frameId,
        stripCount: resolvedStripCount,
        pixelsPerStrip: resolvedPixelsPerStrip,
        width: resolvedWidth,
        height: resolvedHeight,
        format: "rgb8",
        colorOrder: "rgb"
      });
      if (publishResult?.dropped === true || publishResult?.accepted === false) {
        masterFrameWsRejectedCount += 1;
        masterFrameWsLastAt = now;
        masterFrameWsLastError = String(publishResult.reason || 'master-frame-ws-suppressed-by-active-owner');
        return true;
      }
      // STEP37AH: direct WS->ArtNet trigger is synchronous. Reuse this envelope
      // object each frame and only replace its frame reference/metadata. This
      // removes another high-frequency allocation source in the 60 FPS path.
      const latest = reusableMasterFrameLatest;
      latest.ok = true;
      latest.frame = frame;
      latest.frameId = frameId;
      latest.source = "performance-framebus-artnet-master-ws-direct";
      latest.format = "rgb8";
      latest.colorOrder = "rgb";
      latest.width = resolvedWidth;
      latest.height = resolvedHeight;
      latest.stripCount = resolvedStripCount;
      latest.pixelsPerStrip = resolvedPixelsPerStrip;
      latest.byteLength = frame.byteLength;
      latest.sourceBytes = frame.byteLength;
      latest.expectedBytes = expectedFrameBytes;
      latest.adapted = frame.byteLength !== expectedFrameBytes;
      latest.ageMs = 0;
      latest.publishedAt = now;
      latest.artnetPatch = artnetMasterFrameStore.getLatestPatch?.() || null;
      if (typeof onMasterFrameWs === "function") {
        try { onMasterFrameWs({ frameId, publishResult, latest, ageMs: 0 }); }
        catch (error) { logger.warn?.("Master-frame WS live trigger failed", error?.message || error); }
      }
      masterFrameWsAcceptedCount += 1;
      masterFrameWsLastAt = now;
      masterFrameWsLastError = null;
      return true;
    } catch (error) {
      masterFrameWsRejectedCount += 1;
      masterFrameWsLastError = String(error?.message || error || "master-frame-ws-rejected");
      logger.warn?.("Master frame WS packet rejected", masterFrameWsLastError);
      return true;
    }
  }

  function routeBinaryOutputPacket(msg, source = "live") {
    if (!Buffer.isBuffer(msg) || msg.length < 5) return false;
    if (!legacyOutputEnabled) {
      // STEP22BY: allow only the locked operator serial packet while the old
      // legacy binary output remains blocked: 0xAA + LEN16_PIXELS_LE + RGB...
      const safeAaCheck = classifySafeAaBrightnessSerialPayload(msg);
      if (safeAaCheck.ok) {
        const routeWrite = serverOutputRegistry37BC.canWrite({ owner: STEP37BC_SERIAL_WS_OWNER, kind: "serial-aa-len16" });
        if (!routeWrite.allowed) {
          legacyOutputBlockedCount += 1;
          legacyOutputLastBlockedSource = `${source}:server-route-denied:${routeWrite.activeOwner || "unknown"}`;
          logger.warn?.(`Safe AA serial payload blocked by server output route registry: active=${routeWrite.activeOwner || "none"}`);
          return false;
        }
        safeAaAllowedCount += 1;
        onSerial(msg);
        return true;
      }
      if (msg?.[0] === 0xAA && safeAaCheck.reason !== "BAD_MAGIC") {
        safeAaRejectedLengthCount += 1;
        safeAaLastRejectedBytes = msg.length;
        legacyOutputBlockedCount += 1;
        legacyOutputLastBlockedSource = `${source}:aa-len16-reject:${safeAaCheck.reason}:${msg.length}`;
        logger.warn?.(`AA_LEN16 serial payload blocked: ${safeAaCheck.reason} actual=${msg.length}B expected=${safeAaCheck.expectedBytes || SAFE_AA_EXPECTED_BYTES}B pixels=${safeAaCheck.lenPixels || safeAaCheck.expectedPixels || SAFE_AA_PIXELS}`);
        return false;
      }

      // STEP 13AO: BLX V2 was accidentally still blocked by the 11T legacy
      // lockdown.  BLX serial frames are not the old uncontrolled legacy
      // protocol; they are framed packets with magic/version/type/len/crc.
      // We allow only validated FRAME_FULL packets under a byte ceiling.
      if (SAFE_BLX_LOCKDOWN_ENABLED && isSafeBlxV2SerialPayload(msg)) {
        safeBlxSerialAllowedCount += 1;
        onBlxSerial(msg);
        return true;
      }

      // STEP 13AO: BLX NET is wrapped as "BLX" transport tunnel.  Validate
      // wrapper + inner BLX V2 payload before forwarding to UDP.
      const safeBlxNet = SAFE_BLX_LOCKDOWN_ENABLED ? parseSafeBlxNetTunnel(msg, parseBlxPacket) : null;
      if (safeBlxNet) {
        safeBlxNetAllowedCount += 1;
        onBlxNet(safeBlxNet.packet, safeBlxNet.blx);
        return true;
      }

      if (msg?.[0] === 0x42 && (msg?.[1] === 0x58 || msg?.[1] === 0x4c)) safeBlxRejectedCount += 1;
      legacyOutputBlockedCount += 1;
      legacyOutputLastBlockedSource = source;
      logger.warn?.(`Legacy binary output blocked by 11T lockdown (${source})`);
      return false;
    }

    const blx = parseBlxPacket(msg);
    if (blx?.transport === 1) {
      onBlxSerial(msg);
      return true;
    }

    if (blx?.transport === 2) {
      const packet = msg.subarray(0, Math.max(0, msg.length - 2));
      onBlxNet(packet, blx);
      return true;
    }

    onSerial(msg);
    return true;
  }

  function rememberOutputPacket(msg) {
    // STEP37AG: the replay loop is only useful while the old legacy binary
    // output path is explicitly enabled. In the locked/master-frame ArtNet
    // runtime it created a permanent 16 ms server timer that woke the event
    // loop for no useful work and could add micro-jitter beside UDP output.
    if (!legacyOutputEnabled) return;
    // Keep the live packet as a zero-copy reference. Only copy it lazily if the
    // replay path actually needs to reuse it after an output stall. This removes
    // one Buffer allocation from every normal live packet.
    latestOutputPacket = msg;
    latestOutputPacketCopied = false;
    latestOutputPacketAt = Date.now();
    ensureOutputReplayTimer();
  }

  function getReplayOutputPacket() {
    if (!latestOutputPacket) return null;
    if (!latestOutputPacketCopied) {
      latestOutputPacket = Buffer.from(latestOutputPacket);
      latestOutputPacketCopied = true;
    }
    return latestOutputPacket;
  }

  function isPlainObject(value) {
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
  }

  function cloneJson(value) {
    if (value == null) return value;
    if (typeof structuredClone === "function") {
      try { return structuredClone(value); } catch {}
    }
    return JSON.parse(JSON.stringify(value));
  }

  function clonePatchBranch(value) {
    if (value == null || typeof value !== "object") return value;
    if (Array.isArray(value)) return value.map(clonePatchBranch);
    const out = {};
    Object.entries(value).forEach(([key, child]) => { out[key] = clonePatchBranch(child); });
    return out;
  }

  function mergeStatePatch(base, patch) {
    // STEP37CW: patch merge without cloning the whole app state for every slider/transport
    // command. Only the touched branches are copied; unchanged branches keep their reference.
    // The final sanitizeState(nextState) below still gives the server its durable plain clone.
    if (!isPlainObject(patch)) return cloneJson(base || {});
    const source = isPlainObject(base) ? base : {};
    const out = { ...source };
    Object.entries(patch).forEach(([key, value]) => {
      if (isPlainObject(value) && isPlainObject(source[key])) out[key] = mergeStatePatch(source[key], value);
      else out[key] = clonePatchBranch(value);
    });
    return out;
  }

  function scheduleStateSave(nextState) {
    pendingStateSave = nextState;
    if (pendingStateSaveTimer) clearTimeout(pendingStateSaveTimer);
    pendingStateSaveTimer = setTimeout(() => {
      const stateToSave = pendingStateSave;
      pendingStateSave = null;
      pendingStateSaveTimer = null;
      if (stateToSave) saveState(stateToSave);
    }, Math.max(250, Number(process.env.LED_STATE_SAVE_IDLE_MS || 400)));
    pendingStateSaveTimer.unref?.();
  }

  function ensureOutputReplayTimer() {
    if (!legacyOutputEnabled) return;
    if (replayTimer) return;
    replayTimer = setInterval(() => {
      if (!latestOutputPacket) return;
      const now = Date.now();
      const age = now - latestOutputPacketAt;
      if (age < OUTPUT_REPLAY_STALL_MS) return;
      if (age > OUTPUT_REPLAY_MAX_AGE_MS) return;
      if (now - latestReplayAt < OUTPUT_REPLAY_TARGET_MS) return;
      latestReplayAt = now;
      replayCount += 1;
      try {
        const replayPacket = getReplayOutputPacket();
        if (replayPacket) routeBinaryOutputPacket(replayPacket, "server-replay");
      } catch (error) {
        logger.warn?.("Output replay failed", error?.message || error);
      }
    }, OUTPUT_REPLAY_INTERVAL_MS);
    replayTimer.unref?.();
  }

  wss.on("connection", (ws, req) => {
    if (!isAuthenticated(req)) {
      ws.close(1008, "unauthorized");
      return;
    }

    ws.send(serializeStateMessage("init", getState()));

    ws.on("message", (msg, isBinary) => {
      if (isBinary) {
        if (routeMasterFrameWsPacket(msg)) return;
        if (routeBinaryOutputPacket(msg, "live")) rememberOutputPacket(msg);
        return;
      }

      let data;
      try {
        data = JSON.parse(typeof msg === "string" ? msg : msg.toString("utf8"));
      } catch {
        return;
      }

      if (!["update", "command"].includes(data?.type)) return;
      const command = data.type === "command" && isPlainObject(data.command) ? data.command : null;
      const commandPatch = isPlainObject(command?.patch) ? command.patch : (isPlainObject(data.patch) ? data.patch : null);
      const commandPersist = command?.persist !== false && data.persist !== false;
      const hasPatch = isPlainObject(commandPatch);
      const hasState = data.type === "update" && isPlainObject(data.state);
      if (!hasPatch && !hasState) {
        if (data.type === "command" && command) {
          const kind = String(command.kind || "command");
          const relayMessage = JSON.stringify({
            type: "command",
            command: {
              kind,
              payload: isPlainObject(command.payload) ? command.payload : {},
              persist: false,
              reason: String(command.reason || data.reason || kind)
            }
          });
          volatileCommandRelayCount37BR += 1;
          wss.clients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) client.send(relayMessage);
          });
        }
        return;
      }

      const commandKind = String(command?.kind || "state-patch");
      const cleanPatch = hasPatch ? sanitizeState(commandPatch) : null;

      // STEP37BR: volatile command patches are relayed, not merged into the
      // server's durable state. This keeps high-rate live-param / sequencer
      // traffic out of sanitize+setState+saveState. The client keeps a
      // separate persisted baseline, so the final persist:true commit still
      // sends the last value for durable save.
      if (data.type === "command" && hasPatch && !commandPersist) {
        volatileCommandPatchRelayCount37BR += 1;
        const relayMessage = JSON.stringify({
          type: "command",
          command: {
            kind: commandKind,
            patch: cleanPatch,
            persist: false,
            volatile: true,
            reason: String(command?.reason || data.reason || commandKind)
          }
        });
        wss.clients.forEach((client) => {
          if (client !== ws && client.readyState === WebSocket.OPEN) client.send(relayMessage);
        });
        return;
      }

      const nextState = sanitizeState(hasPatch ? mergeStatePatch(getState(), cleanPatch) : data.state);
      setState(nextState);
      if (data.type !== "command" || commandPersist) scheduleStateSave(nextState);
      if (data.type === "command") persistentCommandPatchCount37BR += 1;
      else updatePatchCount37BR += 1;
      const updateMessage = data.type === "command" && hasPatch
        ? JSON.stringify({
            type: "command",
            command: {
              kind: commandKind,
              patch: cleanPatch,
              persist: commandPersist,
              reason: String(command?.reason || data.reason || "command")
            }
          })
        : (hasPatch
            ? JSON.stringify({ type: "update", patch: cleanPatch })
            : serializeStateMessage("update", nextState));

      wss.clients.forEach((client) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(updateMessage);
        }
      });
    });
  });

  wss.on("close", () => {
    if (replayTimer) clearInterval(replayTimer);
    if (pendingStateSaveTimer) clearTimeout(pendingStateSaveTimer);
    if (pendingStateSave) saveState(pendingStateSave);
    replayTimer = null;
    pendingStateSaveTimer = null;
    pendingStateSave = null;
  });

  wss.on("error", (error) => {
    logger.error("WebSocket server error:", error);
  });

  return {
    getOutputReplayStatus: () => ({
      active: Boolean(replayTimer),
      hasPacket: Boolean(latestOutputPacket),
      lastPacketAgeMs: latestOutputPacketAt ? Math.max(0, Date.now() - latestOutputPacketAt) : 0,
      replayCount,
      legacyOutputEnabled: Boolean(legacyOutputEnabled),
      legacyOutputLocked: !legacyOutputEnabled,
      legacyOutputBlockedCount,
      legacyOutputLastBlockedSource,
      legacyOutputLockReason: legacyOutputEnabled ? null : LEGACY_OUTPUT_LOCKDOWN_REASON,
      wsCommandBus37BR: {
        volatileCommandRelayCount: volatileCommandRelayCount37BR,
        volatileCommandPatchRelayCount: volatileCommandPatchRelayCount37BR,
        persistentCommandPatchCount: persistentCommandPatchCount37BR,
        updatePatchCount: updatePatchCount37BR
      },
      safeAaAllowedCount,
      safeAaRejectedLengthCount,
      safeAaLastRejectedBytes,
      safeAaExpectedBytes: SAFE_AA_EXPECTED_BYTES,
      safeAaPixels: SAFE_AA_PIXELS,
      safeAaProtocol: "AA_LEN16_PIXELS_LE_RGB",
      safeAaVariableLengthEnabled: SAFE_AA_VARIABLE_LENGTH_ENABLED,
      safeBlxSerialAllowedCount,
      safeBlxNetAllowedCount,
      safeBlxRejectedCount,
      safeBlxLockdownEnabled: SAFE_BLX_LOCKDOWN_ENABLED,
      masterFrameWsAcceptedCount,
      masterFrameWsRejectedCount,
      masterFrameWsLastAgeMs: masterFrameWsLastAt ? Math.max(0, Date.now() - masterFrameWsLastAt) : null,
      masterFrameWsLastError
    })
  };
}

function sanitizeState(nextState) {
  const input = nextState && typeof nextState === "object" ? nextState : {};
  if (typeof structuredClone === "function") {
    try {
      return structuredClone(input);
    } catch {
      // Fall through to the JSON-safe clone for legacy/plain-object state.
    }
  }
  return JSON.parse(JSON.stringify(input));
}

function serializeStateMessage(type, state) {
  return JSON.stringify({ type, state });
}


export function classifySafeAaBrightnessSerialPayload(msg) {
  return classifyAaLen16RgbPayload(msg, {
    variableLengthEnabled: SAFE_AA_VARIABLE_LENGTH_ENABLED,
    expectedPixels: SAFE_AA_PIXELS,
    maxPixels: 2400
  });
}


function isSafeAaBrightnessSerialPayload(msg) {
  return classifySafeAaBrightnessSerialPayload(msg).ok;
}


function readLe16(buffer, offset) {
  if (!Buffer.isBuffer(buffer) || offset < 0 || offset + 1 >= buffer.length) return null;
  return buffer[offset] | (buffer[offset + 1] << 8);
}

function crc16CcittFalse(buffer, offset = 0, length = buffer.length - offset) {
  let crc = 0xffff;
  for (let i = 0; i < length; i += 1) {
    crc ^= buffer[offset + i] << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc & 0xffff;
}

function isSafeBlxV2SerialPayload(msg) {
  if (!Buffer.isBuffer(msg)) return false;
  // BX + version/type/flags/seq/len + payload + crc
  if (msg.length < 11 || msg.length > 65535) return false;
  if (msg[0] !== 0x42 || msg[1] !== 0x58) return false; // "BX"
  if (msg[2] !== 0x02) return false; // BLX V2
  if (msg[3] !== 0x01) return false; // FRAME_FULL only for live output
  const payloadLen = readLe16(msg, 7);
  if (payloadLen == null) return false;
  if (msg.length !== 9 + payloadLen + 2) return false;
  if (payloadLen < 5) return false;
  const segmentCount = msg[13] || 0; // payload starts at 9, segment count is payload[4]
  if (segmentCount > 64) return false;
  const expectedCrc = readLe16(msg, 9 + payloadLen);
  if (expectedCrc == null) return false;
  const actualCrc = crc16CcittFalse(msg, 2, 7 + payloadLen);
  return actualCrc === expectedCrc;
}

function parseSafeBlxNetTunnel(msg, parseBlxPacket) {
  const blx = parseBlxPacket?.(msg) || null;
  if (!blx || blx.transport !== 2) return null;
  if (!Number.isFinite(blx.port) || blx.port < 1 || blx.port > 65535) return null;
  const targetLen = msg[6] | 0;
  const payloadStart = 7 + targetLen;
  const payloadEnd = Math.max(payloadStart, msg.length - 2);
  const packet = msg.subarray(0, payloadEnd);
  const inner = packet.subarray(payloadStart);
  if (!isSafeBlxV2SerialPayload(inner)) return null;
  return { blx, packet };
}
