import { gpuFor, metaFor, renderByName } from '../shader_anim_engine.js';
export const meta = metaFor('shader_bass_choir');
export const gpu = gpuFor('shader_bass_choir');
export const prewarm = { priority: 72, samplePoints: 96, warmOnSelect: true, warmNeighbors: true };
export function render(x, y, t, p) { return renderByName('shader_bass_choir', x, y, t, p); }
