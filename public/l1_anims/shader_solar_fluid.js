import { gpuFor, metaFor, renderByName } from '../shader_anim_engine.js';

export const meta = metaFor('shader_solar_fluid');
export const gpu = gpuFor('shader_solar_fluid');

export function render(x, y, t, p) {
  return renderByName('shader_solar_fluid', x, y, t, p);
}
