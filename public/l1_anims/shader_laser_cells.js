import { gpuFor, metaFor, renderByName } from '../shader_anim_engine.js';

export const meta = metaFor('shader_laser_cells');
export const gpu = gpuFor('shader_laser_cells');

export function render(x, y, t, p) {
  return renderByName('shader_laser_cells', x, y, t, p);
}
