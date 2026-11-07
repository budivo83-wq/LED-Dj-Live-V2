const PARAMS = ["Scale", "Speed", "Shape", "Intensity"];

export function metaFor(name) {
  return { params: paramsFor(name) };
}

export function gpuFor(name) {
  return GPU_ANIMS[slug(name)];
}

export function gpuCatalog() {
  return GPU_ANIMS;
}

export function renderByName(name, x, y, t, p) {
  const scale = p[0] ?? 0.5;
  const speed = p[1] ?? 0.5;
  const shape = p[2] ?? 0.5;
  const intensity = p[3] ?? 0.5;

  switch (slug(name)) {
    case "shader_nebula":
      return shaderNebula(x, y, t, scale, speed, shape, intensity);
    case "shader_fractal_tunnel":
      return shaderFractalTunnel(x, y, t, scale, speed, shape, intensity);
    case "shader_liquid_chrome":
      return shaderLiquidChrome(x, y, t, scale, speed, shape, intensity);
    case "shader_laser_cells":
      return shaderLaserCells(x, y, t, scale, speed, shape, intensity);
    case "shader_aurora_field":
      return shaderAuroraField(x, y, t, scale, speed, shape, intensity);
    case "shader_moire_rings":
      return shaderProcedural("shader_moire_rings", x, y, t, scale, speed, shape, intensity);
    case "shader_voxel_corridor":
      return shaderProcedural("shader_voxel_corridor", x, y, t, scale, speed, shape, intensity);
    case "shader_ion_bloom":
      return shaderProcedural("shader_ion_bloom", x, y, t, scale, speed, shape, intensity);
    case "shader_crystal_lattice":
      return shaderProcedural("shader_crystal_lattice", x, y, t, scale, speed, shape, intensity);
    case "shader_smoke_vortex":
      return shaderProcedural("shader_smoke_vortex", x, y, t, scale, speed, shape, intensity);
    case "shader_circuit_pulse":
      return shaderProcedural("shader_circuit_pulse", x, y, t, scale, speed, shape, intensity);
    case "shader_rave_slicer":
      return shaderProcedural("shader_rave_slicer", x, y, t, scale, speed, shape, intensity);
    case "shader_magnetic_field":
      return shaderProcedural("shader_magnetic_field", x, y, t, scale, speed, shape, intensity);
    case "shader_glitch_weave":
      return shaderProcedural("shader_glitch_weave", x, y, t, scale, speed, shape, intensity);
    case "shader_solar_fluid":
      return shaderProcedural("shader_solar_fluid", x, y, t, scale, speed, shape, intensity);
    case "shader_phase_ribbons":
      return shaderProcedural("shader_phase_ribbons", x, y, t, scale, speed, shape, intensity);
    case "shader_cosmic_web":
      return shaderProcedural("shader_cosmic_web", x, y, t, scale, speed, shape, intensity);
    case "shader_bass_pressure":
      return shaderProcedural("shader_bass_pressure", x, y, t, scale, speed, shape, intensity);
    case "shader_kick_vortex":
      return shaderProcedural("shader_kick_vortex", x, y, t, scale, speed, shape, intensity);
    case "shader_hihat_sparks":
      return shaderProcedural("shader_hihat_sparks", x, y, t, scale, speed, shape, intensity);
    case "shader_sub_ripple":
      return shaderProcedural("shader_sub_ripple", x, y, t, scale, speed, shape, intensity);
    case "shader_psy_flux":
      return shaderProcedural("shader_psy_flux", x, y, t, scale, speed, shape, intensity);
    case "shader_gate_stutter":
      return shaderProcedural("shader_gate_stutter", x, y, t, scale, speed, shape, intensity);
    case "shader_orbital_bassline":
      return shaderProcedural("shader_orbital_bassline", x, y, t, scale, speed, shape, intensity);
    case "shader_neuro_pulse":
      return shaderProcedural("shader_neuro_pulse", x, y, t, scale, speed, shape, intensity);
    case "shader_spectrum_tunnel":
      return shaderProcedural("shader_spectrum_tunnel", x, y, t, scale, speed, shape, intensity);
    case "shader_trance_lattice":
      return shaderProcedural("shader_trance_lattice", x, y, t, scale, speed, shape, intensity);
    case "shader_strobe_prism":
      return shaderProcedural("shader_strobe_prism", x, y, t, scale, speed, shape, intensity);
    case "shader_neon_orbit":
      return shaderProcedural("shader_neon_orbit", x, y, t, scale, speed, shape, intensity);
    case "shader_fractal_bloom":
      return shaderProcedural("shader_fractal_bloom", x, y, t, scale, speed, shape, intensity);
    case "shader_rhythm_matrix":
      return shaderProcedural("shader_rhythm_matrix", x, y, t, scale, speed, shape, intensity);
    case "shader_chroma_vortex":
      return shaderProcedural("shader_chroma_vortex", x, y, t, scale, speed, shape, intensity);
    case "shader_pulse_rings":
      return shaderProcedural("shader_pulse_rings", x, y, t, scale, speed, shape, intensity);
    case "shader_digital_rain":
      return shaderProcedural("shader_digital_rain", x, y, t, scale, speed, shape, intensity);
    case "shader_helix_drive":
      return shaderProcedural("shader_helix_drive", x, y, t, scale, speed, shape, intensity);
    case "shader_sonic_spikes":
      return shaderProcedural("shader_sonic_spikes", x, y, t, scale, speed, shape, intensity);
    case "shader_hologram_grid":
      return shaderProcedural("shader_hologram_grid", x, y, t, scale, speed, shape, intensity);
    default:
      return shaderNebula(x, y, t, scale, speed, shape, intensity);
  }
}

function paramsFor(name) {
  return {
    shader_nebula: ["Scale", "Speed", "Warp", "Glow"],
    shader_fractal_tunnel: ["Scale", "Speed", "Twist", "Depth"],
    shader_liquid_chrome: ["Scale", "Speed", "Flow", "Shine"],
    shader_laser_cells: ["Scale", "Speed", "Cells", "Edge"],
    shader_aurora_field: ["Scale", "Speed", "Fold", "Curtain"],
    shader_moire_rings: ["Scale", "Speed", "Rings", "Phase"],
    shader_voxel_corridor: ["Scale", "Speed", "Depth", "Edge"],
    shader_ion_bloom: ["Scale", "Speed", "Pulse", "Glow"],
    shader_crystal_lattice: ["Scale", "Speed", "Facet", "Edge"],
    shader_smoke_vortex: ["Scale", "Speed", "Swirl", "Density"],
    shader_circuit_pulse: ["Scale", "Speed", "Grid", "Pulse"],
    shader_rave_slicer: ["Scale", "Speed", "Slices", "Strobe"],
    shader_magnetic_field: ["Scale", "Speed", "Lines", "Curl"],
    shader_glitch_weave: ["Scale", "Speed", "Glitch", "Weave"],
    shader_solar_fluid: ["Scale", "Speed", "Flame", "Core"],
    shader_phase_ribbons: ["Scale", "Speed", "Bands", "Width"],
    shader_cosmic_web: ["Scale", "Speed", "Nodes", "Links"],
    shader_bass_pressure: ["Scale", "Speed", "Kick", "Pressure"],
    shader_kick_vortex: ["Scale", "Speed", "Spin", "Punch"],
    shader_hihat_sparks: ["Scale", "Speed", "Density", "Sparkle"],
    shader_sub_ripple: ["Scale", "Speed", "Depth", "Wave"],
    shader_psy_flux: ["Scale", "Speed", "Fold", "Drive"],
    shader_gate_stutter: ["Scale", "Speed", "Steps", "Gate"],
    shader_orbital_bassline: ["Scale", "Speed", "Orbits", "Glow"],
    shader_neuro_pulse: ["Scale", "Speed", "Tension", "Pulse"],
    shader_spectrum_tunnel: ["Scale", "Speed", "Bands", "Depth"],
    shader_trance_lattice: ["Scale", "Speed", "Grid", "Phase"],
    shader_strobe_prism: ["Scale", "Speed", "Prism", "Strobe"],
    shader_neon_orbit: ["Scale", "Speed", "Orbits", "Glow"],
    shader_fractal_bloom: ["Scale", "Speed", "Fractal", "Bloom"],
    shader_rhythm_matrix: ["Scale", "Speed", "Rows", "Pulse"],
    shader_chroma_vortex: ["Scale", "Speed", "Twist", "Chroma"],
    shader_pulse_rings: ["Scale", "Speed", "Rings", "Punch"],
    shader_digital_rain: ["Scale", "Speed", "Columns", "Glow"],
    shader_helix_drive: ["Scale", "Speed", "Helix", "Depth"],
    shader_sonic_spikes: ["Scale", "Speed", "Spikes", "Bass"],
    shader_hologram_grid: ["Scale", "Speed", "Grid", "Scan"]
  }[slug(name)] || PARAMS;
}

const GPU_ANIMS = {
  shader_nebula: {
    functionName: "gpuShaderNebula",
    code: `
      float gpuShaderNebula(vec2 uv, float t, vec4 p) {
        vec2 q = (uv - 0.5) * (1.2 + p.x * 4.6);
        float spd = 0.07 + p.y * 0.85;
        vec2 flow = vec2(
          fbm(q * 1.6 + vec2(t * spd, -t * spd * 0.65)),
          fbm(q * 1.85 + vec2(-t * spd * 0.52, t * spd))
        ) - 0.5;
        q += flow * (0.28 + p.z * 2.1);

        float cloudA = fbm(q * 2.05 + t * spd);
        float cloudB = fbm(q * 3.4 - t * spd * 0.42);
        float cloud = mix(cloudA, cloudB, 0.28 + p.w * 0.22);

        float starField = hash21(uv * (220.0 + p.x * 520.0) + vec2(t * 0.11, -t * 0.07));
        float stars = smoothstep(0.996 - p.w * 0.015, 1.0, starField);

        float core = exp(-dot(q, q) * (2.0 - p.w * 1.05));
        float nebula = pow(max(cloud, 0.0), 1.28 - p.w * 0.5);
        return clamp(nebula + stars * 0.26 + core * 0.33, 0.0, 1.0);
      }
    `
  },
  shader_fractal_tunnel: {
    functionName: "gpuShaderFractalTunnel",
    code: `
      float gpuShaderFractalTunnel(vec2 uv, float t, vec4 p) {
        vec2 q = uv - 0.5;
        q.x *= 3.0;
        float r = length(q) + 0.001;
        float a = atan(q.y, q.x);
        float spd = 0.25 + p.y * 2.5;
        float twist = 1.0 + p.z * 9.0;
        float depth = 3.0 + p.w * 16.0;
        float v = 0.0;
        for (int i = 0; i < 5; i++) {
          float fi = float(i);
          float bands = sin(a * (2.0 + p.x * 8.0 + fi) + depth / r + t * spd + fi * 1.7);
          v += abs(bands) / (1.6 + fi);
          a += sin(r * twist + t * spd * 0.3) * 0.35;
          r *= 1.22;
        }
        return clamp(pow(v * 0.32, 1.2), 0.0, 1.0);
      }
    `
  },
  shader_liquid_chrome: {
    functionName: "gpuShaderLiquidChrome",
    code: `
      float gpuShaderLiquidChrome(vec2 uv, float t, vec4 p) {
        vec2 q = uv * (2.0 + p.x * 8.0);
        float spd = 0.15 + p.y * 1.4;
        float flow = p.z * 2.5 + 0.2;
        float n = fbm(q + vec2(t * spd, -t * spd * 0.7));
        n += fbm(q * 1.7 + vec2(-t * spd * 0.4, t * spd * 0.8)) * 0.55;
        float ridges = abs(sin((q.x + n * flow) * 2.7 + cos(q.y * 2.1 - t * spd)));
        float shine = smoothstep(0.72 - p.w * 0.25, 1.0, ridges);
        return clamp(n * 0.55 + shine * 0.75, 0.0, 1.0);
      }
    `
  },
  shader_laser_cells: {
    functionName: "gpuShaderLaserCells",
    code: `
      float gpuShaderLaserCells(vec2 uv, float t, vec4 p) {
        vec2 q = uv * (4.0 + p.x * 24.0);
        float spd = 0.3 + p.y * 4.0;
        q += vec2(sin(t * spd), cos(t * spd * 0.7)) * 0.45;
        vec2 id = floor(q);
        vec2 f = fract(q) - 0.5;
        float best = 9.0;
        for (int y = -1; y <= 1; y++) {
          for (int x = -1; x <= 1; x++) {
            vec2 o = vec2(float(x), float(y));
            vec2 point = o + vec2(hash21(id + o), hash21(id + o + 17.3)) - 0.5;
            point += sin(t * spd + point.yx * 6.0) * (0.05 + p.z * 0.25);
            best = min(best, length(f - point));
          }
        }
        float edge = smoothstep(0.16 + p.w * 0.24, 0.0, abs(best - 0.22));
        float core = smoothstep(0.18, 0.0, best);
        return clamp(edge + core * 0.8, 0.0, 1.0);
      }
    `
  },
  shader_aurora_field: {
    functionName: "gpuShaderAuroraField",
    code: `
      float gpuShaderAuroraField(vec2 uv, float t, vec4 p) {
        vec2 q = uv;
        float spd = 0.08 + p.y * 0.8;
        float folds = 2.0 + p.z * 9.0;
        float curtain = 0.0;
        for (int i = 0; i < 5; i++) {
          float fi = float(i);
          float wave = sin((q.x * (2.0 + p.x * 10.0) + fi * 0.7) + t * spd * (1.0 + fi * 0.2));
          float band = 1.0 - abs(q.y - (0.45 + wave * (0.08 + p.w * 0.24) + fi * 0.035));
          curtain += smoothstep(0.55, 1.0, band) / (1.0 + fi * 0.6);
          q.x = abs(q.x * folds - floor(q.x * folds) - 0.5);
        }
        float shimmer = fbm(vec2(uv.x * 8.0, uv.y * 3.0) + t * spd);
        return clamp(curtain * (0.55 + shimmer * 0.7), 0.0, 1.0);
      }
    `
  }
  ,
  shader_moire_rings: {
    functionName: "gpuShaderMoireRings",
    code: `

      float gpuShaderMoireRings(vec2 uv, float t, vec4 p) {
        vec2 q = uv - 0.5;
        q.x *= 2.4;
        float r = length(q) + 0.001;
        float a = atan(q.y, q.x);
        float spd = 0.12 + p.y * 1.8;
        float rings = sin(r * (18.0 + p.x * 70.0) - t * spd * 4.0);
        float moire = sin(r * (19.0 + p.z * 76.0) + a * (1.0 + p.w * 8.0) + t * spd * 2.7);
        return pow(clamp((rings * moire) * 0.5 + 0.5, 0.0, 1.0), 0.55 + p.w * 2.2);
      }
    `
  },
  shader_voxel_corridor: {
    functionName: "gpuShaderVoxelCorridor",
    code: `

      float gpuShaderVoxelCorridor(vec2 uv, float t, vec4 p) {
        vec2 q = uv - 0.5;
        q.x *= 2.8;
        float z = 1.0 / (abs(q.y) + 0.08 + p.w * 0.08);
        float spd = t * (0.25 + p.y * 2.8);
        vec2 grid = abs(fract(vec2(q.x * z, z * (0.35 + p.x)) - spd) - 0.5);
        float line = 1.0 - smoothstep(0.01 + p.w * 0.01, 0.055 + p.w * 0.16, min(grid.x, grid.y));
        float depth = smoothstep(0.0, 7.0 + p.z * 26.0, z);
        return clamp(line * depth, 0.0, 1.0);
      }
    `
  },
  shader_ion_bloom: {
    functionName: "gpuShaderIonBloom",
    code: `

      float gpuShaderIonBloom(vec2 uv, float t, vec4 p) {
        vec2 q = (uv - 0.5) * (1.5 + p.x * 4.5);
        float spd = 0.2 + p.y * 2.2;
        float v = 0.0;
        for (int i = 0; i < 6; i++) {
          float fi = float(i);
          vec2 c = vec2(sin(t * spd * (0.4 + fi * 0.07) + fi * 2.1), cos(t * spd * (0.33 + fi * 0.09) + fi * 1.3)) * (0.18 + p.z * 0.38);
          v += exp(-length(q - c) * (3.0 + p.w * 14.0)) / (1.0 + fi * 0.28);
        }
        return clamp(v * (0.25 + p.w * 0.55), 0.0, 1.0);
      }
    `
  },
  shader_crystal_lattice: {
    functionName: "gpuShaderCrystalLattice",
    code: `

      float gpuShaderCrystalLattice(vec2 uv, float t, vec4 p) {
        vec2 q = (uv - 0.5) * (4.0 + p.x * 24.0);
        q += vec2(sin(t * (0.1 + p.y)), cos(t * (0.13 + p.y))) * p.z * 1.2;
        float a = 0.8660254;
        float l1 = abs(fract(q.x) - 0.5);
        float l2 = abs(fract(q.x * 0.5 + q.y * a) - 0.5);
        float l3 = abs(fract(q.x * 0.5 - q.y * a) - 0.5);
        float edge = min(l1, min(l2, l3));
        float facet = smoothstep(0.25 + p.w * 0.2, 0.0, edge);
        return clamp(facet * (0.55 + fbm(q * 0.25 + t * p.y) * 0.55), 0.0, 1.0);
      }
    `
  },
  shader_smoke_vortex: {
    functionName: "gpuShaderSmokeVortex",
    code: `

      float gpuShaderSmokeVortex(vec2 uv, float t, vec4 p) {
        vec2 q = (uv - 0.5) * (1.2 + p.x * 5.5);
        float r = length(q) + 0.001;
        float a = atan(q.y, q.x) + (1.0 / r) * (0.08 + p.z * 0.5) + t * (0.04 + p.y * 0.55);
        vec2 v = vec2(cos(a), sin(a)) * r;
        float smoke = fbm(v * (2.0 + p.x * 5.0) + vec2(t * (0.05 + p.y * 0.6), -t * 0.04));
        float eye = exp(-r * (1.5 + p.w * 5.0));
        return clamp(pow(smoke, 0.75 + p.w) + eye * 0.35, 0.0, 1.0);
      }
    `
  },
  shader_circuit_pulse: {
    functionName: "gpuShaderCircuitPulse",
    code: `

      float gpuShaderCircuitPulse(vec2 uv, float t, vec4 p) {
        vec2 q = uv * (6.0 + p.x * 34.0);
        vec2 cell = floor(q);
        vec2 f = fract(q);
        float h = hash21(cell);
        float lineX = smoothstep(0.045 + p.w * 0.12, 0.0, abs(f.y - 0.5));
        float lineY = smoothstep(0.045 + p.w * 0.12, 0.0, abs(f.x - 0.5));
        float mask = step(0.35, fract(h * 7.3 + floor(q.x) * 0.03)) * lineX + step(0.45, fract(h * 11.7 + floor(q.y) * 0.04)) * lineY;
        float pulse = smoothstep(0.82, 1.0, sin((q.x + q.y) * (0.35 + p.z) - t * (0.6 + p.y * 5.0)) * 0.5 + 0.5);
        return clamp(mask * (0.25 + pulse), 0.0, 1.0);
      }
    `
  },
  shader_rave_slicer: {
    functionName: "gpuShaderRaveSlicer",
    code: `

      float gpuShaderRaveSlicer(vec2 uv, float t, vec4 p) {
        float slices = 3.0 + floor(p.z * 22.0);
        float spd = 0.4 + p.y * 6.0;
        float a = sin((uv.x + uv.y * p.x) * slices * TAU - t * spd);
        float b = sin((uv.x - uv.y) * (slices * 0.7 + 2.0) * TAU + t * spd * 0.73);
        float st = smoothstep(0.2 + p.w * 0.4, 1.0, sin(t * (2.0 + p.y * 20.0)) * 0.5 + 0.5);
        return clamp((abs(a) < 0.16 + p.w * 0.18 ? 1.0 : 0.0) * 0.7 + (b * 0.5 + 0.5) * st * 0.45, 0.0, 1.0);
      }
    `
  },
  shader_magnetic_field: {
    functionName: "gpuShaderMagneticField",
    code: `

      float gpuShaderMagneticField(vec2 uv, float t, vec4 p) {
        vec2 q = (uv - 0.5) * (2.2 + p.x * 6.0);
        float spd = 0.07 + p.y * 0.8;
        vec2 m1 = vec2(sin(t * spd), cos(t * spd * 0.7)) * 0.55;
        vec2 m2 = -m1;
        float a1 = atan(q.y - m1.y, q.x - m1.x);
        float a2 = atan(q.y - m2.y, q.x - m2.x);
        float r = length(q - m1) + length(q - m2);
        float lines = sin((a1 - a2) * (4.0 + p.z * 24.0) + r * (2.0 + p.x * 5.0));
        return pow(clamp(lines * 0.5 + 0.5, 0.0, 1.0), 0.55 + p.w * 3.0);
      }
    `
  },
  shader_glitch_weave: {
    functionName: "gpuShaderGlitchWeave",
    code: `

      float gpuShaderGlitchWeave(vec2 uv, float t, vec4 p) {
        float bands = 10.0 + p.x * 80.0;
        float row = floor(uv.y * bands);
        float glitch = (hash21(vec2(row, floor(t * (2.0 + p.y * 18.0)))) - 0.5) * p.z * 0.22;
        vec2 q = vec2(uv.x + glitch, uv.y);
        float weave = sin(q.x * (20.0 + p.x * 80.0) + sin(q.y * 40.0 + t * p.y * 3.0) * (1.0 + p.z * 5.0));
        float scan = smoothstep(0.75 - p.w * 0.4, 1.0, sin(q.y * bands * PI) * 0.5 + 0.5);
        return clamp((weave * 0.5 + 0.5) * scan, 0.0, 1.0);
      }
    `
  },
  shader_solar_fluid: {
    functionName: "gpuShaderSolarFluid",
    code: `

      float gpuShaderSolarFluid(vec2 uv, float t, vec4 p) {
        vec2 q = (uv - 0.5) * (1.6 + p.x * 5.2);
        float r = length(q);
        float spd = 0.12 + p.y * 1.5;
        float n = fbm(q * (2.0 + p.z * 5.0) + vec2(t * spd, -t * spd * 0.6));
        float flame = sin((r + n * (0.2 + p.z)) * (10.0 + p.x * 32.0) - t * spd * 7.0) * 0.5 + 0.5;
        float core = exp(-r * (2.0 + p.w * 5.0));
        return clamp(flame * (0.45 + p.w * 0.5) + core * 0.45, 0.0, 1.0);
      }
    `
  },
  shader_phase_ribbons: {
    functionName: "gpuShaderPhaseRibbons",
    code: `

      float gpuShaderPhaseRibbons(vec2 uv, float t, vec4 p) {
        float spd = 0.15 + p.y * 2.2;
        float bands = 3.0 + p.z * 18.0;
        float y = uv.y + sin(uv.x * (3.0 + p.x * 16.0) + t * spd) * (0.04 + p.w * 0.22);
        float v = sin((y + uv.x * p.x) * bands * TAU - t * spd * 2.0);
        float width = 0.08 + p.w * 0.35;
        return clamp(1.0 - abs(v) / width, 0.0, 1.0);
      }
    `
  },
  shader_cosmic_web: {
    functionName: "gpuShaderCosmicWeb",
    code: `

      float gpuShaderCosmicWeb(vec2 uv, float t, vec4 p) {
        vec2 q = uv * (3.0 + p.x * 12.0);
        vec2 cell = floor(q);
        vec2 f = fract(q);
        float value = 0.0;
        for (int y = -1; y <= 1; y++) {
          for (int x = -1; x <= 1; x++) {
            vec2 o = vec2(float(x), float(y));
            vec2 id = cell + o;
            vec2 pt = o + vec2(hash21(id), hash21(id + 13.7));
            pt += sin(t * (0.05 + p.y * 0.8) + pt.yx * 6.0) * (0.04 + p.z * 0.22);
            float d = length(f - pt);
            value += exp(-d * (8.0 + p.w * 36.0));
          }
        }
        return clamp(value * (0.22 + p.w * 0.25), 0.0, 1.0);
      }
    `
  },
  shader_strobe_prism: {
    functionName: "gpuShaderStrobePrism",
    code: `
      float gpuShaderStrobePrism(vec2 uv, float t, vec4 p) {
        vec2 q = uv - 0.5;
        float a = atan(q.y, q.x) + t * (0.15 + p.y * 2.0);
        float r = length(q) * (3.0 + p.x * 10.0);
        float prism = abs(sin(a * (3.0 + p.z * 9.0) + r * 2.0));
        float gate = step(0.45, sin(t * (3.0 + p.y * 18.0)) * 0.5 + 0.5);
        return clamp(prism * (0.35 + gate * (0.35 + p.w * 0.55)), 0.0, 1.0);
      }
    `
  },
  shader_neon_orbit: {
    functionName: "gpuShaderNeonOrbit",
    code: `
      float gpuShaderNeonOrbit(vec2 uv, float t, vec4 p) {
        vec2 q = uv - 0.5;
        float r = length(q) + 0.001;
        float a = atan(q.y, q.x);
        float orbit = abs(sin(a * (2.0 + p.z * 8.0) + r * (12.0 + p.x * 28.0) - t * (0.3 + p.y * 3.0)));
        float glow = exp(-abs(orbit - 0.15) * (18.0 + p.w * 30.0));
        return clamp(glow + exp(-r * (3.0 + p.w * 8.0)) * 0.18, 0.0, 1.0);
      }
    `
  },
  shader_fractal_bloom: {
    functionName: "gpuShaderFractalBloom",
    code: `
      float gpuShaderFractalBloom(vec2 uv, float t, vec4 p) {
        vec2 q = (uv - 0.5) * (1.2 + p.x * 4.0);
        float v = 0.0;
        float spd = 0.12 + p.y * 1.8;
        for (int i = 0; i < 5; i++) {
          q = abs(q) / max(dot(q, q), 0.16) - vec2(0.72 + p.z * 0.22, 0.46);
          v += exp(-length(q) * (1.7 + p.w * 4.0));
          q += vec2(sin(t * spd), cos(t * spd * 0.7)) * 0.03;
        }
        return clamp(v * 0.16, 0.0, 1.0);
      }
    `
  },
  shader_rhythm_matrix: {
    functionName: "gpuShaderRhythmMatrix",
    code: `
      float gpuShaderRhythmMatrix(vec2 uv, float t, vec4 p) {
        float rows = 4.0 + floor(p.z * 20.0);
        vec2 cell = floor(uv * vec2(rows * 1.6, rows));
        vec2 f = fract(uv * vec2(rows * 1.6, rows));
        float phase = floor(t * (1.0 + p.y * 8.0));
        float seed = hash21(cell + phase);
        float hit = step(0.72 - p.w * 0.3, seed);
        float bar = max(smoothstep(0.12, 0.0, abs(f.x - 0.5)), smoothstep(0.12, 0.0, abs(f.y - 0.5)));
        return clamp(hit * bar * (0.5 + 0.5 * sin(t * 4.0 + cell.x)), 0.0, 1.0);
      }
    `
  },
  shader_chroma_vortex: {
    functionName: "gpuShaderChromaVortex",
    code: `
      float gpuShaderChromaVortex(vec2 uv, float t, vec4 p) {
        vec2 q = uv - 0.5;
        float r = length(q) + 0.002;
        float a = atan(q.y, q.x) + (0.12 + p.z * 0.9) / r + t * (0.1 + p.y * 1.4);
        float bands = sin(a * (3.0 + p.x * 14.0) + r * (10.0 + p.w * 24.0));
        return clamp(bands * 0.5 + 0.5, 0.0, 1.0);
      }
    `
  },
  shader_pulse_rings: {
    functionName: "gpuShaderPulseRings",
    code: `
      float gpuShaderPulseRings(vec2 uv, float t, vec4 p) {
        float r = length(uv - 0.5);
        float pulse = fract(t * (0.18 + p.y * 1.8));
        float ring = exp(-abs(fract(r * (6.0 + p.x * 30.0) - pulse) - 0.5) * (18.0 + p.w * 38.0));
        return clamp(ring * (0.5 + p.z * 0.8), 0.0, 1.0);
      }
    `
  },
  shader_digital_rain: {
    functionName: "gpuShaderDigitalRain",
    code: `
      float gpuShaderDigitalRain(vec2 uv, float t, vec4 p) {
        float columns = 10.0 + floor(p.x * 70.0);
        float col = floor(uv.x * columns);
        float speed = 0.3 + p.y * 3.5;
        float head = fract(hash21(vec2(col, 4.2)) + t * speed * (0.25 + hash21(vec2(col, 9.1))));
        float d = fract(uv.y + head) ;
        float glyph = step(0.72, hash21(vec2(col, floor(uv.y * (18.0 + p.z * 30.0)) + floor(t * speed * 4.0))));
        return clamp(glyph * exp(-d * (4.0 + p.w * 12.0)), 0.0, 1.0);
      }
    `
  },
  shader_helix_drive: {
    functionName: "gpuShaderHelixDrive",
    code: `
      float gpuShaderHelixDrive(vec2 uv, float t, vec4 p) {
        vec2 q = uv - 0.5;
        float r = length(q) + 0.001;
        float a = atan(q.y, q.x);
        float helix = sin(a * (2.0 + p.z * 10.0) + 1.0 / r * (2.0 + p.x * 9.0) - t * (0.3 + p.y * 2.8));
        return clamp(abs(helix) * exp(-r * (1.0 + p.w * 3.0)), 0.0, 1.0);
      }
    `
  },
  shader_sonic_spikes: {
    functionName: "gpuShaderSonicSpikes",
    code: `
      float gpuShaderSonicSpikes(vec2 uv, float t, vec4 p) {
        vec2 q = uv - 0.5;
        float r = length(q);
        float a = atan(q.y, q.x);
        float spikes = pow(max(0.0, sin(a * (6.0 + p.z * 30.0) + t * (0.2 + p.y * 2.0))), 2.0 + p.w * 6.0);
        float bass = 0.5 + 0.5 * sin(t * (1.0 + p.y * 8.0));
        return clamp(spikes * smoothstep(0.72, 0.05, r) * (0.35 + bass * 0.85), 0.0, 1.0);
      }
    `
  },
  shader_hologram_grid: {
    functionName: "gpuShaderHologramGrid",
    code: `
      float gpuShaderHologramGrid(vec2 uv, float t, vec4 p) {
        float grid = 8.0 + p.x * 48.0;
        vec2 f = abs(fract(uv * grid) - 0.5);
        float lines = max(smoothstep(0.12 + p.z * 0.12, 0.0, f.x), smoothstep(0.12 + p.z * 0.12, 0.0, f.y));
        float scan = smoothstep(0.12, 0.0, abs(fract(uv.y + t * (0.05 + p.y)) - 0.5));
        return clamp(lines * (0.35 + scan * (0.45 + p.w * 0.6)), 0.0, 1.0);
      }
    `
  },
  wormhole: {
    functionName: "gpuLegacyWormhole",
    code: `
      float gpuLegacyWormhole(vec2 uv, float t, vec4 p) {
        vec2 q = uv - 0.5;
        float r = length(q) + 0.001;
        float angle = atan(q.y, q.x);
        float u = 1.0 / r;
        float ring = sin(u * (4.0 + p.x * 22.0) - t * (0.4 + p.y * 4.0) * (1.0 + p.w * 3.0));
        float helix = sin((angle + p.z * 8.0 * r + t * p.y) * 4.0 + u * 3.0);
        return pow(clamp((ring * helix) * 0.5 + 0.5, 0.0, 1.0), 1.4);
      }
    `
  },
  plasma_iq: {
    functionName: "gpuLegacyPlasmaIq",
    code: `
      float gpuLegacyPlasmaIq(vec2 uv, float t, vec4 p) {
        vec2 z = (uv - 0.5) * (1.0 + p.x * 4.0);
        vec2 c = vec2(cos(t * (0.1 + p.y)), sin(t * (0.12 + p.y * 0.8))) * 0.38;
        float escape = 1.0;
        float iterValue = 0.0;
        float detail = 4.0 + floor(p.z * 8.0);
        for (int i = 0; i < 12; i++) {
          if (float(i) >= detail) break;
          z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
          if (dot(z, z) > 4.0 && escape > 0.5) {
            iterValue = float(i) / max(1.0, detail);
            escape = 0.0;
          }
        }
        float inside = sin(z.x * 4.0 + z.y * 3.0) * 0.5 + 0.5;
        return mix(pow(clamp(inside, 0.0, 1.0), 0.6 + p.w * 2.2), pow(clamp(iterValue, 0.0, 1.0), 0.6 + p.w * 2.2), 1.0 - escape);
      }
    `
  },
  voronoi_flow: {
    functionName: "gpuLegacyVoronoiFlow",
    code: `
      float gpuLegacyVoronoiFlow(vec2 uv, float t, vec4 p) {
        float s = 3.0 + p.x * 12.0;
        vec2 pos = uv * s;
        vec2 cell = floor(pos);
        float closest = 99.0;
        for (int y = -1; y <= 1; y++) {
          for (int x = -1; x <= 1; x++) {
            vec2 offset = vec2(float(x), float(y));
            vec2 id = cell + offset;
            float seed = hash21(id);
            vec2 feature = vec2(
              fract(seed * 13.13 + sin(t * (0.1 + p.y) + seed) * p.w),
              fract(seed * 17.17 + cos(t * (0.12 + p.y * 1.3) + seed) * p.w)
            );
            closest = min(closest, length(id + feature - pos));
          }
        }
        return pow(1.0 - min(closest, 1.0), 1.0 + p.z * 5.0);
      }
    `
  },
  reaction_difusion: {
    functionName: "gpuLegacyReactionDiffusion",
    code: `
      float gpuLegacyReactionDiffusion(vec2 uv, float t, vec4 p) {
        float s = 4.0 + p.x * 22.0;
        float spd = 0.05 + p.y * 0.8;
        float a = sin(uv.x * s + cos(uv.y * s * 0.8 + t * spd));
        float b = cos(uv.y * s + sin(uv.x * s * 1.1 - t * spd * 1.4));
        float v = sin(a * b * (2.0 + p.z * 8.0) + t * spd);
        return pow(clamp(v * 0.5 + 0.5, 0.0, 1.0), 0.6 + p.z * 3.0) * (0.45 + p.w * 0.55);
      }
    `
  },
  caustics: {
    functionName: "gpuLegacyCaustics",
    code: `
      float causticWave(vec2 uv, float s, float ph) {
        return sin(uv.x * s + sin(uv.y * s * 0.8 + ph)) + sin(uv.y * s * 1.1 - sin(uv.x * s * 0.9 + ph * 1.3));
      }

      float gpuLegacyCaustics(vec2 uv, float t, vec4 p) {
        float s = 3.0 + p.x * 12.0;
        float spd = 0.2 + p.y * 1.6;
        float v = (
          causticWave(uv, s, t * spd) +
          causticWave(uv + vec2(p.w * 0.1, 0.0), s, t * spd * 0.7 + 1.0) +
          causticWave(uv + vec2(0.0, p.w * 0.1), s, t * spd * 1.4 + 2.1)
        ) / 6.0 + 0.5;
        return pow(clamp(v, 0.0, 1.0), 1.0 + p.z * 8.0);
      }
    `
  },
  liquid_metal: {
    functionName: "gpuLegacyLiquidMetal",
    code: `
      float gpuLegacyLiquidMetal(vec2 uv, float t, vec4 p) {
        float s = 3.0 + p.x * 20.0;
        float spd = 0.2 + p.y * 2.0;
        float v = sin(uv.x * s + sin(uv.y * s + t * spd) * (1.0 + p.z * 4.0));
        float h = cos((uv.x + uv.y) * s * 0.7 - t * spd * 1.3);
        return pow(clamp((v + h) * 0.25 + 0.5, 0.0, 1.0), 0.6 + p.w * 3.0);
      }
    `
  },
  kaleidoscope: {
    functionName: "gpuLegacyKaleidoscope",
    code: `
      float gpuLegacyKaleidoscope(vec2 uv, float t, vec4 p) {
        vec2 q = uv - 0.5;
        float r = length(q);
        float segs = 3.0 + floor(p.z * 10.0);
        float a = atan(q.y, q.x);
        a = abs(mod(a * segs + t * (0.2 + p.y * 2.0), TAU) - PI);
        float value = sin(a * (1.0 + p.x * 8.0) + r * (8.0 + p.x * 30.0)) * 0.5 + 0.5;
        return pow(clamp(value, 0.0, 1.0), 0.55 + p.w * 1.8);
      }
    `
  },
  electric_storm: {
    functionName: "gpuLegacyElectricStorm",
    code: `
      float gpuLegacyElectricStorm(vec2 uv, float t, vec4 p) {
        float s = 6.0 + p.x * 32.0;
        float drift = t * (0.4 + p.y * 4.0);
        float bolt = sin((uv.x + sin(uv.y * s + drift) * (0.03 + p.z * 0.16)) * s - drift);
        float branches = sin((uv.x * 1.7 - uv.y * 0.8) * s * 0.45 + sin(uv.y * s * 0.6 - drift));
        float field = 1.0 - abs(bolt * 0.72 + branches * p.z * 0.28) / (0.08 + p.w * 0.28);
        return pow(clamp(field, 0.0, 1.0), 1.6);
      }
    `
  },
  photon_tunnel: {
    functionName: "gpuLegacyPhotonTunnel",
    code: `
      float gpuLegacyPhotonTunnel(vec2 uv, float t, vec4 p) {
        vec2 q = uv - 0.5;
        float r = length(q) + 0.004;
        float a = atan(q.y, q.x) + p.z * sin(r * 8.0 - t * p.y);
        float rings = sin((1.0 / r) * (0.8 + p.x * 4.0) - t * (0.5 + p.y * 5.0));
        float spokes = cos(a * (4.0 + floor(p.w * 16.0)) + t * p.y * 2.0);
        return pow(clamp((rings * 0.65 + spokes * 0.35) * 0.5 + 0.5, 0.0, 1.0), 1.1 + p.w * 2.0);
      }
    `
  },
  bloom_pulse: {
    functionName: "gpuLegacyBloomPulse",
    code: `
      float gpuLegacyBloomPulse(vec2 uv, float t, vec4 p) {
        vec2 q = uv - 0.5;
        float r = length(q);
        float pulse = 0.35 + pow(sin(t * (0.15 + p.y * 1.8)) * 0.5 + 0.5, 2.0) * (0.25 + p.z * 0.55);
        float ring = exp(-abs(r - pulse) * (6.0 + p.w * 28.0));
        float core = exp(-r * (4.0 + p.x * 12.0)) * p.z;
        return clamp(ring + core, 0.0, 1.0);
      }
    `
  },
  grid_runner: {
    functionName: "gpuLegacyGridRunner",
    code: `
      float shaderBand(float value, float center, float width) {
        return 1.0 - smoothstep(width, width * 1.7, abs(value - center));
      }

      float gpuLegacyGridRunner(vec2 uv, float t, vec4 p) {
        float cells = 4.0 + floor(p.x * 28.0 + p.z * 18.0);
        float px = fract(uv.x * cells - t * (0.08 + p.y * 1.4));
        float py = fract(uv.y * max(2.0, cells * 0.35) + t * (0.05 + p.y));
        float line = max(shaderBand(px, 0.0, 0.02 + p.w * 0.12), shaderBand(py, 0.0, 0.02 + p.w * 0.12));
        float runner = shaderBand(fract((uv.x + uv.y) * 0.5 + t * (0.15 + p.y * 1.7)), 0.5, 0.06 + p.w * 0.16);
        return clamp(line * (0.25 + runner), 0.0, 1.0);
      }
    `
  },
  diagonal_sweep: {
    functionName: "gpuLegacyDiagonalSweep",
    code: `
      float gpuLegacyDiagonalSweep(vec2 uv, float t, vec4 p) {
        float a = p.z * PI;
        float d = uv.x * cos(a) + uv.y * sin(a);
        float band = 0.03 + p.w * 0.24;
        float v = fract(d * (2.0 + p.x * 8.0) - t * (0.2 + p.y * 2.0));
        return clamp(1.0 - abs(v - 0.5) / band, 0.0, 1.0);
      }
    `
  },
  domain_warp: {
    functionName: "gpuLegacyDomainWarp",
    code: `
      float gpuLegacyDomainWarp(vec2 uv, float t, vec4 p) {
        float s = 2.0 + p.x * 14.0;
        float spd = 0.15 + p.y * 1.4;
        float w = 0.4 + p.z * 2.2;
        float qx = uv.x * s + sin(uv.y * s * 0.9 + t * spd) * w;
        float qy = uv.y * s + cos(uv.x * s * 1.1 - t * spd * 1.3) * w;
        float v = sin(qx + sin(qy + t * spd)) + cos(qy - sin(qx));
        return pow(clamp(v * 0.25 + 0.5, 0.0, 1.0), 1.6 - p.w * 1.1);
      }
    `
  },
  plasma: {
    functionName: "gpuLegacyPlasma",
    code: `
      float gpuLegacyPlasma(vec2 uv, float t, vec4 p) {
        float s = 3.0 + p.x * 20.0;
        float spd = 0.2 + p.y * 2.5;
        float v = sin(uv.x * s + t * spd) + sin(uv.y * s * 1.3 - t * spd * 0.8);
        v += sin((uv.x + uv.y) * s * 0.7 + t * spd * 1.4);
        return pow(clamp(v / 6.0 + 0.5, 0.0, 1.0), 0.5 + p.z * 2.5) * (0.45 + p.w * 0.55);
      }
    `
  },
  ripple: {
    functionName: "gpuLegacyRipple",
    code: `
      float gpuLegacyRipple(vec2 uv, float t, vec4 p) {
        float r = length(uv - 0.5);
        float v = sin(r * (5.0 + p.x * 35.0) - t * (0.4 + p.y * 4.0));
        return pow(clamp(v * (0.25 + p.z * 0.75) * 0.5 + 0.5, 0.0, 1.0), 1.5 - p.w);
      }
    `
  },
  "sine marble": {
    functionName: "gpuLegacySineMarble",
    code: `
      float gpuLegacySineMarble(vec2 uv, float t, vec4 p) {
        float noise = 0.0;
        float amp = 1.0;
        float f = 3.0 + p.x * 18.0;
        float count = 2.0 + floor(p.w * 5.0);
        for (int i = 0; i < 7; i++) {
          if (float(i) >= count) break;
          noise += sin(uv.x * f + sin(uv.y * f * 0.7 + t * (0.1 + p.y * 1.6)) + noise * (0.5 + p.z * 4.0)) * amp;
          f *= 1.7;
          amp *= 0.55;
        }
        return sin(uv.x * (5.0 + p.x * 20.0) + noise + t * p.y) * 0.5 + 0.5;
      }
    `
  },
  spiral_galaxy: {
    functionName: "gpuLegacySpiralGalaxy",
    code: `
      float gpuLegacySpiralGalaxy(vec2 uv, float t, vec4 p) {
        vec2 q = uv - 0.5;
        float r = length(q) + 0.001;
        float angle = atan(q.y, q.x);
        float arms = 2.0 + floor(p.z * 7.0);
        float tight = 1.0 + p.x * 10.0;
        float spiral = angle - tight * log(r) - t * (0.2 + p.y * 2.0);
        float arm = pow(max(0.0, cos(arms * spiral)), 2.5);
        float coreRadius = 0.04 + p.w * 0.2;
        float core = exp(-(r * r) / (coreRadius * coreRadius));
        return clamp(arm * exp(-r * 3.5) + core, 0.0, 1.0);
      }
    `
  },
  wave: {
    functionName: "gpuLegacyWave",
    code: `
      float gpuLegacyWave(vec2 uv, float t, vec4 p) {
        float freq = 2.0 + p.x * 18.0;
        float value = sin(uv.x * freq + uv.y * freq * p.z - t * (0.5 + p.y * 4.0)) * 0.5 + 0.5;
        float width = 0.08 + p.w * 0.35;
        return 1.0 - smoothstep(width, width * 1.7, abs(value - 0.5));
      }
    `
  },
  hearthbeat: {
    functionName: "gpuLegacyHeartbeat",
    code: `
      float gpuLegacyHeartbeat(vec2 uv, float t, vec4 p) {
        float r = length(uv - 0.5) * (1.0 + p.x * 2.0);
        float beat = pow(max(0.0, sin(t * (0.5 + p.y * 3.0) * PI)), 2.0 + p.z * 12.0);
        return clamp(beat - r * (0.8 + p.w * 3.0), 0.0, 1.0);
      }
    `
  },
  hypnotic_atractor: {
    functionName: "gpuLegacyHypnoticAttractor",
    code: `
      float gpuLegacyHypnoticAttractor(vec2 uv, float t, vec4 p) {
        vec2 pos = (uv - 0.5) * (2.0 + p.x * 4.0);
        vec2 target = (uv - 0.5) * 4.0;
        float density = 0.0;
        float count = 16.0 + floor(p.z * 42.0);
        float spd = 0.03 + p.y * 0.5;
        float a = 1.7 + sin(t * spd) * 0.8;
        float b = -1.3 + cos(t * spd * 0.7) * 0.5;
        float c = 0.5 + sin(t * spd * 1.3) * 0.3;
        float d = -1.7 + cos(t * spd * 0.9) * 0.5;
        for (int i = 0; i < 58; i++) {
          if (float(i) >= count) break;
          vec2 nextPos = vec2(sin(a * pos.y) + c * cos(a * pos.x), sin(b * pos.x) + d * cos(b * pos.y));
          density += exp(-length(nextPos - target) * 8.0);
          pos = nextPos;
        }
        return clamp(pow((density / max(1.0, count)) * (1.0 + p.w * 5.0), 0.5), 0.0, 1.0);
      }
    `
  },
  interference_field: {
    functionName: "gpuLegacyInterferenceField",
    code: `
      float gpuLegacyInterferenceField(vec2 uv, float t, vec4 p) {
        float spd = 0.3 + p.y * 3.0;
        float freq = 5.0 + p.x * 25.0 + p.z * 15.0;
        vec2 s1 = vec2(0.5 + 0.3 * cos(t * spd), 0.5 + 0.3 * sin(t * spd));
        vec2 s2 = vec2(0.5 + 0.3 * cos(t * spd + PI), 0.5 + 0.3 * sin(t * spd + PI));
        vec2 s3 = vec2(0.5 + 0.2 * cos(t * spd * 1.7 + 1.0), 0.5 + 0.2 * sin(t * spd * 1.7 + 1.0));
        float v = sin(length(uv - s1) * freq - t * spd * 2.0);
        v += sin(length(uv - s2) * freq - t * spd * 2.0);
        v += sin(length(uv - s3) * freq - t * spd * 2.0);
        return pow(clamp(v / 6.0 + 0.5, 0.0, 1.0), 1.6 - p.w * 1.1);
      }
    `
  },
  radar: {
    functionName: "gpuLegacyRadar",
    code: `
      float gpuLegacyRadar(vec2 uv, float t, vec4 p) {
        float r = length(uv - 0.5);
        float radius = fract(t * (0.1 + p.y * 0.8)) * (0.25 + p.z * 0.65);
        float band = 0.01 + p.w * 0.09;
        return clamp(1.0 - abs(r * (1.0 + p.x * 1.5) - radius) / band, 0.0, 1.0);
      }
    `
  },
  radar_scan: {
    functionName: "gpuLegacyRadarScan",
    code: `
      float gpuLegacyRadarScan(vec2 uv, float t, vec4 p) {
        vec2 q = uv - 0.5;
        float angle = atan(q.y, q.x);
        float sweep = fract(t * (0.04 + p.y * 0.25)) * TAU;
        float diff = abs(mod(angle - sweep + PI, TAU) - PI);
        float beam = clamp(1.0 - diff / (0.1 + p.z * 1.2), 0.0, 1.0);
        return pow(beam, 1.0 + p.w * 4.0) * clamp(1.0 - length(q) * p.x, 0.0, 1.0);
      }
    `
  },
  scan: {
    functionName: "gpuLegacyScan",
    code: `
      float gpuLegacyScan(vec2 uv, float t, vec4 p) {
        float pos = fract(t * (0.1 + p.y * 1.5) + p.z);
        float axis = p.z < 0.5 ? uv.x : uv.y;
        return clamp(1.0 - abs(axis * (1.0 + p.x * 0.2) - pos) / (0.02 + p.w * 0.18), 0.0, 1.0);
      }
    `
  },
  twinkle_stars: {
    functionName: "gpuLegacyTwinkleStars",
    code: `
      float gpuLegacyTwinkleStars(vec2 uv, float t, vec4 p) {
        vec2 grid = floor(vec2(uv.x * (10.0 + p.x * 80.0), uv.y * (3.0 + p.x * 20.0)));
        float seed = hash21(grid);
        if (seed > 0.08 + p.z * 0.6) return 0.0;
        return pow(abs(sin((seed + t * (0.3 + p.y * 5.0)) * PI)), 4.0 + p.w * 12.0);
      }
    `
  },
  meteor_rain: {
    functionName: "gpuLegacyMeteorRain",
    code: `
      float gpuLegacyMeteorRain(vec2 uv, float t, vec4 p) {
        float s = 4.0 + p.x * 18.0;
        float line = fract((uv.x + uv.y * 0.8) * s - t * (0.4 + p.y * 5.0));
        float cell = floor((uv.x - uv.y + t * p.y) * s);
        float seed = hash21(vec2(cell, floor(uv.y * s)));
        if (seed > 0.2 + p.z * 0.5) return 0.0;
        return pow(1.0 - line, 2.0 + p.w * 8.0);
      }
    `
  },
  pixel_sort: {
    functionName: "gpuLegacyPixelSort",
    code: `
      float gpuLegacyPixelSort(vec2 uv, float t, vec4 p) {
        float cols = 8.0 + floor(p.x * 52.0);
        float rows = 2.0 + floor(p.w * 16.0);
        vec2 block = floor(vec2(uv.x * cols, uv.y * rows));
        float seed = hash21(block);
        float scanValue = fract(uv.x * (1.0 + p.w * 8.0) + t * (0.2 + p.y * 3.0) + seed);
        return seed > p.z ? scanValue : 1.0 - scanValue;
      }
    `
  },
  prism_bands: {
    functionName: "gpuLegacyPrismBands",
    code: `
      float gpuLegacyPrismBands(vec2 uv, float t, vec4 p) {
        float a = p.z * TAU;
        float axis = uv.x * cos(a) + uv.y * sin(a);
        float bands = fract(axis * (2.0 + p.x * 16.0) + t * (0.06 + p.y * 0.9));
        float width = 0.05 + p.w * 0.32;
        return 1.0 - smoothstep(width, width * 1.7, abs(bands - 0.5));
      }
    `
  },
  comet_tail: {
    functionName: "gpuLegacyCometTail",
    code: `
      float gpuLegacyCometTail(vec2 uv, float t, vec4 p) {
        float count = 3.0 + floor(p.z * 9.0);
        float spd = 0.08 + p.y * 0.9;
        float value = 0.0;
        for (int i = 0; i < 12; i++) {
          if (float(i) >= count) break;
          float seed = hash21(vec2(float(i), count));
          float cx = fract(seed + t * spd * (0.7 + seed));
          float cy = fract(seed * 3.17 + sin(t * spd + seed * TAU) * 0.22);
          float dx = fract(uv.x - cx + 0.5) - 0.5;
          float dy = uv.y - cy;
          float tailShape = max(0.0, -dx) * (2.0 + p.w * 18.0);
          value += exp(-(dx * dx * (90.0 + p.x * 260.0) + dy * dy * (28.0 + p.x * 110.0) + tailShape));
        }
        return clamp(value * (0.7 + p.w * 2.0), 0.0, 1.0);
      }
    `
  },
  matrix_rain: {
    functionName: "gpuLegacyMatrixRain",
    code: `
      float gpuLegacyMatrixRain(vec2 uv, float t, vec4 p) {
        float cols = 8.0 + floor(p.z * 42.0 + p.x * 18.0);
        float col = floor(uv.x * cols);
        float seed = hash21(vec2(col, 12.0));
        float head = fract(seed + t * (0.05 + p.y * 1.6) * (0.35 + seed));
        float d = fract(uv.y - head + 1.0);
        float glyph = hash21(vec2(col, floor((uv.y + t * p.y) * (8.0 + p.x * 32.0))));
        return clamp(exp(-d * (3.0 + p.w * 18.0)) * (glyph > 0.42 ? 1.0 : 0.42), 0.0, 1.0);
      }
    `
  },
  orbit_dots: {
    functionName: "gpuLegacyOrbitDots",
    code: `
      float gpuLegacyOrbitDots(vec2 uv, float t, vec4 p) {
        float count = 2.0 + floor(p.z * 10.0);
        float radius = 0.14 + p.x * 0.42;
        float value = 0.0;
        for (int i = 0; i < 12; i++) {
          if (float(i) >= count) break;
          float fi = float(i);
          float seed1 = hash21(vec2(fi, 1.0));
          float seed2 = hash21(vec2(fi, 2.0));
          float phase = (fi / max(1.0, count)) * TAU + t * (0.1 + p.y * 1.6) * (mod(fi, 2.0) < 0.5 ? 1.0 : -1.0);
          vec2 center = vec2(
            0.5 + cos(phase) * radius * (0.55 + seed1 * 0.45),
            0.5 + sin(phase * (0.8 + seed2 * 0.4)) * radius
          );
          value += exp(-length(uv - center) * (18.0 - p.w * 12.0));
        }
        return clamp(value, 0.0, 1.0);
      }
    `
  },
  lava_lamp: {
    functionName: "gpuLegacyLavaLamp",
    code: `
      float gpuLegacyLavaLamp(vec2 uv, float t, vec4 p) {
        float count = 4.0 + floor(p.x * 8.0);
        float value = 0.0;
        for (int i = 0; i < 12; i++) {
          if (float(i) >= count) break;
          float seed = hash21(vec2(float(i), 9.0));
          vec2 center = vec2(
            0.5 + sin(t * (0.08 + p.y * 0.55) + seed * TAU) * 0.38,
            0.5 + cos(t * (0.06 + p.y * 0.45) + seed * 5.1) * 0.38
          );
          value += exp(-length(uv - center) * (3.0 + p.z * 12.0));
        }
        return pow(clamp(value / (1.2 + p.w * 2.2), 0.0, 1.0), 0.55 + p.w * 1.4);
      }
    `
  },
  ribbon_twist: {
    functionName: "gpuLegacyRibbonTwist",
    code: `
      float gpuLegacyRibbonTwist(vec2 uv, float t, vec4 p) {
        float center = 0.5 + sin(uv.x * (3.0 + p.x * 18.0) + t * (0.4 + p.y * 3.0)) * (0.05 + p.z * 0.28);
        float wave2 = 0.5 + cos(uv.x * (5.0 + p.x * 22.0) - t * (0.3 + p.y * 2.4)) * (0.04 + p.z * 0.2);
        float band1 = 1.0 - smoothstep(0.03 + (1.0 - p.w) * 0.16, 0.05 + (1.0 - p.w) * 0.22, abs(uv.y - center));
        float band2 = 1.0 - smoothstep(0.02 + p.z * 0.1, 0.04 + p.z * 0.14, abs(uv.y - wave2));
        return pow(max(band1, band2), 0.7 + p.w * 3.0);
      }
    `
  }
};


function shaderProcedural(name, x, y, t, scale, speed, shape, intensity) {
  const dx = (x - 0.5) * (1.2 + scale * 5.5);
  const dy = (y - 0.5) * (1.2 + scale * 5.5);
  const r = Math.sqrt(dx * dx + dy * dy) + 0.001;
  const a = Math.atan2(dy, dx);
  const spd = 0.15 + speed * 2.5;
  switch (slug(name)) {
    case "shader_moire_rings": return clamp01((Math.sin(r * (18 + scale * 70) - t * spd) * Math.sin(r * (20 + shape * 75) + a * (1 + intensity * 8) + t * spd * 0.7)) * 0.5 + 0.5);
    case "shader_voxel_corridor": return clamp01(Math.pow(Math.abs(Math.sin((1 / (Math.abs(dy) + 0.09)) * (1 + scale * 2) - t * spd)), 1.5 + intensity * 2));
    case "shader_ion_bloom": return clamp01(Math.exp(-r * (2 + intensity * 8)) + 0.45 * (Math.sin(a * (3 + shape * 8) + t * spd) * 0.5 + 0.5));
    case "shader_crystal_lattice": return clamp01(Math.max(Math.abs(Math.sin(dx * (5 + scale * 24))), Math.abs(Math.sin((dx * 0.5 + dy * 0.866) * (5 + shape * 26)))));
    case "shader_smoke_vortex": return clamp01(Math.sin((a + 1 / r * (0.08 + shape * 0.5)) * 3 + t * spd) * 0.25 + 0.55 + Math.exp(-r * 3) * intensity);
    case "shader_circuit_pulse": return clamp01((Math.abs(Math.sin(x * (20 + scale * 80))) < 0.14 || Math.abs(Math.sin(y * (20 + scale * 80))) < 0.14 ? 0.7 : 0) * (0.45 + 0.55 * Math.sin((x + y) * 12 - t * spd * 3)));
    case "shader_rave_slicer": return clamp01((Math.abs(Math.sin((x + y * shape) * (8 + scale * 30) - t * spd * 4)) > 0.88 ? 1 : 0) * (0.5 + intensity * 0.5));
    case "shader_magnetic_field": return clamp01(Math.sin(a * (4 + shape * 24) + r * (2 + scale * 8) + t * spd) * 0.5 + 0.5);
    case "shader_glitch_weave": return clamp01((Math.sin((x + Math.sin(y * 50 + t * spd) * shape * 0.05) * (25 + scale * 90)) * 0.5 + 0.5) * (0.55 + intensity * 0.45));
    case "shader_solar_fluid": return clamp01((Math.sin((r + Math.sin(a * 3 + t * spd) * shape * 0.2) * (12 + scale * 34) - t * spd * 2) * 0.5 + 0.5) * (0.5 + intensity * 0.5) + Math.exp(-r * (2 + intensity * 5)) * 0.3);
    case "shader_phase_ribbons": return clamp01(1 - Math.abs(Math.sin((y + Math.sin(x * (4 + scale * 16) + t * spd) * (0.04 + intensity * 0.2)) * (4 + shape * 20) * Math.PI)) / (0.12 + intensity * 0.45));
    case "shader_cosmic_web": return clamp01(Math.pow(Math.abs(Math.sin(dx * (4 + scale * 12)) * Math.sin(dy * (4 + shape * 12)) * Math.sin((dx + dy) * 3 + t * spd)), 0.55 + intensity));

    case "shader_bass_pressure": {
      const beat = Math.pow(Math.max(0, Math.sin(t * spd * 3.14159)), 3 + shape * 5);
      const wave = Math.sin(r * (10 + scale * 42) - t * spd * 5) * 0.5 + 0.5;
      return clamp01(wave * (0.32 + intensity * 0.38) + beat * Math.exp(-r * (1.2 + intensity * 4.5)));
    }
    case "shader_kick_vortex": {
      const kick = Math.pow(Math.max(0, Math.sin(t * spd * 3.2)), 4 + intensity * 5);
      const swirl = Math.sin(a * (3 + shape * 12) + r * (7 + scale * 25) - t * spd * (2 + kick * 6));
      return clamp01((swirl * 0.5 + 0.5) * (0.45 + kick * 0.7));
    }
    case "shader_hihat_sparks": {
      const grid = Math.sin((x * (45 + scale * 180)) + Math.sin(y * 30 + t * spd * 9) * shape * 2);
      const tick = Math.abs(Math.sin(t * spd * (8 + shape * 16)));
      const spark = Math.pow(Math.max(0, grid), 8 + (1 - intensity) * 20);
      return clamp01(spark * (0.45 + tick * (0.8 + intensity)));
    }
    case "shader_sub_ripple": {
      const low = Math.sin(t * spd * 1.25) * 0.5 + 0.5;
      const ripple = Math.sin((Math.abs(y - 0.5) + Math.sin(x * (2 + shape * 8) + t * spd) * 0.08) * (18 + scale * 64) - t * spd * 2.5);
      return clamp01((ripple * 0.5 + 0.5) * (0.35 + intensity * 0.5) + low * 0.2);
    }
    case "shader_psy_flux": {
      let qx = dx, qy = dy;
      for (let i = 0; i < 3; i++) {
        qx = Math.abs(qx) - (0.35 + shape * 0.25);
        qy = Math.abs(qy) - (0.25 + intensity * 0.2);
        const rot = t * spd * 0.12 + i * 0.7;
        const nx = qx * Math.cos(rot) - qy * Math.sin(rot);
        qy = qx * Math.sin(rot) + qy * Math.cos(rot);
        qx = nx;
      }
      return clamp01(Math.sin((qx + qy) * (8 + scale * 38) + t * spd * 3) * 0.5 + 0.5);
    }
    case "shader_gate_stutter": {
      const slices = 4 + Math.floor(shape * 28);
      const gate = (Math.floor((x + t * spd * 0.55) * slices) % 2) ? 1 : 0;
      const scan = Math.abs(Math.sin((y + gate * 0.11) * (10 + scale * 60) - t * spd * 5));
      return clamp01((scan > (0.55 + intensity * 0.35) ? 1 : 0) * (0.4 + gate * 0.65));
    }
    case "shader_orbital_bassline": {
      const count = 3 + Math.floor(shape * 7);
      let v = 0;
      for (let i = 0; i < 10; i++) {
        if (i >= count) break;
        const ph = (i / count) * Math.PI * 2 + t * spd * (0.4 + (i % 2) * 0.3);
        const cx = 0.5 + Math.cos(ph) * (0.12 + scale * 0.34);
        const cy = 0.5 + Math.sin(ph * 1.31) * (0.1 + scale * 0.28);
        const d = Math.hypot(x - cx, y - cy);
        v += Math.exp(-d * (18 - intensity * 10));
      }
      return clamp01(v * (0.28 + intensity * 0.22));
    }
    case "shader_neuro_pulse": {
      const n = Math.sin(dx * (5 + scale * 22) + Math.sin(dy * 9 - t * spd) * (1 + shape * 4));
      const m = Math.cos(dy * (6 + scale * 20) - Math.cos(dx * 7 + t * spd * 0.7) * (1 + intensity * 5));
      const pulse = Math.pow(Math.max(0, Math.sin(t * spd * 2.1)), 5);
      return clamp01(Math.pow(Math.abs(n * m), 0.65 + intensity) + pulse * 0.25);
    }
    case "shader_spectrum_tunnel": {
      const tunnel = Math.sin((1 / r) * (0.8 + scale * 3.5) + a * (2 + shape * 10) + t * spd * 3);
      const bands = Math.sin((x + y) * (10 + intensity * 60) - t * spd * 2);
      return clamp01((tunnel * 0.5 + 0.5) * 0.65 + (bands * 0.5 + 0.5) * 0.35);
    }
    case "shader_trance_lattice": {
      const gx = Math.abs(Math.sin((x + Math.sin(y * 6 + t * spd) * 0.03 * shape) * (12 + scale * 70)));
      const gy = Math.abs(Math.sin((y + Math.cos(x * 5 - t * spd) * 0.03 * shape) * (12 + scale * 70)));
      const pulse = Math.sin((x + y) * (4 + intensity * 16) - t * spd * 4) * 0.5 + 0.5;
      return clamp01((1 - Math.min(gx, gy)) * (0.25 + pulse * 0.8));
    }
    case "shader_strobe_prism": return clamp01(Math.abs(Math.sin(Math.atan2(dy, dx) * (3 + shape * 9) + r * (8 + scale * 22) + t * spd)) * (0.35 + intensity * 0.65));
    case "shader_neon_orbit": return clamp01(Math.exp(-Math.abs(Math.sin(Math.atan2(dy, dx) * (2 + shape * 8) + r * (10 + scale * 24) - t * spd))) * (4 + intensity * 8));
    case "shader_fractal_bloom": return clamp01(Math.pow(Math.abs(Math.sin(1 / (r + 0.04) + t * spd)), 0.7 + shape * 2) * Math.exp(-r * (1 + intensity * 3)));
    case "shader_rhythm_matrix": return clamp01((Math.sin(Math.floor(x * (6 + scale * 18)) + Math.floor(y * (6 + shape * 18)) + Math.floor(t * (1 + speed * 8))) * 0.5 + 0.5) * (0.4 + intensity * 0.6));
    case "shader_chroma_vortex": return clamp01(Math.sin(Math.atan2(dy, dx) + 0.15 / (r + 0.01) + t * spd) * 0.5 + 0.5);
    case "shader_pulse_rings": return clamp01(Math.exp(-Math.abs(Math.sin(r * (8 + scale * 30) - t * spd * 2)) * (6 + intensity * 14)));
    case "shader_digital_rain": return clamp01((Math.sin(Math.floor(x * (10 + scale * 40)) * 7 + Math.floor(y * 20) - t * spd * 5) * 0.5 + 0.5) * Math.exp(-((y + t * spd * 0.08) % 1) * (2 + intensity * 6)));
    case "shader_helix_drive": return clamp01(Math.abs(Math.sin(Math.atan2(dy, dx) * (3 + shape * 10) + 1 / (r + 0.02) - t * spd)) * Math.exp(-r * 2));
    case "shader_sonic_spikes": return clamp01(Math.pow(Math.max(0, Math.sin(Math.atan2(dy, dx) * (8 + shape * 28) + t * spd)), 2 + intensity * 6) * (1 - r));
    case "shader_hologram_grid": return clamp01(Math.max(Math.abs(Math.sin(x * (10 + scale * 40))), Math.abs(Math.sin(y * (8 + shape * 30)))) * (0.35 + intensity * 0.65));
    default: return shaderNebula(x, y, t, scale, speed, shape, intensity);
  }
}

function shaderNebula(x, y, t, scale, speed, warp, glow) {
  const dx = (x - 0.5) * (1.4 + scale * 5);
  const dy = (y - 0.5) * (1.4 + scale * 5);
  const cloud = Math.sin(dx * 2.1 + t * speed) + Math.cos(dy * 2.4 - t * speed * 0.7);
  const core = Math.exp(-(dx * dx + dy * dy) * (1.8 - glow));
  return clamp01(cloud * 0.2 + 0.45 + core * 0.45 + warp * 0.08);
}

function shaderFractalTunnel(x, y, t, scale, speed, twist, depth) {
  const dx = (x - 0.5) * 3;
  const dy = y - 0.5;
  const r = Math.sqrt(dx * dx + dy * dy) + 0.001;
  const a = Math.atan2(dy, dx);
  return clamp01(Math.abs(Math.sin(a * (2 + scale * 8) + (3 + depth * 16) / r + t * (0.25 + speed * 2.5) + twist)));
}

function shaderLiquidChrome(x, y, t, scale, speed, flow, shine) {
  const qx = x * (2 + scale * 8);
  const qy = y * (2 + scale * 8);
  const v = Math.sin(qx * 2.7 + Math.cos(qy * 2.1 - t * speed) * (0.2 + flow * 2.5));
  return clamp01(v * 0.35 + 0.5 + shine * 0.18);
}

function shaderLaserCells(x, y, t, scale, speed, cells, edge) {
  const qx = x * (4 + scale * 24);
  const qy = y * (4 + scale * 24);
  const v = Math.sin(qx + t * speed * 4) * Math.sin(qy - t * speed * 3);
  return clamp01(Math.pow(Math.abs(v), 1 + edge * 3) + cells * 0.1);
}

function shaderAuroraField(x, y, t, scale, speed, fold, curtain) {
  const wave = Math.sin(x * (2 + scale * 10) + t * (0.08 + speed * 0.8));
  const band = 1 - Math.abs(y - (0.45 + wave * (0.08 + curtain * 0.24)));
  return clamp01(Math.pow(Math.max(0, band), 4 - fold * 2));
}

function slug(name) {
  return String(name || "").replace(/\.js$/i, "").toLowerCase();
}

function clamp01(value) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}
