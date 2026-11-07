import { RAW_SERIAL_PACKET_FORMAT, RAW_SERIAL_PACKET_LABEL, inspectRawSerialAaLen16RgbPacket, expectedRawSerialPacketBytes as expectedPacketBytesShared } from './raw_serial_contract_22cb.js';

function nowMs() {
  return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
}

function n(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clampInt(value, min, max, fallback) {
  const parsed = Math.floor(n(value, fallback));
  return Math.max(min, Math.min(max, parsed));
}

function safeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

export function expectedRawSerialPacketBytes(pixelCount = 160) {
  return expectedPacketBytesShared(pixelCount);
}

export function inspectRawSerialPacket(packetLike, expectedPixels = 160) {
  return inspectRawSerialAaLen16RgbPacket(packetLike, expectedPixels);
}

export function createFrameInspector22E(options = {}) {
  const startedAt = nowMs();
  let inputFrames = 0;
  let renderFrames = 0;
  let outputFrames = 0;
  let droppedFrames = 0;
  let lastInputAt = 0;
  let lastRenderAt = 0;
  let lastOutputAt = 0;
  let lastFrameSize = 0;
  let lastPixelCount = clampInt(options.expectedPixels, 1, 2400, 160);
  let lastPacketInspection = inspectRawSerialPacket(Buffer.alloc(0), lastPixelCount);
  let lastFrameId = 0;

  function fps(count) {
    const elapsed = Math.max(1, nowMs() - startedAt) / 1000;
    return Math.round((count / elapsed) * 10) / 10;
  }

  function observeInput(frame = {}) {
    inputFrames += 1;
    lastInputAt = nowMs();
    lastFrameId = n(frame.frameId, lastFrameId);
    return getSnapshot();
  }

  function observeRender(frame = {}) {
    renderFrames += 1;
    lastRenderAt = nowMs();
    lastFrameId = n(frame.frameId, lastFrameId);
    const rgb = frame.frame || frame.payload || frame.rgb || frame.data || [];
    lastFrameSize = Buffer.isBuffer(rgb) || rgb instanceof Uint8Array || Array.isArray(rgb) ? rgb.length : 0;
    lastPixelCount = clampInt(frame.pixels ?? frame.pixelCount ?? frame.meta?.pixels ?? Math.ceil(lastFrameSize / 3), 1, 2400, lastPixelCount);
    return getSnapshot();
  }

  function observeOutput(result = {}, frame = {}) {
    outputFrames += result?.ok === false ? 0 : 1;
    droppedFrames += result?.ok === false ? 1 : 0;
    lastOutputAt = nowMs();
    lastFrameId = n(frame.frameId, lastFrameId);
    return getSnapshot();
  }

  function observePacket(packet, expectedPixels = lastPixelCount) {
    lastPacketInspection = inspectRawSerialPacket(packet, expectedPixels);
    lastOutputAt = nowMs();
    return lastPacketInspection;
  }

  function getSnapshot(managerStatus = {}) {
    const status = safeObject(managerStatus);
    const adapters = safeObject(status.adapters);
    const serial = safeObject(adapters.serial);
    const artnet = safeObject(adapters.artnet);
    const ageInput = lastInputAt ? Math.round(nowMs() - lastInputAt) : null;
    const ageRender = lastRenderAt ? Math.round(nowMs() - lastRenderAt) : null;
    const ageOutput = lastOutputAt ? Math.round(nowMs() - lastOutputAt) : null;

    return {
      ok: true,
      version: 'STEP22E_FRAME_INSPECTOR_OUTPUT_DIAGNOSTICS',
      uptimeMs: Math.round(nowMs() - startedAt),
      frame: {
        lastFrameId,
        inputFrames,
        renderFrames,
        outputFrames,
        droppedFrames,
        inputFps: fps(inputFrames),
        renderFps: fps(renderFrames),
        outputFps: fps(outputFrames),
        lastFrameSize,
        lastPixelCount,
        lastInputAgeMs: ageInput,
        lastRenderAgeMs: ageRender,
        lastOutputAgeMs: ageOutput
      },
      output: {
        profile: status.profile || 'unknown',
        active: status.active || 'unknown',
        started: status.started === true,
        managerPushed: n(status.pushed),
        managerDropped: n(status.dropped),
        managerDecision: status.lastDecision || '',
        queueDepth: n(serial.queueDepth) + n(artnet.queueDepth),
        adapters
      },
      serial: {
        protocol: serial.protocol || RAW_SERIAL_PACKET_FORMAT,
        packetLabel: serial.packetLabel || RAW_SERIAL_PACKET_LABEL,
        writerReady: serial.writerReady === true,
        packetsTx: n(serial.packetsTx),
        bytesTx: n(serial.bytesTx),
        lastPacketBytes: n(serial.lastPacketBytes),
        lastPixelCount: n(serial.lastPixelCount),
        lastFirstBytes: serial.lastFirstBytes || '',
        lastError: serial.lastError || ''
      },
      packet: lastPacketInspection,
      receiverHints: buildReceiverHints(lastPacketInspection, serial, status)
    };
  }

  return {
    observeInput,
    observeRender,
    observeOutput,
    observePacket,
    getSnapshot
  };
}

export function buildReceiverHints(packetInspection = {}, serialStatus = {}, managerStatus = {}) {
  const hints = [];
  if (managerStatus.active && managerStatus.active !== 'serial') hints.push(`Active output is ${managerStatus.active}, RAW serial receiver will not see frames.`);
  if (serialStatus.writerReady === false) hints.push('Serial writer is not ready/open. Connect COM port first.');
  if (packetInspection.errors?.includes('BAD_START_BYTE')) hints.push('Receiver expects 0xAA as the first byte.');
  if (packetInspection.errors?.includes('PIXEL_COUNT_MISMATCH')) hints.push(`Receiver and sender pixel counts differ: declared ${packetInspection.declaredPixels}, expected ${packetInspection.expectedPixels}.`);
  if (packetInspection.errors?.includes('PAYLOAD_LENGTH_MISMATCH')) hints.push('Payload byte count does not match declared LEN16 * 3.');
  if (!hints.length) hints.push('RAW serial contract looks consistent: 0xAA + LEN16 + RGB.');
  return hints;
}
