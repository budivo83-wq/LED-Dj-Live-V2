import { gpuFor, metaFor, renderByName } from '../shader_anim_engine.js';

export const meta = { ...metaFor('shader_kick_vortex'), name: 'Kick Vortex', description: 'rotating kick vortex', params: ["Scale", "Speed", "Spin", "Punch"] };
export const gpu = gpuFor('shader_kick_vortex');
export const prewarm = { priority: 72, samplePoints: 96, warmOnSelect: true, warmNeighbors: true };

export function render(x, y, t, p) {
  return renderByName('shader_kick_vortex', x, y, t, p);
}
