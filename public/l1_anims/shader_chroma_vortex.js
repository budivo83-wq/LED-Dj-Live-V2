import { gpuFor, metaFor, renderByName } from '../shader_anim_engine.js';
export const meta = { ...metaFor('shader_chroma_vortex'), name: 'Chroma Vortex', description: 'chromatic spiral vortex tunnel' };
export const gpu = gpuFor('shader_chroma_vortex');
export function render(x, y, t, p) { return renderByName('shader_chroma_vortex', x, y, t, p); }
