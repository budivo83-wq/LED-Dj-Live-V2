import { gpuFor, metaFor, renderByName } from '../shader_anim_engine.js';
export const meta = { ...metaFor('shader_neon_orbit'), name: 'Neon Orbit', description: 'glowing orbital laser rings' };
export const gpu = gpuFor('shader_neon_orbit');
export function render(x, y, t, p) { return renderByName('shader_neon_orbit', x, y, t, p); }
