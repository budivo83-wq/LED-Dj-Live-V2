import { gpuFor, metaFor, renderByName } from '../shader_anim_engine.js';
export const meta = { ...metaFor('shader_glitch_sync'), name: 'Glitch Sync', description: 'syncopated scanlines with rhythmic glitch cuts' };
export const gpu = gpuFor('shader_glitch_sync');
export const prewarm = { priority: 66, samplePoints: 96, warmOnSelect: true, warmNeighbors: true };
export function render(x, y, t, p) { return renderByName('shader_glitch_sync', x, y, t, p); }
