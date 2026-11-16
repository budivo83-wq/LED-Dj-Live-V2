import { gpuFor, metaFor, renderByName } from '../shader_anim_engine.js';
export const meta = { ...metaFor('shader_offbeat_orbits'), name: 'Offbeat Orbits', description: 'swinging offbeat particles in interlocking orbits' };
export const gpu = gpuFor('shader_offbeat_orbits');
export const prewarm = { priority: 66, samplePoints: 96, warmOnSelect: true, warmNeighbors: true };
export function render(x, y, t, p) { return renderByName('shader_offbeat_orbits', x, y, t, p); }
