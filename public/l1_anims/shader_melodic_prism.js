import { gpuFor, metaFor, renderByName } from '../shader_anim_engine.js';
export const meta = { ...metaFor('shader_melodic_prism'), name: 'Melodic Prism', description: 'angular melodic prism with glowing note rings' };
export const gpu = gpuFor('shader_melodic_prism');
export const prewarm = { priority: 66, samplePoints: 96, warmOnSelect: true, warmNeighbors: true };
export function render(x, y, t, p) { return renderByName('shader_melodic_prism', x, y, t, p); }
