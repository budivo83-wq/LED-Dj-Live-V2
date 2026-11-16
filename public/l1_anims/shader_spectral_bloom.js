import { gpuFor, metaFor, renderByName } from '../shader_anim_engine.js';
export const meta = { ...metaFor('shader_spectral_bloom'), name: 'Spectral Bloom', description: 'layered spectral bands blooming with the beat' };
export const gpu = gpuFor('shader_spectral_bloom');
export const prewarm = { priority: 66, samplePoints: 96, warmOnSelect: true, warmNeighbors: true };
export function render(x, y, t, p) { return renderByName('shader_spectral_bloom', x, y, t, p); }
