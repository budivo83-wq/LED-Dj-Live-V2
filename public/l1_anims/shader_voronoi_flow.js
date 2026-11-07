import { gpuFor, metaFor, renderByName } from '../shader_anim_engine.js';
export const meta = { ...metaFor('voronoi_flow'), name: 'Voronoi Flow', description: 'flowing cellular voronoi field', params: ['Scale', 'Speed', 'Facet', 'Flow'] };
export const gpu = gpuFor('voronoi_flow');
export const prewarm = { priority: 68, samplePoints: 96, warmOnSelect: true, warmNeighbors: true };
export function render(x, y, t, p) { return renderByName('voronoi_flow', x, y, t, p); }
