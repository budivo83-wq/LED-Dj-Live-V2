import { gpuFor, metaFor, renderByName } from '../shader_anim_engine.js';
export const meta = { ...metaFor('plasma_iq'), name: 'Plasma IQ', description: 'iterated plasma field with animated escape', params: ['Scale', 'Speed', 'Detail', 'Glow'] };
export const gpu = gpuFor('plasma_iq');
export const prewarm = { priority: 68, samplePoints: 96, warmOnSelect: true, warmNeighbors: true };
export function render(x, y, t, p) { return renderByName('plasma_iq', x, y, t, p); }
