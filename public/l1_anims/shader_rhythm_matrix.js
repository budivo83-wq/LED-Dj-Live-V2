import { gpuFor, metaFor, renderByName } from '../shader_anim_engine.js';
export const meta = { ...metaFor('shader_rhythm_matrix'), name: 'Rhythm Matrix', description: 'deterministic beat-synced light cells' };
export const gpu = gpuFor('shader_rhythm_matrix');
export function render(x, y, t, p) { return renderByName('shader_rhythm_matrix', x, y, t, p); }
