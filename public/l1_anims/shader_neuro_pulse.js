import { gpuFor, metaFor, renderByName } from '../shader_anim_engine.js';

export const meta = { ...metaFor('shader_neuro_pulse'), name: 'Neuro Pulse', description: 'dark neuro pulse field', params: ["Scale", "Speed", "Tension", "Pulse"] };
export const gpu = gpuFor('shader_neuro_pulse');
export const prewarm = { priority: 72, samplePoints: 96, warmOnSelect: true, warmNeighbors: true };

export function render(x, y, t, p) {
  return renderByName('shader_neuro_pulse', x, y, t, p);
}
