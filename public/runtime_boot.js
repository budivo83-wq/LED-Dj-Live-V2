import { createFixedClock } from "./core/fixed_clock.js";
import { resolveModulePath } from "./core/module_loader.js";

function imageHasVisibleColor(imageData) {
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

export function startupStepRuntime(startupProfiling, startupOverlay, updateStartupOverlay, percent, label) {
  if (!startupProfiling.enabled || !startupOverlay?.root) return;
  updateStartupOverlay(startupOverlay, startupProfiling.startedAt, percent, label);
  startupProfiling.marks.push({
    label,
    atMs: Math.round(performance.now() - startupProfiling.startedAt)
  });
}

export async function preloadEverythingForStartupRuntime(deps) {
  const {
    startupStep,
    pathsForFolder,
    lists,
    loadModule,
    prewarmAllGpuCombos,
    warmupLayerPreviewShaders,
    startupTimingState
  } = deps;
  const startupClock = createFixedClock(60);

  const setStartupTiming = (patch) => {
    if (!startupTimingState) return;
    Object.assign(startupTimingState, patch);
  };

  startupStep(80, "Preloading animations and palettes");
  setStartupTiming({ phase: "modules", progress: 0, item: 0, total: 0, waitMs: 0 });
  const modulePaths = [
    ...pathsForFolder("l1_anims", lists.l1Anims),
    ...pathsForFolder("l2_anims", lists.l2Anims),
    ...pathsForFolder("l1_palettes", lists.l1Palettes),
    ...pathsForFolder("l2_palettes", lists.l2Palettes)
  ];

  for (let index = 0; index < modulePaths.length; index += 1) {
    await loadModule(modulePaths[index]);
    if (index % 6 === 5) {
      const ratio = (index + 1) / Math.max(1, modulePaths.length);
      startupStep(80 + ratio * 6, `Preloading modules ${index + 1}/${modulePaths.length}`);
      const waitMs = startupClock.delay();
      startupClock.advance();
      setStartupTiming({ phase: "modules", progress: ratio, item: index + 1, total: modulePaths.length, waitMs });
      if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }

  startupStep(86, "Compiling realtime render banks");
  setStartupTiming({ phase: "gpu-banks", progress: 0.86, item: 0, total: 0, waitMs: 0 });
  await prewarmAllGpuCombos((done, total) => {
    const ratio = total ? done / total : 1;
    setStartupTiming({ phase: "gpu-banks", progress: ratio, item: done, total, waitMs: 0 });
    startupStep(86 + ratio * 2, `Compiling render banks ${done}/${total}`);
  });

  startupStep(88, "Compiling preview shaders");
  setStartupTiming({ phase: "preview-shaders", progress: 0, item: 0, total: 0, waitMs: 0 });
  await warmupLayerPreviewShaders((done, total) => {
    const ratio = total ? done / total : 1;
    setStartupTiming({ phase: "preview-shaders", progress: ratio, item: done, total, waitMs: 0 });
    startupStep(88 + ratio * 4, `Compiling preview shaders ${done}/${total}`);
  });
  setStartupTiming({ phase: "ready", progress: 1, item: 0, total: 0, waitMs: 0 });
}

export async function preloadThumbnailCacheRuntime(deps) {
  const {
    lists,
    STARTUP_ANIM_THUMB_SIZE,
    thumbCacheKey,
    thumbCache,
    readThumbFromSession,
    writeThumbToSession,
    startupTimingState,
    runtimeProfile = {},
    renderAnimationThumb,
    renderPaletteThumb,
    startupStep
  } = deps;
  const thumbFps = Math.max(1, Math.min(60, Number(runtimeProfile.thumbnailFps || 8)));
  const thumbClock = createFixedClock(thumbFps);
  let cachedCount = 0;
  let renderedCount = 0;
  const setStartupTiming = (patch) => {
    if (!startupTimingState) return;
    Object.assign(startupTimingState, patch);
  };
  const tasks = [
    ...lists.l1Anims.map((file) => ({ kind: "anim", layer: "l1", folder: "l1_anims", file, sourcePath: resolveModulePath("l1_anims", file, lists.l1Anims) })),
    ...lists.l2Anims.map((file) => ({ kind: "anim", layer: "l2", folder: "l2_anims", file, sourcePath: resolveModulePath("l2_anims", file, lists.l2Anims) })),
    ...lists.l1Palettes.map((file) => ({ kind: "palette", layer: "l1", folder: "l1_palettes", file, sourcePath: resolveModulePath("l1_palettes", file, lists.l1Palettes) })),
    ...lists.l2Palettes.map((file) => ({ kind: "palette", layer: "l2", folder: "l2_palettes", file, sourcePath: resolveModulePath("l2_palettes", file, lists.l2Palettes) }))
  ];

  const canvas = document.createElement("canvas");
  canvas.width = STARTUP_ANIM_THUMB_SIZE.width;
  canvas.height = STARTUP_ANIM_THUMB_SIZE.height;

  for (let index = 0; index < tasks.length; index += 1) {
    const task = tasks[index];
    const key = thumbCacheKey(task);
    if (thumbCache.has(key)) continue;
    const sessionCached = readThumbFromSession?.(key);
    if (sessionCached && imageHasVisibleColor(sessionCached)) {
      thumbCache.set(key, sessionCached);
      cachedCount += 1;
      continue;
    }
    if (task.kind === "anim") await renderAnimationThumb(canvas, task.layer, task.file, task.folder, task.sourcePath);
    else await renderPaletteThumb(canvas, task.file, task.folder, task.sourcePath);
    const context = canvas.getContext("2d");
    if (context) {
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      thumbCache.set(key, imageData);
      writeThumbToSession?.(key, imageData);
      renderedCount += 1;
    }
    if (index % 4 === 3) {
      const ratio = (index + 1) / Math.max(1, tasks.length);
      const waitMs = thumbClock.delay();
      setStartupTiming({ phase: "thumbnails", progress: ratio, item: index + 1, total: tasks.length, waitMs, cachedCount, renderedCount, thumbFps });
      startupStep(92 + ratio * 7, `Caching thumbnails ${index + 1}/${tasks.length}`);
      thumbClock.advance();
      if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
  setStartupTiming({ phase: "thumbnails-ready", progress: 1, item: tasks.length, total: tasks.length, waitMs: 0, cachedCount, renderedCount, thumbFps });
}

export function finishStartupProfilingRuntime(startupProfiling, startupOverlay) {
  if (!startupProfiling.enabled || !startupOverlay?.root) return;
  const total = Math.round(performance.now() - startupProfiling.startedAt);
  const marks = (startupProfiling.marks || []).map((mark, index, arr) => {
    const prevAt = index > 0 ? Number(arr[index - 1]?.atMs || 0) : 0;
    const atMs = Number(mark?.atMs || 0);
    return {
      label: String(mark?.label || ""),
      atMs,
      deltaMs: Math.max(0, atMs - prevAt)
    };
  });
  const topSlow = [...marks]
    .sort((a, b) => b.deltaMs - a.deltaMs)
    .slice(0, 3);
  console.groupCollapsed(`[startup] ready in ${total} ms`);
  console.table(marks);
  if (topSlow.length) {
    console.info("[startup] slowest steps", topSlow.map((step) => `${step.label}: ${step.deltaMs}ms`).join(" | "));
  }
  console.groupEnd();
}
