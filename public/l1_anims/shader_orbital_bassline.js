import { gpuFor, metaFor, renderByName } from '../shader_anim_engine.js';

export const meta = { ...metaFor('shader_orbital_bassline'), name: 'Orbital Bassline', description: 'orbiting bassline dots', params: ["Scale", "Speed", "Orbits", "Glow"] };
export const gpu = gpuFor('shader_orbital_bassline');
export const prewarm = { priority: 72, samplePoints: 96, warmOnSelect: true, warmNeighbors: true };

export function render(x, y, t, p) {
  return renderByName('shader_orbital_bassline', x, y, t, p);
}
