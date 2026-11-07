import http from "http";
import { WebSocketServer } from "ws";

export function createHttpWsTransport(app) {
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });
  return { server, wss };
}

export function closeHttpServer(server) {
  return closeWithCallback((done) => server.close(done));
}

export function closeWebSocketServer(wss) {
  return closeWithCallback((done) => wss.close(done));
}

function closeWithCallback(closer) {
  return new Promise((resolve) => {
    try {
      closer(() => resolve());
    } catch {
      resolve();
    }
  });
}
