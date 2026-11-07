
// STEP37CF: mapping screen timers are non-critical; route them through the shared loop registry.
function runtimeLoopRegistry37CF() {
  try { return window.__budilightRuntimeLoopRegistry37CE || window.__budilightRuntimeLoopRegistry37CF || null; } catch { return null; }
}
function managedTimeout37CF(name, fn, delayMs, opts = {}) {
  const reg = runtimeLoopRegistry37CF();
  if (reg?.timeout) return reg.timeout(name, fn, delayMs, { group: 'mapping', liveFactor: 2.5, hiddenFactor: 4, maxMs: 2500, ...opts });
  return setTimeout(fn, Math.max(0, Number(delayMs) || 0));
}
function clearManagedTimer37CF(id) {
  if (!id) return;
  const reg = runtimeLoopRegistry37CF();
  if (typeof id === 'string' && reg?.clear) { try { reg.clear(id); return; } catch {} }
  try { clearTimeout(id); } catch {}
}
function managedRaf37CF(fn, name = 'mapping:raf') {
  if (document.hidden || !isMappingShellActive37BP()) return managedTimeout37CF(name, () => fn(performance.now()), 450, { hiddenFactor: 6, maxMs: 3000 });
  return requestAnimationFrame(fn);
}
import { requestShellNavigation } from './runtime/shell_child_navigation.js';
import {
  createDefaultMappingV2,
  normalizeMappingV2,
  validateMappingV2,
  compileMappingV2,
  compileArtNetPatchFromMappingV2,
  mappingV2ToLegacyExport
} from './runtime/mapping_v2.js';
import {
  loadMappingV2,
  saveMappingV2,
  exportMappingV2Document,
  parseMappingV2Document,
  createMappingPreset,
  LEGACY_MAPPING_STORAGE_KEY
} from './runtime/mapping_v2_store.js';

const $ = (id) => document.getElementById(id);
const ARTNET_MASTER_PATCH_STORAGE_KEY = 'led-engine-artnet-master-patch-v1';
const SETTINGS_STORAGE_KEY_37CR = 'led-engine-settings-v1';
const PERFORMANCE_STATE_STORAGE_KEY_37CR = 'led-engine-state-v3';

const state = {
  mapping: normalizeMappingV2(loadMappingV2(localStorage)),
  selectedId: null,
  dirty: false,
  canvasItems: [],
  selectedProbePartIndex: 0,
  livePatchTimer: null,
  livePatchBusy: false,
  livePatchQueued: false,
  cache: {
    mappingKey: '',
    compiled: null,
    validation: null,
    artnetPatch: null
  }
};

const els = {
  status: $('mappingStatus'),
  presetSelect: $('presetSelect'),
  loadPreset: $('loadPreset'),
  reset8x300: $('reset8x300'),
  mapLabel: $('mapLabel'),
  stripCount: $('stripCount'),
  defaultPixels: $('defaultPixels'),
  applyStripCount: $('applyStripCount'),
  addSegment: $('addSegment'),
  duplicateSegment: $('duplicateSegment'),
  removeSegment: $('removeSegment'),
  renumberSegments: $('renumberSegments'),
  normalizeAddresses: $('normalizeAddresses'),
  resetCorrections: $('resetCorrections'),
  resetGlobalOutput: $('resetGlobalOutput'),
  probePrevPart: $('probePrevPart'),
  probeNextPart: $('probeNextPart'),
  probeFlashStrip: $('probeFlashStrip'),
  probeFlashPart: $('probeFlashPart'),
  probeFlashStart: $('probeFlashStart'),
  probeFlashMiddle: $('probeFlashMiddle'),
  probeFlashEnd: $('probeFlashEnd'),
  probeFlashBoundaries: $('probeFlashBoundaries'),
  probeFlashQuarterMarks: $('probeFlashQuarterMarks'),
  probeFlashEvery10: $('probeFlashEvery10'),
  probeFlashDirection: $('probeFlashDirection'),
  probeFlashRgbOrder: $('probeFlashRgbOrder'),
  probeDirForward: $('probeDirForward'),
  probeDirReverse: $('probeDirReverse'),
  probeStripOn: $('probeStripOn'),
  probeStripOff: $('probeStripOff'),
  probeAllOn: $('probeAllOn'),
  probeAllOff: $('probeAllOff'),
  probeRgbObserved: $('probeRgbObserved'),
  probeRgbApply: $('probeRgbApply'),
  probeBlackout: $('probeBlackout'),
  probeStatus: $('probeStatus'),
  bulkOutput: $('bulkOutput'),
  bulkUniverse: $('bulkUniverse'),
  bulkUniverseSize: $('bulkUniverseSize'),
  applyAutoRoute: $('applyAutoRoute'),
  saveMapping: $('saveMapping'),
  exportMapping: $('exportMapping'),
  importMapping: $('importMapping'),
  jsonBox: $('jsonBox'),
  canvas: $('previewCanvas'),
  summaryReadout: $('summaryReadout'),
  segmentList: $('segmentList'),
  selectionReadout: $('selectionReadout'),
  segmentEditor: $('segmentEditor'),
  validationBox: $('validationBox'),
  routesBox: $('routesBox'),
  artnetReportBox: $('artnetReportBox'),
  mappingHealthBox: $('mappingHealthBox'),
  universeHeatmapBox: $('universeHeatmapBox')
};
const controls = {
  segmentGrid: els.segmentList
};

// STEP37BP: Mapping screen no longer performs heavy diagnostics/canvas refresh
// synchronously for every slider/input event.  The physical output patch is still
// debounced separately, while UI paint work is coalesced into one RAF/short idle
// task.  This is especially important with 8x300 mappings where every correction
// slider used to rebuild diagnostics + redraw preview on every input tick.
const mappingPerf37BP = {
  version: 'STEP37BP_MAPPING_RENDER_QUEUE',
  last: {},
  max: {},
  counts: {},
  queued: 0,
  skippedInactive: 0,
  active: true,
  lastReason: '',
  lastAt: 0
};
let mappingRenderQueue37BP = null;
let mappingRenderTimer37BP = 0;
let mappingRenderRaf37BP = 0;

function profileMappingOp37BP(name, fn) {
  const t0 = performance.now();
  try {
    return fn();
  } finally {
    const dt = Math.round((performance.now() - t0) * 10) / 10;
    mappingPerf37BP.last[name] = dt;
    mappingPerf37BP.max[name] = Math.max(Number(mappingPerf37BP.max[name] || 0), dt);
    mappingPerf37BP.counts[name] = Number(mappingPerf37BP.counts[name] || 0) + 1;
    mappingPerf37BP.lastAt = Date.now();
    try { window.__budilightMappingPerf37BP = mappingPerf37BP; } catch {}
  }
}

function isMappingShellActive37BP() {
  try { return mappingPerf37BP.active !== false; } catch { return true; }
}

window.addEventListener('message', (event) => {
  const message = event?.data;
  if (!message || typeof message !== 'object' || message.type !== 'led-shell-view-active') return;
  mappingPerf37BP.active = message.active !== false;
  mappingPerf37BP.lastReason = mappingPerf37BP.active ? 'shell-active' : 'shell-inactive';
  try { window.__budilightMappingPerf37BP = mappingPerf37BP; } catch {}
  if (mappingPerf37BP.active && mappingRenderQueue37BP) flushMappingRenderQueue37BP('reactivate');
});

function scheduleMappingRender37BP(options = {}) {
  const next = {
    summary: options.summary !== false,
    diagnostics: Boolean(options.diagnostics),
    preview: Boolean(options.preview),
    editor: Boolean(options.editor),
    globals: Boolean(options.globals),
    list: Boolean(options.list),
    forceAll: Boolean(options.forceAll),
    reason: String(options.reason || 'mapping-ui')
  };
  if (!mappingRenderQueue37BP) {
    mappingRenderQueue37BP = next;
  } else {
    mappingRenderQueue37BP = {
      summary: mappingRenderQueue37BP.summary || next.summary,
      diagnostics: mappingRenderQueue37BP.diagnostics || next.diagnostics,
      preview: mappingRenderQueue37BP.preview || next.preview,
      editor: mappingRenderQueue37BP.editor || next.editor,
      globals: mappingRenderQueue37BP.globals || next.globals,
      list: mappingRenderQueue37BP.list || next.list,
      forceAll: mappingRenderQueue37BP.forceAll || next.forceAll,
      reason: next.reason
    };
  }
  mappingPerf37BP.queued += 1;
  mappingPerf37BP.lastReason = mappingRenderQueue37BP.reason;
  if (!isMappingShellActive37BP()) {
    mappingPerf37BP.skippedInactive += 1;
    return;
  }
  if (mappingRenderRaf37BP || mappingRenderTimer37BP) return;
  const run = () => {
    mappingRenderRaf37BP = 0;
    mappingRenderTimer37BP = 0;
    flushMappingRenderQueue37BP('scheduled');
  };
  if (typeof requestAnimationFrame === 'function') {
    mappingRenderRaf37BP = managedRaf37CF(run, 'mapping:render-raf');
  } else {
    mappingRenderTimer37BP = managedTimeout37CF('mapping:render-timeout', run, 16, { maxMs: 1200 });
  }
}

function flushMappingRenderQueue37BP(reason = 'manual') {
  const job = mappingRenderQueue37BP;
  mappingRenderQueue37BP = null;
  if (!job) return;
  if (!isMappingShellActive37BP() && reason !== 'force') {
    mappingRenderQueue37BP = job;
    mappingPerf37BP.skippedInactive += 1;
    return;
  }
  profileMappingOp37BP('flush', () => {
    if (job.forceAll) {
      renderAllImmediate37BP();
      return;
    }
    if (job.globals) profileMappingOp37BP('syncGlobalInputs', syncGlobalInputs);
    if (job.list) profileMappingOp37BP('renderSegmentList', renderSegmentList);
    if (job.editor) profileMappingOp37BP('renderSegmentEditor', renderSegmentEditor);
    if (job.summary) profileMappingOp37BP('updateStripSummary', updateStripSummary);
    if (job.diagnostics) profileMappingOp37BP('renderDiagnostics', renderDiagnostics);
    if (job.preview) profileMappingOp37BP('drawPreview', drawPreview);
  });
}
const mappingCommandBus37BL = { socket: null, connecting: false, queue: [] };

function publishMappingCommand37BL(kind, payload = {}, reason = kind) {
  try {
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
    const send = () => {
      const socket = mappingCommandBus37BL.socket;
      if (!socket || socket.readyState !== WebSocket.OPEN) return false;
      socket.send(JSON.stringify({
        type: 'command',
        command: {
          kind: String(kind || 'mapping-test'),
          payload: { ...payload, page: 'mapping', sentAt: Date.now() },
          persist: false,
          reason: String(reason || kind || 'mapping-command')
        }
      }));
      window.__budilightMappingCommandBus37BL = {
        version: 'STEP37BL_MAPPING_COMMANDS',
        lastKind: String(kind || 'mapping-test'),
        lastReason: String(reason || kind || 'mapping-command'),
        lastSentAt: performance.now(),
        queued: mappingCommandBus37BL.queue.length
      };
      return true;
    };
    if (send()) return;
    mappingCommandBus37BL.queue.push({ kind, payload, reason });
    if (mappingCommandBus37BL.connecting) return;
    mappingCommandBus37BL.connecting = true;
    const socket = new WebSocket(`${protocol}://${location.host}`);
    mappingCommandBus37BL.socket = socket;
    socket.addEventListener('open', () => {
      mappingCommandBus37BL.connecting = false;
      const queued = mappingCommandBus37BL.queue.splice(0, 16);
      queued.forEach((item) => publishMappingCommand37BL(item.kind, item.payload, item.reason));
    });
    socket.addEventListener('close', () => {
      mappingCommandBus37BL.connecting = false;
      if (mappingCommandBus37BL.socket === socket) mappingCommandBus37BL.socket = null;
    });
    socket.addEventListener('error', () => {
      mappingCommandBus37BL.connecting = false;
    });
    socket.addEventListener('message', () => {});
  } catch {}
}


init();

function init() {
  installMappingScrollGuards();
  document.querySelectorAll('[data-nav]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      requestShellNavigation(btn.dataset.nav);
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && event.target?.matches?.('input, select, textarea')) event.preventDefault();
  }, true);

  els.loadPreset.addEventListener('click', () => loadPreset(els.presetSelect.value));
  els.reset8x300.addEventListener('click', () => loadPreset('8x300'));
  els.applyStripCount.addEventListener('click', applyStripCount);
  els.addSegment.addEventListener('click', addSegment);
  els.duplicateSegment.addEventListener('click', duplicateSelectedSegment);
  els.removeSegment.addEventListener('click', removeSelectedSegment);
  els.renumberSegments.addEventListener('click', renumberSegments);
  els.normalizeAddresses.addEventListener('click', normalizeAddresses);
  if (els.resetCorrections) els.resetCorrections.addEventListener('click', resetAllStripCorrections);
  if (els.resetGlobalOutput) els.resetGlobalOutput.addEventListener('click', resetGlobalOutputCorrections);
  els.probePrevPart.addEventListener('click', () => stepProbePart(-1));
  els.probeNextPart.addEventListener('click', () => stepProbePart(1));
  els.probeFlashStrip.addEventListener('click', () => sendProbeFrame('strip'));
  els.probeFlashPart.addEventListener('click', () => sendProbeFrame('part'));
  els.probeFlashStart?.addEventListener('click', () => sendProbeFrame('start'));
  els.probeFlashMiddle?.addEventListener('click', () => sendProbeFrame('middle'));
  els.probeFlashEnd?.addEventListener('click', () => sendProbeFrame('end'));
  els.probeFlashBoundaries?.addEventListener('click', () => sendProbeFrame('boundaries'));
  els.probeFlashQuarterMarks?.addEventListener('click', () => sendProbeFrame('quarters'));
  els.probeFlashEvery10?.addEventListener('click', () => sendProbeFrame('every10'));
  els.probeFlashDirection.addEventListener('click', () => sendProbeFrame('direction'));
  els.probeFlashRgbOrder.addEventListener('click', () => sendProbeFrame('rgb-order'));
  els.probeDirForward?.addEventListener('click', () => applySelectedStripDirection('forward'));
  els.probeDirReverse?.addEventListener('click', () => applySelectedStripDirection('reverse'));
  els.probeStripOn?.addEventListener('click', () => setSelectedStripEnabled(true));
  els.probeStripOff?.addEventListener('click', () => setSelectedStripEnabled(false));
  els.probeAllOn?.addEventListener('click', () => setAllStripsEnabled(true));
  els.probeAllOff?.addEventListener('click', () => setAllStripsEnabled(false));
  els.probeRgbApply?.addEventListener('click', () => applySelectedStripRgbOrder(els.probeRgbObserved?.value || 'rgb'));
  els.probeBlackout.addEventListener('click', blackoutProbeFrame);
  els.applyAutoRoute.addEventListener('click', autoRouteActiveSegments);
  els.saveMapping.addEventListener('click', () => { saveAndApply(); });
  els.exportMapping.addEventListener('click', exportMapping);
  els.importMapping.addEventListener('click', importMapping);

  els.mapLabel.addEventListener('input', syncGlobalFromInputs);
  els.defaultPixels.addEventListener('change', () => markDirty());

  controls.segmentGrid?.addEventListener("pointerdown", stopSegmentFormControlBubble, true);
  controls.segmentGrid?.addEventListener("click", stopSegmentFormControlBubble, true);
  controls.segmentGrid?.addEventListener("keydown", stopSegmentFormControlKeys, true);

  els.segmentList.addEventListener('click', (event) => {
    if (isSegmentFormControl(event.target)) return;
    const card = event.target.closest('[data-segment-id]');
    if (!card) return;
    const index = Number(card.dataset.segmentIndex);
    const x = window.scrollX;
    const y = window.scrollY;
    const interactiveControl = document.activeElement;
    event.preventDefault();
      selectSegment(index);
    window.scrollTo(x, y);
    if (interactiveControl?.focus) interactiveControl.focus({ preventScroll: true });
  });
  els.segmentList.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    if (isSegmentFormControl(event.target)) return;
    const card = event.target.closest('[data-segment-id]');
    if (!card) return;
    const index = Number(card.dataset.segmentIndex);
    event.preventDefault();
    preserveViewport(() => selectSegment(index));
  });
  els.segmentList.addEventListener('input', updateStripFromInlineControl);
  els.segmentList.addEventListener('change', updateStripFromInlineControl);
  els.canvas.addEventListener('click', selectSegmentFromCanvas);
  // STEP37AZ: mapping preview resize governor. Mapping preview is not part of the
  // physical output path, so while live output is locked we merge resize storms
  // instead of redrawing the canvas on every browser resize event.
  let mappingResizeTimer37AZ = 0;
  window.__budilightMappingResizeGovernor37AZ = window.__budilightMappingResizeGovernor37AZ || {
    version: 'STEP37AZ_MAPPING_RESIZE_GOVERNOR', calls: 0, applied: 0, coalesced: 0, pending: false, live: false, delayMs: 0
  };
  function isLiveOutputLocked37AZ() {
    try { return window.__budilightOutputLock37AP?.active === true; } catch { return false; }
  }
  function applyMappingResize37AZ() {
    mappingResizeTimer37AZ = 0;
    try {
      const diag = window.__budilightMappingResizeGovernor37AZ;
      diag.pending = false; diag.applied += 1; diag.lastAppliedAt = performance.now();
    } catch {}
    drawPreview();
  }
  window.addEventListener('resize', () => {
    const live = isLiveOutputLocked37AZ();
    const delay = live ? 180 : 48;
    try {
      const diag = window.__budilightMappingResizeGovernor37AZ;
      diag.calls += 1; diag.live = live; diag.delayMs = delay;
    } catch {}
    if (mappingResizeTimer37AZ) {
      try { const diag = window.__budilightMappingResizeGovernor37AZ; diag.coalesced += 1; diag.pending = true; } catch {}
      return;
    }
    try { window.__budilightMappingResizeGovernor37AZ.pending = true; } catch {}
    mappingResizeTimer37AZ = managedTimeout37CF('mapping:resize', () => {
      if (typeof requestAnimationFrame === 'function') managedRaf37CF(applyMappingResize37AZ, 'mapping:resize-raf');
      else applyMappingResize37AZ();
    }, delay, { maxMs: 1200 });
  }, { passive: true });

  if (!state.selectedId && state.mapping.segments[0]) state.selectedId = state.mapping.segments[0].id;
  renderAll();
}

function isSegmentFormControl(target) {
  return Boolean(target?.closest?.('input, select, textarea, button, label'));
}

function preserveViewport(action) {
  const x = window.scrollX;
  const y = window.scrollY;
  const interactiveControl = document.activeElement;
  const result = action?.();
  window.scrollTo(x, y);
  if (interactiveControl?.focus) interactiveControl.focus({ preventScroll: true });
  return result;
}

function stopSegmentFormControlBubble(event) {
  if (!isSegmentFormControl(event.target)) return;
  event.stopPropagation();
}

function stopSegmentFormControlKeys(event) {
  if (!isSegmentFormControl(event.target)) return;
  if (event.key === 'Enter') event.preventDefault();
  event.stopPropagation();
}

function isNavigationButton(target) {
  return Boolean(target?.closest?.('[data-nav]'));
}

function isMappingInteractiveTarget(target) {
  return Boolean(target?.closest?.('input, select, textarea, button, label, [data-segment-id]'));
}

function currentViewportSnapshot() {
  const scrollers = Array.from(document.querySelectorAll('.mapping-panel, .mapping-center, .segment-list'));
  return {
    x: window.scrollX,
    y: window.scrollY,
    scrollers: scrollers.map((node) => ({ node, top: node.scrollTop, left: node.scrollLeft }))
  };
}

function restoreViewportSnapshot(snapshot) {
  if (!snapshot) return;
  window.scrollTo(snapshot.x, snapshot.y);
  for (const item of snapshot.scrollers || []) {
    item.node.scrollTop = item.top;
    item.node.scrollLeft = item.left;
  }
}

function restoreViewportSoon(snapshot) {
  restoreViewportSnapshot(snapshot);
  managedTimeout37CF('mapping:restore-viewport', () => restoreViewportSnapshot(snapshot), 80, { maxMs: 900 });
}

function installMappingScrollGuards() {
  const root = document.getElementById('mappingApp') || document;
  const guard = (event) => {
    if (isNavigationButton(event.target)) return;
    if (!isMappingInteractiveTarget(event.target)) return;
    const snapshot = currentViewportSnapshot();
    restoreViewportSoon(snapshot);
  };
  root.addEventListener("input", guard, true);
  root.addEventListener("change", guard, true);
  root.addEventListener("click", guard, true);
}

function renderAllImmediate37BP() {
  state.mapping = normalizeMappingV2(state.mapping);
  clampProbePartSelection();
  profileMappingOp37BP('syncGlobalInputs', syncGlobalInputs);
  profileMappingOp37BP('renderSegmentList', renderSegmentList);
  profileMappingOp37BP('renderSegmentEditor', renderSegmentEditor);
  profileMappingOp37BP('renderDiagnostics', renderDiagnostics);
  profileMappingOp37BP('drawPreview', drawPreview);
}

function renderAll() {
  return profileMappingOp37BP('renderAll', renderAllImmediate37BP);
}

function scheduleRenderAll37BP(reason = 'render-all') {
  state.mapping = normalizeMappingV2(state.mapping);
  clampProbePartSelection();
  scheduleMappingRender37BP({ forceAll: true, reason });
}

function syncGlobalInputs() {
  els.mapLabel.value = state.mapping.label || '';
  els.stripCount.value = state.mapping.segments.length;
  const selected = selectedSegment() || state.mapping.segments[0];
  els.defaultPixels.value = selected?.physical?.pixelCount || 300;
}

function syncGlobalFromInputs() {
  state.mapping = normalizeMappingV2({ ...state.mapping, label: els.mapLabel.value || 'Strip mapping' });
  markDirty();
  renderDiagnostics();
}

function renderSegmentList() {
  const selectedId = state.selectedId;
  els.segmentList.innerHTML = state.mapping.segments.map((segment, index) => stripCardHtml(segment, index, selectedId)).join('');
  updateStripSummary();
}

function updateStripSummary() {
  const enabled = state.mapping.segments.filter((seg) => seg.enabled).length;
  const pixels = state.mapping.segments.reduce((sum, seg) => sum + (seg.enabled ? seg.physical.pixelCount : 0), 0);
  const outputs = new Set(state.mapping.segments.filter((seg) => seg.enabled && seg.physical.output !== 'none').map((seg) => seg.physical.output));
  els.summaryReadout.textContent = `${state.mapping.segments.length} strips | ${enabled} active | ${pixels} px | ${outputs.size} outputs`;
  els.selectionReadout.textContent = buildSelectionReadout();
  renderProbeStatus();
}

function stripCardHtml(segment, index, selectedId) {
  const p = segment.physical;
  const c = segment.correction;
  const routeSegmentsText = formatRouteSegments(p);
  const routeParts = buildPreviewRouteParts(segment);
  const checked = segment.enabled ? 'checked' : '';
  const selected = selectedId === segment.id ? 'selected' : '';
  const disabled = segment.enabled ? '' : 'disabled';
  return `
    <article class="segment-card strip-card inline-strip-card ${selected} ${disabled}" data-segment-id="${escapeHtml(segment.id)}" data-segment-index="${index}" role="button" tabindex="0">
      <div class="strip-card-head">
        <div>
          <strong>${index + 1}. ${escapeHtml(segment.label || segment.id)}</strong>
          <span>${buildStripHeadline(segment)}</span>
        </div>
        <label class="mini-switch" title="Zapnout/vypnout strip"><input data-field="enabled" type="checkbox" ${checked}><span>${segment.enabled ? 'ON' : 'OFF'}</span></label>
      </div>
      <div class="strip-meta-row">
        ${badgeHtml(`PX ${p.pixelCount}`)}
        ${badgeHtml(String(p.output || 'none').toUpperCase())}
        ${badgeHtml(routeParts.length > 1 ? `${routeParts.length} PARTS` : '1 PART')}
        ${badgeHtml(`DIR ${String(p.direction || 'forward').toUpperCase()}`)}
        ${badgeHtml(`COLOR ${String(p.colorOrder || 'RGB')}`)}
        ${p.output === 'artnet' ? badgeHtml(`IP ${String(p.outputIp || p.targetIp || 'default')}`) : ''}
      </div>
      <div class="strip-route-visual">${buildRouteVisualHtml(routeParts, p.pixelCount)}</div>
      <div class="inline-strip-form">
        <div class="form-section-title">Strip</div>
        ${inlineField('label', 'Label', 'text', segment.label)}
        ${inlineField('pixelCount', 'Pixels', 'number', p.pixelCount, '1', '20000', '1')}
        <div class="form-section-title">Output patch</div>
        <label class="field"><span>Output</span><select data-field="output">${options(['none','serial','blx','artnet','sacn','dmx'], p.output)}</select></label>
        ${inlineField('universe', 'Start universe', 'number', p.universe, '0', '63999', '1')}
        ${inlineField('startAddress', 'Start address', 'number', p.startAddress, '0', '2000000', '1')}
        ${inlineField('universeSize', 'Pixels per universe', 'number', p.universeSize ?? 170, '1', '4096', '1')}
        ${inlineField('outputIp', 'ArtNet IP', 'text', p.outputIp || p.targetIp || '', null, null, null, '')}
        ${inlineField('artnetPort', 'ArtNet port', 'number', p.artnetPort || p.targetPort || 6454, '1', '65535', '1')}
        ${inlineField('routeSegments', 'Patch parts', 'text', routeSegmentsText, null, null, null, 'wide')}
        <div class="field-help wide">Examples: <code>150,150</code> or <code>U0:0:150 | U1:0:150</code></div>
        <div class="form-section-title">Source and order</div>
        ${inlineField('pixelStart', 'Source start', 'number', p.pixelStart, '0', '2000000', '1')}
        <label class="field"><span>Direction</span><select data-field="direction">${options(['forward','reverse'], p.direction)}</select></label>
        <label class="field"><span>Color</span><select data-field="colorOrder">${options(['RGB','RBG','GRB','GBR','BRG','BGR'], p.colorOrder)}</select></label>
        <div class="form-section-title">Correction</div>
        ${inlineRange('brightness', 'Intensity', c.brightness, '0', '1', '0.01')}
        ${inlineRange('gamma', 'Gamma', c.gamma, '0.1', '5', '0.05')}
        ${inlineRange('contrast', 'Contrast', c.contrast ?? 1, '0', '3', '0.05')}
        ${inlineRange('whiteLimit', 'White limit', c.whiteLimit, '0', '1', '0.01')}
      </div>
    </article>
  `;
}

function buildSelectionReadout() {
  const segment = selectedSegment();
  if (!segment) return 'No strip selected';
  const parts = buildPreviewRouteParts(segment);
  return `${segment.label} | ${segment.physical.pixelCount}px | ${String(segment.physical.output || 'none').toUpperCase()} | ${parts.length} part${parts.length === 1 ? '' : 's'}`;
}

function buildStripHeadline(segment) {
  const physical = segment?.physical || {};
  const parts = buildPreviewRouteParts(segment);
  if (!segment?.enabled) return 'disabled';
  if (!parts.length) return `${physical.pixelCount || 0}px | no patch`;
  const first = parts[0];
  const last = parts[parts.length - 1];
  const target = physical.output === 'artnet' && (physical.outputIp || physical.targetIp) ? ` | ${physical.outputIp || physical.targetIp}:${physical.artnetPort || physical.targetPort || 6454}` : '';
  if (parts.length === 1) return `${physical.pixelCount || 0}px | U${first.universe} A${first.startAddress}${target}`;
  return `${physical.pixelCount || 0}px | U${first.universe}..U${last.universe} | ${parts.length} parts${target}`;
}

function badgeHtml(text) {
  return `<span class="chip strip-chip">${escapeHtml(String(text || ''))}</span>`;
}

function buildRouteVisualHtml(parts, totalPixels) {
  if (!parts.length) return '<div class="route-empty">No patch parts</div>';
  const safeTotal = Math.max(1, Number(totalPixels || 1));
  return parts.map((part, index) => {
    const width = Math.max(10, Math.round((Number(part.pixelCount || 0) / safeTotal) * 1000) / 10);
    return `
      <div class="route-part-block" style="--part-share:${width}%;">
        <strong>P${index + 1}</strong>
        <span>U${part.universe}</span>
        <span>A${part.startAddress}</span>
        <span>${part.pixelCount}px</span>
        ${part.outputIp || part.targetIp ? `<span>${escapeHtml(String(part.outputIp || part.targetIp))}</span>` : ''}
      </div>
    `;
  }).join('');
}

function inlineField(fieldName, label, type, value, min = null, max = null, step = null, extraClass = '') {
  const attrs = [
    `data-field="${fieldName}"`,
    `type="${type}"`,
    `value="${escapeHtml(String(value ?? ''))}"`,
    type === 'text' ? 'autocomplete="off" spellcheck="false"' : '',
    min !== null ? `min="${min}"` : '',
    max !== null ? `max="${max}"` : '',
    step !== null ? `step="${step}"` : ''
  ].filter(Boolean).join(' ');
  return `<label class="field ${escapeHtml(extraClass)}"><span>${escapeHtml(label)}</span><input ${attrs}></label>`;
}

function inlineRange(fieldName, label, value, min, max, step) {
  const shown = formatNum(value);
  return `<label class="field range-field"><span>${escapeHtml(label)} <b data-readout="${fieldName}">${shown}</b></span><input data-field="${fieldName}" type="range" min="${min}" max="${max}" step="${step}" value="${escapeHtml(String(value ?? 0))}"></label>`;
}
function isLivePatchField(fieldName) {
  return new Set([
    'enabled',
    'pixelCount',
    'output',
    'universe',
    'startAddress',
    'universeSize',
    'outputIp',
    'artnetPort',
    'pixelStart',
    'routeSegments',
    'direction',
    'colorOrder',
    'brightness',
    'gamma',
    'contrast',
    'whiteLimit'
  ]).has(String(fieldName || ''));
}

function livePatchDelayForField(fieldName, eventType = '') {
  const key = String(fieldName || '');
  if (key === 'direction' || key === 'colorOrder' || key === 'enabled') return 30;
  if (['brightness', 'gamma', 'contrast', 'whiteLimit'].includes(key)) return eventType === 'input' ? 110 : 30;
  if (['pixelCount', 'universe', 'startAddress', 'universeSize', 'outputIp', 'artnetPort', 'pixelStart', 'routeSegments', 'output'].includes(key)) return 90;
  return 180;
}

function queueLivePatchForField(fieldName, eventType = '', sourcePrefix = 'inline') {
  if (!isLivePatchField(fieldName)) return;
  scheduleLivePatchApply(`${sourcePrefix}-${fieldName}`, livePatchDelayForField(fieldName, eventType));
}


function updateStripFromInlineControl(event) {
  const control = event.target.closest('[data-field]');
  if (!control) return;
  const card = control.closest('[data-segment-id]');
  if (!card) return;
  const segmentId = card.dataset.segmentId;
  const fieldName = control.dataset.field;
  const index = state.mapping.segments.findIndex((seg) => seg.id === segmentId);
  if (index < 0) return;

  const current = state.mapping.segments[index];
  const p = current.physical;
  const c = current.correction;
  const raw = control.type === 'checkbox' ? control.checked : control.value;

  let updated = current;
  if (fieldName === 'enabled') {
    updated = { ...current, enabled: Boolean(raw) };
    card.classList.toggle('disabled', !updated.enabled);
    const stateLabel = card.querySelector('.mini-switch span');
    if (stateLabel) stateLabel.textContent = updated.enabled ? 'ON' : 'OFF';
    renderProbeStatus(updated.enabled ? 'strip enabled | press SAVE + APPLY PATCH' : 'strip disabled: output will be black after SAVE + APPLY PATCH');
  } else if (fieldName === 'label') {
    updated = { ...current, label: String(raw || current.id) };
  } else if (fieldName === 'pixelCount') {
    const pixelCount = clampInt(raw, 1, 20000, p.pixelCount);
    const nextPhysical = { ...p, pixelCount };
    if (Array.isArray(p.routeSegments) && p.routeSegments.length) {
      nextPhysical.routeSegments = buildAutoRouteSegments({
        output: nextPhysical.output,
        startUniverse: nextPhysical.universe,
        startAddress: nextPhysical.startAddress,
        pixelCount,
        universeSize: nextPhysical.universeSize
      });
    }
    updated = { ...current, source: { ...current.source, width: pixelCount }, physical: nextPhysical };
  } else if (fieldName === 'output') {
    const nextPhysical = { ...p, output: String(raw || 'none') };
    if (Array.isArray(p.routeSegments) && p.routeSegments.length) {
      nextPhysical.routeSegments = buildAutoRouteSegments({
        output: nextPhysical.output,
        startUniverse: nextPhysical.universe,
        startAddress: nextPhysical.startAddress,
        pixelCount: nextPhysical.pixelCount,
        universeSize: nextPhysical.universeSize
      });
    }
    updated = { ...current, physical: nextPhysical };
  } else if (fieldName === 'universe') {
    const nextPhysical = { ...p, universe: clampInt(raw, 0, 63999, p.universe) };
    if (Array.isArray(p.routeSegments) && p.routeSegments.length) {
      nextPhysical.routeSegments = buildAutoRouteSegments({
        output: nextPhysical.output,
        startUniverse: nextPhysical.universe,
        startAddress: nextPhysical.startAddress,
        pixelCount: nextPhysical.pixelCount,
        universeSize: nextPhysical.universeSize
      });
    }
    updated = { ...current, physical: nextPhysical };
  } else if (fieldName === 'startAddress') {
    const nextPhysical = { ...p, startAddress: clampInt(raw, 0, 2000000, p.startAddress) };
    if (Array.isArray(p.routeSegments) && p.routeSegments.length) {
      nextPhysical.routeSegments = buildAutoRouteSegments({
        output: nextPhysical.output,
        startUniverse: nextPhysical.universe,
        startAddress: nextPhysical.startAddress,
        pixelCount: nextPhysical.pixelCount,
        universeSize: nextPhysical.universeSize
      });
    }
    updated = { ...current, physical: nextPhysical };
  } else if (fieldName === 'universeSize') {
    const nextPhysical = { ...p, universeSize: clampInt(raw, 1, 4096, p.universeSize ?? 170) };
    if (Array.isArray(p.routeSegments) && p.routeSegments.length) {
      nextPhysical.routeSegments = buildAutoRouteSegments({
        output: nextPhysical.output,
        startUniverse: nextPhysical.universe,
        startAddress: nextPhysical.startAddress,
        pixelCount: nextPhysical.pixelCount,
        universeSize: nextPhysical.universeSize
      });
    }
    updated = { ...current, physical: nextPhysical };
  } else if (fieldName === 'outputIp') {
    const cleanIp = String(raw || '').trim();
    updated = { ...current, physical: { ...p, outputIp: cleanIp, targetIp: cleanIp } };
  } else if (fieldName === 'artnetPort') {
    const port = clampInt(raw, 1, 65535, p.artnetPort || p.targetPort || 6454);
    updated = { ...current, physical: { ...p, artnetPort: port, targetPort: port } };
  } else if (fieldName === 'pixelStart') {
    updated = { ...current, physical: { ...p, pixelStart: clampInt(raw, 0, 2000000, p.pixelStart) } };
  } else if (fieldName === 'routeSegments') {
    updated = { ...current, physical: { ...p, routeSegments: parseRouteSegments(raw, p) } };
  } else if (fieldName === 'direction') {
    updated = { ...current, physical: { ...p, direction: String(raw || 'forward') } };
  } else if (fieldName === 'colorOrder') {
    updated = { ...current, physical: { ...p, colorOrder: String(raw || 'RGB') } };
  } else if (fieldName === 'brightness') {
    updated = { ...current, correction: { ...c, brightness: clampNum(raw, 0, 1, c.brightness) } };
  } else if (fieldName === 'gamma') {
    updated = { ...current, correction: { ...c, gamma: clampNum(raw, 0.1, 5, c.gamma) } };
  } else if (fieldName === 'contrast') {
    updated = { ...current, correction: { ...c, contrast: clampNum(raw, 0, 3, c.contrast ?? 1) } };
  } else if (fieldName === 'whiteLimit') {
    updated = { ...current, correction: { ...c, whiteLimit: clampNum(raw, 0, 1, c.whiteLimit) } };
  }

  const segments = state.mapping.segments.map((seg, i) => i === index ? updated : seg);
  state.mapping = normalizeMappingV2({ ...state.mapping, segments });
  state.selectedId = updated.id;
  markDirty();

  const readout = card.querySelector(`[data-readout="${fieldName}"]`);
  if (readout) readout.textContent = formatNum(control.value);
  const heavyField = ['pixelCount', 'output', 'universe', 'startAddress', 'universeSize', 'outputIp', 'artnetPort', 'pixelStart', 'routeSegments', 'direction', 'colorOrder', 'enabled'].includes(String(fieldName || ''));
  scheduleMappingRender37BP({
    summary: true,
    diagnostics: heavyField || event.type === 'change',
    preview: heavyField || event.type === 'change',
    editor: false,
    reason: `inline-${fieldName}`
  });
  // STEP37P: inline strip cards now use the same live patch path as the detail editor.
  // This makes Direction, RGB order and correction sliders affect the active Art-Net
  // patch immediately, without waiting for SAVE + APPLY. Range controls are debounced
  // a little harder so dragging sliders does not flood the server.
  queueLivePatchForField(fieldName, event.type, 'inline');
}

function renderSegmentEditor() {
  const segment = selectedSegment();
  if (!segment) {
    els.segmentEditor.className = 'segment-editor empty';
    els.segmentEditor.textContent = 'Vyber strip ze seznamu nebo klikni na řádek v preview.';
    return;
  }
  const p = segment.physical;
  const c = segment.correction;
  els.segmentEditor.className = 'segment-editor';
  els.segmentEditor.innerHTML = `
    <div class="switch-row">
      <strong>${escapeHtml(segment.label)}</strong>
      <label><input id="segEnabled" type="checkbox" ${segment.enabled ? 'checked' : ''}> ON</label>
    </div>
    <div class="editor-grid">
      ${field('segLabel', 'Label', 'text', segment.label, 'wide')}
      ${field('segId', 'ID', 'text', segment.id)}
      ${field('segTags', 'Tags', 'text', segment.tags.join(', '))}
      ${field('segPixelCount', 'Počet pixelů stripu', 'number', p.pixelCount, 'wide', '1', '20000', '1')}
      <label class="field"><span>Konkrétní výstup</span><select id="segOutput">${options(['none','serial','blx','artnet','sacn','dmx'], p.output)}</select></label>
      ${field('segUniverse', 'Universe / port', 'number', p.universe, '', '0', '63999', '1')}
      ${field('segStartAddress', 'Start address px', 'number', p.startAddress, '', '0', '2000000', '1')}
      ${field('segUniverseSize', 'Universe px / packet chunk', 'number', p.universeSize ?? 170, '', '1', '4096', '1')}
      ${field('segOutputIp', 'ArtNet cílová IP', 'text', p.outputIp || p.targetIp || '', '')}
      ${field('segArtnetPort', 'ArtNet port', 'number', p.artnetPort || p.targetPort || 6454, '', '1', '65535', '1')}
      ${field('segPixelStart', 'Source pixel start', 'number', p.pixelStart, '', '0', '2000000', '1')}
      ${field('segRouteSegments', 'Patch parts', 'text', formatRouteSegments(p), 'wide')}
      <label class="field"><span>Direction</span><select id="segDirection">${options(['forward','reverse'], p.direction)}</select></label>
      <label class="field"><span>Color order</span><select id="segColorOrder">${options(['RGB','RBG','GRB','GBR','BRG','BGR'], p.colorOrder)}</select></label>
      ${field('segBrightness', 'Intensity', 'range', c.brightness, 'wide', '0', '1', '0.01')}
      ${field('segGamma', 'Gamma', 'range', c.gamma, 'wide', '0.1', '5', '0.05')}
      ${field('segContrast', 'Contrast', 'range', c.contrast ?? 1, 'wide', '0', '3', '0.05')}
      ${field('segWhiteLimit', 'White limit', 'range', c.whiteLimit, 'wide', '0', '1', '0.01')}
    </div>
  `;
  bindSegmentEditor();
}

function bindSegmentEditor() {
  const controls = els.segmentEditor.querySelectorAll('input, select');
  controls.forEach((control) => {
    const type = control.type === 'range' ? 'input' : 'change';
    control.addEventListener(type, updateSelectedSegmentFromEditor);
  });
}

function updateSelectedSegmentFromEditor() {
  const segment = selectedSegment();
  if (!segment) return;
  const nextId = uniqueId(value('segId', segment.id), segment.id);
  const pixelCount = clampInt(value('segPixelCount'), 1, 20000, segment.physical.pixelCount);
  const updated = {
    ...segment,
    id: nextId,
    label: value('segLabel', segment.label),
    enabled: bool('segEnabled'),
    source: { ...segment.source, width: pixelCount, height: 1 },
    physical: {
      ...segment.physical,
      output: value('segOutput', segment.physical.output),
      universe: clampInt(value('segUniverse'), 0, 63999, segment.physical.universe),
      startAddress: clampInt(value('segStartAddress'), 0, 2000000, segment.physical.startAddress),
      universeSize: clampInt(value('segUniverseSize'), 1, 4096, segment.physical.universeSize ?? 170),
      outputIp: String(value('segOutputIp', segment.physical.outputIp || segment.physical.targetIp || '') || '').trim(),
      targetIp: String(value('segOutputIp', segment.physical.outputIp || segment.physical.targetIp || '') || '').trim(),
      artnetPort: clampInt(value('segArtnetPort'), 1, 65535, segment.physical.artnetPort || segment.physical.targetPort || 6454),
      targetPort: clampInt(value('segArtnetPort'), 1, 65535, segment.physical.artnetPort || segment.physical.targetPort || 6454),
      pixelStart: clampInt(value('segPixelStart'), 0, 2000000, segment.physical.pixelStart),
      pixelCount,
      routeSegments: parseRouteSegments(value('segRouteSegments', ''), { ...segment.physical, pixelCount }),
      direction: value('segDirection', segment.physical.direction),
      colorOrder: value('segColorOrder', segment.physical.colorOrder)
    },
    correction: {
      ...segment.correction,
      brightness: clampNum(value('segBrightness'), 0, 1, segment.correction.brightness),
      gamma: clampNum(value('segGamma'), 0.1, 5, segment.correction.gamma),
      contrast: clampNum(value('segContrast'), 0, 3, segment.correction.contrast ?? 1),
      whiteLimit: clampNum(value('segWhiteLimit'), 0, 1, segment.correction.whiteLimit)
    },
    tags: value('segTags', '').split(',').map((s) => s.trim()).filter(Boolean)
  };
  const index = selectedIndex();
  const segments = state.mapping.segments.map((s, i) => i === index ? updated : s);
  state.mapping = normalizeMappingV2({ ...state.mapping, segments });
  state.selectedId = nextId;
  markDirty();
  renderSegmentList();
  renderDiagnostics();
  drawPreview();
  scheduleLivePatchApply('editor-control', 80);
}

function renderDiagnosticsLegacy() {
  const compiled = compileMappingV2(state.mapping);
  const validation = validateMappingV2(state.mapping);
  els.validationBox.innerHTML = [
    validation.ok ? '<div class="ok-line">OK · mapping valid</div>' : '<div class="error-line">ERROR · mapping invalid</div>',
    ...validation.errors.map((e) => `<div class="error-line">${escapeHtml(e)}</div>`),
    ...validation.warnings.map((w) => `<div class="warn-line">${escapeHtml(w)}</div>`)
  ].join('') || '<div class="ok-line">OK</div>';

  els.routesBox.innerHTML = Object.entries(compiled.routes).map(([output, list]) => {
    const active = list.filter((r) => r.enabled).length;
    const pixels = list.reduce((sum, r) => sum + (r.enabled ? r.pixelCount : 0), 0);
    const universes = [...new Set(list.filter((r) => r.enabled).map((r) => r.universe))].join(', ') || '-';
    return `<div class="route-row"><strong>${escapeHtml(output)}</strong><br>${active} strips · ${pixels} px · universes ${escapeHtml(universes)}</div>`;
  }).join('') || 'No routes';
  els.artnetReportBox.innerHTML = buildArtNetReportHtml(compiled);
  els.status.textContent = validation.ok ? (state.dirty ? 'DIRTY · NOT SAVED' : 'READY') : 'VALIDATION ERROR';
}

function buildArtNetReportHtmlLegacy(compiled) {
  const routes = Array.isArray(compiled?.routes?.artnet) ? compiled.routes.artnet.filter((route) => route.enabled) : [];
  if (!routes.length) return '<div class="route-row"><strong>No Art-Net output</strong><br>Assign some strips to output=artnet.</div>';
  const stripMap = new Map();
  const universeMap = new Map();
  routes.forEach((route) => {
    const strip = stripMap.get(route.stripIndex) || { stripIndex: route.stripIndex, pixels: 0, universes: [] };
    strip.pixels += Number(route.pixelCount || 0);
    strip.universes.push(`U${route.universe}:${route.startAddress}-${route.startAddress + route.pixelCount - 1}`);
    stripMap.set(route.stripIndex, strip);

    const uni = universeMap.get(route.universe) || { universe: route.universe, pixels: 0, strips: new Set() };
    uni.pixels += Number(route.pixelCount || 0);
    uni.strips.add(route.stripIndex);
    universeMap.set(route.universe, uni);
  });
  const stripLines = [...stripMap.values()]
    .sort((a, b) => a.stripIndex - b.stripIndex)
    .map((row) => `<div class="route-row"><strong>STRIP ${row.stripIndex}</strong><br>${row.pixels} px · ${escapeHtml(row.universes.join(' | '))}</div>`);
  const universeLines = [...universeMap.values()]
    .sort((a, b) => a.universe - b.universe)
    .map((row) => `<div class="route-row"><strong>U${row.universe}</strong><br>${row.pixels} px · strips ${escapeHtml([...row.strips].sort((a, b) => a - b).join(', '))}</div>`);
  return [
    `<div class="route-row"><strong>PATCH SUMMARY</strong><br>${routes.length} route parts · ${stripMap.size} strips · ${universeMap.size} universes</div>`,
    ...stripLines,
    ...universeLines
  ].join('');
}

function drawPreviewLegacy() {
  const canvas = els.canvas;
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  const width = Math.max(320, Math.floor(rect.width * dpr));
  const height = Math.max(180, Math.floor(rect.height * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#020406';
  ctx.fillRect(0, 0, width, height);
  state.canvasItems = [];

  const segments = state.mapping.segments;
  const maxPixels = Math.max(1, ...segments.map((s) => s.physical.pixelCount || 1));
  const pad = 18 * dpr;
  const rowGap = 8 * dpr;
  const rowH = Math.max(20 * dpr, Math.min(34 * dpr, (height - pad * 2 - rowGap * Math.max(0, segments.length - 1)) / Math.max(1, segments.length)));
  const labelW = 118 * dpr;
  const barW = Math.max(1, width - pad * 2 - labelW - 12 * dpr);

  ctx.font = `${Math.max(10, 12 * dpr)}px ui-sans-serif`;
  segments.forEach((segment, index) => {
    const y = pad + index * (rowH + rowGap);
    if (y > height - pad) return;
    const selected = segment.id === state.selectedId;
    const x = pad;
    const barX = x + labelW;
    const w = Math.max(2 * dpr, (segment.physical.pixelCount / maxPixels) * barW);
    const color = previewStripColor(segment, index);
    const routeParts = buildPreviewRouteParts(segment);

    ctx.fillStyle = selected ? 'rgba(43,140,255,.22)' : 'rgba(255,255,255,.035)';
    roundRect(ctx, x, y, width - pad * 2, rowH, 8 * dpr);
    ctx.fill();

    ctx.fillStyle = segment.enabled ? '#eff6ff' : 'rgba(239,246,255,.38)';
    ctx.fillText(`${index + 1}. ${segment.label}`, x + 8 * dpr, y + rowH * 0.65);

    ctx.fillStyle = segment.enabled ? color : 'rgba(120,120,120,.20)';
    roundRect(ctx, barX, y + 4 * dpr, w, rowH - 8 * dpr, 7 * dpr);
    ctx.fill();
    if (segment.enabled && routeParts.length > 1) {
      routeParts.forEach((part, partIndex) => {
        const partX = barX + (part.pixelStart / Math.max(1, segment.physical.pixelCount)) * w;
        const partW = Math.max(2 * dpr, (part.pixelCount / Math.max(1, segment.physical.pixelCount)) * w);
        ctx.fillStyle = partIndex % 2 === 0 ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.12)';
        roundRect(ctx, partX, y + 6 * dpr, partW, rowH - 12 * dpr, 4 * dpr);
        ctx.fill();
        if (partIndex > 0) {
          ctx.strokeStyle = 'rgba(255,255,255,.35)';
          ctx.lineWidth = Math.max(1, dpr);
          ctx.beginPath();
          ctx.moveTo(partX, y + 5 * dpr);
          ctx.lineTo(partX, y + rowH - 5 * dpr);
          ctx.stroke();
        }
      });
    }

    ctx.strokeStyle = selected ? '#ff2bd6' : 'rgba(255,255,255,.12)';
    ctx.lineWidth = selected ? 2 * dpr : 1 * dpr;
    roundRect(ctx, x, y, width - pad * 2, rowH, 8 * dpr);
    ctx.stroke();

    ctx.fillStyle = 'rgba(239,246,255,.74)';
    ctx.fillText(`${segment.physical.output} · U${segment.physical.universe} · A${segment.physical.startAddress} · ${segment.physical.pixelCount}px`, barX + 8 * dpr, y + rowH * 0.65);

    if (routeParts.length > 1) {
      ctx.fillStyle = color;
      roundRect(ctx, barX + 2 * dpr, y + 10 * dpr, Math.max(40 * dpr, Math.min(w - 4 * dpr, 150 * dpr)), Math.max(10 * dpr, rowH - 20 * dpr), 4 * dpr);
      ctx.fill();
      ctx.fillStyle = '#eff6ff';
      ctx.fillText(`${routeParts.length} parts · ${segment.physical.pixelCount}px`, barX + 8 * dpr, y + rowH * 0.65);
    }

    state.canvasItems.push({ id: segment.id, x, y, w: width - pad * 2, h: rowH });
  });
}

function renderDiagnostics() {
  const compiled = getCompiledMapping();
  const validation = getMappingValidation();
  els.validationBox.innerHTML = [
    validation.ok ? '<div class="ok-line">OK | mapping valid</div>' : '<div class="error-line">ERROR | mapping invalid</div>',
    ...validation.errors.map((e) => `<div class="route-row"><strong class="error-line">Error</strong><div>${escapeHtml(e)}</div></div>`),
    ...validation.warnings.map((w) => `<div class="route-row"><strong class="warn-line">Warning</strong><div>${escapeHtml(w)}</div></div>`)
  ].join('') || '<div class="ok-line">OK</div>';

  els.routesBox.innerHTML = buildOutputSummaryHtml(compiled.routes);
  els.artnetReportBox.innerHTML = buildArtNetReportHtml(compiled);
  if (els.mappingHealthBox) els.mappingHealthBox.innerHTML = buildMappingHealthHtml(compiled, validation);
  if (els.universeHeatmapBox) els.universeHeatmapBox.innerHTML = buildUniverseHeatmapHtml(compiled);
  els.status.textContent = validation.ok ? (state.dirty ? 'DIRTY | NOT SAVED' : 'READY') : 'VALIDATION ERROR';
}

function buildOutputSummaryHtml(routes = {}) {
  const rows = Object.entries(routes).map(([output, list]) => {
    const active = list.filter((r) => r.enabled).length;
    const pixels = list.reduce((sum, r) => sum + (r.enabled ? r.pixelCount : 0), 0);
    const universes = [...new Set(list.filter((r) => r.enabled).map((r) => r.universe))].sort((a, b) => a - b);
    return `
      <div class="route-row">
        <strong>${escapeHtml(String(output || 'none').toUpperCase())}</strong>
        <div>${active} strips | ${pixels} px</div>
        <div>${universes.length ? `universes ${escapeHtml(universes.join(', '))}` : 'no universes'}</div>
      </div>
    `;
  });
  return rows.join('') || '<div class="route-row"><strong>No outputs</strong><div>Assign output on strip cards.</div></div>';
}

function buildArtNetReportHtml(compiled) {
  const routes = Array.isArray(compiled?.routes?.artnet) ? compiled.routes.artnet.filter((route) => route.enabled) : [];
  if (!routes.length) return '<div class="route-row"><strong>No Art-Net output</strong><div>Assign some strips to output=artnet.</div></div>';
  const stripMap = new Map();
  const universeMap = new Map();
  routes.forEach((route) => {
    const strip = stripMap.get(route.stripIndex) || { stripIndex: route.stripIndex, pixels: 0, universes: [] };
    strip.pixels += Number(route.pixelCount || 0);
    strip.universes.push(`P${strip.universes.length + 1} -> U${route.universe} A${route.startAddress} ${route.pixelCount}px`);
    stripMap.set(route.stripIndex, strip);

    const uni = universeMap.get(route.universe) || { universe: route.universe, pixels: 0, strips: new Set() };
    uni.pixels += Number(route.pixelCount || 0);
    uni.strips.add(route.stripIndex);
    universeMap.set(route.universe, uni);
  });
  const stripLines = [...stripMap.values()]
    .sort((a, b) => a.stripIndex - b.stripIndex)
    .map((row) => `<div class="route-row"><strong>STRIP ${row.stripIndex + 1}</strong><div>${row.pixels} px | ${row.universes.length} part${row.universes.length === 1 ? '' : 's'}</div><div>${escapeHtml(row.universes.join(' | '))}</div></div>`);
  const universeLines = [...universeMap.values()]
    .sort((a, b) => a.universe - b.universe)
    .map((row) => `<div class="route-row"><strong>U${row.universe}</strong><div>${row.pixels} px</div><div>strips ${escapeHtml([...row.strips].sort((a, b) => a - b).map((index) => index + 1).join(', '))}</div></div>`);
  return [
    `<div class="route-row"><strong>PATCH SUMMARY</strong><div>${routes.length} route parts | ${stripMap.size} strips | ${universeMap.size} universes</div></div>`,
    ...stripLines,
    ...universeLines
  ].join('');
}



function analyzeArtNetOccupancy(compiled) {
  const routes = Array.isArray(compiled?.routes?.artnet) ? compiled.routes.artnet.filter((route) => route.enabled) : [];
  const universeMap = new Map();
  let invalid = 0;
  routes.forEach((route) => {
    const universe = clampInt(route.universe, 0, 63999, 0);
    const capacity = clampInt(route.universeSize, 1, 170, 170);
    const start = clampInt(route.startAddress, 0, 2000000, 0);
    const count = clampInt(route.pixelCount, 0, 65535, 0);
    if (start + count > capacity) invalid += 1;
    const row = universeMap.get(universe) || { universe, capacity, ranges: [], used: 0, overlaps: 0, gaps: 0, overfull: false, strips: new Set() };
    row.capacity = Math.max(row.capacity, capacity);
    row.ranges.push({
      start,
      end: Math.min(capacity - 1, start + count - 1),
      rawEnd: start + count - 1,
      stripIndex: route.stripIndex
    });
    row.strips.add(route.stripIndex);
    universeMap.set(universe, row);
  });

  const universes = [...universeMap.values()].sort((a, b) => a.universe - b.universe);
  universes.forEach((row) => {
    const slots = new Uint8Array(Math.max(1, row.capacity));
    row.ranges.forEach((range) => {
      if (range.rawEnd >= row.capacity) row.overfull = true;
      for (let i = Math.max(0, range.start); i <= Math.min(row.capacity - 1, range.end); i += 1) {
        if (slots[i]) row.overlaps += 1;
        slots[i] += 1;
      }
    });
    row.used = slots.reduce((sum, value) => sum + (value ? 1 : 0), 0);
    const firstUsed = slots.findIndex(Boolean);
    let lastUsed = -1;
    for (let i = slots.length - 1; i >= 0; i -= 1) {
      if (slots[i]) { lastUsed = i; break; }
    }
    if (firstUsed >= 0 && lastUsed >= firstUsed) {
      for (let i = firstUsed; i <= lastUsed; i += 1) if (!slots[i]) row.gaps += 1;
    }
    row.summary = row.ranges
      .sort((a, b) => a.start - b.start)
      .map((range) => `S${Number(range.stripIndex || 0) + 1}:${range.start}-${Math.min(row.capacity - 1, range.end)}`)
      .join(' | ');
  });

  return {
    routes,
    universes,
    invalid,
    overlaps: universes.reduce((sum, row) => sum + row.overlaps, 0),
    gaps: universes.reduce((sum, row) => sum + row.gaps, 0),
    overfull: universes.filter((row) => row.overfull).length
  };
}


function readStoredObject37CR(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '{}');
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
}

function analyzeGlobalOutputCorrections37CR() {
  const settings = readStoredObject37CR(SETTINGS_STORAGE_KEY_37CR);
  const perfState = readStoredObject37CR(PERFORMANCE_STATE_STORAGE_KEY_37CR);
  const master = clampNum(perfState.master, 0, 1, 1);
  const brightnessLimit = clampNum(settings.brightnessLimit, 0, 1, 1);
  const gamma = clampNum(settings.gamma, 0.1, 5, 2.2);
  const contrast = clampNum(settings.contrast, 0, 3, 1.35);
  const l1Master = clampNum(perfState?.l1?.master, 0, 1, 1);
  const l2Master = clampNum(perfState?.l2?.master, 0, 1, 1);
  const effectiveGain = master * brightnessLimit;
  const nonNeutral = [];
  if (Math.abs(master - 1) > 0.0001) nonNeutral.push(`MASTER ${master.toFixed(2)}`);
  if (Math.abs(brightnessLimit - 1) > 0.0001) nonNeutral.push(`LIMIT ${brightnessLimit.toFixed(2)}`);
  if (Math.abs(gamma - 1) > 0.0001) nonNeutral.push(`GAMMA ${gamma.toFixed(2)}`);
  if (Math.abs(contrast - 1) > 0.0001) nonNeutral.push(`CONTRAST ${contrast.toFixed(2)}`);
  if (Math.abs(l1Master - 1) > 0.0001) nonNeutral.push(`L1 MASTER ${l1Master.toFixed(2)}`);
  if (Math.abs(l2Master - 1) > 0.0001) nonNeutral.push(`L2 MASTER ${l2Master.toFixed(2)}`);
  return { master, brightnessLimit, gamma, contrast, l1Master, l2Master, effectiveGain, nonNeutral };
}

function buildGlobalOutputAuditHtml37CR() {
  const audit = analyzeGlobalOutputCorrections37CR();
  const status = audit.nonNeutral.length ? 'warn-line' : 'ok-line';
  const gammaNote = Math.abs(audit.gamma - 1) > 0.0001
    ? ' | gamma is global and changes the whole rendered master frame before mapping'
    : '';
  const contrastNote = Math.abs(audit.contrast - 1) > 0.0001
    ? ' | contrast is global in CPU/color helpers and can change perceived punch before output'
    : '';
  const detail = [
    `master ${audit.master.toFixed(2)}`,
    `limit ${audit.brightnessLimit.toFixed(2)}`,
    `gain ${audit.effectiveGain.toFixed(2)}`,
    `gamma ${audit.gamma.toFixed(2)}`,
    `contrast ${audit.contrast.toFixed(2)}`,
    `L1 ${audit.l1Master.toFixed(2)}`,
    `L2 ${audit.l2Master.toFixed(2)}`
  ].join(' | ');
  const warning = audit.nonNeutral.length
    ? `<div><strong class="warn-line">Global correction active:</strong> ${escapeHtml(audit.nonNeutral.join(' / '))}${gammaNote}${contrastNote}</div>`
    : '<div>global output correction neutral: master/limit/gamma/contrast/layer masters = 1</div>';
  return `<div class="route-row"><strong class="${status}">Global output audit</strong><div>${escapeHtml(detail)}</div>${warning}<div>Note: global correction affects all strips equally. If only first 8 are weaker than last 2, suspect mixed output path, slot/source mismatch, or per-strip correction.</div></div>`;
}

function analyzeStripCorrections(compiled) {
  const segments = Array.isArray(compiled?.segments) ? compiled.segments : [];
  const rows = segments.map((segment, index) => {
    const c = segment?.correction || {};
    const brightness = clampNum(c.brightness, 0, 1, 1);
    const gamma = clampNum(c.gamma, 0.1, 5, 1);
    const contrast = clampNum(c.contrast ?? 1, 0, 3, 1);
    const whiteLimit = clampNum(c.whiteLimit, 0, 1, 1);
    const gain = brightness * whiteLimit;
    const neutral = Math.abs(brightness - 1) < 0.0001 && Math.abs(gamma - 1) < 0.0001 && Math.abs(contrast - 1) < 0.0001 && Math.abs(whiteLimit - 1) < 0.0001;
    return {
      index,
      label: String(segment?.label || `STRIP ${index + 1}`),
      enabled: segment?.enabled !== false,
      brightness,
      gamma,
      contrast,
      whiteLimit,
      gain,
      neutral
    };
  });
  const enabled = rows.filter((row) => row.enabled);
  const nonNeutral = enabled.filter((row) => !row.neutral);
  const firstEight = enabled.filter((row) => row.index < 8);
  const afterEight = enabled.filter((row) => row.index >= 8);
  const avg = (list, key) => list.length ? list.reduce((sum, row) => sum + Number(row[key] || 0), 0) / list.length : null;
  const firstEightGain = avg(firstEight, 'gain');
  const afterEightGain = avg(afterEight, 'gain');
  const suspectedFirstEightDim = firstEight.length && afterEight.length && firstEightGain !== null && afterEightGain !== null && firstEightGain < afterEightGain - 0.05;
  return { rows, enabled, nonNeutral, firstEight, afterEight, firstEightGain, afterEightGain, suspectedFirstEightDim };
}

function buildCorrectionAuditHtml(compiled) {
  const audit = analyzeStripCorrections(compiled);
  if (!audit.rows.length) return '';
  const status = audit.nonNeutral.length ? 'warn-line' : 'ok-line';
  const firstEightText = audit.firstEightGain == null ? '-' : audit.firstEightGain.toFixed(2);
  const afterEightText = audit.afterEightGain == null ? '-' : audit.afterEightGain.toFixed(2);
  const dimNote = audit.suspectedFirstEightDim
    ? `<div><strong class="warn-line">Possible dim group:</strong> avg gain first 8 = ${firstEightText}, after 8 = ${afterEightText}</div>`
    : `<div>avg gain first 8 = ${firstEightText} | after 8 = ${afterEightText}</div>`;
  const changed = audit.nonNeutral
    .slice(0, 12)
    .map((row) => `S${row.index + 1}: I ${row.brightness.toFixed(2)} / G ${row.gamma.toFixed(2)} / C ${row.contrast.toFixed(2)} / W ${row.whiteLimit.toFixed(2)} / gain ${row.gain.toFixed(2)}`)
    .join(' | ');
  return `<div class="route-row"><strong class="${status}">Correction audit</strong><div>${audit.nonNeutral.length ? `${audit.nonNeutral.length} strip(s) not neutral` : 'all enabled strips neutral: intensity/gamma/contrast/white = 1'}</div>${dimNote}${changed ? `<div>${escapeHtml(changed)}</div>` : ''}</div>`;
}

function buildMappingHealthHtml(compiled, validation) {
  const artnet = analyzeArtNetOccupancy(compiled);
  const segments = Array.isArray(compiled?.segments) ? compiled.segments : [];
  const enabledSegments = segments.filter((segment) => segment.enabled !== false);
  const totalPixels = enabledSegments.reduce((sum, segment) => sum + Number(segment?.physical?.pixelCount || segment?.pixelCount || 0), 0);
  const statusOk = validation?.ok && !artnet.invalid && !artnet.overlaps && !artnet.gaps && !artnet.overfull;
  const rows = [
    `<div class="mapping-health-kpis">`,
    `<div class="mapping-health-kpi"><span>Strips</span><strong>${enabledSegments.length}/${segments.length}</strong></div>`,
    `<div class="mapping-health-kpi"><span>Pixels</span><strong>${totalPixels}</strong></div>`,
    `<div class="mapping-health-kpi"><span>Universes</span><strong>${artnet.universes.length}</strong></div>`,
    `<div class="mapping-health-kpi"><span>Route parts</span><strong>${artnet.routes.length}</strong></div>`,
    `</div>`,
    `<div class="route-row"><strong class="${statusOk ? 'ok-line' : 'warn-line'}">${statusOk ? 'OK | continuous Art-Net patch' : 'CHECK | patch needs attention'}</strong><div>overlaps ${artnet.overlaps} | gaps ${artnet.gaps} | invalid ${artnet.invalid} | overfull ${artnet.overfull}</div></div>`,
    buildCorrectionAuditHtml(compiled),
    buildGlobalOutputAuditHtml37CR()
  ];
  if (!artnet.routes.length) rows.push('<div class="route-row"><strong class="warn-line">No Art-Net routes</strong><div>Assign output=artnet or use Auto Route Active.</div></div>');
  return rows.join('');
}

function buildUniverseHeatmapHtml(compiled) {
  const artnet = analyzeArtNetOccupancy(compiled);
  if (!artnet.universes.length) return '<div class="route-row"><strong>No Art-Net universes</strong><div>Auto-route strips to Art-Net first.</div></div>';
  const rows = artnet.universes.slice(0, 64).map((row) => {
    const fill = Math.max(0, Math.min(100, (row.used / Math.max(1, row.capacity)) * 100));
    const stateClass = row.overfull || row.overlaps ? 'overfull' : '';
    const label = row.gaps ? `${row.used}/${row.capacity}px · ${row.gaps} gaps` : `${row.used}/${row.capacity}px`;
    return `<div class="universe-heat-row"><strong>U${row.universe}</strong><div class="universe-heat-bar" title="${escapeHtml(row.summary)}"><span class="universe-heat-fill ${stateClass}" style="--fill:${fill.toFixed(1)}%"></span></div><span>${escapeHtml(label)}</span></div>`;
  });
  if (artnet.universes.length > 64) rows.push(`<div class="route-row"><strong>+ ${artnet.universes.length - 64} universes hidden</strong><div>Heatmap is capped to keep the UI light.</div></div>`);
  return `<div class="universe-heatmap">${rows.join('')}</div>`;
}

async function publishArtNetPatch(patch, source = 'mapping-step37a') {
  return fetchJson('/api/artnet/master-mirror/patch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...patch,
      patchSource: patch.patchSource || 'mapping-v2-canonical',
      source,
      artnetPatch: patch,
      patch
    })
  });
}

async function refreshServerPatchReport(message = '') {
  if (!els.artnetReportBox) return null;
  const data = await fetchJson('/api/artnet/master-mirror/patch-report');
  const patch = data?.patch || null;
  const report = data?.report || null;
  els.artnetReportBox.innerHTML = buildServerPatchReportHtml(patch, report, message);
  return data;
}

function renderServerPatchError(error) {
  if (!els.artnetReportBox) return;
  const compiled = getCompiledMapping();
  els.artnetReportBox.innerHTML = [
    `<div class="route-row"><strong class="error-line">SERVER PATCH ERROR</strong><div>${escapeHtml(error?.message || String(error || 'unknown error'))}</div></div>`,
    buildArtNetReportHtml(compiled)
  ].join('');
}

function buildServerPatchReportHtml(patch, report, message = '') {
  if (!patch) {
    return `<div class="route-row"><strong class="warn-line">SERVER HAS NO PATCH</strong><div>${escapeHtml(message || 'Save + Apply Patch has not reached master mirror yet.')}</div></div>`;
  }
  const routeCount = Number(report?.routeCount || (Array.isArray(report?.routes) ? report.routes.length : 0));
  const universes = Array.isArray(report?.universes) ? report.universes : [];
  const problems = Array.isArray(report?.problems) ? report.problems : [];
  const rows = [
    `<div class="route-row"><strong class="ok-line">SERVER PATCH ACTIVE</strong><div>${escapeHtml(message || patch.source || 'active')}</div><div>${Number(patch.width || 0)}×${Number(patch.height || 0)} | ${Number(patch.totalPixels || 0)} px | ${routeCount} route parts | ${universes.length} universes</div></div>`
  ];
  if (patch.publishedAt) rows.push(`<div class="route-row"><strong>PUBLISHED</strong><div>${escapeHtml(String(patch.publishedAt))}</div></div>`);
  problems.slice(0, 12).forEach((problem) => rows.push(`<div class="route-row"><strong class="error-line">Problem</strong><div>${escapeHtml(typeof problem === 'string' ? problem : JSON.stringify(problem))}</div></div>`));
  universes.slice(0, 24).forEach((uni) => rows.push(`<div class="route-row"><strong>${escapeHtml(String(uni.target || 'default'))}:${escapeHtml(String(uni.targetPort || 6454))} · U${escapeHtml(String(uni.universe ?? '?'))}</strong><div>${escapeHtml(String(uni.pixels ?? uni.pixelCount ?? '?'))} px</div><div>${escapeHtml(String(uni.ranges || uni.summary || ''))}</div></div>`));
  return rows.join('');
}

function drawPreview() {
  const canvas = els.canvas;
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  const width = Math.max(320, Math.floor(rect.width * dpr));
  const height = Math.max(180, Math.floor(rect.height * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#020406';
  ctx.fillRect(0, 0, width, height);
  state.canvasItems = [];

  const segments = state.mapping.segments;
  const maxPixels = Math.max(1, ...segments.map((s) => s.physical.pixelCount || 1));
  const pad = 18 * dpr;
  const rowGap = 8 * dpr;
  const rowH = Math.max(26 * dpr, Math.min(44 * dpr, (height - pad * 2 - rowGap * Math.max(0, segments.length - 1)) / Math.max(1, segments.length)));
  const labelW = 148 * dpr;
  const barW = Math.max(1, width - pad * 2 - labelW - 12 * dpr);

  ctx.font = `${Math.max(10, 12 * dpr)}px ui-sans-serif`;
  segments.forEach((segment, index) => {
    const y = pad + index * (rowH + rowGap);
    if (y > height - pad) return;
    const selected = segment.id === state.selectedId;
    const x = pad;
    const barX = x + labelW;
    const w = Math.max(2 * dpr, (segment.physical.pixelCount / maxPixels) * barW);
    const color = previewStripColor(segment, index);
    const routeParts = buildPreviewRouteParts(segment);

    ctx.fillStyle = selected ? 'rgba(43,140,255,.22)' : 'rgba(255,255,255,.035)';
    roundRect(ctx, x, y, width - pad * 2, rowH, 8 * dpr);
    ctx.fill();

    ctx.fillStyle = segment.enabled ? '#eff6ff' : 'rgba(239,246,255,.38)';
    ctx.fillText(`${index + 1}. ${segment.label}`, x + 8 * dpr, y + rowH * 0.45);
    ctx.fillStyle = 'rgba(239,246,255,.66)';
    ctx.fillText(`${segment.physical.pixelCount}px | ${String(segment.physical.output || 'none').toUpperCase()} | ${routeParts.length} part${routeParts.length === 1 ? '' : 's'}`, x + 8 * dpr, y + rowH * 0.78);

    ctx.fillStyle = segment.enabled ? color : 'rgba(120,120,120,.20)';
    roundRect(ctx, barX, y + 6 * dpr, w, rowH - 12 * dpr, 7 * dpr);
    ctx.fill();

    routeParts.forEach((part, partIndex) => {
      const partX = barX + (part.pixelStart / Math.max(1, segment.physical.pixelCount)) * w;
      const partW = Math.max(2 * dpr, (part.pixelCount / Math.max(1, segment.physical.pixelCount)) * w);
      ctx.fillStyle = partIndex % 2 === 0 ? 'rgba(255,255,255,.10)' : 'rgba(0,0,0,.14)';
      roundRect(ctx, partX, y + 8 * dpr, partW, rowH - 16 * dpr, 4 * dpr);
      ctx.fill();
      if (partIndex > 0) {
        ctx.strokeStyle = 'rgba(255,255,255,.38)';
        ctx.lineWidth = Math.max(1, dpr);
        ctx.beginPath();
        ctx.moveTo(partX, y + 7 * dpr);
        ctx.lineTo(partX, y + rowH - 7 * dpr);
        ctx.stroke();
      }
      if (partW > 60 * dpr) {
        ctx.fillStyle = '#eff6ff';
        ctx.fillText(`P${partIndex + 1} U${part.universe} ${part.pixelCount}px`, partX + 6 * dpr, y + rowH * 0.64);
      }
    });

    ctx.strokeStyle = selected ? '#7ef0c2' : 'rgba(255,255,255,.12)';
    ctx.lineWidth = selected ? 2 * dpr : 1 * dpr;
    roundRect(ctx, x, y, width - pad * 2, rowH, 8 * dpr);
    ctx.stroke();

    state.canvasItems.push({ id: segment.id, x, y, w: width - pad * 2, h: rowH });
  });
}

function selectSegmentFromCanvas(event) {
  const rect = els.canvas.getBoundingClientRect();
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  const x = (event.clientX - rect.left) * dpr;
  const y = (event.clientY - rect.top) * dpr;
  const hit = state.canvasItems.find((item) => x >= item.x && x <= item.x + item.w && y >= item.y && y <= item.y + item.h);
  if (hit) selectSegment(hit.id);
}

function selectedSegment() {
  return state.mapping.segments.find((s) => s.id === state.selectedId) || null;
}

function selectedIndex() {
  return state.mapping.segments.findIndex((s) => s.id === state.selectedId);
}

function applyStripCount() {
  const targetCount = clampInt(els.stripCount.value, 1, 256, state.mapping.segments.length || 8);
  const defaultPixels = clampInt(els.defaultPixels.value, 1, 20000, selectedSegment()?.physical?.pixelCount || 300);
  let segments = state.mapping.segments.slice(0, targetCount);
  while (segments.length < targetCount) {
    const prev = segments.at(-1) || createDefaultMappingV2({ count: 1, pixelsPerStrip: defaultPixels }).segments[0];
    segments.push(createStripFromBase(prev, segments.length, defaultPixels));
  }
  state.mapping = normalizeMappingV2({
    ...state.mapping,
    virtual: { ...state.mapping.virtual, width: Math.max(defaultPixels, ...segments.map((s) => s.physical.pixelCount)), height: targetCount },
    segments
  });
  if (!state.mapping.segments.some((s) => s.id === state.selectedId)) state.selectedId = state.mapping.segments[0]?.id || null;
  markDirty();
  scheduleRenderAll37BP("deferred-render-all");
}

function createStripFromBase(base, index, pixels) {
  const start = state.mapping.segments.slice(0, index).reduce((sum, s) => sum + (s.physical?.pixelCount || 0), 0);
  return normalizeSegmentDeep({
    ...structuredCloneSafe(base),
    id: uniqueId(`strip_${index + 1}`),
    label: `STRIP ${index + 1}`,
    enabled: true,
    source: { x: 0, y: index, width: pixels, height: 1 },
    physical: { ...base.physical, startAddress: start, pixelStart: 0, pixelCount: pixels, routeSegments: [] },
    correction: { brightness: 1, gamma: 1, contrast: 1, whiteLimit: 1 },
    tags: []
  });
}

function addSegment() {
  const base = selectedSegment() || state.mapping.segments.at(-1) || createDefaultMappingV2({ count: 1, pixelsPerStrip: 300 }).segments[0];
  const pixels = clampInt(els.defaultPixels.value, 1, 20000, base.physical.pixelCount || 300);
  const next = createStripFromBase(base, state.mapping.segments.length, pixels);
  state.mapping = normalizeMappingV2({ ...state.mapping, segments: [...state.mapping.segments, next] });
  state.selectedId = next.id;
  markDirty();
  scheduleRenderAll37BP("deferred-render-all");
}

function duplicateSelectedSegment() {
  const segment = selectedSegment();
  if (!segment) return addSegment();
  const index = selectedIndex();
  const next = normalizeSegmentDeep({
    ...structuredCloneSafe(segment),
    id: uniqueId(`${segment.id}_copy`),
    label: `${segment.label} copy`,
    source: { ...segment.source, y: index + 1 },
    physical: { ...segment.physical, startAddress: segment.physical.startAddress + segment.physical.pixelCount }
  });
  const segments = [...state.mapping.segments];
  segments.splice(index + 1, 0, next);
  state.mapping = normalizeMappingV2({ ...state.mapping, segments });
  state.selectedId = next.id;
  markDirty();
  scheduleRenderAll37BP("deferred-render-all");
}

function removeSelectedSegment() {
  if (state.mapping.segments.length <= 1) return;
  const index = selectedIndex();
  if (index < 0) return;
  const segments = state.mapping.segments.filter((_, i) => i !== index);
  state.mapping = normalizeMappingV2({ ...state.mapping, segments });
  state.selectedId = segments[Math.min(index, segments.length - 1)]?.id || null;
  markDirty();
  scheduleRenderAll37BP("deferred-render-all");
}

function renumberSegments() {
  const segments = state.mapping.segments.map((s, i) => ({ ...s, id: `strip_${i + 1}`, label: `STRIP ${i + 1}`, source: { ...s.source, y: i } }));
  state.mapping = normalizeMappingV2({ ...state.mapping, segments });
  state.selectedId = segments[Math.min(Math.max(0, selectedIndex()), segments.length - 1)]?.id || segments[0]?.id || null;
  markDirty();
  scheduleRenderAll37BP("deferred-render-all");
}



function resetGlobalOutputCorrections() {
  const settings = readStoredObject37CR(SETTINGS_STORAGE_KEY_37CR);
  localStorage.setItem(SETTINGS_STORAGE_KEY_37CR, JSON.stringify({
    ...settings,
    gamma: 1,
    contrast: 1,
    brightnessLimit: 1
  }));
  const perfState = readStoredObject37CR(PERFORMANCE_STATE_STORAGE_KEY_37CR);
  const nextState = {
    ...perfState,
    master: 1,
    l1: { ...(perfState.l1 || {}), master: 1 },
    l2: { ...(perfState.l2 || {}), master: 1 }
  };
  localStorage.setItem(PERFORMANCE_STATE_STORAGE_KEY_37CR, JSON.stringify(nextState));
  renderDiagnostics();
  setStatus('Global master/gamma/contrast reset to neutral. Reload Performance page or switch away/back to re-read stored settings.');
}

function resetAllStripCorrections() {
  const segments = state.mapping.segments.map((s) => ({
    ...s,
    correction: { brightness: 1, gamma: 1, contrast: 1, whiteLimit: 1 }
  }));
  state.mapping = normalizeMappingV2({ ...state.mapping, segments });
  markDirty();
  renderSegmentList();
  renderSegmentEditor();
  renderDiagnostics();
  drawPreview();
  scheduleLivePatchApply('reset-all-strip-corrections', 30);
}

function normalizeAddresses() {
  let address = 0;
  const segments = state.mapping.segments.map((s) => {
    const next = { ...s, physical: { ...s.physical, startAddress: address } };
    address += s.physical.pixelCount;
    return next;
  });
  state.mapping = normalizeMappingV2({ ...state.mapping, segments });
  markDirty();
  scheduleRenderAll37BP("deferred-render-all");
}


function protocolCapacity(output, requested) {
  const id = String(output || 'none').toLowerCase();
  const fallback = (id === 'artnet' || id === 'sacn' || id === 'dmx') ? 170 : 4096;
  const value = clampInt(requested, 1, 4096, fallback);
  return (id === 'artnet' || id === 'sacn' || id === 'dmx') ? Math.max(1, Math.min(170, value)) : value;
}

function nextRouteCursorForStrip({ universe, address, pixelCount, universeSize }) {
  const capacity = Math.max(1, Number(universeSize || 170));
  const used = Math.max(0, Number(address || 0)) + Math.max(0, Number(pixelCount || 0));
  return {
    universe: Math.max(0, Number(universe || 0)) + Math.floor(used / capacity),
    address: used % capacity
  };
}

function normalizeArtNetRouteCursor({ universe, address, universeSize }) {
  const capacity = Math.max(1, Math.min(170, Number(universeSize || 170)));
  const rawAddress = Math.max(0, Number(address || 0));
  return {
    universe: Math.max(0, Number(universe || 0)) + Math.floor(rawAddress / capacity),
    address: rawAddress % capacity,
    capacity
  };
}

function buildAutoRouteSegments({ output, startUniverse, startAddress, pixelCount, universeSize }) {
  const routedOutput = String(output || 'none').toLowerCase();
  if (!['artnet', 'sacn', 'dmx'].includes(routedOutput)) return [];
  const parts = [];
  const cursor = normalizeArtNetRouteCursor({ universe: startUniverse, address: startAddress, universeSize });
  const capacity = cursor.capacity;
  let remaining = Math.max(1, Number(pixelCount || 1));
  let pixelStart = 0;
  let universe = cursor.universe;
  let address = cursor.address;
  while (remaining > 0) {
    const available = Math.max(1, capacity - address);
    const take = Math.min(remaining, available);
    parts.push({
      universe,
      startAddress: address,
      pixelStart,
      pixelCount: take
    });
    remaining -= take;
    pixelStart += take;
    universe += 1;
    address = 0;
  }
  return parts;
}

function autoRouteActiveSegments() {
  const output = els.bulkOutput.value || 'none';
  const requestedUniverseSize = Math.max(1, clampInt(els.bulkUniverseSize.value, 1, 4096, 170));
  const universeSize = protocolCapacity(output, requestedUniverseSize);
  let universe = Math.max(0, clampInt(els.bulkUniverse.value, 0, 63999, 0));
  let address = 0;
  const segments = state.mapping.segments.map((s) => {
    if (!s.enabled) return s;
    // STEP22MG: continuous ArtNet packing. Do NOT align every physical strip
    // to a fresh universe. WLED/ArtNet receivers consume universes as one
    // continuous pixel stream, so the next strip may start at A130, A90, etc.
    // This removes dead starts and spillover caused by 130px holes.
    const next = {
      ...s,
      physical: {
        ...s.physical,
        output,
        universe,
        startAddress: address,
        universeSize,
        routeSegments: buildAutoRouteSegments({
          output,
          startUniverse: universe,
          startAddress: address,
          pixelCount: s.physical.pixelCount,
          universeSize
        })
      }
    };
    const cursor = nextRouteCursorForStrip({ universe, address, pixelCount: s.physical.pixelCount, universeSize });
    universe = cursor.universe;
    address = cursor.address;
    return next;
  });
  state.mapping = normalizeMappingV2({ ...state.mapping, segments });
  markDirty();
  scheduleRenderAll37BP("deferred-render-all");
}

function loadPreset(name) {
  if (name === 'current') return;
  state.mapping = normalizeMappingV2(createMappingPreset(name));
  state.selectedId = state.mapping.segments[0]?.id || null;
  markDirty();
  scheduleRenderAll37BP("deferred-render-all");
}

async function saveAndApply() {
  state.mapping = normalizeMappingV2(state.mapping);
  saveMappingV2(state.mapping, localStorage);
  localStorage.setItem(LEGACY_MAPPING_STORAGE_KEY, JSON.stringify(mappingV2ToLegacyExport(state.mapping)));
  state.dirty = false;
  renderDiagnostics();
  const patch = getArtNetPatch();
  localStorage.setItem(ARTNET_MASTER_PATCH_STORAGE_KEY, JSON.stringify({ ...patch, savedAt: Date.now(), savedBy: 'mapping-screen-step37e-strip-tests-disable-blackout' }));
  try {
    await publishArtNetPatch(patch, 'mapping-save-apply-step37e-strip-tests-disable-blackout');
    await refreshServerPatchReport('server patch applied');
    flashStatus('SAVED + PATCH APPLIED');
  } catch (error) {
    flashStatus('SAVED | PATCH APPLY FAILED');
    renderServerPatchError(error);
  }
}

function scheduleLivePatchApply(source = 'mapping-live-edit', delayMs = 180) {
  if (state.livePatchTimer) clearManagedTimer37CF(state.livePatchTimer);
  state.livePatchTimer = managedTimeout37CF('mapping:live-patch-apply', () => {
    state.livePatchTimer = null;
    applyLivePatchNow(source);
  }, Math.max(20, Number(delayMs) || 180), { liveFactor: 1.2, hiddenFactor: 2, maxMs: 1000 });
}

async function applyLivePatchNow(source = 'mapping-live-edit') {
  if (state.livePatchBusy) {
    state.livePatchQueued = true;
    return;
  }
  state.livePatchBusy = true;
  try {
    state.mapping = normalizeMappingV2(state.mapping);
    const patch = getArtNetPatch();
    localStorage.setItem(ARTNET_MASTER_PATCH_STORAGE_KEY, JSON.stringify({ ...patch, savedAt: Date.now(), savedBy: source, unsavedLiveEdit: state.dirty }));
    await publishArtNetPatch(patch, `mapping-${source}-step37m-live-strip-controls`);
    await refreshServerPatchReport(state.dirty ? 'live patch applied | unsaved changes' : 'live patch applied');
  } catch (error) {
    renderServerPatchError(error);
  } finally {
    state.livePatchBusy = false;
    if (state.livePatchQueued) {
      state.livePatchQueued = false;
      scheduleLivePatchApply(`${source}-queued`, 60);
    }
  }
}

function exportMapping() {
  els.jsonBox.value = JSON.stringify(exportMappingV2Document(state.mapping), null, 2);
  flashStatus('EXPORTED TO TEXTAREA');
}

function importMapping() {
  try {
    const imported = parseMappingV2Document(els.jsonBox.value);
    state.mapping = normalizeMappingV2(imported);
    state.selectedId = state.mapping.segments[0]?.id || null;
    markDirty();
    scheduleRenderAll37BP("deferred-render-all");
    flashStatus('IMPORTED');
  } catch (error) {
    flashStatus('IMPORT ERROR');
    els.validationBox.innerHTML = `<div class="error-line">Import error: ${escapeHtml(error.message)}</div>`;
  }
}

function selectSegment(id) {
  if (Number.isInteger(id)) id = state.mapping.segments[id]?.id;
  if (!state.mapping.segments.some((s) => s.id === id)) return;
  state.selectedId = id;
  renderSegmentList();
  renderSegmentEditor();
  drawPreview();
}

function normalizeSegmentDeep(segment) {
  return normalizeMappingV2({ ...state.mapping, segments: [segment] }).segments[0];
}

function markDirty() {
  state.dirty = true;
  invalidateMappingCache();
}

function invalidateMappingCache() {
  state.cache.mappingKey = '';
  state.cache.compiled = null;
  state.cache.validation = null;
  state.cache.artnetPatch = null;
}

function mappingCacheKey() {
  try {
    return JSON.stringify(state.mapping);
  } catch {
    return `${Date.now()}:${Math.random()}`;
  }
}

function ensureMappingCache() {
  const key = mappingCacheKey();
  if (state.cache.mappingKey !== key) {
    state.cache.mappingKey = key;
    state.cache.compiled = null;
    state.cache.validation = null;
    state.cache.artnetPatch = null;
  }
}

function getCompiledMapping() {
  ensureMappingCache();
  if (!state.cache.compiled) state.cache.compiled = compileMappingV2(state.mapping);
  return state.cache.compiled;
}

function getMappingValidation() {
  ensureMappingCache();
  if (!state.cache.validation) state.cache.validation = validateMappingV2(state.mapping);
  return state.cache.validation;
}

function getArtNetPatch() {
  ensureMappingCache();
  if (!state.cache.artnetPatch) {
    state.cache.artnetPatch = compileArtNetPatchFromMappingV2(state.mapping, {
      width: state.mapping.virtual.width,
      height: state.mapping.virtual.height
    });
  }
  return state.cache.artnetPatch;
}
function flashStatus(text) { els.status.textContent = text; managedTimeout37CF('mapping:flash-status-render', renderDiagnostics, 900, { maxMs: 1800 }); }
function value(id, fallback = '') { return document.getElementById(id)?.value ?? fallback; }
function bool(id) { return Boolean(document.getElementById(id)?.checked); }
function clampInt(value, min, max, fallback) { const n = Number.parseInt(value, 10); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback; }
function clampNum(value, min, max, fallback) { const n = Number.parseFloat(value); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback; }
function formatNum(value) { return Number(value ?? 0).toFixed(2).replace(/\.00$/, ''); }

function uniqueId(base, keep = null) {
  const safeBase = String(base || 'strip').replace(/[^a-zA-Z0-9_-]+/g, '_') || 'strip';
  const ids = new Set(state.mapping.segments.map((s) => s.id).filter((id) => id !== keep));
  if (!ids.has(safeBase)) return safeBase;
  let i = 2;
  while (ids.has(`${safeBase}_${i}`)) i += 1;
  return `${safeBase}_${i}`;
}

function field(id, label, type, value, extraClass = '', min = null, max = null, step = null) {
  const attrs = [
    `id="${id}"`,
    `type="${type}"`,
    `value="${escapeHtml(String(value ?? ''))}"`,
    type === 'text' ? 'autocomplete="off" spellcheck="false"' : '',
    min !== null ? `min="${min}"` : '',
    max !== null ? `max="${max}"` : '',
    step !== null ? `step="${step}"` : ''
  ].filter(Boolean).join(' ');
  return `<label class="field ${extraClass}"><span>${escapeHtml(label)}</span><input ${attrs}></label>`;
}

function options(list, selected) {
  return list.map((item) => `<option value="${escapeHtml(item)}" ${String(item) === String(selected) ? 'selected' : ''}>${escapeHtml(item)}</option>`).join('');
}

function formatRouteSegments(physical = {}) {
  const parts = Array.isArray(physical?.routeSegments) ? physical.routeSegments : [];
  if (!parts.length) return '';
  return parts.map((part) => `U${part.universe}:${part.startAddress}:${part.pixelCount}`).join(' | ');
}

function parseRouteSegments(text, physical = {}) {
  const raw = String(text || '').trim();
  if (!raw) return [];
  const baseUniverse = clampInt(physical?.universe, 0, 63999, 0);
  const totalPixels = clampInt(physical?.pixelCount, 1, 65535, 1);
  const universeSize = clampInt(physical?.universeSize, 1, 4096, 170);
  const isSimpleCommaList = /^[\d\s,]+$/.test(raw);
  const tokens = (isSimpleCommaList ? raw.split(',') : raw.split(/[|;]/)).map((item) => item.trim()).filter(Boolean);
  let nextUniverse = baseUniverse;
  let nextPixelStart = 0;
  const parts = [];
  for (const token of tokens) {
    const explicit = token.match(/^U?(\d+)\s*[:@,]\s*(\d+)\s*[:+x,]\s*(\d+)$/i);
    if (explicit) {
      const universe = clampInt(explicit[1], 0, 63999, nextUniverse);
      const cursor = normalizeArtNetRouteCursor({ universe, address: explicit[2], universeSize });
      const startAddress = cursor.address;
      const pixelCount = clampInt(explicit[3], 1, Math.max(1, cursor.capacity - startAddress), 1);
      parts.push({ universe: cursor.universe, startAddress, pixelStart: nextPixelStart, pixelCount });
      nextPixelStart += pixelCount;
      nextUniverse = cursor.universe + 1;
      continue;
    }
    const pixelCount = clampInt(token, 1, 65535, 0);
    if (pixelCount > 0) {
      parts.push({ universe: nextUniverse, startAddress: 0, pixelStart: nextPixelStart, pixelCount });
      nextPixelStart += pixelCount;
      nextUniverse += Math.max(1, Math.ceil(pixelCount / Math.max(1, universeSize)));
    }
  }
  if (!parts.length) return [];
  const usedPixels = parts.reduce((sum, part) => sum + part.pixelCount, 0);
  if (usedPixels !== totalPixels) {
    const last = parts[parts.length - 1];
    last.pixelCount = Math.max(1, last.pixelCount + (totalPixels - usedPixels));
  }
  return parts;
}

function buildPreviewRouteParts(segment) {
  const physical = segment?.physical || {};
  const explicit = Array.isArray(physical.routeSegments) ? physical.routeSegments : [];
  if (explicit.length) return explicit;
  const total = clampInt(physical.pixelCount, 1, 65535, 1);
  const chunk = clampInt(physical.universeSize, 1, 4096, 170);
  const parts = [];
  let offset = 0;
  const cursor = normalizeArtNetRouteCursor({ universe: physical.universe, address: physical.startAddress, universeSize: chunk });
  let universe = cursor.universe;
  let address = cursor.address;
  while (offset < total) {
    const available = Math.max(1, chunk - address);
    const take = Math.min(total - offset, available);
    parts.push({ universe, startAddress: address, pixelStart: offset, pixelCount: take });
    offset += take;
    universe += 1;
    address = 0;
  }
  return parts;
}

function currentProbeParts() {
  const segment = selectedSegment();
  return segment ? buildPreviewRouteParts(segment) : [];
}

function clampProbePartSelection() {
  const parts = currentProbeParts();
  const maxIndex = Math.max(0, parts.length - 1);
  state.selectedProbePartIndex = Math.max(0, Math.min(maxIndex, Number(state.selectedProbePartIndex || 0)));
}

function stepProbePart(delta) {
  const parts = currentProbeParts();
  if (!parts.length) return;
  const count = parts.length;
  state.selectedProbePartIndex = (((state.selectedProbePartIndex || 0) + delta) % count + count) % count;
  renderProbeStatus();
}

function renderProbeStatus(message = '') {
  if (!els.probeStatus) return;
  const segment = selectedSegment();
  if (!segment) {
    els.probeStatus.textContent = 'Select a strip, then flash full strip or current part.';
    return;
  }
  if (els.probeRgbObserved) els.probeRgbObserved.value = String(segment?.physical?.colorOrder || 'rgb').toLowerCase();
  const parts = currentProbeParts();
  const current = parts[state.selectedProbePartIndex] || null;
  const base = current
    ? `Strip ${segment.label} · part ${state.selectedProbePartIndex + 1}/${parts.length} · U${current.universe} A${current.startAddress} ${current.pixelCount}px`
    : `Strip ${segment.label} · full ${segment.physical.pixelCount}px`;
  els.probeStatus.textContent = message ? `${base} · ${message}` : base;
}

async function sendProbeFrame(kind = 'part') {
  const segment = selectedSegment();
  if (!segment) return renderProbeStatus('no strip selected');
  const mapping = normalizeMappingV2(state.mapping);
  const patch = getArtNetPatch();
  const totalPixels = Math.max(1, Number(mapping.virtual.width || 1) * Number(mapping.virtual.height || 1));
  const rgb = new Array(totalPixels * 3).fill(0);
  const parts = currentProbeParts();
  const fullStripKinds = new Set(['strip', 'direction', 'rgb-order', 'start', 'middle', 'end', 'boundaries', 'quarters', 'every10']);
  const targets = fullStripKinds.has(kind) ? parts : [parts[state.selectedProbePartIndex]].filter(Boolean);
  const stripColor = probeStripColor(selectedIndex());
  paintProbeTargets({ rgb, width: mapping.virtual.width, stripIndex: selectedIndex(), targets, stripColor, kind, direction: segment?.physical?.direction || 'forward' });
  try {
    await publishArtNetPatch(patch, `mapping-probe-patch-${kind}-step37e`);
    await refreshServerPatchReport(`probe patch active: ${kind}`);
    const liveConfig = await fetchJson('/api/artnet/live-config');
    const cfg = liveConfig?.config || {};
    const payload = {
      outputIp: cfg.outputIp || '2.1.1.30',
      host: cfg.outputIp || '2.1.1.30',
      port: Number(cfg.port || 6454),
      startUniverse: Number(cfg.universeStart || 0),
      fps: Number(cfg.fps || 30),
      stripCount: Number(cfg.stripCount || mapping.virtual.height || 8),
      pixelsPerStrip: Number(cfg.pixelsPerStrip || mapping.virtual.width || 300),
      pixelsPerUniverse: Number(cfg.pixelsPerUniverse || 170),
      targetMode: cfg.targetMode || 'unicast',
      bindIp: cfg.bindIp || '',
      rgb,
      frame: rgb,
      artnetPatch: patch,
      source: `mapping-probe-${kind}-step37e`,
      visualPattern: 'explicit-frame',
      sourceMode: 'explicit-frame',
      mode: 'udp-armed',
      armed: true,
      artSyncMode: 'off'
    };
    publishMappingCommand37BL('mapping-test', { kind, stripIndex: selectedIndex(), partIndex: state.selectedProbePartIndex }, `mapping-probe-${kind}`);
    await fetchJson('/api/artnet/sync-live/send-one', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const label = kind === 'strip'
      ? 'strip flashed'
      : (kind === 'part' ? 'part flashed' : (kind === 'direction' ? 'direction test sent' : (kind === 'rgb-order' ? 'rgb test sent' : `${kind} test sent`)));
    renderProbeStatus(label);
  } catch (error) {
    renderProbeStatus(`probe failed: ${error.message}`);
  }
}


function setSelectedStripEnabled(enabled) {
  const index = selectedIndex();
  const segment = selectedSegment();
  if (index < 0 || !segment) return renderProbeStatus('no strip selected');
  setStripEnabledAt(index, enabled);
  renderProbeStatus(enabled ? 'selected strip ON | press SAVE + APPLY PATCH' : 'selected strip OFF | will be black after SAVE + APPLY PATCH');
}

function setAllStripsEnabled(enabled) {
  const nextSegments = state.mapping.segments.map((segment) => ({ ...segment, enabled: Boolean(enabled) }));
  state.mapping = normalizeMappingV2({ ...state.mapping, segments: nextSegments });
  markDirty();
  scheduleRenderAll37BP("deferred-render-all");
  renderProbeStatus(enabled ? 'all strips ON | press SAVE + APPLY PATCH' : 'all strips OFF | output will blackout after SAVE + APPLY PATCH');
}

function setStripEnabledAt(index, enabled) {
  const nextSegments = state.mapping.segments.map((segment, itemIndex) => itemIndex === index ? { ...segment, enabled: Boolean(enabled) } : segment);
  state.mapping = normalizeMappingV2({ ...state.mapping, segments: nextSegments });
  markDirty();
  scheduleRenderAll37BP("deferred-render-all");
}

function applySelectedStripDirection(direction = 'forward') {
  const index = selectedIndex();
  const segment = selectedSegment();
  if (index < 0 || !segment) return renderProbeStatus('no strip selected');
  const nextDirection = String(direction || 'forward').toLowerCase() === 'reverse' ? 'reverse' : 'forward';
  const nextSegments = state.mapping.segments.map((item, itemIndex) => {
    if (itemIndex !== index) return item;
    return {
      ...item,
      physical: {
        ...item.physical,
        direction: nextDirection
      }
    };
  });
  state.mapping = normalizeMappingV2({ ...state.mapping, segments: nextSegments });
  markDirty();
  scheduleRenderAll37BP("deferred-render-all");
  scheduleLivePatchApply(`direction-${nextDirection}`, 30);
  renderProbeStatus(`direction ${nextDirection.toUpperCase()} applied live | SAVE keeps it for next launch`);
}

function applySelectedStripRgbOrder(order = 'rgb') {
  const index = selectedIndex();
  const segment = selectedSegment();
  if (index < 0 || !segment) return renderProbeStatus('no strip selected');
  const allowed = new Set(['rgb', 'grb', 'brg', 'rbg', 'bgr', 'gbr']);
  const nextOrder = allowed.has(String(order || '').toLowerCase()) ? String(order).toLowerCase() : 'rgb';
  const nextSegments = state.mapping.segments.map((item, itemIndex) => {
    if (itemIndex !== index) return item;
    return {
      ...item,
      physical: {
        ...item.physical,
        colorOrder: nextOrder.toUpperCase()
      }
    };
  });
  state.mapping = normalizeMappingV2({ ...state.mapping, segments: nextSegments });
  markDirty();
  scheduleRenderAll37BP("deferred-render-all");
  renderProbeStatus(`RGB order saved as ${nextOrder.toUpperCase()} | press SAVE + APPLY PATCH`);
}

async function blackoutProbeFrame() {
  try {
    publishMappingCommand37BL('mapping-test', { action: 'blackout' }, 'mapping-blackout');
    await fetchJson('/api/artnet/sync-live/blackout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    renderProbeStatus('blackout sent');
  } catch (error) {
    renderProbeStatus(`blackout failed: ${error.message}`);
  }
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, { cache: 'no-store', ...options });
  const text = await response.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!response.ok || data.ok === false) throw new Error(data.error || data.message || `${response.status} ${response.statusText}`);
  return data;
}

function probeStripColor(index) {
  const palette = [
    [255, 32, 32],
    [255, 160, 32],
    [255, 230, 32],
    [32, 255, 64],
    [32, 220, 255],
    [32, 96, 255],
    [180, 32, 255],
    [255, 32, 180]
  ];
  return palette[Math.max(0, index) % palette.length];
}

function paintProbeTargets({ rgb, width, stripIndex, targets, stripColor, kind, direction }) {
  const allParts = Array.isArray(targets) ? targets : [];
  if (kind === 'start' || kind === 'middle' || kind === 'end' || kind === 'quarters' || kind === 'every10' || kind === 'boundaries') {
    paintStripPatternProbe({ rgb, width, stripIndex, parts: allParts, stripColor, kind, direction });
    return;
  }
  for (const part of allParts) {
    if (kind === 'direction') paintDirectionProbe({ rgb, width, stripIndex, part, stripColor, direction });
    else if (kind === 'rgb-order') paintRgbOrderProbe({ rgb, width, stripIndex, part, direction });
    else paintSolidProbe({ rgb, width, stripIndex, part, stripColor });
  }
}

function paintStripPatternProbe({ rgb, width, stripIndex, parts, stripColor, kind, direction }) {
  const fullCount = parts.reduce((max, part) => Math.max(max, Number(part.pixelStart || 0) + Number(part.pixelCount || 0)), 0);
  if (!fullCount) return;
  const forward = String(direction || 'forward').toLowerCase() !== 'reverse';
  const setRange = (start, count, color) => {
    const safeStart = Math.max(0, Math.min(fullCount - 1, Math.floor(start)));
    const safeEnd = Math.max(safeStart, Math.min(fullCount - 1, safeStart + Math.max(1, Math.floor(count)) - 1));
    for (let px = safeStart; px <= safeEnd; px += 1) setProbePixel(rgb, width, stripIndex, px, color);
  };
  const setDot = (px, color) => setRange(px, 1, color);
  const logical = (px) => forward ? px : fullCount - 1 - px;
  const bright = stripColor;
  const white = [255, 255, 255];
  const red = [255, 0, 0];
  const green = [0, 255, 0];
  const blue = [0, 64, 255];
  const amber = [255, 180, 0];
  const magenta = [255, 0, 200];

  if (kind === 'start') {
    setRange(logical(0), 20, green);
    setDot(logical(0), white);
    return;
  }
  if (kind === 'end') {
    const start = Math.max(0, fullCount - 20);
    setRange(logical(start), 20, red);
    setDot(logical(fullCount - 1), white);
    return;
  }
  if (kind === 'middle') {
    setRange(Math.floor(fullCount / 2) - 10, 20, blue);
    setDot(Math.floor(fullCount / 2), white);
    return;
  }
  if (kind === 'quarters') {
    [0, 0.25, 0.5, 0.75, 1].forEach((ratio, index) => {
      const px = Math.round((fullCount - 1) * ratio);
      setRange(px - 2, 5, [index === 0 ? 255 : 0, index === 2 ? 255 : 180, index === 4 ? 255 : 0]);
    });
    return;
  }
  if (kind === 'every10') {
    for (let px = 0; px < fullCount; px += 10) setDot(px, px % 50 === 0 ? white : bright);
    return;
  }
  if (kind === 'boundaries') {
    for (const part of parts) {
      const start = Number(part.pixelStart || 0);
      const count = Number(part.pixelCount || 0);
      if (count <= 0) continue;
      setRange(start, Math.min(4, count), green);
      setRange(start + Math.max(0, count - 4), Math.min(4, count), red);
      setDot(start, white);
      setDot(start + count - 1, amber);
    }
    // make physical strip ends unmistakable
    setRange(0, Math.min(8, fullCount), magenta);
    setRange(Math.max(0, fullCount - 8), Math.min(8, fullCount), magenta);
  }
}

function paintSolidProbe({ rgb, width, stripIndex, part, stripColor }) {
  const start = Number(part.pixelStart || 0);
  const count = Number(part.pixelCount || 0);
  for (let i = 0; i < count; i += 1) {
    setProbePixel(rgb, width, stripIndex, start + i, stripColor);
  }
}

function paintDirectionProbe({ rgb, width, stripIndex, part, stripColor, direction }) {
  const start = Number(part.pixelStart || 0);
  const count = Number(part.pixelCount || 0);
  const forward = String(direction || 'forward').toLowerCase() !== 'reverse';
  const headColor = [255, 255, 255];
  const tailColor = stripColor;
  for (let i = 0; i < count; i += 1) {
    setProbePixel(rgb, width, stripIndex, start + i, [0, 0, 0]);
  }
  const anchor = forward ? start : start + count - 1;
  const second = forward ? Math.min(start + 1, start + count - 1) : Math.max(start, start + count - 2);
  const third = forward ? Math.min(start + 2, start + count - 1) : Math.max(start, start + count - 3);
  setProbePixel(rgb, width, stripIndex, anchor, headColor);
  setProbePixel(rgb, width, stripIndex, second, [255, 180, 0]);
  setProbePixel(rgb, width, stripIndex, third, [255, 80, 0]);
  for (let i = 0; i < Math.min(6, count); i += 1) {
    const pos = forward ? start + count - 1 - i : start + i;
    setProbePixel(rgb, width, stripIndex, pos, tailColor.map((v) => Math.max(12, Math.round(v * 0.45))));
  }
}

function paintRgbOrderProbe({ rgb, width, stripIndex, part, direction }) {
  const start = Number(part.pixelStart || 0);
  const count = Number(part.pixelCount || 0);
  const forward = String(direction || 'forward').toLowerCase() !== 'reverse';
  const colors = [
    [255, 0, 0],
    [0, 255, 0],
    [0, 0, 255]
  ];
  const chunk = Math.max(1, Math.floor(count / 3));
  for (let i = 0; i < count; i += 1) {
    const local = forward ? i : (count - 1 - i);
    const band = Math.min(2, Math.floor(local / chunk));
    setProbePixel(rgb, width, stripIndex, start + i, colors[band]);
  }
  setProbePixel(rgb, width, stripIndex, forward ? start : start + count - 1, [255, 255, 255]);
}

function setProbePixel(rgb, width, stripIndex, pixelInStrip, color) {
  const pixel = stripIndex * width + pixelInStrip;
  const o = pixel * 3;
  rgb[o] = color[0] || 0;
  rgb[o + 1] = color[1] || 0;
  rgb[o + 2] = color[2] || 0;
}


function previewStripColor(segment, index) {
  // Step 9W: keep all overview strips one neutral color for now.
  // Output-specific/test-pattern colors will be added later as explicit modes.
  return segment.enabled ? 'rgba(0,217,255,.78)' : 'rgba(120,120,120,.20)';
}

function outputColor(output, index) {
  if (output === 'serial') return '#2cff7d';
  if (output === 'blx') return '#00d9ff';
  if (output === 'artnet') return '#ff2bd6';
  if (output === 'sacn') return '#ffb043';
  if (output === 'dmx') return '#7c5cff';
  return `hsl(${(index * 37) % 360}, 70%, 46%)`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch]));
}

function structuredCloneSafe(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
