import { gpuFor, metaFor, renderByName } from '../shader_anim_engine.js';
export const meta = metaFor('shader_liquid_chords');
export const gpu = gpuFor('shader_liquid_chords');
export const prewarm = { priority: 74, samplePoints: 96, warmOnSelect: true, warmNeighbors: true };
export function render(x, y, t, p) { return renderByName('shader_liquid_chords', x, y, t, p); }
