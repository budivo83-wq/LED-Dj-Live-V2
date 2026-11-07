import { SerialPort } from 'serialport';

export function createBlxSerialTransport(options = {}) {
  const onPacket = typeof options.onPacket === 'function' ? options.onPacket : null;
  const onReceive = typeof options.onReceive === 'function' ? options.onReceive : null;
  const onError = typeof options.onError === 'function' ? options.onError : null;
  const path = String(options.path || options.port || '');
  const baudRate = Math.max(1200, Number(options.baudRate || options.baud || 115200));

  let connected = false;
  let bytesTx = 0;
  let packetsTx = 0;
  let bytesRx = 0;
  let packetsRx = 0;
  let lastError = '';
  let serial = null;

  function setLastError(error) {
    lastError = String(error?.message || error || 'serial_error');
    if (onError) onError(lastError);
  }

  function ensurePort() {
    if (serial) return serial;
    if (!path) {
      setLastError('serial_port_missing');
      return null;
    }
    try {
      serial = new SerialPort({ path, baudRate, autoOpen: false });
      serial.on('data', (chunk) => {
        const bytes = chunk instanceof Uint8Array ? new Uint8Array(chunk) : new Uint8Array(0);
        packetsRx += 1;
        bytesRx += bytes.length;
        if (onReceive) onReceive(bytes);
      });
      serial.on('error', (error) => setLastError(error));
      serial.on('close', () => {
        connected = false;
      });
    } catch (error) {
      setLastError(error);
      serial = null;
    }
    return serial;
  }

  return Object.freeze({
    connect() {
      if (connected) return true;
      const portRef = ensurePort();
      if (!portRef) return false;
      if (portRef.isOpen) {
        connected = true;
        return true;
      }
      portRef.open((error) => {
        if (error) setLastError(error);
      });
      connected = true;
      return true;
    },
    disconnect() {
      try {
        if (serial?.isOpen) serial.close();
      } catch (error) {
        setLastError(error);
      }
      connected = false;
      return true;
    },
    isConnected() {
      return connected && Boolean(serial?.isOpen);
    },
    send(packet) {
      if (!serial?.isOpen) throw new Error('serial_not_connected');
      const bytes = packet instanceof Uint8Array ? packet : new Uint8Array(0);
      packetsTx += 1;
      bytesTx += bytes.length;
      serial.write(Buffer.from(bytes), (error) => {
        if (error) setLastError(error);
      });
      if (onPacket) onPacket(bytes);
      return bytes.length;
    },
    getStats() {
      return Object.freeze({ connected: connected && Boolean(serial?.isOpen), path, baudRate, packetsTx, bytesTx, packetsRx, bytesRx, lastError });
    }
  });
}
