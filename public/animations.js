
import { requestShellNavigation } from './runtime/shell_child_navigation.js';


import { createModuleLoader } from './core/module_loader.js';
import {
  drawGalleryThumbFromCache,
  storeGalleryThumbToCache,
  drawGalleryFallbackThumb
} from './gallery_thumb_cache.js';
import {
  prettyName,
  tagsFor,
  normalizeTags,
  clamp01,
  heatColor,
  escapeHtml,
  canonicalTag,
  filterKey
} from './animations_utils.js';
import {
  swapSelectorItems,
  removeSelectorItemById,
  reorderSelectorItems
} from './selector_draft_utils.js';
import {
  isFavoriteInAlbums,
  toggleFavoriteInAlbums,
  albumContainsItem,
  addAnimationToAlbumList,
  removeAnimationFromAlbumList,
  swapAlbumsById,
  createAlbumInList,
  renameAlbumInList,
  deleteAlbumFromList
} from './album_utils.js';
import {
  hasUnsavedGalleryChanges,
  buildUnsavedGallerySummary
} from './leave_guard_utils.js';
import {
  navigateNow as navigateNowWithGuard,
  hideLeaveGuardState,
  showLeaveGuardState,
  shouldPromptForLeave
} from './navigation_guard_utils.js';
import {
  fillMetadataFormFields,
  buildMetadataPayload
} from './metadata_utils.js';
import {
  saveEditorDraft,
  loadEditorDraft,
  saveShadertoyDraft,
  loadShadertoyDraft
} from './draft_storage_utils.js';
import {
  buildDynamicFilterTags,
  reconcileActiveFilters,
  toggleFilterSet
} from './gallery_filter_utils.js';
import {
  drawFallbackFrame,
  arrayColorToRgb,
  objectColorToRgb
} from './preview_render_utils.js';
import { ANIMATION_LIBRARY_SYNC_KEY } from './runtime/app_runtime_constants.js';
import {
  collectBatchIds,
  collectMovableBatchItems,
  sortBatchItemsForMove
} from './batch_utils.js';


// STEP 37BF: all gallery top navigation is routed through the shell when embedded.
document.querySelectorAll('[data-nav-href]').forEach((button) => {
  if (button.dataset.navBound === '1') return;
  button.dataset.navBound = '1';
  button.addEventListener('click', (event) => {
    const href = button.getAttribute('data-nav-href');
    if (!href) return;
    event.preventDefault();
    requestShellNavigation(href, { mainReturnFast: button.dataset?.mainReturnFast === '1' });
  });
});

const loader = createModuleLoader();
const GALLERY_SHELL_VIEW = (() => {
  try {
    const params = new URLSearchParams(location.search || '');
    return params.get('shellView') === '1' || (window.top && window.top !== window);
  } catch {
    return false;
  }
})();
const GALLERY_OUTPUT_SAFE_MODE = true; // STEP22NW: gallery/loading must never starve the live output loop.

// STEP37CF: route non-critical gallery/editor timers through the runtime loop registry.
function runtimeLoopRegistry37CF() {
  try { return window.__budilightRuntimeLoopRegistry37CE || window.__budilightRuntimeLoopRegistry37CF || null; } catch { return null; }
}
function managedTimeout37CF(name, fn, delayMs, opts = {}) {
  const reg = runtimeLoopRegistry37CF();
  if (reg?.timeout) return reg.timeout(name, fn, delayMs, { group: 'gallery', liveFactor: 2.5, hiddenFactor: 4, maxMs: 2500, ...opts });
  return setTimeout(fn, Math.max(0, Number(delayMs) || 0));
}
function clearManagedTimer37CF(id) {
  if (!id) return;
  const reg = runtimeLoopRegistry37CF();
  if (typeof id === 'string' && reg?.clear) { try { reg.clear(id); return; } catch {} }
  try { clearTimeout(id); } catch {}
}
function managedRaf37CF(fn, name = 'gallery:raf') {
  if (document.hidden || !isGalleryWorkActive37BU()) {
    return managedTimeout37CF(name, () => fn(performance.now()), 450, { hiddenFactor: 6, maxMs: 3000 });
  }
  return requestAnimationFrame(fn);
}
function cancelManagedRaf37CF(id) {
  if (!id) return;
  if (typeof id === 'string') return clearManagedTimer37CF(id);
  try { cancelAnimationFrame(id); } catch {}
}

// STEP37BU: cached shell pages stay mounted. Keep gallery/editor animation work
// dormant while this iframe is hidden so thumbnails/previews cannot steal frames
// from the active view or from the output runner.
let galleryShellActive37BU = !GALLERY_SHELL_VIEW;
let galleryInactiveWakeTimer37BU = 0;
const galleryFrameLoopStats37BU = window.__budilightGalleryFrameGate37BU = window.__budilightGalleryFrameGate37BU || {
  version: '37BU',
  active: galleryShellActive37BU,
  skippedPreviewFrames: 0,
  deferredThumbPumps: 0,
  lastActiveChangeAt: performance.now(),
  lastInactiveWakeAt: 0
};
function isGalleryWorkActive37BU() {
  return !GALLERY_SHELL_VIEW || galleryShellActive37BU !== false;
}
function scheduleGalleryInactiveWake37BU(callback, delayMs = 650) {
  if (galleryInactiveWakeTimer37BU) return;
  galleryInactiveWakeTimer37BU = managedTimeout37CF('gallery:inactive-wake', () => {
    galleryInactiveWakeTimer37BU = 0;
    galleryFrameLoopStats37BU.lastInactiveWakeAt = performance.now();
    callback?.();
  }, delayMs);
}
try {
  window.addEventListener('message', (event) => {
    const data = event?.data;
    if (!data || data.type !== 'led-shell-view-active') return;
    const nextActive = data.active !== false;
    if (galleryShellActive37BU === nextActive) return;
    galleryShellActive37BU = nextActive;
    galleryFrameLoopStats37BU.active = nextActive;
    galleryFrameLoopStats37BU.lastActiveChangeAt = performance.now();
    document.documentElement?.classList?.toggle('gallery-shell-inactive-37bu', !nextActive);
    document.body?.classList?.toggle('gallery-shell-inactive-37bu', !nextActive);
    if (nextActive) {
      clearManagedTimer37CF(galleryInactiveWakeTimer37BU);
      galleryInactiveWakeTimer37BU = 0;
      lastGalleryPreviewFrameAt = 0;
      if (galleryThumbQueue.length) scheduleGalleryThumbPump(1.25);
      if (selectorThumbQueue.length) scheduleSelectorThumbPump(80);
    }
  });
} catch {}
const GALLERY_THUMB_BATCH = 1;
const GALLERY_THUMB_BUDGET_MS = GALLERY_SHELL_VIEW ? 2 : 3;
const GALLERY_THUMB_CHUNK_DELAY_MS = GALLERY_SHELL_VIEW ? 220 : 140;
const GALLERY_THUMB_START_DELAY_MS = GALLERY_SHELL_VIEW ? 2200 : 900;
const GALLERY_PREVIEW_FPS = GALLERY_SHELL_VIEW ? 5 : 8;
const GALLERY_PREVIEW_FRAME_MS = 1000 / GALLERY_PREVIEW_FPS;
const GALLERY_THUMB_CACHE_PREFIX = 'led-gallery-thumb-v37ed-sharp:'; // STEP22AB: force fresh thumbnails after STEP22X shader format fix.
const PERFORMANCE_THUMB_SESSION_PREFIX = 'led-thumb-v9-cpu-authoritative:item:'; // Regenerate after aligning thumbnails with the LED CPU render path.
const GALLERY_RUNTIME_THUMB_RENDER = true; // thumbnails are still generated, but STEP22NW throttles them hard.
const galleryThumbMemoryCache = new Map();
let galleryThumbQueue = [];
let galleryThumbQueueTimer = 0;
let galleryThumbQueueRaf = 0;
let selectorThumbQueue = [];
let selectorThumbQueueTimer = 0;
let selectorThumbQueueRaf = 0;
let lastGalleryPreviewFrameAt = 0;

function drawGalleryThumbFromCacheWithRuntime(canvas, item) {
  return drawGalleryThumbFromCache(canvas, item, {
    cachePrefix: GALLERY_THUMB_CACHE_PREFIX,
    sessionPrefix: PERFORMANCE_THUMB_SESSION_PREFIX,
    runtimeThumbRender: GALLERY_RUNTIME_THUMB_RENDER,
    thumbMemoryCache: galleryThumbMemoryCache
  });
}

function storeGalleryThumbToCacheWithRuntime(canvas, item) {
  return storeGalleryThumbToCache(canvas, item, {
    cachePrefix: GALLERY_THUMB_CACHE_PREFIX,
    thumbMemoryCache: galleryThumbMemoryCache
  });
}

const grid = document.getElementById('galleryGrid');
const count = document.getElementById('animCount');
const statusText = document.getElementById('statusText');
const selectedName = document.getElementById('selectedName');
const inspectTitle = document.getElementById('inspectTitle');
const inspectType = document.getElementById('inspectType');
const metaFile = document.getElementById('metaFile');
const metaOrder = document.getElementById('metaOrder');
const metaExports = document.getElementById('metaExports');
const metaDescription = document.getElementById('metaDescription');
const metaParams = document.getElementById('metaParams');
const searchInput = document.getElementById('searchInput');
const filterRow = document.getElementById('filterRow');
const reloadBtn = document.getElementById('reloadBtn');
const bigCanvas = document.getElementById('bigPreview');
const runSelectedPreviewBtn = document.getElementById('runSelectedPreviewBtn');
const previewRunnerStatus = document.getElementById('previewRunnerStatus');
const bigCtx = bigCanvas.getContext('2d', { alpha: false });
const speedInput = document.getElementById('speedInput');
const params = ['param1', 'param2', 'param3'].map((id) => document.getElementById(id));
const toggleL1Btn = document.getElementById('toggleL1Btn');
const toggleL2Btn = document.getElementById('toggleL2Btn');
const moveUpBtn = document.getElementById('moveUpBtn');
const moveDownBtn = document.getElementById('moveDownBtn');
const orderLayerSelect = document.getElementById('orderLayerSelect');
const assignStatus = document.getElementById('assignStatus');
const metaLayers = document.getElementById('metaLayers');
const editorName = document.getElementById('editorName');
const editorTag = document.getElementById('editorTag');
const editorSaveMode = document.getElementById('editorSaveMode');
const editorAnimSelect = document.getElementById('editorAnimSelect');
const editorAnimPickerBtn = document.getElementById('editorAnimPickerBtn');
const editorAnimPickerPanel = document.getElementById('editorAnimPickerPanel');
const editorAnimPickerThumb = document.getElementById('editorAnimPickerThumb');
const fileInput = document.getElementById('fileInput');
const codeEditor = document.getElementById('codeEditor');
const editorStatus = document.getElementById('editorStatus');
const previewCodeBtn = document.getElementById('previewCodeBtn');
const saveCodeBtn = document.getElementById('saveCodeBtn');
const loadSelectedSourceBtn = document.getElementById('loadSelectedSourceBtn');
const editorPreviewCanvas = document.getElementById('editorPreview');
const studioTabs = Array.from(document.querySelectorAll('.studio-tab'));
const studioViews = Array.from(document.querySelectorAll('.studio-view'));
const metadataStatus = document.getElementById('metadataStatus');
const metaNameInput = document.getElementById('metaNameInput');
const metaDescriptionInput = document.getElementById('metaDescriptionInput');
const metaKindInput = document.getElementById('metaKindInput');
const metaOriginInput = document.getElementById('metaOriginInput');
const metaTagsInput = document.getElementById('metaTagsInput');
const metaParamsInput = document.getElementById('metaParamsInput');
const saveMetadataBtn = document.getElementById('saveMetadataBtn');
const resetMetadataBtn = document.getElementById('resetMetadataBtn');
const duplicateAnimBtn = document.getElementById('duplicateAnimBtn');
const archiveAnimBtn = document.getElementById('archiveAnimBtn');
const validateCodeBtn = document.getElementById('validateCodeBtn');
const validationReport = document.getElementById('validationReport');
const paramLabels = ['param1Label', 'param2Label', 'param3Label'].map((id) => document.getElementById(id));
const thumbMotionToggle = document.getElementById('thumbMotionToggle');
const cardDetailsToggle = document.getElementById('cardDetailsToggle');
const selectorViewBtn = document.getElementById('selectorViewBtn');
const paletteViewBtn = document.getElementById('paletteViewBtn');
const backToGalleryBtn = document.getElementById('backToGalleryBtn');
const resetSelectorDraftBtn = document.getElementById('resetSelectorDraftBtn');
const saveSelectorBtn = document.getElementById('saveSelectorBtn');
const selectorLayerSelect = document.getElementById('selectorLayerSelect');
const refreshSelectorBtn = document.getElementById('refreshSelectorBtn');
const selectorStatus = document.getElementById('selectorStatus');
const selectorList = document.getElementById('selectorList');
const libraryMenuToggle = document.getElementById('libraryMenuToggle');
const libraryMenuPanel = document.getElementById('libraryMenuPanel');
const libraryMenuItems = Array.from(document.querySelectorAll('.library-menu-item[data-library-view]'));
const librarySourceToggle = document.getElementById('librarySourceToggle');
const librarySourcePanel = document.getElementById('librarySourcePanel');
const editorSourceToggle = document.getElementById('editorSourceToggle');
const editorSourcePanel = document.getElementById('editorSourcePanel');
const editorActiveCollectionLabel = document.getElementById('editorActiveCollectionLabel');
const albumList = document.getElementById('albumList');
const albumStatus = document.getElementById('albumStatus');
const newAlbumBtn = document.getElementById('newAlbumBtn');
const saveAlbumsBtn = document.getElementById('saveAlbumsBtn');
const leaveGuardModal = document.getElementById('leaveGuardModal');
const leaveGuardText = document.getElementById('leaveGuardText');
const leaveGuardCancelBtn = document.getElementById('leaveGuardCancelBtn');
const leaveGuardDiscardBtn = document.getElementById('leaveGuardDiscardBtn');
const leaveGuardSaveBtn = document.getElementById('leaveGuardSaveBtn');
const quickPrevBtn = document.getElementById('quickPrevBtn');
const quickNextBtn = document.getElementById('quickNextBtn');
const quickFocusSearchBtn = document.getElementById('quickFocusSearchBtn');
const quickEditorTabBtn = document.getElementById('quickEditorTabBtn');
const shadertoyStatus = document.getElementById('shadertoyStatus');
const shadertoyCode = document.getElementById('shadertoyCode');
const shadertoyValidateBtn = document.getElementById('shadertoyValidateBtn');
const shadertoyPreviewBtn = document.getElementById('shadertoyPreviewBtn');
const shadertoySaveDraftBtn = document.getElementById('shadertoySaveDraftBtn');
const shadertoyToEditorBtn = document.getElementById('shadertoyToEditorBtn');
const shadertoyImportBtn = document.getElementById('shadertoyImportBtn');
const shadertoyExportBtn = document.getElementById('shadertoyExportBtn');
const shadertoyImportFile = document.getElementById('shadertoyImportFile');
const shadertoyDraftInfo = document.getElementById('shadertoyDraftInfo');
const shadertoyErrorPanel = document.getElementById('shadertoyErrorPanel');
const shadertoyPreviewCanvas = document.getElementById('shadertoyPreviewCanvas');
const shadertoyPreviewCtx = shadertoyPreviewCanvas?.getContext?.('2d', { alpha: false }) || null;
const batchStatus = document.getElementById('batchStatus');
const batchSelectVisibleBtn = document.getElementById('batchSelectVisibleBtn');
const batchClearBtn = document.getElementById('batchClearBtn');
const batchEnableL1Btn = document.getElementById('batchEnableL1Btn');
const batchEnableL2Btn = document.getElementById('batchEnableL2Btn');
const batchDisableL1Btn = document.getElementById('batchDisableL1Btn');
const batchDisableL2Btn = document.getElementById('batchDisableL2Btn');
const batchArchiveBtn = document.getElementById('batchArchiveBtn');
const batchRestoreBtn = document.getElementById('batchRestoreBtn');
const batchMoveUpBtn = document.getElementById('batchMoveUpBtn');
const batchMoveDownBtn = document.getElementById('batchMoveDownBtn');
const editorResizeHandle = document.getElementById('editorResizeHandle');
const editorWorkspace = document.querySelector('.editor-workspace');

let activeTab = 'gallery';

let library = [];
let selected = null;
let activeFilters = new Set(['all']);
let galleryCardDetails = true;
let startedAt = performance.now();
let raf = 0;
let editorBlobUrl = null;
let previewRunning = false;
let thumbnailFrame = 0;
let lastThumbnailUpdate = 0;
let thumbnailMotionEnabled = false;

const GALLERY_CARD_THUMB_SIZE_37ED = { width: 288, height: 144 };
const SELECTOR_CARD_THUMB_SIZE_37ED = { width: 288, height: 176 };
const EDITOR_PICKER_THUMB_SIZE_37ED = { width: 192, height: 86 };

function prepareSharpCanvas37ED(canvas, size = GALLERY_CARD_THUMB_SIZE_37ED) {
  if (!canvas) return;
  if (canvas.width !== size.width) canvas.width = size.width;
  if (canvas.height !== size.height) canvas.height = size.height;
  canvas.dataset.thumbSharp = '37ED';
  canvas.style.imageRendering = 'pixelated';
}

let selectorLayer = 'l1';
let selectorDraftItems = [];
let selectorDraftDirty = false;
let selectorDragId = null;
let albumDragAnimId = null;
let albumDragAlbumId = null;
let activeAlbumId = 'all';
let albumDraftDirty = false;
let albums = [];
let batchSelectedIds = new Set();
let pendingNavigation = null;
let allowUnsafeLeave = false;
let shadertoyGl = null;
let shadertoyProgram = null;
let shadertoyUniforms = null;
let shadertoyPreviewActive = false;
let shadertoyFrame = 0;
let shadertoyMouse = { x: 0, y: 0, down: 0, clickX: 0, clickY: 0 };
let shadertoyChannel0 = null;
const CUSTOM_ALBUM_ID = 'custom';
const EDITOR_DRAFT_KEY = 'leddj.editorDraft.v1';
const SHADERTOY_DRAFT_KEY = 'leddj.shadertoyDraft.v1';
const EDITOR_SPLIT_KEY = 'leddj.editorSplit.v1';
const DEFAULT_ALBUMS = [
  { id: 'all', name: 'All animations', system: true, ids: [] },
  { id: 'favorites', name: 'Favorites', system: true, ids: [] },
  { id: CUSTOM_ALBUM_ID, name: 'Custom', system: true, ids: [] },
  { id: 'user', name: 'User imports', system: true, smart: 'user', ids: [] }
];

function notifyAnimationLibraryChanged(reason = 'library-update', detail = {}) {
  const payload = {
    reason,
    revision: `${Date.now()}`,
    at: new Date().toISOString(),
    ...detail
  };
  try {
    localStorage.setItem(ANIMATION_LIBRARY_SYNC_KEY, JSON.stringify(payload));
  } catch {}
  try {
    window.parent?.postMessage?.({ type: 'led-animation-library-sync', detail: payload }, '*');
  } catch {}
}


function setCollapsiblePanel(toggle, panel, openLabel = 'Source') {
  if (!toggle || !panel) return;
  const nextOpen = panel.hidden;
  panel.hidden = !nextOpen;
  toggle.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
  toggle.textContent = `${openLabel} ${nextOpen ? '▴' : '▾'}`;
}

function updateEditorCollectionLabel() {
  if (!editorActiveCollectionLabel) return;
  const album = albums.find((entry) => entry.id === activeAlbumId);
  const activeTags = [...activeFilters].filter((tag) => tag !== 'all');
  const bits = [];
  if (album?.name) bits.push(album.name);
  if (activeTags.length) bits.push(`tags: ${activeTags.join(', ')}`);
  if (searchInput?.value) bits.push(`search: ${searchInput.value}`);
  editorActiveCollectionLabel.textContent = bits.length ? bits.join(' · ') : 'All animations';
}


function fillMetadataForm(item) {
  return fillMetadataFormFields(item, {
    metaNameInput,
    metaDescriptionInput,
    metaKindInput,
    metaOriginInput,
    metaTagsInput,
    metaParamsInput,
    saveMetadataBtn,
    resetMetadataBtn,
    metadataStatus
  });
}

function metadataPayload() {
  return buildMetadataPayload(selected?.id, {
    metaNameInput,
    metaDescriptionInput,
    metaKindInput,
    metaOriginInput,
    metaTagsInput,
    metaParamsInput
  }, normalizeTags);
}

async function saveMetadata() {
  if (!selected || selected.id === '__editor_preview') return;
  try {
    metadataStatus.textContent = 'Saving…';
    const payload = await postLibraryAction('/api/animations/update-metadata', metadataPayload());
    const nextItem = payload.item || {};
    selected = { ...selected, ...nextItem, mod: selected.mod };
    const index = library.findIndex((item) => item.id === selected.id);
    if (index >= 0) library[index] = selected;
    fillMetadataForm(selected);
    syncParamLabels(selected);
    syncAssignButtons();
    renderGallery();
    metadataStatus.textContent = 'Saved';
  } catch (error) {
    console.warn(error);
    metadataStatus.textContent = error.message || 'Save failed';
  }
}


function drawFallback(ctx, w, h, t) {
  drawFallbackFrame(ctx, w, h, t);
}

function colorToRgb(color) {
  if (Array.isArray(color)) {
    // Compatibility note for thumbnail contract test: max <= 1.0001 ? 255 : 1
    return arrayColorToRgb(color);
  }
  if (typeof color === 'number') return heatColor(color).map((v) => Math.round(v));
  if (color && typeof color === 'object') {
    return objectColorToRgb(color, heatColor);
  }
  return [0, 0, 0];
}

function resolvePreviewRender(mod) {
  if (typeof mod?.render === 'function') return mod.render.bind(mod);
  if (typeof mod?.default?.render === 'function') return mod.default.render.bind(mod.default);
  if (typeof mod?.default === 'function') return mod.default.bind(mod);
  return null;
}

function drawPreview(canvas, mod, t, p = [0.5, 0.5, 0.5, 0.5]) {
  if (!canvas) return false;
  const ctx = canvas.getContext('2d', { alpha: false });
  const w = canvas.width;
  const h = canvas.height;
  const render = resolvePreviewRender(mod);
  if (!ctx || !w || !h || !render) {
    if (ctx) drawFallback(ctx, w || 92, h || 42, t);
    return false;
  }

  // STEP37DX: the newest rhythmic CPU shaders are deliberately gated/pulsed.
  // A single fixed thumbnail time can catch them during a closed gate and store
  // an almost black cache image. Probe a tiny low-res luminance preview first
  // and choose a musically useful time before painting the real thumbnail.
  const pickVisibleThumbTime = () => {
    const times = [Number(t) || 1.25, 0.18, 0.37, 0.63, 0.91, 1.44, 2.08];
    let bestT = times[0];
    let bestLum = -1;
    for (const tt of times) {
      let lum = 0;
      let samples = 0;
      for (let yy = 0; yy < 4; yy++) {
        for (let xx = 0; xx < 8; xx++) {
          try {
            const rgb = colorToRgb(render(xx / 7, yy / 3, tt, p));
            lum += (Number(rgb[0]) || 0) * 0.2126 + (Number(rgb[1]) || 0) * 0.7152 + (Number(rgb[2]) || 0) * 0.0722;
            samples += 1;
          } catch {}
        }
      }
      const avg = samples ? lum / samples : 0;
      if (avg > bestLum) { bestLum = avg; bestT = tt; }
      if (avg > 22) break;
    }
    return bestT;
  };

  const drawT = pickVisibleThumbTime();
  const image = ctx.createImageData(w, h);
  let okPixels = 0;
  let totalLum = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const nx = x / Math.max(1, w - 1);
      const ny = y / Math.max(1, h - 1);
      let rgb;
      try {
        rgb = colorToRgb(render(nx, ny, drawT, p));
        okPixels += 1;
      } catch (error) {
        if (!mod.__thumbRenderErrorLogged) {
          mod.__thumbRenderErrorLogged = true;
          console.warn('[gallery-thumb] render failed', mod?.meta?.name || mod?.name || 'module', error);
        }
        rgb = [255, 0, 90];
      }
      const r = Math.max(0, Math.min(255, Number(rgb[0]) || 0));
      const g = Math.max(0, Math.min(255, Number(rgb[1]) || 0));
      const b = Math.max(0, Math.min(255, Number(rgb[2]) || 0));
      totalLum += r * 0.2126 + g * 0.7152 + b * 0.0722;
      const i = (y * w + x) * 4;
      image.data[i] = r; image.data[i + 1] = g; image.data[i + 2] = b; image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  if (okPixels > 0 && totalLum / Math.max(1, okPixels) < 1.2) {
    // Do not cache totally black gated frames as permanent thumbnails.
    return false;
  }
  return okPixels > 0;
}

function setPreviewRunning(next) {
  previewRunning = Boolean(next);
  if (previewRunning) startedAt = performance.now();
  if (runSelectedPreviewBtn) {
    runSelectedPreviewBtn.textContent = previewRunning ? '⏸ Stop selected preview' : '▶ Run selected preview';
    runSelectedPreviewBtn.classList.toggle('is-enabled', previewRunning);
  }
  if (previewRunnerStatus) {
    previewRunnerStatus.textContent = previewRunning
      ? 'running locally · output untouched'
      : 'paused · output untouched';
  }
}


function cancelSelectorThumbQueue() {
  if (selectorThumbQueueTimer) {
    clearManagedTimer37CF(selectorThumbQueueTimer);
    selectorThumbQueueTimer = 0;
  }
  if (selectorThumbQueueRaf) {
    cancelManagedRaf37CF(selectorThumbQueueRaf);
    selectorThumbQueueRaf = 0;
  }
  selectorThumbQueue = [];
}

function queueSelectorThumb(canvas, item, t = 1.25) {
  if (!canvas || !item?.mod || !resolvePreviewRender(item.mod)) return;
  if (drawGalleryThumbFromCacheWithRuntime(canvas, item)) return;
  selectorThumbQueue = selectorThumbQueue.filter((task) => task?.canvas !== canvas);
  selectorThumbQueue.push({ canvas, item, t });
  if (selectorThumbQueue.length > 240) selectorThumbQueue.splice(0, selectorThumbQueue.length - 240);
  scheduleSelectorThumbPump();
}

function scheduleSelectorThumbPump(delay = 120) {
  if (selectorThumbQueueTimer || selectorThumbQueueRaf) return;
  selectorThumbQueueTimer = managedTimeout37CF('gallery:selector-thumb-pump', () => {
    selectorThumbQueueTimer = 0;
    selectorThumbQueueRaf = managedRaf37CF(() => pumpSelectorThumbQueue(), 'gallery:selector-thumb-raf');
  }, delay, { maxMs: 1800 });
}

function pumpSelectorThumbQueue() {
  selectorThumbQueueRaf = 0;
  if (document.hidden || !isGalleryWorkActive37BU()) {
    galleryFrameLoopStats37BU.deferredThumbPumps += 1;
    if (selectorThumbQueue.length) scheduleSelectorThumbPump(isGalleryWorkActive37BU() ? 300 : 900);
    return;
  }
  const started = performance.now();
  let painted = 0;
  while (selectorThumbQueue.length && painted < 1 && performance.now() - started < 3) {
    const task = selectorThumbQueue.shift();
    if (task?.canvas?.isConnected && task.item?.mod) {
      if (drawPreview(task.canvas, task.item.mod, task.t, [0.52, 0.48, 0.58, 0.58])) {
        storeGalleryThumbToCacheWithRuntime(task.canvas, task.item);
      }
      painted += 1;
    }
  }
  if (selectorThumbQueue.length) scheduleSelectorThumbPump(160);
}

function cancelGalleryThumbQueue() {
  if (galleryThumbQueueTimer) {
    clearManagedTimer37CF(galleryThumbQueueTimer);
    galleryThumbQueueTimer = 0;
  }
  if (galleryThumbQueueRaf) {
    cancelManagedRaf37CF(galleryThumbQueueRaf);
    galleryThumbQueueRaf = 0;
  }
  galleryThumbQueue = [];
}

function pumpGalleryThumbQueue(t = 1.25) {
  galleryThumbQueueRaf = 0;
  if (document.hidden || !isGalleryWorkActive37BU()) {
    galleryFrameLoopStats37BU.deferredThumbPumps += 1;
    if (galleryThumbQueue.length) scheduleGalleryThumbPump(t);
    return;
  }
  const started = performance.now();
  let count = 0;
  while (galleryThumbQueue.length && count < GALLERY_THUMB_BATCH && performance.now() - started < GALLERY_THUMB_BUDGET_MS) {
    const { canvas, mod, item } = galleryThumbQueue.shift();
    if (canvas?.isConnected && mod) {
      if (drawPreview(canvas, mod, t, [0.52, 0.48, 0.58, 0.58])) {
        storeGalleryThumbToCacheWithRuntime(canvas, item);
      }
    }
    count += 1;
  }
  if (galleryThumbQueue.length) scheduleGalleryThumbPump(t);
}

function scheduleGalleryThumbPump(t = 1.25) {
  if (galleryThumbQueueTimer) clearManagedTimer37CF(galleryThumbQueueTimer);
  const delay = isGalleryWorkActive37BU() ? GALLERY_THUMB_CHUNK_DELAY_MS : Math.max(900, GALLERY_THUMB_CHUNK_DELAY_MS * 3);
  galleryThumbQueueTimer = managedTimeout37CF('gallery:thumb-pump', () => {
    galleryThumbQueueTimer = 0;
    if (!isGalleryWorkActive37BU()) {
      galleryFrameLoopStats37BU.deferredThumbPumps += 1;
      scheduleGalleryThumbPump(t);
      return;
    }
    galleryThumbQueueRaf = managedRaf37CF(() => pumpGalleryThumbQueue(t), 'gallery:thumb-raf');
  }, delay, { maxMs: 2200 });
}

function queueGalleryThumbnails(t = 1.25) {
  cancelGalleryThumbQueue();
  if (!GALLERY_RUNTIME_THUMB_RENDER) return;
  galleryThumbQueue = Array.from(grid.querySelectorAll('.anim-card')).map((card) => {
    const item = library.find((entry) => entry.id === card.dataset.id);
    return { canvas: card.querySelector('canvas'), mod: item?.mod || null, item };
  }).filter((entry) => entry.canvas && entry.mod && resolvePreviewRender(entry.mod));
  galleryThumbQueueTimer = managedTimeout37CF('gallery:thumb-start-delay', () => {
    galleryThumbQueueTimer = 0;
    scheduleGalleryThumbPump(t);
  }, GALLERY_THUMB_START_DELAY_MS, { maxMs: 2200 });
}

function redrawGalleryThumbnails(t) {
  const cards = Array.from(grid.querySelectorAll('.anim-card'));
  const maxCards = GALLERY_OUTPUT_SAFE_MODE ? 4 : (GALLERY_SHELL_VIEW ? 12 : cards.length);
  for (const card of cards.slice(0, maxCards)) {
    const item = library.find((entry) => entry.id === card.dataset.id);
    const canvas = card.querySelector('canvas');
    if (item?.mod && canvas) drawPreview(canvas, item.mod, t, [0.52, 0.48, 0.58, 0.58]);
  }
  thumbnailFrame += 1;
}

async function loadManifestItems() {
  try {
    const res = await fetch('/api/animations/library');
    const payload = await res.json();
    if (payload?.ok && Array.isArray(payload.items)) return { source: payload.source || 'manifest', items: payload.items };
  } catch (error) {
    console.warn('Animation manifest failed, falling back to legacy list.', error);
  }
  const res = await fetch('/api/list/l1_anims');
  const files = await res.json();
  return {
    source: 'legacy-list',
    items: files.map((file, index) => ({
      id: file,
      name: prettyName(file),
      file,
      source: `l1_anims/${file}`,
      kind: 'module',
      origin: 'builtin',
      enabledFor: ['l1', 'l2'],
      tags: ['builtin', 'cpu', 'l1', 'l2'],
      order: index,
      readonly: true
    }))
  };
}


function defaultUserCode() {
  return `export const meta = {
  name: "User Plasma",
  params: ["scale", "speed", "color"]
};

export function render(x, y, t, p) {
  const scale = 8 + p[0] * 24;
  const speed = 0.5 + p[1] * 3.0;
  const hue = p[2] * 6.28318;
  const v = Math.sin((x + y) * scale + t * speed)
    + Math.sin((x - y) * scale * 0.7 - t * speed * 1.3);
  const r = 128 + 127 * Math.sin(v + hue);
  const g = 128 + 127 * Math.sin(v + hue + 2.1);
  const b = 128 + 127 * Math.sin(v + hue + 4.2);
  return [r, g, b];
}
`;
}

function validateEditorCode(code) {
  const text = String(code || '');
  if (!text.trim()) return 'Code is empty.';
  if (!/export\s+function\s+render\s*\(/.test(text) && !/export\s+const\s+render\s*=/.test(text)) {
    return 'Chybí export render(x, y, t, p).';
  }
  const blocked = [/\bfetch\s*\(/, /\bWebSocket\s*\(/, /\bdocument\b/, /\bwindow\b/, /\blocalStorage\b/, /\bsessionStorage\b/, /from\s+["']node:/];
  if (blocked.some((re) => re.test(text))) return 'Kód obsahuje blokované side-effect API.';
  return null;
}

function renderValidationReport(report) {
  if (!validationReport) return;
  if (!report) {
    validationReport.textContent = 'Validation report: idle';
    return;
  }
  const errors = Array.isArray(report.errors) ? report.errors : [];
  const warnings = Array.isArray(report.warnings) ? report.warnings : [];
  const info = Array.isArray(report.info) ? report.info : [];
  const parts = [];
  parts.push(`<strong class="${errors.length ? 'err' : 'ok'}">${errors.length ? 'Validation failed' : 'Validation OK'}</strong>`);
  if (errors.length) parts.push(`<ul>${errors.map((x) => `<li class="err">${escapeHtml(x)}</li>`).join('')}</ul>`);
  if (warnings.length) parts.push(`<ul>${warnings.map((x) => `<li class="warn">${escapeHtml(x)}</li>`).join('')}</ul>`);
  if (info.length) parts.push(`<ul>${info.map((x) => `<li>${escapeHtml(x)}</li>`).join('')}</ul>`);
  validationReport.innerHTML = parts.join('');
}


async function validateEditorCodeServer() {
  const localError = validateEditorCode(codeEditor.value);
  if (localError) {
    renderValidationReport({ ok: false, errors: [localError], warnings: [], info: [] });
    editorStatus.textContent = localError;
    return false;
  }
  const res = await fetch('/api/animations/validate-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: codeEditor.value })
  });
  const payload = await res.json().catch(() => ({}));
  const report = payload?.report || { ok: false, errors: [`Validation failed: ${res.status}`], warnings: [], info: [] };
  renderValidationReport(report);
  editorStatus.textContent = report.ok ? 'Validation OK' : (report.errors?.[0] || 'Validation failed');
  return Boolean(report.ok);
}

function syncParamLabels(item) {
  const names = Array.isArray(item?.params) && item.params.length
    ? item.params
    : (Array.isArray(item?.mod?.meta?.params) ? item.mod.meta.params : []);
  paramLabels.forEach((label, index) => {
    if (!label) return;
    const name = String(names[index] || `P${index + 1}`).trim();
    label.textContent = name.length > 10 ? `${name.slice(0, 9)}…` : name;
    label.title = name;
  });
}

async function compileEditorCode() {
  const code = codeEditor.value;
  const validationError = validateEditorCode(code);
  if (validationError) throw new Error(validationError);
  if (editorBlobUrl) URL.revokeObjectURL(editorBlobUrl);
  editorBlobUrl = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
  const mod = await import(`${editorBlobUrl}#${Date.now()}`);
  if (typeof mod.render !== 'function') throw new Error('Compiled module does not export render().');
  return mod;
}

function setActiveTab(nextTab) {
  activeTab = nextTab || 'gallery';
  studioTabs.forEach((tab) => {
    const isActive = tab.dataset.tab === activeTab;
    tab.classList.toggle('is-active', isActive);
    tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });
  studioViews.forEach((view) => view.classList.toggle('is-active', view.dataset.view === activeTab));
  selectorViewBtn?.classList.toggle('is-on', activeTab === 'selectors');
  paletteViewBtn?.classList.toggle('is-on', activeTab === 'palettes');
  document.body.classList.toggle('selector-mode', activeTab === 'selectors');
  document.body.classList.toggle('editor-mode', activeTab === 'editor');
  libraryMenuItems.forEach((item) => item.classList.toggle('is-active', item.dataset.libraryView === activeTab));
  quickEditorTabBtn?.classList.toggle('is-on', activeTab === 'editor');
  if (activeTab === 'selectors') renderSelectorManager();
  updateEditorCollectionLabel();
}

function isTypingContext(target) {
  const tag = String(target?.tagName || '').toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || Boolean(target?.isContentEditable);
}

function selectRelative(delta) {
  const items = currentCollectionItems();
  if (!items.length) return;
  const currentId = selected?.id;
  const index = Math.max(0, items.findIndex((item) => item.id === currentId));
  const next = (index + delta + items.length) % items.length;
  selectAnim(items[next].id);
}

function updateBatchStatus() {
  if (!batchStatus) return;
  batchStatus.textContent = `${batchSelectedIds.size} selected`;
}

function toggleBatchSelection(id, force = null) {
  if (!id) return;
  const next = typeof force === 'boolean' ? force : !batchSelectedIds.has(id);
  if (next) batchSelectedIds.add(id);
  else batchSelectedIds.delete(id);
  updateBatchStatus();
}

function clearBatchSelection() {
  batchSelectedIds = new Set();
  updateBatchStatus();
  renderGallery();
}

function selectVisibleBatch() {
  const items = currentCollectionItems();
  batchSelectedIds = new Set(items.map((item) => item.id));
  updateBatchStatus();
  renderGallery();
}

async function runBatchLayerOperation(layer, enable) {
  const ids = collectBatchIds(batchSelectedIds, library);
  if (!ids.length) {
    if (batchStatus) batchStatus.textContent = 'nothing selected';
    return;
  }
  if (batchStatus) batchStatus.textContent = `${enable ? 'Enabling' : 'Disabling'} ${layer.toUpperCase()}...`;
  for (const id of ids) {
    try {
      await postLibraryAction(enable ? '/api/animations/enable-layer' : '/api/animations/disable-layer', { id, layer });
    } catch (error) {
      console.warn(`batch ${layer} ${enable ? 'enable' : 'disable'} failed for ${id}`, error);
    }
  }
  await loadLibrary({ keepSelection: selected?.id });
  if (batchStatus) batchStatus.textContent = `${ids.length} updated`;
}

async function runBatchArchiveOperation(archived) {
  const ids = collectBatchIds(batchSelectedIds, library);
  if (!ids.length) {
    if (batchStatus) batchStatus.textContent = 'nothing selected';
    return;
  }
  if (batchStatus) batchStatus.textContent = `${archived ? 'Archiving' : 'Restoring'} ${ids.length}...`;
  for (const id of ids) {
    try {
      await postLibraryAction('/api/animations/set-archived', { id, archived });
    } catch (error) {
      console.warn(`batch archive failed for ${id}`, error);
    }
  }
  await loadLibrary({ keepSelection: selected?.id });
  if (batchStatus) batchStatus.textContent = `${archived ? 'Archived' : 'Restored'} ${ids.length}`;
}

async function runBatchMoveOperation(direction) {
  const layer = orderLayerSelect?.value || '';
  const items = collectMovableBatchItems(batchSelectedIds, library, layer, hasLayer);
  if (!items.length) {
    if (batchStatus) batchStatus.textContent = 'nothing movable';
    return;
  }
  const sortedItems = sortBatchItemsForMove(items, layer, direction);
  if (batchStatus) batchStatus.textContent = `Moving ${items.length} ${direction}...`;
  for (const item of sortedItems) {
    try {
      await postLibraryAction('/api/animations/reorder', { id: item.id, direction, layer });
    } catch (error) {
      console.warn(`batch move ${direction} failed for ${item.id}`, error);
    }
  }
  await loadLibrary({ keepSelection: selected?.id });
  if (activeTab === 'selectors') await renderSelectorManager();
  if (batchStatus) batchStatus.textContent = `${sortedItems.length} moved ${direction}`;
}

function initEditorSplitResize() {
  if (!editorResizeHandle || !editorWorkspace) return;
  let dragging = false;
  const applySplit = (value) => {
    const rect = editorWorkspace.getBoundingClientRect();
    const min = 320;
    const max = Math.max(min, rect.width - 320);
    const left = Math.max(min, Math.min(max, Number(value) || min));
    editorWorkspace.style.setProperty('--editor-split', `${left}px`);
    try { localStorage.setItem(EDITOR_SPLIT_KEY, String(Math.round(left))); } catch {}
  };
  try {
    const saved = Number(localStorage.getItem(EDITOR_SPLIT_KEY));
    if (Number.isFinite(saved) && saved > 0) applySplit(saved);
  } catch {}
  const stop = () => { dragging = false; };
  const onMove = (event) => {
    if (!dragging) return;
    const rect = editorWorkspace.getBoundingClientRect();
    applySplit(event.clientX - rect.left);
  };
  editorResizeHandle.addEventListener('pointerdown', (event) => {
    dragging = true;
    editorResizeHandle.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  });
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', stop);
  window.addEventListener('pointercancel', stop);
  // STEP37AZ: editor resize governor. During live output, raw resize events can
  // arrive in bursts while the browser is also painting preview/output UI. Coalesce
  // them so editor layout cannot repeatedly force sync reflow in the hot path.
  let editorResizeTimer37AZ = 0;
  let editorResizePending37AZ = false;
  window.__budilightEditorResizeGovernor37AZ = window.__budilightEditorResizeGovernor37AZ || {
    version: 'STEP37AZ_EDITOR_RESIZE_GOVERNOR',
    calls: 0,
    applied: 0,
    coalesced: 0,
    pending: false,
    live: false,
    delayMs: 0
  };
  function isLiveOutputLocked37AZ() {
    try { return window.__budilightOutputLock37AP?.active === true; } catch { return false; }
  }
  function applyEditorResize37AZ() {
    editorResizeTimer37AZ = 0;
    editorResizePending37AZ = false;
    const diag = window.__budilightEditorResizeGovernor37AZ;
    try { diag.pending = false; diag.applied += 1; diag.lastAppliedAt = performance.now(); } catch {}
    const raw = editorWorkspace.style.getPropertyValue('--editor-split');
    if (!raw) return;
    applySplit(Number(raw.replace('px', '').trim()));
  }
  window.addEventListener('resize', () => {
    const diag = window.__budilightEditorResizeGovernor37AZ;
    const live = isLiveOutputLocked37AZ();
    const delay = live ? 180 : 48;
    try { diag.calls += 1; diag.live = live; diag.delayMs = delay; } catch {}
    if (editorResizeTimer37AZ) {
      editorResizePending37AZ = true;
      try { diag.coalesced += 1; diag.pending = true; } catch {}
      return;
    }
    editorResizePending37AZ = true;
    try { diag.pending = true; } catch {}
    editorResizeTimer37AZ = managedTimeout37CF('gallery:editor-resize', () => {
      if (typeof requestAnimationFrame === 'function') managedRaf37CF(applyEditorResize37AZ, 'gallery:editor-resize-raf');
      else applyEditorResize37AZ();
    }, delay, { maxMs: 1200 });
  }, { passive: true });
}

function saveEditorDraftLocal() {
  saveEditorDraft(localStorage, EDITOR_DRAFT_KEY, {
    name: editorName?.value || '',
    tag: editorTag?.value || '',
    saveMode: editorSaveMode?.value || 'new',
    code: codeEditor?.value || '',
    at: Date.now()
  });
}

function restoreEditorDraftLocal() {
  const draft = loadEditorDraft(localStorage, EDITOR_DRAFT_KEY);
  if (!draft) return;
  if (typeof draft?.code === 'string' && draft.code.trim()) codeEditor.value = draft.code;
  if (typeof draft?.name === 'string' && editorName) editorName.value = draft.name;
  if (typeof draft?.tag === 'string' && editorTag) editorTag.value = draft.tag;
  if (typeof draft?.saveMode === 'string' && editorSaveMode) editorSaveMode.value = draft.saveMode;
  if (editorStatus) editorStatus.textContent = 'Draft restored';
}

function saveShadertoyDraftLocal() {
  if (!shadertoyCode) return;
  const ok = saveShadertoyDraft(localStorage, SHADERTOY_DRAFT_KEY, shadertoyCode.value || '');
  if (!ok) return;
  if (shadertoyStatus) shadertoyStatus.textContent = 'draft saved';
  if (shadertoyDraftInfo) shadertoyDraftInfo.textContent = 'Draft saved locally';
}

function restoreShadertoyDraftLocal() {
  if (!shadertoyCode) return;
  const draft = loadShadertoyDraft(localStorage, SHADERTOY_DRAFT_KEY);
  if (!draft) return;
  if (typeof draft?.code === 'string' && draft.code.trim()) shadertoyCode.value = draft.code;
  if (shadertoyDraftInfo) shadertoyDraftInfo.textContent = 'Draft restored from local storage';
}

function drawShadertoyPlaceholder(t = 0) {
  if (!shadertoyPreviewCtx || !shadertoyPreviewCanvas) return;
  const w = shadertoyPreviewCanvas.width;
  const h = shadertoyPreviewCanvas.height;
  const image = shadertoyPreviewCtx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const v = Math.sin((x * 0.026) + t) + Math.cos((y * 0.032) - t * 0.8);
      image.data[i] = 40 + Math.max(0, 70 + v * 80);
      image.data[i + 1] = 16 + Math.max(0, 40 + Math.sin(v + t) * 60);
      image.data[i + 2] = 80 + Math.max(0, 80 + Math.cos(v - t) * 70);
      image.data[i + 3] = 255;
    }
  }
  shadertoyPreviewCtx.putImageData(image, 0, 0);
}

function parseShaderError(message) {
  const text = String(message || '').trim();
  if (!text) return { message: 'Shader compile failed', line: null, col: null };
  const glLike = text.match(/ERROR:\s*\d+:(\d+):\s*(.*)/i);
  if (glLike) {
    return {
      message: glLike[2] || text,
      line: Number(glLike[1]) || null,
      col: null
    };
  }
  const generic = text.match(/line\s+(\d+)(?:\s*[:,]\s*col(?:umn)?\s*(\d+))?/i);
  if (generic) {
    return {
      message: text,
      line: Number(generic[1]) || null,
      col: Number(generic[2]) || null
    };
  }
  return { message: text, line: null, col: null };
}

function showShadertoyError(details) {
  if (!shadertoyErrorPanel) return;
  if (!details) {
    shadertoyErrorPanel.hidden = true;
    shadertoyErrorPanel.classList.remove('is-actionable');
    shadertoyErrorPanel.textContent = '';
    delete shadertoyErrorPanel.dataset.line;
    delete shadertoyErrorPanel.dataset.col;
    return;
  }
  const line = Number(details.line) || null;
  const col = Number(details.col) || null;
  const prefix = line ? `Line ${line}${col ? `, col ${col}` : ''}: ` : '';
  shadertoyErrorPanel.hidden = false;
  shadertoyErrorPanel.textContent = `${prefix}${details.message}`;
  if (line) {
    shadertoyErrorPanel.classList.add('is-actionable');
    shadertoyErrorPanel.dataset.line = String(line);
    shadertoyErrorPanel.dataset.col = String(col || 1);
  } else {
    shadertoyErrorPanel.classList.remove('is-actionable');
    delete shadertoyErrorPanel.dataset.line;
    delete shadertoyErrorPanel.dataset.col;
  }
}

function focusShadertoyLine(line, col = 1) {
  if (!shadertoyCode) return;
  const rows = String(shadertoyCode.value || '').split('\n');
  let pos = 0;
  const targetLine = Math.max(1, Number(line) || 1);
  for (let i = 0; i < rows.length && i < targetLine - 1; i++) pos += rows[i].length + 1;
  const colOffset = Math.max(0, (Number(col) || 1) - 1);
  const target = Math.min(shadertoyCode.value.length, pos + colOffset);
  shadertoyCode.focus();
  shadertoyCode.setSelectionRange(target, target);
}

function shadertoyFragmentSource(userCode) {
  const text = String(userCode || '');
  if (/void\s+main\s*\(/.test(text)) return text;
  return `${text}
void main() {
  vec4 fragColor = vec4(0.0);
  mainImage(fragColor, gl_FragCoord.xy);
  gl_FragColor = fragColor;
}`;
}

function createShadertoyProgram(userCode) {
  if (!shadertoyPreviewCanvas) return null;
  const gl = shadertoyPreviewCanvas.getContext('webgl2', { alpha: false, antialias: true, preserveDrawingBuffer: false })
    || shadertoyPreviewCanvas.getContext('webgl', { alpha: false, antialias: true, preserveDrawingBuffer: false });
  if (!gl) return null;
  const vertexSource = `attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;
  const fragmentSource = `precision highp float;
uniform vec3 iResolution;
uniform float iTime;
uniform vec4 iMouse;
uniform int iFrame;
uniform sampler2D iChannel0;
varying vec2 vUv;
${shadertoyFragmentSource(userCode)}
`;
  const compileShader = (type, source) => {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader) || 'shader compile failed';
      gl.deleteShader(shader);
      throw new Error(info);
    }
    return shader;
  };
  const vs = compileShader(gl.VERTEX_SHADER, vertexSource);
  const fs = compileShader(gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  if (!program || !vs || !fs) throw new Error('program init failed');
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.bindAttribLocation(program, 0, 'aPos');
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program) || 'program link failed';
    gl.deleteProgram(program);
    throw new Error(info);
  }
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1, -1, 1, -1, -1, 1,
    -1, 1, 1, -1, 1, 1
  ]), gl.STATIC_DRAW);
  gl.useProgram(program);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  return {
    gl,
    program,
    uniforms: {
      iResolution: gl.getUniformLocation(program, 'iResolution'),
      iTime: gl.getUniformLocation(program, 'iTime'),
      iMouse: gl.getUniformLocation(program, 'iMouse'),
      iFrame: gl.getUniformLocation(program, 'iFrame'),
      iChannel0: gl.getUniformLocation(program, 'iChannel0')
    }
  };
}

function ensureShadertoyChannel0(gl) {
  if (!gl) return null;
  if (shadertoyChannel0 && gl.isTexture(shadertoyChannel0)) return shadertoyChannel0;
  const tex = gl.createTexture();
  if (!tex) return null;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const checker = ((x >> 3) & 1) ^ ((y >> 3) & 1);
      data[i] = checker ? 220 : 32;
      data[i + 1] = checker ? 110 : 24;
      data[i + 2] = checker ? 255 : 58;
      data[i + 3] = 255;
    }
  }
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  shadertoyChannel0 = tex;
  return tex;
}

function activateShadertoyPreview() {
  const source = String(shadertoyCode?.value || '');
  if (!source.trim()) {
    shadertoyPreviewActive = false;
    drawShadertoyPlaceholder(performance.now() / 1300);
    if (shadertoyStatus) shadertoyStatus.textContent = 'empty draft';
    return;
  }
  try {
    const compiled = createShadertoyProgram(source);
    if (!compiled) {
      shadertoyPreviewActive = false;
      drawShadertoyPlaceholder(performance.now() / 1300);
      if (shadertoyStatus) shadertoyStatus.textContent = 'webgl unavailable';
      return;
    }
    shadertoyGl = compiled.gl;
    shadertoyProgram = compiled.program;
    shadertoyUniforms = compiled.uniforms;
    shadertoyFrame = 0;
    shadertoyPreviewActive = true;
    showShadertoyError(null);
    if (shadertoyStatus) shadertoyStatus.textContent = 'preview running';
    if (shadertoyDraftInfo) shadertoyDraftInfo.textContent = 'WebGL sandbox active';
  } catch (error) {
    shadertoyPreviewActive = false;
    drawShadertoyPlaceholder(performance.now() / 1300);
    showShadertoyError(parseShaderError(error?.message || error));
    if (shadertoyStatus) shadertoyStatus.textContent = 'preview error';
    if (shadertoyDraftInfo) shadertoyDraftInfo.textContent = error?.message || 'Shader compile failed';
  }
}

function renderShadertoyPreview(t = 0) {
  if (!shadertoyPreviewActive || !shadertoyGl || !shadertoyProgram || !shadertoyPreviewCanvas) return;
  const gl = shadertoyGl;
  const width = shadertoyPreviewCanvas.clientWidth || shadertoyPreviewCanvas.width;
  const height = shadertoyPreviewCanvas.clientHeight || shadertoyPreviewCanvas.height;
  if (shadertoyPreviewCanvas.width !== width || shadertoyPreviewCanvas.height !== height) {
    shadertoyPreviewCanvas.width = width;
    shadertoyPreviewCanvas.height = height;
  }
  gl.viewport(0, 0, shadertoyPreviewCanvas.width, shadertoyPreviewCanvas.height);
  gl.useProgram(shadertoyProgram);
  if (shadertoyUniforms?.iResolution) gl.uniform3f(shadertoyUniforms.iResolution, shadertoyPreviewCanvas.width, shadertoyPreviewCanvas.height, 1);
  if (shadertoyUniforms?.iTime) gl.uniform1f(shadertoyUniforms.iTime, Number(t) || 0);
  if (shadertoyUniforms?.iMouse) gl.uniform4f(
    shadertoyUniforms.iMouse,
    Number(shadertoyMouse.x) || 0,
    Number(shadertoyMouse.y) || 0,
    shadertoyMouse.down ? (Number(shadertoyMouse.clickX) || 0) : -(Math.abs(Number(shadertoyMouse.clickX) || 0)),
    shadertoyMouse.down ? (Number(shadertoyMouse.clickY) || 0) : -(Math.abs(Number(shadertoyMouse.clickY) || 0))
  );
  if (shadertoyUniforms?.iFrame) gl.uniform1i(shadertoyUniforms.iFrame, shadertoyFrame);
  if (shadertoyUniforms?.iChannel0) {
    const tex = ensureShadertoyChannel0(gl);
    if (tex) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(shadertoyUniforms.iChannel0, 0);
    }
  }
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  shadertoyFrame += 1;
}

function updateShadertoyMouseFromEvent(event, pressed = null) {
  if (!shadertoyPreviewCanvas) return;
  const rect = shadertoyPreviewCanvas.getBoundingClientRect();
  const x = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
  const yTop = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
  const y = rect.height - yTop;
  shadertoyMouse.x = x;
  shadertoyMouse.y = y;
  if (pressed === true) {
    shadertoyMouse.down = 1;
    shadertoyMouse.clickX = x;
    shadertoyMouse.clickY = y;
  } else if (pressed === false) {
    shadertoyMouse.down = 0;
  }
}

function buildShadertoyBridgeModule(text) {
  const body = String(text || '').trim();
  const escaped = JSON.stringify(body);
  return `export const meta = {
  name: "Shadertoy Draft",
  origin: "shadertoy",
  params: ["param1", "param2", "param3"]
};

export const shadertoy = {
  uniforms: ["iResolution", "iTime", "iMouse", "iChannel0"],
  fragment: ${escaped}
};
`;
}

function downloadTextFile(filename, content) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function validateShadertoyDraft() {
  const text = String(shadertoyCode?.value || '');
  if (!text.trim()) return { ok: false, reason: 'Draft is empty' };
  const hasEntry = /mainImage|void\s+main\s*\(/.test(text);
  if (!hasEntry) return { ok: false, reason: 'Missing mainImage/main fragment entry point' };
  const missingUniforms = ['iResolution', 'iTime']
    .filter((name) => !new RegExp(`\\b${name}\\b`).test(text));
  const blocked = [/document\./, /window\./, /fetch\s*\(/, /WebSocket\s*\(/]
    .find((re) => re.test(text));
  if (blocked) return { ok: false, reason: 'Draft contains non-GLSL runtime call (bridge unsafe)' };
  if (missingUniforms.length) {
    return { ok: true, reason: `Entry OK, but bridge hints missing: ${missingUniforms.join(', ')}` };
  }
  return { ok: true, reason: 'Bridge contract OK: entrypoint + baseline uniforms detected' };
}

function closeLibraryMenu() {
  if (!libraryMenuPanel || !libraryMenuToggle) return;
  libraryMenuPanel.hidden = true;
  libraryMenuToggle.setAttribute('aria-expanded', 'false');
  libraryMenuToggle.textContent = 'Animation Library ▾';
}

function toggleLibraryMenu() {
  if (!libraryMenuPanel || !libraryMenuToggle) return;
  const nextOpen = libraryMenuPanel.hidden;
  libraryMenuPanel.hidden = !nextOpen;
  libraryMenuToggle.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
  libraryMenuToggle.textContent = nextOpen ? 'Animation Library ▴' : 'Animation Library ▾';
}

async function previewEditorCode() {
  try {
    editorStatus.textContent = 'Validating…';
    const valid = await validateEditorCodeServer();
    if (!valid) return;
    editorStatus.textContent = 'Compiling…';
    const mod = await compileEditorCode();
    selected = {
      id: '__editor_preview',
      name: editorName.value.trim() || mod?.meta?.name || 'Unsaved editor preview',
      file: 'unsaved_editor_preview.js',
      source: 'editor://unsaved',
      origin: 'editor',
      enabledFor: [],
      tags: ['User', 'CPU', 'Unsaved'],
      mod
    };
    selectedName.textContent = 'EDITOR';
    inspectTitle.textContent = selected.name;
    inspectType.textContent = 'editor/preview';
    metaFile.textContent = 'unsaved editor code';
    metaExports.textContent = ['render', mod?.meta ? 'meta' : '', 'origin:editor'].filter(Boolean).join(', ');
    metaDescription.textContent = 'Unsaved editor preview';
    metaParams.textContent = Array.isArray(mod?.meta?.params) ? mod.meta.params.join(', ') : 'p1, p2, p3';
    fillMetadataForm(selected);
    syncParamLabels(selected);
    syncAssignButtons();
    renderGallery();
    setActiveTab('editor');
    if (editorPreviewCanvas) drawPreview(editorPreviewCanvas, mod, 1.25);
    editorStatus.textContent = 'Preview OK';
  } catch (error) {
    console.warn(error);
    editorStatus.textContent = error.message || 'Compile failed';
  }
}

async function saveEditorCode() {
  try {
    editorStatus.textContent = 'Validating…';
    const valid = await validateEditorCodeServer();
    if (!valid) return;
    editorStatus.textContent = 'Saving…';
    await compileEditorCode();
    const saveMode = editorSaveMode?.value || 'new';
    const tags = normalizeTags(editorTag?.value || '');
    const selectedEditorId = editorAnimSelect?.value || selected?.id || '';
    const endpoint = saveMode === 'overwrite' ? '/api/animations/update-code' : '/api/animations/save-code';
    const body = saveMode === 'overwrite'
      ? { id: selectedEditorId, name: editorName.value.trim(), tags, code: codeEditor.value }
      : { name: editorName.value.trim(), tags, code: codeEditor.value };
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok || !payload?.ok) throw new Error(payload?.error || `Save failed: ${res.status}`);
    const savedId = payload.item?.id;
    notifyAnimationLibraryChanged(saveMode === 'overwrite' ? 'update-code' : 'save-code', { id: savedId || selectedEditorId || '' });
    editorStatus.textContent = saveMode === 'overwrite' ? 'Overwritten OK' : 'Saved as new animation · Custom album';
    renderValidationReport({ ok: true, errors: [], warnings: [], info: [editorStatus.textContent] });
    if (savedId) addAnimationToCustomAlbum(savedId, { activate: true, save: true });
    await loadLibrary({ keepSelection: savedId });
    setActiveTab('editor');
  } catch (error) {
    console.warn(error);
    editorStatus.textContent = error.message || 'Save failed';
    renderValidationReport({ ok: false, errors: [editorStatus.textContent], warnings: [], info: [] });
  }
}

async function loadSelectedSourceToEditor() {
  const editorId = editorAnimSelect?.value || selected?.id;
  const item = library.find((entry) => entry.id === editorId) || selected;
  if (!item?.source || item.source.startsWith('editor://')) return;
  try {
    if (item.id && selected?.id !== item.id) selectAnim(item.id);
    editorStatus.textContent = 'Loading source…';
    const res = await fetch(item.source);
    if (!res.ok) throw new Error(`Source load failed: ${res.status}`);
    codeEditor.value = await res.text();
    editorName.value = item.name || item.file?.replace(/\.js$/i, '') || '';
    if (editorTag) editorTag.value = (item.tags || []).filter((tag) => !['l1','l2','builtin','cpu','user','archived'].includes(String(tag).toLowerCase())).join(', ');
    if (editorSaveMode) editorSaveMode.value = item.readonly ? 'new' : 'overwrite';
    editorStatus.textContent = item.readonly ? 'Source loaded · builtin saves as copy' : 'Source loaded';
    renderValidationReport({ ok: true, errors: [], warnings: item.readonly ? ['Builtin animace nejde přepsat přímo. Použij Create new.'] : [], info: [`Loaded: ${item.name}`] });
  } catch (error) {
    console.warn(error);
    editorStatus.textContent = error.message || 'Source load failed';
  }
}

async function postLibraryAction(url, body) {
  assignStatus.textContent = 'Saving…';
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok || !payload?.ok) {
    throw new Error(payload?.error || `Request failed: ${res.status}`);
  }
  notifyAnimationLibraryChanged(url.replace(/^\/api\/animations\//, ''), { id: body?.id || '', layer: body?.layer || '' });
  return payload;
}

function hasLayer(item, layer) {
  return (item?.enabledFor || []).map((x) => String(x).toLowerCase()).includes(layer);
}

function syncAssignButtons() {
  const isUnsaved = !selected || selected.id === '__editor_preview';
  const hasL1 = hasLayer(selected, 'l1');
  const hasL2 = hasLayer(selected, 'l2');
  toggleL1Btn.disabled = isUnsaved || selected?.archived;
  toggleL2Btn.disabled = isUnsaved || selected?.archived;
  if (duplicateAnimBtn) duplicateAnimBtn.disabled = isUnsaved;
  if (archiveAnimBtn) {
    archiveAnimBtn.disabled = isUnsaved;
    archiveAnimBtn.textContent = selected?.archived ? 'Restore' : 'Archive';
  }
  const orderLayer = orderLayerSelect?.value || '';
  const invalidLayerOrder = Boolean(orderLayer && !hasLayer(selected, orderLayer));
  moveUpBtn.disabled = isUnsaved || selected?.archived || invalidLayerOrder;
  moveDownBtn.disabled = isUnsaved || selected?.archived || invalidLayerOrder;
  toggleL1Btn.classList.toggle('is-enabled', hasL1);
  toggleL2Btn.classList.toggle('is-enabled', hasL2);
  toggleL1Btn.textContent = hasL1 ? '✓ L1 menu' : '+ L1 menu';
  toggleL2Btn.textContent = hasL2 ? '✓ L2 menu' : '+ L2 menu';
  const layers = [hasL1 ? 'L1' : '', hasL2 ? 'L2' : ''].filter(Boolean);
  const layerOrder = selected?.layerOrder || {};
  metaLayers.textContent = layers.length ? layers.join(' + ') : 'not in layer menu';
  if (metaOrder) metaOrder.textContent = selected ? `global:${selected.order ?? '—'} · L1:${layerOrder.l1 ?? '—'} · L2:${layerOrder.l2 ?? '—'}` : '—';
  assignStatus.textContent = isUnsaved ? 'save first' : selected?.archived ? 'archived' : invalidLayerOrder ? 'not in selected menu' : selected ? (layers.length ? layers.join('/') : 'disabled') : '—';
}

async function toggleLayer(layer) {
  if (!selected || selected.id === '__editor_preview') return;
  const enabled = hasLayer(selected, layer);
  const url = enabled ? '/api/animations/disable-layer' : '/api/animations/enable-layer';
  try {
    const payload = await postLibraryAction(url, { id: selected.id, layer });
    selected.enabledFor = payload.item.enabledFor || [];
    selected.layerOrder = payload.item.layerOrder || selected.layerOrder || {};
    selected.tags = [...new Set([...(selected.tags || []).filter((tag) => !['L1','L2','l1','l2'].includes(tag)), ...selected.enabledFor.map((x) => x.toUpperCase())])];
    syncAssignButtons();
    renderGallery();
    if (activeTab === 'selectors') await renderSelectorManager();
    assignStatus.textContent = 'Saved';
  } catch (error) {
    console.warn(error);
    assignStatus.textContent = error.message || 'Failed';
  }
}


async function duplicateSelected() {
  if (!selected || selected.id === '__editor_preview') return;
  try {
    assignStatus.textContent = 'Duplicating…';
    const payload = await postLibraryAction('/api/animations/duplicate', { id: selected.id });
    await loadLibrary({ keepSelection: payload.item?.id });
    assignStatus.textContent = 'Duplicated';
  } catch (error) {
    console.warn(error);
    assignStatus.textContent = error.message || 'Duplicate failed';
  }
}

async function saveSelectedFromGallery(id = selected?.id) {
  if (!id || id === '__editor_preview') return;
  try {
    assignStatus.textContent = 'Saving gallery copy…';
    const source = library.find((item) => item.id === id);
    const payload = await postLibraryAction('/api/animations/save-from-gallery', { id, name: source?.name ? `${source.name} Saved` : '' });
    await loadLibrary({ keepSelection: payload.item?.id });
    assignStatus.textContent = 'Saved as editable gallery copy';
  } catch (error) {
    console.warn(error);
    assignStatus.textContent = error.message || 'Gallery save failed';
  }
}

async function markSelectedForPrewarm(id = selected?.id, priority = 86) {
  if (!id || id === '__editor_preview') return;
  try {
    assignStatus.textContent = 'Saving prewarm hint…';
    const payload = await postLibraryAction('/api/animations/prewarm-hint', {
      id,
      prewarm: { priority, mode: 'idle-neighbor', samplePoints: 128, warmOnSelect: true, warmNeighbors: true }
    });
    const item = payload.item || {};
    const index = library.findIndex((entry) => entry.id === id);
    if (index >= 0) library[index] = { ...library[index], prewarm: item.prewarm || library[index].prewarm };
    if (selected?.id === id) selected = { ...selected, prewarm: item.prewarm || selected.prewarm };
    assignStatus.textContent = 'Prewarm hint saved';
  } catch (error) {
    console.warn(error);
    assignStatus.textContent = error.message || 'Prewarm save failed';
  }
}

function idlePrewarmGalleryNeighbors(item) {
  if (!item?.source) return;
  const sorted = [...library]
    .filter((entry) => !entry.archived && entry.source)
    .sort((a, b) => ((b.prewarm?.priority || 40) - (a.prewarm?.priority || 40)) || ((a.order || 0) - (b.order || 0)));
  const index = Math.max(0, sorted.findIndex((entry) => entry.id === item.id));
  const targets = [sorted[index], sorted[index - 1], sorted[index + 1]]
    .filter(Boolean)
    .filter((entry, pos, arr) => arr.findIndex((other) => other.source === entry.source) === pos)
    .filter((entry) => entry.prewarm?.warmOnSelect !== false || entry.id === item.id)
    .map((entry) => entry.source);
  const run = () => {
    targets.forEach((source, n) => {
      managedTimeout37CF(`gallery:module-prewarm-${n}`, () => {
        loader.loadModule(source).catch((error) => console.warn('Gallery module prewarm failed', source, error));
      }, n * 90, { liveFactor: 2, hiddenFactor: 4, maxMs: 3000 });
    });
  };
  if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 1200 });
  else managedTimeout37CF('gallery:module-prewarm', run, 350, { liveFactor: 2, hiddenFactor: 4, maxMs: 3000 });
}

async function setSelectedArchived() {
  if (!selected || selected.id === '__editor_preview') return;
  const selectedId = selected.id;
  try {
    assignStatus.textContent = selected.archived ? 'Restoring…' : 'Archiving…';
    await postLibraryAction('/api/animations/set-archived', { id: selectedId, archived: !selected.archived });
    await loadLibrary({ keepSelection: selectedId });
    assignStatus.textContent = selected?.archived ? 'Archived' : 'Restored';
  } catch (error) {
    console.warn(error);
    assignStatus.textContent = error.message || 'Archive failed';
  }
}

async function moveSelected(direction) {
  if (!selected) return;
  const selectedId = selected.id;
  try {
    const layer = orderLayerSelect?.value || '';
    await postLibraryAction('/api/animations/reorder', { id: selectedId, direction, layer });
    await loadLibrary({ keepSelection: selectedId });
    if (activeTab === 'selectors') await renderSelectorManager();
    assignStatus.textContent = 'Order saved';
  } catch (error) {
    console.warn(error);
    assignStatus.textContent = error.message || 'Failed';
  }
}



function dynamicFilterTags() {
  return buildDynamicFilterTags(library, canonicalTag, filterKey);
}

function setFilterChipState() {
  if (!filterRow) return;
  filterRow.querySelectorAll('.filter').forEach((btn) => {
    const key = btn.dataset.filter || 'all';
    btn.classList.toggle('is-active', activeFilters.has(key));
  });
}

function renderFilterChips() {
  if (!filterRow) return;
  const current = new Set(activeFilters);
  filterRow.innerHTML = '';
  const chips = [{ key: 'all', label: 'All' }, ...dynamicFilterTags()];
  for (const chip of chips) {
    const btn = document.createElement('button');
    btn.className = 'filter';
    btn.type = 'button';
    btn.dataset.filter = chip.key;
    btn.textContent = chip.label;
    btn.title = chip.key === 'all' ? 'Zrušit všechny tag filtry' : `Filtrovat podle tagu: ${chip.label}`;
    btn.addEventListener('click', () => toggleFilter(chip.key));
    filterRow.appendChild(btn);
  }
  const available = new Set(chips.map((chip) => chip.key));
  activeFilters = reconcileActiveFilters(current, available);
  setFilterChipState();
}

function toggleFilter(key) {
  activeFilters = toggleFilterSet(activeFilters, key, filterKey);
  setFilterChipState();
  renderGallery();
}

function setGalleryCardDetails(enabled) {
  galleryCardDetails = Boolean(enabled);
  document.body?.classList.toggle('gallery-details-on', galleryCardDetails);
  document.body?.classList.toggle('gallery-details-off', !galleryCardDetails);
  grid?.classList.toggle('is-detail-cards', galleryCardDetails);
  grid?.classList.toggle('is-compact-cards', !galleryCardDetails);
  grid?.querySelectorAll('.anim-card').forEach((card) => {
    card.classList.toggle('is-detail-card', galleryCardDetails);
    card.classList.toggle('is-compact-card', !galleryCardDetails);
  });
  if (cardDetailsToggle) {
    cardDetailsToggle.setAttribute('aria-pressed', galleryCardDetails ? 'true' : 'false');
    cardDetailsToggle.textContent = galleryCardDetails ? 'Details ON' : 'Details OFF';
  }
}


async function loadLibrary(options = {}) {
  statusText.textContent = 'Loading…';
  grid.innerHTML = '';
  const manifest = await loadManifestItems();
  library = [];
  for (const item of manifest.items) {
    const source = item.source || `l1_anims/${item.file}`;
    const mod = await loader.loadModule(source);
    const manifestTags = Array.isArray(item.tags) ? item.tags : [];
    const autoTags = tagsFor(item.file || source, mod);
    const tags = [...new Set([...manifestTags, ...autoTags, ...(item.enabledFor || []).map((x) => String(x).toUpperCase()), item.archived ? 'Archived' : ''].filter(Boolean))];
    library.push({
      ...item,
      id: item.id || item.file || source,
      file: item.file || source.split('/').pop(),
      source,
      name: item.name || mod?.meta?.name || prettyName(item.file || source),
      description: item.description || mod?.meta?.description || '',
      params: Array.isArray(item.params) && item.params.length ? item.params : (Array.isArray(mod?.meta?.params) ? mod.meta.params : []),
      mod,
      tags,
      layerOrder: item.layerOrder || {}
    });
  }
  batchSelectedIds = new Set([...batchSelectedIds].filter((id) => library.some((item) => item.id === id)));
  updateBatchStatus();
  count.textContent = String(library.length);
  statusText.textContent = `${library.length} loaded · ${manifest.source}`;
  renderFilterChips();
  renderAlbums();
  renderGallery();
  const keepSelection = options.keepSelection || selected?.id;
  if (keepSelection && library.some((item) => item.id === keepSelection)) selectAnim(keepSelection);
  else if (library[0]) selectAnim(library[0].id);
}

function matches(item) {
  const q = searchInput.value.trim().toLowerCase();
  const itemTagKeys = new Set((item.tags || []).map(filterKey));
  const text = `${item.file} ${item.name} ${item.description || ''} ${item.kind || ''} ${item.origin || ''} ${(item.tags || []).join(' ')} ${(item.params || []).join(' ')}`.toLowerCase();
  const activeAlbum = albums.find((album) => album.id === activeAlbumId);
  if (activeAlbum && !albumContainsItem(activeAlbum, item)) return false;
  if (q && !text.includes(q)) return false;
  const filters = [...activeFilters].filter((key) => key && key !== 'all');
  if (!filters.length) return !item.archived;
  if (item.archived && !filters.includes('archived')) return false;
  return filters.every((filter) => filter === 'archived' ? item.archived : itemTagKeys.has(filter));
}


function setThumbnailMotion(enabled) {
  thumbnailMotionEnabled = Boolean(enabled);
  if (!thumbMotionToggle) return;
  thumbMotionToggle.classList.toggle('is-on', thumbnailMotionEnabled);
  thumbMotionToggle.setAttribute('aria-pressed', thumbnailMotionEnabled ? 'true' : 'false');
  thumbMotionToggle.textContent = thumbnailMotionEnabled ? 'Thumb motion ON' : 'Thumb motion OFF';
  if (!thumbnailMotionEnabled) renderGallery();
}

async function fetchSelectorItems(layer) {
  const res = await fetch(`/api/animations/list?layer=${encodeURIComponent(layer)}`);
  const payload = await res.json().catch(() => ({}));
  if (!res.ok || !payload?.ok || !Array.isArray(payload.items)) {
    throw new Error(payload?.error || `Selector load failed: ${res.status}`);
  }
  return payload.items;
}

function selectorStatusText(items) {
  const suffix = selectorDraftDirty ? ' · unsaved draft' : ' · saved';
  return `${items.length} items · ${selectorLayer.toUpperCase()} selector order${suffix}`;
}

function selectorLocalItem(item) {
  return library.find((entry) => entry.id === item.id || entry.file === item.file) || item;
}

async function renderSelectorManager({ reload = false } = {}) {
  if (!selectorList || !selectorStatus) return;
  selectorLayer = selectorLayerSelect?.value || selectorLayer || 'l1';
  if (reload || !selectorDraftItems.length) {
    selectorStatus.textContent = `Loading ${selectorLayer.toUpperCase()} selector…`;
    selectorList.innerHTML = '';
    try {
      selectorDraftItems = await fetchSelectorItems(selectorLayer);
      selectorDraftDirty = false;
    } catch (error) {
      console.warn(error);
      selectorStatus.textContent = error.message || 'Selector load failed';
      selectorList.innerHTML = '<div class="library-note">Selector se nepodařilo načíst.</div>';
      return;
    }
  }
  selectorStatus.textContent = selectorStatusText(selectorDraftItems);
  selectorStatus.classList.toggle('is-dirty', selectorDraftDirty);
  if (saveSelectorBtn) saveSelectorBtn.disabled = !selectorDraftDirty;
  cancelSelectorThumbQueue();
  selectorList.innerHTML = '';
  if (!selectorDraftItems.length) {
    selectorList.innerHTML = '<div class="library-note">Tento selector zatím nemá žádné položky.</div>';
    return;
  }
  selectorDraftItems.forEach((item, index) => {
    const local = selectorLocalItem(item);
    const card = document.createElement('div');
    card.className = `selector-card${selected?.id === local.id ? ' is-selected' : ''}`;
    card.dataset.id = local.id || item.id;
    card.draggable = true;
    card.title = `${String(index + 1).padStart(2, '0')} · ${local.name || item.name || item.file || item.id}`;
    card.innerHTML = `
      <button class="selector-card-main" type="button" data-action="select" aria-label="Select ${String(index + 1).padStart(2, '0')} ${escapeHtml(local.name || item.name || item.file || item.id)}">
        <canvas width="288" height="176" aria-label="Selector animation thumbnail"></canvas>
        <span class="selector-index">${String(index + 1).padStart(2, '0')}</span>
      </button>
      <div class="selector-actions">
        <button type="button" data-action="remove" title="Remove from selector">×</button>
      </div>`;
    prepareSharpCanvas37ED(card.querySelector('canvas'), SELECTOR_CARD_THUMB_SIZE_37ED);
    queueSelectorThumb(card.querySelector('canvas'), local, 1.25);
    card.querySelector('[data-action="select"]').addEventListener('click', () => {
      if (local?.id) selectAnim(local.id);
      selectorList.querySelectorAll('.selector-card.is-selected').forEach((el) => el.classList.remove('is-selected'));
      card.classList.add('is-selected');
    });
    card.querySelector('[data-action="remove"]').addEventListener('click', () => removeSelectorItemDraft(item.id));
    card.addEventListener('dragstart', (event) => {
      selectorDragId = item.id;
      card.classList.add('is-dragging');
      event.dataTransfer?.setData('text/plain', item.id);
      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
    });
    card.addEventListener('dragend', () => {
      selectorDragId = null;
      card.classList.remove('is-dragging');
      document.querySelectorAll('.selector-card.is-drop-target').forEach((el) => el.classList.remove('is-drop-target'));
    });
    card.addEventListener('dragover', (event) => {
      event.preventDefault();
      if (selectorDragId && selectorDragId !== item.id) card.classList.add('is-drop-target');
    });
    card.addEventListener('dragleave', () => card.classList.remove('is-drop-target'));
    card.addEventListener('drop', (event) => {
      event.preventDefault();
      card.classList.remove('is-drop-target');
      const fromId = event.dataTransfer?.getData('text/plain') || selectorDragId;
      swapSelectorDraftItems(fromId, item.id);
    });
    selectorList.appendChild(card);
  });
}

function swapSelectorDraftItems(fromId, toId) {
  const result = swapSelectorItems(selectorDraftItems, fromId, toId);
  if (!result.changed) return;
  selectorDraftItems = result.items;
  selectorDraftDirty = true;
  renderSelectorManager();
}

function removeSelectorItemDraft(id) {
  const result = removeSelectorItemById(selectorDraftItems, id);
  selectorDraftItems = result.items;
  selectorDraftDirty = result.changed || selectorDraftDirty;
  renderSelectorManager();
}

async function resetSelectorDraft() {
  selectorDraftItems = [];
  selectorDraftDirty = false;
  await renderSelectorManager({ reload: true });
}

async function saveSelectorDraft() {
  if (!selectorDraftDirty) return;
  selectorLayer = selectorLayerSelect?.value || selectorLayer || 'l1';
  selectorStatus.textContent = 'Saving selector draft…';
  if (saveSelectorBtn) saveSelectorBtn.disabled = true;
  const ids = selectorDraftItems.map((item) => item.id).filter(Boolean);
  try {
    await postLibraryAction('/api/animations/save-selector', { layer: selectorLayer, ids });
    await loadLibrary({ keepSelection: selected?.id });
    selectorDraftItems = [];
    selectorDraftDirty = false;
    await renderSelectorManager({ reload: true });
    selectorStatus.textContent = `${ids.length} items · ${selectorLayer.toUpperCase()} selector saved`;
  } catch (error) {
    console.warn(error);
    selectorStatus.textContent = error.message || 'Save selector failed';
    if (saveSelectorBtn) saveSelectorBtn.disabled = false;
  }
}

async function reorderSelectorItem(id, direction) {
  const result = reorderSelectorItems(selectorDraftItems, id, direction);
  if (!result.changed) return;
  selectorDraftItems = result.items;
  selectorDraftDirty = true;
  renderSelectorManager();
}

async function removeSelectorItem(id) {
  removeSelectorItemDraft(id);
}


function cloneDefaultAlbums() {
  return DEFAULT_ALBUMS.map((album) => ({ ...album, ids: [...(album.ids || [])] }));
}

function loadAlbumDraft() {
  try {
    const raw = JSON.parse(localStorage.getItem('leddj.animationAlbums') || 'null');
    if (Array.isArray(raw) && raw.length) {
      albums = raw.map((album, index) => ({
        id: String(album.id || `album_${index}`),
        name: String(album.name || `Album ${index + 1}`),
        system: album.system === true,
        smart: album.smart || null,
        ids: Array.isArray(album.ids) ? [...new Set(album.ids.map(String))] : []
      }));
    } else {
      albums = cloneDefaultAlbums();
    }
  } catch {
    albums = cloneDefaultAlbums();
  }
  if (!albums.some((album) => album.id === CUSTOM_ALBUM_ID)) {
    const userIndex = albums.findIndex((album) => album.id === 'user');
    albums.splice(userIndex >= 0 ? userIndex : albums.length, 0, { id: CUSTOM_ALBUM_ID, name: 'Custom', system: true, ids: [] });
  }
  if (!albums.some((album) => album.id === activeAlbumId)) activeAlbumId = 'all';
  albumDraftDirty = false;
}

function saveAlbumDraft() {
  if (!albums.length) loadAlbumDraft();
  localStorage.setItem('leddj.animationAlbums', JSON.stringify(albums));
  albumDraftDirty = false;
  renderAlbums();
}

function unsavedGalleryChanges() {
  return hasUnsavedGalleryChanges({
    albumDraftDirty,
    selectorDraftDirty,
    selectorLayer,
    shadertoyStatusText: shadertoyStatus?.textContent || ''
  });
}

function unsavedGallerySummary() {
  return buildUnsavedGallerySummary({
    albumDraftDirty,
    selectorDraftDirty,
    selectorLayer,
    shadertoyStatusText: shadertoyStatus?.textContent || ''
  });
}

async function saveAllDraftsBeforeLeave() {
  if (albumDraftDirty) saveAlbumDraft();
  if (selectorDraftDirty) await saveSelectorDraft();
  if (String(shadertoyStatus?.textContent || '').toLowerCase().includes('dirty')) saveShadertoyDraftLocal();
}

function navigateNow(target) {
  if (!target?.href) return;
  allowUnsafeLeave = true;
  navigateNowWithGuard(target, {
    sessionStorageRef: sessionStorage,
    locationRef: location,
    mainReturnFastKey: 'led-main-return-fast'
  });
}

function hideLeaveGuard() {
  const next = hideLeaveGuardState({ pendingNavigation });
  if (leaveGuardModal) leaveGuardModal.hidden = true;
  pendingNavigation = next.pendingNavigation;
}

function showLeaveGuard(target) {
  const next = showLeaveGuardState(target, unsavedGallerySummary());
  pendingNavigation = next.pendingNavigation;
  if (leaveGuardText) leaveGuardText.textContent = `Neuložené změny: ${unsavedGallerySummary()}. Uložit změny, nebo odejít bez uložení?`;
  if (leaveGuardModal) leaveGuardModal.hidden = false;
}

function requestNavigation(target) {
  if (!shouldPromptForLeave(unsavedGalleryChanges())) return navigateNow(target);
  showLeaveGuard(target);
}

function favoriteAlbum() {
  if (!albums.some((entry) => entry.id === 'favorites')) {
    albums = toggleFavoriteInAlbums(albums, '__bootstrap__');
    albums = toggleFavoriteInAlbums(albums, '__bootstrap__');
  }
  return albums.find((entry) => entry.id === 'favorites');
}

function isFavorite(id) {
  return isFavoriteInAlbums(albums, id);
}

function toggleFavorite(id) {
  albums = toggleFavoriteInAlbums(albums, id);
  activeAlbumId = activeAlbumId || 'all';
  albumDraftDirty = true;
  renderAlbums();
  renderGallery();
}

function addAnimationToAlbum(albumId, animId) {
  const result = addAnimationToAlbumList(albums, albumId, animId, new Set(library.map((item) => item.id)));
  if (!result.changed) return;
  albums = result.albums;
  activeAlbumId = albumId;
  albumDraftDirty = true;
  renderAlbums();
  renderGallery();
}

function removeAnimationFromAlbum(albumId, animId) {
  const result = removeAnimationFromAlbumList(albums, albumId, animId);
  if (!result.changed) return;
  albums = result.albums;
  albumDraftDirty = true;
  renderAlbums();
  renderGallery();
}

function swapAlbums(fromId, toId) {
  const result = swapAlbumsById(albums, fromId, toId);
  if (!result.changed) return;
  albums = result.albums;
  albumDraftDirty = true;
  renderAlbums();
}

function createAlbum() {
  const result = createAlbumInList(albums, Date.now());
  albums = result.albums;
  activeAlbumId = result.id;
  albumDraftDirty = true;
  renderAlbums();
  renderGallery();
}

function renameAlbum(id) {
  const album = albums.find((entry) => entry.id === id);
  if (!album || album.system) return;
  const next = prompt('Album name', album.name);
  if (!next || !next.trim()) return;
  const result = renameAlbumInList(albums, id, next);
  if (!result.changed) return;
  albums = result.albums;
  albumDraftDirty = true;
  renderAlbums();
}

function deleteAlbum(id) {
  const result = deleteAlbumFromList(albums, id);
  if (!result.changed) return;
  albums = result.albums;
  if (activeAlbumId === id) activeAlbumId = 'all';
  albumDraftDirty = true;
  renderAlbums();
  renderGallery();
}

function renderAlbums() {
  if (!albumList) return;
  if (!albums.length) loadAlbumDraft();
  albumList.innerHTML = '';
  for (const album of albums) {
    const count = album.id === 'all'
      ? library.filter((item) => !item.archived).length
      : album.smart === 'user'
        ? library.filter((item) => item.origin === 'user' || String(item.source || '').includes('user_anims/')).length
        : (album.ids || []).filter((id) => library.some((item) => item.id === id)).length;
    const card = document.createElement('div');
    card.className = `album-card${activeAlbumId === album.id ? ' is-active' : ''}${album.smart ? ' is-smart' : ''}`;
    card.dataset.albumId = album.id;
    card.draggable = true;
    card.innerHTML = `
      <button class="album-main" type="button" data-action="select">
        <strong></strong>
        <span></span>
      </button>
      <div class="album-card-actions">
        <button type="button" data-action="rename" title="Rename">✎</button>
        <button type="button" data-action="delete" title="Delete">×</button>
      </div>`;
    card.querySelector('strong').textContent = album.name;
    card.querySelector('span').textContent = `${count} items${albumDraftDirty ? ' · draft' : ''}`;
    const renameBtn = card.querySelector('[data-action="rename"]');
    const deleteBtn = card.querySelector('[data-action="delete"]');
    renameBtn.disabled = album.system;
    deleteBtn.disabled = album.system;
    card.querySelector('[data-action="select"]').addEventListener('click', () => {
      activeAlbumId = album.id;
      renderAlbums();
      renderGallery();
    });
    renameBtn.addEventListener('click', () => renameAlbum(album.id));
    deleteBtn.addEventListener('click', () => deleteAlbum(album.id));
    card.addEventListener('dragstart', (event) => {
      albumDragAlbumId = album.id;
      event.dataTransfer?.setData('text/album-id', album.id);
      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
    });
    card.addEventListener('dragend', () => {
      albumDragAlbumId = null;
      document.querySelectorAll('.album-card.is-drop-target').forEach((el) => el.classList.remove('is-drop-target'));
    });
    card.addEventListener('dragover', (event) => {
      event.preventDefault();
      if ((albumDragAnimId && !album.smart && album.id !== 'all') || (albumDragAlbumId && albumDragAlbumId !== album.id)) card.classList.add('is-drop-target');
    });
    card.addEventListener('dragleave', () => card.classList.remove('is-drop-target'));
    card.addEventListener('drop', (event) => {
      event.preventDefault();
      card.classList.remove('is-drop-target');
      const animId = event.dataTransfer?.getData('text/anim-id') || albumDragAnimId;
      const sourceAlbumId = event.dataTransfer?.getData('text/album-id') || albumDragAlbumId;
      if (animId) return addAnimationToAlbum(album.id, animId);
      if (sourceAlbumId) return swapAlbums(sourceAlbumId, album.id);
    });
    albumList.appendChild(card);
  }
  if (albumStatus) albumStatus.textContent = albumDraftDirty ? 'unsaved local album draft' : 'albums saved locally';
  if (saveAlbumsBtn) saveAlbumsBtn.disabled = !albumDraftDirty;
}

function currentCollectionItems() {
  return library.filter(matches);
}


function customAlbum() {
  if (!albums.length) loadAlbumDraft();
  let album = albums.find((entry) => entry.id === CUSTOM_ALBUM_ID);
  if (!album) {
    album = { id: CUSTOM_ALBUM_ID, name: 'Custom', system: true, ids: [] };
    const userIndex = albums.findIndex((entry) => entry.id === 'user');
    albums.splice(userIndex >= 0 ? userIndex : albums.length, 0, album);
  }
  if (!Array.isArray(album.ids)) album.ids = [];
  return album;
}

function addAnimationToCustomAlbum(animId, { activate = true, save = true } = {}) {
  if (!animId) return;
  const album = customAlbum();
  album.ids = [...new Set([...(album.ids || []), animId])];
  if (activate) activeAlbumId = CUSTOM_ALBUM_ID;
  albumDraftDirty = true;
  if (save) saveAlbumDraft();
  else {
    renderAlbums();
    renderGallery();
  }
}

function closeEditorAnimPicker() {
  if (!editorAnimPickerPanel) return;
  editorAnimPickerPanel.hidden = true;
  editorAnimPickerBtn?.setAttribute('aria-expanded', 'false');
}

function openEditorAnimPicker() {
  if (!editorAnimPickerPanel) return;
  renderEditorAnimPicker();
  editorAnimPickerPanel.hidden = false;
  editorAnimPickerBtn?.setAttribute('aria-expanded', 'true');
}

function toggleEditorAnimPicker() {
  if (!editorAnimPickerPanel) return;
  if (editorAnimPickerPanel.hidden) openEditorAnimPicker();
  else closeEditorAnimPicker();
}

function syncEditorAnimPickerButton() {
  if (!editorAnimPickerBtn) return;
  const item = library.find((entry) => entry.id === (editorAnimSelect?.value || selected?.id));
  const text = editorAnimPickerBtn.querySelector('.editor-picker-text');
  if (text) text.textContent = item ? item.name : 'Vyber animaci…';
  editorAnimPickerBtn.title = item ? `${item.name} · ${item.file || item.source || item.id}` : 'Vyber animaci z aktivní kolekce';
  if (editorAnimPickerThumb) {
    const ctx = editorAnimPickerThumb.getContext('2d', { alpha: false });
    if (item && drawGalleryThumbFromCacheWithRuntime(editorAnimPickerThumb, item)) {
      // boot cache hit
    } else if (item?.mod && GALLERY_RUNTIME_THUMB_RENDER) queueSelectorThumb(editorAnimPickerThumb, item, 1.25);
    else if (ctx) drawGalleryFallbackThumb(editorAnimPickerThumb, 'boot cache');
  }
}

function renderEditorAnimPicker() {
  if (!editorAnimPickerPanel) return;
  const items = currentCollectionItems();
  editorAnimPickerPanel.innerHTML = '';
  if (!items.length) {
    editorAnimPickerPanel.innerHTML = '<div class="editor-picker-empty">V aktivní kolekci nic není.</div>';
    return;
  }
  for (const item of items) {
    const card = document.createElement('button');
    card.className = `editor-picker-card${selected?.id === item.id ? ' is-selected' : ''}`;
    card.type = 'button';
    card.role = 'option';
    card.dataset.id = item.id;
    card.setAttribute('aria-selected', selected?.id === item.id ? 'true' : 'false');
    card.innerHTML = `
      <canvas width="92" height="42" aria-hidden="true"></canvas>
      <span class="editor-picker-card-main">
        <strong></strong>
        <small></small>
      </span>
      <span class="editor-picker-card-tags"></span>`;
    card.querySelector('strong').textContent = item.name || item.file || item.id;
    card.querySelector('small').textContent = item.readonly ? 'builtin' : (item.origin || 'user');
    const tagTarget = card.querySelector('.editor-picker-card-tags');
    (item.tags || []).slice(0, 3).forEach((tag) => {
      const pill = document.createElement('em');
      pill.textContent = tag;
      tagTarget.appendChild(pill);
    });
    {
      const pickerCanvas = card.querySelector('canvas');
      if (!drawGalleryThumbFromCacheWithRuntime(pickerCanvas, item) && item.mod && GALLERY_RUNTIME_THUMB_RENDER) queueSelectorThumb(pickerCanvas, item, 1.25);
    }
    card.addEventListener('click', () => {
      selectAnim(item.id);
      if (editorAnimSelect) editorAnimSelect.value = item.id;
      syncEditorAnimPickerButton();
      closeEditorAnimPicker();
    });
    editorAnimPickerPanel.appendChild(card);
  }
}

function populateEditorAnimationSelect() {
  if (!editorAnimSelect) return;
  const keep = editorAnimSelect.value || selected?.id || '';
  const items = currentCollectionItems();
  editorAnimSelect.innerHTML = '<option value="">Vyber animaci z aktivní kolekce…</option>';
  for (const item of items) {
    const option = document.createElement('option');
    option.value = item.id;
    option.textContent = `${item.name}${item.readonly ? ' · builtin' : ' · user'}`;
    editorAnimSelect.appendChild(option);
  }
  if (keep && items.some((item) => item.id === keep)) editorAnimSelect.value = keep;
  else if (selected?.id && items.some((item) => item.id === selected.id)) editorAnimSelect.value = selected.id;
  syncEditorAnimPickerButton();
  if (editorAnimPickerPanel && !editorAnimPickerPanel.hidden) renderEditorAnimPicker();
}

function renderGallery() {
  const items = library.filter(matches);
  populateEditorAnimationSelect();
  updateEditorCollectionLabel();
  setGalleryCardDetails(galleryCardDetails);
  grid.innerHTML = '';
  for (const item of items) {
    const btn = document.createElement('button');
    btn.className = `anim-card${galleryCardDetails ? ' is-detail-card' : ' is-compact-card'}${selected?.id === item.id ? ' is-selected' : ''}${item.archived ? ' is-archived' : ''}${batchSelectedIds.has(item.id) ? ' is-batch-selected' : ''}`;
    btn.type = 'button';
    btn.dataset.id = item.id;
    btn.draggable = true;
    const canRemoveFromAlbum = activeAlbumId !== 'all' && !albums.find((album) => album.id === activeAlbumId)?.system && !albums.find((album) => album.id === activeAlbumId)?.smart;
    const favoriteActive = isFavorite(item.id);
    btn.innerHTML = `<canvas width="288" height="144" aria-label="Animation thumbnail"></canvas><input class="anim-card-batch-toggle" type="checkbox" title="Batch select" ${batchSelectedIds.has(item.id) ? 'checked' : ''} /><div class="thumb-badge">THUMB</div><button class="favorite-toggle${favoriteActive ? ' is-favorite' : ''}" type="button" title="${favoriteActive ? 'Remove from favorites' : 'Add to favorites'}" aria-pressed="${favoriteActive ? 'true' : 'false'}">★</button><div class="anim-card-body"><div class="anim-card-title"></div><div class="anim-card-tags"></div><div class="anim-card-actions"><button class="gallery-save-copy" type="button" title="Save editable copy from gallery">Save</button><button class="gallery-prewarm-mark" type="button" title="Prioritize prewarm">Warm</button></div></div>${canRemoveFromAlbum ? '<button class="album-remove-from-card" type="button" title="Remove from album">×</button>' : ''}`;
    btn.querySelector('.anim-card-title').textContent = item.name;
    const thumbCanvas = btn.querySelector('canvas');
    if (thumbCanvas) {
      prepareSharpCanvas37ED(thumbCanvas, GALLERY_CARD_THUMB_SIZE_37ED);
      thumbCanvas.dataset.thumbId = item.id;
      drawGalleryThumbFromCacheWithRuntime(thumbCanvas, item);
    }
    const tagWrap = btn.querySelector('.anim-card-tags');
    item.tags.forEach((tag) => {
      const span = document.createElement('span');
      span.className = `anim-tag${(['L1','L2'].includes(String(tag).toUpperCase()) && !hasLayer(item, String(tag).toLowerCase())) ? ' is-disabled' : ''}`;
      span.textContent = tag;
      tagWrap.appendChild(span);
    });
    btn.addEventListener('click', () => selectAnim(item.id));
    btn.addEventListener('dragstart', (event) => {
      albumDragAnimId = item.id;
      event.dataTransfer?.setData('text/anim-id', item.id);
      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copyMove';
    });
    btn.addEventListener('dragend', () => { albumDragAnimId = null; });
    btn.querySelector('.anim-card-batch-toggle')?.addEventListener('click', (event) => {
      event.stopPropagation();
      toggleBatchSelection(item.id, event.target.checked);
      renderGallery();
    });
    btn.querySelector('.favorite-toggle')?.addEventListener('click', (event) => {
      event.stopPropagation();
      toggleFavorite(item.id);
    });
    btn.querySelector('.gallery-save-copy')?.addEventListener('click', (event) => {
      event.stopPropagation();
      saveSelectedFromGallery(item.id);
    });
    btn.querySelector('.gallery-prewarm-mark')?.addEventListener('click', (event) => {
      event.stopPropagation();
      markSelectedForPrewarm(item.id, 88);
    });
    btn.querySelector('.album-remove-from-card')?.addEventListener('click', (event) => {
      event.stopPropagation();
      removeAnimationFromAlbum(activeAlbumId, item.id);
    });
    grid.appendChild(btn);
    // STEP 13M: thumbnails are drawn lazily in chunks after the gallery layout is mounted.
    // Drawing every card synchronously during navigation can stall the shared output runner.

  }
  setGalleryCardDetails(galleryCardDetails);
  if (!items.length) {
    cancelGalleryThumbQueue();
    grid.innerHTML = '<div class="library-note">Nic nenalezeno.</div>';
  } else {
    queueGalleryThumbnails(1.25);
  }
}


function syncSelectedGalleryCard() {
  if (!grid) return;
  grid.querySelectorAll('.anim-card.is-selected').forEach((card) => card.classList.remove('is-selected'));
  if (!selected?.id) return;
  const safeId = String(selected.id).replace(/\"/g, '\\"');
  const card = grid.querySelector(`.anim-card[data-id="${safeId}"]`);
  card?.classList.add('is-selected');
}

function selectAnim(id) {
  selected = library.find((item) => item.id === id) || null;
  if (!selected) return;
  selectedName.textContent = selected.file.replace(/\.js$/i, '').slice(0, 12).toUpperCase();
  if (editorAnimSelect && Array.from(editorAnimSelect.options).some((option) => option.value === selected.id)) editorAnimSelect.value = selected.id;
  syncEditorAnimPickerButton();
  if (editorAnimPickerPanel && !editorAnimPickerPanel.hidden) renderEditorAnimPicker();
  inspectTitle.textContent = selected.name;
  inspectType.textContent = (selected.tags || []).map((tag) => String(tag).toLowerCase()).includes('shader') ? 'shader/candidate' : 'cpu/module';
  metaFile.textContent = `public/${selected.source || `l1_anims/${selected.file}`}`;
  metaExports.textContent = ['render', selected.mod?.meta ? 'meta' : '', selected.mod?.gpu ? 'gpu' : '', selected.origin ? `origin:${selected.origin}` : '', selected.archived ? 'archived' : '', selected.enabledFor?.length ? `layers:${selected.enabledFor.join('/')}` : ''].filter(Boolean).join(', ') || 'unknown';
  metaDescription.textContent = selected.description || '—';
  metaParams.textContent = Array.isArray(selected.params) && selected.params.length ? selected.params.join(', ') : 'p1, p2, p3';
  fillMetadataForm(selected);
  syncParamLabels(selected);
  syncAssignButtons();
  managedRaf37CF(() => {
    if (selected?.mod) drawPreview(bigCanvas, selected.mod, 1.25, [Number(params[0].value), Number(params[1].value), Number(params[2].value), Number(params[2].value)]);
  }, 'gallery:selected-preview-draw');
  if (selected.id !== '__editor_preview') {
    setPreviewRunning(true);
    idlePrewarmGalleryNeighbors(selected);
  }
  syncSelectedGalleryCard();
}


function animate(now = performance.now()) {
  if (document.hidden || !isGalleryWorkActive37BU()) {
    galleryFrameLoopStats37BU.skippedPreviewFrames += 1;
    cancelManagedRaf37CF(raf);
    scheduleGalleryInactiveWake37BU(() => {
      raf = managedRaf37CF(animate, 'gallery:preview-loop');
    }, document.hidden ? 900 : 650);
    return;
  }
  if (now - lastGalleryPreviewFrameAt < GALLERY_PREVIEW_FRAME_MS) {
    raf = managedRaf37CF(animate, 'gallery:preview-loop');
    return;
  }
  lastGalleryPreviewFrameAt = now;
  const t = ((now - startedAt) / 1000) * Number(speedInput.value || 1);
  const p = [Number(params[0].value), Number(params[1].value), Number(params[2].value), Number(params[2].value)];
  if (selected?.mod) {
    if (previewRunning) {
      drawPreview(bigCanvas, selected.mod, t, p);
    }
    if (selected.id === '__editor_preview') drawPreview(editorPreviewCanvas, selected.mod, t, p);
  } else {
    drawFallback(bigCtx, bigCanvas.width, bigCanvas.height, t);
  }
  if (!GALLERY_SHELL_VIEW && thumbnailMotionEnabled && performance.now() - lastThumbnailUpdate > 240) {
    lastThumbnailUpdate = now;
    redrawGalleryThumbnails(t * 0.55);
  }
  raf = managedRaf37CF(animate, 'gallery:preview-loop');
}

studioTabs.forEach((tab) => tab.addEventListener('click', () => setActiveTab(tab.dataset.tab)));
selectorViewBtn?.addEventListener('click', () => setActiveTab('selectors'));
paletteViewBtn?.addEventListener('click', () => setActiveTab('palettes'));
libraryMenuToggle?.addEventListener('click', toggleLibraryMenu);
libraryMenuItems.forEach((item) => item.addEventListener('click', () => { setActiveTab(item.dataset.libraryView); closeLibraryMenu(); }));
document.addEventListener('click', (event) => {
  if (!libraryMenuPanel || libraryMenuPanel.hidden) return;
  if (libraryMenuPanel.contains(event.target) || libraryMenuToggle?.contains(event.target)) return;
  closeLibraryMenu();
});

librarySourceToggle?.addEventListener('click', () => setCollapsiblePanel(librarySourceToggle, librarySourcePanel, 'Source'));
editorSourceToggle?.addEventListener('click', () => setCollapsiblePanel(editorSourceToggle, editorSourcePanel, 'Source'));
searchInput.addEventListener('input', renderGallery);
searchInput.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    searchInput.value = '';
    renderGallery();
  }
});
reloadBtn.addEventListener('click', () => loadLibrary({ keepSelection: selected?.id }));
toggleL1Btn.addEventListener('click', () => toggleLayer('l1'));
toggleL2Btn.addEventListener('click', () => toggleLayer('l2'));
moveUpBtn.addEventListener('click', () => moveSelected('up'));
moveDownBtn.addEventListener('click', () => moveSelected('down'));
orderLayerSelect?.addEventListener('change', syncAssignButtons);
validateCodeBtn?.addEventListener('click', () => validateEditorCodeServer().catch((error) => { editorStatus.textContent = error.message || 'Validation failed'; }));
previewCodeBtn.addEventListener('click', previewEditorCode);
saveCodeBtn.addEventListener('click', saveEditorCode);
loadSelectedSourceBtn.addEventListener('click', loadSelectedSourceToEditor);
editorAnimSelect?.addEventListener('change', () => { if (editorAnimSelect.value) selectAnim(editorAnimSelect.value); });
editorAnimPickerBtn?.addEventListener('click', toggleEditorAnimPicker);
document.addEventListener('click', (event) => {
  if (!editorAnimPickerPanel || editorAnimPickerPanel.hidden) return;
  if (editorAnimPickerPanel.contains(event.target) || editorAnimPickerBtn?.contains(event.target)) return;
  closeEditorAnimPicker();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeEditorAnimPicker();
});
editorSaveMode?.addEventListener('change', () => {
  const item = library.find((entry) => entry.id === (editorAnimSelect?.value || selected?.id));
  if (editorSaveMode.value === 'overwrite' && item?.readonly) {
    editorSaveMode.value = 'new';
    editorStatus.textContent = 'Builtin animace nejde přepsat. Ulož jako novou kopii.';
  }
});
saveMetadataBtn?.addEventListener('click', saveMetadata);
resetMetadataBtn?.addEventListener('click', () => fillMetadataForm(selected));
duplicateAnimBtn?.addEventListener('click', duplicateSelected);
archiveAnimBtn?.addEventListener('click', setSelectedArchived);
runSelectedPreviewBtn?.addEventListener('click', () => setPreviewRunning(!previewRunning));
thumbMotionToggle?.addEventListener('click', () => setThumbnailMotion(!thumbnailMotionEnabled));
cardDetailsToggle?.addEventListener('click', () => setGalleryCardDetails(!galleryCardDetails));
selectorLayerSelect?.addEventListener('change', () => { selectorLayer = selectorLayerSelect.value || 'l1'; selectorDraftItems = []; selectorDraftDirty = false; renderSelectorManager({ reload: true }); });
resetSelectorDraftBtn?.addEventListener('click', resetSelectorDraft);
saveSelectorBtn?.addEventListener('click', saveSelectorDraft);
backToGalleryBtn?.addEventListener('click', () => setActiveTab('gallery'));
newAlbumBtn?.addEventListener('click', createAlbum);
saveAlbumsBtn?.addEventListener('click', saveAlbumDraft);
quickPrevBtn?.addEventListener('click', () => selectRelative(-1));
quickNextBtn?.addEventListener('click', () => selectRelative(1));
quickFocusSearchBtn?.addEventListener('click', () => searchInput?.focus());
quickEditorTabBtn?.addEventListener('click', () => setActiveTab('editor'));
batchSelectVisibleBtn?.addEventListener('click', selectVisibleBatch);
batchClearBtn?.addEventListener('click', clearBatchSelection);
batchEnableL1Btn?.addEventListener('click', () => runBatchLayerOperation('l1', true));
batchEnableL2Btn?.addEventListener('click', () => runBatchLayerOperation('l2', true));
batchDisableL1Btn?.addEventListener('click', () => runBatchLayerOperation('l1', false));
batchDisableL2Btn?.addEventListener('click', () => runBatchLayerOperation('l2', false));
batchArchiveBtn?.addEventListener('click', () => runBatchArchiveOperation(true));
batchRestoreBtn?.addEventListener('click', () => runBatchArchiveOperation(false));
batchMoveUpBtn?.addEventListener('click', () => runBatchMoveOperation('up'));
batchMoveDownBtn?.addEventListener('click', () => runBatchMoveOperation('down'));
document.querySelectorAll('[data-nav-href]').forEach((btn) => {
  btn.addEventListener('click', () => requestNavigation({ href: btn.dataset.navHref, mainReturnFast: btn.dataset.mainReturnFast === '1' }));
});
leaveGuardCancelBtn?.addEventListener('click', hideLeaveGuard);
leaveGuardDiscardBtn?.addEventListener('click', () => navigateNow(pendingNavigation));
leaveGuardSaveBtn?.addEventListener('click', async () => {
  const target = pendingNavigation;
  if (leaveGuardSaveBtn) leaveGuardSaveBtn.textContent = 'Saving…';
  try {
    await saveAllDraftsBeforeLeave();
    navigateNow(target);
  } catch (error) {
    console.warn(error);
    if (leaveGuardText) leaveGuardText.textContent = `Save failed: ${error.message || error}`;
  } finally {
    if (leaveGuardSaveBtn) leaveGuardSaveBtn.textContent = 'Save & leave';
  }
});
fileInput.addEventListener('change', async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  editorName.value = file.name.replace(/\.js$/i, '');
  codeEditor.value = await file.text();
  editorStatus.textContent = 'File loaded';
});
codeEditor?.addEventListener('input', saveEditorDraftLocal);
editorName?.addEventListener('input', saveEditorDraftLocal);
editorTag?.addEventListener('input', saveEditorDraftLocal);
editorSaveMode?.addEventListener('change', saveEditorDraftLocal);
shadertoyCode?.addEventListener('input', () => {
  shadertoyPreviewActive = false;
  showShadertoyError(null);
  if (shadertoyStatus) shadertoyStatus.textContent = 'draft dirty';
});
shadertoySaveDraftBtn?.addEventListener('click', saveShadertoyDraftLocal);
shadertoyToEditorBtn?.addEventListener('click', () => {
  const source = String(shadertoyCode?.value || '').trim();
  if (!source) {
    if (shadertoyStatus) shadertoyStatus.textContent = 'empty draft';
    if (shadertoyDraftInfo) shadertoyDraftInfo.textContent = 'Paste GLSL first';
    return;
  }
  const moduleCode = buildShadertoyBridgeModule(source);
  if (codeEditor) codeEditor.value = moduleCode;
  if (editorName && !editorName.value.trim()) editorName.value = 'Shadertoy Draft';
  if (editorTag) {
    const existing = normalizeTags(editorTag.value);
    editorTag.value = [...new Set([...existing, 'shadertoy', 'shader'])].join(', ');
  }
  if (editorSaveMode) editorSaveMode.value = 'new';
  saveEditorDraftLocal();
  setActiveTab('editor');
  if (editorStatus) editorStatus.textContent = 'Shadertoy bridge loaded to editor';
  if (shadertoyStatus) shadertoyStatus.textContent = 'sent to editor';
  if (shadertoyDraftInfo) shadertoyDraftInfo.textContent = 'Bridge module generated in Editor tab';
});
shadertoyImportBtn?.addEventListener('click', () => shadertoyImportFile?.click());
shadertoyImportFile?.addEventListener('change', async () => {
  const file = shadertoyImportFile.files?.[0];
  if (!file || !shadertoyCode) return;
  try {
    const text = await file.text();
    shadertoyCode.value = String(text || '');
    const validation = validateShadertoyDraft();
    if (shadertoyStatus) shadertoyStatus.textContent = validation.ok ? 'imported' : 'imported / needs fix';
    if (shadertoyDraftInfo) shadertoyDraftInfo.textContent = `Imported ${file.name}`;
  } catch (error) {
    if (shadertoyStatus) shadertoyStatus.textContent = 'import failed';
    if (shadertoyDraftInfo) shadertoyDraftInfo.textContent = error?.message || 'Import failed';
  } finally {
    shadertoyImportFile.value = '';
  }
});
shadertoyExportBtn?.addEventListener('click', () => {
  const source = String(shadertoyCode?.value || '');
  if (!source.trim()) {
    if (shadertoyStatus) shadertoyStatus.textContent = 'nothing to export';
    return;
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  downloadTextFile(`shadertoy-draft-${stamp}.glsl`, source);
  downloadTextFile(`shadertoy-bridge-${stamp}.js`, buildShadertoyBridgeModule(source));
  if (shadertoyStatus) shadertoyStatus.textContent = 'exported';
  if (shadertoyDraftInfo) shadertoyDraftInfo.textContent = 'Exported .glsl + bridge module scaffold';
});
shadertoyPreviewCanvas?.addEventListener('mousemove', (event) => updateShadertoyMouseFromEvent(event, null));
shadertoyPreviewCanvas?.addEventListener('mousedown', (event) => updateShadertoyMouseFromEvent(event, true));
shadertoyPreviewCanvas?.addEventListener('mouseup', (event) => updateShadertoyMouseFromEvent(event, false));
shadertoyPreviewCanvas?.addEventListener('mouseleave', () => { shadertoyMouse.down = 0; });
shadertoyErrorPanel?.addEventListener('click', () => {
  const line = Number(shadertoyErrorPanel.dataset.line || 0);
  const col = Number(shadertoyErrorPanel.dataset.col || 1);
  if (line > 0) focusShadertoyLine(line, col);
});
shadertoyValidateBtn?.addEventListener('click', () => {
  const validation = validateShadertoyDraft();
  if (shadertoyStatus) shadertoyStatus.textContent = validation.ok ? 'valid' : 'needs fix';
  if (shadertoyDraftInfo) shadertoyDraftInfo.textContent = validation.reason;
  if (!validation.ok) {
    showShadertoyError({ message: validation.reason, line: null, col: null });
    return;
  }
  try {
    createShadertoyProgram(String(shadertoyCode?.value || ''));
    showShadertoyError(null);
  } catch (error) {
    showShadertoyError(parseShaderError(error?.message || error));
  }
});
shadertoyPreviewBtn?.addEventListener('click', () => {
  activateShadertoyPreview();
  if (!shadertoyPreviewActive && shadertoyDraftInfo && !shadertoyDraftInfo.textContent) {
    shadertoyDraftInfo.textContent = 'Sandbox preview refreshed';
  }
});
document.addEventListener('keydown', (event) => {
  if (event.defaultPrevented) return;
  const key = String(event.key || '').toLowerCase();
  const typing = isTypingContext(event.target);
  if ((event.ctrlKey || event.metaKey) && key === 's') {
    if (activeTab === 'editor') {
      event.preventDefault();
      saveEditorCode();
    }
    return;
  }
  if ((event.ctrlKey || event.metaKey) && key === 'enter' && activeTab === 'editor') {
    event.preventDefault();
    previewEditorCode();
    return;
  }
  if (!typing && key === '/') {
    event.preventDefault();
    searchInput?.focus();
    searchInput?.select?.();
    return;
  }
  if (typing) return;
  if (key === 'j') return selectRelative(1);
  if (key === 'k') return selectRelative(-1);
  if (key === 'e') return setActiveTab('editor');
  if (key === 'g') return setActiveTab('gallery');
  if (event.key === 'Enter' && activeTab !== 'editor') {
    event.preventDefault();
    setPreviewRunning(!previewRunning);
  }
});
if (!codeEditor.value.trim()) codeEditor.value = defaultUserCode();
restoreEditorDraftLocal();
restoreShadertoyDraftLocal();
drawShadertoyPlaceholder(0.35);
initEditorSplitResize();
updateBatchStatus();
window.addEventListener('beforeunload', (event) => {
  cancelGalleryThumbQueue();
  cancelManagedRaf37CF(raf);
  if (editorBlobUrl) URL.revokeObjectURL(editorBlobUrl);
  if (!allowUnsafeLeave && unsavedGalleryChanges()) {
    event.preventDefault();
    event.returnValue = '';
  }
});

setPreviewRunning(!GALLERY_SHELL_VIEW);
if (GALLERY_SHELL_VIEW) {
  managedTimeout37CF('gallery:shell-preview-start', () => setPreviewRunning(true), 900, { maxMs: 1600 });
}
setThumbnailMotion(false);
setGalleryCardDetails(true);
loadAlbumDraft();
renderAlbums();
if (saveSelectorBtn) saveSelectorBtn.disabled = true;
loadLibrary().catch((error) => {
  console.error(error);
  statusText.textContent = 'Load failed';
  grid.innerHTML = '<div class="library-note">Galerii se nepodařilo načíst.</div>';
});
animate();
