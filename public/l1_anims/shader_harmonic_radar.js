import { gpuFor, metaFor, renderByName } from '../shader_anim_engine.js';
export const meta = { ...metaFor('shader_harmonic_radar'), name: 'Harmonic Radar', description: 'rotating harmonic radar with spectral echoes' };
export const gpu = gpuFor('shader_harmonic_radar');
export const prewarm = { priority: 66, samplePoints: 96, warmOnSelect: true, warmNeighbors: true };
export function render(x, y, t, p) { return renderByName('shader_harmonic_radar', x, y, t, p); }
