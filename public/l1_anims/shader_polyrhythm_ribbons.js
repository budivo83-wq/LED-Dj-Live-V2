export const meta = { name: "Polyrhythm Ribbons", description: "interlocking ribbons with nonrepeating polyrhythmic motion", params: ["Voices", "Tempo", "Width", "Color"] };
export const prewarm = { priority: 63, samplePoints: 96, warmOnSelect: true, warmNeighbors: true };
const TAU = Math.PI * 2;
const sat = (v) => Math.max(0, Math.min(1, v));
const hsv = (h, s, v) => { h = ((h % 1) + 1) % 1; const i = Math.floor(h * 6), f = h * 6 - i, q = v * (1 - f * s), p = v * (1 - s), r = v * (1 - (1 - f) * s); return [[v, r, p], [q, v, p], [p, v, r], [p, q, v], [r, p, v], [v, p, q]][i % 6].map((c) => c * 255); };
export function render(x, y, t, p) { const voices = 2 + Math.floor((p[0] ?? .5) * 5), tempo = .2 + (p[1] ?? .5) * 1.2, width = .02 + (p[2] ?? .5) * .15; let v = 0; for (let i = 1; i <= voices; i++) { const fi = i * 1.37; const line = .5 + Math.sin((x * (1.5 + fi) + t * tempo * (1 + i * .113)) * TAU + Math.sin(t * tempo * .37 + fi) * .7) * (.12 + width * (i % 2)); v += Math.exp(-Math.abs(y - line) / width) / i; } const counter = Math.sin((x + y * 1.618 - t * tempo * .23) * TAU * 2.3) * .12; return hsv((p[3] ?? .5) + t * .008 + y * .12, .8, sat(v * .48 + counter + .18)); }
