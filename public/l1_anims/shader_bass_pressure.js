import { gpuFor, metaFor, renderByName } from '../shader_anim_engine.js';

export const meta = { ...metaFor('shader_bass_pressure'), name: 'Bass Pressure', description: 'bass, kick-reactive pressure waves', params: ["Scale", "Speed", "Kick", "Pressure"] };
export const gpu = gpuFor('shader_bass_pressure');
export const prewarm = { priority: 72, samplePoints: 96, warmOnSelect: true, warmNeighbors: true };

export function render(x, y, t, p) {
  return renderByName('shader_bass_pressure', x, y, t, p);
}
