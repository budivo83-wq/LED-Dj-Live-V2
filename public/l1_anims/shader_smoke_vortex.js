import { gpuFor, metaFor, renderByName } from '../shader_anim_engine.js';

export const meta = metaFor('shader_smoke_vortex');
export const gpu = gpuFor('shader_smoke_vortex');

export function render(x, y, t, p) {
  return renderByName('shader_smoke_vortex', x, y, t, p);
}
