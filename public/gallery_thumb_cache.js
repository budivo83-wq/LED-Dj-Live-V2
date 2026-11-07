export function galleryThumbKey(item, cachePrefix) {
  if (!item) return "";
  return `${cachePrefix}${item.id || item.file || item.name || "unknown"}`;
}

export function galleryCandidateThumbKeys(item) {
  if (!item) return [];
  const keys = [];
  const source = String(item.source || "").replace(/^public\//, "");
  const file = String(item.file || "").replace(/^.*\//, "");
  if (source) keys.push(`anim:${source}`);
  if (file) {
    if (!keys.includes(`anim:l1_anims/${file}`)) keys.push(`anim:l1_anims/${file}`);
    if (!keys.includes(`anim:l2_anims/${file}`)) keys.push(`anim:l2_anims/${file}`);
  }
  return keys;
}

export function imageDataFromSessionPayload(payload) {
  try {
    const parsed = JSON.parse(payload);
    if (!parsed?.w || !parsed?.h || !parsed?.d) return null;
    const binary = atob(parsed.d);
    const bytes = new Uint8ClampedArray(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    if (bytes.length !== parsed.w * parsed.h * 4) return null;
    return new ImageData(bytes, parsed.w, parsed.h);
  } catch {
    return null;
  }
}

export function drawGalleryImageData(canvas, imageData) {
  const ctx = canvas?.getContext?.("2d", { alpha: false });
  if (!ctx || !imageData) return false;
  if (imageData.width === canvas.width && imageData.height === canvas.height) {
    ctx.putImageData(imageData, 0, 0);
    return true;
  }
  const tmp = document.createElement("canvas");
  tmp.width = imageData.width;
  tmp.height = imageData.height;
  const tmpCtx = tmp.getContext("2d", { alpha: false });
  if (!tmpCtx) return false;
  tmpCtx.putImageData(imageData, 0, 0);
  const scalingUp = imageData.width < canvas.width || imageData.height < canvas.height;
  ctx.imageSmoothingEnabled = !scalingUp;
  if (!scalingUp && 'imageSmoothingQuality' in ctx) ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(tmp, 0, 0, canvas.width, canvas.height);
  return true;
}

export function drawGalleryFallbackThumb(canvas, label = "cached") {
  const ctx = canvas?.getContext?.("2d", { alpha: false });
  if (!ctx) return;
  const w = canvas.width || 180;
  const h = canvas.height || 70;
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, "#07131b");
  g.addColorStop(1, "#231033");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(0,217,255,.5)";
  ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
  ctx.fillStyle = "rgba(255,255,255,.74)";
  ctx.font = "11px system-ui, sans-serif";
  ctx.fillText(label, 10, Math.max(20, h / 2));
}

export function drawGalleryThumbFromPerformanceCache(canvas, item, sessionPrefix) {
  const candidates = galleryCandidateThumbKeys(item);
  for (const key of candidates) {
    const raw = sessionStorage.getItem(`${sessionPrefix}${key}`);
    const imageData = raw ? imageDataFromSessionPayload(raw) : null;
    if (imageData && drawGalleryImageData(canvas, imageData)) return true;
  }
  return false;
}

export function drawGalleryThumbFromCache(canvas, item, options) {
  const {
    cachePrefix,
    sessionPrefix,
    runtimeThumbRender,
    thumbMemoryCache
  } = options;
  const key = galleryThumbKey(item, cachePrefix);
  if (!canvas || !key) return false;
  if (drawGalleryThumbFromPerformanceCache(canvas, item, sessionPrefix)) return true;
  const cached = thumbMemoryCache.get(key) || sessionStorage.getItem(key);
  if (!cached) {
    drawGalleryFallbackThumb(canvas, runtimeThumbRender ? "render queued" : "boot cache");
    return false;
  }
  const img = new Image();
  img.onload = () => {
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;
    const scalingUp = Number(img.naturalWidth || img.width || 0) < canvas.width || Number(img.naturalHeight || img.height || 0) < canvas.height;
    ctx.imageSmoothingEnabled = !scalingUp;
    if (!scalingUp && 'imageSmoothingQuality' in ctx) ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  };
  img.src = cached;
  if (!thumbMemoryCache.has(key)) thumbMemoryCache.set(key, cached);
  return true;
}

export function storeGalleryThumbToCache(canvas, item, options) {
  const { cachePrefix, thumbMemoryCache } = options;
  const key = galleryThumbKey(item, cachePrefix);
  if (!canvas || !key) return;
  try {
    const value = canvas.toDataURL("image/webp", 0.86);
    thumbMemoryCache.set(key, value);
    sessionStorage.setItem(key, value);
  } catch {
    // Ignore storage quota/canvas failures; thumbnail can be redrawn if needed.
  }
}
