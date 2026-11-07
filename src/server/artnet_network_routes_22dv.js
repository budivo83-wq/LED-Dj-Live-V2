import os from 'node:os';
import dgram from 'node:dgram';

export const STEP22DV_ARTNET_NETWORK_VERSION = 'STEP22DV_ARTNET_NETWORK_INTERFACE_BIND';

function isUsableIPv4(addr) {
  return addr && addr.family === 'IPv4' && !addr.internal && addr.address && addr.address !== '0.0.0.0';
}

export function listArtNetNetworkInterfaces22DV() {
  const nets = os.networkInterfaces();
  const interfaces = [];
  for (const [name, addrs] of Object.entries(nets || {})) {
    for (const addr of addrs || []) {
      if (!isUsableIPv4(addr)) continue;
      interfaces.push({
        name,
        address: addr.address,
        netmask: addr.netmask || '',
        cidr: addr.cidr || '',
        mac: addr.mac || '',
        selectedValue: addr.address,
        artnetHint: addr.address.startsWith('2.') || addr.address.startsWith('10.') || addr.address.startsWith('192.168.') || addr.address.startsWith('172.')
      });
    }
  }
  return interfaces.sort((a, b) => Number(b.artnetHint) - Number(a.artnetHint) || a.name.localeCompare(b.name));
}

export function buildArtNetNetworkPreflight22DV(options = {}) {
  const interfaces = listArtNetNetworkInterfaces22DV();
  const bindIp = String(options.bindIp || options.localAddress || process.env.LED_ARTNET_BIND_IP || '').trim();
  const targetIp = String(options.outputIp || options.host || process.env.LED_ARTNET_TARGET_IP || '2.1.1.30').trim();
  const selected = bindIp ? interfaces.find((it) => it.address === bindIp) || null : null;
  const warnings = [];
  const blocked = [];
  if (!interfaces.length) blocked.push('NO_USABLE_IPV4_INTERFACE_FOUND');
  if (!bindIp) warnings.push('BIND_IP_NOT_SET_WINDOWS_MAY_ROUTE_ARTNET_THROUGH_WRONG_ADAPTER');
  if (bindIp && !selected) blocked.push('BIND_IP_NOT_FOUND_ON_THIS_PC');
  if (!targetIp) blocked.push('ARTNET_TARGET_IP_MISSING');
  if (targetIp === '127.0.0.1' || targetIp === 'localhost') warnings.push('TARGET_IS_LOCALHOST_NOT_REAL_NODE');
  const sameFirstOctet = bindIp && targetIp && bindIp.split('.')[0] === targetIp.split('.')[0];
  if (bindIp && targetIp && !sameFirstOctet && targetIp.startsWith('2.')) warnings.push('TARGET_2_X_X_X_BUT_BIND_IP_IS_DIFFERENT_NETWORK');
  return {
    ok: blocked.length === 0,
    version: STEP22DV_ARTNET_NETWORK_VERSION,
    bindIp,
    targetIp,
    selectedInterface: selected,
    interfaces,
    blocked,
    warnings,
    usage: {
      env: 'LED_ARTNET_BIND_IP=2.1.1.xxx and LED_ARTNET_TARGET_IP=2.1.1.30',
      api: 'POST /api/artnet/sync-live/start { mode:"udp-armed", armed:true, bindIp:"...", outputIp:"..." }'
    }
  };
}

function decodeAscii(bytes) {
  const chars = [];
  for (const b of bytes || []) {
    if (!b) break;
    if (b >= 32 && b <= 126) chars.push(String.fromCharCode(b));
  }
  return chars.join('').trim();
}

function parseArtPollReply(bytes, rinfo = {}) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 64) return null;
  const magic = String.fromCharCode(...bytes.slice(0, 8));
  if (magic !== 'Art-Net\u0000') return null;
  const opCode = bytes[8] | (bytes[9] << 8);
  if (opCode !== 0x2100) return null;
  const port = ((bytes[14] << 8) | bytes[15]) & 0xffff;
  return {
    id: `${rinfo.address || `${bytes[10]}.${bytes[11]}.${bytes[12]}.${bytes[13]}`}:${port || 6454}`,
    host: rinfo.address || `${bytes[10]}.${bytes[11]}.${bytes[12]}.${bytes[13]}`,
    port: port || 6454,
    shortName: decodeAscii(bytes.slice(26, 44)),
    longName: decodeAscii(bytes.slice(44, 108)),
    nodeReport: decodeAscii(bytes.slice(108, 172)),
    universeOut: bytes[172] || 0,
    universeIn: bytes[173] || 0,
    netSwitch: bytes[18] || 0,
    subSwitch: bytes[19] || 0,
    seenAt: Date.now()
  };
}

function buildArtPollPacket() {
  const packet = Buffer.alloc(14);
  packet.set([0x41, 0x72, 0x74, 0x2d, 0x4e, 0x65, 0x74, 0x00], 0);
  packet[8] = 0x00; packet[9] = 0x20; // OpPoll little-endian
  packet[10] = 0x00; packet[11] = 0x0e; // ProtVer 14
  packet[12] = 0x00; packet[13] = 0x00;
  return packet;
}

export function runArtNetPoll22EA(options = {}) {
  const bindIp = String(options.bindIp || options.localAddress || '').trim();
  const targetIp = String(options.outputIp || options.host || options.broadcastIp || '255.255.255.255').trim();
  const timeoutMs = Math.max(250, Math.min(3000, Number(options.timeoutMs || 1200)));
  const port = Math.max(1, Math.min(65535, Number(options.port || 6454)));
  const interfaces = listArtNetNetworkInterfaces22DV();
  const blocked = [];
  if (bindIp && !interfaces.some((it) => it.address === bindIp)) blocked.push('BIND_IP_NOT_FOUND_ON_THIS_PC');
  if (!targetIp) blocked.push('ARTPOLL_TARGET_MISSING');
  if (blocked.length) {
    return Promise.resolve({ ok: false, version: 'STEP22EA_ARTNET_NODE_DISCOVERY_TX_CONFIRM', bindIp, targetIp, port, blocked, replies: [] });
  }
  return new Promise((resolve) => {
    const socket = dgram.createSocket('udp4');
    const replies = new Map();
    let finished = false;
    const finish = (extra = {}) => {
      if (finished) return;
      finished = true;
      try { socket.close(); } catch {}
      resolve({
        ok: true,
        version: 'STEP22EA_ARTNET_NODE_DISCOVERY_TX_CONFIRM',
        bindIp,
        targetIp,
        port,
        timeoutMs,
        sentArtPoll: extra.sentArtPoll === true,
        socketAddress: extra.socketAddress || null,
        replies: Array.from(replies.values()),
        replyCount: replies.size,
        warnings: replies.size ? [] : ['NO_ARTPOLL_REPLY_SEEN_CHECK_TARGET_IP_BIND_IP_FIREWALL_OR_NODE_ARTNET_MODE']
      });
    };
    socket.on('message', (msg, rinfo) => {
      const parsed = parseArtPollReply(new Uint8Array(msg), rinfo);
      if (parsed) replies.set(parsed.id, parsed);
    });
    socket.on('error', (error) => finish({ sentArtPoll: false, error: error.message }));
    socket.on('listening', () => {
      try { socket.setBroadcast(true); } catch {}
      const packet = buildArtPollPacket();
      socket.send(packet, port, targetIp, (error) => {
        if (error) return finish({ sentArtPoll: false, error: error.message });
        setTimeout(() => finish({ sentArtPoll: true, socketAddress: (() => { try { return socket.address(); } catch { return null; } })() }), timeoutMs);
      });
    });
    if (bindIp) socket.bind({ address: bindIp, port: 0, exclusive: false });
    else socket.bind(0);
  });
}

export async function buildArtNetTargetConfirm22EB(options = {}) {
  const bindIp = String(options.bindIp || options.localAddress || '').trim();
  const outputIp = String(options.outputIp || options.host || options.targetIp || '2.1.1.30').trim();
  const port = Math.max(1, Math.min(65535, Number(options.port || 6454)));
  const timeoutMs = Math.max(250, Math.min(3000, Number(options.timeoutMs || 1200)));
  const preflight = buildArtNetNetworkPreflight22DV({ bindIp, outputIp, port });
  const pollTargets = [];
  if (outputIp) pollTargets.push(outputIp);
  if (!pollTargets.includes('255.255.255.255')) pollTargets.push('255.255.255.255');
  const pollResults = [];
  for (const targetIp of pollTargets) {
    // eslint-disable-next-line no-await-in-loop
    pollResults.push(await runArtNetPoll22EA({ bindIp, outputIp: targetIp, port, timeoutMs }));
  }
  const replies = new Map();
  for (const result of pollResults) {
    for (const reply of result.replies || []) replies.set(reply.host, reply);
  }
  const exactNode = replies.get(outputIp) || null;
  const anyReplies = Array.from(replies.values());
  const warnings = [...(preflight.warnings || [])];
  const blocked = [...(preflight.blocked || [])];
  if (!exactNode) warnings.push('TARGET_IP_DID_NOT_REPLY_TO_ARTPOLL');
  if (!anyReplies.length) warnings.push('NO_ARTNET_NODE_REPLIES_SEEN_ON_SELECTED_BIND_IP');
  if (anyReplies.length && !exactNode) warnings.push('ARTNET_NODE_FOUND_BUT_NOT_AT_SELECTED_TARGET_IP');
  return {
    ok: blocked.length === 0 && !!exactNode,
    version: 'STEP22EB_ARTNET_TARGET_CONFIRM_BIND_TX',
    bindIp,
    outputIp,
    port,
    preflight,
    exactNode,
    discoveredNodes: anyReplies,
    discoveredCount: anyReplies.length,
    pollResults: pollResults.map((r) => ({ targetIp: r.targetIp, sentArtPoll: r.sentArtPoll, replyCount: r.replyCount, socketAddress: r.socketAddress || null, warnings: r.warnings || [] })),
    blocked,
    warnings,
    decision: exactNode
      ? 'TARGET_CONFIRMED_BY_ARTPOLL_REPLY_OK_TO_SEND_UDP_TEST'
      : (anyReplies.length ? 'NODE_EXISTS_BUT_TARGET_IP_MISMATCH_CHECK_OUTPUT_IP' : 'NO_NODE_REPLY_CHECK_BIND_IP_FIREWALL_NODE_MODE_OR_CABLE')
  };
}

export function registerArtNetNetworkRoutes22DV(app) {
  app.post('/api/artnet/network/target-confirm', (req, res) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', async () => {
      try {
        const parsed = body ? JSON.parse(body) : {};
        res.json(await buildArtNetTargetConfirm22EB(parsed));
      } catch (error) {
        res.status(400).json({ ok: false, version: 'STEP22EB_ARTNET_TARGET_CONFIRM_BIND_TX', error: error.message });
      }
    });
  });
  app.post('/api/artnet/network/artpoll', (req, res) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', async () => {
      try {
        const parsed = body ? JSON.parse(body) : {};
        res.json(await runArtNetPoll22EA(parsed));
      } catch (error) {
        res.status(400).json({ ok: false, version: 'STEP22EA_ARTNET_NODE_DISCOVERY_TX_CONFIRM', error: error.message });
      }
    });
  });
  app.get('/api/artnet/network/interfaces', (req, res) => {
    res.json({ ok: true, version: STEP22DV_ARTNET_NETWORK_VERSION, interfaces: listArtNetNetworkInterfaces22DV() });
  });
  app.get('/api/artnet/network/preflight', (req, res) => {
    res.json(buildArtNetNetworkPreflight22DV(req.query || {}));
  });
}
