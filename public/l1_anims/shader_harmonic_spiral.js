import { gpuFor, metaFor, renderByName } from '../shader_anim_engine.js';
export const meta = metaFor('shader_harmonic_spiral');
export const gpu = gpuFor('shader_harmonic_spiral');
export const prewarm = { priority: 77, samplePoints: 96, warmOnSelect: true, warmNeighbors: true };
export function render(x, y, t, p) { return renderByName('shader_harmonic_spiral', x, y, t, p); }
