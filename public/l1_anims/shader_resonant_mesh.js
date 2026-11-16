import { gpuFor, metaFor, renderByName } from '../shader_anim_engine.js';
export const meta = { ...metaFor('shader_resonant_mesh'), name: 'Resonant Mesh', description: 'interference mesh shaped by resonant tones' };
export const gpu = gpuFor('shader_resonant_mesh');
export const prewarm = { priority: 66, samplePoints: 96, warmOnSelect: true, warmNeighbors: true };
export function render(x, y, t, p) { return renderByName('shader_resonant_mesh', x, y, t, p); }
