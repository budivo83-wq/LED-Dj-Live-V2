import {
  buildLiteFrame,
  buildPixelFrame,
  buildCapabilityRequest,
  buildClockMaster,
  buildClockReply,
  buildConfigRead,
  buildConfigWrite,
  buildPixelCompressed,
  buildShaderParam,
  buildFailoverTarget
} from '../../blx/blx_packet_builder.js';
import { parsePacket } from '../../blx/blx_packet_parser.js';
import { BLX_PRIORITY_CLASS } from '../../blx/blx_constants.js';
import { createBlxSerialTransport } from '../../blx/blx_serial_transport.js';
import { createBlxUdpTransport } from '../../blx/blx_udp_transport.js';

function nowMs() {
  return typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();
}

function normalizePriority(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return BLX_PRIORITY_CLASS.FRAME;
  return Math.max(BLX_PRIORITY_CLASS.CRITICAL, Math.min(BLX_PRIORITY_CLASS.TELEMETRY, Math.floor(n)));
}

export function createBlxOutputAdapter(options = {}) {
  const mode = String(options.mode || 'v1').toLowerCase();
  const fpsLimit = Math.max(1, Number(options.fpsLimit || 30));
  const minFrameGapMs = 1000 / fpsLimit;
  const maxQueue = Math.max(8, Number(options.maxQueue || 64));
  const transportKind = String(options.transport || (mode === 'v2' ? 'udp' : 'serial')).toLowerCase();

  const queues = [[], [], [], []];
  let running = false;
  let connected = false;
  let seq = 0;
  let dropped = 0;
  let sent = 0;
  let bytesTx = 0;
  let packetsTx = 0;
  let packetsRx = 0;
  let bytesRx = 0;
  let crcErrors = 0;
  let parseErrors = 0;
  let seqGaps = 0;
  let lastRxSeq = null;
  let lastSendAt = 0;
  let lastPacketType = '';
  let lastError = '';
  let lastCapabilityFlags = 0;

  const transport = transportKind === 'udp'
    ? createBlxUdpTransport({
      host: options.host || options.targetIp || '127.0.0.1',
      port: options.port || options.targetPort || 9001,
      bindPort: options.bindPort,
      broadcast: options.broadcast,
      onReceive: handleReceive,
      onError: (err) => { lastError = String(err || 'udp_error'); }
    })
    : createBlxSerialTransport({
      path: options.path || options.serialPort || options.port,
      baudRate: options.baudRate || options.baud || 115200,
      onReceive: handleReceive,
      onError: (err) => { lastError = String(err || 'serial_error'); }
    });

  function queueDepth() {
    return queues[0].length + queues[1].length + queues[2].length + queues[3].length;
  }

  function dropOneForBackpressure() {
    // Drop telemetry first, then frame. Never auto-drop critical/control.
    if (queues[BLX_PRIORITY_CLASS.TELEMETRY].length > 0) {
      queues[BLX_PRIORITY_CLASS.TELEMETRY].shift();
      dropped += 1;
      return true;
    }
    if (queues[BLX_PRIORITY_CLASS.FRAME].length > 0) {
      queues[BLX_PRIORITY_CLASS.FRAME].shift();
      dropped += 1;
      return true;
    }
    return false;
  }

  function enqueue(entry, priority = BLX_PRIORITY_CLASS.FRAME) {
    const p = normalizePriority(priority);
    queues[p].push({ packetObject: entry, priority: p });
    while (queueDepth() > maxQueue) {
      if (!dropOneForBackpressure()) break;
    }
  }

  function dequeue() {
    for (let p = BLX_PRIORITY_CLASS.CRITICAL; p <= BLX_PRIORITY_CLASS.TELEMETRY; p += 1) {
      const item = queues[p].shift();
      if (item) return item;
    }
    return null;
  }

  function handleReceive(packet) {
    const bytes = packet instanceof Uint8Array ? packet : new Uint8Array(0);
    packetsRx += 1;
    bytesRx += bytes.length;
    const parsed = parsePacket(bytes);
    if (!parsed.ok) {
      parseErrors += 1;
      if (parsed.error === 'ERR_CRC') crcErrors += 1;
      return;
    }
    if (lastRxSeq != null && parsed.seq > lastRxSeq + 1) seqGaps += 1;
    lastRxSeq = parsed.seq;
    if (parsed.type === 0x04 && parsed.length >= 4) {
      lastCapabilityFlags = (parsed.payload[0] | (parsed.payload[1] << 8) | (parsed.payload[2] << 16) | (parsed.payload[3] << 24)) >>> 0;
    }
  }

  function nextSeq32() {
    const value = seq >>> 0;
    seq = (seq + 1) >>> 0;
    return value;
  }

  function nextSeq16() {
    const value = seq & 0xffff;
    seq = (seq + 1) >>> 0;
    return value;
  }

  function frameToPacket(frame) {
    const rgb = frame?.frame || frame?.payload || [];
    const brightness = options.brightness ?? frame?.meta?.brightness ?? 255;
    const pixelCount = options.pixelCount ?? null;
    if (mode === 'lite') {
      return buildLiteFrame({ rgb, brightness, pixelCount });
    }
    return buildPixelFrame({
      seq: nextSeq32(),
      nodeId: options.nodeId ?? 1,
      channel: options.channel ?? 0,
      frameId: Number(frame?.frameId || 0),
      brightness,
      pixelCount,
      colorOrder: options.colorOrder ?? 0,
      rgb,
      flags: options.frameFlags ?? 0
    });
  }

  function sendPacketObject(packetObject) {
    const payload = packetObject?.packet instanceof Uint8Array ? packetObject.packet : new Uint8Array(0);
    transport.send(payload);
    sent += 1;
    packetsTx += 1;
    bytesTx += payload.length;
    lastPacketType = String(packetObject?.protocol || 'blx');
    lastSendAt = nowMs();
  }

  function processOne() {
    if (!running || !connected) return;
    const now = nowMs();
    const item = dequeue();
    if (!item) return;
    if (item.priority >= BLX_PRIORITY_CLASS.FRAME && now - lastSendAt < minFrameGapMs) {
      enqueue(item.packetObject, item.priority);
      return;
    }
    try {
      sendPacketObject(item.packetObject);
    } catch (error) {
      lastError = String(error?.message || error || 'send_failed');
      connected = false;
    }
  }

  function start() {
    running = true;
    connected = transport.connect();
    if (connected && mode === 'v2') {
      enqueue(buildCapabilityRequest({ seq: nextSeq16() }), BLX_PRIORITY_CLASS.CONTROL);
    }
  }

  function stop() {
    running = false;
    connected = false;
    transport.disconnect();
    queues.forEach((queue) => { queue.length = 0; });
  }

  function pushFrame(frame) {
    if (!running) return false;
    enqueue(frameToPacket(frame), BLX_PRIORITY_CLASS.FRAME);
    return true;
  }

  function requestCapabilities() {
    enqueue(buildCapabilityRequest({ seq: nextSeq16() }), BLX_PRIORITY_CLASS.CONTROL);
    return true;
  }

  function requestConfig() {
    enqueue(buildConfigRead({ seq: nextSeq16() }), BLX_PRIORITY_CLASS.CONTROL);
    return true;
  }

  function writeConfig(payload = {}) {
    enqueue(buildConfigWrite({ seq: nextSeq16(), ...payload }), BLX_PRIORITY_CLASS.CONTROL);
    return true;
  }

  function sendClockMaster(masterTimeUs = 0n) {
    enqueue(buildClockMaster({ seq: nextSeq16(), masterTimeUs }), BLX_PRIORITY_CLASS.CRITICAL);
    return true;
  }

  function sendClockReply(payload = {}) {
    enqueue(buildClockReply({ seq: nextSeq16(), ...payload }), BLX_PRIORITY_CLASS.CRITICAL);
    return true;
  }

  function sendCompressedFrame(payload = {}) {
    enqueue(buildPixelCompressed({ seq: nextSeq16(), ...payload }), BLX_PRIORITY_CLASS.FRAME);
    return true;
  }

  function sendShaderParam(payload = {}) {
    enqueue(buildShaderParam({ seq: nextSeq16(), ...payload }), BLX_PRIORITY_CLASS.CONTROL);
    return true;
  }

  function sendFailoverTarget(payload = {}) {
    enqueue(buildFailoverTarget({ seq: nextSeq16(), ...payload }), BLX_PRIORITY_CLASS.CONTROL);
    return true;
  }

  function broadcastDiscovery(nodeName = 'BLX_NODE') {
    if (typeof transport.broadcastHello !== 'function') return false;
    return transport.broadcastHello(nodeName);
  }

  function getDiscoveredNodes(maxAgeMs = 30000) {
    if (typeof transport.getDiscoveredNodes !== 'function') return [];
    return transport.getDiscoveredNodes(maxAgeMs);
  }

  return Object.freeze({
    id: 'blx',
    start,
    stop,
    pushFrame,
    processOne,
    requestCapabilities,
    requestConfig,
    writeConfig,
    sendClockMaster,
    sendClockReply,
    sendCompressedFrame,
    sendShaderParam,
    sendFailoverTarget,
    broadcastDiscovery,
    getDiscoveredNodes,
    getStatus() {
      return {
        id: 'blx',
        running,
        connected: connected && transport.isConnected(),
        mode,
        transportKind,
        fpsLimit,
        queueDepth: queueDepth(),
        sent,
        dropped,
        packetsTx,
        bytesTx,
        packetsRx,
        bytesRx,
        crcErrors,
        parseErrors,
        seqGaps,
        lastRxSeq,
        lastPacketType,
        lastCapabilityFlags,
        lastSendAt,
        lastError,
        transport: transport.getStats()
      };
    }
  });
}
