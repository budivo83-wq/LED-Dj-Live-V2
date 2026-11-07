import { gpuFor, metaFor, renderByName } from '../shader_anim_engine.js';
export const meta = { ...metaFor('shader_pulse_rings'), name: 'Pulse Rings', description: 'expanding concentric bass pulses' };
export const gpu = gpuFor('shader_pulse_rings');
export function render(x, y, t, p) { return renderByName('shader_pulse_rings', x, y, t, p); }
