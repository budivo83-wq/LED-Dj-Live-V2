import { gpuFor, metaFor, renderByName } from '../shader_anim_engine.js';
export const meta = { ...metaFor('shader_sonic_spikes'), name: 'Sonic Spikes', description: 'radial audio-reactive spike fan' };
export const gpu = gpuFor('shader_sonic_spikes');
export function render(x, y, t, p) { return renderByName('shader_sonic_spikes', x, y, t, p); }
