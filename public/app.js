try{const r=await fetch("/api/runtime-profile");window.RUNTIME_PROFILE=await r.json();}catch{window.RUNTIME_PROFILE={};}
function applyLocalPreviewRuntimeProfile(profile){
  const out = { ...(profile || {}) };
  try {
    const settings = JSON.parse(localStorage.getItem('led-engine-settings-v1') || '{}');
    const previewFps = Number(settings.previewFps || localStorage.getItem('budilightLivePreviewFpsCap') || localStorage.getItem('budilightShellLivePreviewFpsCap') || 0);
    if (Number.isFinite(previewFps) && previewFps > 0) {
      out.previewFps = Math.max(1, Math.min(60, Math.round(previewFps)));
      out.livePreviewFpsCap = out.previewFps;
    }
    const shaderPreviewFps = Number(settings.shaderPreviewFps || 0);
    if (Number.isFinite(shaderPreviewFps) && shaderPreviewFps > 0) {
      out.shaderPreviewFps = Math.max(1, Math.min(60, Math.round(shaderPreviewFps)));
    }
  } catch {}
  return out;
}
const RUNTIME_PROFILE = applyLocalPreviewRuntimeProfile(window.RUNTIME_PROFILE || {});
window.RUNTIME_PROFILE = RUNTIME_PROFILE;
const RUNTIME_ONLY = RUNTIME_PROFILE.runtimeOnly === true;

// STEP37CF: main UI deferred tasks use the shared runtime loop registry when available.
function runtimeLoopRegistry37CF() {
  try { return window.__budilightRuntimeLoopRegistry37CE || window.__budilightRuntimeLoopRegistry37CF || null; } catch { return null; }
}
function managedTimeout37CF(name, fn, delayMs, opts = {}) {
  const reg = runtimeLoopRegistry37CF();
  if (reg?.timeout) return reg.timeout(name, fn, delayMs, { group: 'app-ui', liveFactor: 1.8, hiddenFactor: 3, maxMs: 1800, ...opts });
  return window.setTimeout(fn, Math.max(0, Number(delayMs) || 0));
}
function clearManagedTimer37CF(id) {
  if (!id) return;
  const reg = runtimeLoopRegistry37CF();
  if (typeof id === 'string' && reg?.clear) { try { reg.clear(id); return; } catch {} }
  try { window.clearTimeout(id); } catch {}
}
const DISABLE_SHADER_PREWARM = RUNTIME_PROFILE.disableShaderPrewarm === true || RUNTIME_ONLY;
import { startFpsMeter } from "./topbar.js";
import { createLedRenderer, createShaderSceneRenderer, getGpuShaderStats, gpuSceneBankId, renderShaderLayerCanvas, warmupLayerPreviewShaders } from "./gpu_renderer.js?v=20261109-gpu-shader-runtime";
import { createFixedClock } from "./core/fixed_clock.js";
import {
  BLEND_GROUPS,
  BLEND_MODES,
  DEFAULT_PARAM_LABELS,
  DEFAULT_RUNTIME_FPS,
  FORCE_CPU_LAYER_PREVIEW,
  FORCE_CPU_RENDER,
  LED_PREVIEW_CELL_SIZE,
  MAPPING_KEY,
  MAX_RUNTIME_FPS,
  MATRIX_DEFAULT_HEIGHT,
  MATRIX_DEFAULT_WIDTH,
  MIN_RUNTIME_FPS,
  PARAM_COUNT,
  RAW_PREVIEW_FPS,
  RAW_PREVIEW_SCALE,
  SERIAL_KEY,
  SHADER_PREWARM_KEY,
  SHADER_MODULE_PREWARM_KEY,
  SETTINGS_KEY,
  STARTUP_ANIM_THUMB_SIZE,
  STORAGE_KEY,
  TRANSITION_KEY
} from "./core/constants.js";
import {
  beatStartedAtValue,
  bpmValue,
  clamp,
  clamp01,
  clampInt,
  clampResetId,
  contrastValue,
  easeInOut,
  gammaValue,
  mixColor,
  numberValue,
  randomItem,
  transitionSecondsValue
} from "./core/math.js";
import { createModuleLoader, pathsForFolder } from "./core/module_loader.js";
import { closeStartupOverlay, createStartupOverlay, updateStartupOverlay } from "./core/startup_overlay.js";
import { blendModeLabel, byId, cleanModuleName, option, setSelectValue } from "./core/dom.js";
import { createAppState } from "./state.js";
import { createBpmEngine } from "./bpm_engine.js";
import { createSerialOutput } from "./serial_output.js";
import { createRendererLoopState } from "./renderer_loop.js";
import { createUiBindings } from "./ui_bindings.js";
import { createUiPickers } from "./ui_pickers.js";
import {
  startupStepRuntime,
  preloadEverythingForStartupRuntime,
  preloadThumbnailCacheRuntime,
  finishStartupProfilingRuntime
} from "./runtime_boot.js";
import { bindPreviewTabsRuntime } from "./preview_tabs.js";
import { toggleFullscreenRuntime, toggleCenterMenuRuntime, handleOutsideMenuClickRuntime } from "./performance_controls.js";
import { syncDebugPanelRuntime } from "./debug_panel.js";
import { createLayerRuntime } from "./layer_runtime.js";
import { syncFullscreenButtonLabel } from "./fullscreen.js";
import { createKeyboardControls } from "./runtime/keyboard_controls.js";
import { createUiStateSync } from "./runtime/ui_state_sync.js";
import { createBootstrapServiceDeps, createBootstrapServices } from "./runtime/bootstrap_services.js";
import {
  toggleCenterMenuRuntimeAction,
  handleOutsideMenuClickRuntimeAction,
  setMasterFlashRuntimeAction
} from "./runtime/live_actions.js";
import { createOutputPipeline } from "./runtime/output_pipeline.js";
import { createLayerSwitching } from "./runtime/layer_switching.js";
import { bindRuntimeStateSync } from "./runtime/global_sync.js";
import { createModuleWarmup } from "./runtime/module_warmup.js";
import { bindKeyboardInput, bindViewportLifecycle } from "./runtime/input_bindings.js";
import {
  preloadNeighborShadersRuntime,
  warmupStoredShaderScenesRuntime,
  warmupStoredShaderModulesRuntime
} from "./runtime/module_warmup_orchestrator.js";
import {
  buildShaderLayerSnapshotRuntime,
  buildShaderWarmupSnapshotRuntime,
  shaderWarmupKeyRuntime,
  rememberShaderWarmupSceneRuntime,
  rememberShaderModuleWarmupRuntime
} from "./runtime/shader_warmup_cache.js";
import { createRenderPipeline } from "./runtime/render_pipeline.js?v=37ee-original-shader-preview";
import { createFpsGovernor, FPS_DOMAINS } from "./runtime/fps_governor.js";
import { getRuntimeFrameBus } from "./runtime/frame_bus.js";
import { getRuntimeFrameAuthority } from "./runtime/frame_authority.js";
import { installRuntimeDebugHook } from "./runtime/runtime_debug.js";
import { createFrameComposer } from "./runtime/frame_composer.js";
import { createPreviewModeRuntime } from "./runtime/preview_mode_runtime.js";
import { createStagePreviewRenderer } from "./runtime/stage_preview.js";
import { createShaderPreloadManager } from "./runtime/shader_preload_manager.js";
import { createRuntimeBoundaryBridge } from "./runtime/src_bridge.js";
import { runStartupWarmupFlow } from "./runtime/startup_warmup.js";
import { runStartupSequence } from "./runtime/startup_sequence.js";
import { createUiSync } from "./runtime/ui_sync.js";
import { thumbCacheKeyForTask } from "./runtime/thumb_keys.js";
import { createHeadlessLeaderElection } from "./runtime/headless_leader.js";
import { createAppLifecycleState, startAppLifecycle } from "./runtime/app_lifecycle.js";
import { createStateSyncController } from "./runtime/state_sync_controller.js";
import { createRuntimeRefreshLoops } from "./runtime/refresh_loops.js";
import { createCrossControl } from "./runtime/cross_control.js";
import { createTopbarMixLayoutRuntime } from "./runtime/topbar_mix_layout.js";
import { initCenterMenuControlsRuntime } from "./runtime/center_menu_controls.js";
import { bindGlobalControlsRuntime } from "./runtime/global_controls.js";
import { bindBlendTransitionControlsRuntime } from "./runtime/blend_transition_controls.js";
import { createRangeVisualsRuntime } from "./runtime/range_visuals.js";
import { evaluateStartupOverlayHealthRuntime } from "./runtime/startup_overlay_health.js";
import { createGpuWarmupQueueRuntime } from "./runtime/gpu_warmup_queue.js";
import { bindModuleSelectControl } from "./runtime/module_select_controls.js";
import { createLayerModuleNavigation } from "./runtime/layer_module_navigation.js";
import { createLayerParamRandomizer } from "./runtime/layer_param_randomizer.js";
import { bindLayerRangeControlsRuntime } from "./runtime/layer_range_controls.js";
import { bindFxControlBindingsRuntime } from "./runtime/fx_control_bindings.js";
import { bindCheckboxControl } from "./runtime/checkbox_control.js";
import { createShellRuntimeNotifications } from "./runtime/shell_runtime_notifications.js";
import { loadModuleList } from "./runtime/module_list_loader.js";
import { loadSelectedModulesRuntime } from "./runtime/selected_modules_loader.js";
import { initDirectRangeControlRuntime } from "./runtime/direct_range_control.js";
import { createAppCollapseFacade } from "./runtime/app_collapse_facade.js";
import {
  canUseGpuRenderRuntime,
  createGpuSceneCandidateRuntime,
  shouldTryGpuAutoSwitchRuntime
} from "./runtime/gpu_scene_orchestration.js";
import { decideRenderBackend } from "./runtime/render_backend_policy.js";
import { createAppDomRefs } from "./runtime/app_dom_refs.js";
import { bindAppControlsRuntime } from "./runtime/app_control_binder.js";
import { createLayerModuleSwitcher } from "./runtime/layer_module_switcher.js";
import { createPickerRuntime, createPickerRuntimeState } from "./runtime/app_picker_runtime.js";
import {
  createShaderSwitchCpuFallbackMs,
  initPostLoginTransitionRuntime,
  isTypingTargetRuntime
} from "./runtime/app_startup_safe_helpers.js";
import {
  APP_UI_STORAGE_KEYS,
  DISABLE_LIVE_GPU_AUTOSWITCH_DEFAULT,
  createModuleListsState,
  createOutputPipelineMetricsState,
  createPerfProfileMetricsState,
  createSchedulerDebugState,
  createStartupTimingState
} from "./runtime/app_static_state.js";
import {
  shaderCodeTextRuntime
} from "./runtime/app_panel_helpers.js";
import { createTelemetryBus } from "./runtime/telemetry_bus.js";
import { restoreOutputAutostart } from "./runtime/output_autostart.js";
import { createAppStartupFlow, createStartupSequenceDeps } from "./runtime/app_startup_flow.js";
import { createAppRuntimeTrace } from "./runtime/app_runtime_trace.js";
import { createAppLayerHelperAliases } from "./runtime/app_layer_helper_aliases.js";
import { createAppRuntimeDelegateFacade } from "./runtime/app_runtime_delegate_facade.js";
import { createAppCoreDelegateFacade } from "./runtime/app_core_delegate_facade.js";
import { createAppBackgroundModuleWarmup } from "./runtime/app_background_module_warmup.js";
import { buildAppBootstrapServiceDeps } from "./runtime/app_init_bootstrap.js";
import { createCoreRuntimeAssembly } from "./runtime/app_init_runtime_assembly.js";
import { createAppPreviewCanvasResize } from "./runtime/app_preview_canvas_resize.js";
import { createAppVisualValueHelpers } from "./runtime/app_visual_value_helpers.js";
import { createGpuPrewarmHelpers } from "./runtime/app_gpu_prewarm.js";
import { readAppRuntimeContext } from "./runtime/app_runtime_context.js";
import {
  createOutputModeDelegates,
  createRuntimeTimingDelegates,
  createSerialRowDelegates,
  createViewportDelegates
} from "./runtime/app_runtime_delegates.js";
import { createRuntimeFpsAccessors } from "./runtime/app_runtime_fps.js";
import {
  ANIMATION_LIBRARY_SYNC_KEY,
  GPU_PREWARM_DEFAULT_CHUNK_SIZE,
  GPU_PREWARM_DEFAULT_YIELD_MS,
  GPU_PREWARM_INTERACTIVE_CHUNK_SIZE,
  GPU_PREWARM_INTERACTIVE_YIELD_MS,
  GPU_PREWARM_START_DELAY_MS,
  MANUAL_PALETTE_COLOR_SLOTS,
  OUTPUT_MODE_BLX_NET,
  OUTPUT_MODE_BLX_SERIAL,
  STARTUP_GUARD_FAILSAFE_MS,
  STARTUP_PROGRESS_AFTER_READY_MS,
  STARTUP_PROGRESS_STABLE_MS,
  STARTUP_READY_MIN_FRAMES,
  STARTUP_READY_MIN_WARMUP_MS,
  STARTUP_READY_STABLE_MS,
  STARTUP_STALL_GAP_MS,
  STATE_SYNC_MESSAGE_TYPE
} from "./runtime/app_runtime_constants.js";
import { initLiveArmPanel } from "./runtime/live_arm_panel.js";

const canvas = document.getElementById("ledCanvas");
const stagePreviewCanvas = document.getElementById("stagePreviewCanvas");
const stagePixelPreviewCanvas = document.getElementById("stagePixelPreviewCanvas");
const stageShaderPreviewCanvas = document.getElementById("stageShaderPreviewCanvas");
const shaderPreviewCanvas = document.getElementById("shaderPreviewCanvas");
const previewBox = document.getElementById("previewBox");
const { headless: HEADLESS, shellViewOnly: SHELL_VIEW_ONLY, safeBoot: SAFE_BOOT } = readAppRuntimeContext({
  locationRef: location,
  windowRef: window
});

let W = MATRIX_DEFAULT_WIDTH;
let H = MATRIX_DEFAULT_HEIGHT;
const S = LED_PREVIEW_CELL_SIZE;
const previewRenderer = createLedRenderer(canvas, S, { force2d: SHELL_VIEW_ONLY, flipY: SHELL_VIEW_ONLY });
const stagePreviewRenderer = createStagePreviewRenderer({ canvas: stagePreviewCanvas });
const stagePixelPreviewRenderer = createLedRenderer(stagePixelPreviewCanvas, S, { force2d: true });
// Keep the output WebGL context alive from boot so its scene-program cache is
// warmed together with the visible preview contexts instead of being created
// on the first random transition.
let gpuOutputRenderer = createShaderSceneRenderer(document.createElement("canvas"));
let gpuTransitionFallbackUntil = 0;
let gpuOutputBlendMode = null;
let gpuReadbackFallbackUntil = 0;
const isTypingTarget = isTypingTargetRuntime;
const shaderSwitchCpuFallbackMs = createShaderSwitchCpuFallbackMs({ headless: HEADLESS, shellViewOnly: SHELL_VIEW_ONLY });
function initPostLoginTransition() {
  initPostLoginTransitionRuntime({ sessionStorageRef: sessionStorage, documentRef: document, windowRef: window });
}
const shaderPreviewRenderer = shaderPreviewCanvas ? createShaderSceneRenderer(shaderPreviewCanvas) : null;
const stageShaderPreviewRenderer = stageShaderPreviewCanvas ? createShaderSceneRenderer(stageShaderPreviewCanvas) : null;
const previewCanvasResize = createAppPreviewCanvasResize({
  canvas,
  previewRenderer,
  stagePreviewCanvas,
  stagePreviewRenderer,
  stagePixelPreviewCanvas,
  stagePixelPreviewRenderer,
  stageShaderPreviewCanvas,
  stageShaderPreviewRenderer,
  shaderPreviewCanvas,
  shaderPreviewRenderer,
  previewBox,
  getDimensions: () => ({ width: W, height: H }),
  getCellSize: () => S
});
const visualValueHelpers = createAppVisualValueHelpers({ clamp01, settings: () => settings });
const moduleLoader = createModuleLoader();
const loadModule = moduleLoader.loadModule;
const hasModule = moduleLoader.hasModule;

resizePreviewCanvas();

window.addEventListener("led-preview-mode-changed", () => {
  try { resizePreviewCanvas(); } catch {}
  try { resizeShaderPreviewCanvas(); } catch {}
  try { renderPipeline?.draw?.(performance.now()); } catch {}
});
window.addEventListener("led-preview-layout-changed", () => {
  try { resizePreviewCanvas(); } catch {}
  try { resizeShaderPreviewCanvas(); } catch {}
  try { renderPipeline?.draw?.(performance.now()); } catch {}
});
const { state, settings, transitionSettings, modules, transitions } = createAppState();
const renderLoopState = createRendererLoopState();
let t = renderLoopState.getTime();
let beatStartedAt = performance.now();
let lastBeatResetId = 0;
let lastTap = 0;
let lastOutputFrameAt = 0;
let lastSerialFrameAt = 0;
let lastPreviewRenderer = "pending";
let forceCpuPreviewUntil = 0;
let serialFrameBusy = false;
let serialSettings = { enabled: false, fps: 60 };
let serialConflictCount = 0;
let serialPauseUntil = 0;
const serialRows = {
  reversed: [],
  enabled: [],
  brightness: [],
  pixelLimit: [],
  outputRoute: [],
  colorOrder: []
};
let crossControl = null;

const fpsGovernor = createFpsGovernor({
  settings,
  runtimeProfile: RUNTIME_PROFILE,
  documentRef: document
});
const {
  getRuntimeTargetFps,
  getRuntimeTargetFrameMs,
  getRuntimePreviewTargetFrameMs,
  getRuntimeShaderPreviewFps
} = createRuntimeFpsAccessors({
  fpsGovernor,
  clampInt,
  minRuntimeFps: MIN_RUNTIME_FPS,
  maxRuntimeFps: MAX_RUNTIME_FPS,
  defaultRuntimeFps: DEFAULT_RUNTIME_FPS,
  fpsDomains: FPS_DOMAINS,
  resolveOutputFps: () => {
    if (isSerialOutputClockPreferred()) {
      return Number(serialSettings?.fps || settings.serialFps || settings.fps || DEFAULT_RUNTIME_FPS);
    }
    // STEP22NQ: ArtNet output must use the live mirror FPS, not the visible
    // preview governor and not an old generic 30 FPS setting. Otherwise the UI
    // can show a healthy render loop while the physical LEDs are clocked around
    // 24-30 FPS. Prefer the explicit ArtNet mirror setting saved by Settings.
    if (isArtnetRouteConfigured()) {
      let mirrorFps = 0;
      try { mirrorFps = Number(localStorage.getItem('budilightArtNetMasterMirrorFps22EJ') || 0); } catch {}
      // STEP22NU: old safe-live/profile values could leave mirrorFps/settings.fps
      // at 10/20/30 in localStorage. That made the physical ArtNet output tick
      // at ~20 FPS while the UI/debug still showed multiple unrelated FPS values.
      // For Performance -> ArtNet, the live output clock is the authority and
      // should not inherit legacy safe-test caps; keep it at least 60 FPS unless
      // the operator explicitly configures an even higher maxLiveFps.
      const configured = Math.max(
        Number(mirrorFps || 0),
        Number(settings.artnetMirrorFps || 0),
        Number(settings.maxLiveFps || 0),
        Number(settings.fps || 0),
        Number(DEFAULT_RUNTIME_FPS || 60),
        60
      );
      return Number(configured || 60);
    }
    return Number(settings.fps || DEFAULT_RUNTIME_FPS);
  }
});

try { window.getRuntimeTargetFps = getRuntimeTargetFps; } catch {}
let renderSchedulerNextAt = 0;
const heldFxKeys = new Map();
const pickerRuntimeState = createPickerRuntimeState();
const pendingModuleLoads = {
  l1: { anim: 0, palette: 0 },
  l2: { anim: 0, palette: 0 }
};
const gpuWarmupQueue = [];
let gpuWarmupScheduled = false;
const setSerialRows = (key, rows) => {
  serialRows[key] = rows;
};
const getSerialRows = (key) => serialRows[key];
const gpuWarmupClock = createFixedClock(60);
const gpuWarmupSeen = new Set();
let fullGpuPrewarmStarted = false;
let gpuReady = false;
let gpuWarmupAttemptAt = 0;
let cpuPrewarmDone = false;
let cpuPrewarmRunning = false;
const shaderNeighborWarmupCanvas = document.createElement("canvas");
shaderNeighborWarmupCanvas.width = 16;
shaderNeighborWarmupCanvas.height = 16;
let bpmEngine = null;
let serialOutput = null;
let stateBridge = null;
let stateSyncController = null;
let uiSync = null;
let uiStateSync = null;
let uiBindings = null;
let layerModuleNavigation = null;
let layerParamRandomizer = null;
let uiPickers = null;
let startupFrameGuard = true;
let startupReadyAt = 0;
let startupFrameCount = 0;
let startupLastFrameAt = 0;
let startupStableSince = 0;
let startupOverlayClosed = false;
const {
  uiPickerBridge,
  facade: {
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
  drawThumbFromCache
  }
} = createPickerRuntime(pickerRuntimeState, {
  thumbCacheKeyForTask,
  getUiPickers: () => uiPickers
});
let layerRuntime = null;
let frameComposer = null;
let previewModeRuntime = null;
let layerSwitching = null;
let moduleWarmup = null;
let backgroundModuleWarmup = null;
let renderPipeline = null;
let keyboardControls = null;
let outputPipeline = null;
let shaderInspectorCollapsed = false;
let previewCollapsed = false;
let shaderPreloadManager = null;
let lastGpuFaultAt = 0;
let lastGpuFaultKind = "--";
let runtimeRefreshLoops = null;
let topbarMixLayout = null;
let shellRuntimeNotifications = null;
let layerModuleSwitcher = null;
let outputPipelineMetrics = createOutputPipelineMetricsState();
const telemetryBus = createTelemetryBus({ performanceRef: performance, windowRef: window });
const headlessLeader = createHeadlessLeaderElection({ headless: HEADLESS, windowRef: window, storageRef: localStorage });
shellRuntimeNotifications = createShellRuntimeNotifications({
  headless: HEADLESS,
  shellViewOnly: SHELL_VIEW_ONLY,
  windowRef: window,
  performanceRef: performance,
  getGpuReady: () => gpuReady
});
stateSyncController = createStateSyncController({
  locationRef: location,
  windowRef: window,
  state,
  applyState,
  loadSelectedModules,
  scheduleCpuPrewarm,
  syncControls,
  saveLocalState,
  syncRemoteUi: !HEADLESS,
  persistRemoteState: !HEADLESS
});
let perfProfileMetrics = createPerfProfileMetricsState(performance);
let latestRuntimeDetail = null;
let schedulerDebugState = createSchedulerDebugState();
try { window.__budilightRenderSchedulerDebug = schedulerDebugState; } catch {}
const gpuWarmupQueueRuntime = createGpuWarmupQueueRuntime({
  windowRef: window,
  gpuWarmupQueue,
  gpuWarmupSeen,
  gpuWarmupClock,
  schedulerDebugState,
  rememberShaderWarmupScene,
  warmupScene: (scene) => {
    // The visible Shader tab has its own WebGL renderer. Keep the output
    // renderer as a fallback for headless/live paths, but do not warm only the
    // hidden canvas or the first Shader frame can still hit a cold program.
    const renderers = [shaderPreviewRenderer, previewRenderer, gpuOutputRenderer]
      .filter(Boolean)
      .filter((renderer, index, list) => list.indexOf(renderer) === index);
    return renderers.some((renderer) => renderer.warmupShaderScene?.(scene) === true);
  },
  isTransitionActive: () => Object.values(transitions).some(Boolean),
  canAutoEnableGpu: () => !DISABLE_LIVE_GPU_AUTOSWITCH || !startupOverlayClosed,
  isGpuEnabled: () => Boolean(settings.gpuEnabled),
  onGpuReady: () => {
    gpuReady = true;
    syncControls();
  },
  getGpuWarmupScheduled: () => gpuWarmupScheduled,
  setGpuWarmupScheduled: (value) => {
    gpuWarmupScheduled = value;
  }
});
// runtimeTrace stays in the extracted app_runtime_trace module; keep this marker for source-trace contract tests.
const appRuntimeTrace = createAppRuntimeTrace({
  windowRef: window,
  documentRef: document,
  performanceRef: performance,
  getGpuShaderStats,
  getRuntimeFrameBus,
  getRuntimeFrameAuthority,
  telemetryBus,
  perfProfileMetrics,
  schedulerDebugState,
  getOutputPipelineMetrics: () => outputPipelineMetrics,
  getShaderPreloadManager: () => shaderPreloadManager,
  getState: () => state,
  getSettings: () => settings,
  getSerialSettings: () => serialSettings,
  getStateSyncController: () => stateSyncController,
  getHeadlessLeader: () => headlessLeader,
  getLatestRuntimeDetail: () => latestRuntimeDetail,
  setLatestRuntimeDetail: (detail) => { latestRuntimeDetail = detail; },
  getWidth: () => W,
  getHeight: () => H,
  getLastPreviewRenderer: () => lastPreviewRenderer,
  getLastOutputFrameAt: () => lastOutputFrameAt,
  getLastSerialFrameAt: () => lastSerialFrameAt,
  isSerialPipelineEnabled,
  effectiveOutputMode,
  readPreviewMode: () => document.body?.dataset?.previewMode || "pixel",
  isHeadless: () => HEADLESS,
  isShellViewOnly: () => SHELL_VIEW_ONLY,
  getGpuReady: () => gpuReady,
  getLastGpuFaultAt: () => lastGpuFaultAt,
  getLastGpuFaultKind: () => lastGpuFaultKind,
  getStartupFrameGuard: () => startupFrameGuard,
  getOutputEnabled: () => isProtocolOutputEnabled()
});
const {
  reportOutputFrame,
  installShellRunnerOutputFrameReceiver,
  captureUiSyncMetric,
  captureDebugSyncMetric,
  captureRenderPipelineMetric,
  readPerfProfileSnapshot
} = appRuntimeTrace;
runtimeRefreshLoops = createRuntimeRefreshLoops({
  windowRef: window,
  performanceRef: performance,
  readPerfProfileSnapshot,
  getLatestRuntimeDetail: () => latestRuntimeDetail,
  shouldRefreshShaderInspector,
  shouldRefreshDebugOverlay,
  syncOutputCards,
  syncShaderInspector,
  syncDebugPanel,
  captureUiSyncMetric,
  captureDebugSyncMetric
});
let startupTimingState = createStartupTimingState();
let animationLibraryRefreshPromise = null;
const {
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
} = createAppLayerHelperAliases({
  getWidth: () => W,
  getHeight: () => H,
  getTime: () => t,
  getParamCount: () => PARAM_COUNT,
  clamp01,
  clamp,
  contrast01: (value) => contrast01(value),
  now: () => performance.now()
});

const $ = byId;
const SHADER_INSPECTOR_COLLAPSED_KEY = APP_UI_STORAGE_KEYS.shaderInspectorCollapsed;
const PREVIEW_COLLAPSED_KEY = APP_UI_STORAGE_KEYS.previewCollapsed;
const FX_PANEL_COLLAPSED_KEY = APP_UI_STORAGE_KEYS.fxPanelCollapsed;
const MANUAL_PALETTE_COLLAPSED_KEY = APP_UI_STORAGE_KEYS.manualPaletteCollapsed;
const PERF_PADS_COLLAPSED_KEY = APP_UI_STORAGE_KEYS.perfPadsCollapsed;
const DISABLE_LIVE_GPU_AUTOSWITCH = DISABLE_LIVE_GPU_AUTOSWITCH_DEFAULT;

const { controls, sliders, layerButtons, fxControls } = createAppDomRefs({
  byId: $,
  documentRef: document
});

const lists = createModuleListsState();

layerModuleNavigation = createLayerModuleNavigation({
  lists,
  state,
  randomItem,
  hasModule,
  switchLayerModule
});

layerParamRandomizer = createLayerParamRandomizer({
  state,
  paramCount: PARAM_COUNT,
  captureLayerModules,
  cloneLayerState,
  startLayerTransition,
  syncControls,
  commitState
});

const {
  fastMainReturn: FAST_MAIN_RETURN,
  mainAlreadyBooted: MAIN_ALREADY_BOOTED,
  embeddedRuntime: EMBEDDED_RUNTIME,
  skipStartupLoading: SKIP_STARTUP_LOADING,
  strictStartupPrewarm: STRICT_STARTUP_PREWARM,
  startupProfiling,
  startupOverlay
} = createAppLifecycleState({
  headless: HEADLESS,
  shellViewOnly: SHELL_VIEW_ONLY,
  safeBoot: SAFE_BOOT,
  sessionStorageRef: sessionStorage,
  performanceRef: performance,
  createStartupOverlay
});
layerModuleSwitcher = createLayerModuleSwitcher({
  state,
  modules,
  lists,
  pendingModuleLoads,
  rawPreviewSignature: pickerRuntimeState.rawPreviewSignature,
  rawPreviewLastAt: pickerRuntimeState.rawPreviewLastAt,
  strictStartupPrewarm: STRICT_STARTUP_PREWARM,
  performanceRef: performance,
  loadModule,
  cloneLayerState,
  captureLayerModules,
  syncControls,
  commitState,
  closeAnimationPicker,
  closePalettePicker,
  shaderSwitchCpuFallbackMs,
  setForceCpuPreviewUntil: (value) => { forceCpuPreviewUntil = value; },
  setLastOutputFrameAt: (value) => { lastOutputFrameAt = value; },
  setGpuReady: (value) => { gpuReady = value; },
  getShaderPreloadManager: () => shaderPreloadManager,
  schedulerDebugState,
  preloadNeighborShaders,
  rememberShaderWarmupScene,
  rememberShaderModuleWarmup,
  warmupCurrentShaderScene,
  setCpuPrewarmDone: (value) => { cpuPrewarmDone = value; },
  scheduleCpuPrewarm,
  scheduleNearbyWarmup,
  startLayerTransition,
  isTransitionActive: () => Object.values(transitions).some((entry) => {
    if (!entry) return false;
    const duration = Math.max(1, Number(entry.duration || 0));
    return performance.now() - Number(entry.startedAt || 0) < duration;
  }),
  renderPipeline: () => renderPipeline,
  shellViewOnly: SHELL_VIEW_ONLY,
  isOutputEnabled: () => isProtocolOutputEnabled()
});

managedTimeout37CF('app:startup-guard-failsafe', () => {
  if (startupOverlayClosed || !startupOverlay?.root) return;
  startupFrameGuard = false;
  if (!startupOverlayClosed) {
    startupOverlayClosed = true;
    closeStartupOverlay(startupOverlay, {
      greetingEnabled: settings.welcomeEnabled !== false,
      greetingText: settings.welcomeText || "vítej borče"
    });
  }
  try { console.warn("[startup] guard failsafe released output gate"); } catch {}
}, STARTUP_GUARD_FAILSAFE_MS, { managed: false, group: 'startup' });
topbarMixLayout = createTopbarMixLayoutRuntime({
  documentRef: document,
  storageRef: localStorage,
  controls,
  settings
});
crossControl = createCrossControl({
  documentRef: document,
  windowRef: window,
  state,
  settings,
  controls,
  clamp01,
  isTypingTarget,
  syncControls,
  commitState
});
let manualPaletteCollapsed = { l1: false, l2: false };
const collapseFacade = createAppCollapseFacade({
  controls,
  layerButtons,
  manualPaletteCollapsed,
  storageKeys: {
    shaderInspectorCollapsed: SHADER_INSPECTOR_COLLAPSED_KEY,
    previewCollapsed: PREVIEW_COLLAPSED_KEY,
    fxPanelCollapsed: FX_PANEL_COLLAPSED_KEY,
    manualPaletteCollapsed: MANUAL_PALETTE_COLLAPSED_KEY,
    perfPadsCollapsed: PERF_PADS_COLLAPSED_KEY
  },
  state: {
    getShaderInspectorCollapsed: () => shaderInspectorCollapsed,
    setShaderInspectorCollapsed: (value) => { shaderInspectorCollapsed = value; },
    getPreviewCollapsed: () => previewCollapsed,
    setPreviewCollapsed: (value) => { previewCollapsed = value; }
  }
});

const appStartupFlow = createAppStartupFlow({
  startupProfiling,
  startupOverlay,
  updateStartupOverlay,
  notifyShellRuntimeLoading,
  startupStepRuntime,
  shaderPreloadManagerRef: () => shaderPreloadManager,
  prewarmAllCpuModules: () => moduleWarmup?.prewarmAllCpuModules?.(),
  loadHeadlessShaderModulesRef: () => loadHeadlessShaderModules(),
  prewarmAllGpuCombos,
  pathsForFolder,
  lists,
  loadModule,
  preloadThumbnailCacheRuntime,
  STARTUP_ANIM_THUMB_SIZE,
  thumbCacheKey,
  thumbCache: pickerRuntimeState.thumbCache,
  getUiPickers: () => uiPickers,
  runtimeProfile: RUNTIME_PROFILE,
  startupTimingState,
  renderAnimationThumb,
  renderPaletteThumb,
  finishStartupProfilingRuntime
});
const {
  startupStep,
  preloadEverythingForStartup,
  preloadHeadlessWebglStartup,
  loadHeadlessShaderModules,
  preloadShellViewStartup,
  preloadThumbnailCache,
  finishStartupProfiling
} = appStartupFlow;

const rangeVisuals = createRangeVisualsRuntime({
  controls,
  sliders,
  state,
  clamp01
});
const gpuPrewarmHelpers = createGpuPrewarmHelpers({
  disableShaderPrewarm: DISABLE_SHADER_PREWARM,
  headless: HEADLESS,
  shellViewOnly: SHELL_VIEW_ONLY,
  forceCpuRender: FORCE_CPU_RENDER,
  previewRenderer,
  previewRenderers: [shaderPreviewRenderer, stageShaderPreviewRenderer, gpuOutputRenderer],
  loadModule,
  gpuSceneBankId,
  createGpuWarmupSceneDeps: {
    manualPaletteColorSlots: MANUAL_PALETTE_COLOR_SLOTS,
    getState: () => state,
    getSettings: () => settings,
    getWidth: () => W,
    getHeight: () => H,
    getTime: () => t,
    getBeatPosition,
    normalizedParams,
    layerTime,
    getLayerVisibility
  },
  rememberShaderWarmupScene,
  syncControls,
  setGpuReady: (value) => { gpuReady = value; },
  settingsRef: () => settings,
  listsRef: () => lists,
  chunkDefaults: {
    defaultChunkSize: GPU_PREWARM_DEFAULT_CHUNK_SIZE,
    defaultYieldMs: GPU_PREWARM_DEFAULT_YIELD_MS
  }
});

const appDelegates = createAppRuntimeDelegateFacade({
  getRuntimeRefreshLoops: () => runtimeRefreshLoops,
  getUiStateSync: () => uiStateSync,
  getLayerRuntime: () => layerRuntime,
  getFrameComposer: () => frameComposer,
  getPreviewModeRuntime: () => previewModeRuntime,
  getTopbarMixLayout: () => topbarMixLayout,
  getTime: () => t
});

const appCoreDelegates = createAppCoreDelegateFacade({
  getStateBridge: () => stateBridge,
  getBpmEngine: () => bpmEngine,
  getLayerSwitching: () => layerSwitching,
  getShellRuntimeNotifications: () => shellRuntimeNotifications
});

startAppLifecycle({
  headless: HEADLESS,
  documentRef: document,
  headlessLeader,
  startFpsMeter,
  startPerfProfileReporter,
  startUiRefreshLoops,
  syncMasterValue,
  refreshRangeVisuals,
  initPostLoginTransition,
  init
});

async function init() {
  ({
    stateBridge,
    bpmEngine,
    serialOutput,
    outputPipeline,
    uiSync,
    uiStateSync,
    uiBindings,
    uiPickers
  } = createBootstrapServices(buildAppBootstrapServiceDeps({
    createBootstrapServiceDeps,
    createOutputModeDelegates,
    createViewportDelegates,
    createSerialRowDelegates,
    createRuntimeTimingDelegates,
    createRuntimeBoundaryBridge,
    createBpmEngine,
    createSerialOutput,
    createOutputPipeline,
    createUiSync,
    createUiStateSync,
    createUiBindings,
    createUiPickers,
    shellViewOnly: SHELL_VIEW_ONLY,
    state,
    settings,
    transitionSettings,
    modules,
    lists,
    controls,
    sliders,
    fxControls,
    layerButtons,
    storageKey: STORAGE_KEY,
    settingsKey: SETTINGS_KEY,
    transitionKey: TRANSITION_KEY,
    mappingKey: MAPPING_KEY,
    serialKey: SERIAL_KEY,
    blendModes: BLEND_MODES,
    defaultParamLabels: DEFAULT_PARAM_LABELS,
    blendGroups: BLEND_GROUPS,
    option,
    blendModeLabel,
    setSelectValue,
    clamp,
    clamp01,
    clampInt,
    bpmValue,
    beatStartedAtValue,
    clampResetId,
    gammaValue,
    contrastValue,
    transitionSecondsValue,
    normalizeManualPalette,
    normalizeManualPaletteActive,
    drawManualPaletteWheel,
    cleanModuleName,
    byIdRef: $,
    documentRef: document,
    refreshRangeVisuals,
    syncFullscreenButtonLabel,
    syncPreviewModeControls,
    syncMasterValue,
    syncCrossMouseControl,
    applyCrossfaderPlacement,
    commitState,
    tapBpm,
    syncControls,
    randomizeSingleFile,
    resetBeat,
    setMasterFlash,
    numberValue,
    applyRangeVisual,
    stepFile,
    randomizeLayerParams,
    bindCheckbox,
    colorFromWheelEvent,
    cloneLayerState,
    startLayerTransition,
    captureLayerModules,
    getPreviewMode,
    setPreviewMode,
    cyclePixelPreviewMode,
    cycleShaderPreviewMode,
    getBeatPosition,
    normalizedParams,
    normalizeValue,
    renderShaderLayerCanvas,
    loadModule,
    switchLayerModule,
    isSerialPipelineEnabled,
    schedulerDebugState,
    getOutputMode: () => effectiveOutputMode(),
    getSerialSettings: () => ({
      ...serialSettings,
      routerSerialEnabled: isSerialRouteConfigured(),
      routerArtnetEnabled: isArtnetRouteConfigured(),
      artnetEnabled: isArtnetRouteConfigured()
    }),
    getSocket: () => stateSyncController?.getSocket?.() ?? null,
    lastBeatResetIdRef: () => lastBeatResetId,
    setLastBeatResetId: (value) => { lastBeatResetId = value; },
    setViewportSize: (width, height) => { W = width; H = height; },
    getWidth: () => W,
    getHeight: () => H,
    setSerialRows,
    getSerialRows,
    beatStartedAtRef: () => beatStartedAt,
    setBeatStartedAt: (value) => { beatStartedAt = value; },
    lastTapRef: () => lastTap,
    setLastTap: (value) => { lastTap = value; },
    serialFrameBusyRef: () => serialFrameBusy,
    setSerialFrameBusy: (value) => { serialFrameBusy = value; },
    lastSerialFrameAtRef: () => lastSerialFrameAt,
    setLastSerialFrameAt: (value) => { lastSerialFrameAt = value; },
    serialPauseUntilRef: () => serialPauseUntil,
    setSerialPauseUntil: (value) => { serialPauseUntil = value; },
    serialConflictCountRef: () => serialConflictCount,
    setSerialConflictCount: (value) => { serialConflictCount = value; },
    onViewportChanged: resizePreviewCanvas,
    setSerialSettings: (next) => { serialSettings = next; },
    getBlxNetConfig: () => ({
      targetIp: String(settings.blxTargetIp || "192.168.1.50"),
      port: clampInt(settings.blxPort, 1, 65535, 7777)
    }),
    getBlxSerialBaud: () => clampInt(settings.blxSerialBaud, 9600, 3000000, 1000000),
    onOutputPipelineMetrics: (metrics) => {
      outputPipelineMetrics = metrics;
      schedulerDebugState.workerSlotMs = Number(metrics?.lastSendMs || 0);
      telemetryBus.recordOutputMetric(metrics);
    },
    getGpuReady: () => gpuReady,
    getLastPreviewRenderer: () => lastPreviewRenderer,
    manualPaletteCollapsed,
    thumbCache: pickerRuntimeState.thumbCache,
    runtimeProfile: RUNTIME_PROFILE
  })));
  ({
    layerRuntime,
    frameComposer,
    previewModeRuntime,
    layerSwitching,
    moduleWarmup,
    backgroundModuleWarmup,
    shaderPreloadManager
  } = createCoreRuntimeAssembly({
    createLayerRuntime,
    createFrameComposer,
    createPreviewModeRuntime,
    createLayerSwitching,
    createModuleWarmup,
    createAppBackgroundModuleWarmup,
    createShaderPreloadManager,
    state,
    settings,
    modules,
    transitions,
    layerButtons,
    pickerRuntimeState,
    rawPreviewFps: RAW_PREVIEW_FPS,
    rawPreviewScale: RAW_PREVIEW_SCALE,
    forceCpuLayerPreview: FORCE_CPU_LAYER_PREVIEW,
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
    widthRef: () => W,
    heightRef: () => H,
    timeRef: () => t,
    controls,
    documentRef: document,
    transitionSettings,
    blendModes: BLEND_MODES,
    syncControls,
    commitState,
    now: () => performance.now(),
    cpuPrewarmDoneRef: () => cpuPrewarmDone,
    setCpuPrewarmDone: (value) => { cpuPrewarmDone = value; },
    cpuPrewarmRunningRef: () => cpuPrewarmRunning,
    setCpuPrewarmRunning: (value) => { cpuPrewarmRunning = value; },
    getDimensions: () => ({ width: W, height: H }),
    renderLayerColor,
    loadModule,
    hasModule,
    windowRef: window,
    runtimeProfile: RUNTIME_PROFILE,
    pathsForFolder,
    lists,
    startupStep,
    startupTimingState,
    prewarmAllGpuCombos,
    warmupLayerPreviewShaders,
    getGpuShaderStats,
    getLayerVisibility,
    getLayerColor,
    getLayerState: (layerKey) => state[layerKey]
  }));
  renderPipeline = createRenderPipeline({
    windowRef: window,
    documentRef: document,
    getTargetFrameMs: getRuntimeTargetFrameMs,
    getPreviewTargetFrameMs: getRuntimePreviewTargetFrameMs,
    getRenderSchedulerNextAt: () => renderSchedulerNextAt,
    setRenderSchedulerNextAt: (value) => { renderSchedulerNextAt = value; },
    getLastOutputFrameAt: () => lastOutputFrameAt,
    setLastOutputFrameAt: (value) => { lastOutputFrameAt = value; },
    getForceCpuPreviewUntil: () => forceCpuPreviewUntil,
    getPreviewMode: () => effectiveRenderPreviewMode(),
    getShaderPreviewFps: getRuntimeShaderPreviewFps,
    isSerialPipelineEnabled,
    createGpuScene,
    resizeShaderPreviewCanvas,
    shaderPreviewRenderer,
    previewRenderer,
    stagePreviewRenderer,
    stagePixelPreviewRenderer,
    stageShaderPreviewRenderer,
    headless: HEADLESS,
    getDimensions: () => ({ width: W, height: H }),
    isOutputEnabled: () => isProtocolOutputEnabled(),
    shellViewOnly: SHELL_VIEW_ONLY,
    shouldRefreshPreviewFrame: () => SHELL_VIEW_ONLY,
    renderPixelColor,
    renderGpuFrame,
    enqueueOutputFrame: (frame) => outputPipeline?.enqueue(frame),
    reportOutputFrame,
    drawLayerRawPreview,
    getBeatPosition,
    setRenderTime: (value) => { t = value; renderLoopState.setTime(value); },
    updateStartupOverlayHealth,
    getLastPreviewRenderer: () => lastPreviewRenderer,
    setLastPreviewRenderer: (value) => { lastPreviewRenderer = value; },
    schedulerDebugState,
    applySingleFx,
    beginFrameComposition: () => frameComposer?.beginFrame?.(),
    blend,
    applyOutputCorrection,
    getState: () => state,
    getTransitions: () => transitions,
    runtimeProfile: RUNTIME_PROFILE,
    onMetrics: captureRenderPipelineMetric,
    onGpuDrawFailed: (kind) => {
      gpuReady = false;
      // A failed draw must not lock the preview onto the expensive CPU path
      // for seconds. Keep the last visible frame and let the next GPU tick
      // retry after the already-prewarmed scene is available.
      forceCpuPreviewUntil = 0;
      lastGpuFaultAt = performance.now();
      lastGpuFaultKind = String(kind || "gpu");
    }
  });
  installRuntimeDebugHook({
    windowRef: window,
    getHeadless: () => HEADLESS,
    getShellViewOnly: () => SHELL_VIEW_ONLY,
    getEnabled: () => state.enabled,
    getStartupFrameGuard: () => startupFrameGuard,
    getDimensions: () => ({ width: W, height: H }),
    getPreviewMode: () => effectiveRenderPreviewMode(),
    isHeadlessLeaderActive: () => headlessLeader.isActive(),
    getModules: () => modules,
    getState: () => state,
    renderPixelColor
  });
  keyboardControls = createKeyboardControls({
    state,
    heldFxKeys,
    syncControls,
    commitState,
    tapBpm,
    resetBeat,
    randomizeSingleFile,
    stepFile,
    stepBlend,
    isTypingTarget,
    setCrossAltControl: (active) => crossControl?.setAltControl(active),
    syncCrossMouseControl
  });

  await runStartupSequence(createStartupSequenceDeps({
    HEADLESS,
    SHELL_VIEW_ONLY,
    SKIP_STARTUP_LOADING,
    STRICT_STARTUP_PREWARM,
    EMBEDDED_RUNTIME,
    startupStep,
    initShaderInspectorToggle,
    initPreviewCollapseToggle,
    restoreLocalState,
    restoreTransitionSettings,
    ensureBeatClock,
    syncControls,
    initBackgroundDrawWorker,
    connectSocket,
    bindViewportLifecycle,
    resizePreviewCanvas,
    stopBackgroundDrawWorker,
    scheduleNextDraw,
    renderPipeline,
    loadSelectedModules,
    loadList,
    controls,
    lists,
    state,
    pickFile,
    startupProfiling,
    sessionStorageRef: sessionStorage,
    finishStartupProfiling,
    notifyShellRuntimeReady,
    bindControls,
    restoreSettings,
    restoreMapping,
    restoreSerialSettings,
    bindRuntimeStateSync,
    state,
    settingsKey: SETTINGS_KEY,
    mappingKey: MAPPING_KEY,
    serialKey: SERIAL_KEY,
    storageKey: STORAGE_KEY,
    animationLibrarySyncKey: ANIMATION_LIBRARY_SYNC_KEY,
    syncSettingsControls,
    reloadRuntimeStateFromStorage,
    refreshAnimationLibraryRuntime,
    applyState,
    loadSelectedModules,
    scheduleCpuPrewarm,
    syncControls,
    onLedPower: (message) => {
      state.enabled = message.enabled !== false;
      syncControls();
      commitState();
    },
    isApplyingRemoteState: () => stateSyncController?.isApplyingRemoteState?.() === true,
    scheduleCpuPrewarm,
    runStartupWarmupFlow,
    createGpuSceneCandidate,
    scheduleGpuWarmup,
    preloadHeadlessWebglStartup,
    preloadShellViewStartup,
    preloadThumbnailCache,
    preloadNeighborShaders,
    warmupStoredShaderScenes,
    warmupStoredShaderModules,
    preloadEverythingForStartup,
    scheduleFullGpuPrewarm,
    runtimeProfile: RUNTIME_PROFILE,
    startupFrameGuardRef: (value) => { startupFrameGuard = value; },
    startupReadyAtRef: (value) => { startupReadyAt = value; },
    setPreferLocalStateOnBoot: (value) => stateSyncController?.setPreferLocalStateOnBoot?.(value)
  }));

  if (!SHELL_VIEW_ONLY) restoreOutputAutostart({
    storageRef: localStorage,
    fetchRef: fetch.bind(window),
    settingsKey: SETTINGS_KEY,
    serialKey: SERIAL_KEY,
    settings,
    serialSettings,
    setSerialSettings: (next) => { serialSettings = next; },
    telemetryBus,
    windowRef: window
  });
  syncControls();
}


function bindControls() {
  bindAppControlsRuntime({
    controls,
    sliders,
    fxControls,
    state,
    settings,
    transitionSettings,
    BLEND_MODES,
    randomItem,
    bindGlobalControlsRuntime,
    initCenterMenuControlsRuntime,
    bindKeyboardInput,
    bindBlendTransitionControlsRuntime,
    bindModuleSelectControl,
    bindLayerRangeControlsRuntime,
    bindFxControlBindingsRuntime,
    documentRef: document,
    locationRef: location,
    windowRef: window,
    fetchRef: fetch,
    syncControls,
    commitState,
    syncSettingsControls,
    saveSettings,
    syncMasterValue,
    applyRangeVisual,
    numberValue,
    gammaValue,
    contrastValue,
    bpmValue,
    gpuModeValue,
    setGpuReady: (value) => { gpuReady = value; },
    drawRenderPipeline: (now) => renderPipeline?.draw(now),
    requestFreshPreviewFrame: () => renderPipeline?.requestFreshPreviewFrame?.(),
    adjustBpm,
    tapBpm,
    performanceRef: performance,
    toggleCenterMenuRuntime,
    handleOutsideMenuClickRuntime,
    toggleFullscreenRuntime,
    syncFullscreenButtonLabel,
    toggleCenterMenuRuntimeAction,
    handleOutsideMenuClickRuntimeAction,
    crossControl,
    bindPerformancePads,
    bindPreviewTabs,
    keyboardControls,
    transitionSecondsValue,
    startBlendTransition,
    stepBlend,
    syncTransitionControls,
    saveTransitionSettings,
    bindSelect,
    bindStepper,
    bindAnimationPicker,
    bindPalettePicker,
    bindParamSlider,
    bindMasterSlider,
    bindLayerTools,
    bindLayerButtons,
    bindManualPalette,
    bindFx,
    initFxPanelToggles,
    initPerfPadsToggle,
    initManualPaletteToggles,
    initDirectRangeControl,
  initMixCoreCollapse,
  applyTopbarMixLayout
  });
  initLiveArmPanel({ controls });
}

function bindPerformancePads() {
  uiBindings?.bindPerformancePads();
}

function setMasterFlash(active) {
  setMasterFlashRuntimeAction(state, active, syncControls, commitState);
}

function bindPreviewTabs() {
  bindPreviewTabsRuntime(uiBindings);
}


function handleCrossPointerMove(event) {
  crossControl?.handlePointerMove(event);
}

function blockCrossControlPointer(event) {
  crossControl?.blockPointer(event);
}

function handleCrossControlDoubleClick(event) {
  crossControl?.handleDoubleClick(event);
}

function syncCrossMouseControl() {
  crossControl?.sync();
}

function bindLayerButtons(layer) {
  uiBindings?.bindLayerButtons(layer);
}

function bindManualPalette(layer) {
  uiBindings?.bindManualPalette(layer);
}

function bindSelect(select, layer, stateKey, folder, moduleKey) {
  bindModuleSelectControl({
    select,
    layer,
    stateKey,
    folder,
    moduleKey,
    lists,
    switchLayerModule
  });
}

function bindParamSlider(slider, target, index) {
  uiBindings?.bindParamSlider(slider, target, index);
}

function bindCheckbox(id, target, key) {
  bindCheckboxControl({ byId: $, commitState }, id, target, key);
}

function bindStepper(prefix, layer, stateKey, listKey, folder, moduleKey) {
  uiBindings?.bindStepper(prefix, layer, stateKey, listKey, folder, moduleKey);
}

function bindLayerTools(layer) {
  uiBindings?.bindLayerTools(layer);
}

function bindFx(key, mode, amount, rate, flash, hold) {
  uiBindings?.bindFx(key, mode, amount, rate, flash, hold);
}

function triggerFxFlash(key) {
  keyboardControls?.triggerFxFlash(key);
}

async function stepFile(layer, stateKey, listKey, folder, moduleKey, direction, options = {}) {
  return layerModuleNavigation?.stepFile(layer, stateKey, listKey, folder, moduleKey, direction, options);
}

async function randomizeSingleFile(layer, stateKey, listKey, folder, moduleKey, options = {}) {
  return layerModuleNavigation?.randomizeSingleFile(layer, stateKey, listKey, folder, moduleKey, options);
}

async function switchLayerModule(layer, stateKey, folder, moduleKey, file, options = {}) {
  return layerModuleSwitcher?.switchLayerModule(layer, stateKey, folder, moduleKey, file, options);
}

function scheduleCpuPrewarm() {
  moduleWarmup?.scheduleCpuPrewarm();
}

async function prewarmAllCpuModules() {
  return moduleWarmup?.prewarmAllCpuModules?.();
}

function randomizeLayerParams(layer) {
  layerParamRandomizer?.randomizeLayerParams(layer);
}

function bindMasterSlider(slider, target) {
  uiBindings?.bindMasterSlider(slider, target);
}

function refreshRangeVisuals() {
  rangeVisuals.refreshRangeVisuals();
}

function applyRangeVisual(slider) {
  rangeVisuals.applyRangeVisual(slider);
}

function syncMasterValue() {
  rangeVisuals.syncMasterValue();
}

async function loadSelectedModules() {
  return loadSelectedModulesRuntime({
    state,
    modules,
    loadModule,
    lists,
    rememberShaderModuleWarmup,
    warmupCurrentShaderScene
  });
}

async function scheduleModuleWarmup(paths) {
  moduleWarmup?.scheduleModuleWarmup(paths);
}

function scheduleNearbyWarmup(folder, files, currentFile) {
  moduleWarmup?.scheduleNearbyWarmup(folder, files, currentFile);
}

function scheduleBackgroundModuleWarmup() {
  backgroundModuleWarmup?.scheduleBackgroundModuleWarmup();
}

async function loadList(folder, select) {
  return loadModuleList({ folder, select, cleanModuleName });
}

async function refreshAnimationLibraryRuntime() {
  if (animationLibraryRefreshPromise) return animationLibraryRefreshPromise;
  animationLibraryRefreshPromise = (async () => {
    const before = {
      l1Anim: state.l1.animFile,
      l1Palette: state.l1.paletteFile,
      l2Anim: state.l2.animFile,
      l2Palette: state.l2.paletteFile
    };
    const [l1Anims, l1Palettes, l2Anims, l2Palettes] = await Promise.all([
      loadList("l1_anims", controls.l1Anim),
      loadList("l1_palettes", controls.l1Palette),
      loadList("l2_anims", controls.l2Anim),
      loadList("l2_palettes", controls.l2Palette)
    ]);
    lists.l1Anims = l1Anims;
    lists.l1Palettes = l1Palettes;
    lists.l2Anims = l2Anims;
    lists.l2Palettes = l2Palettes;
    state.l1.animFile = pickFile(state.l1.animFile, l1Anims);
    state.l1.paletteFile = pickFile(state.l1.paletteFile, l1Palettes);
    state.l2.animFile = pickFile(state.l2.animFile, l2Anims);
    state.l2.paletteFile = pickFile(state.l2.paletteFile, l2Palettes);
    const changed = before.l1Anim !== state.l1.animFile
      || before.l1Palette !== state.l1.paletteFile
      || before.l2Anim !== state.l2.animFile
      || before.l2Palette !== state.l2.paletteFile;
    await loadSelectedModules().catch((error) => {
      console.warn("Animation library refresh module reload failed", error);
    });
    if (changed) commitState();
    scheduleCpuPrewarm();
    scheduleNextDraw(performance.now(), true);
    syncControls();
  })().finally(() => {
    animationLibraryRefreshPromise = null;
  });
  return animationLibraryRefreshPromise;
}


function preloadNeighborShaders(layer, folder, files, currentFile) {
  preloadNeighborShadersRuntime({
    layer,
    folder,
    files,
    currentFile,
    shaderPreloadManager,
    layerTime,
    state,
    getBeatPosition,
    normalizedParams,
    windowRef: window,
    loadModule,
    renderShaderLayerCanvas,
    shaderNeighborWarmupCanvas
  });
}

function warmupCurrentShaderScene() {
  const scene = createGpuSceneCandidate({ forceEnabled: true });
  if (scene) scheduleGpuWarmup(scene);
}

function buildShaderWarmupSnapshot(sourceScene = null) {
  return buildShaderWarmupSnapshotRuntime({
    sourceScene,
    state,
    settings,
    t,
    getBeatPosition,
    buildShaderLayerSnapshot
  });
}

function buildShaderLayerSnapshot(layerState) {
  return buildShaderLayerSnapshotRuntime({ layerState, normalizedParams });
}

function shaderWarmupKey(snapshot) {
  return shaderWarmupKeyRuntime(snapshot);
}

function rememberShaderWarmupScene(sourceScene = null) {
  rememberShaderWarmupSceneRuntime({
    sourceScene,
    buildShaderWarmupSnapshot,
    shaderWarmupKey,
    sessionStorageRef: sessionStorage,
    shaderPrewarmKey: SHADER_PREWARM_KEY
  });
}

function rememberShaderModuleWarmup(layer, folder, files, currentFile) {
  rememberShaderModuleWarmupRuntime({
    layer,
    folder,
    files,
    currentFile,
    sessionStorageRef: sessionStorage,
    shaderModulePrewarmKey: SHADER_MODULE_PREWARM_KEY
  });
}

async function warmupStoredShaderScenes() {
  await warmupStoredShaderScenesRuntime({
    previewRenderer,
    forceCpuRender: FORCE_CPU_RENDER,
    sessionStorageRef: sessionStorage,
    shaderPrewarmKey: SHADER_PREWARM_KEY,
    lists,
    buildShaderWarmupSnapshot,
    state,
    loadModule,
    createGpuWarmupScene,
    scheduleGpuWarmup
  });
}

async function warmupStoredShaderModules() {
  await warmupStoredShaderModulesRuntime({
    lists,
    sessionStorageRef: sessionStorage,
    shaderModulePrewarmKey: SHADER_MODULE_PREWARM_KEY,
    schedulerDebugState,
    layerTime,
    state,
    getBeatPosition,
    normalizedParams,
    loadModule,
    renderShaderLayerCanvas,
    shaderNeighborWarmupCanvas
  });
}

function scheduleNextDraw(now = performance.now(), force = false) {
  renderPipeline?.scheduleNextDraw(now, force);
}

function initBackgroundDrawWorker() {
  renderPipeline?.initBackgroundDrawWorker();
}

function stopBackgroundDrawWorker() {
  renderPipeline?.stopBackgroundDrawWorker();
}

function updateStartupOverlayHealth(now) {
  if (!startupProfiling.enabled || startupOverlayClosed || !startupOverlay?.root) return;
  if (!startupReadyAt) return;

  const health = evaluateStartupOverlayHealthRuntime({
    now,
    startupReadyAt,
    startupFrameCount,
    startupLastFrameAt,
    startupStableSince,
    stallGapMs: STARTUP_STALL_GAP_MS,
    minFrames: STARTUP_READY_MIN_FRAMES,
    stableMsThreshold: STARTUP_READY_STABLE_MS,
    minWarmupMs: STARTUP_READY_MIN_WARMUP_MS,
    progressStableMs: STARTUP_PROGRESS_STABLE_MS,
    progressAfterReadyMs: STARTUP_PROGRESS_AFTER_READY_MS
  });
  startupFrameCount = health.startupFrameCount;
  startupLastFrameAt = health.startupLastFrameAt;
  startupStableSince = health.startupStableSince;

  const { enoughFrames, enoughStable, enoughWarmupTime, progressRatio } = health;
  startupStep(94 + progressRatio * 5, "Finalizing runtime");

  if (enoughFrames && enoughStable && enoughWarmupTime) {
    startupStep(100, "Ready");
    startupOverlayClosed = true;
    startupFrameGuard = false;
    closeStartupOverlay(startupOverlay, {
      greetingEnabled: settings.welcomeEnabled !== false,
      greetingText: settings.welcomeText || "vítej borče"
    });
  }
}

function scheduleGpuWarmup(scene) {
  gpuWarmupQueueRuntime.scheduleGpuWarmup(scene);
}

function processGpuWarmupQueue(deadline) {
  gpuWarmupQueueRuntime.processGpuWarmupQueue(deadline);
}

function scheduleFullGpuPrewarm(restart = false) {
  gpuPrewarmHelpers.scheduleFullGpuPrewarm({
    restart,
    hasStartedRef: () => fullGpuPrewarmStarted,
    setStarted: (value) => { fullGpuPrewarmStarted = value; },
    startDelayMs: GPU_PREWARM_START_DELAY_MS,
    interactiveChunkSize: GPU_PREWARM_INTERACTIVE_CHUNK_SIZE,
    interactiveYieldMs: GPU_PREWARM_INTERACTIVE_YIELD_MS
  });
}

async function prewarmAllGpuCombos(onProgress, options = {}) {
  return gpuPrewarmHelpers.prewarmAllGpuCombos(onProgress, options);
}

function createGpuWarmupScene(l1Gpu, l2Gpu, snapshot = null) {
  return gpuPrewarmHelpers.createGpuWarmupScene(l1Gpu, l2Gpu, snapshot);
}

installShellRunnerOutputFrameReceiver();

function startPerfProfileReporter() {
  appDelegates.startPerfProfileReporter();
}

function startUiRefreshLoops() {
  appDelegates.startUiRefreshLoops();
}

function normalizedPreviewMode() {
  try {
    const raw = document.body?.dataset?.previewMode || previewModeDatasetValue?.() || getPreviewMode?.() || "pixel";
    const mode = String(raw || "pixel").toLowerCase();
    if (mode === "debug") return "debug";
    if (mode === "shader") return "shader";
    if (mode === "stage") return "stage";
    if (mode === "pixel" || mode === "pixels" || mode === "small") return "pixel";
    return mode;
  } catch {
    return "pixel";
  }
}

function shouldRefreshShaderInspector() {
  if (isDocumentHidden()) return false;
  const mode = normalizedPreviewMode();
  if (mode !== "shader" && mode !== "debug") return false;
  if (!controls.shaderInspector) return false;
  return !controls.shaderInspector.classList.contains("is-collapsed");
}

function shouldRefreshDebugOverlay() {
  if (isDocumentHidden()) return false;
  if (normalizedPreviewMode() === "debug") return true;
  if (document.body?.dataset?.previewMode === "debug") return true;
  return isDebugPreviewTabActive();
}

function isDocumentHidden() {
  return Boolean(document.hidden);
}

function isDebugPreviewTabActive() {
  return controls.previewTabs?.some?.((button) => button?.id === "previewTabDebug" && button.classList?.contains("active")) || false;
}

function syncOutputCards(detail) {
  appDelegates.syncOutputCards(detail);
}

function syncDebugPanel(detail) {
  syncDebugPanelRuntime({
    controls,
    serialOutput,
    serialSettings,
    state,
    settings,
    modules,
    W,
    H,
    getBeatPosition,
    schedulerDebugState,
    startupTimingState
  }, detail);
}

function applyShaderInspectorCollapsed() {
  collapseFacade.applyShaderInspectorCollapsed();
}

function initShaderInspectorToggle() {
  collapseFacade.initShaderInspectorToggle();
}

function initDirectRangeControl() {
  initDirectRangeControlRuntime(document);
}

function initFxPanelToggles() {
  collapseFacade.initFxPanelToggles();
}

function initManualPaletteToggles() {
  collapseFacade.initManualPaletteToggles();
}

function applyPreviewCollapsed() {
  collapseFacade.applyPreviewCollapsed();
}

function initPreviewCollapseToggle() {
  collapseFacade.initPreviewCollapseToggle();
}

function shaderCodeText(gpu) {
  return shaderCodeTextRuntime(gpu);
}

function syncShaderInspector(detail = null) {
  appDelegates.syncShaderInspector(detail);
}

function createGpuScene() {
  if (startupFrameGuard) return null;
  if (!canUseGpuRender()) return null;
  if (!gpuReady) {
    const now = performance.now();
    const scene = createGpuSceneCandidate();
    if (scene && shouldTryGpuAutoSwitch(now)) {
      gpuWarmupAttemptAt = now;
      scheduleGpuWarmup(scene);
    }
    return scene;
  }
  return createGpuSceneCandidate();
}

function renderGpuFrame() {
  const outputActive = Boolean(isOutputEnabled());
  const previewMode = String(document.body?.dataset?.previewMode || "").toLowerCase();
  const backend = decideRenderBackend({
    forceCpuRender: FORCE_CPU_RENDER,
    gpuAllowed: canUseGpuRender(),
    gpuSceneAvailable: Boolean(gpuOutputRenderer || shaderPreviewRenderer),
    outputActive,
    previewMode,
    shaderPreviewSize: document.body?.dataset?.shaderPreviewSize
  });
  if (!backend.needsCpuFrame || !backend.useGpuScene) return null;
  // Shader-only preview can draw directly to its WebGL canvas. Pixel and Stage
  // views need a composed RGB frame, so use the GPU readback path there too;
  // otherwise every animation switch falls back to a synchronous CPU render.
  const now = performance.now();
  if (!gpuOutputRenderer) {
    const canvas = document.createElement("canvas");
    gpuOutputRenderer = createShaderSceneRenderer(canvas);
  }
  if (!gpuOutputRenderer?.drawShaderScene || !gpuOutputRenderer?.readFrame) return null;
  const gpuRenderStartedAt = performance.now();
  // Keep the fullscreen GPU scene driven by the live render clock. The CPU
  // compositor intentionally caches its layer timestamp, which is not safe
  // to reuse for the synchronous GPU readback path.
  t = getBeatPosition();
  renderLoopState.setTime(t);
  const scene = createGpuSceneCandidate({ forceEnabled: true });
  if (!scene) return null;
  const transitionScene = Boolean(scene.blendTransition)
    || scene.layers?.some((layer) => Boolean(layer?.transition));
  // Keep fade transitions on the GPU as well. Falling back to the CPU here
  // renders both the previous and current animation for every matrix pixel and
  // was the main source of the multi-second hitch during fades.
  if (transitionScene) gpuTransitionFallbackUntil = 0;
  const blendMode = String(scene.blendMode || "");
  gpuOutputBlendMode = blendMode;
  gpuOutputRenderer.resize?.(W, H);
  const drawn = gpuOutputRenderer.drawShaderScene(scene);
  if (drawn === false) return null;
  const frame = gpuOutputRenderer.readFrame();
  if (!(frame instanceof Uint8Array) || frame.byteLength !== W * H * 3) return null;
  const renderMs = Math.max(0, performance.now() - gpuRenderStartedAt);
  return {
    frame,
    renderMs,
    renderer: "gpu-readback"
  };
}

function createGpuSceneCandidate(options = {}) {
  return createGpuSceneCandidateRuntime({
    forceCpuRender: FORCE_CPU_RENDER,
    state,
    // Shell mode intentionally keeps the LED canvas 2D, but Shader/Stage
    // preview use their own WebGL renderer. GPU scene eligibility must follow
    // that renderer instead of the monitor canvas.
    previewRenderer: shaderPreviewRenderer || previewRenderer,
    modules,
    transitions,
    transitionProgress,
    easeInOut,
    normalizedParams,
    layerTime,
    getLayerVisibility,
    normalizeManualPalette,
    normalizeManualPaletteActive,
    activeManualPaletteColors,
    hexToRgb,
    clamp01,
    clampInt,
    width: W,
    height: H,
    time: t,
    beat: getBeatPosition(),
    settings
  }, options);
}

function canUseGpuRender() {
  return canUseGpuRenderRuntime({
    forceCpuRender: FORCE_CPU_RENDER,
    gpuModeValue,
    settings
  });
}

function shouldTryGpuAutoSwitch(now) {
  return shouldTryGpuAutoSwitchRuntime({
    canUseGpuRender,
    gpuModeValue,
    settings,
    gpuReady,
    previewRenderer,
    gpuWarmupAttemptAt
  }, now);
}

function drawLayerRawPreview(layer) {
  appDelegates.drawLayerRawPreview(layer);
}

function getLayerColor(layerKey, x, y) {
  return appDelegates.getLayerColor(layerKey, x, y);
}

function renderLayerColor(layerKey, layerState, layerModules, x, y) {
  return appDelegates.renderLayerColor(layerKey, layerState, layerModules, x, y);
}

function manualPaletteColor(palette, value) {
  return appDelegates.manualPaletteColor(palette, value);
}

function layerTime(layerState) {
  return appDelegates.layerTime(layerState);
}

function getLayerVisibility(layerState) {
  return appDelegates.getLayerVisibility(layerState);
}

function applyOutputCorrection(color) {
  return appDelegates.applyOutputCorrection(color);
}

function renderPixelColor(layerKey, x, y, mix) {
  return appDelegates.renderPixelColor(layerKey, x, y, mix);
}

function applySingleFx(color, fx, x, y, phaseOffset) {
  return appDelegates.applySingleFx(color, fx, x, y, phaseOffset);
}

function blend(a, b) {
  return appDelegates.blend(a, b);
}

function blendWithMode(a, b, mode) {
  return appDelegates.blendWithMode(a, b, mode);
}

function syncControls() {
  uiStateSync?.syncControls();
}

function getPreviewMode() {
  return appDelegates.getPreviewMode();
}

function getPixelPreviewMode() {
  return appDelegates.getPixelPreviewMode();
}

function previewModeDatasetValue() {
  return appDelegates.previewModeDatasetValue();
}

function getDebugOverlayBaseMode() {
  return appDelegates.getDebugOverlayBaseMode();
}

function effectiveRenderPreviewMode() {
  return appDelegates.effectiveRenderPreviewMode(previewModeDatasetValue());
}

function setPreviewMode(mode) {
  appDelegates.setPreviewMode(mode);
}

function cyclePixelPreviewMode() {
  appDelegates.cyclePixelPreviewMode();
}

function cycleShaderPreviewMode() {
  appDelegates.cycleShaderPreviewMode();
}

function syncPreviewModeControls() {
  appDelegates.syncPreviewModeControls();
}

function syncRenderModeControls() {
  appDelegates.syncRenderModeControls(gpuReady);
}

function syncLayerButtons(layer) {
  appDelegates.syncLayerButtons(layer);
}

function syncManualPalette(layer) {
  appDelegates.syncManualPalette(layer);
}

function syncPaletteSelectPreview(select, paletteModule, file) {
  appDelegates.syncPaletteSelectPreview(select, paletteModule, file);
}

function syncLayerTools(layer) {
  appDelegates.syncLayerTools(layer);
}

function updateParamLabels(layer) {
  appDelegates.updateParamLabels(layer);
}

function connectSocket() {
  stateSyncController?.connect();
}

// STEP37AT: live-output UI commit governor.
// UI clicks/sliders may call commitState() many times in one paint. While a
// physical output lock is active, coalesce websocket/disk/shell sync so control
// changes still update the in-memory render state immediately, but serialization
// and parent postMessage do not steal time from the output frame.
let uiCommitGovernorTimer37AT = 0;
let uiCommitGovernorLastFlush37AT = 0;
let uiCommitGovernorPending37AT = false;
let uiCommitGovernorFlushCount37AT = 0;
let uiCommitGovernorCoalesced37AT = 0;

function isLiveOutputCommitGovernorActive37AT() {
  try {
    const lock = window.__budilightOutputLock37AP;
    if (lock?.active === true) return true;
  } catch {}
  try {
    if (typeof isProtocolOutputEnabled === "function" && isProtocolOutputEnabled()) return true;
  } catch {}
  return false;
}

function flushUiCommitGovernor37AT(reason = "flush") {
  if (uiCommitGovernorTimer37AT) {
    clearTimeout(uiCommitGovernorTimer37AT);
    uiCommitGovernorTimer37AT = 0;
  }
  uiCommitGovernorPending37AT = false;
  uiCommitGovernorLastFlush37AT = performance.now();
  uiCommitGovernorFlushCount37AT += 1;
  const useCommandBus = isLiveOutputCommitGovernorActive37AT();
  try {
    stateSyncController?.commit({
      transport: useCommandBus ? "command" : "update",
      persist: true,
      volatile: false,
      reason: String(reason || (useCommandBus ? "live-ui-command" : "ui-update"))
    });
  } catch {}
  try { broadcastStateSync({ includeState: !useCommandBus, reason }); } catch {}
  try {
    window.__budilightUiCommitGovernor37AT = {
      version: "STEP37AT_UI_COMMIT_GOVERNOR",
      active: isLiveOutputCommitGovernorActive37AT(),
      pending: false,
      delayMs: 72,
      lastFlushAt: uiCommitGovernorLastFlush37AT,
      flushCount: uiCommitGovernorFlushCount37AT,
      coalesced: uiCommitGovernorCoalesced37AT,
      reason
    };
  } catch {}
}

function scheduleUiCommitGovernor37AT(reason = "coalesced") {
  uiCommitGovernorPending37AT = true;
  uiCommitGovernorCoalesced37AT += 1;
  if (uiCommitGovernorTimer37AT) {
    try {
      window.__budilightUiCommitGovernor37AT = {
        version: "STEP37AT_UI_COMMIT_GOVERNOR",
        active: true,
        pending: true,
        delayMs: 72,
        lastFlushAt: uiCommitGovernorLastFlush37AT,
        flushCount: uiCommitGovernorFlushCount37AT,
        coalesced: uiCommitGovernorCoalesced37AT,
        reason
      };
    } catch {}
    return;
  }
  uiCommitGovernorTimer37AT = managedTimeout37CF('app:ui-commit-governor', () => flushUiCommitGovernor37AT(reason), 72, { liveFactor: 1.5, hiddenFactor: 2, maxMs: 500 });
  try {
    window.__budilightUiCommitGovernor37AT = {
      version: "STEP37AT_UI_COMMIT_GOVERNOR",
      active: true,
      pending: true,
      delayMs: 72,
      lastFlushAt: uiCommitGovernorLastFlush37AT,
      flushCount: uiCommitGovernorFlushCount37AT,
      coalesced: uiCommitGovernorCoalesced37AT,
      reason
    };
  } catch {}
}

function commitState(options = {}) {
  const immediate = options?.immediate === true || options?.force === true;
  const explicitCommand = options?.transport === "command" || options?.mode === "command" || options?.volatile === true;
  if (explicitCommand) {
    try {
      stateSyncController?.commit({
        transport: "command",
        persist: options?.persist !== false,
        volatile: options?.volatile === true,
        reason: String(options?.reason || "explicit-command"),
        commandKind: String(options?.commandKind || options?.kind || (options?.volatile === true ? "live-param" : "state-patch"))
      });
    } catch {}
    if (options?.sync !== false) {
      try { broadcastStateSync({ includeState: false, reason: String(options?.reason || "explicit-command") }); } catch {}
    }
    return;
  }
  if (!immediate && isLiveOutputCommitGovernorActive37AT()) {
    scheduleUiCommitGovernor37AT(String(options?.reason || "live-output"));
    return;
  }
  flushUiCommitGovernor37AT(String(options?.reason || "immediate"));
}

// STEP22OK: fast sequencer automation bridge.
// The quick step sequencer must not drive live controls by DOM clicks on every
// slot boundary. A click path runs syncControls + commitState immediately and
// can stall both preview and ArtNet for a few ms on every step. These helpers
// mutate the live state directly, then commit/sync once, slightly after the
// boundary, so the render/output frame can keep its pacing.
const stepSeqAutomationBridge = (() => {
  let pendingUiSync = false;
  let pendingCommit = false;
  let commitTimer = 0;

  const layerKey = (layer) => `l${Number(layer) === 2 ? 2 : 1}`;
  const fxKey = (layer) => `fx${Number(layer) === 2 ? 2 : 1}`;
  const sendCommand = (kind, payload = {}, options = {}) => {
    try {
      const socket = stateSyncController?.getSocket?.();
      if (!socket || socket.readyState !== WebSocket.OPEN) return false;
      const message = {
        type: "command",
        command: {
          kind: String(kind || "command"),
          payload: payload && typeof payload === "object" ? payload : {},
          persist: options.persist === true,
          reason: String(options.reason || kind || "command")
        }
      };
      socket.send(JSON.stringify(message));
      window.__budilightCommandBus37BM = {
        version: "STEP37BM_STEPSEQ_COMMAND_BUS",
        lastKind: message.command.kind,
        lastReason: message.command.reason,
        lastPayloadKeys: Object.keys(message.command.payload || {}),
        lastSentAt: performance.now(),
        bufferedAmount: Number(socket.bufferedAmount || 0)
      };
      return true;
    } catch {
      return false;
    }
  };

  const scheduleFlush = (options = {}) => {
    const wantsUiSync = options.ui !== false;
    const wantsCommit = options.commit !== false;
    pendingUiSync = pendingUiSync || wantsUiSync;
    pendingCommit = pendingCommit || wantsCommit;
    if (!pendingUiSync && !pendingCommit) return;
    if (commitTimer) return;
    const run = () => {
      commitTimer = 0;
      try { if (pendingUiSync) syncControls(); } catch {}
      try {
        if (pendingCommit) {
          if (options.transport === "command" || options.volatile === true) {
            commitState({
              transport: "command",
              volatile: options.volatile === true,
              persist: options.persist !== false,
              reason: String(options.reason || "stepseq-fast-api"),
              commandKind: String(options.commandKind || (options.volatile === true ? "stepseq-live-param" : "stepseq-state"))
            });
          } else {
            commitState();
          }
        }
      } catch {}
      pendingUiSync = false;
      pendingCommit = false;
    };
    // Move state persistence / websocket sync out of the exact step-boundary
    // frame. This is the frame where the output clock is most sensitive.
    commitTimer = managedTimeout37CF('app:stepseq-automation-flush', run, Number(options.delayMs ?? 18), { liveFactor: 1.2, hiddenFactor: 2, maxMs: 250 });
  };

  const markSequencerFastAction = (kind, layer, extra = {}) => {
    try {
      window.__budilightStepSeqFastActions37EB = {
        version: "STEP37EC_STEPSEQ_PARAM_LIVE_SYNC_BRIDGE",
        kind,
        layer: Number(layer) === 2 ? 2 : 1,
        at: performance.now(),
        count: Number(window.__budilightStepSeqFastActions37EB?.count || 0) + 1,
        ...extra
      };
    } catch {}
  };

  const syncFlipCheckbox = (layer, enabled) => {
    try {
      const checkbox = document.getElementById(`l${Number(layer) === 2 ? 2 : 1}_reverse`);
      if (checkbox) checkbox.checked = Boolean(enabled);
    } catch {}
  };

  const syncParamSliders = (layer) => {
    try {
      const key = layerKey(layer);
      const params = state?.[key]?.params;
      if (!Array.isArray(params)) return;
      params.forEach((value, index) => {
        const slider = document.getElementById(`${key}_param_${index}`)
          || document.getElementById(`${key}_p${index}`)
          || document.getElementById(`${key}_p${index + 1}`);
        if (slider) slider.value = String(value);
      });
    } catch {}
  };

  const setFlip = (layer, enabled, options = {}) => {
    const key = layerKey(layer);
    if (!state?.[key]) return false;
    const next = Boolean(enabled);
    const changed = state[key].reverse !== next;
    state[key].reverse = next;
    syncFlipCheckbox(layer, next);
    markSequencerFastAction("flip", layer, { value: next, changed });
    if (changed || options.forceFlush === true) scheduleFlush(options);
    return true;
  };

  const setFx = (layer, mode, hold, options = {}) => {
    const key = fxKey(layer);
    if (!state?.[key]) return false;
    let changed = false;
    if (typeof mode === "string" && state[key].mode !== mode) {
      state[key].mode = mode;
      changed = true;
    }
    if (typeof hold === "boolean" && state[key].hold !== hold) {
      state[key].hold = hold;
      changed = true;
    }
    if (changed) scheduleFlush(options);
    return true;
  };

  const randomizeParams = (layer, options = {}) => {
    const key = layerKey(layer);
    const target = state?.[key]?.params;
    if (!Array.isArray(target)) return false;
    let previousModules = null;
    let previousState = null;
    if (options.transition !== false) {
      try { previousModules = captureLayerModules?.(key); } catch {}
      try { previousState = cloneLayerState?.(state[key]); } catch {}
    }
    const before = target.slice(0, PARAM_COUNT).map((value) => Number(value));
    const gentle = options.gentle !== false;
    const amount = Math.max(0.02, Math.min(1, Number(options.amount ?? (gentle ? 0.24 : 1)) || 0.24));
    let changed = false;
    for (let index = 0; index < PARAM_COUNT; index += 1) {
      const current = Number.isFinite(Number(target[index])) ? Number(target[index]) : 0.5;
      let next = gentle
        ? Math.max(0, Math.min(1, current + (Math.random() - 0.5) * amount))
        : Math.random();
      // Avoid an almost invisible random step. Sequencer PARAM must be obvious
      // enough on a live strip but still not jump as brutally as full random.
      if (gentle && Math.abs(next - current) < 0.055) {
        const dir = Math.random() < 0.5 ? -1 : 1;
        next = Math.max(0, Math.min(1, current + dir * (0.075 + Math.random() * amount * 0.45)));
      }
      const rounded = Number(next.toFixed(3));
      if (rounded !== Number(target[index])) changed = true;
      target[index] = rounded;
    }
    if (previousModules && previousState) {
      try { startLayerTransition?.(key, previousModules, previousState); } catch {}
    }
    syncParamSliders(layer);
    try { scheduleNextDraw?.(performance.now()); } catch {}
    markSequencerFastAction("param", layer, {
      gentle,
      amount,
      changed,
      before,
      after: target.slice(0, PARAM_COUNT).map((value) => Number(value)),
      liveCommit: options.commit !== false
    });
    scheduleFlush(options);
    return true;
  };

  const stepModule = (layer, kind, direction, options = {}) => {
    const safeLayer = Number(layer) === 2 ? "l2" : "l1";
    const isPalette = kind === "palette" || kind === "color";
    const stateKey = isPalette ? "paletteFile" : "animFile";
    const listKey = isPalette
      ? (safeLayer === "l2" ? "l2Palettes" : "l1Palettes")
      : (safeLayer === "l2" ? "l2Anims" : "l1Anims");
    const folder = isPalette
      ? (safeLayer === "l2" ? "l2_palettes" : "l1_palettes")
      : (safeLayer === "l2" ? "l2_anims" : "l1_anims");
    const moduleKey = isPalette ? "palette" : "anim";
    // Do not run dynamic imports in the step boundary call stack.
    managedTimeout37CF('app:stepseq-step-module', () => {
      try {
        layerModuleNavigation?.stepFile(
          safeLayer,
          stateKey,
          listKey,
          folder,
          moduleKey,
          Number(direction) || 1,
          {
            ui: options.ui,
            commit: options.commit,
            commitDelayMs: options.delayMs,
            warmup: false,
            transition: options.transition === true,
            coalesce: options.coalesce !== false,
            debounceMs: Math.max(0, Number(options.debounceMs ?? 12))
          }
        );
      } catch {}
    }, Number(options.delayMs ?? 1), { liveFactor: 1.2, hiddenFactor: 2, maxMs: 250 });
    return true;
  };

  const randomModule = (layer, kind, options = {}) => {
    const safeLayer = Number(layer) === 2 ? "l2" : "l1";
    const isPalette = kind === "palette" || kind === "color";
    const stateKey = isPalette ? "paletteFile" : "animFile";
    const listKey = isPalette
      ? (safeLayer === "l2" ? "l2Palettes" : "l1Palettes")
      : (safeLayer === "l2" ? "l2Anims" : "l1Anims");
    const folder = isPalette
      ? (safeLayer === "l2" ? "l2_palettes" : "l1_palettes")
      : (safeLayer === "l2" ? "l2_anims" : "l1_anims");
    const moduleKey = isPalette ? "palette" : "anim";
    managedTimeout37CF('app:stepseq-random-module', () => {
      try {
        layerModuleNavigation?.randomizeSingleFile(
          safeLayer,
          stateKey,
          listKey,
          folder,
          moduleKey,
          {
            ui: options.ui,
            commit: options.commit,
            commitDelayMs: options.delayMs,
            warmup: false,
            transition: options.transition === true,
            coalesce: options.coalesce !== false,
            debounceMs: Math.max(0, Number(options.debounceMs ?? 18))
          }
        );
      } catch {}
    }, Number(options.delayMs ?? 1), { liveFactor: 1.2, hiddenFactor: 2, maxMs: 250 });
    return true;
  };

  return { version: "stepseq-fast-api-37ec-param-live-sync-bridge", setFlip, setFx, randomizeParams, stepModule, randomModule, flush: scheduleFlush, sendCommand };
})();

try { window.BudiStepSeqFastApi = stepSeqAutomationBridge; } catch {}
try {
  window.resetBeat = resetBeat;
  window.getBeatPosition = getBeatPosition;
  window.syncBeatToNearestDownbeat = syncBeatToNearestDownbeat;
  window.seekBeatPosition = seekBeatPosition;
} catch {}

function restoreLocalState() {
  return appCoreDelegates.restoreLocalState();
}

async function reloadRuntimeStateFromStorage() {
  restoreRuntimePersistence();
  const changed = restoreLocalState();
  if (changed) {
    await loadSelectedModules().catch((error) => {
      console.warn("State sync module reload failed", error);
    });
    scheduleCpuPrewarm();
  }
  syncControls();
  scheduleNextDraw(performance.now());
}

function restoreSettings() {
  appCoreDelegates.restoreSettings();
}

function outputModeValue(value) {
  return appCoreDelegates.outputModeValue(value);
}

function effectiveOutputMode() {
  if (settings.blxEnabled) return settings.blxTransport === "net" ? OUTPUT_MODE_BLX_NET : OUTPUT_MODE_BLX_SERIAL;
  return settings.outputMode;
}

function normalizedConfiguredOutputMode() {
  return String(settings.outputMode || "preview").toLowerCase();
}

function isExplicitNetworkOutputMode(mode = normalizedConfiguredOutputMode()) {
  return mode === "artnet" || mode === "sacn" || mode === "wifi" || mode === "espnow";
}

function isExplicitSerialOutputMode(mode = normalizedConfiguredOutputMode()) {
  return mode === "serial" || mode === "blx_serial";
}

function isArtnetRouteConfigured(mode = normalizedConfiguredOutputMode()) {
  return settings.artnetEnabled === true
    || settings.routerArtnetEnabled === true
    || state.artnetEnabled === true
    || isExplicitNetworkOutputMode(mode);
}

function isSerialRouteConfigured(mode = normalizedConfiguredOutputMode()) {
  return serialSettings.enabled === true
    || settings.routerSerialEnabled === true
    || settings.blxEnabled === true
    || isExplicitSerialOutputMode(mode);
}

function isSerialOutputClockPreferred(mode = normalizedConfiguredOutputMode()) {
  // Persisted ArtNet flags can stay ON in settings/localStorage even while the
  // operator is actively driving the physical serial route again. The output
  // clock must stay on the serial FPS unless the user explicitly switched the
  // runtime mode back to a network output.
  return isSerialRouteConfigured(mode) && !isExplicitNetworkOutputMode(mode);
}

function isProtocolOutputEnabled() {
  if (startupFrameGuard) return false;
  // STEP22GC: rendering the master frame must not depend on one exclusive
  // outputMode. The PERFORMANCE master preview is the source frame for every
  // routed output, so it should render whenever the global engine is ON.
  return state.enabled === true;
}

function isAnyLiveOutputRouteEnabled() {
  if (startupFrameGuard) return false;
  if (SHELL_VIEW_ONLY) return false;
  if (HEADLESS && !headlessLeader.isActive()) return false;
  const mode = normalizedConfiguredOutputMode();
  const artnetOn = isArtnetRouteConfigured(mode);
  const serialOn = isSerialRouteConfigured(mode);
  const blxOn = settings.blxEnabled === true;
  const usbDmxOn = settings.usbDmxEnabled === true;
  return Boolean(state.enabled && (serialOn || artnetOn || blxOn || usbDmxOn));
}

function isSerialPipelineEnabled() {
  // Legacy function name kept because many runtime modules call it, but the
  // meaning is now “live output pipeline enabled”, not “Serial only”.
  // STEP22NQ: this must be true for ArtNet too. If it returns false for a
  // network route, the output-owned render clock is not allowed to enqueue
  // frames, so ArtNet falls back to the throttled visible preview cadence
  // (~24-30 FPS) and the strip looks stepped even when the app is running.
  return isAnyLiveOutputRouteEnabled();
}

function restoreTransitionSettings() {
  appCoreDelegates.restoreTransitionSettings();
}

function restoreMapping() {
  appCoreDelegates.restoreMapping();
}

function restoreSerialSettings() {
  appCoreDelegates.restoreSerialSettings();
}

function previewDimensions(mapping) {
  return appCoreDelegates.previewDimensions(mapping);
}

function resizePreviewCanvas() {
  previewCanvasResize.resizePreviewCanvas();
}

function resizeShaderPreviewCanvas() {
  previewCanvasResize.resizeShaderPreviewCanvas();
}

function saveSettings() {
  appCoreDelegates.saveSettings();
  broadcastStateSync();
}

function saveTransitionSettings() {
  appCoreDelegates.saveTransitionSettings();
  broadcastStateSync();
}

function syncSettingsControls() {
  uiStateSync?.syncSettingsControls();
}

function syncTransitionControls() {
  uiStateSync?.syncTransitionControls();
}

function saveLocalState() {
  appCoreDelegates.saveLocalState();
  broadcastStateSync({ includeState: true });
}

function applyState(nextState) {
  appCoreDelegates.applyState(nextState);
}

function cloneStateSyncSnapshot(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

let stateBroadcastLastFullAt37AY = 0;
let stateBroadcastLastLightAt37AY = 0;
let stateBroadcastSkipped37AY = 0;

function isStateBroadcastGovernorActive37AY() {
  try { if (window.__budilightOutputLock37AP?.active === true) return true; } catch {}
  try { if (typeof isProtocolOutputEnabled === "function" && isProtocolOutputEnabled()) return true; } catch {}
  return false;
}

function broadcastStateSync(options = {}) {
  if (!window.parent || window.parent === window) return;

  const now = performance.now();
  const governed = isStateBroadcastGovernorActive37AY();
  const wantsFullState = Boolean(options.includeState);
  const fullGapMs = governed ? 1100 : 0;
  const lightGapMs = governed ? 180 : 0;

  if (governed && wantsFullState && now - stateBroadcastLastFullAt37AY < fullGapMs) {
    stateBroadcastSkipped37AY += 1;
    try {
      window.__budilightStateBroadcastGovernor37AY = {
        version: "STEP37AY_STATE_PERSISTENCE_GOVERNOR",
        governed: true,
        skipped: stateBroadcastSkipped37AY,
        lastFullAgoMs: Math.round(now - stateBroadcastLastFullAt37AY),
        mode: "skip-full"
      };
    } catch {}
    return;
  }

  if (governed && !wantsFullState && now - stateBroadcastLastLightAt37AY < lightGapMs) {
    stateBroadcastSkipped37AY += 1;
    return;
  }

  const message = { type: STATE_SYNC_MESSAGE_TYPE };
  if (wantsFullState) {
    try {
      message.state = cloneStateSyncSnapshot(state);
      stateBroadcastLastFullAt37AY = now;
    } catch {}
  } else {
    stateBroadcastLastLightAt37AY = now;
  }
  if (options.reason) message.reason = options.reason;
  window.parent.postMessage(message, "*");
  try {
    window.__budilightStateBroadcastGovernor37AY = {
      version: "STEP37AY_STATE_PERSISTENCE_GOVERNOR",
      governed,
      skipped: stateBroadcastSkipped37AY,
      mode: wantsFullState ? "full" : "light",
      lastFullAt: stateBroadcastLastFullAt37AY,
      lastLightAt: stateBroadcastLastLightAt37AY
    };
  } catch {}
}

function restoreRuntimePersistence() {
  restoreSettings();
  restoreTransitionSettings();
  restoreMapping();
  restoreSerialSettings();
}

function notifyShellRuntimeLoading(percent, label) {
  appCoreDelegates.notifyShellRuntimeLoading(percent, label);
}

function notifyShellRuntimeReady() {
  appCoreDelegates.notifyShellRuntimeReady();
}

function applyFxState(target, source) {
  appCoreDelegates.applyFxState(target, source);
}

function adjustBpm(delta) {
  appCoreDelegates.adjustBpm(delta);
}

function tapBpm() {
  appCoreDelegates.tapBpm();
}

function resetBeat() {
  appCoreDelegates.resetBeat();
}

function syncBeatToNearestDownbeat(groupBeats = 4) {
  return appCoreDelegates.syncBeatToNearestDownbeat(groupBeats);
}

function seekBeatPosition(targetBeat = 0) {
  return appCoreDelegates.seekBeatPosition(targetBeat);
}

function ensureBeatClock() {
  appCoreDelegates.ensureBeatClock();
}

function applyLayerState(target, source) {
  appCoreDelegates.applyLayerState(target, source);
}

function applyManualPaletteState(target, source) {
  appCoreDelegates.applyManualPaletteState(target, source);
}

function stepBlend(direction) {
  appCoreDelegates.stepBlend(direction);
}

function startLayerTransition(layer, previousModules, previousState) {
  appCoreDelegates.startLayerTransition(layer, previousModules, previousState);
}

function startBlendTransition(previousMode) {
  appCoreDelegates.startBlendTransition(previousMode);
}

function captureLayerModules(layer) {
  return appCoreDelegates.captureLayerModules(layer);
}

function renderBlendOptions() {
  appDelegates.renderBlendOptions();
}

function getBeatPosition() {
  return appCoreDelegates.getBeatPosition();
}

function contrast01(value) {
  return visualValueHelpers.contrast01(value);
}

function gpuModeValue(value, fallback = "auto") {
  return visualValueHelpers.gpuModeValue(value, fallback);
}

function applyCrossfaderPlacement() {
  appDelegates.applyCrossfaderPlacement();
}

function initPerfPadsToggle() {
  collapseFacade.initPerfPadsToggle();
}

function initMixCoreCollapse() {
  appDelegates.initMixCoreCollapse();
}

function applyTopbarMixLayout() {
  appDelegates.applyTopbarMixLayout();
}
