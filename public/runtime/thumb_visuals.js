function hashText(text) {
  let hash = 2166136261;
  const value = String(text || "");
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function imageHasVisibleColor(imageData) {
  if (!imageData?.data?.length) return false;
  const { data } = imageData;
  const step = Math.max(4, Math.floor(data.length / 48 / 4) * 4);
  for (let index = 0; index < data.length; index += step) {
    if (data[index + 3] > 20 && (data[index] > 12 || data[index + 1] > 12 || data[index + 2] > 12)) {
      return true;
    }
  }
  return false;
}

export function drawFallbackThumbnail(context, width, height, seedText) {
  const image = context.createImageData(width, height);
  const seed = hashText(seedText);
  const baseHue = seed % 360;
  const accentHue = (baseHue + 145) % 360;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const nx = x / Math.max(1, width - 1);
      const ny = y / Math.max(1, height - 1);
      const wave = 0.5 + 0.5 * Math.sin((nx * 7.5 + ny * 4.5 + (seed % 23) * 0.1) * Math.PI);
      const stripe = 0.5 + 0.5 * Math.sin((nx + ny * 0.65) * Math.PI * 6 + (seed % 17));
      const mix = Math.min(1, Math.max(0, wave * 0.7 + stripe * 0.3));
      const h = mix < 0.5 ? baseHue : accentHue;
      const s = 72 - mix * 10;
      const l = 28 + mix * 24;
      const c = hslToRgb(h / 360, s / 100, l / 100);
      image.data[offset] = c[0];
      image.data[offset + 1] = c[1];
      image.data[offset + 2] = c[2];
      image.data[offset + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
}

export function captureVisibleThumbnail(canvas, seedText) {
  const context = canvas.getContext("2d");
  if (!context) return null;
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  if (imageHasVisibleColor(imageData)) return imageData;
  drawFallbackThumbnail(context, canvas.width, canvas.height, seedText);
  return context.getImageData(0, 0, canvas.width, canvas.height);
}

function hslToRgb(h, s, l) {
  let r;
  let g;
  let b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      let tt = t;
      if (tt < 0) tt += 1;
      if (tt > 1) tt -= 1;
      if (tt < 1 / 6) return p + (q - p) * 6 * tt;
      if (tt < 1 / 2) return q;
      if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return [
    Math.max(0, Math.min(255, Math.round(r * 255))),
    Math.max(0, Math.min(255, Math.round(g * 255))),
    Math.max(0, Math.min(255, Math.round(b * 255)))
  ];
}
