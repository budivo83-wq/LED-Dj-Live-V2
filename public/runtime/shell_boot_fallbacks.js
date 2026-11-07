export function buildLoadedFallbackActions(state) {
  const {
    uiReady = false,
    uiLoaded = false,
    runnerReady = false,
    runnerLoaded = false
  } = state || {};

  return [
    !uiReady && uiLoaded ? {
      scope: "ui",
      event: "ready-fallback",
      detail: "iframe loaded without led-ui-ready",
      readyKey: "uiReady",
      warning: "[shell] UI ready fallback used after iframe load without led-ui-ready"
    } : null,
    !runnerReady && runnerLoaded ? {
      scope: "runner",
      event: "ready-fallback",
      detail: "iframe loaded without led-runner-ready",
      readyKey: "runnerReady",
      warning: "[shell] runner ready fallback used after iframe load without led-runner-ready"
    } : null
  ].filter(Boolean);
}

export function buildLoadTimeoutActions(state, timeoutMs) {
  const {
    uiLoaded = false,
    runnerLoaded = false
  } = state || {};

  return [
    !uiLoaded ? {
      scope: "ui",
      event: "load-timeout",
      detail: `no iframe load after ${timeoutMs}ms`
    } : null,
    !runnerLoaded ? {
      scope: "runner",
      event: "load-timeout",
      detail: `no iframe load after ${timeoutMs}ms`
    } : null
  ].filter(Boolean);
}

export function buildHardReadyActions(state, timeoutMs) {
  const {
    uiReady = false,
    runnerReady = false
  } = state || {};

  return [
    !uiReady ? {
      scope: "ui",
      event: "hard-ready-fallback",
      detail: `forced after ${timeoutMs}ms`,
      readyKey: "uiReady"
    } : null,
    !runnerReady ? {
      scope: "runner",
      event: "hard-ready-fallback",
      detail: `forced after ${timeoutMs}ms`,
      readyKey: "runnerReady"
    } : null
  ].filter(Boolean);
}
