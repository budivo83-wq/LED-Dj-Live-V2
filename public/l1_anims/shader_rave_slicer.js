import { gpuFor, metaFor, renderByName } from '../shader_anim_engine.js';

export const meta = metaFor('shader_rave_slicer');
export const gpu = gpuFor('shader_rave_slicer');

export function render(x, y, t, p) {
  return renderByName('shader_rave_slicer', x, y, t, p);
}
