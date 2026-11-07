import { gpuFor, metaFor, renderByName } from '../shader_anim_engine.js';

export const meta = metaFor('shader_voxel_corridor');
export const gpu = gpuFor('shader_voxel_corridor');

export function render(x, y, t, p) {
  return renderByName('shader_voxel_corridor', x, y, t, p);
}
