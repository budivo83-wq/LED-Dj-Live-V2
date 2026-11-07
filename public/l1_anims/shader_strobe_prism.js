import { gpuFor, metaFor, renderByName } from '../shader_anim_engine.js';
export const meta = { ...metaFor('shader_strobe_prism'), name: 'Strobe Prism', description: 'angular prism strobe with beat gates' };
export const gpu = gpuFor('shader_strobe_prism');
export function render(x, y, t, p) { return renderByName('shader_strobe_prism', x, y, t, p); }
