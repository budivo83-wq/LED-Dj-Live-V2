import { gpuFor, metaFor, renderByName } from '../shader_anim_engine.js';
export const meta = { ...metaFor('wormhole'), name: 'Wormhole', description: 'deep-space radial wormhole tunnel', params: ['Scale', 'Speed', 'Twist', 'Depth'] };
export const gpu = gpuFor('wormhole');
export const prewarm = { priority: 68, samplePoints: 96, warmOnSelect: true, warmNeighbors: true };
export function render(x, y, t, p) { return renderByName('wormhole', x, y, t, p); }
