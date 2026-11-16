import { gpuFor, metaFor, renderByName } from '../shader_anim_engine.js';
export const meta = metaFor('shader_polyrhythm_orbit');
export const gpu = gpuFor('shader_polyrhythm_orbit');
export const prewarm = { priority: 78, samplePoints: 96, warmOnSelect: true, warmNeighbors: true };
export function render(x, y, t, p) { return renderByName('shader_polyrhythm_orbit', x, y, t, p); }
