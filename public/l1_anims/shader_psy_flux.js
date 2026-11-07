import { gpuFor, metaFor, renderByName } from '../shader_anim_engine.js';

export const meta = { ...metaFor('shader_psy_flux'), name: 'Psy Flux', description: 'psytrance folding flux', params: ["Scale", "Speed", "Fold", "Drive"] };
export const gpu = gpuFor('shader_psy_flux');
export const prewarm = { priority: 72, samplePoints: 96, warmOnSelect: true, warmNeighbors: true };

export function render(x, y, t, p) {
  return renderByName('shader_psy_flux', x, y, t, p);
}
