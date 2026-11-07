export function createUiLayerHelpers(deps) {
  const {
    getWidth,
    getHeight,
    getTime,
    getParamCount,
    clamp01,
    clamp,
    contrast01,
    now
  } = deps;

  function fallbackColor(x, y) {
    const t = getTime();
    return [
      Math.sin(x * 0.2 + t) * 127 + 128,
      Math.sin(y * 0.2 + t) * 127 + 128,
      120
    ];
  }

  function layerCoords(layerState, x, y) {
    const W = getWidth();
    const H = getHeight();
    let nx = W <= 1 ? 0 : x / (W - 1);
    let ny = H <= 1 ? 0 : y / (H - 1);

    // Mirror around center without stretching across full range:
    // sample from centered half so symmetric forms stay visually centered.
    if (layerState.mirrorX) nx = 0.5 + Math.abs(nx - 0.5);
    if (layerState.mirrorY) ny = 0.5 + Math.abs(ny - 0.5);
    if (layerState.reverse) {
      nx = 1 - nx;
      ny = 1 - ny;
    }

    return { x: nx, y: ny };
  }

  function normalizedParams(params) {
    return Array.from({ length: getParamCount() }, (_, index) => clamp01(params[index] ?? 0.5));
  }

  function normalizeValue(value) {
    if (Array.isArray(value) || ArrayBuffer.isView(value)) {
      const r = Number(value[0] || 0);
      const g = Number(value[1] || 0);
      const b = Number(value[2] || 0);
      return contrast01(Math.max(0, Math.min(1, (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255)));
    }
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    if (number >= 0 && number <= 1) return contrast01(number);

    const wrapped = number - Math.floor(number);
    return contrast01(wrapped);
  }

  function cloneLayerState(layerState) {
    return {
      ...layerState,
      params: [...layerState.params],
      manualPalette: {
        ...layerState.manualPalette,
        active: [...layerState.manualPalette.active],
        colors: [...layerState.manualPalette.colors]
      }
    };
  }

  function normalizeHexColor(value, fallback) {
    return /^#[0-9a-f]{6}$/i.test(value || "") ? value.toLowerCase() : fallback;
  }

  function normalizeManualPalette(palette) {
    const fallback = ["#ff003c", "#12d6ff", "#ffe600"];
    return [0, 1, 2].map((index) => normalizeHexColor(palette?.colors?.[index], fallback[index]));
  }

  function normalizeManualPaletteActive(palette) {
    if (!Array.isArray(palette?.active)) return [true, false, false];
    const active = [0, 1, 2].map((index) => palette?.active?.[index] !== false);
    if (!active.some(Boolean)) active[0] = true;
    return active;
  }

  function activeManualPaletteColors(palette) {
    const colors = normalizeManualPalette(palette);
    const active = normalizeManualPaletteActive(palette);
    return colors.filter((_, index) => active[index]);
  }

  function hexToRgb(hex) {
    const normalized = normalizeHexColor(hex, "#000000");
    return [
      Number.parseInt(normalized.slice(1, 3), 16),
      Number.parseInt(normalized.slice(3, 5), 16),
      Number.parseInt(normalized.slice(5, 7), 16)
    ];
  }

  function hsvToRgb(h, s, v) {
    const c = v * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = v - c;
    let r = 0;
    let g = 0;
    let b = 0;

    if (h < 60) [r, g, b] = [c, x, 0];
    else if (h < 120) [r, g, b] = [x, c, 0];
    else if (h < 180) [r, g, b] = [0, c, x];
    else if (h < 240) [r, g, b] = [0, x, c];
    else if (h < 300) [r, g, b] = [x, 0, c];
    else [r, g, b] = [c, 0, x];

    return [r, g, b].map((value) => clamp((value + m) * 255));
  }

  function rgbToHex(color) {
    return `#${color.map((value) => Math.round(clamp(value)).toString(16).padStart(2, "0")).join("")}`;
  }

  function colorFromWheelEvent(canvas, event) {
    const rect = canvas.getBoundingClientRect();
    const size = Math.min(rect.width, rect.height);
    const center = size / 2;
    const x = event.clientX - rect.left - center;
    const y = event.clientY - rect.top - center;
    const radius = Math.sqrt(x * x + y * y);
    if (radius > center) return null;

    const hue = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
    const saturation = clamp01(radius / center);
    return rgbToHex(hsvToRgb(hue, saturation, 1));
  }

  function drawManualPaletteWheel(canvas, selectedColor) {
    const size = canvas.width;
    const context = canvas.getContext("2d");
    const image = context.createImageData(size, size);
    const center = size / 2;
    const outer = center - 2;

    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const dx = x - center;
        const dy = y - center;
        const radius = Math.sqrt(dx * dx + dy * dy);
        const offset = (y * size + x) * 4;
        if (radius > outer) {
          image.data[offset + 3] = 0;
          continue;
        }

        const hue = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
        const saturation = clamp01(radius / outer);
        const value = 1 - (1 - saturation) * 0.15;
        const color = hsvToRgb(hue, saturation, value);
        image.data[offset] = color[0];
        image.data[offset + 1] = color[1];
        image.data[offset + 2] = color[2];
        image.data[offset + 3] = radius < outer - 1 ? 255 : 235;
      }
    }

    context.clearRect(0, 0, size, size);
    context.putImageData(image, 0, 0);
    const rim = context.createRadialGradient(center, center, outer * 0.75, center, center, outer);
    rim.addColorStop(0, "rgba(255,255,255,0)");
    rim.addColorStop(1, "rgba(255,255,255,0.26)");
    context.strokeStyle = rim;
    context.lineWidth = 6;
    context.beginPath();
    context.arc(center, center, outer - 1, 0, Math.PI * 2);
    context.stroke();
    context.strokeStyle = "rgba(0,0,0,0.45)";
    context.lineWidth = 2;
    context.beginPath();
    context.arc(center, center, outer - 6, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = normalizeHexColor(selectedColor, "#ffffff");
    context.strokeStyle = "rgba(255,255,255,0.9)";
    context.lineWidth = 2;
    context.beginPath();
    context.arc(center, center, Math.max(14, Math.round(size * 0.09)), 0, Math.PI * 2);
    context.fill();
    context.stroke();
  }

  function transitionProgress(transition) {
    if (!transition || transition.duration <= 0) return 1;
    return clamp01((now() - transition.startedAt) / transition.duration);
  }

  function pickFile(current, files) {
    return files.includes(current) ? current : files[0] || "";
  }

  return {
    fallbackColor,
    layerCoords,
    normalizedParams,
    normalizeValue,
    cloneLayerState,
    normalizeHexColor,
    normalizeManualPalette,
    normalizeManualPaletteActive,
    activeManualPaletteColors,
    hexToRgb,
    hsvToRgb,
    rgbToHex,
    colorFromWheelEvent,
    drawManualPaletteWheel,
    transitionProgress,
    pickFile
  };
}
