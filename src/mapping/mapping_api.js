/**
 * Mapping engine boundary.
 * Mapping translates render-space frame to physical output-space payloads.
 */
import { normalizeMappingState } from "./model/normalize.js";
import { validateMappingState } from "./model/validate.js";
import { executeMappingPipeline } from "./pipeline/execute.js";

/**
 * @typedef {import("../contracts/types.js").RenderFrame} RenderFrame
 * @typedef {import("../contracts/types.js").MappedOutputFrame} MappedOutputFrame
 */

/**
 * @typedef {Object} MappingEngineApi
 * @property {(frame: RenderFrame, mappingState: Record<string, any>) => MappedOutputFrame[]} map
 */

/**
 * @returns {MappingEngineApi}
 */
export function createMappingEngineApi() {
  let lastValidation = { ok: true, errors: [], warnings: [] };

  return {
    map(frame, mappingState) {
      const normalized = normalizeMappingState(mappingState);
      lastValidation = validateMappingState(normalized);
      if (!lastValidation.ok) return [];
      return executeMappingPipeline(frame, normalized);
    },
    getValidation() {
      return lastValidation;
    }
  };
}
