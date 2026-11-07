import { gpuFor, metaFor, renderByName } from '../shader_anim_engine.js';
export const meta = { ...metaFor('liquid_metal'), name: 'Liquid Metal', description: 'molten metallic wave field', params: ['Scale', 'Speed', 'Flow', 'Shine'] };
export const gpu = gpuFor('liquid_metal');
export const prewarm = { priority: 68, samplePoints: 96, warmOnSelect: true, warmNeighbors: true };
export function render(x, y, t, p) { return renderByName('liquid_metal', x, y, t, p); }
