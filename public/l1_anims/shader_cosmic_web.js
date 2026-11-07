import { gpuFor, metaFor, renderByName } from '../shader_anim_engine.js';

export const meta = metaFor('shader_cosmic_web');
export const gpu = gpuFor('shader_cosmic_web');

export function render(x, y, t, p) {
  return renderByName('shader_cosmic_web', x, y, t, p);
}
