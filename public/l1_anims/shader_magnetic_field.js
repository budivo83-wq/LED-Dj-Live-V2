import { gpuFor, metaFor, renderByName } from '../shader_anim_engine.js';

export const meta = metaFor('shader_magnetic_field');
export const gpu = gpuFor('shader_magnetic_field');

export function render(x, y, t, p) {
  return renderByName('shader_magnetic_field', x, y, t, p);
}
