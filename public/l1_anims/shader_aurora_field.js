import { gpuFor, metaFor, renderByName } from '../shader_anim_engine.js';

export const meta = metaFor('shader_aurora_field');
export const gpu = gpuFor('shader_aurora_field');

export function render(x, y, t, p) {
  return renderByName('shader_aurora_field', x, y, t, p);
}
