import { gpuFor, metaFor, renderByName } from '../shader_anim_engine.js';
export const meta = metaFor('shader_euclidean_stars');
export const gpu = gpuFor('shader_euclidean_stars');
export const prewarm = { priority: 70, samplePoints: 96, warmOnSelect: true, warmNeighbors: true };
export function render(x, y, t, p) { return renderByName('shader_euclidean_stars', x, y, t, p); }
