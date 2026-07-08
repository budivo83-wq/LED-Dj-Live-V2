import { createOutputAdapterBase } from '../base.js';
import { buildArtSyncPacket, resolveUniverseMap, splitRgbByUniverseMap } from '../../artnet_core.js';
import { createArtnetUdpTransport } from '../../artnet_udp_transport.js';

export function createArtnetOutputAdapter(options = {}) {
  const base = createOutputAdapterBase('artnet', {
    fpsLimit: options.fpsLimit || 44,
    reconnectMs: options.reconnectMs || 1000,
    maxQueue: options.maxQueue || 6
  });
  const onPacket = typeof options.onPacket === 'function' ? options.onPacket : null;
  const universeMap = resolveUniverseMap(options);
  const includeArtSync = options.artSync !== false;
  let targetHost = String(options.host || options.targetIp || '127.0.0.1');
  let targetPort = Number(options.port || options.targetPort || 6454) || 6454;
  const transport = createArtnetUdpTransport({
    host: targetHost,
    port: targetPort,
    bindPort: options.bindPort,
    onError: () => {}
  });

  let sequence = 1;
  let packetsTx = 0;
  let bytesTx = 0;
  let lastUniverseCount = 0;
  let lastError = '';

  function sendArtnet(frame) {
    const rgb = frame?.frame || frame?.payload || [];
    const packets = splitRgbByUniverseMap({
      rgb,
      universeMap,
      sequence,
      physical: options.physical ?? 0
    });
    sequence = (sequence + 1) & 0xff;

    const fullPacketList = includeArtSync ? [...packets, buildArtSyncPacket()] : packets;
    packetsTx += fullPacketList.length;
    bytesTx += fullPacketList.reduce((sum, packet) => sum + Number(packet?.packetBytes || 0), 0);
    lastUniverseCount = packets.length;

    if (onPacket) {
      for (const packet of fullPacketList) onPacket(packet);
    }
    for (const packet of fullPacketList) {
      try {
        transport.send(packet.packet, packet.outputIp || targetHost, packet.port || targetPort);
      } catch (error) {
        lastError = String(error?.message || error || 'artnet_send_failed');
      }
    }
  }

  return {
    ...base,
    start() {
      transport.connect();
      return base.start();
    },
    stop() {
      transport.disconnect();
      return base.stop();
    },
    processOne() {
      base.processOne(sendArtnet);
    },
    discoverNodes() {
      return typeof transport.broadcastPoll === 'function' ? transport.broadcastPoll() : false;
    },
    getDiscoveredNodes(maxAgeMs = 30000) {
      return typeof transport.getDiscoveredNodes === 'function' ? transport.getDiscoveredNodes(maxAgeMs) : [];
    },
    setTarget({ host, port } = {}) {
      const nextHost = String(host || '').trim();
      const nextPort = Number(port);
      if (nextHost) targetHost = nextHost;
      if (Number.isInteger(nextPort) && nextPort >= 1 && nextPort <= 65535) targetPort = nextPort;
      if (typeof transport.setTarget === 'function') transport.setTarget({ host: targetHost, port: targetPort });
      return { host: targetHost, port: targetPort };
    },
    getStatus() {
      const status = base.getStatus();
      return {
        ...status,
        packetsTx,
        bytesTx,
        universeCount: universeMap.universeCount,
        lastUniverseCount,
        artSync: includeArtSync,
        sequence,
        lastError,
        transport: transport.getStats()
      };
    }
  };
}
