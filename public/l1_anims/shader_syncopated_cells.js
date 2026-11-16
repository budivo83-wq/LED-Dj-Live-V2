import { gpuFor, metaFor, renderByName } from '../shader_anim_engine.js';
export const meta = metaFor('shader_syncopated_cells');
export const gpu = gpuFor('shader_syncopated_cells');
export const prewarm = { priority: 73, samplePoints: 96, warmOnSelect: true, warmNeighbors: true };
export function render(x, y, t, p) { return renderByName('shader_syncopated_cells', x, y, t, p); }
