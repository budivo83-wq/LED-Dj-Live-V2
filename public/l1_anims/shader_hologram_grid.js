import { gpuFor, metaFor, renderByName } from '../shader_anim_engine.js';
export const meta = { ...metaFor('shader_hologram_grid'), name: 'Hologram Grid', description: 'scanning holographic wireframe grid' };
export const gpu = gpuFor('shader_hologram_grid');
export function render(x, y, t, p) { return renderByName('shader_hologram_grid', x, y, t, p); }
