import { gpuFor, metaFor, renderByName } from '../shader_anim_engine.js';
export const meta = { ...metaFor('photon_tunnel'), name: 'Photon Tunnel', description: 'high-speed photon tunnel streaks', params: ['Scale', 'Speed', 'Streaks', 'Depth'] };
export const gpu = gpuFor('photon_tunnel');
export const prewarm = { priority: 68, samplePoints: 96, warmOnSelect: true, warmNeighbors: true };
export function render(x, y, t, p) { return renderByName('photon_tunnel', x, y, t, p); }
