import { gpuFor, metaFor, renderByName } from '../shader_anim_engine.js';

export const meta = metaFor('shader_moire_rings');
export const gpu = gpuFor('shader_moire_rings');

export function render(x, y, t, p) {
  return renderByName('shader_moire_rings', x, y, t, p);
}
