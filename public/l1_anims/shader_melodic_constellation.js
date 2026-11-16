import { gpuFor } from '../shader_anim_engine.js';
export const meta = { name: "Melodic Constellation", description: "slow constellation phrases with drifting harmonic stars", params: ["Density", "Tempo", "Drift", "Glow"] };
export const gpu = gpuFor('shader_melodic_constellation');
export const prewarm = { priority: 64, samplePoints: 96, warmOnSelect: true, warmNeighbors: true };
const TAU = Math.PI * 2;
const sat = (v) => Math.max(0, Math.min(1, v));
const hash = (n) => (Math.sin(n * 91.73) * 43758.5453) % 1;
const hsv = (h, s, v) => { h = ((h % 1) + 1) % 1; const i = Math.floor(h * 6), f = h * 6 - i, q = v * (1 - f * s), p = v * (1 - s), r = v * (1 - (1 - f) * s); return [[v, r, p], [q, v, p], [p, v, r], [p, q, v], [r, p, v], [v, p, q]][i % 6].map((c) => c * 255); };
export function render(x, y, t, p) { const density = 3 + Math.floor((p[0] ?? .5) * 8), tempo = .12 + (p[1] ?? .5) * .55, drift = .08 + (p[2] ?? .5) * .32, glow = .35 + (p[3] ?? .5) * .8; let v = 0; for (let i = 0; i < 10; i++) { const phase = hash(i + 4) * TAU + t * tempo * (1 + (i % 3) * .071); const cx = .5 + Math.sin(phase * (1.01 + i * .013)) * (.18 + hash(i) * .3); const cy = .5 + Math.cos(phase * (1.07 + i * .017)) * (.18 + hash(i + 3) * .26); const d = Math.hypot(x - cx, y - cy); v += Math.exp(-d * (24 + density * 3)) * (.5 + .5 * Math.sin(phase * 1.7 + i)); } v += .12 * Math.sin((x * 3.1 + y * 5.7 + t * drift) * TAU) + .08 * Math.sin((x * 8.3 - y * 2.7 - t * drift * 1.7) * TAU); return hsv(.58 + x * .18 + y * .1 + t * .006, .68, sat(v * glow)); }
