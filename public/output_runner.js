import { createOutputBus } from "./runtime/output_bus.js";

const bus = createOutputBus();
const runnerFrame = document.getElementById("outputRunnerFrame");
let lastFrameAt = 0;
let lastTelemetryRelayAt = 0;
let lastFrameDetail = null;
let lastRunnerReadyAt = 0;
let lastHeartbeatAt = 0;

const TELEMETRY_RELAY_MS = 250;
const HEARTBEAT_MS = 1000;
const RUNNER_SRC = "index.html?headless=1";

function managedRunnerInterval37CG(name, fn, baseMs, opts = {}) {
  try {
    const reg = window.__budilightRuntimeLoopRegistry37CE;
    if (reg && typeof reg.adaptiveInterval === "function") {
      return reg.adaptiveInterval(name, fn, baseMs, Object.assign({ group: "output-runner", critical: false, liveFactor: 2, hiddenFactor: 3, maxMs: 5000 }, opts || {}));
    }
  } catch {}
  return window.setInterval(fn, Math.max(1, Number(baseMs) || 1));
}


bootRunnerFrame();
bindBus();
bindHostRelay();
startHeartbeat();

function bootRunnerFrame() {
  if (!runnerFrame) return;
  runnerFrame.src = RUNNER_SRC;
  window.addEventListener("message", handleRunnerMessage);
}

function bindBus() {
  bus?.subscribe((message) => {
    if (!message || typeof message !== "object") return;
    if (message.type === "led-power" || message.type === "led-state-sync") {
      forwardToFrame(message);
    }
  });
}

function bindHostRelay() {
  window.addEventListener("message", (event) => {
    if (event.source !== window.parent) return;
    const message = event.data;
    if (!message || typeof message !== "object") return;
    if (message.type !== "led-power" && message.type !== "led-state-sync") return;
    forwardToFrame(message);
    bus?.post(message);
  });
}

function handleRunnerMessage(event) {
  if (event.source !== runnerFrame?.contentWindow) return;
  const message = event.data;
  if (!message || typeof message !== "object") return;

  if (message.type === "led-runner-loading" || message.type === "led-runner-ready") {
    if (message.type === "led-runner-ready") lastRunnerReadyAt = performance.now();
    relayToParent(message);
    return;
  }

  if (message.type !== "led-output-frame") return;

  lastFrameAt = performance.now();
  lastFrameDetail = message.detail && typeof message.detail === "object" ? message.detail : null;
  if (lastFrameAt - lastTelemetryRelayAt < TELEMETRY_RELAY_MS) return;
  lastTelemetryRelayAt = lastFrameAt;
  bus?.post(message);
  relayToParent(message);
}

function startHeartbeat() {
  managedRunnerInterval37CG('output-runner:heartbeat', () => {
    const now = performance.now();
    lastHeartbeatAt = now;
    const hasFrame = lastFrameAt > 0;
    const detail = {
      at: now,
      source: "output-runner",
      childLoaded: Boolean(runnerFrame?.contentWindow),
      runnerReady: lastRunnerReadyAt > 0,
      runnerReadyAgeMs: lastRunnerReadyAt > 0 ? Math.max(0, Math.round(now - lastRunnerReadyAt)) : null,
      hasFrame,
      lastFrameAgeMs: hasFrame ? Math.max(0, Math.round(now - lastFrameAt)) : null,
      outputEnabled: lastFrameDetail?.enabled === true,
      outputMode: typeof lastFrameDetail?.outputMode === "string" ? lastFrameDetail.outputMode : null,
      serialEnabled: lastFrameDetail?.serial === true,
      relaySilenceMs: lastTelemetryRelayAt > 0 ? Math.max(0, Math.round(now - lastTelemetryRelayAt)) : null
    };
    window.__ledOutputRunnerStatus = detail;
    relayToParent({ type: "led-runner-heartbeat", detail });
  }, HEARTBEAT_MS, { liveFactor: 2, hiddenFactor: 3, maxMs: 5000 });
}

function forwardToFrame(message) {
  try {
    runnerFrame?.contentWindow?.postMessage(message, "*");
  } catch {
    // ignore transient runner reload races
  }
}

function relayToParent(message) {
  try {
    window.parent?.postMessage(message, "*");
  } catch {
    // ignore parent messaging failures
  }
}
