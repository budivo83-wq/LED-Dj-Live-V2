import { gpuFor, metaFor, renderByName } from '../shader_anim_engine.js';

export const meta = metaFor('shader_phase_ribbons');
export const gpu = gpuFor('shader_phase_ribbons');

export function render(x, y, t, p) {
  return renderByName('shader_phase_ribbons', x, y, t, p);
}
