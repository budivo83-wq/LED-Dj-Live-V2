import { MAPPING_OBJECT_TYPES, MAPPING_OUTPUTS, SAMPLING_MODES } from './constants.js';

export function validateMappingState(mappingState) {
  const errors = [];
  const warnings = [];
  const segments = Array.isArray(mappingState?.segments) ? mappingState.segments : [];

  segments.forEach((segment, index) => {
    const p = `segments[${index}]`;
    if (!segment?.id) warnings.push(`${p}.id is empty`);
    if (!MAPPING_OUTPUTS.includes(String(segment?.output || '').toLowerCase())) {
      errors.push(`${p}.output is invalid`);
    }
    if (!MAPPING_OBJECT_TYPES.includes(String(segment?.objectType || '').toLowerCase())) {
      errors.push(`${p}.objectType is invalid`);
    }
    if (!SAMPLING_MODES.includes(String(segment?.sampling || '').toLowerCase())) {
      errors.push(`${p}.sampling is invalid`);
    }
    if (!Number.isFinite(Number(segment?.pixelStart)) || Number(segment?.pixelStart) < 0) {
      errors.push(`${p}.pixelStart must be >= 0`);
    }
    if (!Number.isFinite(Number(segment?.pixelCount)) || Number(segment?.pixelCount) <= 0) {
      errors.push(`${p}.pixelCount must be > 0`);
    }
    if (!Number.isFinite(Number(segment?.universe)) || Number(segment?.universe) < 0) {
      errors.push(`${p}.universe must be >= 0`);
    }
  });

  return {
    ok: errors.length === 0,
    errors,
    warnings
  };
}
