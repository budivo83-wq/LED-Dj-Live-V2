const MAPPING_STORAGE_KEY = "led-engine-mapping-v2";

function clamp(value, min, max, fallback = min) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
}

function readMapping(storage) {
  try {
    const parsed = JSON.parse(storage?.getItem?.(MAPPING_STORAGE_KEY) || "null");
    return parsed?.mapping || parsed || null;
  } catch {
    return null;
  }
}

export function createStagePreviewRenderer({ canvas, storage = globalThis.localStorage } = {}) {
  if (!canvas) return null;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return null;
  let width = 1;
  let height = 1;
  let lastMappingRaw = "";
  let mapping = null;
  const stripCanvas = typeof document !== "undefined" ? document.createElement("canvas") : null;
  const stripCtx = stripCanvas?.getContext?.("2d", { alpha: false }) || null;

  function resize(nextWidth, nextHeight) {
    width = Math.max(1, Math.round(Number(nextWidth) || 1));
    height = Math.max(1, Math.round(Number(nextHeight) || 1));
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
  }

  function currentMapping() {
    let raw = "";
    try { raw = storage?.getItem?.(MAPPING_STORAGE_KEY) || ""; } catch {}
    if (raw !== lastMappingRaw) {
      lastMappingRaw = raw;
      mapping = readMapping(storage);
    }
    return mapping;
  }

  function draw(frame, frameWidth, frameHeight, enabled = true) {
    ctx.fillStyle = "#020406";
    ctx.fillRect(0, 0, width, height);
    if (!enabled || !(frame instanceof Uint8Array)) return;

    const activeMapping = currentMapping();
    const segments = Array.isArray(activeMapping?.segments) ? activeMapping.segments : [];
    if (!segments.length) {
      drawFallback(frame, frameWidth, frameHeight);
      return;
    }

    const virtualWidth = Math.max(1, Number(activeMapping?.virtual?.width || frameWidth || 1), ...segments.map((s) => Number(s?.source?.x || 0) + Number(s?.source?.width || s?.physical?.pixelCount || 1)));
    const virtualHeight = Math.max(1, Number(activeMapping?.virtual?.height || frameHeight || 1), ...segments.map((s) => Number(s?.source?.y || 0) + Number(s?.source?.height || 1)));
    const layoutMinX = Math.min(...segments.map((segment) => Number(segment?.source?.x || 0)));
    const layoutMaxX = Math.max(...segments.map((segment) => {
      const source = segment?.source || {};
      return Number(source.x || 0) + Number(source.width || segment?.physical?.pixelCount || 1);
    }));
    const pad = Math.max(12, Math.min(width, height) * 0.055);
    const scale = Math.min((width - pad * 2) / virtualWidth, (height - pad * 2) / virtualHeight);
    // Center the actual strip block, not the unused remainder of the virtual map.
    const offsetX = width / 2 - ((layoutMinX + layoutMaxX) * scale) / 2;
    const offsetY = (height - virtualHeight * scale) / 2;

    segments.forEach((segment, index) => {
      const source = segment?.source || {};
      const physical = segment?.physical || {};
      const sx = clamp(source.x, 0, 65535, 0);
      const sy = clamp(source.y, 0, 65535, index);
      const pixelCount = Math.max(1, Math.round(Number(physical.pixelCount || source.width || frameWidth || 1)));
      const sw = Math.max(1, Number(source.width || pixelCount));
      const sh = Math.max(1, Number(source.height || 1));
      const x = offsetX + sx * scale;
      const y = offsetY + sy * scale;
      const w = Math.max(8, sw * scale);
      const h = Math.max(14, sh * scale);
      const color = segment.enabled === false ? "rgba(100,110,120,.25)" : "rgba(255,255,255,.08)";

      ctx.fillStyle = color;
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = "rgba(255,255,255,.28)";
      ctx.lineWidth = Math.max(1, scale * 0.018);
      ctx.strokeRect(x, y, w, h);

      const drawablePixels = Math.min(pixelCount, Math.max(0, Number(frameWidth) || 0));
      if (drawablePixels > 0 && stripCanvas && stripCtx) {
        if (stripCanvas.width !== drawablePixels || stripCanvas.height !== 1) {
          stripCanvas.width = drawablePixels;
          stripCanvas.height = 1;
        }
        const image = stripCtx.createImageData(drawablePixels, 1);
        for (let pixel = 0; pixel < drawablePixels; pixel += 1) {
          const framePixel = String(physical.direction || "forward").toLowerCase() === "reverse"
            ? drawablePixels - 1 - pixel
            : pixel;
          const sourceOffset = (index * frameWidth + framePixel) * 3;
          const targetOffset = pixel * 4;
          image.data[targetOffset] = frame[sourceOffset] || 0;
          image.data[targetOffset + 1] = frame[sourceOffset + 1] || 0;
          image.data[targetOffset + 2] = frame[sourceOffset + 2] || 0;
          image.data[targetOffset + 3] = 255;
        }
        stripCtx.putImageData(image, 0, 0);
        stripCtx.imageSmoothingEnabled = false;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(stripCanvas, x, y, w, h);
      }

      if (w > 48 && h > 18) {
        ctx.fillStyle = "rgba(239,246,255,.92)";
        ctx.font = `${Math.max(10, Math.min(15, h * 0.34))}px ui-sans-serif`;
        ctx.fillText(`${index + 1}. ${String(segment.label || `STRIP ${index + 1}`)}`, x + 5, y + Math.min(h - 5, 14));
      }
    });

    ctx.fillStyle = "rgba(239,246,255,.62)";
    ctx.font = "11px ui-sans-serif";
    ctx.fillText(`STAGE · ${virtualWidth} × ${virtualHeight} mapping`, 12, height - 10);
  }

  function drawFallback(frame, frameWidth, frameHeight) {
    const cellW = width / Math.max(1, frameWidth);
    const cellH = height / Math.max(1, frameHeight);
    for (let y = 0; y < frameHeight; y += 1) {
      for (let x = 0; x < frameWidth; x += 1) {
        const offset = (y * frameWidth + x) * 3;
        ctx.fillStyle = `rgb(${frame[offset] || 0},${frame[offset + 1] || 0},${frame[offset + 2] || 0})`;
        ctx.fillRect(x * cellW, y * cellH, Math.ceil(cellW), Math.ceil(cellH));
      }
    }
  }

  return { resize, draw };
}
