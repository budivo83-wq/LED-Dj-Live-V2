export const SHELL_MESSAGE_ACTIONS = Object.freeze({
  UI_NAVIGATE: "ui:navigate",
  UI_LOADING: "ui:loading",
  UI_READY: "ui:ready",
  UI_RELAY_TO_RUNNER: "ui:relay-to-runner",
  UI_IGNORE: "ui:ignore",
  RUNNER_LOADING: "runner:loading",
  RUNNER_READY: "runner:ready",
  RUNNER_HEARTBEAT: "runner:heartbeat",
  RUNNER_OUTPUT_FRAME: "runner:output-frame",
  RUNNER_IGNORE: "runner:ignore"
});

const UI_RELAY_TYPES = Object.freeze(["led-state-sync", "led-power"]);

export function classifyShellMessageSource({ source, uiWindow, runnerWindow }) {
  if (source === uiWindow) return "ui";
  if (source === runnerWindow) return "runner";
  return "unknown";
}

export function classifyShellMessage({ source, data, uiWindow, runnerWindow }) {
  const origin = classifyShellMessageSource({ source, uiWindow, runnerWindow });
  if (!data || typeof data !== "object") {
    return { origin, action: origin === "runner" ? SHELL_MESSAGE_ACTIONS.RUNNER_IGNORE : SHELL_MESSAGE_ACTIONS.UI_IGNORE };
  }

  if (origin === "ui") {
    return classifyUiMessage(data);
  }
  if (origin === "runner") {
    return classifyRunnerMessage(data);
  }
  return { origin, action: SHELL_MESSAGE_ACTIONS.UI_IGNORE };
}

export function classifyUiMessage(message) {
  if (message.type === "led-shell-navigate") {
    return { origin: "ui", action: SHELL_MESSAGE_ACTIONS.UI_NAVIGATE, view: message.view || message.href || "" };
  }
  if (message.type === "led-ui-loading") {
    return { origin: "ui", action: SHELL_MESSAGE_ACTIONS.UI_LOADING, detail: message.detail || {} };
  }
  if (message.type === "led-ui-ready") {
    return { origin: "ui", action: SHELL_MESSAGE_ACTIONS.UI_READY, detail: message.detail };
  }
  if (UI_RELAY_TYPES.includes(message.type)) {
    return { origin: "ui", action: SHELL_MESSAGE_ACTIONS.UI_RELAY_TO_RUNNER, message };
  }
  return { origin: "ui", action: SHELL_MESSAGE_ACTIONS.UI_IGNORE };
}

export function classifyRunnerMessage(message) {
  if (message.type === "led-runner-loading") {
    return { origin: "runner", action: SHELL_MESSAGE_ACTIONS.RUNNER_LOADING, detail: message.detail || {} };
  }
  if (message.type === "led-runner-ready") {
    return { origin: "runner", action: SHELL_MESSAGE_ACTIONS.RUNNER_READY, detail: message.detail };
  }
  if (message.type === "led-runner-heartbeat") {
    return { origin: "runner", action: SHELL_MESSAGE_ACTIONS.RUNNER_HEARTBEAT, detail: message.detail || {} };
  }
  if (message.type === "led-output-frame") {
    return { origin: "runner", action: SHELL_MESSAGE_ACTIONS.RUNNER_OUTPUT_FRAME, detail: message.detail };
  }
  return { origin: "runner", action: SHELL_MESSAGE_ACTIONS.RUNNER_IGNORE };
}
