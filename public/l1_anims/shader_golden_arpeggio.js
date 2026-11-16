import { gpuFor } from '../shader_anim_engine.js';
export const meta = { name: "Golden Arpeggio", description: "golden diagonal arpeggios with evolving syncopation", params: ["Steps", "Tempo", "Swing", "Warmth"] };
export const gpu = gpuFor('shader_golden_arpeggio');
export const prewarm = { priority: 61, samplePoints: 96, warmOnSelect: true, warmNeighbors: true };
const sat = (v) => Math.max(0, Math.min(1, v));
const hsv = (h, s, v) => { h = ((h % 1) + 1) % 1; const i = Math.floor(h * 6), f = h * 6 - i, q = v * (1 - f * s), p = v * (1 - s), r = v * (1 - (1 - f) * s); return [[v, r, p], [q, v, p], [p, v, r], [p, q, v], [r, p, v], [v, p, q]][i % 6].map((c) => c * 255); };
export function render(x, y, t, p) { const steps = 5 + Math.floor((p[0] ?? .5) * 8), tempo = .25 + (p[1] ?? .5) * 1.4, swing = (p[2] ?? .5) * .4, warm = .45 + (p[3] ?? .5) * .55; const phase = x * steps + t * tempo + Math.sin(t * .17) * swing; const note = Math.abs(Math.sin((phase + y * 2.1) * Math.PI)); const sparkle = Math.pow(Math.max(0, Math.sin(t * tempo * 3 + x * 7 - y * 4)), 8); const diagonal = Math.exp(-Math.abs(y - (phase % 1)) * (18 + warm * 24)); return hsv(.09 + warm * .08 + phase * .025, .72, sat(diagonal * .62 + note * .16 + sparkle * .28)); }
