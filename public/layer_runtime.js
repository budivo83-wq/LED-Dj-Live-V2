import { createFixedClock } from "./core/fixed_clock.js";
import { createSessionBitmapCache } from "./core/session_bitmap_cache.js";

export function createLayerRuntime(deps) {
  const {
    state,
    settings,
    modules,
    transitions,
    layerButtons,
    animPicker,
    palettePicker,
    rawPreviewLastAt,
    rawPreviewSignature,
    RAW_PREVIEW_FPS,
    RAW_PREVIEW_SCALE,
    FORCE_CPU_LAYER_PREVIEW,
    renderShaderLayerCanvas,
    normalizedParams,
    layerCoords,
    normalizeValue,
    activeManualPaletteColors,
    hexToRgb,
    mixColor,
    clamp,
    clamp01,
    fallbackColor,
    getBeatPosition,
    transitionProgress,
    easeInOut,
    WRef,
    HRef,
    tRef
  } = deps;
  const rawPreviewSessionCache = createSessionBitmapCache("led-rawpreview-v1", {
    maxEntries: 36,
    maxBytes: 1_500_000
  });
  const selectorBackgroundLastAt = { l1: 0, l2: 0 };
  const rawPreviewClocks = {
    l1: createFixedClock(RAW_PREVIEW_FPS),
    l2: createFixedClock(RAW_PREVIEW_FPS)
  };
  const outputCorrectionCache = {
    key: "",
    table: new Uint8ClampedArray(256)
  };
  let frameOutputCorrectionTable = null;
  let frameRenderTime = null;
  let frameWidth = 0;
  let frameHeight = 0;
  let frameLayerTransitions = null;
  // STEP22OC: hot render path cache. The old renderer recalculated normalized
  // params, layer time and allocated a coords object for every pixel/layer.
  // At 8×300×2 layers×60 FPS that is thousands of avoidable allocations per
  // second and it shows as UI/output stutter. Cache per layer-state per render
  // time and compute coords as scalars.
  const renderHotCache = new WeakMap();

  function getLayerHotState(layerState) {
    const renderT = frameRenderTime == null ? tRef() : frameRenderTime;
    const params = layerState?.params;
    const previous = renderHotCache.get(layerState);
    if (previous && previous.t === renderT && previous.params === params) return previous;
    const next = {
      t: renderT,
      params,
      layerT: layerTime(layerState),
      normParams: normalizedParams(params)
    };
    renderHotCache.set(layerState, next);
    return next;
  }

  function layerCoordX(layerState, x) {
    const W = frameWidth || WRef();
    let nx = W <= 1 ? 0 : x / (W - 1);
    if (layerState.mirrorX) nx = 0.5 + Math.abs(nx - 0.5);
    if (layerState.reverse) nx = 1 - nx;
    return nx;
  }

  function layerCoordY(layerState, y) {
    const H = frameHeight || HRef();
    let ny = H <= 1 ? 0 : y / (H - 1);
    if (layerState.mirrorY) ny = 0.5 + Math.abs(ny - 0.5);
    if (layerState.reverse) ny = 1 - ny;
    return ny;
  }

  function layerTime(layerState) {
    const time = frameRenderTime == null ? tRef() : frameRenderTime;
    return layerState.beatSync ? Math.floor(time) : time;
  }

  function getLayerVisibility(layerState) {
    if (layerState.blackout) return 0;
    if (layerState.flash) return 1;
    return layerState.enabled ? 1 : 0;
  }

  function isLiveOutputActive() {
    const mode = String(settings.outputMode || "preview").toLowerCase();
    const networkMode = mode === "artnet" || mode === "sacn" || mode === "wifi" || mode === "espnow";
    const artnetOn = settings.artnetEnabled === true || settings.routerArtnetEnabled === true || state.artnetEnabled === true || networkMode;
    const serialOn = settings.routerSerialEnabled === true;
    const blxOn = settings.blxEnabled === true;
    const usbDmxOn = settings.usbDmxEnabled === true;
    return state.enabled !== false && (serialOn || artnetOn || blxOn || usbDmxOn);
  }

  function applyOutputCorrection(color) {
    const table = frameOutputCorrectionTable || getOutputCorrectionTable();
    return [
      table[color[0] | 0] | 0,
      table[color[1] | 0] | 0,
      table[color[2] | 0] | 0
    ];
  }

  function getOutputCorrectionTable() {
    const master = clamp01(state.master);
    const brightnessLimit = clamp01(settings.brightnessLimit);
    const gamma = Math.max(0.1, Number(settings.gamma) || 1);
    const key = `${master.toFixed(4)}|${brightnessLimit.toFixed(4)}|${gamma.toFixed(4)}`;
    if (outputCorrectionCache.key === key) return outputCorrectionCache.table;

    const gain = master * brightnessLimit;
    const table = outputCorrectionCache.table;
    for (let value = 0; value < 256; value += 1) {
      const normalized = clamp01((value / 255) * gain);
      table[value] = clamp(Math.pow(normalized, gamma) * 255) | 0;
    }
    outputCorrectionCache.key = key;
    return table;
  }

  function beginFrame() {
    frameRenderTime = tRef();
    frameWidth = WRef();
    frameHeight = HRef();
    frameOutputCorrectionTable = getOutputCorrectionTable();
    frameLayerTransitions = {
      l1: cacheLayerTransition(transitions.l1),
      l2: cacheLayerTransition(transitions.l2)
    };
  }

  function cacheLayerTransition(transition) {
    if (!transition) return null;
    const progress = transitionProgress(transition);
    return {
      transition,
      progress,
      amount: progress < 1 ? easeInOut(progress) : 1
    };
  }

  function manualPaletteColor(palette, value) {
    const colors = activeManualPaletteColors(palette).map(hexToRgb);
    if (colors.length <= 1) return colors[0] || [0, 0, 0];
    const position = clamp01(value) * (colors.length - 1);
    const index = Math.min(colors.length - 2, Math.floor(position));
    const local = position - index;
    return mixColor(colors[index], colors[index + 1], local).map(clamp);
  }

  function renderLayerColor(layerKey, layerState, layerModules, x, y) {
    if (!layerModules.anim?.render || (!layerModules.palette?.color && !layerState.manualPalette?.enabled)) {
      return fallbackColor(x, y);
    }
    try {
      const hot = getLayerHotState(layerState);
      const rendered = layerModules.anim.render(layerCoordX(layerState, x), layerCoordY(layerState, y), hot.layerT, hot.normParams);
      // STEP37DY: newer musical shaders can return direct RGB arrays. The old
      // path always forced Number(rendered), so RGB shaders became NaN/black or
      // looked like broken scale in selectors/output. Keep scalar shaders on the
      // palette path, but pass RGB shaders through as real colors.
      if (Array.isArray(rendered) || ArrayBuffer.isView(rendered)) {
        // RGB-returning musical shaders must still pass through the selected
        // layer palette. Treat shader luminance as the palette coordinate so
        // palette selection remains authoritative for every animation type.
        const red = clamp(rendered[0]);
        const green = clamp(rendered[1]);
        const blue = clamp(rendered[2]);
        const paletteValue = clamp01((red * 0.2126 + green * 0.7152 + blue * 0.0722) / 255);
        if (layerState.manualPalette?.enabled) return manualPaletteColor(layerState.manualPalette, paletteValue);
        const color = layerModules.palette?.color?.(paletteValue);
        return color ? [clamp(color[0]), clamp(color[1]), clamp(color[2])] : [red, green, blue];
      }
      const value = normalizeValue(rendered);
      if (layerState.manualPalette?.enabled) return manualPaletteColor(layerState.manualPalette, value);
      const color = layerModules.palette.color(value);
      return [clamp(color[0]), clamp(color[1]), clamp(color[2])];
    } catch (error) {
      console.warn(`Render error in ${layerKey}`, error);
      return [0, 0, 0];
    }
  }

  function getLayerColor(layerKey, x, y) {
    const layerState = state[layerKey];
    const layerModules = modules[layerKey];
    const transition = transitions[layerKey];

    if (transition) {
      const cachedTransition = frameLayerTransitions?.[layerKey];
      const progress = cachedTransition?.transition === transition
        ? cachedTransition.progress
        : transitionProgress(transition);
      if (progress < 1) {
        const previous = renderLayerColor(layerKey, transition.state, transition.modules, x, y);
        const current = renderLayerColor(layerKey, layerState, layerModules, x, y);
        const amount = cachedTransition?.transition === transition
          ? cachedTransition.amount
          : easeInOut(progress);
        return mixColor(previous, current, amount);
      }
    }
    return renderLayerColor(layerKey, layerState, layerModules, x, y);
  }

  function updateAnimationSelectorBackground(layer, canvas, nowMs) {
    if (isLiveOutputActive()) return;
    if (!canvas || nowMs - (selectorBackgroundLastAt[layer] || 0) < 450) return;
    const select = document.getElementById(`${layer}_anim`);
    if (!select) return;
    try {
      selectorBackgroundLastAt[layer] = nowMs;
      const dataUrl = canvas.toDataURL("image/png");
      select.style.backgroundImage = `linear-gradient(90deg, rgba(1,6,14,.78), rgba(1,6,14,.46)), url(${dataUrl})`;
      select.style.backgroundSize = "cover";
      select.style.backgroundPosition = "center";
      select.style.color = "#f4fbff";
      select.style.textShadow = "0 1px 4px rgba(0,0,0,.9)";
    } catch {
      // Some GPU/canvas paths can refuse export; keep the selector normal.
    }
  }

  function drawLayerRawPreview(layer) {
    const preview = layerButtons[`${layer}_raw_preview`];
    const previewCanvas = layerButtons[`${layer}_raw_canvas`];
    if (!preview || !previewCanvas) return;
    if (!settings.layerPreviewEnabled) return;

    const now = performance.now();
    const liveOutputActive = isLiveOutputActive();
    const previewClock = rawPreviewClocks[layer];
    if (previewClock && !previewClock.due(now)) return;
    if (previewClock) previewClock.setNextAt(now + previewClock.frameMs);
    rawPreviewLastAt[layer] = now;

    const previewWidth = Math.max(48, Math.round(180 * RAW_PREVIEW_SCALE));
    const previewHeight = Math.max(8, Math.round(22 * RAW_PREVIEW_SCALE));
    if (previewCanvas.width !== previewWidth) previewCanvas.width = previewWidth;
    if (previewCanvas.height !== previewHeight) previewCanvas.height = previewHeight;

    preview.classList.toggle("is-off", !state[layer].previewOn);
    if (!state[layer].previewOn) {
      const previewContext = previewCanvas.getContext("2d");
      previewContext.fillStyle = "rgb(0,0,0)";
      previewContext.fillRect(0, 0, previewCanvas.width, previewCanvas.height);
      updateAnimationSelectorBackground(layer, previewCanvas, now);
      rawPreviewSignature[layer] = "";
      return;
    }
    if (animPicker()?.classList.contains("active") || palettePicker()?.classList.contains("active")) return;

    const beatBucket = Math.floor(layerTime(state[layer]) * 4);
    const signature = [
      state[layer].animFile,
      state[layer].paletteFile,
      state[layer].master.toFixed(2),
      state[layer].enabled ? 1 : 0,
      state[layer].blackout ? 1 : 0,
      state[layer].flash ? 1 : 0,
      state[layer].reverse ? 1 : 0,
      state[layer].mirrorX ? 1 : 0,
      state[layer].mirrorY ? 1 : 0,
      state[layer].params.map((value) => Number(value).toFixed(2)).join(","),
      beatBucket
    ].join("|");
    if (rawPreviewSignature[layer] === signature) {
      updateAnimationSelectorBackground(layer, previewCanvas, now);
      return;
    }
    rawPreviewSignature[layer] = signature;

    const previewContext = previewCanvas.getContext("2d");
    previewContext.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    const cacheKey = `${layer}:${signature}`;
    const sessionCached = rawPreviewSessionCache.read(cacheKey);
    if (sessionCached) {
      previewContext.putImageData(sessionCached, 0, 0);
      updateAnimationSelectorBackground(layer, previewCanvas, now);
      return;
    }

    if (
      !FORCE_CPU_LAYER_PREVIEW &&
      modules[layer].anim?.gpu &&
      !state[layer].manualPalette?.enabled &&
      renderShaderLayerCanvas(previewCanvas, modules[layer].anim.gpu, {
        time: layerTime(state[layer]),
        beat: getBeatPosition(),
        params: normalizedParams(state[layer].params),
        paletteFile: state[layer].paletteFile,
        flip: state[layer].reverse,
        mirrorX: state[layer].mirrorX,
        mirrorY: state[layer].mirrorY
      })
    ) {
      if (!liveOutputActive) {
        const cached = previewContext.getImageData(0, 0, previewCanvas.width, previewCanvas.height);
        rawPreviewSessionCache.write(cacheKey, cached);
      }
      updateAnimationSelectorBackground(layer, previewCanvas, now);
      return;
    }

    const image = previewContext.createImageData(previewCanvas.width, previewCanvas.height);
    const W = WRef();
    const H = HRef();
    for (let y = 0; y < previewCanvas.height; y += 1) {
      for (let x = 0; x < previewCanvas.width; x += 1) {
        const offset = (y * previewCanvas.width + x) * 4;
        const sourceX = Math.round((x / Math.max(1, previewCanvas.width - 1)) * Math.max(0, W - 1));
        const sourceY = Math.round((y / Math.max(1, previewCanvas.height - 1)) * Math.max(0, H - 1));
        const color = renderLayerColor(layer, state[layer], modules[layer], sourceX, sourceY);
        image.data[offset] = color[0] | 0;
        image.data[offset + 1] = color[1] | 0;
        image.data[offset + 2] = color[2] | 0;
        image.data[offset + 3] = 255;
      }
    }
    previewContext.putImageData(image, 0, 0);
    if (!liveOutputActive) rawPreviewSessionCache.write(cacheKey, image);
    updateAnimationSelectorBackground(layer, previewCanvas, now);
  }

  return { layerTime, getLayerVisibility, applyOutputCorrection, beginFrame, manualPaletteColor, renderLayerColor, getLayerColor, drawLayerRawPreview };
}
