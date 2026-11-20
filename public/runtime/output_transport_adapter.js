// Transport boundary for the output scheduler.
// The scheduler owns timing and back-pressure; adapters own the actual
// transport implementation (Serial, Art-Net, preview or WebSocket).

export const OUTPUT_TRANSPORT_ADAPTER_VERSION = "1.0.0";

export function createOutputTransportAdapter(options = {}) {
  const name = typeof options.name === "string" && options.name.trim()
    ? options.name.trim()
    : "unknown-output-transport";
  const sendFrame = typeof options.sendFrame === "function" ? options.sendFrame : null;

  return Object.freeze({
    version: OUTPUT_TRANSPORT_ADAPTER_VERSION,
    name,
    send(packet) {
      if (!sendFrame) return false;
      sendFrame(packet?.frame, packet);
      return true;
    }
  });
}
