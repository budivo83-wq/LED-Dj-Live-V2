import dgram from "dgram";

export function createBlxUdpSocket() {
  return dgram.createSocket("udp4");
}

export function closeUdpSocket(socket) {
  return new Promise((resolve) => {
    try {
      socket.close(() => resolve());
    } catch {
      resolve();
    }
  });
}
