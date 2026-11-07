import dgram from 'node:dgram';

export function createBlxUdpTransport(options = {}) {
  const onPacket = typeof options.onPacket === 'function' ? options.onPacket : null;
  const onReceive = typeof options.onReceive === 'function' ? options.onReceive : null;
  const onError = typeof options.onError === 'function' ? options.onError : null;
  const host = String(options.host || options.ip || '127.0.0.1');
  const port = Math.max(1, Math.min(65535, Number(options.port || 9001)));
  const bindPort = Number.isInteger(options.bindPort) ? options.bindPort : 0;
  const discoveryPort = Math.max(1, Math.min(65535, Number(options.discoveryPort || port)));

  let connected = false;
  let bytesTx = 0;
  let packetsTx = 0;
  let bytesRx = 0;
  let packetsRx = 0;
  let lastError = '';
  let socket = null;
  let discoveryEnabled = false;
  const discovered = new Map();

  function parseDiscoveryText(text = "") {
    const raw = String(text || "").trim();
    if (!raw.startsWith("BLX_NODE")) return null;
    const parts = raw.split(/[;,\s]+/g).filter(Boolean);
    const info = {
      tag: "BLX_NODE",
      nodeId: null,
      fwVersion: "",
      capabilities: null,
      pixelCount: null,
      ip: "",
      fps: null
    };
    for (const part of parts) {
      const idx = part.indexOf("=");
      if (idx <= 0) continue;
      const key = part.slice(0, idx).trim().toUpperCase();
      const value = part.slice(idx + 1).trim();
      if (key === "NODE_ID") info.nodeId = Number(value);
      else if (key === "FW" || key === "FW_VERSION") info.fwVersion = value;
      else if (key === "CAPS" || key === "CAP_FLAGS") info.capabilities = Number(value);
      else if (key === "PIXELS" || key === "PIXEL_COUNT") info.pixelCount = Number(value);
      else if (key === "IP") info.ip = value;
      else if (key === "FPS") info.fps = Number(value);
    }
    return info;
  }

  function setLastError(error) {
    lastError = String(error?.message || error || 'udp_error');
    if (onError) onError(lastError);
  }

  function ensureSocket() {
    if (socket) return socket;
    try {
      socket = dgram.createSocket('udp4');
      socket.on('message', (message, rinfo) => {
        const bytes = message instanceof Uint8Array ? new Uint8Array(message) : new Uint8Array(0);
        packetsRx += 1;
        bytesRx += bytes.length;
        if (bytes.length >= 8) {
          const text = new TextDecoder().decode(bytes);
          if (text.startsWith('BLX_NODE')) {
            discoveryEnabled = true;
            const parsed = parseDiscoveryText(text);
            discovered.set(`${rinfo?.address || 'unknown'}:${rinfo?.port || 0}`, {
              host: rinfo?.address || '',
              port: Number(rinfo?.port || 0),
              at: Date.now(),
              text,
              parsed
            });
          }
        }
        if (onReceive) onReceive(bytes, rinfo);
      });
      socket.on('error', (error) => setLastError(error));
    } catch (error) {
      setLastError(error);
      socket = null;
    }
    return socket;
  }

  return Object.freeze({
    connect() {
      if (connected) return true;
      const sock = ensureSocket();
      if (!sock) return false;
      try {
        sock.bind(bindPort);
        if (options.broadcast === true) sock.setBroadcast(true);
      } catch (error) {
        setLastError(error);
      }
      connected = true;
      return true;
    },
    disconnect() {
      try {
        socket?.close?.();
      } catch (error) {
        setLastError(error);
      }
      socket = null;
      connected = false;
      return true;
    },
    isConnected() {
      return connected;
    },
    send(packet) {
      if (!connected) throw new Error('udp_not_connected');
      const bytes = packet instanceof Uint8Array ? packet : new Uint8Array(0);
      const sock = ensureSocket();
      if (!sock) throw new Error(lastError || 'udp_socket_unavailable');
      packetsTx += 1;
      bytesTx += bytes.length;
      sock.send(bytes, port, host, (error) => {
        if (error) setLastError(error);
      });
      if (onPacket) onPacket(bytes);
      return bytes.length;
    },
    getStats() {
      return Object.freeze({
        connected,
        host,
        port,
        bindPort,
        discoveryPort,
        discoveryEnabled,
        discoveredCount: discovered.size,
        packetsTx,
        bytesTx,
        packetsRx,
        bytesRx,
        lastError
      });
    },
    broadcastHello(nodeName = 'BLX_NODE') {
      const sock = ensureSocket();
      if (!sock) return false;
      try {
        sock.setBroadcast(true);
        const payload = Buffer.from(String(nodeName || 'BLX_NODE'), 'utf8');
        sock.send(payload, discoveryPort, '255.255.255.255', (error) => {
          if (error) setLastError(error);
        });
        return true;
      } catch (error) {
        setLastError(error);
        return false;
      }
    },
    getDiscoveredNodes(maxAgeMs = 30000) {
      const now = Date.now();
      const list = [];
      for (const [key, item] of discovered.entries()) {
        if (now - item.at > maxAgeMs) {
          discovered.delete(key);
          continue;
        }
        list.push({ ...item });
      }
      return Object.freeze(list);
    }
  });
}
