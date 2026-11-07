import { gpuFor, metaFor, renderByName } from '../shader_anim_engine.js';

export const meta = metaFor('shader_fractal_tunnel');
export const gpu = gpuFor('shader_fractal_tunnel');

export function render(x, y, t, p) {
  return renderByName('shader_fractal_tunnel', x, y, t, p);
}
