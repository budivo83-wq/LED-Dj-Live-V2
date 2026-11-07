import { gpuFor, metaFor, renderByName } from '../shader_anim_engine.js';
export const meta = { ...metaFor('shader_helix_drive'), name: 'Helix Drive', description: 'rotating double-helix energy drive' };
export const gpu = gpuFor('shader_helix_drive');
export function render(x, y, t, p) { return renderByName('shader_helix_drive', x, y, t, p); }
