export function drawFallbackFrame(ctx, w, h, t) {
  const image = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const v = 30 + 80 * Math.sin(x * 0.18 + t) + 55 * Math.cos(y * 0.3 - t);
      image.data[i] = Math.max(0, v);
      image.data[i + 1] = Math.max(0, v * 0.5);
      image.data[i + 2] = Math.max(0, 120 - v);
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
}

export function arrayColorToRgb(color) {
  const values = [color[0] ?? 0, color[1] ?? 0, color[2] ?? 0];
  const max = Math.max(...values.map((v) => Math.abs(Number(v) || 0)));
  const scale = max <= 1.0001 ? 255 : 1;
  return values.map((v) => Math.max(0, Math.min(255, Math.round((Number(v) || 0) * scale))));
}

export function objectColorToRgb(color, heatColorFn) {
  if ("r" in color || "g" in color || "b" in color) {
    return arrayColorToRgb([color.r ?? 0, color.g ?? 0, color.b ?? 0]);
  }
  if ("v" in color || "value" in color || "intensity" in color) {
    return heatColorFn(color.v ?? color.value ?? color.intensity).map((v) => Math.round(v));
  }
  return [0, 0, 0];
}
