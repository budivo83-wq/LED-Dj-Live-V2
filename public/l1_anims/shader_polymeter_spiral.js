import { gpuFor, metaFor, renderByName } from '../shader_anim_engine.js';
export const meta = { ...metaFor('shader_polymeter_spiral'), name: 'Polymeter Spiral', description: 'counter-rotating spiral meters with layered rhythm' };
export const gpu = gpuFor('shader_polymeter_spiral');
export const prewarm = { priority: 66, samplePoints: 96, warmOnSelect: true, warmNeighbors: true };
export function render(x, y, t, p) { return renderByName('shader_polymeter_spiral', x, y, t, p); }
