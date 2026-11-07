import { gpuFor, metaFor, renderByName } from '../shader_anim_engine.js';

export const meta = metaFor('shader_crystal_lattice');
export const gpu = gpuFor('shader_crystal_lattice');

export function render(x, y, t, p) {
  return renderByName('shader_crystal_lattice', x, y, t, p);
}
