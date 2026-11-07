export function registerRuntimeHooks({
  server,
  blxUdp,
  shutdown,
  logger = console
} = {}) {
  server.on("clientError", (error, socket) => {
    logger.warn("HTTP client error:", error?.message || error);
    try { socket?.end("HTTP/1.1 400 Bad Request\r\n\r\n"); } catch {}
  });

  blxUdp.on("error", (error) => {
    logger.error("BLX UDP error:", error);
    shutdown("udp:error");
  });
}
