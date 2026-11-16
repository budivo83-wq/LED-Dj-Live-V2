import { gpuFor, metaFor, renderByName } from '../shader_anim_engine.js';
export const meta = { ...metaFor('shader_kick_mandala'), name: 'Kick Mandala', description: 'kick-driven radial mandala with punch pulses' };
export const gpu = gpuFor('shader_kick_mandala');
export const prewarm = { priority: 66, samplePoints: 96, warmOnSelect: true, warmNeighbors: true };
export function render(x, y, t, p) { return renderByName('shader_kick_mandala', x, y, t, p); }
