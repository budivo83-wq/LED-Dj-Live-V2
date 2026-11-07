import { gpuFor, metaFor, renderByName } from '../shader_anim_engine.js';
export const meta = { ...metaFor('shader_digital_rain'), name: 'Digital Rain', description: 'high-energy procedural data rain' };
export const gpu = gpuFor('shader_digital_rain');
export function render(x, y, t, p) { return renderByName('shader_digital_rain', x, y, t, p); }
