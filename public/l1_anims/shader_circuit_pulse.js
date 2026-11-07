import { gpuFor, metaFor, renderByName } from '../shader_anim_engine.js';

export const meta = metaFor('shader_circuit_pulse');
export const gpu = gpuFor('shader_circuit_pulse');

export function render(x, y, t, p) {
  return renderByName('shader_circuit_pulse', x, y, t, p);
}
