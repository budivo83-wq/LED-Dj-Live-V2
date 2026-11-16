import { gpuFor } from '../shader_anim_engine.js';
export const meta = { name: "Synthwave Tides", description: "layered synth tides with gentle phase drift", params: ["Layers", "Tempo", "Tide", "Neon"] };
export const gpu = gpuFor('shader_synthwave_tides');
export const prewarm = { priority: 60, samplePoints: 96, warmOnSelect: true, warmNeighbors: true };
const sat = (v) => Math.max(0, Math.min(1, v));
const hsv = (h, s, v) => { h = ((h % 1) + 1) % 1; const i = Math.floor(h * 6), f = h * 6 - i, q = v * (1 - f * s), p = v * (1 - s), r = v * (1 - (1 - f) * s); return [[v, r, p], [q, v, p], [p, v, r], [p, q, v], [r, p, v], [v, p, q]][i % 6].map((c) => c * 255); };
export function render(x, y, t, p) { const layers = 2 + Math.floor((p[0] ?? .5) * 5), tempo = .15 + (p[1] ?? .5) * .8, tide = .08 + (p[2] ?? .5) * .28, neon = .4 + (p[3] ?? .5) * .8; let v = 0; for (let i = 0; i < layers; i++) { const fi = i + 1; const crest = .2 + i / layers * .62 + Math.sin(x * (2.1 + fi * .7) + t * tempo * (1 + fi * .09)) * tide; v += Math.exp(-Math.abs(y - crest) * (26 + neon * 24)) / fi; } const haze = .08 * Math.sin((x * 3.7 - y * 2.3 + t * tempo * .4) * Math.PI); return hsv(.72 + x * .16 + t * .01, .7, sat(v * .42 + haze + .12)); }
