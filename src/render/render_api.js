/**
 * Render engine boundary.
 * Render must not perform output transport or UI writes.
 */

/**
 * @typedef {import("../contracts/types.js").PipelineSnapshot} PipelineSnapshot
 * @typedef {import("../contracts/types.js").RenderFrame} RenderFrame
 */

/**
 * @typedef {Object} RenderEngineApi
 * @property {(snapshot: PipelineSnapshot) => RenderFrame} render
 * @property {() => Record<string, any>} getShaderStats
 */

/**
 * @returns {RenderEngineApi}
 */
export function createRenderEngineApi() {
  const shaderStats = {
    cacheHits: 0,
    cacheMisses: 0,
    compileCount: 0,
    compileFailures: 0,
    avgCompileMs: 0,
    lastCompileMs: 0
  };
  return {
    render(snapshot) {
      const width = Number(snapshot?.state?.width || 0);
      const height = Number(snapshot?.state?.height || 0);
      return {
        width,
        height,
        pixels: null,
        timestamp: Number(snapshot?.frame?.now || performance.now())
      };
    },
    getShaderStats() {
      return shaderStats;
    }
  };
}
