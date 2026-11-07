import { gpuFor, metaFor, renderByName } from '../shader_anim_engine.js';

export const meta = metaFor('shader_nebula');
export const gpu = gpuFor('shader_nebula');

export function render(x, y, t, p) {
  return renderByName('shader_nebula', x, y, t, p);
}
