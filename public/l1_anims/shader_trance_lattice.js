import { gpuFor, metaFor, renderByName } from '../shader_anim_engine.js';

export const meta = { ...metaFor('shader_trance_lattice'), name: 'Trance Lattice', description: 'trance lattice scanner', params: ["Scale", "Speed", "Grid", "Phase"] };
export const gpu = gpuFor('shader_trance_lattice');
export const prewarm = { priority: 72, samplePoints: 96, warmOnSelect: true, warmNeighbors: true };

export function render(x, y, t, p) {
  return renderByName('shader_trance_lattice', x, y, t, p);
}
