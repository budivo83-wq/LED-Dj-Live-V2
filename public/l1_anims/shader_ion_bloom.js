import { gpuFor, metaFor, renderByName } from '../shader_anim_engine.js';

export const meta = metaFor('shader_ion_bloom');
export const gpu = gpuFor('shader_ion_bloom');

export function render(x, y, t, p) {
  return renderByName('shader_ion_bloom', x, y, t, p);
}
