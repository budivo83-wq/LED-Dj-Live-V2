/**
 * Shared contract typedefs for engine subsystem boundaries.
 * This file is intentionally runtime-light and documentation-heavy.
 */

/**
 * @typedef {Object} EngineFrameContext
 * @property {number} now
 * @property {number} dt
 * @property {number} frame
 */

/**
 * @typedef {Object} RenderFrame
 * @property {number} width
 * @property {number} height
 * @property {Uint8ClampedArray|Float32Array|null} pixels
 * @property {number} timestamp
 */

/**
 * @typedef {Object} MappedOutputFrame
 * @property {string} outputId
 * @property {number} universe
 * @property {number} pixelCount
 * @property {Uint8Array|null} payload
 * @property {number} timestamp
 */

/**
 * @typedef {Object} PipelineSnapshot
 * @property {Record<string, any>} state
 * @property {EngineFrameContext} frame
 */

export const CONTRACTS_VERSION = "v1";

