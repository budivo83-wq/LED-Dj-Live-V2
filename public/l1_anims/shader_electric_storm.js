import { gpuFor, metaFor, renderByName } from '../shader_anim_engine.js';
export const meta = { ...metaFor('electric_storm'), name: 'Electric Storm', description: 'branching electric storm filaments', params: ['Scale', 'Speed', 'Branches', 'Flash'] };
export const gpu = gpuFor('electric_storm');
export const prewarm = { priority: 68, samplePoints: 96, warmOnSelect: true, warmNeighbors: true };
export function render(x, y, t, p) { return renderByName('electric_storm', x, y, t, p); }
