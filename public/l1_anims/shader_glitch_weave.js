import { gpuFor, metaFor, renderByName } from '../shader_anim_engine.js';

export const meta = metaFor('shader_glitch_weave');
export const gpu = gpuFor('shader_glitch_weave');

export function render(x, y, t, p) {
  return renderByName('shader_glitch_weave', x, y, t, p);
}
