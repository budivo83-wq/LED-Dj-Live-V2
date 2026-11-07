import { createSessionBitmapCache } from "./core/session_bitmap_cache.js";
import {
  captureVisibleThumbnail,
  drawFallbackThumbnail,
  imageHasVisibleColor
} from "./runtime/thumb_visuals.js";
import { thumbCacheKeyForTask } from "./runtime/thumb_keys.js";
import { createThumbQueueController } from "./runtime/thumb_queue.js";
import { resolveModulePath } from "./core/module_loader.js";

export function createUiPickers(deps) {
  const {
    state,
    modules,
    lists,
    thumbCache: sharedThumbCache,
    normalizedParams,
    getBeatPosition,
    normalizeValue,
    clamp,
    renderShaderLayerCanvas,
    cleanModuleName,
    loadModule,
    switchLayerModule,
    documentRef = document,
    runtimeProfile = {}
  } = deps;

  let animPicker = null;
  let palettePicker = null;
  let ignoreAnimPickerBackdropUntil = 0;
  let ignorePalettePickerBackdropUntil = 0;
  const thumbCache = sharedThumbCache || new Map();
  // STEP22MN: pickers are user-facing controls; when a picker is opened it must
  // be able to render missing thumbnails even if startup preload was expected.
  // The queue is already output-safe/adaptive, so do not leave tiles black just
  // because the boot cache was empty.
  const liveOutputThumbSafe = (() => {
    try { return localStorage.getItem('budilightLiveThumbRender22OA') === '1'; } catch { return false; }
  })();
  const runtimeThumbRenderEnabled = runtimeProfile.runtimeThumbRender !== false && runtimeProfile.thumbsEnabled !== false;
  let thumbRenderSession = 0;
  const thumbSessionCache = createSessionBitmapCache("led-thumb-v8-sharp-selector", { // STEP37ED: fresh high-resolution selector thumbnails; ignore older blurry 72x40 cache.
    maxEntries: Number(runtimeProfile.thumbnailCacheEntries || 256),
    maxBytes: Number(runtimeProfile.thumbnailCacheBytes || 18_000_000),
    documentRef
  });

  const ANIM_PICKER_THUMB_SIZE_37ED = { width: 144, height: 80 };
  const PALETTE_PICKER_THUMB_SIZE_37ED = { width: 144, height: 58 };

  function preparePickerThumbCanvas37ED(canvas, kind = "anim") {
    if (!canvas) return;
    const size = kind === "palette" ? PALETTE_PICKER_THUMB_SIZE_37ED : ANIM_PICKER_THUMB_SIZE_37ED;
    if (canvas.width !== size.width) canvas.width = size.width;
    if (canvas.height !== size.height) canvas.height = size.height;
    canvas.dataset.thumbSharp = "37ED";
    canvas.style.imageRendering = "pixelated";
  }

  function setThumbScalingQuality37ED(context, sourceWidth = 0, sourceHeight = 0, targetCanvas = null) {
    if (!context) return;
    const targetWidth = Number(targetCanvas?.width || 0);
    const targetHeight = Number(targetCanvas?.height || 0);
    const scalingUp = sourceWidth > 0 && sourceHeight > 0 && (sourceWidth < targetWidth || sourceHeight < targetHeight);
    context.imageSmoothingEnabled = !scalingUp;
    if (!scalingUp && 'imageSmoothingQuality' in context) context.imageSmoothingQuality = 'high';
  }

  function resolveListSourcePath(folder, file, list) {
    return resolveModulePath(folder, file, list || []);
  }

  function bindAnimationPicker(select, layer, listKey, folder) {
    const open = (event) => {
      event.preventDefault();
      event.stopPropagation();
      select.blur();
      openAnimationPicker(layer, listKey, folder);
    };

    select.classList.add("anim-select");
    select.addEventListener("pointerdown", open);
    select.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") open(event);
    });
  }

  async function openAnimationPicker(layer, listKey, folder) {
    const files = lists[listKey];
    if (!files.length) return;

    const picker = ensureAnimationPicker();
    const grid = picker.querySelector(".anim-picker-grid");
    picker.querySelector(".anim-picker-title").textContent = `${layer.toUpperCase()} ANIMATION`;
    grid.replaceChildren();
    const sessionId = ++thumbRenderSession;
    ignoreAnimPickerBackdropUntil = performance.now() + 450;
    picker.classList.add("active");
    documentRef.body.classList.add("modal-open");

    files.forEach((file) => {
      const sourcePath = resolveListSourcePath(folder, file, files);
      const button = documentRef.createElement("button");
      const canvas = documentRef.createElement("canvas");
      const label = documentRef.createElement("span");

      button.type = "button";
      button.className = "anim-tile";
      button.classList.toggle("active", state[layer].animFile === file);
      preparePickerThumbCanvas37ED(canvas, "anim");
      label.textContent = cleanModuleName(file);
      button.append(canvas, label);
      drawFallbackThumbnail(canvas.getContext("2d"), canvas.width, canvas.height, `anim:${sourcePath}:placeholder`);
      const preloadThisModule = () => {
        try { loadModule(sourcePath); } catch {}
      };
      button.addEventListener("pointerenter", preloadThisModule, { passive: true });
      button.addEventListener("focus", preloadThisModule);
      button.addEventListener("click", () => {
        if (performance.now() < ignoreAnimPickerBackdropUntil) return;
        selectAnimationFile(layer, file, folder);
      });
      grid.appendChild(button);
      // STEP22OA: while real live output is armed, thumbnail rendering is allowed
      // only from cache unless the operator explicitly opts in. Missing thumbs
      // stay as deterministic placeholders and are rendered slowly after output
      // becomes idle. This prevents opening the selector from importing/painting
      // dozens of modules at once.
      queueThumbRender({
        kind: "anim", canvas, layer, file, folder, sourcePath, sessionId,
        // STEP37DV: selector thumbnails are an explicit user-facing request.
        // They may render slowly through the queue even when live output is armed;
        // otherwise the picker shows only colored diagnostic placeholders.
        allowRuntimeRender: runtimeThumbRenderEnabled,
        forceRuntimeRender: true
      });
    });
  }

  function ensureAnimationPicker() {
    if (animPicker) return animPicker;

    animPicker = documentRef.createElement("div");
    animPicker.className = "anim-picker";
    animPicker.innerHTML = `
      <div class="anim-picker-head">
        <strong class="anim-picker-title">ANIMATION</strong>
        <button class="anim-picker-close" type="button">CLOSE</button>
      </div>
      <div class="anim-picker-grid"></div>
    `;
    animPicker.querySelector(".anim-picker-close").addEventListener("click", closeAnimationPicker);
    animPicker.addEventListener("click", (event) => {
      if (performance.now() < ignoreAnimPickerBackdropUntil) return;
      if (event.target === animPicker) closeAnimationPicker();
    });
    documentRef.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && animPicker?.classList.contains("active")) closeAnimationPicker();
    });
    documentRef.body.appendChild(animPicker);
    return animPicker;
  }

  function closeAnimationPicker() {
    thumbRenderSession += 1;
    animPicker?.classList.remove("active");
    documentRef.body.classList.remove("modal-open");
  }

  async function selectAnimationFile(layer, file, folder) {
    await switchLayerModule(layer, "animFile", folder, "anim", file, {
      files: lists[`${layer}Anims`],
      closePicker: true
    });
  }

  async function renderAnimationThumb(canvas, layer, file, folder, sourcePath = "") {
    const resolvedSource = String(sourcePath || "").trim() || resolveListSourcePath(folder, file, lists[`${layer}Anims`]);
    const anim = await loadModule(resolvedSource);
    const layerState = state[layer];
    const params = normalizedParams(layerState?.params || [0.5, 0.5, 0.5, 0.5]);
    const sampleTime = getBeatPosition() + 0.35;
    const seedText = `anim:${layer}:${resolvedSource}`;

    if (anim?.gpu && renderShaderLayerCanvas(canvas, anim.gpu, {
      time: sampleTime,
      beat: getBeatPosition(),
      params,
      paletteFile: layerState?.paletteFile,
      manualPalette: layerState?.manualPalette,
      flip: layerState?.reverse,
      mirrorX: layerState?.mirrorX,
      mirrorY: layerState?.mirrorY
      })) {
      const context = canvas.getContext("2d");
      if (context) {
        const test = context.getImageData(0, 0, canvas.width, canvas.height);
        if (imageHasVisibleColor(test)) return;
      } else {
        return;
      }
    }

    const context = canvas.getContext("2d");
    if (!context) return;
    const image = context.createImageData(canvas.width, canvas.height);

    for (let y = 0; y < canvas.height; y += 1) {
      for (let x = 0; x < canvas.width; x += 1) {
        const offset = (y * canvas.width + x) * 4;
        const nx = x / Math.max(1, canvas.width - 1);
        const ny = y / Math.max(1, canvas.height - 1);
        let rendered = 0;
        try {
          if (anim?.render) rendered = anim.render(nx, ny, sampleTime, params);
          else rendered = 0;
        } catch {
          rendered = 0;
        }
        if (Array.isArray(rendered) || ArrayBuffer.isView(rendered)) {
          const glow = 0.82 + 0.35 * Math.sin((nx + ny + sampleTime * 0.07) * Math.PI);
          image.data[offset] = clamp((rendered[0] || 0) * glow) | 0;
          image.data[offset + 1] = clamp((rendered[1] || 0) * glow) | 0;
          image.data[offset + 2] = clamp((rendered[2] || 0) * glow) | 0;
          image.data[offset + 3] = 255;
          continue;
        }
        const v = Math.max(0, Math.min(1, normalizeValue(rendered)));
        const glow = 0.82 + 0.35 * Math.sin((nx + ny + sampleTime * 0.07) * Math.PI);
        const heat = Math.max(0, Math.min(255, v * 255));
        image.data[offset] = clamp(heat * glow) | 0;
        image.data[offset + 1] = clamp((40 + heat * 0.72) * glow) | 0;
        image.data[offset + 2] = clamp((90 + heat * 0.38) * glow) | 0;
        image.data[offset + 3] = 255;
      }
    }
    context.putImageData(image, 0, 0);
    const finalImage = captureVisibleThumbnail(canvas, seedText);
    if (finalImage && !imageHasVisibleColor(finalImage)) {
      drawFallbackThumbnail(context, canvas.width, canvas.height, seedText);
    }
  }

  function bindPalettePicker(select, layer, listKey, folder) {
    const open = (event) => {
      event.preventDefault();
      event.stopPropagation();
      select.blur();
      openPalettePicker(layer, listKey, folder);
    };
    select.classList.add("palette-select");
    select.addEventListener("pointerdown", open);
    select.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") open(event);
    });
  }

  async function openPalettePicker(layer, listKey, folder) {
    const files = lists[listKey];
    if (!files.length) return;

    const picker = ensurePalettePicker();
    const grid = picker.querySelector(".palette-picker-grid");
    picker.querySelector(".palette-picker-title").textContent = `${layer.toUpperCase()} PALETTE`;
    grid.replaceChildren();
    const sessionId = ++thumbRenderSession;
    ignorePalettePickerBackdropUntil = performance.now() + 450;
    picker.classList.add("active");
    documentRef.body.classList.add("modal-open");

    files.forEach((file) => {
      const sourcePath = resolveListSourcePath(folder, file, files);
      const button = documentRef.createElement("button");
      const canvas = documentRef.createElement("canvas");
      const label = documentRef.createElement("span");
      button.type = "button";
      button.className = "anim-tile palette-tile";
      button.classList.toggle("active", state[layer].paletteFile === file);
      preparePickerThumbCanvas37ED(canvas, "palette");
      label.textContent = cleanModuleName(file);
      button.append(canvas, label);
      drawFallbackThumbnail(canvas.getContext("2d"), canvas.width, canvas.height, `palette:${sourcePath}:placeholder`);
      button.addEventListener("click", () => {
        if (performance.now() < ignorePalettePickerBackdropUntil) return;
        selectPaletteFile(layer, file, folder);
      });
      grid.appendChild(button);
      queueThumbRender({ kind: "palette", canvas, layer, file, folder, sourcePath, sessionId, allowRuntimeRender: runtimeThumbRenderEnabled, forceRuntimeRender: true });
    });
  }

  function ensurePalettePicker() {
    if (palettePicker) return palettePicker;
    palettePicker = documentRef.createElement("div");
    palettePicker.className = "anim-picker palette-picker";
    palettePicker.innerHTML = `
      <div class="anim-picker-head">
        <strong class="palette-picker-title">PALETTE</strong>
        <button class="anim-picker-close" type="button">CLOSE</button>
      </div>
      <div class="anim-picker-grid palette-picker-grid"></div>
    `;
    palettePicker.querySelector(".anim-picker-close").addEventListener("click", closePalettePicker);
    palettePicker.addEventListener("click", (event) => {
      if (performance.now() < ignorePalettePickerBackdropUntil) return;
      if (event.target === palettePicker) closePalettePicker();
    });
    documentRef.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && palettePicker?.classList.contains("active")) closePalettePicker();
    });
    documentRef.body.appendChild(palettePicker);
    return palettePicker;
  }

  function closePalettePicker() {
    thumbRenderSession += 1;
    palettePicker?.classList.remove("active");
    documentRef.body.classList.remove("modal-open");
  }

  async function selectPaletteFile(layer, file, folder) {
    await switchLayerModule(layer, "paletteFile", folder, "palette", file, {
      files: lists[`${layer}Palettes`],
      closePalettePicker: true
    });
  }

  async function renderPaletteThumb(canvas, file, folder, sourcePath = "") {
    const context = canvas.getContext("2d");
    if (!context) return;
    const image = context.createImageData(canvas.width, canvas.height);
    const list = folder === "l2_palettes" ? lists.l2Palettes : lists.l1Palettes;
    const resolvedSource = String(sourcePath || "").trim() || resolveListSourcePath(folder, file, list);
    const palette = await loadModule(resolvedSource);
    const seedText = `palette:${resolvedSource}`;
    for (let y = 0; y < canvas.height; y += 1) {
      for (let x = 0; x < canvas.width; x += 1) {
        const offset = (y * canvas.width + x) * 4;
        const value = x / Math.max(1, canvas.width - 1);
        let color = [24, 24, 32];
        try {
          if (palette?.color) color = palette.color(value).map(clamp);
        } catch {
          color = [value * 255, 128, 255 - value * 255];
        }
        image.data[offset] = color[0] | 0;
        image.data[offset + 1] = color[1] | 0;
        image.data[offset + 2] = color[2] | 0;
        image.data[offset + 3] = 255;
      }
    }
    context.putImageData(image, 0, 0);
    const finalImage = captureVisibleThumbnail(canvas, seedText);
    if (finalImage && !imageHasVisibleColor(finalImage)) {
      drawFallbackThumbnail(context, canvas.width, canvas.height, seedText);
    }
  }

  function readThumbFromSession(key) {
    return thumbSessionCache.read(key);
  }

  function writeThumbToSession(key, imageData) {
    thumbSessionCache.write(key, imageData);
  }

  const thumbQueueController = createThumbQueueController({
    thumbCache,
    readThumbFromSession,
    writeThumbToSession,
    imageHasVisibleColor,
    captureVisibleThumbnail,
    thumbCacheKey,
    drawThumbFromCache,
    renderAnimationThumb,
    renderPaletteThumb,
    getCurrentSessionId: () => thumbRenderSession,
    windowRef: window
  });

  function queueThumbRender(task) {
    thumbQueueController.queueThumbRender(task);
  }

  function processThumbRenderQueue(deadline) {
    thumbQueueController.processThumbRenderQueue(deadline);
  }

  function thumbCacheKey(task) {
    return thumbCacheKeyForTask(task);
  }

  function drawThumbFromCache(canvas, imageData) {
    const context = canvas.getContext("2d");
    if (!context || !imageData) return;
    if (imageData.width === canvas.width && imageData.height === canvas.height) {
      context.putImageData(imageData, 0, 0);
      return;
    }
    const tmp = documentRef.createElement("canvas");
    tmp.width = imageData.width;
    tmp.height = imageData.height;
    const tmpCtx = tmp.getContext("2d");
    if (!tmpCtx) return;
    tmpCtx.putImageData(imageData, 0, 0);
    setThumbScalingQuality37ED(context, imageData.width, imageData.height, canvas);
    context.drawImage(tmp, 0, 0, canvas.width, canvas.height);
  }

  return {
    bindAnimationPicker,
    openAnimationPicker,
    ensureAnimationPicker,
    closeAnimationPicker,
    selectAnimationFile,
    renderAnimationThumb,
    bindPalettePicker,
    openPalettePicker,
    ensurePalettePicker,
    closePalettePicker,
    selectPaletteFile,
    renderPaletteThumb,
    queueThumbRender,
    processThumbRenderQueue,
    thumbCacheKey,
    drawThumbFromCache,
    readThumbFromSession,
    writeThumbToSession
  };
}
