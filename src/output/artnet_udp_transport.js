import dgram from "node:dgram";

export function createArtnetUdpTransport(options = {}) {
  const onError = typeof options.onError === "function" ? options.onError : null;
  let targetHost = String(options.host || options.ip || "127.0.0.1");
  let targetPort = Math.max(1, Math.min(65535, Number(options.port || 6454)));
  const bindPort = Number.isInteger(options.bindPort) ? options.bindPort : 0;
  let bindIp = String(options.bindIp || options.localAddress || '').trim();
  let connected = false;
  let socket = null;
  let packetsTx = 0;
  let bytesTx = 0;
  let packetsRx = 0;
  let bytesRx = 0;
  let lastError = "";
  const discovered = new Map();
  let boundReady = false;
  let pendingPolls = 0;
  const sendLog = [];

  function rememberSend(host, port, bytes) {
    sendLog.push(Object.freeze({ at: Date.now(), host: String(host || ''), port: Number(port) || targetPort, bytes: Number(bytes || 0), bindIp, socketAddress: (() => { try { return socket?.address?.() || null; } catch { return null; } })() }));
    while (sendLog.length > 24) sendLog.shift();
  }

  function setError(error) {
    lastError = String(error?.message || error || "artnet_udp_error");
    if (onError) onError(lastError);
  }

  function ensureSocket() {
    if (socket) return socket;
    socket = dgram.createSocket("udp4");
    socket.on("error", setError);
    socket.on("listening", () => {
      boundReady = true;
      try {
        socket.setBroadcast(true);
      } catch (error) {
        setError(error);
      }
      while (pendingPolls > 0) {
        pendingPolls -= 1;
        sendArtPollPacket();
      }
    });
    socket.on("message", (msg, rinfo) => {
      const bytes = msg instanceof Uint8Array ? new Uint8Array(msg) : new Uint8Array(0);
      packetsRx += 1;
      bytesRx += bytes.length;
      const parsed = parseArtPollReply(bytes);
      if (!parsed) return;
      const key = `${rinfo?.address || parsed.ip}:${parsed.port}`;
      discovered.set(key, {
        id: key,
        host: rinfo?.address || parsed.ip,
        port: parsed.port,
        shortName: parsed.shortName,
        longName: parsed.longName,
        oem: parsed.oem,
        status: parsed.status,
        universeIn: parsed.universeIn,
        universeOut: parsed.universeOut,
        netSwitch: parsed.netSwitch,
        subSwitch: parsed.subSwitch,
        seenAt: Date.now()
      });
    });
    return socket;
  }

  function parseArtPollReply(bytes) {
    if (!(bytes instanceof Uint8Array) || bytes.length < 64) return null;
    const magic = String.fromCharCode(...bytes.slice(0, 8));
    if (magic !== "Art-Net\u0000") return null;
    const opCode = bytes[8] | (bytes[9] << 8);
    if (opCode !== 0x2100) return null; // ArtPollReply
    const ip = `${bytes[10]}.${bytes[11]}.${bytes[12]}.${bytes[13]}`;
    const port = ((bytes[14] << 8) | bytes[15]) & 0xffff;
    const oem = ((bytes[20] << 8) | bytes[21]) & 0xffff;
    const status = bytes[23] || 0;
    const netSwitch = bytes[18] || 0;
    const subSwitch = bytes[19] || 0;
    const universeIn = bytes[173] || 0;
    const universeOut = bytes[172] || 0;
    const shortName = decodeAscii(bytes.slice(26, 44));
    const longName = decodeAscii(bytes.slice(44, 108));
    return { ip, port, shortName, longName, oem, status, universeIn, universeOut, netSwitch, subSwitch };
  }

  function decodeAscii(bytes) {
    const chars = [];
    for (const b of bytes) {
      if (!b) break;
      chars.push(String.fromCharCode(b));
    }
    return chars.join("").trim();
  }

  function buildArtPollPacket() {
    const packet = new Uint8Array(14);
    packet.set([0x41, 0x72, 0x74, 0x2d, 0x4e, 0x65, 0x74, 0x00], 0); // Art-Net\0
    packet[8] = 0x00;
    packet[9] = 0x20; // OpPoll
    packet[10] = 0x00;
    packet[11] = 0x0e; // ProtVer 14
    packet[12] = 0x00; // TalkToMe
    packet[13] = 0x00; // Priority
    return packet;
  }

  function sendArtPollPacket() {
    const sock = ensureSocket();
    const packet = buildArtPollPacket();
    try {
      sock.send(packet, 6454, "255.255.255.255", (error) => {
        if (error) setError(error);
      });
      packetsTx += 1;
      bytesTx += packet.length;
      return true;
    } catch (error) {
      setError(error);
      return false;
    }
  }

  return Object.freeze({
    connect() {
      if (connected) return true;
      try {
        const sock = ensureSocket();
        boundReady = false;
        if (bindIp) sock.bind({ address: bindIp, port: bindPort, exclusive: false });
        else sock.bind(bindPort);
        connected = true;
      } catch (error) {
        setError(error);
        connected = false;
      }
      return connected;
    },
    disconnect() {
      try {
        socket?.close?.();
      } catch (error) {
        setError(error);
      }
      socket = null;
      connected = false;
      boundReady = false;
      pendingPolls = 0;
      return true;
    },
    isConnected() {
      return connected;
    },
    send(packet, hostOverride = targetHost, portOverride = targetPort) {
      if (!connected) throw new Error("artnet_udp_not_connected");
      const bytes = packet instanceof Uint8Array ? packet : new Uint8Array(0);
      const sock = ensureSocket();
      // Live fast path: avoid allocating one callback closure for every universe packet.
      // Socket-level 'error' is already handled above; per-packet callbacks are only
      // useful for deep diagnostics and caused visible GC jitter at ArtNet frame rates.
      const sendHost = String(hostOverride || targetHost);
      const sendPort = Number(portOverride) || targetPort;
      sock.send(bytes, sendPort, sendHost);
      rememberSend(sendHost, sendPort, bytes.length);
      packetsTx += 1;
      bytesTx += bytes.length;
      return bytes.length;
    },
    getStats() {
      let socketAddress = null;
      try { socketAddress = socket?.address?.() || null; } catch {}
      return Object.freeze({ connected, host: targetHost, port: targetPort, bindIp, bindPort, boundReady, socketAddress, pendingPolls, packetsTx, bytesTx, packetsRx, bytesRx, discoveredCount: discovered.size, lastError, autoBindWarning: !bindIp && connected ? 'NO_BIND_IP_SOCKET_USES_OS_ROUTE' : '', recentSends: Object.freeze([...sendLog]) });
    },
    setTarget({ host, port, localAddress, bindIp: nextBindIp } = {}) {
      const nextHost = String(host || "").trim();
      const nextPort = Number(port);
      if (nextHost) targetHost = nextHost;
      if (Number.isInteger(nextPort) && nextPort >= 1 && nextPort <= 65535) targetPort = nextPort;
      const requestedBindIp = String(nextBindIp || localAddress || '').trim();
      if (requestedBindIp && requestedBindIp !== bindIp) {
        bindIp = requestedBindIp;
        if (connected) {
          try { socket?.close?.(); } catch (error) { setError(error); }
          socket = null;
          connected = false;
          boundReady = false;
          pendingPolls = 0;
        }
      }
      return Object.freeze({ host: targetHost, port: targetPort, bindIp });
    },
    broadcastPoll() {
      if (!connected) this.connect();
      if (!boundReady) {
        pendingPolls += 1;
        return true;
      }
      return sendArtPollPacket();
    },
    getDiscoveredNodes(maxAgeMs = 30000) {
      const now = Date.now();
      const list = [];
      for (const [key, value] of discovered.entries()) {
        if (now - value.seenAt > maxAgeMs) {
          discovered.delete(key);
          continue;
        }
        list.push({ ...value });
      }
      return Object.freeze(list);
    }
  });
}
