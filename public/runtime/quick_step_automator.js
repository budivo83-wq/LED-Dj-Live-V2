(() => {
  "use strict";

  const runtimeParams = new URLSearchParams(window.location.search || "");
  if (runtimeParams.get("headless") === "1") return;

  const LENGTHS = [64, 128, 256, 512, 1024];
  const VIEW_COUNTS = [16, 32, 64, 128];
  const DEFAULT_VISIBLE = 32;
  const BEATS_PER_SLOT = 4;
  const STORAGE_KEY = "budilightQuickStepAutomatorV12PersistentTransport";
  const TRANSPORT_KEY = "budilightQuickStepAutomatorTransportClockV1";
  const LEGACY_PERSISTENCE_KEY = "budilightQuickStepAutomatorV11RowMuteGentleRandom";
  const PATTERN_LIBRARY_KEY = "budilightQuickStepAutomatorPatternLibraryV1";
  const PATTERN_SLOT_COUNT = 8;
  const HUMANIZE_MODES = ["calm", "musical", "wild"];
  const LEGACY_KEYS = [
    LEGACY_PERSISTENCE_KEY,
    "budilightQuickStepAutomatorV9L1L2Rows",
    "budilightQuickStepAutomatorV4L1Rows"
  ];
  const MODE_EMPTY = "empty";
  const FX_MODES = ["strobe", "shimmer", "gate"];
  const SYMBOLS = Object.freeze({
    empty: "",
    prev: "<",
    next: ">",
    random: "*",
    param: "P",
    flip: "F",
    strobe: "S",
    shimmer: "H",
    gate: "G",
    fxrandom: "?"
  });
  const ROWS = Object.freeze([
    { key: "anim1", layer: 1, role: "anim", label: "A1", title: "Layer 1 Animation", cycle: [MODE_EMPTY, "prev", "next", "random"] },
    { key: "color1", layer: 1, role: "color", label: "C1", title: "Layer 1 Palette", cycle: [MODE_EMPTY, "prev", "next", "random"] },
    { key: "param1", layer: 1, role: "param", label: "P1", title: "Layer 1 Random Params", cycle: [MODE_EMPTY, "param"] },
    { key: "flip1", layer: 1, role: "flip", label: "FL1", title: "Layer 1 Flip", cycle: [MODE_EMPTY, "flip"] },
    { key: "fx1", layer: 1, role: "fx", label: "FX1", title: "Layer 1 FX", cycle: [MODE_EMPTY, "strobe", "shimmer", "gate", "fxrandom"] },
    { key: "anim2", layer: 2, role: "anim", label: "A2", title: "Layer 2 Animation", cycle: [MODE_EMPTY, "prev", "next", "random"] },
    { key: "color2", layer: 2, role: "color", label: "C2", title: "Layer 2 Palette", cycle: [MODE_EMPTY, "prev", "next", "random"] },
    { key: "param2", layer: 2, role: "param", label: "P2", title: "Layer 2 Random Params", cycle: [MODE_EMPTY, "param"] },
    { key: "flip2", layer: 2, role: "flip", label: "FL2", title: "Layer 2 Flip", cycle: [MODE_EMPTY, "flip"] },
    { key: "fx2", layer: 2, role: "fx", label: "FX2", title: "Layer 2 FX", cycle: [MODE_EMPTY, "strobe", "shimmer", "gate", "fxrandom"] }
  ]);
  const ROW_BY_KEY = new Map(ROWS.map((row) => [row.key, row]));

  const $ = (id) => document.getElementById(id);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const slotCountForLength = (length) => Math.max(1, Math.floor((Number(length) || 64) / BEATS_PER_SLOT));
  const beatForSlot = (slot) => Math.max(0, Number(slot) || 0) * BEATS_PER_SLOT;
  const totalSlots = () => slotCountForLength(state.cycleLength);
  const fastApi = () => window.BudiStepSeqFastApi || null;

  const state = {
    enabled: false,
    follow: false,
    collapsed: false,
    eraseMode: false,
    cycleLength: 64,
    visibleCount: DEFAULT_VISIBLE,
    windowStart: 0,
    currentBeat: 0,
    currentStep: 0,
    lastStep: -1,
    beatZeroMs: performance.now(),
    lastBpm: 120,
    patternSlot: "1",
    humanize: "musical",
    grid: createEmptyGrid(64),
    ownedFx: { 1: false, 2: false },
    ownedFlip: { 1: false, 2: false },
    fxRestore: { 1: null, 2: null },
    flipRestore: { 1: null, 2: null },
    rowMute: createRowMuteState(),
    rowLock: createRowMuteState(),
    compareSlots: { A: null, B: null },
    lastCompareLoaded: "",
    arrangementMeta: null,
    profiler: {
      version: 'STEP37EC_PARAM_LIVE_SYNC_FIX',
      runs: 0,
      lastStep: -1,
      lastTotalMs: 0,
      lastReleaseMs: 0,
      lastApplyMs: 0,
      lastFlushMs: 0,
      maxTotalMs: 0,
      avgTotalMs: 0,
      lastChangedRows: 0,
      lastCommitted: false,
      deferredCommits: 0,
      lastCommitDelayMs: 0,
      heavyDeferred: 0,
      heavyApplied: 0,
      heavyQueue: 0,
      lastHeavyMs: 0,
      lastHeavyDelayMs: 0,
      lastAt: 0
    }
  };
  let patternLibrary = createEmptyPatternLibrary();
  let lastTransportSaveAt = 0;
  let lastTransportSavedStep = -1;
  let lastLightUiTickAt = 0;
  const TRANSPORT_SAVE_IDLE_MS = 5000;
  const LIGHT_UI_TICK_MS = 250;
  const STATE_SAVE_IDLE_MS = 750;
  const STATE_SAVE_LIVE_IDLE_MS = 1200;
  const PATTERN_LIBRARY_SAVE_IDLE_MS = 900;
  let stateSaveTimer = 0;
  let stateSaveDirty = false;
  let patternSaveTimer = 0;
  let patternSaveDirty = false;
  // STEP37DA: avoid synchronous localStorage writes when the payload did not
  // actually change. On weaker machines these JSON/stringify+storage commits
  // can show up as tiny audio/LED hitches during dense sequencer editing.
  let lastSavedSequencerStateJson37DA = "";
  let lastSavedTransportStateJson37DA = "";
  let queuedRenderTimer = 0;
  let queuedRenderRaf = 0;
  let queuedRenderForceGrid = false;
  let suppressSequencerCommand37BM = false;
  let lastSequencerCommandAt37BM = 0;
  let adaptiveTickTimer = 0;
  let deferredCommitTimer = 0;
  let deferredCommitRequestedAt = 0;
  let deferredHeavyTimer = 0;
  let deferredHeavyRequestedAt = 0;
  const HEAVY_ROW_DEFER_MS = 28;
  const HEAVY_ROW_BUDGET_MS = 5.5;

  const STEPSEQ_CLIENT_ID_37EC = (() => {
    try {
      const cryptoRef = window.crypto || null;
      if (cryptoRef?.randomUUID) return cryptoRef.randomUUID();
    } catch {}
    return `stepseq-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  })();

  function managedTimeout37CE(name, fn, delayMs, opts = {}) {
    try {
      const loops = window.__budilightRuntimeLoopRegistry37CE;
      if (loops?.timeout) return loops.timeout(`quick-step:${name}`, fn, delayMs, { group: 'sequencer', ...opts });
    } catch {}
    return window.setTimeout(fn, Math.max(0, Number(delayMs) || 0));
  }
  function clearManagedTimeout37CE(id) {
    try { window.__budilightRuntimeLoopRegistry37CE?.clear?.(id); } catch {}
    try { window.clearTimeout(id); } catch {}
  }

  function publishStepProfiler() {
    try { window.__budilightStepSequencerProfiler37AP = state.profiler; } catch {}
  }
  publishStepProfiler();

  const STEPSEQ_PERF_HISTORY_LIMIT_37BO = 80;
  const STEPSEQ_PERF_SLOW_MS_37BO = 8;
  const stepSeqPerf37BO = {
    version: "STEP37BO_STEPSEQ_RENDER_SAVE_PROFILER",
    enabled: true,
    visible: false,
    slowMs: STEPSEQ_PERF_SLOW_MS_37BO,
    samples: [],
    totals: {},
    last: {},
    max: {},
    counts: {},
    lastSlow: null,
    lastUpdatedAt: 0
  };

  function publishStepSeqPerf37BO() {
    try {
      window.__budilightStepSeqPerf37BO = stepSeqPerf37BO;
      // Keep the older debug hook alive, but attach the richer profiler under a stable key.
      state.profiler.renderSaveProfiler37BO = stepSeqPerf37BO;
      window.__budilightStepSequencerProfiler37AP = state.profiler;
    } catch {}
  }

  function setStepSeqPerfVisible37BO(visible) {
    stepSeqPerf37BO.visible = Boolean(visible);
    try { localStorage.setItem("budilightStepSeqProfilerVisible37BO", stepSeqPerf37BO.visible ? "1" : "0"); } catch {}
    updateProfilerHud37BO(true);
  }

  function getStepSeqPerfVisible37BO() {
    try {
      const explicit = localStorage.getItem("budilightStepSeqProfilerVisible37BO");
      if (explicit === "1") return true;
      if (explicit === "0") return false;
    } catch {}
    return runtimeParams.get("seqprof") === "1";
  }

  function profileOp37BO(name, fn) {
    if (!stepSeqPerf37BO.enabled || typeof performance?.now !== "function") return fn();
    const t0 = performance.now();
    try {
      return fn();
    } finally {
      const dt = performance.now() - t0;
      recordPerfSample37BO(name, dt);
    }
  }

  function recordPerfSample37BO(name, durationMs) {
    const key = String(name || "unknown");
    const ms = Math.max(0, Number(durationMs) || 0);
    const now = performance.now?.() || Date.now();
    stepSeqPerf37BO.counts[key] = (stepSeqPerf37BO.counts[key] || 0) + 1;
    stepSeqPerf37BO.totals[key] = (stepSeqPerf37BO.totals[key] || 0) + ms;
    stepSeqPerf37BO.last[key] = Number(ms.toFixed(2));
    stepSeqPerf37BO.max[key] = Number(Math.max(stepSeqPerf37BO.max[key] || 0, ms).toFixed(2));
    const sample = { at: Math.round(now), name: key, ms: Number(ms.toFixed(2)), step: state.currentStep, enabled: state.enabled };
    stepSeqPerf37BO.samples.push(sample);
    if (stepSeqPerf37BO.samples.length > STEPSEQ_PERF_HISTORY_LIMIT_37BO) stepSeqPerf37BO.samples.splice(0, stepSeqPerf37BO.samples.length - STEPSEQ_PERF_HISTORY_LIMIT_37BO);
    if (ms >= stepSeqPerf37BO.slowMs) stepSeqPerf37BO.lastSlow = sample;
    stepSeqPerf37BO.lastUpdatedAt = Date.now();
    publishStepSeqPerf37BO();
    updateProfilerHud37BO(false);
  }

  function profilerSummaryText37BO() {
    const last = stepSeqPerf37BO.last || {};
    const max = stepSeqPerf37BO.max || {};
    const slow = stepSeqPerf37BO.lastSlow;
    const base = `SEQ PERF · grid ${last.renderGrid ?? "-"}ms / max ${max.renderGrid ?? "-"} · timeline ${last.updateTimeline ?? "-"}ms · save ${last.saveState ?? "-"}ms · all ${last.renderAll ?? "-"}ms`;
    if (!slow) return base;
    return `${base} · slow ${slow.name} ${slow.ms}ms @${slow.step + 1}`;
  }

  function updateProfilerHud37BO(force = false) {
    const hud = $("quickStepPerfProfiler");
    if (!hud) return;
    const shouldShow = stepSeqPerf37BO.visible || hud.dataset.forceVisible === "1";
    hud.hidden = !shouldShow;
    if (!shouldShow) return;
    const now = performance.now?.() || Date.now();
    if (!force && Number(hud.dataset.lastPaint || 0) && now - Number(hud.dataset.lastPaint || 0) < 180) return;
    hud.dataset.lastPaint = String(now);
    hud.textContent = profilerSummaryText37BO();
    hud.title = "Sequencer profiler. Zapnutí/vypnutí: window.__budilightStepSeqPerf37BO.setVisible(true/false).";
  }

  stepSeqPerf37BO.visible = getStepSeqPerfVisible37BO();
  stepSeqPerf37BO.setVisible = setStepSeqPerfVisible37BO;
  publishStepSeqPerf37BO();

  function runQueuedRender() {
    queuedRenderTimer = 0;
    if (queuedRenderRaf) return;
    const forceGrid = queuedRenderForceGrid;
    queuedRenderRaf = window.requestAnimationFrame?.(() => {
      queuedRenderRaf = 0;
      const force = queuedRenderForceGrid || forceGrid;
      queuedRenderForceGrid = false;
      renderAll(force);
    }) || window.setTimeout(() => {
      queuedRenderRaf = 0;
      const force = queuedRenderForceGrid || forceGrid;
      queuedRenderForceGrid = false;
      renderAll(force);
    }, 16);
  }

  function scheduleRenderAll(forceGrid = false, delayMs = 16) {
    queuedRenderForceGrid = queuedRenderForceGrid || Boolean(forceGrid);
    if (queuedRenderTimer || queuedRenderRaf) return;
    const liveDelay = state.enabled ? Math.max(32, Number(delayMs) || 32) : Math.max(8, Number(delayMs) || 16);
    queuedRenderTimer = managedTimeout37CE('render-all', runQueuedRender, liveDelay, { liveFactor: state.enabled ? 1.35 : 1.8, hiddenFactor: 5, maxMs: state.enabled ? 96 : 1200 });
  }

  function nextTickDelayMs() {
    if (state.enabled) return 40;
    if (isSequencerUiVisible()) return 90;
    return document.hidden ? 750 : 250;
  }

  function scheduleAdaptiveTick(delayMs = null) {
    if (adaptiveTickTimer) clearManagedTimeout37CE(adaptiveTickTimer);
    const delay = Math.max(30, Number(delayMs ?? nextTickDelayMs()) || 40);
    adaptiveTickTimer = managedTimeout37CE('adaptive-tick', () => {
      adaptiveTickTimer = 0;
      tick();
      scheduleAdaptiveTick();
    }, delay, { liveFactor: state.enabled ? 1 : 2.2, hiddenFactor: 4, maxMs: state.enabled ? 120 : 1500 });
  }

  const undoStack = [];
  const dom = {
    gridBuiltForStart: -1,
    gridBuiltForVisible: -1,
    gridBuiltForLength: -1,
    highlightedStep: -1,
    erasing: false,
    erasingChanged: false,
    statusText: "",
    cellsByStep: new Map(),
    cellsByCell: new Map(),
    stepHeaders: new Map(),
    dotsByCell: new Map(),
    collapsedSlots: new Map(),
    minimapPlayhead: null,
    minimapWindowBox: null,
    collapsedHighlightedStep: -1,
    minimapBuiltForLength: -1,
    minimapBuiltForSignature: "",
    collapsedBuiltForStart: -1,
    collapsedBuiltForVisible: -1,
    collapsedBuiltForLength: -1,
    statusBuiltForStep: -1,
    statusBuiltForBeat: -1,
    statusBuiltForEnabled: null,
    statusLastUpdatedAt: 0
  };

  function createEmptyGrid(length) {
    const slots = slotCountForLength(length);
    const grid = {};
    for (const row of ROWS) grid[row.key] = Array(slots).fill(MODE_EMPTY);
    return grid;
  }

  function createRowMuteState(input = null) {
    const mute = {};
    for (const row of ROWS) mute[row.key] = Boolean(input?.[row.key]);
    return mute;
  }

  function createCompareSlots(input = null) {
    return {
      A: input?.A && typeof input.A === "object" ? input.A : null,
      B: input?.B && typeof input.B === "object" ? input.B : null
    };
  }

  function createEmptyPatternLibrary() {
    const library = {};
    for (let index = 1; index <= PATTERN_SLOT_COUNT; index += 1) library[String(index)] = null;
    return library;
  }

  function cloneGrid(grid = state.grid) {
    const copy = {};
    for (const row of ROWS) {
      copy[row.key] = Array.isArray(grid[row.key]) ? grid[row.key].slice() : Array(totalSlots()).fill(MODE_EMPTY);
    }
    return copy;
  }

  function normalizeGrid(input, length) {
    const slots = slotCountForLength(length);
    const grid = createEmptyGrid(length);
    for (const row of ROWS) {
      const legacyKey = row.layer === 1 ? row.role : row.key;
      const source = Array.isArray(input?.[row.key]) ? input[row.key] : (Array.isArray(input?.[legacyKey]) ? input[legacyKey] : []);
      const beatBased = source.length > slots;
      for (let slot = 0; slot < slots; slot += 1) {
        const sourceIndex = beatBased ? beatForSlot(slot) : slot;
        const mode = source[sourceIndex];
        grid[row.key][slot] = row.cycle.includes(mode) ? mode : MODE_EMPTY;
      }
    }
    return grid;
  }

  function loadSavedState() {
    let saved = null;
    for (const key of [STORAGE_KEY, ...LEGACY_KEYS]) {
      try {
        const parsed = JSON.parse(localStorage.getItem(key) || "null");
        if (parsed && typeof parsed === "object") {
          saved = parsed;
          break;
        }
      } catch {}
    }
    if (!saved) return;

    // STEP37P: never arm the sequencer automatically after page/app reload.
    // Patterns, view and transport position are restored, but output ownership stays safe/OFF
    // until the operator explicitly presses ON. This prevents a saved ON state from
    // stealing the Performance output on the next launch.
    state.enabled = false;
    state.follow = Boolean(saved.follow);
    state.collapsed = Boolean(saved.collapsed);
    state.eraseMode = false;
    state.patternSlot = String(saved.patternSlot || "1");
    state.humanize = HUMANIZE_MODES.includes(String(saved.humanize)) ? String(saved.humanize) : "musical";
    state.cycleLength = LENGTHS.includes(Number(saved.cycleLength)) ? Number(saved.cycleLength) : 64;
    state.visibleCount = normalizeVisibleCount(saved.visibleCount, state.cycleLength);
    state.windowStart = clamp(Number(saved.windowStart) || 0, 0, Math.max(0, slotCountForLength(state.cycleLength) - state.visibleCount));
    state.grid = normalizeGrid(saved.grid, state.cycleLength);
    state.rowMute = createRowMuteState(saved.rowMute);
    state.rowLock = createRowMuteState(saved.rowLock);
    state.compareSlots = createCompareSlots(saved.compareSlots);
    restoreTransportState();
  }

  function restoreTransportState() {
    try {
      const saved = JSON.parse(localStorage.getItem(TRANSPORT_KEY) || "null");
      if (!saved || typeof saved !== "object") return;
      const bpm = Number(saved.bpm || state.lastBpm || readBpm());
      const startedAtWall = Number(saved.beatStartedAtWall);
      if (!Number.isFinite(startedAtWall) || startedAtWall <= 0) return;
      const elapsedMs = Math.max(0, Date.now() - startedAtWall);
      const beatMs = 60000 / Math.max(1, bpm || 120);
      state.beatZeroMs = performance.now() - elapsedMs;
      state.lastBpm = bpm;
      syncBeatState(elapsedMs / beatMs);
      state.lastStep = state.currentStep;
    } catch {}
  }

  function saveTransportState() {
    try {
      const bpm = readBpm();
      const beatMs = 60000 / Math.max(1, bpm || 120);
      const elapsedMs = Math.max(0, performance.now() - state.beatZeroMs);
      const payload = {
        version: "step37da-transport-persist",
        beatStartedAtWall: Math.round(Date.now() - elapsedMs),
        bpm,
        cycleLength: state.cycleLength,
        currentBeat: Math.round(Number(state.currentBeat || 0) * 1000) / 1000,
        currentStep: state.currentStep
      };
      const json = JSON.stringify(payload);
      if (json === lastSavedTransportStateJson37DA) return;
      lastSavedTransportStateJson37DA = json;
      localStorage.setItem(TRANSPORT_KEY, json);
    } catch {}
  }

  function saveState() {
    return profileOp37BO("saveState", () => {
    try {
      const payload = {
        // Keep saving the full programming surface, but do not persist sequencer ON/OFF.
        // Startup must always be safe: OFF, Performance keeps the output until re-enabled.
        enabled: false,
        follow: state.follow,
        collapsed: state.collapsed,
        patternSlot: state.patternSlot,
        humanize: state.humanize,
        cycleLength: state.cycleLength,
        visibleCount: state.visibleCount,
        windowStart: state.windowStart,
        rowMute: state.rowMute,
        rowLock: state.rowLock,
        compareSlots: state.compareSlots,
        grid: state.grid
      };
      const json = JSON.stringify(payload);
      if (json !== lastSavedSequencerStateJson37DA) {
        lastSavedSequencerStateJson37DA = json;
        localStorage.setItem(STORAGE_KEY, json);
      }
      saveTransportState();
    } catch {}
    });
  }

  function scheduleStateSave(delayMs = STATE_SAVE_IDLE_MS) {
    stateSaveDirty = true;
    if (stateSaveTimer) return;
    const liveDelay = state.enabled ? Math.max(STATE_SAVE_LIVE_IDLE_MS, Number(delayMs) || 0) : Math.max(120, Number(delayMs) || STATE_SAVE_IDLE_MS);
    stateSaveTimer = managedTimeout37CE('state-save', () => {
      stateSaveTimer = 0;
      if (!stateSaveDirty) return;
      stateSaveDirty = false;
      saveState();
    }, liveDelay);
  }

  function flushStateSave() {
    if (stateSaveTimer) {
      clearManagedTimeout37CE(stateSaveTimer);
      stateSaveTimer = 0;
    }
    if (!stateSaveDirty) return;
    stateSaveDirty = false;
    saveState();
  }

  function sendSequencerCommand37BM(action, payload = {}, options = {}) {
    if (suppressSequencerCommand37BM) return false;
    try {
      const api = fastApi();
      if (!api?.sendCommand) return false;
      const detail = {
        action: String(action || "sequencer"),
        source: "quick-step",
        clientId: STEPSEQ_CLIENT_ID_37EC,
        version: "STEP37EC_STEPSEQ_COMMANDS",
        cycleLength: state.cycleLength,
        currentStep: state.currentStep,
        enabled: state.enabled,
        ...payload
      };
      const ok = api.sendCommand("sequencer-command", detail, {
        persist: false,
        reason: String(options.reason || action || "sequencer-command")
      });
      if (ok) {
        lastSequencerCommandAt37BM = performance.now();
        try {
          state.profiler.lastCommand = detail.action;
          state.profiler.lastCommandAt = Date.now();
        } catch {}
      }
      return ok;
    } catch {
      return false;
    }
  }

  function snapshotStepModes37BM(step) {
    const modes = {};
    for (const row of ROWS) modes[row.key] = rowMode(row.key, step) || MODE_EMPTY;
    return modes;
  }

  function withSuppressedSequencerCommand37BM(fn) {
    suppressSequencerCommand37BM = true;
    try { return fn(); } finally { suppressSequencerCommand37BM = false; }
  }

  function loadPatternLibrary() {
    patternLibrary = createEmptyPatternLibrary();
    try {
      const parsed = JSON.parse(localStorage.getItem(PATTERN_LIBRARY_KEY) || "null");
      if (!parsed || typeof parsed !== "object") return;
      for (let index = 1; index <= PATTERN_SLOT_COUNT; index += 1) {
        const slot = String(index);
        const entry = parsed[slot];
        if (entry && typeof entry === "object") patternLibrary[slot] = entry;
      }
    } catch {}
  }

  function savePatternLibrary() {
    try {
      localStorage.setItem(PATTERN_LIBRARY_KEY, JSON.stringify(patternLibrary));
    } catch {}
  }

  function schedulePatternLibrarySave(delayMs = PATTERN_LIBRARY_SAVE_IDLE_MS) {
    patternSaveDirty = true;
    if (patternSaveTimer) return;
    patternSaveTimer = managedTimeout37CE('pattern-save', () => {
      patternSaveTimer = 0;
      if (!patternSaveDirty) return;
      patternSaveDirty = false;
      savePatternLibrary();
    }, Math.max(120, Number(delayMs) || PATTERN_LIBRARY_SAVE_IDLE_MS));
  }

  function flushPatternLibrarySave() {
    if (patternSaveTimer) {
      clearManagedTimeout37CE(patternSaveTimer);
      patternSaveTimer = 0;
    }
    if (!patternSaveDirty) return;
    patternSaveDirty = false;
    savePatternLibrary();
  }

  function normalizeVisibleCount(value, length = state.cycleLength) {
    const slots = slotCountForLength(length);
    const maxVisible = maxVisibleForLayout(length);
    const allowed = VIEW_COUNTS.filter((count) => count <= slots && count <= maxVisible);
    const fallback = allowed[allowed.length - 1] || Math.min(slots, maxVisible) || 16;
    return allowed.includes(Number(value)) ? Number(value) : fallback;
  }

  function maxVisibleForLayout(length = state.cycleLength) {
    const panel = $("quickStepAutoPanel") || document.body;
    const width = Math.max(0, Number(panel.clientWidth || window.innerWidth || 0));
    const slots = slotCountForLength(length);
    if (width <= 520) return Math.min(16, slots);
    if (width <= 780) return Math.min(32, slots);
    if (width <= 1120) return Math.min(64, slots);
    return Math.min(128, slots);
  }

  function pushUndo() {
    undoStack.push({
      cycleLength: state.cycleLength,
      visibleCount: state.visibleCount,
      windowStart: state.windowStart,
      grid: cloneGrid()
    });
    if (undoStack.length > 32) undoStack.shift();
  }

  function restoreSnapshot(snapshot) {
    if (!snapshot) return;
    state.cycleLength = LENGTHS.includes(Number(snapshot.cycleLength)) ? Number(snapshot.cycleLength) : state.cycleLength;
    state.visibleCount = normalizeVisibleCount(snapshot.visibleCount, state.cycleLength);
    state.windowStart = clamp(Number(snapshot.windowStart) || 0, 0, Math.max(0, slotCountForLength(state.cycleLength) - state.visibleCount));
    state.grid = normalizeGrid(snapshot.grid, state.cycleLength);
    state.arrangementMeta = null;
    state.lastStep = -1;
    invalidateGrid();
    scheduleRenderAll(true, 24);
    scheduleStateSave();
  }

  function undoLast() {
    const snapshot = undoStack.pop();
    restoreSnapshot(snapshot);
  }

  function invalidateGrid() {
    dom.gridBuiltForStart = -1;
    dom.gridBuiltForVisible = -1;
    dom.gridBuiltForLength = -1;
    dom.cellsByStep.clear();
    dom.cellsByCell.clear();
    dom.stepHeaders.clear();
    dom.highlightedStep = -1;
    invalidateMinimap();
  }

  function minimapSignature() {
    const phrases = state.arrangementMeta?.phrases || [];
    return `${state.cycleLength}:${phrases.length}:${phrases.map((item) => `${item.base || 0}-${item.isSpecial ? 1 : 0}-${item.isSectionStart ? 1 : 0}`).join(".")}`;
  }

  function invalidateMinimap() {
    dom.minimapBuiltForLength = -1;
    dom.minimapBuiltForSignature = "";
    dom.collapsedBuiltForStart = -1;
    dom.collapsedBuiltForVisible = -1;
    dom.collapsedBuiltForLength = -1;
    dom.dotsByCell.clear();
    dom.collapsedSlots.clear();
    dom.minimapPlayhead = null;
    dom.minimapWindowBox = null;
    dom.collapsedHighlightedStep = -1;
  }

  function updateMinimapViewport() {
    const total = totalSlots();
    if (dom.minimapWindowBox?.isConnected) {
      dom.minimapWindowBox.style.left = `${(state.windowStart / total) * 100}%`;
      dom.minimapWindowBox.style.width = `${(state.visibleCount / total) * 100}%`;
    }
    if (dom.minimapPlayhead?.isConnected) {
      dom.minimapPlayhead.style.left = `${((state.currentStep + 0.5) / total) * 100}%`;
    }
  }

  function setCellMode(rowKey, step, mode, options = {}) {
    const row = ROW_BY_KEY.get(rowKey);
    if (!row) return false;
    if (step < 0 || step >= totalSlots()) return false;
    const nextMode = row.cycle.includes(mode) ? mode : MODE_EMPTY;
    if (state.grid[rowKey][step] === nextMode) return false;
    if (!options.noUndo) pushUndo();
    state.grid[rowKey][step] = nextMode;
    const cell = dom.cellsByCell.get(cellDomKey(rowKey, step));
    if (cell?.isConnected) applyModeToCell(cell, nextMode);
    updateMinimapCell(rowKey, step, nextMode);
    updateCollapsedSlot(step);
    updateStatus();
    if (!options.noSave) scheduleStateSave();
    sendSequencerCommand37BM("grid-edit", { rowKey, step, mode: nextMode }, { reason: "sequencer-grid-edit" });
    return true;
  }

  function eraseCell(rowKey, step, options = {}) {
    return setCellMode(rowKey, step, MODE_EMPTY, options);
  }

  function randomAction(row) {
    // Performance random: animation changes must feel like phrase-level moments,
    // not like constant selector noise. FX/params carry most of the musical motion.
    if (row.role === "anim") {
      const roll = Math.random();
      if (roll < 0.60) return MODE_EMPTY;
      if (roll < 0.78) return "next";
      if (roll < 0.94) return "prev";
      return "random";
    }
    if (row.role === "color") {
      const roll = Math.random();
      if (roll < 0.36) return MODE_EMPTY;
      if (roll < 0.68) return "next";
      if (roll < 0.96) return "prev";
      return "random";
    }
    if (row.role === "param") return Math.random() < 0.56 ? "param" : MODE_EMPTY;
    if (row.role === "flip") return Math.random() < 0.08 ? "flip" : MODE_EMPTY;
    const roll = Math.random();
    if (roll < 0.08) return "fxrandom";
    if (roll < 0.52) return FX_MODES[Math.floor(Math.random() * FX_MODES.length)];
    return MODE_EMPTY;
  }

  function visibleRange() {
    return {
      start: state.windowStart,
      end: Math.min(totalSlots(), state.windowStart + state.visibleCount)
    };
  }

  function clearRange(start, end) {
    for (const row of ROWS) {
      for (let slot = start; slot < end; slot += 1) state.grid[row.key][slot] = MODE_EMPTY;
    }
  }

  function setRangeCell(rowKey, slot, mode, grid = state.grid) {
    if (!grid[rowKey] || slot < 0 || slot >= totalSlots()) return;
    grid[rowKey][slot] = mode;
  }

  function getHumanizeProfile(mode = state.humanize) {
    if (mode === "calm") {
      return {
        specialChance: 0.12,
        animSpacingL1: 4,
        animSpacingL2: 8,
        paramDensity: 0.88,
        fxDensity: 0.74,
        colorDensity: 0.82,
        randomAnimWeight: 0.45,
        dropChanceL1: 0.16,
        dropChanceL2: 0.05
      };
    }
    if (mode === "wild") {
      return {
        specialChance: 0.34,
        animSpacingL1: 2,
        animSpacingL2: 4,
        paramDensity: 1.18,
        fxDensity: 1.18,
        colorDensity: 1.15,
        randomAnimWeight: 1.9,
        dropChanceL1: 0.34,
        dropChanceL2: 0.16
      };
    }
    return {
      specialChance: 0.22,
      animSpacingL1: 3,
      animSpacingL2: 6,
      paramDensity: 1,
      fxDensity: 1,
      colorDensity: 1,
      randomAnimWeight: 1,
      dropChanceL1: 0.24,
      dropChanceL2: 0.10
    };
  }

  function chooseWeighted(items) {
    const total = items.reduce((sum, item) => sum + Math.max(0, Number(item.weight) || 0), 0);
    if (total <= 0) return items[0]?.value;
    let roll = Math.random() * total;
    for (const item of items) {
      roll -= Math.max(0, Number(item.weight) || 0);
      if (roll <= 0) return item.value;
    }
    return items[items.length - 1]?.value;
  }

  function maybe(probability) {
    return Math.random() < probability;
  }

  function clampSlot(slot, start, end) {
    return Math.max(start, Math.min(end - 1, slot));
  }

  function nudgeMode(randomChance = 0.015) {
    const roll = Math.random();
    if (roll < randomChance) return "random";
    return roll < 0.52 ? "next" : "prev";
  }

  function buildMusicalArrangement(start, end, humanize = getHumanizeProfile()) {
    const slots = Math.max(0, end - start);
    const barSize = Math.max(1, Math.round(16 / BEATS_PER_SLOT));
    const phraseSize = Math.max(barSize * 4, Math.round(64 / BEATS_PER_SLOT));
    const phraseCount = Math.max(1, Math.ceil(slots / phraseSize));
    const sectionSize = 2;
    const specialCount = Math.min(3, Math.max(1, Math.round(phraseCount * humanize.specialChance)));
    const specialPhrases = new Set();
    const phrases = [];

    while (specialPhrases.size < specialCount) {
      const minIndex = phraseCount > 2 ? 1 : 0;
      const maxIndex = Math.max(minIndex, phraseCount - 1);
      const candidate = minIndex + Math.floor(Math.random() * Math.max(1, maxIndex - minIndex + 1));
      specialPhrases.add(candidate);
      if (phraseCount <= 2) break;
    }

    for (let phraseIndex = 0; phraseIndex < phraseCount; phraseIndex += 1) {
      const base = start + phraseIndex * phraseSize;
      const phraseEnd = Math.min(end, base + phraseSize);
      phrases.push({
        phraseIndex,
        base,
        phraseEnd,
        isSectionStart: phraseIndex % sectionSize === 0,
        isSectionEnd: phraseIndex % sectionSize === sectionSize - 1,
        isSpecial: specialPhrases.has(phraseIndex)
      });
    }

    return { barSize, phraseSize, phraseCount, sectionSize, specialPhrases, phrases };
  }

  function fillPhraseFx(grid, fxKey, base, phraseEnd, barSize, energy, isDrop, layer, humanize = getHumanizeProfile()) {
    const phraseSlots = Math.max(1, phraseEnd - base);
    const accents = [
      { offset: barSize, strength: 0.28 },
      { offset: barSize * 2, strength: isDrop ? 0.56 : 0.34 },
      { offset: barSize * 3, strength: isDrop ? 0.68 : 0.30 },
      { offset: phraseSlots - 1, strength: isDrop ? 0.80 : 0.24 }
    ];
    const used = new Set();
    for (const accent of accents) {
      const slot = clampSlot(base + Math.max(0, accent.offset), base, phraseEnd);
      if (used.has(slot)) continue;
      used.add(slot);
      const probability = Math.min(0.84, accent.strength * energy * humanize.fxDensity * (layer === 2 ? 0.58 : 0.88));
      if (!maybe(probability)) continue;
      const mode = chooseWeighted([
        { value: "gate", weight: isDrop ? 26 : 38 },
        { value: "shimmer", weight: isDrop ? 34 : 42 },
        { value: "strobe", weight: isDrop ? 26 : 14 },
        { value: "fxrandom", weight: isDrop ? 5 : 3 }
      ]);
      setRangeCell(fxKey, slot, mode, grid);
    }
  }

  function fillPhraseParams(grid, paramKey, base, phraseEnd, barSize, energy, layer, humanize = getHumanizeProfile()) {
    const phraseSlots = Math.max(1, phraseEnd - base);
    const points = [0, barSize, barSize * 2, barSize * 3].filter((offset) => offset < phraseSlots);
    for (const offset of points) {
      const slot = base + offset;
      const baseProbability = offset === 0 ? 0.52 : offset === barSize * 2 ? 0.64 : 0.48;
      if (maybe(Math.min(0.90, baseProbability * energy * humanize.paramDensity * (layer === 2 ? 0.84 : 1)))) {
        setRangeCell(paramKey, slot, "param", grid);
      }
    }
    // Small syncopated detail: one off-grid param nudge inside a phrase, not a full visual reset.
    if (phraseSlots > 3 && maybe(0.26 * energy * humanize.paramDensity * (layer === 2 ? 0.82 : 0.96))) {
      const slot = base + 1 + Math.floor(Math.random() * Math.max(1, phraseSlots - 2));
      setRangeCell(paramKey, slot, "param", grid);
    }
  }

  function fillSpecialMoment(grid, layer, arrangement, phraseIndex, base, phraseEnd) {
    const { barSize } = arrangement;
    const animKey = `anim${layer}`;
    const colorKey = `color${layer}`;
    const paramKey = `param${layer}`;
    const fxKey = `fx${layer}`;

    setRangeCell(paramKey, base, "param", grid);
    setRangeCell(paramKey, clampSlot(base + barSize * 2, base, phraseEnd), "param", grid);
    setRangeCell(colorKey, clampSlot(base + barSize, base, phraseEnd), nudgeMode(layer === 1 ? 0.02 : 0.008), grid);

    if (layer === 1) {
      const animMode = phraseIndex === 0
        ? chooseWeighted([{ value: "next", weight: 8 }, { value: "prev", weight: 6 }])
        : chooseWeighted([{ value: "next", weight: 48 }, { value: "prev", weight: 38 }, { value: "random", weight: 14 }]);
      setRangeCell(animKey, base, animMode, grid);
      setRangeCell(fxKey, clampSlot(base + barSize * 3, base, phraseEnd), chooseWeighted([
        { value: "shimmer", weight: 42 },
        { value: "gate", weight: 34 },
        { value: "strobe", weight: 20 },
        { value: "fxrandom", weight: 4 }
      ]), grid);
      return;
    }

    if (maybe(0.45)) setRangeCell(colorKey, base, nudgeMode(0.004), grid);
    if (maybe(0.28)) setRangeCell(fxKey, clampSlot(base + barSize * 3, base, phraseEnd), "shimmer", grid);
  }

  function fillMusicalLayer(grid, layer, start, end, arrangement, humanize = getHumanizeProfile()) {
    const slots = Math.max(0, end - start);
    if (!slots) return;
    const { barSize, phraseSize, sectionSize, specialPhrases } = arrangement;
    const animKey = `anim${layer}`;
    const colorKey = `color${layer}`;
    const paramKey = `param${layer}`;
    const flipKey = `flip${layer}`;
    const fxKey = `fx${layer}`;

    let phraseIndex = 0;
    let lastAnimPhrase = -99;
    let motif = chooseWeighted([
      { value: "steady", weight: 40 },
      { value: "build", weight: 24 },
      { value: "fill", weight: 20 },
      { value: "break", weight: 16 }
    ]);

    for (let base = start; base < end; base += phraseSize, phraseIndex += 1) {
      const phraseEnd = Math.min(end, base + phraseSize);
      const inSection = phraseIndex % sectionSize;
      const isSectionStart = inSection === 0;
      const isSectionEnd = inSection === sectionSize - 1;
      const isSpecialPhrase = specialPhrases.has(phraseIndex);
      const isDropMoment = isSpecialPhrase || (isSectionEnd && maybe(layer === 1 ? humanize.dropChanceL1 : humanize.dropChanceL2));
      if (isSectionStart && phraseIndex > 0 && maybe(0.55)) {
        motif = chooseWeighted([
          { value: "steady", weight: 40 },
          { value: "build", weight: 26 },
          { value: "fill", weight: 22 },
          { value: "break", weight: 12 }
        ]);
      }

      const energy = isSpecialPhrase ? 1.30
        : motif === "build" ? (isSectionEnd ? 1.18 : 1.00)
        : motif === "fill" ? 1.10
        : motif === "break" ? 0.72
        : 0.92;

      // Animation changes are phrase/section decisions only. Layer 1 may move on
      // section starts or drop moments; layer 2 almost never moves, so it stays as
      // texture instead of stealing the whole show.
      const phrasesSinceAnim = phraseIndex - lastAnimPhrase;
      const canChangeAnim = phrasesSinceAnim >= (layer === 1 ? humanize.animSpacingL1 : humanize.animSpacingL2);
      const animProbability = layer === 1
        ? (isSpecialPhrase ? 0.56 : isDropMoment ? 0.18 : isSectionStart ? 0.10 : 0.015)
        : (isSpecialPhrase ? 0.08 : isSectionStart ? 0.018 : 0.003);
      if (canChangeAnim && maybe(animProbability)) {
        const mode = chooseWeighted([
          { value: "next", weight: isSpecialPhrase ? 42 : isDropMoment ? 52 : 64 },
          { value: "prev", weight: isSpecialPhrase ? 34 : isDropMoment ? 38 : 34 },
          { value: "random", weight: (isSpecialPhrase ? 24 : isDropMoment ? 10 : 2) * humanize.randomAnimWeight }
        ]);
        setRangeCell(animKey, base, mode, grid);
        lastAnimPhrase = phraseIndex;
      }

      // Palette movement can happen more often, but mostly as neighbour nudges.
      const colorProbability = layer === 1
        ? (isSpecialPhrase ? 0.86 : isDropMoment ? 0.58 : isSectionStart ? 0.44 : 0.26)
        : (isSpecialPhrase ? 0.34 : isSectionStart ? 0.18 : 0.12);
      if (maybe(colorProbability * energy * humanize.colorDensity)) setRangeCell(colorKey, base, nudgeMode(isDropMoment ? 0.035 : 0.008), grid);
      if (isSectionEnd && maybe(0.28 * energy * (layer === 2 ? 0.60 : 1))) {
        setRangeCell(colorKey, clampSlot(base + barSize * 2, base, phraseEnd), nudgeMode(0.006), grid);
      }

      fillPhraseParams(grid, paramKey, base, phraseEnd, barSize, energy, layer, humanize);
      fillPhraseFx(grid, fxKey, base, phraseEnd, barSize, energy, isDropMoment || motif === "fill", layer, humanize);
      if (isSpecialPhrase) fillSpecialMoment(grid, layer, arrangement, phraseIndex, base, phraseEnd);

      // Flip is treated like a rare breakdown/turnaround cue, not a constant random switch.
      if ((motif === "break" || isDropMoment) && maybe(layer === 1 ? 0.07 : 0.025)) {
        setRangeCell(flipKey, clampSlot(base + barSize * 2, base, phraseEnd), "flip", grid);
      }
    }
  }

  function createGeneratedPattern(start, end, humanize = getHumanizeProfile()) {
    const grid = createEmptyGrid(state.cycleLength);
    const arrangement = buildMusicalArrangement(start, end, humanize);
    fillMusicalLayer(grid, 1, start, end, arrangement, humanize);
    fillMusicalLayer(grid, 2, start, end, arrangement, humanize);
    return { grid, arrangement };
  }

  function applyGeneratedPattern(start, end, generated, options = {}) {
    const clearUnlocked = options.clearUnlocked !== false;
    const mutatePhrases = Array.isArray(options.mutatePhrases) ? new Set(options.mutatePhrases) : null;
    const phraseMap = new Map((generated?.arrangement?.phrases || []).map((phrase) => [phrase.phraseIndex, phrase]));
    for (const row of ROWS) {
      if (state.rowLock[row.key]) continue;
      if (!mutatePhrases) {
        for (let slot = start; slot < end; slot += 1) {
          state.grid[row.key][slot] = clearUnlocked ? (generated.grid[row.key][slot] || MODE_EMPTY) : state.grid[row.key][slot];
        }
        continue;
      }
      for (const phraseIndex of mutatePhrases) {
        const phrase = phraseMap.get(phraseIndex);
        if (!phrase) continue;
        for (let slot = phrase.base; slot < phrase.phraseEnd; slot += 1) {
          state.grid[row.key][slot] = generated.grid[row.key][slot] || MODE_EMPTY;
        }
      }
    }
    state.arrangementMeta = generated?.arrangement || null;
  }

  function randomizePattern() {
    pushUndo();
    const { start, end } = visibleRange();
    const generated = createGeneratedPattern(start, end, getHumanizeProfile());
    applyGeneratedPattern(start, end, generated, { clearUnlocked: true });
    invalidateGrid();
    scheduleRenderAll(true, 24);
    scheduleStateSave();
  }

  function mutatePattern(amount = 0.15) {
    pushUndo();
    const { start, end } = visibleRange();
    const generated = createGeneratedPattern(start, end, getHumanizeProfile());
    const phrases = generated.arrangement?.phrases || [];
    const count = Math.max(1, Math.min(phrases.length, Math.round(phrases.length * Math.max(0.05, Math.min(1, amount)))));
    const chosen = [];
    const pool = phrases.slice();
    while (chosen.length < count && pool.length) {
      const index = Math.floor(Math.random() * pool.length);
      const [phrase] = pool.splice(index, 1);
      if (phrase) chosen.push(phrase.phraseIndex);
    }
    applyGeneratedPattern(start, end, generated, { clearUnlocked: false, mutatePhrases: chosen });
    invalidateGrid();
    scheduleRenderAll(true, 24);
    scheduleStateSave();
  }

  function clearPattern() {
    pushUndo();
    state.grid = createEmptyGrid(state.cycleLength);
    state.arrangementMeta = null;
    invalidateGrid();
    scheduleRenderAll(true, 24);
    scheduleStateSave();
  }

  function currentPatternSlot() {
    const normalized = String(state.patternSlot || "1");
    return patternLibrary[normalized] ? patternLibrary[normalized] : null;
  }

  function updatePatternControls() {
    const select = $("quickStepPatternSlot");
    if (select && select.value !== String(state.patternSlot || "1")) select.value = String(state.patternSlot || "1");
    const loadButton = $("quickStepPatternLoad");
    if (loadButton) loadButton.disabled = !currentPatternSlot();
  }

  function updateCompareControls() {
    const hasA = Boolean(state.compareSlots.A);
    const hasB = Boolean(state.compareSlots.B);
    const loadA = $("quickStepLoadA");
    const loadB = $("quickStepLoadB");
    if (loadA) {
      loadA.disabled = !hasA;
      loadA.classList.toggle("active", state.lastCompareLoaded === "A");
    }
    if (loadB) {
      loadB.disabled = !hasB;
      loadB.classList.toggle("active", state.lastCompareLoaded === "B");
    }
  }

  function createPatternSnapshot() {
    return {
      cycleLength: state.cycleLength,
      visibleCount: state.visibleCount,
      windowStart: state.windowStart,
      rowMute: createRowMuteState(state.rowMute),
      rowLock: createRowMuteState(state.rowLock),
      grid: cloneGrid()
    };
  }

  function storeCompareSlot(slot) {
    const safeSlot = slot === "B" ? "B" : "A";
    state.compareSlots[safeSlot] = createPatternSnapshot();
    state.lastCompareLoaded = safeSlot;
    updateCompareControls();
    scheduleStateSave();
  }

  function loadCompareSlot(slot) {
    const safeSlot = slot === "B" ? "B" : "A";
    const snapshot = state.compareSlots[safeSlot];
    if (!snapshot) return false;
    pushUndo();
    state.cycleLength = LENGTHS.includes(Number(snapshot.cycleLength)) ? Number(snapshot.cycleLength) : state.cycleLength;
    state.visibleCount = normalizeVisibleCount(snapshot.visibleCount, state.cycleLength);
    state.windowStart = clamp(Number(snapshot.windowStart) || 0, 0, Math.max(0, slotCountForLength(state.cycleLength) - state.visibleCount));
    state.rowMute = createRowMuteState(snapshot.rowMute);
    state.rowLock = createRowMuteState(snapshot.rowLock);
    state.grid = normalizeGrid(snapshot.grid, state.cycleLength);
    state.arrangementMeta = null;
    state.lastCompareLoaded = safeSlot;
    invalidateGrid();
    scheduleRenderAll(true, 24);
    updateCompareControls();
    scheduleStateSave(160);
    return true;
  }

  function savePatternToSlot(slot = state.patternSlot) {
    const safeSlot = String(slot || "1");
    patternLibrary[safeSlot] = {
      cycleLength: state.cycleLength,
      visibleCount: state.visibleCount,
      savedAt: Date.now(),
      rowMute: createRowMuteState(state.rowMute),
      rowLock: createRowMuteState(state.rowLock),
      grid: cloneGrid()
    };
    state.patternSlot = safeSlot;
    schedulePatternLibrarySave(160);
    scheduleStateSave(160);
    updatePatternControls();
  }

  function toggleRowMute(rowKey) {
    const row = ROWS.find((item) => item.key === rowKey);
    if (!row) return false;
    state.rowMute[rowKey] = !state.rowMute[rowKey];
    updateRowMuteDom(rowKey);
    updateStatus(true);
    scheduleStateSave();
    return true;
  }

  function updateRowMuteDom(rowKey) {
    const muted = Boolean(state.rowMute[rowKey]);
    const row = ROWS.find((item) => item.key === rowKey);
    document.querySelectorAll(`[data-row-label="${rowKey}"], .quick-step-cell[data-row="${rowKey}"], .quick-step-dot.row-${rowKey}`)
      .forEach((element) => element.classList.toggle("is-muted", muted));
    document.querySelectorAll(`[data-row-label="${rowKey}"]`).forEach((label) => {
      label.textContent = muted
        ? `${row?.label || rowKey} M`
        : state.rowLock[rowKey]
          ? `${row?.label || rowKey} L`
          : (row?.label || rowKey);
      label.setAttribute("aria-pressed", String(muted));
    });
  }

  function loadPatternFromSlot(slot = state.patternSlot) {
    const safeSlot = String(slot || "1");
    const entry = patternLibrary[safeSlot];
    if (!entry || typeof entry !== "object") return false;
    pushUndo();
    const nextGrid = createEmptyGrid(state.cycleLength);
    const sourceGrid = normalizeGrid(entry.grid, entry.cycleLength || state.cycleLength);
    const maxSlots = Math.min(totalSlots(), slotCountForLength(entry.cycleLength || state.cycleLength));
    for (const row of ROWS) {
      for (let index = 0; index < maxSlots; index += 1) nextGrid[row.key][index] = sourceGrid[row.key][index] || MODE_EMPTY;
    }
    state.grid = nextGrid;
    state.rowMute = createRowMuteState(entry.rowMute);
    state.rowLock = createRowMuteState(entry.rowLock);
    state.patternSlot = safeSlot;
    state.arrangementMeta = null;
    invalidateGrid();
    scheduleRenderAll(true, 24);
    scheduleStateSave();
    updatePatternControls();
    return true;
  }

  function toggleRowLock(rowKey) {
    const row = ROWS.find((item) => item.key === rowKey);
    if (!row) return false;
    state.rowLock[rowKey] = !state.rowLock[rowKey];
    updateRowLockDom(rowKey);
    scheduleStateSave();
    return true;
  }

  function updateRowLockDom(rowKey) {
    const locked = Boolean(state.rowLock[rowKey]);
    const row = ROWS.find((item) => item.key === rowKey);
    document.querySelectorAll(`[data-row-label="${rowKey}"], .quick-step-cell[data-row="${rowKey}"], .quick-step-dot.row-${rowKey}`)
      .forEach((element) => element.classList.toggle("is-locked", locked));
    document.querySelectorAll(`[data-row-label="${rowKey}"]`).forEach((label) => {
      label.textContent = state.rowMute[rowKey]
        ? `${row?.label || rowKey} M`
        : locked
          ? `${row?.label || rowKey} L`
          : (row?.label || rowKey);
    });
    const button = document.querySelector(`[data-row-lock="${rowKey}"]`);
    if (button) {
      button.classList.toggle("active", locked);
      button.setAttribute("aria-pressed", String(locked));
      button.title = locked ? `${row?.title || rowKey} locked for RAND/MUTATE` : `${row?.title || rowKey} unlocked`;
    }
  }

  function applyModeToCell(cell, mode) {
    cell.className = cell.className
      .split(/\s+/)
      .filter((name) => name && !name.startsWith("mode-"))
      .join(" ");
    if (mode && mode !== MODE_EMPTY) cell.classList.add(`mode-${mode}`);
    cell.dataset.mode = mode || MODE_EMPTY;
    cell.textContent = SYMBOLS[mode] || "";
    cell.title = mode === MODE_EMPTY ? "Empty" : mode.toUpperCase();
  }

  function cellDomKey(rowKey, step) {
    return `${rowKey}:${step}`;
  }

  function removeModeClasses(element) {
    if (!element) return;
    element.className = String(element.className || "")
      .split(/\s+/)
      .filter((name) => name && !name.startsWith("mode-"))
      .join(" ");
  }

  function updateMinimapCell(rowKey, step, mode) {
    const dot = dom.dotsByCell.get(cellDomKey(rowKey, step));
    if (!dot) return false;
    removeModeClasses(dot);
    dot.classList.toggle("is-muted", Boolean(state.rowMute[rowKey]));
    dot.classList.toggle("is-locked", Boolean(state.rowLock[rowKey]));
    if (mode && mode !== MODE_EMPTY) dot.classList.add(`mode-${mode}`);
    return true;
  }

  function strongestModeForStep(step) {
    for (const row of ROWS) {
      const value = state.grid?.[row.key]?.[step] || MODE_EMPTY;
      if (value && value !== MODE_EMPTY) return value;
    }
    return "";
  }

  function updateCollapsedSlot(step) {
    const slot = dom.collapsedSlots.get(step);
    if (!slot) return false;
    removeModeClasses(slot);
    slot.classList.remove("has-event");
    const strongest = strongestModeForStep(step);
    if (strongest) {
      slot.classList.add("has-event", `mode-${strongest}`);
      slot.title = `${step + 1}: ${strongest}`;
    } else {
      slot.removeAttribute("title");
    }
    return true;
  }

  function markerClassForStep(step) {
    const phrases = state.arrangementMeta?.phrases || [];
    const phrase = phrases.find((item) => item.base === step);
    if (!phrase) return "";
    if (phrase.isSpecial) return "phrase-special";
    if (phrase.isSectionStart) return "phrase-start";
    return "";
  }

  function renderGrid(force = false) {
    return profileOp37BO("renderGrid", () => renderGridImpl(force));
  }

  function renderGridImpl(force = false) {
    const grid = $("quickStepGrid");
    if (!grid) return;
    if (!force
      && dom.gridBuiltForStart === state.windowStart
      && dom.gridBuiltForVisible === state.visibleCount
      && dom.gridBuiltForLength === state.cycleLength) return;

    dom.gridBuiltForStart = state.windowStart;
    dom.gridBuiltForVisible = state.visibleCount;
    dom.gridBuiltForLength = state.cycleLength;
    dom.cellsByStep.clear();
    dom.cellsByCell.clear();
    dom.stepHeaders.clear();
    dom.highlightedStep = -1;
    grid.textContent = "";
    grid.style.setProperty("--quick-step-visible", String(state.visibleCount));

    const corner = document.createElement("div");
    corner.className = "quick-step-corner";
    corner.textContent = "ST";
    corner.style.gridColumn = "1";
    corner.style.gridRow = "1";
    grid.appendChild(corner);

    for (let column = 0; column < state.visibleCount; column += 1) {
      const step = state.windowStart + column;
      const beatStart = beatForSlot(step);
      const beatEnd = Math.min(state.cycleLength, beatStart + BEATS_PER_SLOT);
      const header = document.createElement("div");
      header.className = "quick-step-step-num";
      const markerClass = markerClassForStep(step);
      if (markerClass) header.classList.add(markerClass);
      header.classList.add("beat-4");
      if (beatStart % 16 === 0) header.classList.add("beat-16");
      if (beatStart % 64 === 0) header.classList.add("beat-64");
      header.textContent = String(beatStart + 1);
      header.title = `Beat ${beatStart + 1}-${beatEnd}`;
      header.style.gridColumn = String(column + 2);
      header.style.gridRow = "1";
      dom.stepHeaders.set(step, header);
      grid.appendChild(header);
    }

    ROWS.forEach((row, rowIndex) => {
      const label = document.createElement("div");
      label.className = `quick-step-row-label layer-${row.layer}`;
      label.dataset.rowLabel = row.key;
      label.textContent = state.rowMute[row.key] ? `${row.label} M` : state.rowLock[row.key] ? `${row.label} L` : row.label;
      label.title = `${row.title} · klik = mute/unmute řádku`;
      label.style.gridColumn = "1";
      label.style.gridRow = String(rowIndex + 2);
      label.classList.toggle("is-muted", Boolean(state.rowMute[row.key]));
      label.classList.toggle("is-locked", Boolean(state.rowLock[row.key]));
      label.addEventListener("click", () => toggleRowMute(row.key));
      grid.appendChild(label);

      for (let column = 0; column < state.visibleCount; column += 1) {
        const step = state.windowStart + column;
        const beatStart = beatForSlot(step);
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = `quick-step-cell layer-${row.layer}`;
        const markerClass = markerClassForStep(step);
        if (markerClass) cell.classList.add(markerClass);
        cell.classList.toggle("is-muted", Boolean(state.rowMute[row.key]));
        cell.classList.toggle("is-locked", Boolean(state.rowLock[row.key]));
        cell.classList.add("beat-4");
        if (beatStart % 16 === 0) cell.classList.add("beat-16");
        if (beatStart % 64 === 0) cell.classList.add("beat-64");
        cell.dataset.row = row.key;
        cell.dataset.step = String(step);
        cell.style.gridColumn = String(column + 2);
        cell.style.gridRow = String(rowIndex + 2);
        applyModeToCell(cell, state.grid[row.key][step]);
        dom.cellsByCell.set(cellDomKey(row.key, step), cell);
        if (!dom.cellsByStep.has(step)) dom.cellsByStep.set(step, []);
        dom.cellsByStep.get(step).push(cell);
        grid.appendChild(cell);
      }
    });

    updateHighlight(true);
  }

  function cellFromEvent(event) {
    const cell = event.target?.closest?.(".quick-step-cell");
    if (!cell || !$("quickStepGrid")?.contains(cell)) return null;
    const rowKey = String(cell.dataset.row || "");
    const row = ROW_BY_KEY.get(rowKey);
    const step = Number(cell.dataset.step);
    if (!row || !Number.isFinite(step)) return null;
    return { cell, row, step };
  }

  function handleGridPointerDown(event) {
    if (!state.eraseMode) return;
    const hit = cellFromEvent(event);
    if (!hit) return;
    event.preventDefault();
    dom.erasing = true;
    dom.erasingChanged = false;
    pushUndo();
    if (eraseCell(hit.row.key, hit.step, { noUndo: true, noSave: true })) dom.erasingChanged = true;
  }

  function handleGridPointerOver(event) {
    if (!state.eraseMode || !dom.erasing) return;
    const hit = cellFromEvent(event);
    if (!hit) return;
    if (eraseCell(hit.row.key, hit.step, { noUndo: true, noSave: true })) dom.erasingChanged = true;
  }

  function handleGridClick(event) {
    const hit = cellFromEvent(event);
    if (!hit) return;
    if (state.eraseMode) {
      event.preventDefault();
      return;
    }
    const current = state.grid[hit.row.key][hit.step] || MODE_EMPTY;
    const currentIndex = hit.row.cycle.indexOf(current);
    const next = hit.row.cycle[(currentIndex + 1) % hit.row.cycle.length] || MODE_EMPTY;
    setCellMode(hit.row.key, hit.step, next);
  }

  function renderMinimap(force = false) {
    const minimap = $("quickStepMinimap");
    if (!minimap) return;

    const signature = minimapSignature();
    const alreadyBuilt = dom.minimapBuiltForLength === state.cycleLength
      && dom.minimapBuiltForSignature === signature
      && dom.dotsByCell.size > 0;
    if (!force && alreadyBuilt) {
      updateMinimapViewport();
      renderCollapsedMini(false);
      return;
    }

    minimap.textContent = "";
    dom.dotsByCell.clear();
    dom.minimapPlayhead = null;
    dom.minimapWindowBox = null;
    dom.minimapBuiltForLength = state.cycleLength;
    dom.minimapBuiltForSignature = signature;
    minimap.style.setProperty("--quick-step-total", String(totalSlots()));
    const fragment = document.createDocumentFragment();

    ROWS.forEach((row, rowIndex) => {
      for (let step = 0; step < totalSlots(); step += 1) {
        const dot = document.createElement("span");
        const mode = state.grid[row.key][step] || MODE_EMPTY;
        dot.className = `quick-step-dot row-${row.key} layer-${row.layer}`;
        const markerClass = markerClassForStep(step);
        if (markerClass) dot.classList.add(markerClass);
        if (mode !== MODE_EMPTY) dot.classList.add(`mode-${mode}`);
        dot.classList.toggle("is-muted", Boolean(state.rowMute[row.key]));
        dot.classList.toggle("is-locked", Boolean(state.rowLock[row.key]));
        dot.dataset.row = row.key;
        dot.dataset.step = String(step);
        dom.dotsByCell.set(cellDomKey(row.key, step), dot);
        dot.style.gridColumn = String(step + 1);
        dot.style.gridRow = String(rowIndex + 1);
        fragment.appendChild(dot);
      }
    });

    for (const phrase of state.arrangementMeta?.phrases || []) {
      const marker = document.createElement("span");
      marker.className = `quick-step-minimap-marker ${phrase.isSpecial ? "is-special" : phrase.isSectionStart ? "is-phrase" : "is-subtle"}`;
      marker.style.left = `${(phrase.base / totalSlots()) * 100}%`;
      fragment.appendChild(marker);
    }

    const windowBox = document.createElement("span");
    windowBox.className = "quick-step-window-box";
    windowBox.style.left = `${(state.windowStart / totalSlots()) * 100}%`;
    windowBox.style.width = `${(state.visibleCount / totalSlots()) * 100}%`;
    dom.minimapWindowBox = windowBox;
    fragment.appendChild(windowBox);

    const playhead = document.createElement("span");
    playhead.className = "quick-step-minimap-playhead";
    playhead.style.left = `${((state.currentStep + 0.5) / totalSlots()) * 100}%`;
    dom.minimapPlayhead = playhead;
    fragment.appendChild(playhead);

    minimap.appendChild(fragment);
    renderCollapsedMini(true);
  }

  function renderCollapsedMini(force = false) {
    const mini = $("quickStepCollapsedMini");
    if (!mini) return;
    const total = totalSlots();
    const start = clamp(state.windowStart, 0, Math.max(0, total - state.visibleCount));
    if (!force
      && dom.collapsedBuiltForStart === start
      && dom.collapsedBuiltForVisible === state.visibleCount
      && dom.collapsedBuiltForLength === state.cycleLength
      && dom.collapsedSlots.size > 0) return;

    mini.textContent = "";
    dom.collapsedSlots.clear();
    dom.collapsedHighlightedStep = -1;
    dom.collapsedBuiltForStart = start;
    dom.collapsedBuiltForVisible = state.visibleCount;
    dom.collapsedBuiltForLength = state.cycleLength;
    const fragment = document.createDocumentFragment();
    const end = Math.min(total, start + state.visibleCount);

    for (let step = start; step < end; step += 1) {
      const slot = document.createElement("span");
      slot.className = "quick-step-collapsed-slot";
      if (step === state.currentStep) slot.classList.add("is-current");
      if ((beatForSlot(step) % 16) === 0) slot.classList.add("is-phrase");

      const strongest = strongestModeForStep(step);
      if (strongest) {
        slot.classList.add("has-event", `mode-${strongest}`);
        slot.title = `${step + 1}: ${strongest}`;
      }
      dom.collapsedSlots.set(step, slot);
      fragment.appendChild(slot);
    }
    mini.appendChild(fragment);
  }

  function updateTimeline() {
    return profileOp37BO("updateTimeline", () => updateTimelineImpl());
  }

  function updateTimelineImpl() {
    const label = $("quickStepWindowLabel");
    if (label) {
      const endSlot = Math.min(totalSlots(), state.windowStart + state.visibleCount);
      const startBeat = beatForSlot(state.windowStart) + 1;
      const endBeat = Math.min(state.cycleLength, beatForSlot(endSlot));
      label.textContent = `${startBeat}-${endBeat} / ${state.cycleLength} BEATS | ${state.windowStart + 1}-${endSlot}/${totalSlots()} SLOTS`;
    }
    renderMinimap();
    updateNavStatus();
  }

  function isSequencerUiVisible() {
    const panel = $("quickStepAutoPanel");
    if (!panel || !panel.isConnected) return false;
    if (document.hidden) return false;
    const rect = panel.getBoundingClientRect?.();
    if (!rect) return true;
    return rect.width > 0 && rect.height > 0 && rect.bottom >= 0 && rect.top <= (window.innerHeight || 0);
  }

  function shouldRunLightUiTick(now = performance.now()) {
    if (now - lastLightUiTickAt < LIGHT_UI_TICK_MS) return false;
    lastLightUiTickAt = now;
    return true;
  }

  function updateStatus(force = false) {
    const status = $("quickStepStatus");
    if (!status) return;
    const now = performance.now();
    if (!force
      && dom.statusBuiltForStep === state.currentStep
      && dom.statusBuiltForBeat === state.currentBeat
      && dom.statusBuiltForEnabled === state.enabled
      && now - dom.statusLastUpdatedAt < 180) return;
    dom.statusBuiltForStep = state.currentStep;
    dom.statusBuiltForBeat = state.currentBeat;
    dom.statusBuiltForEnabled = state.enabled;
    dom.statusLastUpdatedAt = now;
    const windowFirstBeat = beatForSlot(state.windowStart) + 1;
    const windowLastBeat = Math.min(state.cycleLength, beatForSlot(Math.min(totalSlots(), state.windowStart + state.visibleCount)));
    const text = `${state.enabled ? "ON" : "OFF"} | SLOT ${state.currentStep + 1}/${totalSlots()} | BEAT ${state.currentBeat + 1}/${state.cycleLength} | VIEW ${windowFirstBeat}-${windowLastBeat}`;
    if (dom.statusText !== text) {
      dom.statusText = text;
      status.textContent = text;
    }
  }

  function updateControls(forceTimeline = false) {
    $("quickStepAutoPanel")?.classList.toggle("collapsed", state.collapsed);
    renderCollapsedMini();

    const enable = $("quickStepEnable");
    if (enable) {
      enable.textContent = state.enabled ? "ON" : "OFF";
      enable.classList.toggle("active", state.enabled);
      enable.setAttribute("aria-pressed", String(state.enabled));
    }

    const follow = $("quickStepFollow");
    if (follow) {
      follow.textContent = state.follow ? "FOLLOW ON" : "FOLLOW OFF";
      follow.classList.toggle("active", state.follow);
      follow.setAttribute("aria-pressed", String(state.follow));
    }

    const collapse = $("quickStepCollapse");
    if (collapse) {
      collapse.textContent = state.collapsed ? "▼" : "▲";
      collapse.setAttribute("aria-expanded", String(!state.collapsed));
    }

    const erase = $("quickStepErase");
    if (erase) {
      erase.textContent = state.eraseMode ? "GUMA ON" : "GUMA";
      erase.classList.toggle("active", state.eraseMode);
      erase.setAttribute("aria-pressed", String(state.eraseMode));
    }

    const undo = $("quickStepUndo");
    if (undo) undo.disabled = undoStack.length === 0;

    document.querySelectorAll("[data-step-length]").forEach((button) => {
      button.classList.toggle("active", Number(button.dataset.stepLength) === state.cycleLength);
    });
    document.querySelectorAll("[data-humanize]").forEach((button) => {
      button.classList.toggle("active", String(button.dataset.humanize || "") === state.humanize);
    });
    document.querySelectorAll("[data-row-lock]").forEach((button) => {
      const rowKey = String(button.dataset.rowLock || "");
      const locked = Boolean(state.rowLock[rowKey]);
      button.classList.toggle("active", locked);
      button.setAttribute("aria-pressed", String(locked));
    });

    updatePatternControls();
    updateCompareControls();
    updateStatus(true);
    updateNavStatus();
    updateProfilerHud37BO(false);
    if (forceTimeline) updateTimeline();
  }

  function updateNavStatus() {
    const el = $("quickStepNavStatus");
    if (!el) return;
    const firstBeat = beatForSlot(state.windowStart) + 1;
    const endSlot = Math.min(totalSlots(), state.windowStart + state.visibleCount);
    const lastBeat = Math.min(state.cycleLength, beatForSlot(endSlot));
    const currentInView = state.currentStep >= state.windowStart && state.currentStep < endSlot;
    el.textContent = `PLAYHEAD ${state.currentStep + 1}/${totalSlots()} · VIEW ${firstBeat}-${lastBeat} · |‹ → ${firstBeat}`;
    el.classList.toggle("is-outside-view", !currentInView);
    el.title = "+1/−1 posouvá skutečný beat/playhead. ‹/› posouvá pouze zobrazení. |‹ skočí na první políčko aktuálního zobrazení.";
  }

  function updateHighlight(force = false) {
    if (!force && dom.highlightedStep === state.currentStep) return;

    if (dom.highlightedStep >= 0 && dom.highlightedStep !== state.currentStep) {
      dom.stepHeaders.get(dom.highlightedStep)?.classList.remove("now");
      const previousCells = dom.cellsByStep.get(dom.highlightedStep) || [];
      previousCells.forEach((cell) => cell.classList.remove("now"));
    }

    dom.stepHeaders.get(state.currentStep)?.classList.add("now");
    const currentCells = dom.cellsByStep.get(state.currentStep) || [];
    currentCells.forEach((cell) => cell.classList.add("now"));
    dom.highlightedStep = state.currentStep;

    if (dom.minimapPlayhead?.isConnected) {
      dom.minimapPlayhead.style.left = `${((state.currentStep + 0.5) / totalSlots()) * 100}%`;
    } else {
      const playhead = $("quickStepMinimap")?.querySelector(".quick-step-minimap-playhead");
      if (playhead) {
        dom.minimapPlayhead = playhead;
        playhead.style.left = `${((state.currentStep + 0.5) / totalSlots()) * 100}%`;
      }
    }

    if (dom.collapsedHighlightedStep >= 0 && dom.collapsedHighlightedStep !== state.currentStep) {
      dom.collapsedSlots.get(dom.collapsedHighlightedStep)?.classList.remove("is-current");
    }
    dom.collapsedSlots.get(state.currentStep)?.classList.add("is-current");
    dom.collapsedHighlightedStep = state.currentStep;
  }

  function renderAll(forceGrid = false) {
    return profileOp37BO("renderAll", () => {
      renderGrid(forceGrid);
      updateTimeline();
      updateControls();
      updateHighlight(true);
    });
  }

  function readBpm() {
    const bpm = Number($("bpm")?.value || $("bpmValue")?.textContent || state.lastBpm || 120);
    return Number.isFinite(bpm) ? clamp(bpm, 20, 260) : 120;
  }

  function readGlobalBeatPosition() {
    try {
      if (typeof window.getBeatPosition !== "function") return null;
      const value = Number(window.getBeatPosition());
      return Number.isFinite(value) && value >= 0 ? value : null;
    } catch {
      return null;
    }
  }

  function syncBeatState(beatFloat) {
    const absoluteBeat = Math.floor(Math.max(0, Number(beatFloat) || 0));
    state.currentBeat = ((absoluteBeat % state.cycleLength) + state.cycleLength) % state.cycleLength;
    state.currentStep = Math.floor(state.currentBeat / BEATS_PER_SLOT);
  }

  function pageStartForStep(step) {
    const page = Math.floor(clamp(step, 0, totalSlots() - 1) / state.visibleCount);
    return clamp(page * state.visibleCount, 0, Math.max(0, totalSlots() - state.visibleCount));
  }

  function centeredStartForStep(step) {
    return clamp(step - Math.floor(state.visibleCount / 2), 0, Math.max(0, totalSlots() - state.visibleCount));
  }

  function ensureCurrentVisible() {
    if (!state.follow || state.collapsed) return;
    const end = state.windowStart + state.visibleCount;
    if (state.currentStep < state.windowStart || state.currentStep >= end) {
      setWindowStart(pageStartForStep(state.currentStep), { noSave: true, force: true });
    }
  }

  function setWindowStart(nextStart, options = {}) {
    const maxStart = Math.max(0, totalSlots() - state.visibleCount);
    const normalized = clamp(Math.round(Number(nextStart) || 0), 0, maxStart);
    if (normalized === state.windowStart && !options.force) return;
    state.windowStart = normalized;
    renderGrid(true);
    updateTimeline();
    updateHighlight(true);
    if (!options.noSave) scheduleStateSave();
  }


  function seekSequencerSlot(targetSlot, options = {}) {
    const slot = clamp(Math.round(Number(targetSlot) || 0), 0, totalSlots() - 1);
    const targetBeat = beatForSlot(slot);

    try {
      if (typeof window.seekBeatPosition === "function") {
        window.seekBeatPosition(targetBeat);
      } else {
        const bpm = readBpm();
        const beatMs = 60000 / Math.max(1, bpm || 120);
        state.beatZeroMs = performance.now() - targetBeat * beatMs;
      }
    } catch {
      const bpm = readBpm();
      const beatMs = 60000 / Math.max(1, bpm || 120);
      state.beatZeroMs = performance.now() - targetBeat * beatMs;
    }

    syncBeatState(targetBeat);
    state.lastStep = -1;
    if (options.keepView !== true && state.follow) setWindowStart(pageStartForStep(state.currentStep), { noSave: true, force: true });
    if (state.enabled) runStep(state.currentStep);
    updateStatus(true);
    updateHighlight(true);
    saveTransportState();
    sendSequencerCommand37BM("seek", { step: state.currentStep, beat: state.currentBeat }, { reason: "sequencer-seek" });
  }

  function nudgeSequencerStep(deltaSlots) {
    setFollow(false);
    seekSequencerSlot(state.currentStep + Math.round(Number(deltaSlots) || 0), { keepView: true });
  }

  function jumpToCurrentWindowStart() {
    setFollow(false);
    seekSequencerSlot(state.windowStart, { keepView: true });
  }

  function setVisibleCount(nextCount) {
    const normalized = normalizeVisibleCount(nextCount);
    if (normalized === state.visibleCount) return;
    state.visibleCount = normalized;
    state.windowStart = clamp(state.windowStart, 0, Math.max(0, totalSlots() - state.visibleCount));
    renderGrid(true);
    updateTimeline();
    updateHighlight(true);
    scheduleStateSave();
  }

  function fitVisibleToLayout(options = {}) {
    const normalized = normalizeVisibleCount(state.visibleCount);
    if (normalized === state.visibleCount && !options.force) return;
    state.visibleCount = normalized;
    state.windowStart = clamp(state.windowStart, 0, Math.max(0, totalSlots() - state.visibleCount));
    renderGrid(true);
    updateTimeline();
    updateHighlight(true);
    if (!options.noSave) scheduleStateSave();
  }

  function setCycleLength(nextLength) {
    const length = LENGTHS.includes(Number(nextLength)) ? Number(nextLength) : 64;
    if (length === state.cycleLength) return;
    state.cycleLength = length;
    state.grid = normalizeGrid(state.grid, length);
    state.visibleCount = normalizeVisibleCount(state.visibleCount, length);
    state.windowStart = clamp(state.windowStart, 0, Math.max(0, totalSlots() - state.visibleCount));
    state.lastStep = state.currentStep;
    invalidateGrid();
    scheduleRenderAll(true, 24);
    scheduleStateSave();
  }

  function resetBeat() {
    try {
      if (typeof window.resetBeat === "function") window.resetBeat();
    } catch {}
    state.beatZeroMs = performance.now();
    state.currentBeat = 0;
    state.currentStep = 0;
    state.lastStep = -1;
    if (state.follow) setWindowStart(0, { noSave: true, force: true });
    try {
      window.dispatchEvent(new CustomEvent("budilight:quick-step-beat-reset", { detail: { cycleLength: state.cycleLength } }));
    } catch {}
    if (state.enabled) runStep(0);
    updateStatus();
    updateHighlight(true);
  }

  function syncBeat() {
    try {
      if (typeof window.syncBeatToNearestDownbeat === "function") {
        const snappedBeat = Number(window.syncBeatToNearestDownbeat(16));
        if (Number.isFinite(snappedBeat)) {
          syncBeatState(snappedBeat);
          state.lastStep = state.currentStep;
          if (state.follow) setWindowStart(pageStartForStep(state.currentStep), { noSave: true, force: true });
          updateStatus();
          updateHighlight(true);
          return;
        }
      }
    } catch {}
    resetBeat();
  }

  function readFxHold(layer) {
    const hold = $(`fx${layer}_hold`);
    if (!hold) return false;
    return hold.classList.contains("active") || String(hold.textContent || "").trim().toUpperCase() === "ON";
  }

  function readFxMode(layer) {
    const select = $(`fx${layer}_mode`);
    return select ? String(select.value || "none") : "none";
  }

  function readFlip(layer) {
    return Boolean($(`l${layer}_reverse`)?.checked);
  }

  function clickControl(id) {
    const element = $(id);
    if (!element || element.disabled) return false;
    element.click();
    return true;
  }

  function performAnim(layer, mode) {
    const api = fastApi();
    if (api && typeof api.stepModule === "function" && typeof api.randomModule === "function") {
      if (mode === "prev") return api.stepModule(layer, "anim", -1, { delayMs: 1, ui: false, commit: false, warmup: false, coalesce: true, debounceMs: 8 }) !== false;
      if (mode === "next") return api.stepModule(layer, "anim", 1, { delayMs: 1, ui: false, commit: false, warmup: false, coalesce: true, debounceMs: 8 }) !== false;
      if (mode === "random") return api.randomModule(layer, "anim", { delayMs: 1, ui: false, commit: false, warmup: false, coalesce: true, debounceMs: 12 }) !== false;
    }
    if (mode === "prev") return clickControl(`l${layer}_anim_prev`);
    if (mode === "next") return clickControl(`l${layer}_anim_next`);
    if (mode === "random") return clickControl(`l${layer}_anim_reset`);
    return false;
  }

  function performPalette(layer, mode) {
    const api = fastApi();
    if (api && typeof api.stepModule === "function" && typeof api.randomModule === "function") {
      if (mode === "prev") return api.stepModule(layer, "palette", -1, { delayMs: 1, ui: false, commit: false, warmup: false, coalesce: true, debounceMs: 8 }) !== false;
      if (mode === "next") return api.stepModule(layer, "palette", 1, { delayMs: 1, ui: false, commit: false, warmup: false, coalesce: true, debounceMs: 8 }) !== false;
      if (mode === "random") return api.randomModule(layer, "palette", { delayMs: 1, ui: false, commit: false, warmup: false, coalesce: true, debounceMs: 12 }) !== false;
    }
    if (mode === "prev") return clickControl(`l${layer}_palette_prev`);
    if (mode === "next") return clickControl(`l${layer}_palette_next`);
    if (mode === "random") return clickControl(`l${layer}_palette_reset`);
    return false;
  }

  function callFastApiMethod(name, args = []) {
    const api = fastApi();
    const fn = api && typeof api[name] === "function" ? api[name] : null;
    if (!fn) return false;
    try { return fn.apply(api, args) === true; } catch { return false; }
  }

  function performRandomParams(layer) {
    // STEP37EC: param random is a live-output action, not only a local UI action.
    // It must send a tiny volatile state patch immediately, otherwise the hidden
    // output runner/headless frame may keep rendering the old params until a much
    // later persistence flush. Anim/color remain deferred; params do not.
    const safeLayer = Number(layer) === 2 ? 2 : 1;
    const ok = callFastApiMethod("randomizeParams", [safeLayer, {
      delayMs: 0,
      ui: false,
      commit: true,
      transport: "command",
      volatile: true,
      persist: false,
      commandKind: "stepseq-param-live",
      transition: true,
      gentle: true,
      amount: 0.42,
      reason: "sequencer-param-live"
    }]);
    try {
      state.profiler.lastParamLayer = safeLayer;
      state.profiler.lastParamAt = Date.now();
      state.profiler.lastParamFastApi = Boolean(ok);
      publishStepProfiler();
    } catch {}
    if (ok) return true;
    return clickControl(`l${safeLayer}_params_random`);
  }

  function setFlip(layer, enabled) {
    // STEP37EB: require an actual true result from the fast API. If the bridge
    // has not been exported yet, fall back to the same change event path as the
    // manual checkbox instead of silently returning success.
    const next = Boolean(enabled);
    const ok = callFastApiMethod("setFlip", [layer, next, {
      delayMs: 1,
      ui: false,
      commit: false,
      forceFlush: true,
      reason: "sequencer-flip"
    }]);
    const checkbox = $(`l${layer}_reverse`);
    if (ok) {
      if (checkbox) checkbox.checked = next;
      return true;
    }
    if (!checkbox) return false;
    if (checkbox.checked === next) return true;
    checkbox.checked = next;
    checkbox.dispatchEvent(new Event("input", { bubbles: true }));
    checkbox.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  function setFx(layer, mode, hold) {
    if (callFastApiMethod("setFx", [layer, mode, hold, { delayMs: 1, ui: false, commit: false }])) {
      const select = $(`fx${layer}_mode`);
      const button = $(`fx${layer}_hold`);
      if (select && typeof mode === "string") select.value = mode;
      if (button && typeof hold === "boolean") {
        button.textContent = hold ? "ON" : "OFF";
        button.classList.toggle("active", hold);
      }
      return true;
    }

    const select = $(`fx${layer}_mode`);
    if (select && typeof mode === "string" && select.value !== mode) {
      select.value = mode;
      select.dispatchEvent(new Event("input", { bubbles: true }));
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }

    const button = $(`fx${layer}_hold`);
    if (button && typeof hold === "boolean" && readFxHold(layer) !== hold) {
      button.click();
    }
    return Boolean(select || button);
  }

  function flushFastApi(options = {}) {
    const commit = options.commit === true;
    const delayMs = Number.isFinite(Number(options.delayMs)) ? Number(options.delayMs) : (commit ? 8 : 1);
    try {
      fastApi()?.flush?.({ ui: false, commit, delayMs });
    } catch {}
  }

  function scheduleDeferredCommitFlush(delayMs = 180) {
    if (deferredCommitTimer) return;
    deferredCommitRequestedAt = performance.now();
    state.profiler.deferredCommits += 1;
    deferredCommitTimer = managedTimeout37CE('deferred-commit', () => {
      deferredCommitTimer = 0;
      const t0 = performance.now();
      flushFastApi({ commit: true, delayMs: 8 });
      state.profiler.lastCommitted = true;
      state.profiler.lastCommitDelayMs = Math.round(Math.max(0, t0 - deferredCommitRequestedAt) * 10) / 10;
      publishStepProfiler();
    }, Math.max(40, Number(delayMs) || 180));
  }

  function releaseMomentaryState(layer, nextFxMode, nextFlipMode) {
    if ((!nextFxMode || nextFxMode === MODE_EMPTY) && state.ownedFx[layer]) {
      const restore = state.fxRestore[layer];
      if (restore && typeof restore === "object") setFx(layer, restore.mode || "none", Boolean(restore.hold));
      else setFx(layer, "none", false);
      state.ownedFx[layer] = false;
      state.fxRestore[layer] = null;
    }
    if (nextFlipMode !== "flip" && state.ownedFlip[layer]) {
      const restore = state.flipRestore[layer];
      setFlip(layer, typeof restore === "boolean" ? restore : false);
      state.ownedFlip[layer] = false;
      state.flipRestore[layer] = null;
    }
  }

  function deferHeavyRowsEnabled() {
    try { return localStorage.getItem('budilightStepSeqDeferHeavyRows37AQ') !== '0'; } catch { return true; }
  }

  function enqueueHeavyRowAction(rowKey, layer, mode, fn) {
    if (!state._deferredHeavyActions) state._deferredHeavyActions = [];
    const queue = state._deferredHeavyActions;
    // STEP37DH: coalesce same-row heavy actions inside one beat window. Dense
    // sequencer patterns can otherwise enqueue anim/color changes faster than
    // the UI module switcher can apply them, which creates a delayed burst and
    // a visible step hitch. The last requested action for the row wins.
    const existing = queue.find((item) => item && item.rowKey === rowKey);
    const payload = { rowKey, layer, mode, fn, requestedAt: performance.now() };
    if (existing) {
      Object.assign(existing, payload);
      state.profiler.heavyCoalesced = Number(state.profiler.heavyCoalesced || 0) + 1;
    } else {
      queue.push(payload);
      state.profiler.heavyDeferred += 1;
    }
    state.profiler.heavyQueue = queue.length;
    if (deferredHeavyTimer) return;
    deferredHeavyRequestedAt = performance.now();
    deferredHeavyTimer = managedTimeout37CE('deferred-heavy', runDeferredHeavyActions, HEAVY_ROW_DEFER_MS, { liveFactor: 1.15, hiddenFactor: 3, maxMs: 600 });
  }

  function runDeferredHeavyActions() {
    deferredHeavyTimer = 0;
    const queue = state._deferredHeavyActions || [];
    if (!queue.length) {
      state.profiler.heavyQueue = 0;
      publishStepProfiler();
      return;
    }
    const t0 = performance.now();
    let applied = 0;
    while (queue.length && (performance.now() - t0) < HEAVY_ROW_BUDGET_MS) {
      const item = queue.shift();
      try { item.fn(); applied += 1; } catch {}
    }
    const t1 = performance.now();
    state.profiler.heavyApplied += applied;
    state.profiler.heavyQueue = queue.length;
    state.profiler.lastHeavyMs = Math.round(Math.max(0, t1 - t0) * 10) / 10;
    state.profiler.lastHeavyDelayMs = Math.round(Math.max(0, t0 - deferredHeavyRequestedAt) * 10) / 10;
    if (applied > 0) {
      flushFastApi({ commit: false, delayMs: 1 });
      scheduleDeferredCommitFlush(queue.length ? 320 : 220);
    }
    publishStepProfiler();
    if (queue.length) {
      deferredHeavyRequestedAt = performance.now();
      deferredHeavyTimer = managedTimeout37CE('deferred-heavy', runDeferredHeavyActions, HEAVY_ROW_DEFER_MS, { liveFactor: 1.15, hiddenFactor: 3, maxMs: 600 });
    }
  }

  function applyRowAction(rowKey, mode) {
    if (state.rowMute[rowKey]) return;
    if (!mode || mode === MODE_EMPTY) return;
    const row = ROW_BY_KEY.get(rowKey);
    if (!row) return;
    const layer = row.layer;

    if (row.role === "anim") {
      if (deferHeavyRowsEnabled()) enqueueHeavyRowAction(rowKey, layer, mode, () => performAnim(layer, mode));
      else performAnim(layer, mode);
      return;
    }
    if (row.role === "color") {
      if (deferHeavyRowsEnabled()) enqueueHeavyRowAction(rowKey, layer, mode, () => performPalette(layer, mode));
      else performPalette(layer, mode);
      return;
    }
    if (row.role === "param") {
      // Param random is light and must fire right on the programmed slot.
      // Only anim/color module changes stay in the deferred heavy queue.
      performRandomParams(layer);
      return;
    }
    if (row.role === "flip") {
      if (!state.ownedFlip[layer]) state.flipRestore[layer] = readFlip(layer);
      setFlip(layer, true);
      state.ownedFlip[layer] = true;
      return;
    }
    if (row.role === "fx") {
      const selectedMode = mode === "fxrandom"
        ? FX_MODES[Math.floor(Math.random() * FX_MODES.length)]
        : mode;
      if (!state.ownedFx[layer]) {
        state.fxRestore[layer] = { mode: readFxMode(layer), hold: readFxHold(layer) };
      }
      setFx(layer, selectedMode, true);
      state.ownedFx[layer] = true;
    }
  }

  function rowMode(rowKey, step) {
    return state.rowMute[rowKey] ? MODE_EMPTY : state.grid[rowKey]?.[step];
  }

  function runStep(step) {
    const profiler = state.profiler;
    const t0 = performance.now();
    let tRelease = t0;
    let changedRows = 0;
    for (const layer of [1, 2]) {
      const fxMode = rowMode(`fx${layer}`, step);
      const flipMode = rowMode(`flip${layer}`, step);
      releaseMomentaryState(layer, fxMode, flipMode);
      tRelease = performance.now();
      const actions = [
        [`anim${layer}`, rowMode(`anim${layer}`, step)],
        [`color${layer}`, rowMode(`color${layer}`, step)],
        [`param${layer}`, rowMode(`param${layer}`, step)],
        [`flip${layer}`, flipMode],
        [`fx${layer}`, fxMode]
      ];
      for (const [rowKey, mode] of actions) {
        if (!state.rowMute[rowKey] && mode && mode !== MODE_EMPTY) changedRows += 1;
        applyRowAction(rowKey, mode);
      }
    }
    const tApply = performance.now();
    flushFastApi({ commit: false, delayMs: 1 });
    const tFlush = performance.now();
    if (changedRows > 0 && !(state._deferredHeavyActions && state._deferredHeavyActions.length)) scheduleDeferredCommitFlush(changedRows >= 3 ? 320 : 180);
    const total = tFlush - t0;
    profiler.runs += 1;
    profiler.lastStep = step;
    profiler.lastTotalMs = Math.round(total * 10) / 10;
    profiler.lastReleaseMs = Math.round(Math.max(0, tRelease - t0) * 10) / 10;
    profiler.lastApplyMs = Math.round(Math.max(0, tApply - tRelease) * 10) / 10;
    profiler.lastFlushMs = Math.round(Math.max(0, tFlush - tApply) * 10) / 10;
    profiler.maxTotalMs = Math.max(Number(profiler.maxTotalMs || 0), profiler.lastTotalMs);
    if (profiler.lastTotalMs >= 8) profiler.hitches8ms = Number(profiler.hitches8ms || 0) + 1;
    if (profiler.lastTotalMs >= 12) profiler.hitches12ms = Number(profiler.hitches12ms || 0) + 1;
    profiler.avgTotalMs = Math.round((((Number(profiler.avgTotalMs || 0) * Math.max(0, profiler.runs - 1)) + total) / Math.max(1, profiler.runs)) * 10) / 10;
    profiler.lastChangedRows = changedRows;
    profiler.lastCommitted = false;
    profiler.lastAt = Date.now();
    if (changedRows > 0) {
      sendSequencerCommand37BM("step-trigger", {
        step,
        beat: state.currentBeat,
        rowModes: snapshotStepModes37BM(step),
        changedRows
      }, { reason: "sequencer-step-trigger" });
    }
    publishStepProfiler();
  }

  function setEnabled(enabled) {
    state.enabled = Boolean(enabled);
    state.lastStep = state.currentStep;

    if (!state.enabled) {
      for (const layer of [1, 2]) {
        releaseMomentaryState(layer, MODE_EMPTY, MODE_EMPTY);
      }
      if (deferredHeavyTimer) { try { clearManagedTimeout37CE(deferredHeavyTimer); } catch {} deferredHeavyTimer = 0; }
      if (state._deferredHeavyActions && state._deferredHeavyActions.length) { state._deferredHeavyActions.length = 0; state.profiler.heavyQueue = 0; publishStepProfiler(); }
      flushFastApi({ commit: true, delayMs: 8 });
    }

    if (state.follow) setWindowStart(pageStartForStep(state.currentStep), { noSave: true, force: true });
    updateControls(true);
    updateHighlight(true);
    sendSequencerCommand37BM("transport", { enabled: state.enabled, step: state.currentStep }, { reason: "sequencer-transport" });
    scheduleStateSave();
  }

  function setFollow(enabled) {
    state.follow = Boolean(enabled);
    if (state.follow) setWindowStart(pageStartForStep(state.currentStep), { noSave: true, force: true });
    updateControls(true);
    sendSequencerCommand37BM("follow", { follow: state.follow }, { reason: "sequencer-follow" });
    scheduleStateSave();
  }

  function setCollapsed(collapsed) {
    state.collapsed = Boolean(collapsed);
    updateControls(true);
    scheduleStateSave();
  }

  function toggleEraseMode() {
    state.eraseMode = !state.eraseMode;
    updateControls();
  }

  function jumpFromMinimap(event, options = {}) {
    const minimap = $("quickStepMinimap");
    if (!minimap) return;
    const rect = minimap.getBoundingClientRect();
    if (!rect.width) return;
    const ratio = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    const step = Math.round(ratio * (totalSlots() - 1));
    const nextStart = options.center ? centeredStartForStep(step) : pageStartForStep(step);
    setWindowStart(nextStart, { noSave: true, force: true });
  }

  function bindControls() {
    const grid = $("quickStepGrid");
    if (grid && !grid.dataset.quickStepDelegated) {
      grid.dataset.quickStepDelegated = "1";
      grid.addEventListener("pointerdown", handleGridPointerDown);
      grid.addEventListener("pointerover", handleGridPointerOver);
      grid.addEventListener("click", handleGridClick);
    }

    $("quickStepEnable")?.addEventListener("click", () => setEnabled(!state.enabled));
    $("quickStepFollow")?.addEventListener("click", () => setFollow(!state.follow));
    $("quickStepSync")?.addEventListener("click", syncBeat);
    $("quickStepReset")?.addEventListener("click", resetBeat);
    $("quickStepUndo")?.addEventListener("click", undoLast);
    $("quickStepRandom")?.addEventListener("click", randomizePattern);
    $("quickStepMutateSoft")?.addEventListener("click", () => mutatePattern(0.15));
    $("quickStepMutateStrong")?.addEventListener("click", () => mutatePattern(0.30));
    $("quickStepClear")?.addEventListener("click", clearPattern);
    $("quickStepErase")?.addEventListener("click", toggleEraseMode);
    $("quickStepCollapse")?.addEventListener("click", () => setCollapsed(!state.collapsed));
    $("quickStepStoreA")?.addEventListener("click", () => storeCompareSlot("A"));
    $("quickStepLoadA")?.addEventListener("click", () => loadCompareSlot("A"));
    $("quickStepStoreB")?.addEventListener("click", () => storeCompareSlot("B"));
    $("quickStepLoadB")?.addEventListener("click", () => loadCompareSlot("B"));
    $("quickStepStepPrev")?.addEventListener("click", () => nudgeSequencerStep(-1));
    $("quickStepPagePrev")?.addEventListener("click", () => nudgeWindow(-state.visibleCount));
    $("quickStepWindowHome")?.addEventListener("click", jumpToCurrentWindowStart);
    $("quickStepPageNext")?.addEventListener("click", () => nudgeWindow(state.visibleCount));
    $("quickStepStepNext")?.addEventListener("click", () => nudgeSequencerStep(1));
    $("quickStepZoomMinus")?.addEventListener("click", () => {
      const allowed = VIEW_COUNTS.filter((count) => count <= totalSlots() && count <= maxVisibleForLayout());
      const index = allowed.indexOf(state.visibleCount);
      if (index > 0) setVisibleCount(allowed[index - 1]);
    });
    $("quickStepZoomPlus")?.addEventListener("click", () => {
      const allowed = VIEW_COUNTS.filter((count) => count <= totalSlots() && count <= maxVisibleForLayout());
      const index = allowed.indexOf(state.visibleCount);
      if (index >= 0 && index < allowed.length - 1) setVisibleCount(allowed[index + 1]);
    });
    $("quickStepPatternSlot")?.addEventListener("change", (event) => {
      state.patternSlot = String(event.target.value || "1");
      scheduleStateSave();
      updatePatternControls();
    });
    $("quickStepPatternSave")?.addEventListener("click", () => savePatternToSlot(state.patternSlot));
    $("quickStepPatternLoad")?.addEventListener("click", () => loadPatternFromSlot(state.patternSlot));
    document.querySelectorAll("[data-humanize]").forEach((button) => {
      button.addEventListener("click", () => {
        const next = String(button.dataset.humanize || "musical");
        if (!HUMANIZE_MODES.includes(next)) return;
        state.humanize = next;
        updateControls();
        scheduleStateSave();
      });
    });
    document.querySelectorAll("[data-row-lock]").forEach((button) => {
      button.addEventListener("click", () => toggleRowLock(String(button.dataset.rowLock || "")));
    });

    document.querySelectorAll("[data-step-length]").forEach((button) => {
      button.addEventListener("click", () => setCycleLength(Number(button.dataset.stepLength)));
    });

    function finishEraseGesture() {
      if (dom.erasingChanged) scheduleStateSave(450);
      dom.erasing = false;
      dom.erasingChanged = false;
    }

    document.addEventListener("pointerup", finishEraseGesture);
    document.addEventListener("pointercancel", finishEraseGesture);

    const minimap = $("quickStepMinimap");
    if (minimap) {
      let dragging = false;
      let dragChanged = false;
      minimap.addEventListener("pointerdown", (event) => {
        if (state.eraseMode) return;
        dragging = true;
        dragChanged = false;
        setFollow(false);
        minimap.setPointerCapture?.(event.pointerId);
        const before = state.windowStart;
        jumpFromMinimap(event, { center: true });
        if (state.windowStart !== before) dragChanged = true;
      });
      minimap.addEventListener("pointermove", (event) => {
        if (!dragging || state.eraseMode) return;
        const before = state.windowStart;
        jumpFromMinimap(event, { center: true });
        if (state.windowStart !== before) dragChanged = true;
      });
      const stop = () => {
        if (!dragging) return;
        dragging = false;
        if (dragChanged) scheduleStateSave(450);
        dragChanged = false;
      };
      minimap.addEventListener("pointerup", stop);
      minimap.addEventListener("pointercancel", stop);
      minimap.addEventListener("lostpointercapture", stop);
    }
  }

  function tick() {
    const globalBeat = readGlobalBeatPosition();
    if (globalBeat !== null) {
      syncBeatState(globalBeat);
    } else {
      const bpm = readBpm();
      if (state.lastBpm && Math.abs(bpm - state.lastBpm) > 0.01) {
        const oldBeatMs = 60000 / state.lastBpm;
        const newBeatMs = 60000 / bpm;
        const currentBeatFloat = Math.max(0, (performance.now() - state.beatZeroMs) / oldBeatMs);
        state.beatZeroMs = performance.now() - currentBeatFloat * newBeatMs;
      }
      state.lastBpm = bpm;
      const elapsed = Math.max(0, performance.now() - state.beatZeroMs);
      syncBeatState(elapsed / (60000 / bpm));
    }

    const stepChanged = state.currentStep !== state.lastStep;

    if (state.enabled && stepChanged) {
      state.lastStep = state.currentStep;
      runStep(state.currentStep);
    }

    const now = performance.now();
    const uiVisible = isSequencerUiVisible();

    if (stepChanged) {
      if (!state.enabled) state.lastStep = state.currentStep;
      if (uiVisible) {
        ensureCurrentVisible();
        updateHighlight();
        updateStatus(true);
      }
    } else if (uiVisible && shouldRunLightUiTick(now)) {
      updateStatus(false);
    }

    // localStorage is synchronous and can visibly hitch the browser. Keep the
    // reload-position safety net, but save transport only every few seconds
    // and only after the playhead actually moved. Position during normal page
    // navigation is derived from the global beat clock, so 1s writes were
    // unnecessary pressure on the live UI/output thread.
    if (state.currentStep !== lastTransportSavedStep && now - lastTransportSaveAt > TRANSPORT_SAVE_IDLE_MS) {
      lastTransportSaveAt = now;
      lastTransportSavedStep = state.currentStep;
      saveTransportState();
    }
  }

  function applyRemoteStepTrigger37BM(payload = {}) {
    const modes = payload?.rowModes && typeof payload.rowModes === "object" ? payload.rowModes : null;
    if (!modes) return false;
    withSuppressedSequencerCommand37BM(() => {
      for (const layer of [1, 2]) {
        const fxMode = modes[`fx${layer}`] || MODE_EMPTY;
        const flipMode = modes[`flip${layer}`] || MODE_EMPTY;
        releaseMomentaryState(layer, fxMode, flipMode);
        for (const rowKey of [`anim${layer}`, `color${layer}`, `param${layer}`, `flip${layer}`, `fx${layer}`]) {
          const mode = modes[rowKey] || MODE_EMPTY;
          if (mode && mode !== MODE_EMPTY) applyRowAction(rowKey, mode);
        }
      }
      flushFastApi({ commit: false, delayMs: 1 });
      scheduleDeferredCommitFlush(220);
    });
    return true;
  }

  function handleSequencerCommand37BM(event) {
    const detail = event?.detail || {};
    if (String(detail.kind || "") !== "sequencer-command") return;
    const payload = detail.payload || {};
    if (!payload || payload.source !== "quick-step") return;
    // STEP37EC: the websocket server echoes command-bus messages back to the
    // sender. Without this guard, a programmed PARAM cell can randomize twice:
    // once locally and once again from our own echoed step-trigger command.
    if (payload.clientId && payload.clientId === STEPSEQ_CLIENT_ID_37EC) return;
    withSuppressedSequencerCommand37BM(() => {
      try {
        if (payload.action === "grid-edit") {
          setCellMode(payload.rowKey, Number(payload.step), String(payload.mode || MODE_EMPTY), { noUndo: true, noSave: true });
          return;
        }
        if (payload.action === "transport") {
          state.enabled = Boolean(payload.enabled);
          updateControls(true);
          updateHighlight(true);
          return;
        }
        if (payload.action === "follow") {
          state.follow = Boolean(payload.follow);
          updateControls(true);
          return;
        }
        if (payload.action === "seek") {
          if (Number.isFinite(Number(payload.step))) {
            state.currentStep = clamp(Math.round(Number(payload.step)), 0, totalSlots() - 1);
            state.currentBeat = beatForSlot(state.currentStep);
            state.lastStep = state.currentStep;
            updateStatus(true);
            updateHighlight(true);
          }
          return;
        }
        if (payload.action === "step-trigger") {
          applyRemoteStepTrigger37BM(payload);
        }
      } catch {}
    });
  }

  window.addEventListener("pagehide", () => {
    flushStateSave();
    flushPatternLibrarySave();
  });

  function init() {
    if (!$("quickStepAutoPanel")) return;
    loadPatternLibrary();
    loadSavedState();
    state.visibleCount = normalizeVisibleCount(state.visibleCount, state.cycleLength);
    bindControls();
    fitVisibleToLayout({ noSave: true, force: true });
    renderAll(true);

    let resizeTimer = 0;
    window.__budilightStepSeqResizeGovernor37AZ = window.__budilightStepSeqResizeGovernor37AZ || {
      version: 'STEP37AZ_STEPSEQ_RESIZE_GOVERNOR', calls: 0, applied: 0, coalesced: 0, pending: false, live: false, delayMs: 0
    };
    function isLiveOutputLocked37AZ() {
      try { return window.__budilightOutputLock37AP?.active === true; } catch { return false; }
    }
    window.addEventListener("resize", () => {
      const live = isLiveOutputLocked37AZ();
      const delay = live ? 220 : 120;
      try {
        const diag = window.__budilightStepSeqResizeGovernor37AZ;
        diag.calls += 1; diag.live = live; diag.delayMs = delay;
        if (resizeTimer) { diag.coalesced += 1; diag.pending = true; }
      } catch {}
      clearManagedTimeout37CE(resizeTimer);
      resizeTimer = managedTimeout37CE('resize', () => {
        resizeTimer = 0;
        try { const diag = window.__budilightStepSeqResizeGovernor37AZ; diag.pending = false; diag.applied += 1; diag.lastAppliedAt = performance.now(); } catch {}
        fitVisibleToLayout({ noSave: true, force: true });
      }, delay);
    }, { passive: true });
    window.addEventListener("beforeunload", () => {
      flushStateSave();
      flushPatternLibrarySave();
    });
    window.addEventListener("budilight:command", handleSequencerCommand37BM);

    // STEP37AM: adaptive sequencer timer. The old fixed 40 ms interval kept
    // waking the Performance thread even when the sequencer was OFF or outside
    // the visible viewport. When enabled we keep the original 40 ms cadence so
    // programmed steps remain tight; when disabled/hidden the timer backs off.
    scheduleAdaptiveTick(40);
    document.addEventListener("visibilitychange", () => scheduleAdaptiveTick(40));
    window.BudiQuickStepAutomator = {
      state,
      resetBeat,
      syncBeat,
      setEnabled,
      setFollow,
      setCycleLength,
      setVisibleCount,
      setWindowStart,
      seekSequencerSlot,
      savePatternToSlot,
      loadPatternFromSlot,
      randomizePattern,
      mutatePattern,
      clearPattern,
      toggleRowMute,
      toggleRowLock,
      storeCompareSlot,
      loadCompareSlot,
      version: "quick-step-v37eb-param-flip-call-fix"
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
