import { gpuFor, metaFor, renderByName } from '../shader_anim_engine.js';
export const meta = { ...metaFor('kaleidoscope'), name: 'Kaleidoscope', description: 'mirrored radial kaleidoscope facets', params: ['Scale', 'Speed', 'Facets', 'Glow'] };
export const gpu = gpuFor('kaleidoscope');
export const prewarm = { priority: 68, samplePoints: 96, warmOnSelect: true, warmNeighbors: true };
export function render(x, y, t, p) { return renderByName('kaleidoscope', x, y, t, p); }
