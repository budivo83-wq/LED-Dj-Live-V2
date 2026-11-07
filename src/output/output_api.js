/**
 * Output engine boundary.
 * Output consumes mapped frames asynchronously and must not block render loop.
 */

/**
 * @typedef {import("../contracts/types.js").MappedOutputFrame} MappedOutputFrame
 */
import { createOutputManager } from "./output_manager.js";

/**
 * @typedef {Object} OutputEngineApi
 * @property {(frames: MappedOutputFrame[], outputState: Record<string, any>) => void} push
 * @property {() => Record<string, any>} getStatus
 */

/**
 * @returns {OutputEngineApi}
 */
export function createOutputEngineApi() {
  const manager = createOutputManager({ transport: "preview" });
  let mode = "preview";

  function frameFromMappedFrames(frames, outputState = {}) {
    const list = Array.isArray(frames) ? frames : [];
    const payloads = list
      .map((frame) => frame?.payload instanceof Uint8Array ? frame.payload : null)
      .filter(Boolean);
    const byteLength = payloads.reduce((sum, payload) => sum + payload.byteLength, 0);
    const rgb = new Uint8Array(byteLength);
    let offset = 0;
    for (const payload of payloads) {
      rgb.set(payload, offset);
      offset += payload.byteLength;
    }
    return {
      frameId: Number(outputState?.frameId || 0),
      timestamp: Number(outputState?.timestamp || Date.now()),
      fps: Number(outputState?.fps || outputState?.targetFps || 0),
      renderTime: Number(outputState?.renderTime || outputState?.renderMs || 0),
      sendTime: Number(outputState?.sendTime || outputState?.sendMs || 0),
      frame: rgb,
      meta: {
        mappedFrameCount: list.length,
        outputStateMode: outputState?.mode || outputState?.adapter || mode
      }
    };
  }

  return {
    push(frames, outputState) {
      const nextMode = String(outputState?.adapter || outputState?.mode || mode).toLowerCase();
      if (nextMode !== mode) {
        mode = nextMode;
        manager.setTransport(mode);
      }
      manager.connect();
      const frame = frameFromMappedFrames(frames, outputState);
      manager.sendFrame(frame);
    },
    sendFrame(frame, options = {}) {
      if (options.transport || options.mode) {
        mode = String(options.transport || options.mode).toLowerCase();
        manager.setTransport(mode);
      }
      return manager.sendFrame(frame, options);
    },
    connect() {
      return manager.connect();
    },
    disconnect() {
      return manager.disconnect();
    },
    getStats() {
      return manager.getStats();
    },
    getStatus() {
      const stats = manager.getStats();
      const active = stats.outputs?.[stats.active] || null;
      return active || {
        id: stats.active || mode,
        queueDepth: 0,
        dropped: 0,
        lastSendMs: 0,
        lastLatencyMs: 0
      };
    }
  };
}
