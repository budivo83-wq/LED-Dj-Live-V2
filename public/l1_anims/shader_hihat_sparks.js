import { gpuFor, metaFor, renderByName } from '../shader_anim_engine.js';

export const meta = { ...metaFor('shader_hihat_sparks'), name: 'HiHat Sparks', description: 'fast hihat spark field', params: ["Scale", "Speed", "Density", "Sparkle"] };
export const gpu = gpuFor('shader_hihat_sparks');
export const prewarm = { priority: 72, samplePoints: 96, warmOnSelect: true, warmNeighbors: true };

export function render(x, y, t, p) {
  return renderByName('shader_hihat_sparks', x, y, t, p);
}
