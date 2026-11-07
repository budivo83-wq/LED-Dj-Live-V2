import { gpuFor, metaFor, renderByName } from '../shader_anim_engine.js';
export const meta = { ...metaFor('shader_fractal_bloom'), name: 'Fractal Bloom', description: 'recursive fractal flower bloom' };
export const gpu = gpuFor('shader_fractal_bloom');
export function render(x, y, t, p) { return renderByName('shader_fractal_bloom', x, y, t, p); }
