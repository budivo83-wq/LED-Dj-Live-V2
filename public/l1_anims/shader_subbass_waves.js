import { gpuFor, metaFor, renderByName } from '../shader_anim_engine.js';
export const meta = { ...metaFor('shader_subbass_waves'), name: 'Subbass Waves', description: 'deep rolling subbass waves with pressure swells' };
export const gpu = gpuFor('shader_subbass_waves');
export const prewarm = { priority: 66, samplePoints: 96, warmOnSelect: true, warmNeighbors: true };
export function render(x, y, t, p) { return renderByName('shader_subbass_waves', x, y, t, p); }
