import { gpuFor, metaFor, renderByName } from '../shader_anim_engine.js';

export const meta = metaFor('shader_liquid_chrome');
export const gpu = gpuFor('shader_liquid_chrome');

export function render(x, y, t, p) {
  return renderByName('shader_liquid_chrome', x, y, t, p);
}
