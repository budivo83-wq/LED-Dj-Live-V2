export function crc16CcittFalse(bytes) {
  let crc = 0xffff;
  for (const byte of bytes || []) {
    crc ^= (byte & 0xff) << 8;
    for (let i = 0; i < 8; i += 1) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc & 0xffff;
}

export function appendCrc16(packetWithoutCrc) {
  const source = packetWithoutCrc instanceof Uint8Array ? packetWithoutCrc : new Uint8Array(0);
  const crc = crc16CcittFalse(source);
  const packet = new Uint8Array(source.length + 2);
  packet.set(source, 0);
  packet[source.length] = crc & 0xff;
  packet[source.length + 1] = (crc >> 8) & 0xff;
  return Object.freeze({ packet, crc });
}

