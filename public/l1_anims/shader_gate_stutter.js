import { gpuFor, metaFor, renderByName } from '../shader_anim_engine.js';

export const meta = { ...metaFor('shader_gate_stutter'), name: 'Gate Stutter', description: 'rhythmic stutter slices', params: ["Scale", "Speed", "Steps", "Gate"] };
export const gpu = gpuFor('shader_gate_stutter');
export const prewarm = { priority: 72, samplePoints: 96, warmOnSelect: true, warmNeighbors: true };

export function render(x, y, t, p) {
  return renderByName('shader_gate_stutter', x, y, t, p);
}
