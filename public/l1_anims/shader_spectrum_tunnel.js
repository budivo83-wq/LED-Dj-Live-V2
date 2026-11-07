import { gpuFor, metaFor, renderByName } from '../shader_anim_engine.js';

export const meta = { ...metaFor('shader_spectrum_tunnel'), name: 'Spectrum Tunnel', description: 'spectral tunnel bands', params: ["Scale", "Speed", "Bands", "Depth"] };
export const gpu = gpuFor('shader_spectrum_tunnel');
export const prewarm = { priority: 72, samplePoints: 96, warmOnSelect: true, warmNeighbors: true };

export function render(x, y, t, p) {
  return renderByName('shader_spectrum_tunnel', x, y, t, p);
}
