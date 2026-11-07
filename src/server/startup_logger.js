import os from "os";

export function startServerWithLogs(server, { port, host = "0.0.0.0", logger = console } = {}) {
  const url = `http://localhost:${port}/`;
  server.listen(port, host, () => {
    logger.log(url);
    for (const adapter of Object.values(os.networkInterfaces()).flat()) {
      if (adapter?.family === "IPv4" && !adapter.internal) {
        logger.log(`http://${adapter.address}:${port}/`);
      }
    }
    // Browser launch is handled externally; avoid opening a second fullscreen window.
  });
}
