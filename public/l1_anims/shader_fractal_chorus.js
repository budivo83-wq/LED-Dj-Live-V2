import { gpuFor, metaFor, renderByName } from '../shader_anim_engine.js';
export const meta = metaFor('shader_fractal_chorus');
export const gpu = gpuFor('shader_fractal_chorus');
export const prewarm = { priority: 76, samplePoints: 96, warmOnSelect: true, warmNeighbors: true };
export function render(x, y, t, p) { return renderByName('shader_fractal_chorus', x, y, t, p); }
