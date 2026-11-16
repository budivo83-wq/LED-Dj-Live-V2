import { gpuFor, metaFor, renderByName } from '../shader_anim_engine.js';
export const meta = metaFor('shader_echo_cathedral');
export const gpu = gpuFor('shader_echo_cathedral');
export const prewarm = { priority: 69, samplePoints: 96, warmOnSelect: true, warmNeighbors: true };
export function render(x, y, t, p) { return renderByName('shader_echo_cathedral', x, y, t, p); }
