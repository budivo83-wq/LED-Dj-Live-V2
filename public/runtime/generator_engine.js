import { graphToRenderPlan } from './generator_graph.js';

export const GENERATOR_ENGINE_VERSION = 'STEP38V_GENERATOR_BEAT_INTELLIGENCE';

export const GENERATOR_DEFAULT_PATCH = Object.freeze({
  name: 'Psy Tunnel Starter',
  width: 300,
  height: 8,
  bpm: 145,
  energy: 0.72,
  density: 0.62,
  speed: 0.54,
  colorShift: 0.36,
  feedback: 0.28,
  warp: 0.44,
  pulse: 0.50,
  shimmer: 0.30,
  modules: Object.freeze({
    plasma: true,
    tunnel: true,
    grid: true,
    particles: true,
    kaleido: true,
    colorFlow: true,
    gate: false,
    scanline: true,
    liquidGlass: false,
    electricVeins: false,
    fractalSnake: false,
    solarWind: false,
    digitalRain: false,
    magneticParticles: false,
    neonOrganism: false,
    audioPulseField: false,
    output: true
  }),
  macros: Object.freeze([0.72, 0.62, 0.54, 0.36, 0.28, 0.44, 0.50, 0.30])
});

function clamp01(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(1, n));
}

function fract(value) {
  return value - Math.floor(value);
}

function hash2(x, y, seed = 0) {
  return fract(Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453123);
}

function smoothstep(edge0, edge1, value) {
  const t = clamp01((value - edge0) / Math.max(1e-6, edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function nodeWeight(plan, modules, id, fallback = 0) {
  if (modules && modules[id] === false) return 0;
  const aggregate = plan?.moduleWeights?.[id];
  if (Number.isFinite(Number(aggregate))) return clamp01(aggregate, fallback);
  const node = plan?.byId?.[id];
  if (!node) return fallback;
  return node.enabled === false ? 0 : clamp01(node.weight, fallback);
}

function outputWeight(plan, modules) {
  if (modules && modules.output === false) return 0;
  const node = plan?.byId?.output || plan?.output;
  if (!node) return 1;
  return node.enabled === false ? 0 : clamp01(node.weight, 1);
}

// Compiled once per normalized patch. These values are constant for every
// pixel in a frame; calculating them inside renderPixel was a large avoidable
// cost on the 300x8 hot path.
const renderCache = new WeakMap();
function getRenderCache(patch, graphPlan) {
  const cached = renderCache.get(patch);
  if (cached?.graphPlan === graphPlan) return cached;
  const modules = patch.modules || {};
  const macros = Array.isArray(patch.macros) ? patch.macros : [];
  const cache = {
    graphPlan,
    modules,
    outMix: outputWeight(graphPlan, modules),
    plasmaMix: nodeWeight(graphPlan, modules, 'plasma', modules.plasma === false ? 0 : 0.68),
    tunnelMix: nodeWeight(graphPlan, modules, 'tunnel', modules.tunnel === false ? 0 : 0.82),
    gridMix: nodeWeight(graphPlan, modules, 'grid', modules.grid === false ? 0 : 0.48),
    particleMix: nodeWeight(graphPlan, modules, 'particles', modules.particles === false ? 0 : 0.54),
    kaleidoMix: nodeWeight(graphPlan, modules, 'kaleido', modules.kaleido === false ? 0 : 0.38),
    colorFlowMix: nodeWeight(graphPlan, modules, 'colorFlow', modules.colorFlow === false ? 0 : 0.72),
    gateMix: nodeWeight(graphPlan, modules, 'gate', modules.gate === false ? 0 : 0),
    scanlineMix: nodeWeight(graphPlan, modules, 'scanline', modules.scanline === false ? 0 : 0.34),
    liquidGlassMix: nodeWeight(graphPlan, modules, 'liquidGlass', 0),
    electricVeinsMix: nodeWeight(graphPlan, modules, 'electricVeins', 0),
    fractalSnakeMix: nodeWeight(graphPlan, modules, 'fractalSnake', 0),
    solarWindMix: nodeWeight(graphPlan, modules, 'solarWind', 0),
    digitalRainMix: nodeWeight(graphPlan, modules, 'digitalRain', 0),
    magneticParticlesMix: nodeWeight(graphPlan, modules, 'magneticParticles', 0),
    neonOrganismMix: nodeWeight(graphPlan, modules, 'neonOrganism', 0),
    audioPulseFieldMix: nodeWeight(graphPlan, modules, 'audioPulseField', 0),
    energy: clamp01(patch.energy ?? macros[0], GENERATOR_DEFAULT_PATCH.energy),
    density: clamp01(patch.density ?? macros[1], GENERATOR_DEFAULT_PATCH.density),
    speed: clamp01(patch.speed ?? macros[2], GENERATOR_DEFAULT_PATCH.speed),
    colorShift: clamp01(patch.colorShift ?? macros[3], GENERATOR_DEFAULT_PATCH.colorShift),
    feedback: clamp01(patch.feedback ?? macros[4], GENERATOR_DEFAULT_PATCH.feedback),
    warp: clamp01(patch.warp ?? macros[5], GENERATOR_DEFAULT_PATCH.warp),
    pulse: clamp01(patch.pulse ?? macros[6], GENERATOR_DEFAULT_PATCH.pulse),
    shimmer: clamp01(patch.shimmer ?? macros[7], GENERATOR_DEFAULT_PATCH.shimmer)
  };
  renderCache.set(patch, cache);
  return cache;
}

function hsvToRgb(h, s, v) {
  const hue = fract(h) * 6;
  const i = Math.floor(hue);
  const f = hue - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const m = i % 6;
  if (m === 0) return packRgb(v, t, p);
  if (m === 1) return packRgb(q, v, p);
  if (m === 2) return packRgb(p, v, t);
  if (m === 3) return packRgb(p, q, v);
  if (m === 4) return packRgb(t, p, v);
  return packRgb(v, p, q);
}

function packRgb(r, g, b) {
  return (Math.max(0, Math.min(255, Math.round(r * 255))) << 16)
    | (Math.max(0, Math.min(255, Math.round(g * 255))) << 8)
    | Math.max(0, Math.min(255, Math.round(b * 255)));
}

function renderPixel(x, y, width, height, time, beat, patch, graphPlan) {
  const cache = getRenderCache(patch, graphPlan);
  const { modules, outMix, plasmaMix, tunnelMix, gridMix, particleMix,
    kaleidoMix, colorFlowMix, gateMix, scanlineMix, liquidGlassMix,
    electricVeinsMix, fractalSnakeMix, solarWindMix, digitalRainMix,
    magneticParticlesMix, neonOrganismMix, audioPulseFieldMix, energy,
    density, speed, colorShift, feedback, warp, pulse, shimmer } = cache;
  if (outMix <= 0.001) return 0;
  let nx = (x / Math.max(1, width - 1)) * 2 - 1;
  let ny = (y / Math.max(1, height - 1)) * 2 - 1;
  if (kaleidoMix > 0.001) {
    const folds = 2 + Math.round(kaleidoMix * 5);
    const angle = Math.atan2(ny, nx);
    const radius = Math.hypot(nx, ny);
    const folded = Math.abs(((angle / Math.PI) * folds + time * (0.05 + speed * 0.12)) % 2 - 1);
    nx = Math.cos(folded * Math.PI) * radius;
    ny = Math.sin(folded * Math.PI) * radius * Math.sign(ny || 1);
  }
  const aspect = width / Math.max(1, height);
  const liquidLens = liquidGlassMix * Math.sin(nx * (8.0 + density * 14.0) + time * (0.8 + speed * 2.0)) * Math.cos(ny * (5.0 + warp * 10.0) - time * 1.2) * 0.12;
  const windShear = solarWindMix * Math.sin(ny * (3.0 + density * 12.0) + time * (1.0 + speed * 5.0)) * 0.10;
  const warpWave = Math.sin(time * (0.55 + speed * 1.25) + ny * (2.0 + density * 8.0)) * warp * 0.16;
  const ax = (nx + warpWave + liquidLens + windShear) * Math.min(1.8, aspect / 10);
  const ay = ny + Math.cos(time * (0.42 + speed) + nx * 5.0) * warp * 0.08 + liquidGlassMix * Math.sin(nx * 11.0 - time * 1.7) * 0.05;
  const r = Math.hypot(ax, ay);
  const a = Math.atan2(ay, ax) / Math.PI;
  const t = time * (0.2 + speed * 1.7);
  const beatContext = patch.beatContext && typeof patch.beatContext === 'object' ? patch.beatContext : {};
  const externalAccent = clamp01(beatContext.accent, 0);
  const dropAccent = clamp01(beatContext.dropAccent, 0);
  const phraseAccent = clamp01(beatContext.phraseAccent, 0);
  const beatPulse = Math.max(0.5 + 0.5 * Math.sin(beat * Math.PI * 2), externalAccent * 0.92, dropAccent);
  const macroPulse = 0.65 + pulse * beatPulse * 0.72 + dropAccent * 0.12;
  let field = 0;

  if (plasmaMix > 0.001) {
    field += plasmaMix * 0.48 * (0.5 + 0.5 * Math.sin((nx * 10.2 + t * 3.1) + Math.sin(ny * 4.4 + t)));
    field += plasmaMix * 0.30 * (0.5 + 0.5 * Math.sin((ny * 7.4 - t * 2.4) + Math.cos(nx * 5.2 - t * 0.7)));
  }
  if (tunnelMix > 0.001) {
    const tunnel = Math.sin((1 / Math.max(0.04, r + 0.12)) * (2.0 + density * 6.5) + a * (8 + density * 16) - t * 5.2);
    field += tunnelMix * 0.56 * (0.5 + 0.5 * tunnel);
  }
  if (gridMix > 0.001) {
    const gx = Math.abs(Math.sin((x / width) * Math.PI * (8 + density * 36) - t * 3));
    const gy = Math.abs(Math.sin((y / height) * Math.PI * (2 + density * 10) + t * 1.7));
    const grid = 1 - Math.min(gx, gy);
    field += gridMix * 0.34 * smoothstep(0.78, 0.98, grid);
  }
  if (particleMix > 0.001) {
    const cell = Math.floor(x / Math.max(1, 24 - density * 18));
    const rowSeed = hash2(cell, y, Math.floor(t * (1 + speed * 7)));
    const sparkle = rowSeed > 0.94 - energy * 0.04 - shimmer * 0.08 ? 1 : 0;
    field += sparkle * particleMix * (0.16 + energy * 0.30 + shimmer * 0.36);
  }
  if (liquidGlassMix > 0.001) {
    const glass = 0.5 + 0.5 * Math.sin((nx + Math.sin(ny * 3.0 + t)) * (7.5 + density * 15.0) + Math.sin(t * 1.7 + r * 8.0));
    field += liquidGlassMix * 0.38 * Math.pow(glass, 1.7);
  }
  if (fractalSnakeMix > 0.001) {
    const snakePath = Math.sin((x / width) * Math.PI * (2.5 + density * 7.0) - t * (2.0 + speed * 3.0));
    const snakeBody = 1 - Math.min(1, Math.abs(ny - snakePath * (0.32 + warp * 0.28)) * (3.2 + density * 8.0));
    const scales = 0.5 + 0.5 * Math.sin((x + y * 9) * (0.10 + density * 0.18) + t * 3.0);
    field += fractalSnakeMix * (0.25 + energy * 0.30) * Math.max(0, snakeBody) * (0.45 + scales * 0.55);
  }
  if (neonOrganismMix > 0.001) {
    const cells = Math.sin(nx * (6.0 + density * 10.0) + Math.sin(t + ny * 5.0)) * Math.sin(ny * (5.0 + density * 8.0) - t * (0.8 + speed));
    const membrane = smoothstep(0.18, 0.74, Math.abs(cells));
    const core = 1 - smoothstep(0.10, 0.68, Math.abs(cells));
    field += neonOrganismMix * (0.18 * membrane + 0.38 * core * (0.5 + beatPulse * pulse));
  }
  if (solarWindMix > 0.001) {
    const streak = Math.pow(0.5 + 0.5 * Math.sin((x / width) * Math.PI * (16 + density * 32) - t * (6.0 + speed * 10.0) + y * 1.7), 7.0);
    field += solarWindMix * streak * (0.10 + energy * 0.28 + shimmer * 0.14);
  }
  if (magneticParticlesMix > 0.001) {
    const poleA = Math.sin(t * 0.7) * 0.42;
    const poleB = Math.cos(t * 0.55) * 0.42;
    const distA = Math.hypot(nx - poleA, ny - Math.sin(t * 0.41) * 0.45);
    const distB = Math.hypot(nx - poleB, ny - Math.cos(t * 0.37) * 0.45);
    const rings = Math.pow(1 - smoothstep(0.02, 0.34 + density * 0.18, Math.min(distA, distB)), 1.4);
    const grain = hash2(Math.floor(x / 3), y, Math.floor(t * (2 + speed * 6)));
    field += magneticParticlesMix * rings * (0.16 + grain * 0.32 + shimmer * 0.20);
  }
  if (electricVeinsMix > 0.001) {
    const veinCore = Math.abs(Math.sin((nx * 18.0 + ny * 9.0) + Math.sin(ny * 12.0 + t * 4.0) + t * (2.4 + speed * 5.0)));
    const vein = smoothstep(0.955 - energy * 0.04, 0.995, veinCore);
    const flicker = 0.55 + 0.45 * hash2(Math.floor(x / 4), y, Math.floor(t * 24));
    field += electricVeinsMix * vein * flicker * (0.25 + shimmer * 0.55);
  }
  if (digitalRainMix > 0.001) {
    const col = Math.floor(x / Math.max(2, 12 - density * 7));
    const dropHead = fract((y / height) + hash2(col, 0, 11) + t * (0.18 + speed * 0.75));
    const trail = Math.pow(1 - Math.abs(dropHead - 0.08) * 5.0, 5.0);
    const glyph = hash2(col, Math.floor((y + t * 18) / 1.7), Math.floor(beat * 2));
    field += digitalRainMix * Math.max(0, trail) * (0.14 + glyph * 0.28 + energy * 0.14);
  }
  if (audioPulseFieldMix > 0.001) {
    const pulseRing = 1 - Math.min(1, Math.abs(fract(r * (2.0 + density * 5.0) - beat * (0.55 + speed * 0.65)) - 0.08) * (6.0 + density * 10.0));
    field += audioPulseFieldMix * Math.max(0, pulseRing) * (0.14 + pulse * 0.42 + energy * 0.18 + externalAccent * 0.22 + dropAccent * 0.28);
  }

  field = Math.max(0, Math.min(1.8, field));
  let v = Math.min(1, Math.pow(field / 1.18, 0.85) * (0.55 + energy * 0.75));
  v *= (0.68 + beatPulse * energy * 0.22 + phraseAccent * 0.035 + dropAccent * 0.08) * macroPulse;
  if (gateMix > 0.001) {
    const gateThreshold = dropAccent > 0.05 ? -0.42 : -0.15;
    const gate = Math.sin(beat * Math.PI * (4 + Math.round(density * 12))) > gateThreshold ? 1 : 0.16;
    v *= 1 - gateMix + gateMix * gate;
  }
  if (scanlineMix > 0.001) {
    const scan = 0.5 + 0.5 * Math.sin((y + beat * (1 + speed * 5)) * Math.PI * (0.75 + density * 1.5));
    v *= 1 + scanlineMix * shimmer * (scan - 0.5) * 0.65;
  }
  if (electricVeinsMix > 0.001 || digitalRainMix > 0.001) {
    v *= 1 + (electricVeinsMix * 0.18 + digitalRainMix * 0.12) * (0.5 + beatPulse * pulse);
  }
  v *= outMix;
  const hue = colorShift + field * (0.08 + colorFlowMix * (0.18 + shimmer * 0.14)) + a * (0.04 + colorFlowMix * (0.08 + warp * 0.16)) + t * (0.012 + colorFlowMix * (0.035 + speed * 0.03)) + feedback * 0.18
    + liquidGlassMix * 0.045 * Math.sin(t + r * 8.0)
    + electricVeinsMix * 0.055
    + fractalSnakeMix * 0.075 * Math.sin(nx * 2.0 + t)
    + solarWindMix * 0.040 * Math.sin(ny * 4.0 + t * 2.0)
    + digitalRainMix * 0.18
    + magneticParticlesMix * 0.060 * Math.cos(t + r * 4.0)
    + neonOrganismMix * 0.10 * Math.sin(field * 5.0 + t * 0.7)
    + audioPulseFieldMix * 0.050 * beatPulse
    + externalAccent * 0.018
    + dropAccent * 0.035;
  const sat = 0.72 + energy * 0.26;
  return hsvToRgb(hue, sat, Math.min(1, v));
}

export function normalizeGeneratorPatch(input = {}) {
  const modules = { ...GENERATOR_DEFAULT_PATCH.modules, ...(input.modules || {}) };
  const macros = Array.from({ length: 8 }, (_, index) => clamp01(input.macros?.[index], GENERATOR_DEFAULT_PATCH.macros[index] ?? 0.5));
  return {
    ...GENERATOR_DEFAULT_PATCH,
    ...input,
    width: Math.max(1, Math.trunc(Number(input.width || GENERATOR_DEFAULT_PATCH.width) || GENERATOR_DEFAULT_PATCH.width)),
    height: Math.max(1, Math.trunc(Number(input.height || GENERATOR_DEFAULT_PATCH.height) || GENERATOR_DEFAULT_PATCH.height)),
    bpm: Math.max(40, Math.min(220, Number(input.bpm || GENERATOR_DEFAULT_PATCH.bpm) || GENERATOR_DEFAULT_PATCH.bpm)),
    energy: clamp01(input.energy ?? macros[0], GENERATOR_DEFAULT_PATCH.energy),
    density: clamp01(input.density ?? macros[1], GENERATOR_DEFAULT_PATCH.density),
    speed: clamp01(input.speed ?? macros[2], GENERATOR_DEFAULT_PATCH.speed),
    colorShift: clamp01(input.colorShift ?? macros[3], GENERATOR_DEFAULT_PATCH.colorShift),
    feedback: clamp01(input.feedback ?? macros[4], GENERATOR_DEFAULT_PATCH.feedback),
    warp: clamp01(input.warp ?? macros[5], GENERATOR_DEFAULT_PATCH.warp),
    pulse: clamp01(input.pulse ?? macros[6], GENERATOR_DEFAULT_PATCH.pulse),
    shimmer: clamp01(input.shimmer ?? macros[7], GENERATOR_DEFAULT_PATCH.shimmer),
    modules,
    macros
  };
}

export function renderGeneratorFrame(options = {}) {
  const patch = options.normalizedPatch === true
    ? (options.patch || GENERATOR_DEFAULT_PATCH)
    : normalizeGeneratorPatch(options.patch || options);
  const width = Math.max(1, Math.trunc(Number(options.width || patch.width) || patch.width));
  const height = Math.max(1, Math.trunc(Number(options.height || patch.height) || patch.height));
  const time = Number(options.time ?? performance.now() / 1000) || 0;
  const bpm = Number(options.bpm || patch.bpm || 145) || 145;
  const beat = Number(options.beat ?? (time * bpm / 60)) || 0;
  const graphPlan = options.graphPlan || graphToRenderPlan(options.graph || patch.graph || { nodes: [] });
  const frame = new Uint8Array(width * height * 3);
  let offset = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const rgb = renderPixel(x, y, width, height, time, beat, patch, graphPlan);
      frame[offset++] = (rgb >> 16) & 255;
      frame[offset++] = (rgb >> 8) & 255;
      frame[offset++] = rgb & 255;
    }
  }
  return { frame, width, height, patch, graphPlan, meta: { version: GENERATOR_ENGINE_VERSION, time, beat, bpm, graphVersion: graphPlan.version } };
}

export function paintGeneratorFrameToCanvas(canvas, rendered) {
  if (!canvas || !rendered?.frame) return false;
  const { frame, width, height } = rendered;
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const paintState = getCanvasPaintState(canvas, width, height);
  if (!paintState) return false;
  const { ctx, image } = paintState;
  for (let src = 0, dst = 0; src < frame.length; src += 3, dst += 4) {
    image.data[dst] = frame[src];
    image.data[dst + 1] = frame[src + 1];
    image.data[dst + 2] = frame[src + 2];
    image.data[dst + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  return true;
}

const canvasPaintStates = new WeakMap();
function getCanvasPaintState(canvas, width, height) {
  let state = canvasPaintStates.get(canvas);
  if (!state || state.width !== width || state.height !== height) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return null;
    state = { width, height, ctx, image: ctx.createImageData(width, height) };
    canvasPaintStates.set(canvas, state);
  }
  return state;
}
