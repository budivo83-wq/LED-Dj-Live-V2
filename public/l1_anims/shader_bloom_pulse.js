import { gpuFor, metaFor, renderByName } from '../shader_anim_engine.js';
export const meta = { ...metaFor('bloom_pulse'), name: 'Bloom Pulse', description: 'soft rhythmic radial bloom', params: ['Scale', 'Speed', 'Pulse', 'Bloom'] };
export const gpu = gpuFor('bloom_pulse');
export const prewarm = { priority: 68, samplePoints: 96, warmOnSelect: true, warmNeighbors: true };
export function render(x, y, t, p) { return renderByName('bloom_pulse', x, y, t, p); }
