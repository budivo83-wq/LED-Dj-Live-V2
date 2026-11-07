import { gpuFor, metaFor, renderByName } from '../shader_anim_engine.js';

export const meta = { ...metaFor('shader_sub_ripple'), name: 'Sub Ripple', description: 'sub-bass ripples', params: ["Scale", "Speed", "Depth", "Wave"] };
export const gpu = gpuFor('shader_sub_ripple');
export const prewarm = { priority: 72, samplePoints: 96, warmOnSelect: true, warmNeighbors: true };

export function render(x, y, t, p) {
  return renderByName('shader_sub_ripple', x, y, t, p);
}
