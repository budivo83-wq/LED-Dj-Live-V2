import { createStateBridge } from "../state.js";

function createSrcApiBridge() {
  // Single extension point for future src/ runtime APIs.
  // Keep this stable so public/ callers never import src/ directly.
  return {
    isEnabled: () => false
  };
}

export function createRuntimeBoundaryBridge(deps) {
  const stateBridge = createStateBridge(deps);
  const srcBridge = createSrcApiBridge();
  return {
    stateBridge,
    srcBridge
  };
}
