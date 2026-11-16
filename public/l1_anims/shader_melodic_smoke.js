import { gpuFor, metaFor, renderByName } from '../shader_anim_engine.js';
export const meta = metaFor('shader_melodic_smoke');
export const gpu = gpuFor('shader_melodic_smoke');
export const prewarm = { priority: 71, samplePoints: 96, warmOnSelect: true, warmNeighbors: true };
export function render(x, y, t, p) { return renderByName('shader_melodic_smoke', x, y, t, p); }
