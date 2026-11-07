const PARAMS = ["Scale", "Speed", "Shape", "Intensity"];

const TAU = Math.PI * 2;

export function metaFor(name) {
  return { params: paramsFor(name) };
}

export function renderByName(name, x, y, t, p) {
  const scale = p[0] ?? 0.5;
  const speed = p[1] ?? 0.5;
  const shape = p[2] ?? 0.5;
  const intensity = p[3] ?? 0.5;
  const nx = x;
  const ny = y;

  switch (slug(name)) {
    case "diagonal_sweep":
      return diagonalSweep(nx, ny, t, scale, speed, shape, intensity);
    case "domain_warp":
      return domainWarp(nx, ny, t, scale, speed, shape, intensity);
    case "plasma":
      return plasma(nx, ny, t, scale, speed, shape, intensity);
    case "plasma_iq":
      return plasmaIq(nx, ny, t, scale, speed, shape, intensity);
    case "reaction_difusion":
    case "reaction_diffusion":
      return reactionDiffusion(nx, ny, t, scale, speed, shape, intensity);
    case "ripple":
      return ripple(nx, ny, t, scale, speed, shape, intensity);
    case "spiral_galaxy":
      return spiralGalaxy(nx, ny, t, scale, speed, shape, intensity);
    case "wave":
      return wave(nx, ny, t, scale, speed, shape, intensity);
    case "caustics":
      return caustics(nx, ny, t, scale, speed, shape, intensity);
    case "hearthbeat":
    case "heartbeat":
      return heartbeat(nx, ny, t, scale, speed, shape, intensity);
    case "hypnotic_atractor":
    case "hypnotic_attractor":
      return hypnoticAttractor(nx, ny, t, scale, speed, shape, intensity);
    case "interference_field":
      return interferenceField(nx, ny, t, scale, speed, shape, intensity);
    case "radar":
      return radar(nx, ny, t, scale, speed, shape, intensity);
    case "radar_scan":
      return radarScan(nx, ny, t, scale, speed, shape, intensity);
    case "scan":
      return scan(nx, ny, t, scale, speed, shape, intensity);
    case "twinkle_stars":
      return twinkleStars(nx, ny, t, scale, speed, shape, intensity);
    case "voronoi_flow":
      return voronoiFlow(nx, ny, t, scale, speed, shape, intensity);
    case "wormhole":
      return wormhole(nx, ny, t, scale, speed, shape, intensity);
    case "kaleidoscope":
      return kaleidoscope(nx, ny, t, scale, speed, shape, intensity);
    case "meteor_rain":
      return meteorRain(nx, ny, t, scale, speed, shape, intensity);
    case "pixel_sort":
      return pixelSort(nx, ny, t, scale, speed, shape, intensity);
    case "liquid_metal":
      return liquidMetal(nx, ny, t, scale, speed, shape, intensity);
    case "electric_storm":
      return electricStorm(nx, ny, t, scale, speed, shape, intensity);
    case "prism_bands":
      return prismBands(nx, ny, t, scale, speed, shape, intensity);
    case "comet_tail":
      return cometTail(nx, ny, t, scale, speed, shape, intensity);
    case "matrix_rain":
      return matrixRain(nx, ny, t, scale, speed, shape, intensity);
    case "orbit_dots":
      return orbitDots(nx, ny, t, scale, speed, shape, intensity);
    case "lava_lamp":
      return lavaLamp(nx, ny, t, scale, speed, shape, intensity);
    case "photon_tunnel":
      return photonTunnel(nx, ny, t, scale, speed, shape, intensity);
    case "ribbon_twist":
      return ribbonTwist(nx, ny, t, scale, speed, shape, intensity);
    case "bloom_pulse":
      return bloomPulse(nx, ny, t, scale, speed, shape, intensity);
    case "grid_runner":
      return gridRunner(nx, ny, t, scale, speed, shape, intensity);
    default:
      return plasma(nx, ny, t, scale, speed, shape, intensity);
  }
}

function paramsFor(name) {
  const common = {
    diagonal_sweep: ["Scale", "Speed", "Angle", "Width"],
    domain_warp: ["Scale", "Speed", "Warp", "Intensity"],
    plasma: ["Scale", "Speed", "Power", "Intensity"],
    plasma_iq: ["Scale", "Speed", "Iterations", "Glow"],
    reaction_difusion: ["Scale", "Speed", "Edge", "Intensity"],
    reaction_diffusion: ["Scale", "Speed", "Edge", "Intensity"],
    ripple: ["Scale", "Speed", "Depth", "Intensity"],
    spiral_galaxy: ["Scale", "Speed", "Arms", "Core"],
    wave: ["Scale", "Speed", "Phase", "Width"],
    caustics: ["Scale", "Speed", "Sharpness", "Drift"],
    hearthbeat: ["Scale", "Speed", "Sharpness", "Falloff"],
    heartbeat: ["Scale", "Speed", "Sharpness", "Falloff"],
    hypnotic_atractor: ["Scale", "Speed", "Iterations", "Brightness"],
    hypnotic_attractor: ["Scale", "Speed", "Iterations", "Brightness"],
    interference_field: ["Scale", "Speed", "Frequency", "Depth"],
    radar: ["Scale", "Speed", "Radius", "Thickness"],
    radar_scan: ["Scale", "Speed", "Tail", "Focus"],
    scan: ["Scale", "Speed", "Phase", "Width"],
    twinkle_stars: ["Scale", "Speed", "Density", "Spark"],
    voronoi_flow: ["Scale", "Speed", "Contrast", "Cell Drift"],
    wormhole: ["Scale", "Speed", "Twist", "Pulse"],
    kaleidoscope: ["Scale", "Speed", "Segments", "Intensity"],
    meteor_rain: ["Scale", "Speed", "Density", "Trail"],
    pixel_sort: ["Scale", "Speed", "Threshold", "Blocks"],
    liquid_metal: ["Scale", "Speed", "Flow", "Shine"],
    electric_storm: ["Scale", "Speed", "Forks", "Glow"],
    prism_bands: ["Scale", "Speed", "Angle", "Width"],
    comet_tail: ["Scale", "Speed", "Density", "Trail"],
    matrix_rain: ["Scale", "Speed", "Columns", "Fade"],
    orbit_dots: ["Scale", "Speed", "Count", "Glow"],
    lava_lamp: ["Scale", "Speed", "Blob Size", "Softness"],
    photon_tunnel: ["Scale", "Speed", "Twist", "Depth"],
    ribbon_twist: ["Scale", "Speed", "Ribbon", "Contrast"],
    bloom_pulse: ["Scale", "Speed", "Bloom", "Falloff"],
    grid_runner: ["Scale", "Speed", "Grid", "Width"]
  };
  return common[slug(name)] || PARAMS;
}

function diagonalSweep(x, y, t, scale, speed, angle, width) {
  const a = angle * Math.PI;
  const d = x * Math.cos(a) + y * Math.sin(a);
  const band = 0.03 + width * 0.24;
  const v = repeat(d * (2 + scale * 8) - t * (0.2 + speed * 2));
  return clamp01(1 - Math.abs(v - 0.5) / band);
}

function domainWarp(x, y, t, scale, speed, warp, intensity) {
  const s = 2 + scale * 14;
  const spd = 0.15 + speed * 1.4;
  const w = 0.4 + warp * 2.2;
  const qx = x * s + Math.sin(y * s * 0.9 + t * spd) * w;
  const qy = y * s + Math.cos(x * s * 1.1 - t * spd * 1.3) * w;
  const v = Math.sin(qx + Math.sin(qy + t * spd)) + Math.cos(qy - Math.sin(qx));
  return lift(v / 2, intensity);
}

function plasma(x, y, t, scale, speed, power, intensity) {
  const s = 3 + scale * 20;
  const spd = 0.2 + speed * 2.5;
  let v = Math.sin(x * s + t * spd) + Math.sin(y * s * 1.3 - t * spd * 0.8);
  v += Math.sin((x + y) * s * 0.7 + t * spd * 1.4);
  return lift(Math.pow(v / 6 + 0.5, 0.5 + power * 2.5), intensity);
}

function plasmaIq(x, y, t, scale, speed, detail, glow) {
  let zx = (x - 0.5) * (1 + scale * 4);
  let zy = (y - 0.5) * (1 + scale * 4);
  const cr = Math.cos(t * (0.1 + speed)) * 0.38;
  const ci = Math.sin(t * (0.12 + speed * 0.8)) * 0.38;
  const maxIter = 4 + Math.floor(detail * 8);
  for (let i = 0; i < maxIter; i++) {
    const xx = zx * zx - zy * zy + cr;
    zy = 2 * zx * zy + ci;
    zx = xx;
    if (zx * zx + zy * zy > 4) return lift(i / maxIter, glow);
  }
  return lift(Math.sin(zx * 4 + zy * 3) * 0.5 + 0.5, glow);
}

function reactionDiffusion(x, y, t, scale, speed, edge, intensity) {
  const s = 4 + scale * 22;
  const spd = 0.05 + speed * 0.8;
  const a = Math.sin(x * s + Math.cos(y * s * 0.8 + t * spd));
  const b = Math.cos(y * s + Math.sin(x * s * 1.1 - t * spd * 1.4));
  const v = Math.sin(a * b * (2 + edge * 8) + t * spd);
  return lift(Math.pow(v * 0.5 + 0.5, 0.6 + edge * 3), intensity);
}

function ripple(x, y, t, scale, speed, depth, intensity) {
  const dx = x - 0.5;
  const dy = y - 0.5;
  const r = Math.sqrt(dx * dx + dy * dy);
  const rings = 5 + scale * 35;
  const v = Math.sin(r * rings - t * (0.4 + speed * 4));
  return lift(v * (0.25 + depth * 0.75), intensity);
}

function spiralGalaxy(x, y, t, scale, speed, armsParam, coreParam) {
  const dx = x - 0.5;
  const dy = y - 0.5;
  const r = Math.sqrt(dx * dx + dy * dy) + 0.001;
  const angle = Math.atan2(dy, dx);
  const arms = 2 + Math.floor(armsParam * 7);
  const tight = 1 + scale * 10;
  const spiral = angle - tight * Math.log(r) - t * (0.2 + speed * 2);
  const arm = Math.pow(Math.max(0, Math.cos(arms * spiral)), 2.5);
  const core = Math.exp(-(r * r) / Math.pow(0.04 + coreParam * 0.2, 2));
  return clamp01(arm * Math.exp(-r * 3.5) + core);
}

function wave(x, y, t, scale, speed, phase, width) {
  const freq = 2 + scale * 18;
  const v = Math.sin(x * freq + y * freq * phase - t * (0.5 + speed * 4));
  return smoothBand(v * 0.5 + 0.5, 0.5, 0.08 + width * 0.35);
}

function caustics(x, y, t, scale, speed, sharp, drift) {
  const s = 3 + scale * 12;
  const spd = 0.2 + speed * 1.6;
  const w = (px, py, ph) => Math.sin(px * s + Math.sin(py * s * 0.8 + ph)) + Math.sin(py * s * 1.1 - Math.sin(px * s * 0.9 + ph * 1.3));
  const v = (w(x, y, t * spd) + w(x + drift * 0.1, y, t * spd * 0.7 + 1) + w(x, y + drift * 0.1, t * spd * 1.4 + 2.1)) / 6 + 0.5;
  return Math.pow(clamp01(v), 1 + sharp * 8);
}

function heartbeat(x, y, t, scale, speed, sharp, falloff) {
  const dx = x - 0.5;
  const dy = y - 0.5;
  const r = Math.sqrt(dx * dx + dy * dy) * (1 + scale * 2);
  const beat = Math.pow(Math.max(0, Math.sin(t * (0.5 + speed * 3) * Math.PI)), 2 + sharp * 12);
  return clamp01(beat - r * (0.8 + falloff * 3));
}

function hypnoticAttractor(x, y, t, scale, speed, iterations, brightness) {
  let px = (x - 0.5) * (2 + scale * 4);
  let py = (y - 0.5) * (2 + scale * 4);
  let density = 0;
  const count = 16 + Math.floor(iterations * 42);
  const spd = 0.03 + speed * 0.5;
  const a = 1.7 + Math.sin(t * spd) * 0.8;
  const b = -1.3 + Math.cos(t * spd * 0.7) * 0.5;
  const c = 0.5 + Math.sin(t * spd * 1.3) * 0.3;
  const d = -1.7 + Math.cos(t * spd * 0.9) * 0.5;
  for (let i = 0; i < count; i++) {
    const nx = Math.sin(a * py) + c * Math.cos(a * px);
    const ny = Math.sin(b * px) + d * Math.cos(b * py);
    const dist = Math.hypot(nx - (x - 0.5) * 4, ny - (y - 0.5) * 4);
    density += Math.exp(-dist * 8);
    px = nx;
    py = ny;
  }
  return clamp01(Math.pow((density / count) * (1 + brightness * 5), 0.5));
}

function interferenceField(x, y, t, scale, speed, freqParam, depth) {
  const spd = 0.3 + speed * 3;
  const freq = 5 + scale * 25 + freqParam * 15;
  const sources = [
    [0.5 + 0.3 * Math.cos(t * spd), 0.5 + 0.3 * Math.sin(t * spd)],
    [0.5 + 0.3 * Math.cos(t * spd + Math.PI), 0.5 + 0.3 * Math.sin(t * spd + Math.PI)],
    [0.5 + 0.2 * Math.cos(t * spd * 1.7 + 1), 0.5 + 0.2 * Math.sin(t * spd * 1.7 + 1)]
  ];
  let v = 0;
  for (const [sx, sy] of sources) v += Math.sin(Math.hypot(x - sx, y - sy) * freq - t * spd * 2);
  return lift(v / sources.length, depth);
}

function radar(x, y, t, scale, speed, radiusParam, thickness) {
  const r = Math.hypot(x - 0.5, y - 0.5);
  const radius = repeat(t * (0.1 + speed * 0.8)) * (0.25 + radiusParam * 0.65);
  const band = 0.01 + thickness * 0.09;
  return clamp01(1 - Math.abs(r * (1 + scale * 1.5) - radius) / band);
}

function radarScan(x, y, t, scale, speed, tail, focus) {
  const angle = Math.atan2(y - 0.5, x - 0.5);
  const sweep = repeat(t * (0.04 + speed * 0.25)) * TAU;
  let diff = Math.abs(wrapAngle(angle - sweep));
  const beam = clamp01(1 - diff / (0.1 + tail * 1.2));
  const r = Math.hypot(x - 0.5, y - 0.5);
  return Math.pow(beam, 1 + focus * 4) * clamp01(1 - r * scale);
}

function scan(x, y, t, scale, speed, phase, width) {
  const pos = repeat(t * (0.1 + speed * 1.5) + phase);
  const axis = phase < 0.5 ? x : y;
  return clamp01(1 - Math.abs(axis * (1 + scale * 0.2) - pos) / (0.02 + width * 0.18));
}

function twinkleStars(x, y, t, scale, speed, density, spark) {
  const gx = Math.floor(x * (10 + scale * 80));
  const gy = Math.floor(y * (3 + scale * 20));
  const seed = rand(gx, gy);
  if (seed > 0.08 + density * 0.6) return 0;
  const blink = Math.pow(Math.abs(Math.sin((seed + t * (0.3 + speed * 5)) * Math.PI)), 4 + spark * 12);
  return blink;
}

function voronoiFlow(x, y, t, scale, speed, contrast, drift) {
  const s = 3 + scale * 12;
  const px = x * s;
  const py = y * s;
  let closest = 99;
  for (let gy = -1; gy <= 1; gy++) {
    for (let gx = -1; gx <= 1; gx++) {
      const cx = Math.floor(px) + gx;
      const cy = Math.floor(py) + gy;
      const seed = rand(cx, cy);
      const fx = repeat(seed * 13.13 + Math.sin(t * (0.1 + speed) + seed) * drift);
      const fy = repeat(seed * 17.17 + Math.cos(t * (0.12 + speed * 1.3) + seed) * drift);
      closest = Math.min(closest, Math.hypot(cx + fx - px, cy + fy - py));
    }
  }
  return Math.pow(1 - Math.min(closest, 1), 1 + contrast * 5);
}

function wormhole(x, y, t, scale, speed, twist, pulse) {
  const dx = x - 0.5;
  const dy = y - 0.5;
  const r = Math.hypot(dx, dy) + 0.001;
  const angle = Math.atan2(dy, dx);
  const u = 1 / r;
  const ring = Math.sin(u * (4 + scale * 22) - t * (0.4 + speed * 4) * (1 + pulse * 3));
  const helix = Math.sin((angle + twist * 8 * r + t * speed) * 4 + u * 3);
  return Math.pow((ring * helix) * 0.5 + 0.5, 1.4);
}

function kaleidoscope(x, y, t, scale, speed, segments, intensity) {
  const dx = x - 0.5;
  const dy = y - 0.5;
  const r = Math.hypot(dx, dy);
  const segs = 3 + Math.floor(segments * 10);
  let a = Math.atan2(dy, dx);
  a = Math.abs(((a * segs + t * (0.2 + speed * 2)) % TAU) - Math.PI);
  return lift(Math.sin(a * (1 + scale * 8) + r * (8 + scale * 30)) * 0.5 + 0.5, intensity);
}

function meteorRain(x, y, t, scale, speed, density, trail) {
  const s = 4 + scale * 18;
  const line = repeat((x + y * 0.8) * s - t * (0.4 + speed * 5));
  const cell = Math.floor((x - y + t * speed) * s);
  const seed = rand(cell, Math.floor(y * s));
  if (seed > 0.2 + density * 0.5) return 0;
  return Math.pow(1 - line, 2 + trail * 8);
}

function pixelSort(x, y, t, scale, speed, threshold, blocks) {
  const cols = 8 + Math.floor(scale * 52);
  const rows = 2 + Math.floor(blocks * 16);
  const bx = Math.floor(x * cols);
  const by = Math.floor(y * rows);
  const seed = rand(bx, by);
  const scan = repeat(x * (1 + blocks * 8) + t * (0.2 + speed * 3) + seed);
  return seed > threshold ? scan : 1 - scan;
}

function liquidMetal(x, y, t, scale, speed, flow, shine) {
  const s = 3 + scale * 20;
  const spd = 0.2 + speed * 2;
  const v = Math.sin(x * s + Math.sin(y * s + t * spd) * (1 + flow * 4));
  const h = Math.cos((x + y) * s * 0.7 - t * spd * 1.3);
  return Math.pow((v + h) * 0.25 + 0.5, 0.6 + shine * 3);
}

function electricStorm(x, y, t, scale, speed, forks, glow) {
  const s = 6 + scale * 32;
  const drift = t * (0.4 + speed * 4);
  const bolt = Math.sin((x + Math.sin(y * s + drift) * (0.03 + forks * 0.16)) * s - drift);
  const branches = Math.sin((x * 1.7 - y * 0.8) * s * 0.45 + Math.sin(y * s * 0.6 - drift));
  return Math.pow(clamp01(1 - Math.abs(bolt * 0.72 + branches * forks * 0.28) / (0.08 + glow * 0.28)), 1.6);
}

function prismBands(x, y, t, scale, speed, angle, width) {
  const a = angle * TAU;
  const axis = x * Math.cos(a) + y * Math.sin(a);
  const bands = repeat(axis * (2 + scale * 16) + t * (0.06 + speed * 0.9));
  return smoothBand(bands, 0.5, 0.05 + width * 0.32);
}

function cometTail(x, y, t, scale, speed, density, trail) {
  const count = 3 + Math.floor(density * 9);
  const spd = 0.08 + speed * 0.9;
  let value = 0;
  for (let i = 0; i < count; i += 1) {
    const seed = rand(i, count);
    const cx = repeat(seed + t * spd * (0.7 + seed));
    const cy = repeat(seed * 3.17 + Math.sin(t * spd + seed * TAU) * 0.22);
    const dx = repeat(x - cx + 0.5) - 0.5;
    const dy = y - cy;
    const tailShape = Math.max(0, -dx) * (2 + trail * 18);
    value += Math.exp(-(dx * dx * (90 + scale * 260) + dy * dy * (28 + scale * 110) + tailShape));
  }
  return clamp01(value * (0.7 + trail * 2));
}

function matrixRain(x, y, t, scale, speed, columns, fade) {
  const cols = 8 + Math.floor(columns * 42 + scale * 18);
  const col = Math.floor(x * cols);
  const seed = rand(col, 12);
  const head = repeat(seed + t * (0.05 + speed * 1.6) * (0.35 + seed));
  const d = repeat(y - head + 1);
  const glyph = rand(col, Math.floor((y + t * speed) * (8 + scale * 32)));
  return clamp01(Math.exp(-d * (3 + fade * 18)) * (glyph > 0.42 ? 1 : 0.42));
}

function orbitDots(x, y, t, scale, speed, countParam, glow) {
  const count = 2 + Math.floor(countParam * 10);
  const radius = 0.14 + scale * 0.42;
  let value = 0;
  for (let i = 0; i < count; i += 1) {
    const phase = (i / count) * TAU + t * (0.1 + speed * 1.6) * (i % 2 ? -1 : 1);
    const cx = 0.5 + Math.cos(phase) * radius * (0.55 + rand(i, 1) * 0.45);
    const cy = 0.5 + Math.sin(phase * (0.8 + rand(i, 2) * 0.4)) * radius;
    value += Math.exp(-Math.hypot(x - cx, y - cy) * (18 - glow * 12));
  }
  return clamp01(value);
}

function lavaLamp(x, y, t, scale, speed, blobSize, softness) {
  const count = 4 + Math.floor(scale * 8);
  let value = 0;
  for (let i = 0; i < count; i += 1) {
    const seed = rand(i, 9);
    const cx = 0.5 + Math.sin(t * (0.08 + speed * 0.55) + seed * TAU) * 0.38;
    const cy = 0.5 + Math.cos(t * (0.06 + speed * 0.45) + seed * 5.1) * 0.38;
    const d = Math.hypot(x - cx, y - cy);
    value += Math.exp(-d * (3 + blobSize * 12));
  }
  return Math.pow(clamp01(value / (1.2 + softness * 2.2)), 0.55 + softness * 1.4);
}

function photonTunnel(x, y, t, scale, speed, twist, depth) {
  const dx = x - 0.5;
  const dy = y - 0.5;
  const r = Math.hypot(dx, dy) + 0.004;
  const a = Math.atan2(dy, dx) + twist * Math.sin(r * 8 - t * speed);
  const rings = Math.sin((1 / r) * (0.8 + scale * 4) - t * (0.5 + speed * 5));
  const spokes = Math.cos(a * (4 + Math.floor(depth * 16)) + t * speed * 2);
  return Math.pow((rings * 0.65 + spokes * 0.35) * 0.5 + 0.5, 1.1 + depth * 2);
}

function ribbonTwist(x, y, t, scale, speed, ribbon, contrast) {
  const center = 0.5 + Math.sin(x * (3 + scale * 18) + t * (0.4 + speed * 3)) * (0.05 + ribbon * 0.28);
  const wave2 = 0.5 + Math.cos(x * (5 + scale * 22) - t * (0.3 + speed * 2.4)) * (0.04 + ribbon * 0.2);
  const band = Math.max(
    smoothBand(y, center, 0.03 + (1 - contrast) * 0.16),
    smoothBand(y, wave2, 0.02 + ribbon * 0.1)
  );
  return Math.pow(band, 0.7 + contrast * 3);
}

function bloomPulse(x, y, t, scale, speed, bloom, falloff) {
  const dx = x - 0.5;
  const dy = y - 0.5;
  const r = Math.hypot(dx, dy);
  const pulse = 0.35 + Math.pow(Math.sin(t * (0.15 + speed * 1.8)) * 0.5 + 0.5, 2) * (0.25 + bloom * 0.55);
  return clamp01(Math.exp(-Math.abs(r - pulse) * (6 + falloff * 28)) + Math.exp(-r * (4 + scale * 12)) * bloom);
}

function gridRunner(x, y, t, scale, speed, grid, width) {
  const cells = 4 + Math.floor(scale * 28 + grid * 18);
  const px = repeat(x * cells - t * (0.08 + speed * 1.4));
  const py = repeat(y * Math.max(2, cells * 0.35) + t * (0.05 + speed));
  const line = Math.max(smoothBand(px, 0, 0.02 + width * 0.12), smoothBand(py, 0, 0.02 + width * 0.12));
  const runner = smoothBand(repeat((x + y) * 0.5 + t * (0.15 + speed * 1.7)), 0.5, 0.06 + width * 0.16);
  return clamp01(line * (0.25 + runner));
}

function slug(name) {
  return name.replace(/\.js$/i, "").toLowerCase();
}

function repeat(value) {
  return value - Math.floor(value);
}

function rand(x, y) {
  return repeat(Math.sin(x * 127.1 + y * 311.7) * 43758.5453);
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function lift(value, intensity) {
  return clamp01((value * 0.5 + 0.5) * (0.5 + intensity * 1.5));
}

function smoothBand(value, center, width) {
  return clamp01(1 - Math.abs(value - center) / width);
}

function wrapAngle(value) {
  return ((value + Math.PI) % TAU + TAU) % TAU - Math.PI;
}
