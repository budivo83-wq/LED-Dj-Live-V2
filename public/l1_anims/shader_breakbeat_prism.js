import { gpuFor, metaFor, renderByName } from '../shader_anim_engine.js';
export const meta = metaFor('shader_breakbeat_prism');
export const gpu = gpuFor('shader_breakbeat_prism');
export const prewarm = { priority: 75, samplePoints: 96, warmOnSelect: true, warmNeighbors: true };
export function render(x, y, t, p) { return renderByName('shader_breakbeat_prism', x, y, t, p); }
