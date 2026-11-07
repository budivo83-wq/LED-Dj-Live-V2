export function colorByName(name, value) {
  const v = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

  switch (name.replace(/\.js$/i, "").toLowerCase()) {
    case "aurora":
      return mixStops(v, [[0, 12, 20, 60], [0.35, 0, 180, 140], [0.7, 120, 80, 255], [1, 240, 255, 210]]);
    case "candy":
      return sine(v, 1.5, [0, 2.1, 4.2]);
    case "deep_ocean":
      return mixStops(v, [[0, 0, 8, 28], [0.45, 0, 70, 150], [1, 80, 220, 255]]);
    case "ember":
      return [255, v * v * 180, v * v * v * 60];
    case "fire":
      return mixStops(v, [[0, 20, 0, 0], [0.35, 210, 30, 0], [0.75, 255, 160, 20], [1, 255, 245, 180]]);
    case "lava":
      return mixStops(v, [[0, 0, 0, 0], [0.35, 150, 0, 0], [0.7, 255, 70, 0], [1, 255, 220, 70]]);
    case "magma":
      return [Math.pow(v, 0.5) * 255, Math.pow(v, 2) * 160, Math.pow(v, 4) * 255];
    case "neon":
      return sine(v, 1, [0, 2, 4]);
    case "neonlight":
      return [v * 180 + 30, 230 + v * 25, 255];
    case "purple_fire":
      return [200 * v, 50 * v, 255 * v];
    case "rainbow":
      return sine(v, 1, [0, 2.09, 4.18]);
    case "sunset":
      return mixStops(v, [[0, 55, 0, 120], [0.45, 255, 80, 0], [1, 255, 245, 90]]);
    case "synthvawe":
    case "synthwave":
      return mixStops(v, [[0, 20, 0, 80], [0.45, 255, 0, 180], [1, 0, 240, 255]]);
    case "toxic":
      return mixStops(v, [[0, 0, 20, 0], [0.45, 80, 255, 0], [1, 220, 255, 80]]);
    case "ice":
      return mixStops(v, [[0, 0, 20, 80], [0.5, 40, 220, 255], [1, 245, 255, 255]]);
    case "laser_rgb":
      return mixStops(v, [[0, 255, 0, 60], [0.5, 0, 255, 80], [1, 40, 80, 255]]);
    case "gold_violet":
      return mixStops(v, [[0, 45, 0, 80], [0.5, 160, 60, 255], [1, 255, 210, 80]]);
    case "arctic_sunrise":
      return mixStops(v, [[0, 0, 16, 70], [0.35, 30, 190, 255], [0.7, 255, 120, 120], [1, 255, 245, 180]]);
    case "blacklight":
      return mixStops(v, [[0, 5, 0, 18], [0.35, 70, 0, 255], [0.68, 255, 0, 210], [1, 180, 255, 40]]);
    case "brass_teal":
      return mixStops(v, [[0, 12, 42, 48], [0.42, 0, 180, 170], [0.72, 230, 160, 55], [1, 255, 235, 150]]);
    case "cherry_mint":
      return mixStops(v, [[0, 40, 0, 18], [0.4, 220, 20, 70], [0.74, 30, 255, 190], [1, 245, 255, 235]]);
    case "cobalt_gold":
      return mixStops(v, [[0, 0, 15, 90], [0.45, 20, 90, 255], [0.74, 255, 175, 20], [1, 255, 245, 170]]);
    case "coral_reef":
      return mixStops(v, [[0, 0, 40, 90], [0.36, 0, 210, 190], [0.66, 255, 90, 95], [1, 255, 210, 120]]);
    case "cyber_lime":
      return mixStops(v, [[0, 0, 10, 20], [0.38, 0, 255, 85], [0.68, 20, 220, 255], [1, 245, 255, 40]]);
    case "dusty_rose":
      return mixStops(v, [[0, 22, 12, 28], [0.42, 135, 70, 105], [0.72, 235, 130, 130], [1, 255, 220, 190]]);
    case "emerald_ruby":
      return mixStops(v, [[0, 0, 18, 8], [0.38, 0, 190, 100], [0.7, 210, 0, 70], [1, 255, 185, 120]]);
    case "moonlit":
      return mixStops(v, [[0, 4, 8, 24], [0.45, 48, 72, 130], [0.74, 150, 185, 255], [1, 240, 248, 255]]);
    case "solar_flare":
      return mixStops(v, [[0, 30, 0, 0], [0.34, 255, 60, 0], [0.68, 255, 210, 40], [1, 255, 250, 190]]);
    case "polar_night":
      return mixStops(v, [[0, 0, 8, 18], [0.4, 12, 70, 140], [0.75, 80, 160, 220], [1, 210, 240, 255]]);
    case "mint_heat":
      return mixStops(v, [[0, 0, 20, 10], [0.4, 0, 220, 140], [0.72, 255, 110, 90], [1, 255, 235, 180]]);
    case "ultraviolet":
      return mixStops(v, [[0, 12, 0, 28], [0.38, 90, 0, 210], [0.7, 220, 0, 255], [1, 255, 190, 255]]);
    case "desert_sky":
      return mixStops(v, [[0, 35, 12, 6], [0.35, 210, 110, 40], [0.7, 255, 190, 120], [1, 120, 185, 255]]);
    case "voltage":
      return mixStops(v, [[0, 4, 8, 20], [0.3, 0, 255, 255], [0.62, 90, 30, 255], [1, 245, 255, 255]]);
    case "rose_gold":
      return mixStops(v, [[0, 28, 10, 16], [0.42, 180, 90, 120], [0.74, 255, 180, 160], [1, 255, 235, 205]]);
    case "ocean_glow":
      return mixStops(v, [[0, 0, 15, 36], [0.35, 0, 140, 190], [0.7, 0, 240, 170], [1, 190, 255, 220]]);
    case "ember_ice":
      return mixStops(v, [[0, 6, 14, 36], [0.32, 0, 160, 255], [0.6, 255, 120, 40], [1, 255, 245, 220]]);
    case "retro_arcade":
      return mixStops(v, [[0, 8, 0, 32], [0.34, 255, 0, 140], [0.66, 0, 255, 170], [1, 255, 245, 80]]);
    default:
      return sine(v, 1, [0, 2.09, 4.18]);
  }
}

function sine(v, freq, phase) {
  return phase.map((p) => Math.sin(v * Math.PI * 2 * freq + p) * 127 + 128);
}

function mixStops(v, stops) {
  for (let i = 1; i < stops.length; i++) {
    if (v <= stops[i][0]) {
      const a = stops[i - 1];
      const b = stops[i];
      const t = (v - a[0]) / (b[0] - a[0] || 1);
      return [
        lerp(a[1], b[1], t),
        lerp(a[2], b[2], t),
        lerp(a[3], b[3], t)
      ];
    }
  }
  const last = stops[stops.length - 1];
  return [last[1], last[2], last[3]];
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}
