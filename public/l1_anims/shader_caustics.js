import { gpuFor, metaFor, renderByName } from '../shader_anim_engine.js';
export const meta = { ...metaFor('caustics'), name: 'Caustics', description: 'liquid light caustic interference', params: ['Scale', 'Speed', 'Sharpness', 'Flow'] };
export const gpu = gpuFor('caustics');
export const prewarm = { priority: 68, samplePoints: 96, warmOnSelect: true, warmNeighbors: true };
export function render(x, y, t, p) { return renderByName('caustics', x, y, t, p); }
