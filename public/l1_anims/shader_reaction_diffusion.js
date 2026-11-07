import { gpuFor, metaFor, renderByName } from '../shader_anim_engine.js';
export const meta = { ...metaFor('reaction_difusion'), name: 'Reaction Diffusion', description: 'organic feedback-like reaction field', params: ['Scale', 'Speed', 'Detail', 'Contrast'] };
export const gpu = gpuFor('reaction_difusion');
export const prewarm = { priority: 68, samplePoints: 96, warmOnSelect: true, warmNeighbors: true };
export function render(x, y, t, p) { return renderByName('reaction_difusion', x, y, t, p); }
