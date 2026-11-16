import { gpuFor, metaFor, renderByName } from '../shader_anim_engine.js';
export const meta = { ...metaFor('shader_chord_rain'), name: 'Chord Rain', description: 'falling chord tones with luminous releases' };
export const gpu = gpuFor('shader_chord_rain');
export const prewarm = { priority: 66, samplePoints: 96, warmOnSelect: true, warmNeighbors: true };
export function render(x, y, t, p) { return renderByName('shader_chord_rain', x, y, t, p); }
