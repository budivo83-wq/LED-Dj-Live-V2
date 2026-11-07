/**
 * Preview engine boundary.
 * Preview is a consumer of render/mapping results and must not drive pipeline state.
 */
import { PREVIEW_DEFAULTS } from "./constants.js";
import { createPreviewThrottler } from "./runtime/throttler.js";
import { createPreviewPresenter } from "./runtime/presenter.js";

/**
 * @typedef {import("../contracts/types.js").RenderFrame} RenderFrame
 */

/**
 * @typedef {Object} PreviewEngineApi
 * @property {(frame: RenderFrame, previewState: Record<string, any>, mappedFrames?: any[]) => boolean} present
 * @property {() => Record<string, any>} getStatus
 */

/**
 * @param {Object} [options]
 * @param {number} [options.fps]
 * @param {any} [options.presenterAdapter]
 * @returns {PreviewEngineApi}
 */
export function createPreviewEngineApi(options = {}) {
  const throttler = createPreviewThrottler(options.fps || PREVIEW_DEFAULTS.fps);
  const presenter = createPreviewPresenter(options.presenterAdapter || null);

  let presented = 0;
  let lastMode = PREVIEW_DEFAULTS.mode;
  let lastPresentedAt = 0;

  return {
    present(frame, previewState, mappedFrames = []) {
      const mode = String(previewState?.previewMode || PREVIEW_DEFAULTS.mode).toLowerCase();
      const fps = Number(previewState?.previewFps || options.fps || PREVIEW_DEFAULTS.fps);
      throttler.setFps(fps);
      if (!throttler.shouldPresent()) return false;

      presenter.present(frame, mode, {
        mappedFrames,
        debug: previewState?.debugOpen === true
      });
      presented += 1;
      lastMode = mode;
      lastPresentedAt = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
      return true;
    },
    getStatus() {
      return {
        presented,
        lastMode,
        lastPresentedAt,
        throttler: throttler.getStats()
      };
    }
  };
}
