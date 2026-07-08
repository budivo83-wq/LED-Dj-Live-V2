import { applyFullscreenPreference, syncFullscreenButtonLabel, toggleFullscreen } from './fullscreen.js';
import { renderGeneratorFrame, paintGeneratorFrameToCanvas, normalizeGeneratorPatch, GENERATOR_DEFAULT_PATCH } from './runtime/generator_engine.js';
import {
  createDefaultGeneratorGraph,
  graphToModuleFlags,
  GENERATOR_MODULES,
  normalizeGeneratorGraph,
  updateGeneratorGraphNode,
  reorderGeneratorGraphNode,
  addGeneratorGraphNode,
  duplicateGeneratorGraphNode,
  deleteGeneratorGraphNode,
  soloGeneratorGraphNode,
  clearGeneratorGraphSolo,
  listGeneratorNodeCatalog,
  buildGeneratorGraphUiReport,
  summarizeGeneratorGraph,
  GENERATOR_GRAPH_VERSION
} from './runtime/generator_graph.js';
import {
  createDefaultGeneratorCurves,
  evaluateGeneratorCurves,
  normalizeGeneratorCurves,
  createGeneratorCurveRuntime,
  smoothGeneratorCurveValues,
  GENERATOR_MACRO_DEFAULTS,
  patchValuesToMacros
} from './runtime/generator_curves.js';
import {
  loadGeneratorPresetBank,
  saveGeneratorPresetSnapshot,
  findGeneratorPreset,
  deleteGeneratorPreset,
  rememberActiveGeneratorPreset,
  loadActiveGeneratorPreset,
  GENERATOR_PRESETS_VERSION
} from './runtime/generator_presets.js';
import { loadGeneratorState, saveGeneratorState, publishGeneratorPreviewHeartbeat, createGeneratorLiveBridge, GENERATOR_BRIDGE_VERSION } from './runtime/generator_bridge.js';
import {
  readShowOsBridgePayload,
  mapShowOsBridgeToGeneratorState,
  isGeneratorShowOsAutoFollowEnabled,
  setGeneratorShowOsAutoFollowEnabled,
  writeGeneratorShowOsSnapshot,
  GENERATOR_SHOWOS_BRIDGE_VERSION
} from './runtime/generator_showos_bridge.js';
import {
  collectGeneratorLiveDiagnostics,
  buildGeneratorLivePanelView,
  runGeneratorMasterSelfTest,
  GENERATOR_LIVE_TEST_PANEL_VERSION
} from './runtime/generator_live_test_panel.js';
import {
  applyGeneratorSafeScene,
  listGeneratorSafeScenes,
  createBlackoutGeneratorFrame,
  createGeneratorLiveMetricsRuntime,
  updateGeneratorLiveMetrics,
  summarizeGeneratorLiveMetrics,
  getStoredGeneratorLiveFps,
  storeGeneratorLiveFps,
  GENERATOR_LIVE_OPS_VERSION
} from './runtime/generator_live_ops.js';
import {
  readGeneratorSettingsOutputFps,
  persistGeneratorLiveFpsFromSettings,
  fetchServerArtnetOutputFps,
  GENERATOR_SETTINGS_FPS_VERSION
} from './runtime/generator_settings_fps.js';
import {
  createGeneratorLiveStabilityRuntime,
  buildGeneratorLiveStabilityView,
  formatGeneratorLiveStabilityReport,
  readGeneratorPerformanceMirrorState,
  GENERATOR_LIVE_STABILITY_VERSION
} from './runtime/generator_live_stability.js';
import {
  buildGeneratorOutputTruthView,
  formatGeneratorOutputTruthText,
  GENERATOR_OUTPUT_TRUTH_PANEL_VERSION
} from './runtime/generator_output_truth_panel.js';
import {
  listGeneratorFieldTests,
  listGeneratorFieldTestColors,
  createGeneratorFieldTestFrame,
  summarizeGeneratorFieldTest,
  buildGeneratorFieldTestReport,
  GENERATOR_FIELD_TEST_VERSION
} from './runtime/generator_field_tests.js';
import {
  readGeneratorTransitionConfig,
  saveGeneratorTransitionConfig,
  createGeneratorTransitionRuntime,
  armGeneratorTakeoverTransition,
  armGeneratorReleaseTransition,
  applyGeneratorTransitionFrame,
  formatGeneratorTransitionStatus,
  buildGeneratorTransitionReport,
  GENERATOR_TRANSITION_VERSION
} from './runtime/generator_transition.js';
import {
  listGeneratorMusicModes,
  loadGeneratorMusicMode,
  saveGeneratorMusicMode,
  isGeneratorMusicModeRuntimeEnabled,
  setGeneratorMusicModeRuntimeEnabled,
  applyGeneratorMusicMode,
  applyGeneratorMusicModeRuntimeValues,
  buildGeneratorMusicModeSummary,
  formatGeneratorMusicModeStatus,
  buildGeneratorMusicModeReport,
  GENERATOR_MUSIC_MODES_VERSION
} from './runtime/generator_music_modes.js';
import {
  createGeneratorSceneMorphRuntime,
  readGeneratorSceneMorphConfig,
  saveGeneratorSceneMorphConfig,
  listGeneratorSceneMorphTargets,
  armGeneratorSceneMorph,
  applyGeneratorSceneMorph,
  cancelGeneratorSceneMorph,
  buildGeneratorSceneMorphStatus,
  buildGeneratorSceneMorphReport,
  writeGeneratorSceneMorphSnapshot,
  GENERATOR_SCENE_MORPH_VERSION
} from './runtime/generator_scene_morph.js';
import {
  listGeneratorJourneyPresets,
  getGeneratorJourneyPreset,
  readGeneratorJourneyConfig,
  saveGeneratorJourneyConfig,
  createGeneratorJourneyRuntime,
  armGeneratorJourney,
  tickGeneratorJourney,
  stopGeneratorJourney,
  buildGeneratorJourneyMorphConfig,
  buildGeneratorJourneyStatus,
  buildGeneratorJourneyReport,
  validateGeneratorJourneyTargets,
  writeGeneratorJourneySnapshot,
  GENERATOR_JOURNEY_TIMELINE_VERSION
} from './runtime/generator_journey_timeline.js';
import {
  readGeneratorMidiConfig,
  saveGeneratorMidiConfig,
  resetGeneratorMidiMappings,
  createGeneratorMidiRuntime,
  normalizeMidiMessage,
  findGeneratorMidiAction,
  learnGeneratorMidiMapping,
  listGeneratorMidiActions,
  buildGeneratorMidiSnapshot,
  formatGeneratorMidiMessage,
  formatGeneratorMidiReport,
  GENERATOR_MIDI_APC_VERSION
} from './runtime/generator_midi_apc.js';

import {
  readGeneratorBeatConfig,
  normalizeGeneratorBeatConfig,
  saveGeneratorBeatConfig,
  createGeneratorBeatRuntime,
  tapGeneratorBeat,
  markGeneratorBeatDrop,
  resetGeneratorBeatPhrase,
  applyGeneratorBeatIntelligence,
  writeGeneratorBeatSnapshot,
  formatGeneratorBeatStatus,
  buildGeneratorBeatReport,
  GENERATOR_BEAT_INTELLIGENCE_VERSION
} from './runtime/generator_beat_intelligence.js';

const STEP_VERSION = 'STEP38V_GENERATOR_BEAT_INTELLIGENCE';
const $ = (id) => document.getElementById(id);
const canvas = $('generatorCanvas');
const modeBadge = $('generatorModeBadge');
const fpsBadge = $('generatorFpsBadge');
const writer = $('generatorWriter');
const patchName = $('generatorPatchName');
const beatNode = $('generatorBeat');
const logNode = $('generatorLog');
const controlsNode = $('generatorControls');
const moduleListNode = $('generatorModuleList');
const nodeFlowNode = $('generatorNodeFlow');
const nodeAddSelectNode = $('generatorNodeAddSelect');
const nodeAddNode = $('generatorNodeAdd');
const nodeClearSoloNode = $('generatorNodeClearSolo');
const nodeCopyReportNode = $('generatorNodeCopyReport');
const bridgeStatusNode = $('generatorBridgeStatus');
const serverStatusNode = $('generatorServerStatus');
const frameBusStatusNode = $('generatorFrameBusStatus');
const sentStatusNode = $('generatorSentStatus');
const macroGridNode = $('generatorMacroGrid');
const presetSelectNode = $('generatorPresetSelect');
const presetNameNode = $('generatorPresetName');
const showOsStatusNode = $('generatorShowOsStatus');
const showOsSummaryNode = $('generatorShowOsSummary');
const showOsAutoNode = $('generatorShowOsAuto');
const liveTestChainNode = $('generatorLiveChain');
const liveTestStageNode = $('generatorLiveTestStage');
const liveTestVerdictNode = $('generatorLiveVerdict');
const liveTestNextNode = $('generatorLiveNext');
const liveTestLogNode = $('generatorLiveTestLog');
const operatorBadgeNode = $('generatorOperatorBadge');
const safeSceneSelectNode = $('generatorSafeSceneSelect');
const liveFpsSelectNode = $('generatorLiveFpsSelect');
const liveFpsSourceNode = $('generatorLiveFpsSource');
const transitionTakeoverNode = $('generatorTransitionTakeover');
const transitionReleaseNode = $('generatorTransitionRelease');
const transitionCurveNode = $('generatorTransitionCurve');
const transitionStatusNode = $('generatorTransitionStatus');
const transitionReportNode = $('generatorTransitionReport');
const musicModeSelectNode = $('generatorMusicModeSelect');
const musicModeBadgeNode = $('generatorMusicModeBadge');
const musicModeStatusNode = $('generatorMusicModeStatus');
const musicModeIntentNode = $('generatorMusicModeIntent');
const musicModeRuntimeNode = $('generatorMusicModeRuntime');
const musicModeReportNode = $('generatorMusicModeReport');
const sceneMorphTargetNode = $('generatorSceneMorphTarget');
const sceneMorphDurationNode = $('generatorSceneMorphDuration');
const sceneMorphTimeModeNode = $('generatorSceneMorphTimeMode');
const sceneMorphCurveNode = $('generatorSceneMorphCurve');
const sceneMorphCommitNode = $('generatorSceneMorphCommit');
const sceneMorphStatusNode = $('generatorSceneMorphStatus');
const sceneMorphBarNode = $('generatorSceneMorphBar');
const sceneMorphBadgeNode = $('generatorSceneMorphBadge');
const sceneMorphReportNode = $('generatorSceneMorphReport');
const journeySelectNode = $('generatorJourneySelect');
const journeyLoopNode = $('generatorJourneyLoop');
const journeyAutoPreviewNode = $('generatorJourneyAutoPreview');
const journeyCommitNode = $('generatorJourneyCommit');
const journeyBadgeNode = $('generatorJourneyBadge');
const journeyStatusNode = $('generatorJourneyStatus');
const journeyNextNode = $('generatorJourneyNext');
const journeyBarNode = $('generatorJourneyBar');
const journeyStepsNode = $('generatorJourneySteps');
const journeyReportNode = $('generatorJourneyReport');
const midiBadgeNode = $('generatorMidiBadge');
const midiStatusNode = $('generatorMidiStatus');
const midiInputSelectNode = $('generatorMidiInputSelect');
const midiEnableNode = $('generatorMidiEnable');
const midiConnectNode = $('generatorMidiConnect');
const midiRefreshNode = $('generatorMidiRefresh');
const midiResetNode = $('generatorMidiReset');
const midiLearnActionNode = $('generatorMidiLearnAction');
const midiLearnNode = $('generatorMidiLearn');
const midiLastNode = $('generatorMidiLast');
const midiActionNode = $('generatorMidiAction');
const midiMappingListNode = $('generatorMidiMappingList');
const midiReportNode = $('generatorMidiReport');
const beatIntelBadgeNode = $('generatorBeatIntelBadge');
const beatIntelStatusNode = $('generatorBeatIntelStatus');
const beatIntelPhraseNode = $('generatorBeatIntelPhrase');
const beatIntelAccentNode = $('generatorBeatIntelAccent');
const beatIntelBpmNode = $('generatorBeatIntelBpm');
const beatIntelEnabledNode = $('generatorBeatIntelEnabled');
const beatIntelPhraseBeatsNode = $('generatorBeatIntelPhraseBeats');
const beatIntelAccentAmountNode = $('generatorBeatIntelAccentAmount');
const beatIntelDropHoldNode = $('generatorBeatIntelDropHold');
const beatIntelReportNode = $('generatorBeatIntelReport');
const stabilityBadgeNode = $('generatorStabilityBadge');
const stabilityCardsNode = $('generatorStabilityCards');
const stabilityVerdictNode = $('generatorStabilityVerdict');
const stabilityNextNode = $('generatorStabilityNext');
const stabilityHintsNode = $('generatorStabilityHints');
const metricRenderNode = $('generatorMetricRender');
const metricPublishNode = $('generatorMetricPublish');
const metricServerNode = $('generatorMetricServer');
const metricDropsNode = $('generatorMetricDrops');
const outputTruthBadgeNode = $('generatorOutputTruthBadge');
const outputTruthCardsNode = $('generatorOutputTruthCards');
const outputTruthRoutesNode = $('generatorOutputTruthRoutes');
const outputTruthHintsNode = $('generatorOutputTruthHints');
const fieldTestBadgeNode = $('generatorFieldTestBadge');
const fieldTestTypeNode = $('generatorFieldTestType');
const fieldTestStripNode = $('generatorFieldTestStrip');
const fieldTestUniverseNode = $('generatorFieldTestUniverse');
const fieldTestColorNode = $('generatorFieldTestColor');
const fieldTestIntensityNode = $('generatorFieldTestIntensity');
const fieldTestIntensityValueNode = $('generatorFieldTestIntensityValue');
const fieldTestHoldNode = $('generatorFieldTestHold');
const fieldTestSummaryNode = $('generatorFieldTestSummary');
const fieldTestHintNode = $('generatorFieldTestHint');
const menuBtn = $('menuBtn');
const centerMenu = $('centerMenuStrip');
const menuFullscreen = $('menuFullscreenBtn');

const stored = loadGeneratorState();
let graph = normalizeGeneratorGraph(stored.graph || createDefaultGeneratorGraph());
let curves = normalizeGeneratorCurves(stored.curves || createDefaultGeneratorCurves());
let patch = normalizeGeneratorPatch({
  ...GENERATOR_DEFAULT_PATCH,
  ...(stored.patch || {}),
  modules: graphToModuleFlags(graph)
});
patch = normalizeGeneratorPatch({ ...patch, macros: patchValuesToMacros(patch) });
let mode = ['off', 'preview', 'live'].includes(stored.mode) ? stored.mode : 'off';
let raf = 0;
let frames = 0;
let lastFpsAt = performance.now();
let lastFps = 0;
let lastHeartbeatAt = 0;
let lastLivePublishAt = 0;
let latestBridgeSnapshot = null;
let liveStabilityRuntime = createGeneratorLiveStabilityRuntime();
let lastStabilityView = null;
let lastStabilityRenderAt = 0;
let curveRuntime = createGeneratorCurveRuntime();
let presetBank = loadGeneratorPresetBank();
let activePresetId = loadActiveGeneratorPreset();
let showOsAutoFollow = isGeneratorShowOsAutoFollowEnabled();
let lastShowOsSignature = '';
let lastShowOsPollAt = 0;
let lastShowOsAppliedAt = 0;
let lastLiveTestPollAt = 0;
let liveTestBusy = false;
let lastLiveTestSnapshot = null;
let liveFpsInfo = readGeneratorSettingsOutputFps(localStorage, getStoredGeneratorLiveFps(localStorage, 60));
let liveFps = persistGeneratorLiveFpsFromSettings(liveFpsInfo, localStorage).fps;
let lastSettingsFpsPollAt = 0;
let liveMetrics = createGeneratorLiveMetricsRuntime();
let transitionConfig = readGeneratorTransitionConfig(localStorage);
let transitionRuntime = createGeneratorTransitionRuntime({ width: patch.width, height: patch.height, curve: transitionConfig.curve });
let pendingReleaseMode = '';
let transitionBusy = false;
let activeMusicModeId = loadGeneratorMusicMode(localStorage);
let musicModeRuntimeEnabled = isGeneratorMusicModeRuntimeEnabled(localStorage);
let lastMusicModeMeta = { id: activeMusicModeId, enabled: musicModeRuntimeEnabled, phrasePct: 0, accent: 0 };
let lastMusicModeSummary = buildGeneratorMusicModeSummary(activeMusicModeId, patch, graph, curves);
let sceneMorphConfig = readGeneratorSceneMorphConfig(localStorage);
let sceneMorphRuntime = createGeneratorSceneMorphRuntime();
let lastSceneMorphSnapshotAt = 0;
let journeyConfig = readGeneratorJourneyConfig(localStorage);
let journeyRuntime = createGeneratorJourneyRuntime();
let lastJourneySnapshotAt = 0;
let midiConfig = readGeneratorMidiConfig(localStorage);
let midiRuntime = createGeneratorMidiRuntime();
let beatIntelConfig = readGeneratorBeatConfig(localStorage);
let beatIntelRuntime = createGeneratorBeatRuntime();
let lastBeatIntelMeta = null;
let lastBeatIntelSnapshotAt = 0;
let midiAccess = null;
let midiInput = null;
let midiSnapshot = null;
let activeFieldTest = null;
let lastFieldTestReport = '';
const liveBridge = createGeneratorLiveBridge({ width: patch.width, height: patch.height, fps: liveFps, directServerMirror: true, localFrameBus: true });

function clamp01(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(1, n));
}

function log(message) {
  const line = `[${new Date().toLocaleTimeString()}] ${message}`;
  if (logNode) logNode.textContent = `${line}\n${String(logNode.textContent || '').split('\n').slice(0, 11).join('\n')}`;
}

function saveAll() {
  graph = normalizeGeneratorGraph(graph);
  saveGeneratorState({ mode, patch, graph, curves });
}

function updatePatchMacrosFromValues() {
  graph = normalizeGeneratorGraph(graph);
  patch = normalizeGeneratorPatch({ ...patch, macros: patchValuesToMacros(patch), modules: graphToModuleFlags(graph), graph });
}

function resetCurveRuntime() {
  curveRuntime = createGeneratorCurveRuntime();
}

function showOsPayloadSignature(payload) {
  if (!payload) return '';
  return [payload.t, payload.targetWorld, payload.targetUniverse, payload.targetWeather, payload.storyPhase, payload.energy, payload.chaos, payload.density, payload.motion, payload.authority?.operatorLock ? 'lock' : 'open'].join('|');
}

function updateShowOsStatus(text, detail = '') {
  if (showOsStatusNode) showOsStatusNode.textContent = text || 'idle';
  if (showOsSummaryNode) showOsSummaryNode.textContent = detail || '';
  if (showOsAutoNode) {
    showOsAutoNode.classList.toggle('active', showOsAutoFollow);
    showOsAutoNode.textContent = showOsAutoFollow ? 'AUTO FOLLOW ON' : 'AUTO FOLLOW OFF';
  }
}

function applyShowOsBridge(reason = 'manual', options = {}) {
  const payload = readShowOsBridgePayload();
  if (!payload) {
    updateShowOsStatus('NO PAYLOAD', 'V Show OS nejdĹ™Ă­v poĹˇli Bridge payload.');
    log('Show OS bridge: ĹľĂˇdnĂ˝ payload nenalezenĂ˝.');
    return false;
  }
  const mapped = mapShowOsBridgeToGeneratorState(payload, { patch, graph, curves }, { influence: options.influence });
  graph = normalizeGeneratorGraph(mapped.graph);
  curves = normalizeGeneratorCurves(mapped.curves);
  patch = normalizeGeneratorPatch({ ...mapped.patch, modules: graphToModuleFlags(graph), graph });
  if (reason === 'manual') resetCurveRuntime();
  lastShowOsSignature = showOsPayloadSignature(mapped.payload);
  lastShowOsAppliedAt = Date.now();
  writeGeneratorShowOsSnapshot({ ok: true, source: reason, summary: mapped.summary, payload: mapped.payload });
  saveAll();
  renderModules();
  renderNodeFlow();
  renderMacros();
  renderControls();
  renderStaticUi();
  updateShowOsStatus(reason === 'auto' ? 'AUTO APPLIED' : 'APPLIED', `${mapped.summary.targetUniverse} â†’ ${mapped.summary.targetWorld} Â· ${mapped.summary.targetWeather} Â· ${mapped.summary.storyPhase} Â· ${mapped.summary.worldFamily}`);
  log(`Show OS â†’ Generator ${reason}: ${mapped.summary.targetWorld} / ${mapped.summary.storyPhase}`);
  return true;
}

function setShowOsAutoFollow(enabled) {
  showOsAutoFollow = setGeneratorShowOsAutoFollowEnabled(Boolean(enabled));
  updateShowOsStatus(showOsAutoFollow ? 'AUTO ARMED' : 'AUTO OFF', showOsAutoFollow ? 'Generator bude sledovat novĂ˝ Show OS bridge payload.' : 'RuÄŤnĂ­ makra zĹŻstĂˇvajĂ­ pod kontrolou operĂˇtora.');
  if (showOsAutoFollow) applyShowOsBridge('auto-arm', { influence: 0.62 });
}

function pollShowOsBridge(now = performance.now()) {
  if (now - lastShowOsPollAt < 650) return;
  lastShowOsPollAt = now;
  const payload = readShowOsBridgePayload();
  if (!payload) {
    updateShowOsStatus(showOsAutoFollow ? 'WAITING' : 'NO PAYLOAD', 'Ĺ˝ĂˇdnĂ˝ Show OS bridge payload zatĂ­m nenĂ­ uloĹľenĂ˝.');
    return;
  }
  const sig = showOsPayloadSignature(payload);
  if (!showOsAutoFollow) {
    updateShowOsStatus('READY', `${payload.targetUniverse} â†’ ${payload.targetWorld} Â· ${payload.targetWeather} Â· ${payload.storyPhase}`);
    return;
  }
  if (sig && sig !== lastShowOsSignature && Date.now() - lastShowOsAppliedAt > 400) applyShowOsBridge('auto', { influence: payload.authority?.operatorLock ? 0.28 : 0.42 });
}

function updateTransitionStatus(reason = 'render') {
  setValueIfIdle(transitionTakeoverNode, String(transitionConfig.takeoverMs ?? 900));
  setValueIfIdle(transitionReleaseNode, String(transitionConfig.releaseMs ?? 700));
  setValueIfIdle(transitionCurveNode, transitionConfig.curve || 'smooth');
  const status = formatGeneratorTransitionStatus(transitionRuntime, transitionConfig);
  if (transitionStatusNode) transitionStatusNode.textContent = status;
  if (transitionReportNode && reason === 'report') transitionReportNode.textContent = buildGeneratorTransitionReport(transitionRuntime, transitionConfig);
}

function updateTransitionConfig(patchConfig = {}) {
  transitionConfig = saveGeneratorTransitionConfig({ ...transitionConfig, ...patchConfig }, localStorage);
  transitionRuntime = { ...transitionRuntime, curve: transitionConfig.curve };
  updateTransitionStatus('config');
  log(`Transition nastavenĂ˝: takeover ${transitionConfig.takeoverMs}ms, release ${transitionConfig.releaseMs}ms, curve ${transitionConfig.curve}.`);
}

function renderMusicModePanel(reason = 'render') {
  if (musicModeSelectNode && !musicModeSelectNode.options.length) {
    musicModeSelectNode.innerHTML = listGeneratorMusicModes().map((item) => `<option value="${item.id}">${item.name}</option>`).join('');
  }
  setValueIfIdle(musicModeSelectNode, activeMusicModeId);
  lastMusicModeSummary = buildGeneratorMusicModeSummary(activeMusicModeId, patch, graph, curves);
  if (musicModeBadgeNode) {
    musicModeBadgeNode.textContent = activeMusicModeId === 'manual' ? 'MANUAL' : (musicModeRuntimeEnabled ? 'MUSIC ON' : 'MUSIC PATCH');
    musicModeBadgeNode.className = activeMusicModeId === 'manual' ? 'ok' : (musicModeRuntimeEnabled ? 'hot' : 'watch');
  }
  if (musicModeStatusNode) musicModeStatusNode.textContent = formatGeneratorMusicModeStatus(activeMusicModeId, lastMusicModeMeta, musicModeRuntimeEnabled);
  if (musicModeIntentNode) musicModeIntentNode.textContent = lastMusicModeSummary.intent || 'RuÄŤnĂ­ patch bez hudebnĂ­ho runtime.';
  if (musicModeRuntimeNode) {
    musicModeRuntimeNode.classList.toggle('active', musicModeRuntimeEnabled);
    musicModeRuntimeNode.textContent = musicModeRuntimeEnabled ? 'RUNTIME ON' : 'RUNTIME OFF';
  }
  if (reason === 'apply') renderStaticUi();
}

function applySelectedMusicMode(modeId = musicModeSelectNode?.value || activeMusicModeId || 'manual', options = {}) {
  const result = applyGeneratorMusicMode(modeId, { patch, graph, curves }, { forceManualTemplate: options.forceManualTemplate === true });
  activeMusicModeId = saveGeneratorMusicMode(result.modeId, localStorage);
  patch = normalizeGeneratorPatch({ ...result.patch, modules: graphToModuleFlags(result.graph), graph: result.graph });
  graph = normalizeGeneratorGraph(result.graph);
  curves = normalizeGeneratorCurves(result.curves);
  lastMusicModeSummary = result.summary;
  lastMusicModeMeta = { id: activeMusicModeId, name: result.mode.name, enabled: musicModeRuntimeEnabled, phrasePct: 0, accent: 0 };
  if (mode !== 'live') resetCurveRuntime();
  saveAll();
  renderModules();
  renderNodeFlow();
  renderMacros();
  renderControls();
  renderMusicModePanel('apply');
  log(`Music mode applied: ${result.mode.name}. ${result.mode.intent}`);
  return result;
}

function setMusicModeRuntime(enabled) {
  musicModeRuntimeEnabled = setGeneratorMusicModeRuntimeEnabled(Boolean(enabled), localStorage);
  lastMusicModeMeta = { ...lastMusicModeMeta, enabled: musicModeRuntimeEnabled };
  renderMusicModePanel('runtime');
  log(`Music mode runtime ${musicModeRuntimeEnabled ? 'ON' : 'OFF'}. Patch zĹŻstĂˇvĂˇ, beat/frĂˇzovĂ© moduly ${musicModeRuntimeEnabled ? 'bÄ›ĹľĂ­' : 'jsou vypnutĂ©'}.`);
}

async function copyMusicModeReport() {
  const text = buildGeneratorMusicModeReport(activeMusicModeId, lastMusicModeMeta, lastMusicModeSummary);
  await copyReportText(text, 'Music mode report zkopírovaný do schránky.', 'Music mode report nejde zkopírovat automaticky; vypisuju do logu.');
}
async function copyReportText(text, successMessage, failureMessage, { panelNode = null, panelLines = 4 } = {}) {
  try {
    await navigator.clipboard?.writeText?.(text);
    log(successMessage);
  } catch {
    log(failureMessage);
  }
  if (panelNode) panelNode.textContent = text;
  if (liveTestLogNode) {
    const previous = String(liveTestLogNode.textContent || '').split('\n').slice(0, panelLines).join('\n');
    liveTestLogNode.textContent = `${text}\n\n${previous}`;
  }
}

function setValueIfIdle(node, value) {
  if (node && document.activeElement !== node) node.value = value;
}

function bindAsyncClick(node, action, onError = () => {}) {
  node?.addEventListener('click', () => {
    Promise.resolve().then(action).catch(onError);
  });
}

function runAsyncTask(action, onError = () => {}) {
  return Promise.resolve().then(action).catch(onError);
}

function getGeneratorBeatNow(nowWall = Date.now()) {
  const bpm = Number(patch.bpm || beatIntelRuntime.suggestedBpm || 145) || 145;
  const beat = Number.isFinite(Number(lastBeatIntelMeta?.beat))
    ? Number(lastBeatIntelMeta.beat)
    : (nowWall / 1000) * bpm / 60;
  return { nowWall, bpm, beat };
}

function applyBeatIntelBpmSuggestion(reason = 'tap') {
  const suggestedBpm = Number(beatIntelRuntime.suggestedBpm || 0);
  if (!Number.isFinite(suggestedBpm) || suggestedBpm <= 0) return false;
  const nextPatch = normalizeGeneratorPatch({ ...patch, bpm: suggestedBpm });
  const changed = Number(nextPatch.bpm || 0) !== Number(patch.bpm || 0);
  patch = nextPatch;
  if (changed) {
    saveAll();
    renderStaticUi();
    log(`Beat Intelligence ${reason}: BPM patch nastavenĂ˝ na ${Number(nextPatch.bpm).toFixed(1)}.`);
  }
  return changed;
}

function renderBeatIntelligencePanel(reason = 'render') {
  beatIntelConfig = normalizeGeneratorBeatConfig(beatIntelConfig);
  const meta = lastBeatIntelMeta || beatIntelRuntime.lastMeta || {};
  if (beatIntelEnabledNode) {
    beatIntelEnabledNode.classList.toggle('active', beatIntelConfig.enabled);
    beatIntelEnabledNode.textContent = beatIntelConfig.enabled ? 'BEAT INTEL ON' : 'BEAT INTEL OFF';
  }
  setValueIfIdle(beatIntelPhraseBeatsNode, String(beatIntelConfig.phraseBeats));
  setValueIfIdle(beatIntelAccentAmountNode, String(beatIntelConfig.accentAmount));
  setValueIfIdle(beatIntelDropHoldNode, String(beatIntelConfig.dropHoldBeats));
  if (beatIntelBadgeNode) {
    beatIntelBadgeNode.textContent = beatIntelConfig.enabled ? (meta.dropActive ? 'DROP' : 'BEAT ON') : 'BEAT OFF';
    beatIntelBadgeNode.className = beatIntelConfig.enabled ? (meta.dropActive ? 'hot' : 'ok') : 'watch';
  }
  if (beatIntelStatusNode) beatIntelStatusNode.textContent = formatGeneratorBeatStatus(meta, beatIntelConfig);
  if (beatIntelBpmNode) {
    const bpm = Number(patch.bpm || meta.bpm || beatIntelRuntime.suggestedBpm || 145) || 145;
    beatIntelBpmNode.textContent = `${bpm.toFixed(1)}${Number(beatIntelRuntime.suggestedBpm || 0) ? ` Â· tap ${Number(beatIntelRuntime.suggestedBpm).toFixed(1)}` : ''}`;
  }
  if (beatIntelPhraseNode) {
    beatIntelPhraseNode.textContent = Number.isFinite(Number(meta.phraseProgress)) ? `${Math.round(Number(meta.phraseProgress) * 100)}%` : '--';
  }
  if (beatIntelAccentNode) {
    beatIntelAccentNode.textContent = Number.isFinite(Number(meta.accent)) ? `${Math.round(Number(meta.accent) * 100)}%` : '--';
  }
  if (beatIntelReportNode && (reason !== 'quiet' || !beatIntelReportNode.textContent)) {
    beatIntelReportNode.textContent = buildGeneratorBeatReport(beatIntelRuntime, beatIntelConfig, meta);
  }
}

function updateBeatIntelligenceConfig(patchConfig = {}) {
  beatIntelConfig = saveGeneratorBeatConfig({ ...beatIntelConfig, ...patchConfig }, localStorage);
  renderBeatIntelligencePanel('config');
  log(`Beat Intelligence config: phrase ${beatIntelConfig.phraseBeats}b, accent ${(beatIntelConfig.accentAmount * 100).toFixed(0)}%, drop hold ${beatIntelConfig.dropHoldBeats}b.`);
}

function toggleBeatIntelligence() {
  updateBeatIntelligenceConfig({ enabled: !beatIntelConfig.enabled });
}

function tapBeatIntelligence() {
  const clock = getGeneratorBeatNow();
  beatIntelRuntime = tapGeneratorBeat(beatIntelRuntime, {
    nowWall: clock.nowWall,
    beat: clock.beat,
    bpm: clock.bpm
  });
  const changed = applyBeatIntelBpmSuggestion('tap');
  lastBeatIntelMeta = beatIntelRuntime.lastMeta || lastBeatIntelMeta;
  renderBeatIntelligencePanel('tap');
  if (!changed) saveAll();
}

function resetBeatPhrase() {
  const clock = getGeneratorBeatNow();
  beatIntelRuntime = resetGeneratorBeatPhrase(beatIntelRuntime, {
    nowWall: clock.nowWall,
    beat: clock.beat
  });
  lastBeatIntelMeta = beatIntelRuntime.lastMeta || lastBeatIntelMeta;
  renderBeatIntelligencePanel('phrase-reset');
  log('Beat phrase reset na aktuĂˇlnĂ­ beat.');
}

function markBeatDrop() {
  const clock = getGeneratorBeatNow();
  beatIntelRuntime = markGeneratorBeatDrop(beatIntelRuntime, beatIntelConfig, {
    nowWall: clock.nowWall,
    beat: clock.beat
  });
  lastBeatIntelMeta = beatIntelRuntime.lastMeta || lastBeatIntelMeta;
  renderBeatIntelligencePanel('drop-mark');
  log(`Beat drop mark aktivnĂ­ na ${beatIntelConfig.dropHoldBeats} beatĹŻ.`);
}

async function copyBeatIntelligenceReport() {
  const text = buildGeneratorBeatReport(beatIntelRuntime, beatIntelConfig, lastBeatIntelMeta || beatIntelRuntime.lastMeta || {});
  await copyReportText(text, 'Beat intelligence report zkopírovaný do schránky.', 'Beat intelligence report nejde zkopírovat automaticky; vypisuju ho do logu.', { panelNode: beatIntelReportNode });
}
function renderSceneMorphPanel(reason = 'render') {
  if (sceneMorphTargetNode) {
    const currentValue = sceneMorphTargetNode.value || sceneMorphConfig.targetId || 'music:build';
    const targets = listGeneratorSceneMorphTargets(presetBank, true);
    sceneMorphTargetNode.innerHTML = targets.map((target) => `<option value="${target.id}">${target.type === 'music' ? 'Mode' : 'Preset'} Â· ${target.name}</option>`).join('');
    if (targets.some((target) => target.id === currentValue)) sceneMorphTargetNode.value = currentValue;
    else sceneMorphTargetNode.value = targets[0]?.id || 'music:build';
  }
  setValueIfIdle(sceneMorphTimeModeNode, sceneMorphConfig.timeMode || 'beats');
  setValueIfIdle(sceneMorphCurveNode, sceneMorphConfig.curve || 'smooth');
  if (sceneMorphDurationNode && document.activeElement !== sceneMorphDurationNode) {
    sceneMorphDurationNode.value = String(sceneMorphConfig.timeMode === 'seconds' ? sceneMorphConfig.durationSeconds : sceneMorphConfig.durationBeats);
    sceneMorphDurationNode.min = sceneMorphConfig.timeMode === 'seconds' ? '0.1' : '1';
    sceneMorphDurationNode.max = sceneMorphConfig.timeMode === 'seconds' ? '30' : '256';
    sceneMorphDurationNode.step = sceneMorphConfig.timeMode === 'seconds' ? '0.1' : '1';
  }
  if (sceneMorphCommitNode) sceneMorphCommitNode.checked = sceneMorphConfig.commitOnDone !== false;
  const status = buildGeneratorSceneMorphStatus(sceneMorphRuntime, sceneMorphConfig);
  if (sceneMorphStatusNode) sceneMorphStatusNode.textContent = status;
  if (sceneMorphBadgeNode) {
    sceneMorphBadgeNode.textContent = sceneMorphRuntime.active ? 'MORPHING' : (sceneMorphRuntime.done ? 'DONE' : 'READY');
    sceneMorphBadgeNode.className = sceneMorphRuntime.active ? 'hot' : (sceneMorphRuntime.error ? 'warn' : 'ok');
  }
  if (sceneMorphBarNode) sceneMorphBarNode.style.width = `${Math.round(Number(sceneMorphRuntime.progress || 0) * 100)}%`;
  if (reason === 'snapshot') writeGeneratorSceneMorphSnapshot(sceneMorphRuntime, localStorage);
}

function updateSceneMorphConfig(patchConfig = {}) {
  const durationValue = Number(sceneMorphDurationNode?.value || 0);
  const timeMode = sceneMorphTimeModeNode?.value || sceneMorphConfig.timeMode || 'beats';
  sceneMorphConfig = saveGeneratorSceneMorphConfig({
    ...sceneMorphConfig,
    ...patchConfig,
    targetId: sceneMorphTargetNode?.value || sceneMorphConfig.targetId,
    timeMode,
    durationBeats: timeMode === 'beats' ? durationValue : sceneMorphConfig.durationBeats,
    durationSeconds: timeMode === 'seconds' ? durationValue : sceneMorphConfig.durationSeconds,
    curve: sceneMorphCurveNode?.value || sceneMorphConfig.curve,
    commitOnDone: sceneMorphCommitNode ? sceneMorphCommitNode.checked : sceneMorphConfig.commitOnDone
  }, localStorage);
  renderSceneMorphPanel('config');
}

function armSelectedSceneMorph() {
  updateSceneMorphConfig();
  const baseBpm = Number(patch.bpm || 145) || 145;
  const now = performance.now();
  const time = now / 1000;
  const beat = time * baseBpm / 60;
  const result = armGeneratorSceneMorph(sceneMorphRuntime, {
    current: { patch, graph, curves },
    presetBank,
    now: time,
    beat,
    storage: localStorage
  }, sceneMorphConfig);
  sceneMorphRuntime = result.runtime;
  if (result.ok) {
    if (mode === 'off') setMode('preview');
    resetCurveRuntime();
    log(`Scene morph armed: ${result.target?.name || sceneMorphConfig.targetId} za ${sceneMorphConfig.timeMode === 'seconds' ? `${sceneMorphConfig.durationSeconds}s` : `${sceneMorphConfig.durationBeats} beatĹŻ`}.`);
  } else {
    log(`Scene morph nelze spustit: ${result.reason || sceneMorphRuntime.error || 'unknown'}.`);
  }
  renderSceneMorphPanel('arm');
}

function cancelSceneMorph(reason = 'operator') {
  sceneMorphRuntime = cancelGeneratorSceneMorph(sceneMorphRuntime, localStorage);
  renderSceneMorphPanel('cancel');
  log(`Scene morph zruĹˇenĂ˝: ${reason}.`);
}

function commitSceneMorphState(state, target = null) {
  if (!state?.patch || !state?.graph || !state?.curves) return;
  patch = normalizeGeneratorPatch({ ...state.patch, modules: graphToModuleFlags(state.graph), graph: state.graph, macros: patchValuesToMacros(state.patch) });
  graph = normalizeGeneratorGraph(state.graph);
  curves = normalizeGeneratorCurves(state.curves);
  const targetMode = patch.musicMode || (target?.type === 'music' ? String(target.id || '').replace(/^music:/, '') : activeMusicModeId);
  if (targetMode) activeMusicModeId = saveGeneratorMusicMode(targetMode, localStorage);
  resetCurveRuntime();
  saveAll();
  renderModules();
  renderNodeFlow();
  renderMacros();
  renderControls();
  renderStaticUi();
  renderMusicModePanel('scene-morph');
  renderPresetBank();
}

async function copySceneMorphReport() {
  const text = buildGeneratorSceneMorphReport(sceneMorphRuntime, sceneMorphConfig);
  await copyReportText(text, 'Scene Morph report zkopírovaný do schránky.', 'Scene Morph report nejde zkopírovat automaticky; vypisuju do logu.');
}
function renderJourneyPanel(reason = 'render') {
  if (journeySelectNode && !journeySelectNode.options.length) {
    journeySelectNode.innerHTML = listGeneratorJourneyPresets().map((journey) => `<option value="${journey.id}">${journey.name}</option>`).join('');
  }
  setValueIfIdle(journeySelectNode, journeyConfig.journeyId);
  if (journeyLoopNode) journeyLoopNode.checked = journeyConfig.loop === true;
  if (journeyAutoPreviewNode) journeyAutoPreviewNode.checked = journeyConfig.autoPreview !== false;
  if (journeyCommitNode) journeyCommitNode.checked = journeyConfig.commitOnStepDone !== false;
  const status = buildGeneratorJourneyStatus(journeyRuntime, journeyConfig);
  const targetChecks = validateGeneratorJourneyTargets(journeyConfig, presetBank);
  const invalid = targetChecks.filter((item) => !item.ok);
  if (journeyStatusNode) journeyStatusNode.textContent = invalid.length ? `${status} Â· ${invalid.length} invalid target` : status;
  if (journeyBadgeNode) {
    journeyBadgeNode.textContent = journeyRuntime.active ? (journeyRuntime.phase === 'hold' ? 'HOLD' : 'RUNNING') : (journeyRuntime.done ? 'DONE' : 'IDLE');
    journeyBadgeNode.className = journeyRuntime.active ? 'hot' : (journeyRuntime.done ? 'ok' : 'watch');
  }
  if (journeyBarNode) journeyBarNode.style.width = `${Math.round(Number(journeyRuntime.progress || 0) * 100)}%`;
  const step = journeyConfig.steps?.[journeyRuntime.currentIndex] || journeyRuntime.currentStep || journeyConfig.steps?.[0];
  if (journeyNextNode) {
    journeyNextNode.textContent = journeyRuntime.active
      ? `TeÄŹ: ${step?.label || step?.targetId || '--'} Â· ${step?.targetId || '--'}`
      : `${journeyConfig.steps.length} krokĹŻ Â· ${journeyConfig.loop ? 'loop ON' : 'loop OFF'} Â· ${journeyConfig.autoPreview ? 'auto preview ON' : 'auto preview OFF'}`;
  }
  if (journeyStepsNode) {
    journeyStepsNode.innerHTML = journeyConfig.steps.map((item, index) => {
      const active = journeyRuntime.active && index === Number(journeyRuntime.currentIndex || 0);
      const ok = !targetChecks[index] || targetChecks[index].ok;
      return `
        <article class="generator-journey-step ${active ? 'active' : ''} ${ok ? '' : 'invalid'}">
          <strong>${active ? 'â–¶ ' : ''}${index + 1}. ${item.label}</strong>
          <span>${item.targetId}</span>
          <small>morph ${item.durationBeats}b Â· hold ${item.holdBeats}b Â· ${item.curve}${ok ? '' : ' Â· INVALID TARGET'}</small>
        </article>
      `;
    }).join('');
  }
  if (reason === 'snapshot') writeGeneratorJourneySnapshot(journeyRuntime, localStorage);
}

function loadSelectedJourney() {
  const selected = getGeneratorJourneyPreset(journeySelectNode?.value || journeyConfig.journeyId || 'psy-trip');
  journeyConfig = saveGeneratorJourneyConfig({
    ...selected,
    journeyId: selected.id,
    loop: journeyLoopNode ? journeyLoopNode.checked : journeyConfig.loop,
    autoPreview: journeyAutoPreviewNode ? journeyAutoPreviewNode.checked : journeyConfig.autoPreview,
    commitOnStepDone: journeyCommitNode ? journeyCommitNode.checked : journeyConfig.commitOnStepDone,
    keepMusicRuntime: journeyConfig.keepMusicRuntime
  }, localStorage);
  renderJourneyPanel('load');
  log(`Journey loaded: ${journeyConfig.name} Â· ${journeyConfig.steps.length} krokĹŻ.`);
}

function updateJourneyConfig(patchConfig = {}) {
  journeyConfig = saveGeneratorJourneyConfig({
    ...journeyConfig,
    ...patchConfig,
    loop: journeyLoopNode ? journeyLoopNode.checked : journeyConfig.loop,
    autoPreview: journeyAutoPreviewNode ? journeyAutoPreviewNode.checked : journeyConfig.autoPreview,
    commitOnStepDone: journeyCommitNode ? journeyCommitNode.checked : journeyConfig.commitOnStepDone
  }, localStorage);
  renderJourneyPanel('config');
}

function handleJourneyAction(action, beat, time, reason = 'tick') {
  if (!action || action.type !== 'arm-morph' || !action.step) return false;
  if (sceneMorphRuntime.active) return false;
  sceneMorphConfig = saveGeneratorSceneMorphConfig(buildGeneratorJourneyMorphConfig(action.step, journeyConfig), localStorage);
  const result = armGeneratorSceneMorph(sceneMorphRuntime, {
    current: { patch, graph, curves },
    presetBank,
    now: time,
    beat,
    storage: localStorage
  }, sceneMorphConfig);
  sceneMorphRuntime = result.runtime;
  if (result.ok) {
    if (mode === 'off' && journeyConfig.autoPreview !== false) setMode('preview');
    resetCurveRuntime();
    renderSceneMorphPanel('journey');
    log(`Journey step ${action.index + 1}/${journeyConfig.steps.length}: ${action.step.label} â†’ ${action.step.targetId} (${action.step.durationBeats} beatĹŻ morph, ${action.step.holdBeats} beatĹŻ hold).`);
    return true;
  }
  journeyRuntime = stopGeneratorJourney(journeyRuntime, `morph-failed:${result.reason || sceneMorphRuntime.error || 'unknown'}`, localStorage);
  renderJourneyPanel('error');
  log(`Journey zastavenĂˇ, morph nejde spustit: ${result.reason || sceneMorphRuntime.error || 'unknown'}.`);
  return false;
}

function startJourney() {
  loadSelectedJourney();
  const baseBpm = Number(patch.bpm || 145) || 145;
  const now = performance.now();
  const time = now / 1000;
  const beat = time * baseBpm / 60;
  if (sceneMorphRuntime.active) sceneMorphRuntime = cancelGeneratorSceneMorph(sceneMorphRuntime, localStorage);
  const armed = armGeneratorJourney(journeyRuntime, journeyConfig, { beat });
  journeyRuntime = armed.runtime;
  const tick = tickGeneratorJourney(journeyRuntime, journeyConfig, { beat, sceneMorphActive: false, sceneMorphDone: false });
  journeyRuntime = tick.runtime;
  handleJourneyAction(tick.action || armed.action, beat, time, 'start');
  renderJourneyPanel('start');
  log(`Journey START: ${journeyConfig.name}. ${journeyConfig.loop ? 'Loop ON' : 'Loop OFF'}.`);
}

function stopJourney(reason = 'operator-stop') {
  journeyRuntime = stopGeneratorJourney(journeyRuntime, reason, localStorage);
  renderJourneyPanel('stop');
  log(`Journey STOP: ${reason}. AktuĂˇlnĂ­ Scene Morph se nezruĹˇil automaticky; pouĹľij CANCEL MORPH, pokud ho chceĹˇ takĂ© zastavit.`);
}

async function copyJourneyReport() {
  const text = buildGeneratorJourneyReport(journeyRuntime, journeyConfig);
  await copyReportText(text, 'Journey report zkopírovaný do schránky.', 'Journey report nejde zkopírovat automaticky; vypisuju do logu.');
}
async function setMode(nextMode, options = {}) {
  const resolved = nextMode === 'live' ? 'live' : (nextMode === 'preview' ? 'preview' : 'off');
  if (transitionBusy && options.force !== true) {
    log('Transition uĹľ bÄ›ĹľĂ­, dalĹˇĂ­ pĹ™epnutĂ­ ignoruju dokud dobÄ›hne.');
    return;
  }
  if (resolved === 'live') {
    refreshLiveFpsFromSettings('live-start');
    refreshLiveFpsFromServer('live-start').catch(() => {});
    transitionBusy = true;
    try {
      transitionRuntime = await armGeneratorTakeoverTransition(transitionRuntime, {
        durationMs: transitionConfig.takeoverMs,
        curve: transitionConfig.curve,
        capturePerformance: transitionConfig.capturePerformance,
        fetchImpl: fetch,
        width: patch.width,
        height: patch.height,
        storage: localStorage
      });
    } catch (error) {
      transitionRuntime = createGeneratorTransitionRuntime({ width: patch.width, height: patch.height, curve: transitionConfig.curve });
      log(`Takeover capture selhal: ${error?.message || error}. PokraÄŤuju bezpeÄŤnĂ˝m CUT/fade fallbackem.`);
    } finally {
      transitionBusy = false;
    }
    mode = 'live';
    pendingReleaseMode = '';
    latestBridgeSnapshot = liveBridge.start({ width: patch.width, height: patch.height, fps: liveFps, directServerMirror: true, localFrameBus: true });
    const status = transitionRuntime?.active ? formatGeneratorTransitionStatus(transitionRuntime, transitionConfig) : 'CUT';
    log(`LIVE MASTER zapnutĂ˝ @ ${liveFps} FPS podle Settings. Takeover: ${status}. Performance writer je potlaÄŤenĂ˝, Generator publikuje vlastnĂ­ master framy.`);
  } else {
    if (mode === 'live') {
      const releaseMs = Math.max(0, Number(transitionConfig.releaseMs || 0));
      if (releaseMs > 0 && options.force !== true) {
        pendingReleaseMode = resolved;
        transitionRuntime = armGeneratorReleaseTransition(transitionRuntime, {
          durationMs: releaseMs,
          curve: transitionConfig.curve,
          width: patch.width,
          height: patch.height,
          storage: localStorage
        });
        log(`Release fade ${releaseMs}ms: Generator ztlumĂ­ vĂ˝stup pĹ™ed vrĂˇcenĂ­m Performance.`);
        updateTransitionStatus('release-start');
        renderStaticUi();
        return;
      }
      latestBridgeSnapshot = liveBridge.stop(resolved === 'preview' ? 'switched-to-preview' : 'switched-off');
    }
    mode = resolved;
    pendingReleaseMode = '';
    transitionRuntime = createGeneratorTransitionRuntime({ width: patch.width, height: patch.height, curve: transitionConfig.curve });
    if (mode === 'preview') log('Preview reĹľim: fyzickĂ˝ vĂ˝stup nenĂ­ pĹ™ebĂ­rĂˇn.');
    if (mode === 'off') log('Generator released. Performance mĹŻĹľe znovu pĹ™evzĂ­t master output.');
  }
  saveAll();
  renderStaticUi();
  renderBridgeStatus();
  renderOperatorMetrics();
  renderFieldTestStatus();
  updateTransitionStatus('mode');
}

function applyGraphMutation(nextGraph, reason = 'graph') {
  graph = normalizeGeneratorGraph(nextGraph);
  patch = normalizeGeneratorPatch({ ...patch, modules: graphToModuleFlags(graph), graph });
  saveAll();
  renderModules();
  renderNodeFlow();
  renderStaticUi();
  log(`Node graph: ${reason}`);
}

function populateNodeCatalog() {
  if (!nodeAddSelectNode) return;
  const catalog = listGeneratorNodeCatalog();
  nodeAddSelectNode.innerHTML = catalog.map((item) => `<option value="${item.templateId}">${item.category} Â· ${item.label}</option>`).join('');
}

function addSelectedNode() {
  const templateId = nodeAddSelectNode?.value || 'plasma';
  applyGraphMutation(addGeneratorGraphNode(graph, templateId, { forceDuplicate: true }), `pĹ™idanĂ˝ node ${templateId}`);
}

function duplicateNode(id) {
  applyGraphMutation(duplicateGeneratorGraphNode(graph, id), `duplikovanĂ˝ node ${id}`);
}

function deleteNode(id) {
  applyGraphMutation(deleteGeneratorGraphNode(graph, id), `smazanĂ˝ node ${id}`);
}

function soloNode(id) {
  applyGraphMutation(soloGeneratorGraphNode(graph, id), `solo node ${id}`);
}

function clearNodeSolo() {
  applyGraphMutation(clearGeneratorGraphSolo(graph), 'clear solo / enable all visible nodes');
}

function copyNodeGraphReport() {
  const report = buildGeneratorGraphUiReport(graph);
  copyReportText(report, 'Node graph report zkopírovaný do schránky.', 'Node graph report nejde zkopírovat automaticky; vypisuju do logu.');
  log('Node graph report pripraveny ke kopirovani.');
  return report;
}


function setGraphNodePatch(id, updates = {}, rerender = false) {
  graph = updateGeneratorGraphNode(graph, id, updates);
  patch = normalizeGeneratorPatch({ ...patch, modules: graphToModuleFlags(graph), graph });
  saveAll();
  if (rerender) {
    renderModules();
    renderNodeFlow();
    renderStaticUi();
  }
}

function renderModules() {
  if (!moduleListNode) return;
  graph = normalizeGeneratorGraph(graph);
  moduleListNode.innerHTML = '';
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  for (const module of GENERATOR_MODULES.filter((item) => item.type !== 'output')) {
    const node = nodes.find((item) => item.id === module.id) || module;
    const row = document.createElement('label');
    row.className = 'generator-module';
    row.innerHTML = `
      <input type="checkbox" ${node.enabled !== false ? 'checked' : ''} data-module="${module.id}" />
      <span><strong>${module.name}</strong><small>${module.description}</small></span>
      <em>${module.type}</em>
    `;
    moduleListNode.appendChild(row);
  }
  moduleListNode.querySelectorAll('[data-module]').forEach((input) => {
    input.addEventListener('change', () => setGraphNodePatch(input.dataset.module, { enabled: input.checked }, true));
  });
}

function moveNode(id, direction) {
  applyGraphMutation(reorderGeneratorGraphNode(graph, id, direction), `node ${id} move ${direction > 0 ? 'down' : 'up'}`);
}

function bindNodeFlowControls(nodes) {
  if (!nodeFlowNode) return;
  nodeFlowNode.querySelectorAll('[data-node-enable]').forEach((input) => {
    input.addEventListener('change', () => setGraphNodePatch(input.dataset.nodeEnable, { enabled: input.checked }, true));
  });
  nodeFlowNode.querySelectorAll('[data-node-mix]').forEach((input) => {
    input.addEventListener('input', () => {
      const id = input.dataset.nodeMix;
      const value = clamp01(input.value, 0.65);
      setGraphNodePatch(id, { mix: value }, false);
      const valueNode = $(`generatorNodeMixValue_${id}`);
      if (valueNode) valueNode.textContent = `${Math.round(value * 100)}%`;
    });
  });
  nodeFlowNode.querySelectorAll('[data-node-intensity]').forEach((input) => {
    input.addEventListener('input', () => {
      const id = input.dataset.nodeIntensity;
      const value = clamp01(input.value, 0.7);
      setGraphNodePatch(id, { intensity: value }, false);
      const valueNode = $(`generatorNodeIntensityValue_${id}`);
      if (valueNode) valueNode.textContent = `${Math.round(value * 100)}%`;
    });
  });
  nodeFlowNode.querySelectorAll('[data-node-up]').forEach((button) => button.addEventListener('click', () => moveNode(button.dataset.nodeUp, -1)));
  nodeFlowNode.querySelectorAll('[data-node-down]').forEach((button) => button.addEventListener('click', () => moveNode(button.dataset.nodeDown, 1)));
  nodeFlowNode.querySelectorAll('[data-node-duplicate]').forEach((button) => button.addEventListener('click', () => duplicateNode(button.dataset.nodeDuplicate)));
  nodeFlowNode.querySelectorAll('[data-node-delete]').forEach((button) => button.addEventListener('click', () => deleteNode(button.dataset.nodeDelete)));
  nodeFlowNode.querySelectorAll('[data-node-solo]').forEach((button) => button.addEventListener('click', () => soloNode(button.dataset.nodeSolo)));
  nodeFlowNode.querySelectorAll('[data-node-bypass]').forEach((button) => button.addEventListener('click', () => {
    const target = nodes.find((node) => node.id === button.dataset.nodeBypass);
    setGraphNodePatch(button.dataset.nodeBypass, { enabled: target?.enabled === false }, true);
  }));
}

function buildNodeFlowMarkup(nodes, summary) {
  return `
    <div class="generator-node-summary generator-node-summary-v2">
      <strong>${summary.active}/${summary.total} active</strong>
      <span>${summary.label || 'empty graph'}</span>
      <small>${summary.hidden ? `${summary.hidden} hidden/deleted · ` : ''}Graph ${GENERATOR_GRAPH_VERSION}</small>
    </div>
    <div class="generator-node-stage-strip">
      ${Object.entries(summary.stages || {}).map(([stage, count]) => `<span>${stage}<b>${count}</b></span>`).join('')}
    </div>
    ${nodes.map((node, index) => `
      <article class="generator-node generator-node-${node.type} ${node.enabled === false ? 'is-bypassed' : ''}" data-node-card="${node.id}">
        <header>
          <label class="generator-node-enable">
            <input type="checkbox" data-node-enable="${node.id}" ${node.enabled !== false ? 'checked' : ''} ${node.locked ? 'disabled' : ''} />
            <strong>${node.enabled !== false ? '●' : '○'} ${node.name || node.id}</strong>
          </label>
          <em>${node.type}${node.moduleId && node.moduleId !== node.id ? ` · ${node.moduleId}` : ''}</em>
        </header>
        <small>${node.description || ''}</small>
        <label>Mix <b id="generatorNodeMixValue_${node.id}">${Math.round(Number(node.mix || 0) * 100)}%</b>
          <input type="range" min="0" max="1" step="0.01" value="${Number(node.mix || 0)}" data-node-mix="${node.id}" />
        </label>
        <label>Intensity <b id="generatorNodeIntensityValue_${node.id}">${Math.round(Number(node.intensity || 0) * 100)}%</b>
          <input type="range" min="0" max="1" step="0.01" value="${Number(node.intensity || 0)}" data-node-intensity="${node.id}" />
        </label>
        <div class="generator-node-actions generator-node-actions-v2">
          <button type="button" data-node-up="${node.id}" ${index === 0 ? 'disabled' : ''}>↑</button>
          <button type="button" data-node-down="${node.id}" ${index === nodes.length - 1 ? 'disabled' : ''}>↓</button>
          <button type="button" data-node-duplicate="${node.id}" ${node.id === 'output' ? 'disabled' : ''}>DUP</button>
          <button type="button" data-node-solo="${node.id}" ${node.id === 'output' ? 'disabled' : ''}>SOLO</button>
          <button type="button" data-node-bypass="${node.id}" ${node.locked ? 'disabled' : ''}>${node.enabled !== false ? 'BYPASS' : 'ON'}</button>
          <button type="button" data-node-delete="${node.id}" ${node.locked ? 'disabled' : ''}>DEL</button>
        </div>
      </article>
    `).join('')}
  `;
}

function renderNodeFlow() {
  if (!nodeFlowNode) return;
  graph = normalizeGeneratorGraph(graph);
  const nodes = (graph.nodes || [])
    .filter((node) => node.deleted !== true)
    .slice()
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
  const summary = summarizeGeneratorGraph(graph);
  nodeFlowNode.innerHTML = buildNodeFlowMarkup(nodes, summary);
  bindNodeFlowControls(nodes);
}

function macroTemplate(macro) {
  const current = clamp01(patch.macros?.[macro.index] ?? patch[macro.target], macro.value);
  return `
    <label class="generator-macro">
      <header><span>M${macro.index + 1} ${macro.label}</span><strong id="generatorMacroValue_${macro.index}">${Math.round(current * 100)}%</strong></header>
      <input type="range" min="0" max="1" step="0.01" value="${current}" data-macro-index="${macro.index}" data-macro-target="${macro.target}" />
    </label>
  `;
}

function renderMacros() {
  if (!macroGridNode) return;
  macroGridNode.innerHTML = GENERATOR_MACRO_DEFAULTS.map(macroTemplate).join('');
  macroGridNode.querySelectorAll('[data-macro-index]').forEach((input) => {
    input.addEventListener('input', () => {
      const index = Number(input.dataset.macroIndex || 0);
      const target = input.dataset.macroTarget;
      const value = clamp01(input.value, 0.5);
      const macros = Array.from({ length: 8 }, (_, i) => clamp01(patch.macros?.[i], GENERATOR_MACRO_DEFAULTS[i]?.value ?? 0.5));
      macros[index] = value;
      patch = normalizeGeneratorPatch({ ...patch, [target]: value, macros, modules: graphToModuleFlags(graph) });
      curves = normalizeGeneratorCurves({ ...curves, lanes: curves.lanes.map((lane) => lane.id === target ? { ...lane, value } : lane) });
      const valueNode = $(`generatorMacroValue_${index}`);
      if (valueNode) valueNode.textContent = `${Math.round(value * 100)}%`;
      const curveValueNode = $(`generatorValue_${target}`);
      if (curveValueNode) curveValueNode.textContent = `${Math.round(value * 100)}%`;
      const curveInput = controlsNode?.querySelector?.(`[data-curve-value="${target}"]`);
      if (curveInput) curveInput.value = String(value);
      saveAll();
    });
  });
}


function setGeneratorMacroValue(index, value, reason = 'manual') {
  const macro = GENERATOR_MACRO_DEFAULTS[index];
  if (!macro) return false;
  const target = macro.target;
  const resolved = clamp01(value, GENERATOR_MACRO_DEFAULTS[index]?.value ?? 0.5);
  const macros = Array.from({ length: 8 }, (_, i) => clamp01(patch.macros?.[i], GENERATOR_MACRO_DEFAULTS[i]?.value ?? 0.5));
  macros[index] = resolved;
  patch = normalizeGeneratorPatch({ ...patch, [target]: resolved, macros, modules: graphToModuleFlags(graph), graph });
  curves = normalizeGeneratorCurves({ ...curves, lanes: curves.lanes.map((lane) => lane.id === target ? { ...lane, value: resolved } : lane) });
  const valueNode = $(`generatorMacroValue_${index}`);
  if (valueNode) valueNode.textContent = `${Math.round(resolved * 100)}%`;
  const input = macroGridNode?.querySelector?.(`[data-macro-index="${index}"]`);
  if (input) input.value = String(resolved);
  const curveValueNode = $(`generatorValue_${target}`);
  if (curveValueNode) curveValueNode.textContent = `${Math.round(resolved * 100)}%`;
  const curveInput = controlsNode?.querySelector?.(`[data-curve-value="${target}"]`);
  if (curveInput) curveInput.value = String(resolved);
  saveAll();
  if (reason === 'midi') renderStaticUi();
  return true;
}

function curveTemplate(lane) {
  const value = Number(lane.value ?? patch[lane.id] ?? 0);
  const mode = String(lane.mode || 'manual');
  return `
    <article class="generator-curve" data-curve-row="${lane.id}">
      <header>
        <span>${lane.label}</span>
        <strong id="generatorValue_${lane.id}">${Math.round(value * 100)}%</strong>
      </header>
      <input type="range" min="0" max="1" step="0.01" value="${value}" data-curve-value="${lane.id}" />
      <div class="generator-curve-grid">
        <label>Mode
          <select data-curve-mode="${lane.id}">
            <option value="manual" ${mode === 'manual' ? 'selected' : ''}>manual</option>
            <option value="lfo" ${mode === 'lfo' ? 'selected' : ''}>lfo</option>
            <option value="beat" ${mode === 'beat' ? 'selected' : ''}>beat</option>
            <option value="random" ${mode === 'random' ? 'selected' : ''}>random</option>
          </select>
        </label>
        <label>Rate<input type="number" min="0.005" max="24" step="0.005" value="${Number(lane.rate || 0.08)}" data-curve-rate="${lane.id}" /></label>
        <label>Depth<input type="range" min="0" max="1" step="0.01" value="${Number(lane.depth || 0)}" data-curve-depth="${lane.id}" /></label>
        <label>Smooth<input type="range" min="0" max="0.98" step="0.01" value="${Number(lane.smooth || 0)}" data-curve-smooth="${lane.id}" /></label>
        <label>Div
          <select data-curve-division="${lane.id}">
            ${[1, 2, 4, 8, 16, 32].map((v) => `<option value="${v}" ${Number(lane.division || 4) === v ? 'selected' : ''}>${v}</option>`).join('')}
          </select>
        </label>
      </div>
    </article>
  `;
}

function updateCurveLane(id, patcher) {
  curves = normalizeGeneratorCurves({ ...curves, lanes: curves.lanes.map((lane) => lane.id === id ? patcher(lane) : lane) });
  const lane = curves.lanes.find((item) => item.id === id);
  if (lane) {
    patch = normalizeGeneratorPatch({ ...patch, [id]: lane.value, macros: patchValuesToMacros({ ...patch, [id]: lane.value }), modules: graphToModuleFlags(graph) });
  }
  resetCurveRuntime();
  saveAll();
}

function bindCurveControls() {
  if (!controlsNode) return;
  controlsNode.querySelectorAll('[data-curve-value]').forEach((input) => {
    input.addEventListener('input', () => {
      const id = input.dataset.curveValue;
      const value = clamp01(input.value, 0);
      updateCurveLane(id, (lane) => ({ ...lane, value }));
      const valueNode = $(`generatorValue_${id}`);
      if (valueNode) valueNode.textContent = `${Math.round(value * 100)}%`;
      renderMacros();
    });
  });
  controlsNode.querySelectorAll('[data-curve-mode]').forEach((select) => {
    select.addEventListener('change', () => updateCurveLane(select.dataset.curveMode, (lane) => ({ ...lane, mode: select.value })));
  });
  controlsNode.querySelectorAll('[data-curve-rate]').forEach((input) => {
    input.addEventListener('change', () => updateCurveLane(input.dataset.curveRate, (lane) => ({ ...lane, rate: Number(input.value || lane.rate || 0.08) })));
  });
  controlsNode.querySelectorAll('[data-curve-depth]').forEach((input) => {
    input.addEventListener('input', () => updateCurveLane(input.dataset.curveDepth, (lane) => ({ ...lane, depth: Number(input.value || 0) })));
  });
  controlsNode.querySelectorAll('[data-curve-smooth]').forEach((input) => {
    input.addEventListener('input', () => updateCurveLane(input.dataset.curveSmooth, (lane) => ({ ...lane, smooth: Number(input.value || 0) })));
  });
  controlsNode.querySelectorAll('[data-curve-division]').forEach((select) => {
    select.addEventListener('change', () => updateCurveLane(select.dataset.curveDivision, (lane) => ({ ...lane, division: Number(select.value || lane.division || 4) })));
  });
}

function renderControls() {
  if (!controlsNode) return;
  curves = normalizeGeneratorCurves(curves);
  controlsNode.innerHTML = curves.lanes.map(curveTemplate).join('');
  bindCurveControls();
}

function renderSafeSceneBank() {
  if (!safeSceneSelectNode) return;
  safeSceneSelectNode.innerHTML = listGeneratorSafeScenes().map((scene) => `<option value="${scene.id}">${scene.name}</option>`).join('');
}

function applySelectedSafeScene(idOverride = '', options = {}) {
  const id = idOverride || safeSceneSelectNode?.value || 'safe-calm';
  const result = applyGeneratorSafeScene(id, { patch, graph, curves });
  if (mode === 'live') setMode('preview');
  patch = normalizeGeneratorPatch({ ...result.patch, modules: graphToModuleFlags(result.graph), graph: result.graph });
  graph = normalizeGeneratorGraph(result.graph);
  curves = normalizeGeneratorCurves(result.curves);
  resetCurveRuntime();
  saveAll();
  renderModules();
  renderNodeFlow();
  renderMacros();
  renderControls();
  renderStaticUi();
  log(`Safe scene applied${options.source ? ` (${options.source})` : ''}: ${patch.name}. Live byl pro jistotu pĹ™epnutĂ˝ do PREVIEW.`);
}

function publishBlackoutFrame(reason = 'manual-blackout') {
  const rendered = createBlackoutGeneratorFrame(patch.width || 300, patch.height || 8, { reason, renderMs: 0 });
  paintGeneratorFrameToCanvas(canvas, rendered);
  if (mode === 'live') {
    const publishStarted = performance.now();
    const result = liveBridge.publish(rendered, { patch: rendered.patch, bpm: patch.bpm, beat: 0, renderMs: 0, blackout: true });
    const publishMs = Math.max(0, performance.now() - publishStarted);
    if (result?.snapshot) latestBridgeSnapshot = result.snapshot;
    liveMetrics = updateGeneratorLiveMetrics(liveMetrics, { renderMs: 0, publishMs, bridge: latestBridgeSnapshot });
    renderBridgeStatus();
    renderOperatorMetrics();
    log('BLACKOUT frame odeslanĂ˝ do LIVE MASTER bridge.');
  } else {
    log('BLACKOUT frame zobrazenĂ˝ jen v preview. Pro fyzickĂ˝ blackout musĂ­ bĂ˝t LIVE MASTER aktivnĂ­.');
  }
}

function panicRelease() {
  if (mode === 'live') publishBlackoutFrame('panic-release');
  setMode('off');
  log('PANIC RELEASE: blackout frame pokus odeslĂˇn, generator uvolnÄ›n do OFF.');
}


function renderLiveStabilityPanel(diagnostics = lastLiveTestSnapshot, reason = 'auto') {
  const performanceMirror = readGeneratorPerformanceMirrorState(window);
  const bridge = latestBridgeSnapshot || liveBridge.snapshot();
  lastStabilityView = buildGeneratorLiveStabilityView({
    runtime: liveStabilityRuntime,
    diagnostics: diagnostics || lastLiveTestSnapshot || {},
    bridge,
    mode,
    targetFps: liveFps,
    performanceMirror,
    nowPerf: performance.now(),
    nowWall: Date.now()
  });
  liveStabilityRuntime = lastStabilityView.runtime;
  const analysis = lastStabilityView.analysis;
  renderStabilityAnalysis(analysis);
  if (reason === 'manual') liveTestLog(`Stability refresh: ${analysis.state}`);
  return lastStabilityView;
}

async function copyLiveStabilityReport() {
  const view = renderLiveStabilityPanel(lastLiveTestSnapshot, 'copy');
  const text = formatGeneratorLiveStabilityReport(view);
  await copyReportText(text, 'Live Stability report zkopírovaný do schránky.', 'Live Stability report nejde zkopírovat automaticky; vypisuju ho do logu.');
}
async function copyTransitionReport() {
  const text = buildGeneratorTransitionReport(transitionRuntime, transitionConfig);
  await copyReportText(text, 'Transition report zkopírovaný do schránky.', 'Transition report nejde zkopírovat automaticky; vypisuju ho do logu.');
}
function renderOperatorMetrics() {
  const summary = summarizeGeneratorLiveMetrics(liveMetrics);
  if (operatorBadgeNode) {
    operatorBadgeNode.textContent = mode === 'live' ? summary.status : (mode === 'preview' ? 'PREVIEW' : 'SAFE');
    operatorBadgeNode.className = summary.status === 'HOT' ? 'hot' : (summary.status === 'WATCH' ? 'watch' : 'ok');
  }
  if (metricRenderNode) metricRenderNode.textContent = summary.render;
  if (metricPublishNode) metricPublishNode.textContent = summary.publish;
  if (metricServerNode) metricServerNode.textContent = summary.server;
  if (metricDropsNode) metricDropsNode.textContent = `${summary.drops}${Number(summary.errors || 0) ? ` / err ${summary.errors}` : ''}`;
}

function renderLiveFpsUi() {
  if (liveFpsSelectNode) {
    liveFpsSelectNode.value = String(liveFps);
    liveFpsSelectNode.setAttribute('readonly', 'readonly');
    liveFpsSelectNode.setAttribute('title', `Generator LIVE FPS se bere ze Settings â†’ FPS (${liveFps})`);
  }
  if (liveFpsSourceNode) {
    const capped = liveFpsInfo?.capped ? ' Â· cap 60 pro browser render loop' : '';
    liveFpsSourceNode.textContent = `${liveFps} FPS Â· ${liveFpsInfo?.source || 'settings'}${capped}`;
  }
}

function applyLiveFpsInfo(nextInfo, reason = 'settings') {
  const next = persistGeneratorLiveFpsFromSettings(nextInfo, localStorage);
  const changed = Number(next.fps || 0) !== Number(liveFps || 0) || String(next.source || '') !== String(liveFpsInfo?.source || '');
  liveFpsInfo = next;
  liveFps = next.fps;
  liveBridge.setOptions({ fps: liveFps });
  renderLiveFpsUi();
  if (changed) log(`Generator LIVE FPS podle Settings: ${liveFps} (${next.source || reason}).`);
  return next;
}

function refreshLiveFpsFromSettings(reason = 'poll') {
  return applyLiveFpsInfo(readGeneratorSettingsOutputFps(localStorage, liveFps || 60), reason);
}

async function refreshLiveFpsFromServer(reason = 'server') {
  const serverInfo = await fetchServerArtnetOutputFps(fetch, liveFps || 60);
  if (serverInfo?.source === 'server.live-config.fps') applyLiveFpsInfo(serverInfo, reason);
  return serverInfo;
}

function setLiveFps(value) {
  // STEP38M: ruÄŤnĂ­ Live FPS v Generatoru uĹľ nepĹ™ebĂ­jĂ­ vĂ˝stup.
  // PĹ™i zmÄ›nÄ› jen znovu naÄŤteme centrĂˇlnĂ­ Settings hodnotu.
  refreshLiveFpsFromSettings('operator-refresh');
  log(`Generator LIVE FPS je Ĺ™Ă­zenĂ© ze Settings, ruÄŤnĂ­ hodnota ${value} ignorovĂˇna.`);
}

function renderPresetBank() {
  if (!presetSelectNode) return;
  presetBank = loadGeneratorPresetBank();
  const custom = presetBank.custom || [];
  const factory = presetBank.factory || [];
  const optionHtml = [
    custom.length ? `<optgroup label="Custom">${custom.map((preset) => `<option value="${preset.id}">${preset.name}</option>`).join('')}</optgroup>` : '',
    `<optgroup label="Factory">${factory.map((preset) => `<option value="${preset.id}">${preset.name}</option>`).join('')}</optgroup>`
  ].join('');
  presetSelectNode.innerHTML = optionHtml;
  if (activePresetId && findGeneratorPreset(presetBank, activePresetId)) presetSelectNode.value = activePresetId;
}

function applyPreset(preset) {
  if (!preset) return;
  if (mode === 'live') setMode('preview');
  graph = normalizeGeneratorGraph(preset.graph || createDefaultGeneratorGraph());
  curves = normalizeGeneratorCurves(preset.curves || createDefaultGeneratorCurves());
  patch = normalizeGeneratorPatch({ ...GENERATOR_DEFAULT_PATCH, ...(preset.patch || {}), name: preset.name || preset.patch?.name || 'Generator Patch', modules: graphToModuleFlags(graph), graph });
  updatePatchMacrosFromValues();
  activePresetId = preset.id;
  rememberActiveGeneratorPreset(activePresetId);
  resetCurveRuntime();
  saveAll();
  renderModules();
  renderNodeFlow();
  renderMacros();
  renderControls();
  activeMusicModeId = saveGeneratorMusicMode(preset.patch?.musicMode || 'manual', localStorage);
  lastMusicModeMeta = { id: activeMusicModeId, enabled: musicModeRuntimeEnabled, phrasePct: 0, accent: 0 };
  renderStaticUi();
  renderMusicModePanel('preset');
  renderPresetBank();
  log(`Preset loaded: ${preset.name}`);
}

function saveCurrentPreset() {
  const name = String(presetNameNode?.value || patch.name || '').trim() || `Generator ${new Date().toLocaleTimeString()}`;
  patch = normalizeGeneratorPatch({ ...patch, name, macros: patchValuesToMacros(patch), modules: graphToModuleFlags(graph), graph });
  const result = saveGeneratorPresetSnapshot(presetBank, { name, patch, graph, curves });
  presetBank = result.bank;
  activePresetId = result.preset.id;
  rememberActiveGeneratorPreset(activePresetId);
  renderPresetBank();
  saveAll();
  log(`Preset uloĹľen: ${result.preset.name}`);
}

function deleteSelectedPreset() {
  const id = presetSelectNode?.value || '';
  if (!id || id.startsWith('factory-')) {
    log('Factory preset nejde smazat. UloĹľ si vlastnĂ­ kopii a smaĹľ aĹľ custom preset.');
    return;
  }
  presetBank = deleteGeneratorPreset(presetBank, id);
  activePresetId = presetBank.factory?.[0]?.id || '';
  rememberActiveGeneratorPreset(activePresetId);
  renderPresetBank();
  log('Custom preset smazĂˇn.');
}


function renderFieldTestControls() {
  if (fieldTestTypeNode && !fieldTestTypeNode.options.length) {
    fieldTestTypeNode.innerHTML = listGeneratorFieldTests().map((test) => `<option value="${test.id}">${test.name}</option>`).join('');
  }
  if (fieldTestColorNode && !fieldTestColorNode.options.length) {
    fieldTestColorNode.innerHTML = listGeneratorFieldTestColors().map((color) => `<option value="${color.id}">${color.name}</option>`).join('');
  }
  if (fieldTestUniverseNode && fieldTestUniverseNode.options.length <= 1) {
    const universeCount = Math.max(1, Math.ceil(Number(patch.width || 300) / 170) * Number(patch.height || 8));
    fieldTestUniverseNode.innerHTML = '<option value="auto">AUTO</option>' + Array.from({ length: universeCount }, (_, index) => `<option value="${index}">U${index}</option>`).join('');
  }
  updateFieldTestIntensityLabel();
  renderFieldTestStatus();
}

function updateFieldTestIntensityLabel() {
  if (fieldTestIntensityValueNode) fieldTestIntensityValueNode.textContent = `${Math.round(Number(fieldTestIntensityNode?.value || 0.78) * 100)}%`;
}

function readFieldTestOptions(extra = {}) {
  return {
    type: fieldTestTypeNode?.value || 'single-strip',
    stripIndex: fieldTestStripNode?.value || 'all',
    universeIndex: fieldTestUniverseNode?.value || 'auto',
    color: fieldTestColorNode?.value || 'white',
    intensity: Number(fieldTestIntensityNode?.value || 0.78),
    width: patch.width || 300,
    height: patch.height || 8,
    universeSize: 170,
    ...extra
  };
}

function renderFieldTestStatus() {
  const summary = activeFieldTest ? summarizeGeneratorFieldTest(activeFieldTest.options) : null;
  const live = mode === 'live';
  if (fieldTestBadgeNode) {
    fieldTestBadgeNode.textContent = activeFieldTest ? (live ? 'TEST LIVE' : 'TEST PREVIEW') : 'READY';
    fieldTestBadgeNode.className = activeFieldTest ? (live ? 'hot' : 'watch') : 'ok';
  }
  if (fieldTestSummaryNode) fieldTestSummaryNode.textContent = summary ? `${summary.detail} Â· ${Math.max(0, ((activeFieldTest.until || 0) - performance.now()) / 1000).toFixed(1)}s left` : 'Ĺ˝ĂˇdnĂ˝ field test nebÄ›ĹľĂ­.';
  if (fieldTestHintNode) {
    fieldTestHintNode.textContent = live
      ? 'LIVE MASTER je aktivnĂ­: testovacĂ­ frame jde pĹ™es stejnĂ˝ MASTER bridge do ArtNet Ĺ™etÄ›zce.'
      : 'Bez LIVE MASTER je test bezpeÄŤnÄ› jen v preview. Pro fyzickĂ˝ vĂ˝stup nejdĹ™Ă­v zapni LIVE MASTER.';
  }
}

function activateFieldTest({ publish = false } = {}) {
  const holdSeconds = Math.max(0.5, Math.min(60, Number(fieldTestHoldNode?.value || 3) || 3));
  const options = readFieldTestOptions({ phase: performance.now() / 1000 });
  activeFieldTest = {
    options,
    publish: publish === true,
    startedAt: performance.now(),
    until: performance.now() + holdSeconds * 1000
  };
  const summary = summarizeGeneratorFieldTest(options);
  lastFieldTestReport = buildGeneratorFieldTestReport(options, { live: publish && mode === 'live', skipped: publish && mode !== 'live', reason: publish && mode !== 'live' ? 'live-master-not-active' : '' });
  if (mode === 'off') setMode('preview');
  log(`${publish ? 'Field test publish armed' : 'Field test preview'}: ${summary.detail}`);
  if (publish && mode !== 'live') log('PUBLISH IF LIVE: LIVE MASTER nenĂ­ aktivnĂ­, test zĹŻstĂˇvĂˇ jen v preview.');
  renderFieldTestStatus();
}

function stopFieldTest(reason = 'manual-stop') {
  if (activeFieldTest) log(`Field test stop: ${reason}`);
  activeFieldTest = null;
  renderFieldTestStatus();
}

function renderActiveFieldTestFrame(time) {
  if (!activeFieldTest) return null;
  const now = performance.now();
  if (now > Number(activeFieldTest.until || 0)) {
    stopFieldTest('hold-expired');
    return null;
  }
  activeFieldTest.options = readFieldTestOptions({ phase: time });
  const started = performance.now();
  const rendered = createGeneratorFieldTestFrame(activeFieldTest.options);
  rendered.meta.renderMs = Math.max(0, performance.now() - started);
  lastFieldTestReport = buildGeneratorFieldTestReport(activeFieldTest.options, { live: mode === 'live' && activeFieldTest.publish, ok: mode === 'live' && activeFieldTest.publish });
  if (Math.floor(now / 250) !== Math.floor((now - 16) / 250)) renderFieldTestStatus();
  return rendered;
}

async function copyFieldTestReport() {
  const text = lastFieldTestReport || buildGeneratorFieldTestReport(readFieldTestOptions(), { live: mode === 'live' });
  await copyReportText(text, 'Field test report zkopírovaný do schránky.', 'Field test report nejde zkopírovat automaticky; vypisuju ho do logu.', { panelLines: 5 });
}
function availableMidiInputs() {
  if (!midiAccess?.inputs) return [];
  return Array.from(midiAccess.inputs.values()).map((input) => ({
    id: input.id,
    name: input.name || input.manufacturer || input.id,
    state: input.state || '',
    connection: input.connection || ''
  }));
}

function renderMidiPanel(reason = 'render') {
  const inputs = availableMidiInputs();
  midiRuntime = { ...midiRuntime, supported: typeof navigator !== 'undefined' && typeof navigator.requestMIDIAccess === 'function', access: Boolean(midiAccess), enabled: midiConfig.enabled === true, connected: Boolean(midiInput), inputId: midiConfig.inputId, inputName: midiInput?.name || midiConfig.lastInputName || '', inputs };
  midiSnapshot = buildGeneratorMidiSnapshot(midiRuntime, midiConfig);
  if (midiBadgeNode) {
    const label = !midiRuntime.supported ? 'NO WEB MIDI' : (!midiAccess ? 'DISCONNECTED' : (midiConfig.enabled ? (midiInput ? 'MIDI ON' : 'NO INPUT') : 'MIDI OFF'));
    midiBadgeNode.textContent = label;
    midiBadgeNode.className = midiConfig.enabled && midiInput ? 'ok' : 'watch';
  }
  if (midiStatusNode) {
    midiStatusNode.textContent = midiRuntime.error
      ? midiRuntime.error
      : `${midiSnapshot.inputName || midiSnapshot.inputId || '--'} Â· msg ${midiSnapshot.messageCount} Â· mapped ${midiSnapshot.mappedCount} Â· ignored ${midiSnapshot.ignoredCount}`;
  }
  if (midiEnableNode) {
    midiEnableNode.classList.toggle('active', midiConfig.enabled === true);
    midiEnableNode.textContent = midiConfig.enabled ? 'MIDI ON' : 'MIDI OFF';
  }
  if (midiInputSelectNode) {
    const current = midiInputSelectNode.value || midiConfig.inputId;
    const html = ['<option value="auto">AUTO / prvnĂ­ dostupnĂ˝</option>'].concat(inputs.map((input) => `<option value="${input.id}">${input.name}</option>`)).join('');
    if (midiInputSelectNode.innerHTML !== html) midiInputSelectNode.innerHTML = html;
    midiInputSelectNode.value = inputs.some((item) => item.id === (current || midiConfig.inputId)) ? (current || midiConfig.inputId) : 'auto';
  }
  if (midiLearnActionNode && !midiLearnActionNode.options.length) {
    midiLearnActionNode.innerHTML = listGeneratorMidiActions().map((action) => `<option value="${action.id}">${action.label}</option>`).join('');
  }
  if (midiLearnNode) {
    midiLearnNode.classList.toggle('active', Boolean(midiConfig.learnAction));
    midiLearnNode.textContent = midiConfig.learnAction ? 'LEARNINGâ€¦' : 'LEARN NEXT';
  }
  if (midiLastNode) midiLastNode.textContent = midiSnapshot.lastMessage ? formatGeneratorMidiMessage(midiSnapshot.lastMessage) : '--';
  if (midiActionNode) midiActionNode.textContent = midiSnapshot.lastAction || midiConfig.learnAction || '--';
  if (midiMappingListNode) {
    midiMappingListNode.innerHTML = midiSnapshot.mappingSummary.map((line) => `<li>${line}</li>`).join('') || '<li>Ĺ˝ĂˇdnĂ© mapovĂˇnĂ­.</li>';
  }
  if (reason === 'message' && midiSnapshot.lastAction) log(`MIDI: ${midiSnapshot.lastAction}`);
}

function detachMidiInput() {
  if (midiInput) midiInput.onmidimessage = null;
  midiInput = null;
}

function pickMidiInput() {
  const inputs = availableMidiInputs();
  if (!inputs.length || !midiAccess?.inputs) return null;
  if (midiConfig.inputId && midiConfig.inputId !== 'auto') {
    const exact = Array.from(midiAccess.inputs.values()).find((input) => input.id === midiConfig.inputId);
    if (exact) return exact;
  }
  const preferred = Array.from(midiAccess.inputs.values()).find((input) => /apc|akai|midi|oxygen|controller/i.test(`${input.name || ''} ${input.manufacturer || ''}`));
  return preferred || Array.from(midiAccess.inputs.values())[0] || null;
}

function attachMidiInput() {
  detachMidiInput();
  midiInput = pickMidiInput();
  if (midiInput) {
    midiInput.onmidimessage = handleMidiMessage;
    midiConfig = saveGeneratorMidiConfig({ ...midiConfig, lastInputName: midiInput.name || midiInput.id }, localStorage);
  }
  renderMidiPanel('attach');
}

async function connectMidi(reason = 'manual') {
  midiRuntime = { ...midiRuntime, supported: typeof navigator !== 'undefined' && typeof navigator.requestMIDIAccess === 'function', error: '' };
  if (!midiRuntime.supported) {
    midiRuntime.error = 'Web MIDI nenĂ­ v tomto browseru dostupnĂ©.';
    renderMidiPanel('no-support');
    log('MIDI: Web MIDI nenĂ­ dostupnĂ©. V Chrome/Edge musĂ­ strĂˇnka bÄ›Ĺľet z povolenĂ©ho originu.');
    return false;
  }
  try {
    midiAccess = await navigator.requestMIDIAccess({ sysex: false });
    midiAccess.onstatechange = () => {
      attachMidiInput();
      log('MIDI: zmÄ›na zaĹ™Ă­zenĂ­, vstupy obnovenĂ©.');
    };
    attachMidiInput();
    log(`MIDI pĹ™ipojeno (${reason}). Input: ${midiInput?.name || 'ĹľĂˇdnĂ˝ vstup'}.`);
    return true;
  } catch (error) {
    midiRuntime.error = `MIDI access denied: ${error?.message || error}`;
    renderMidiPanel('error');
    log(midiRuntime.error);
    return false;
  }
}

function setMidiEnabled(enabled) {
  midiConfig = saveGeneratorMidiConfig({ ...midiConfig, enabled: Boolean(enabled) }, localStorage);
  if (midiConfig.enabled && !midiAccess) runAsyncTask(() => connectMidi('enable'), (error) => log(`MIDI connect error: ${error?.message || error}`));
  renderMidiPanel('enable');
}

function applyMidiAction(action = '', value = 1, message = null) {
  const gate = message?.type === 'note' ? value > 0 : true;
  if (!gate) return false;
  if (action.startsWith('macro:')) {
    const index = Number(action.split(':')[1] || 0);
    return setGeneratorMacroValue(index, value, 'midi');
  }
  if (action.startsWith('mode:')) {
    activeMusicModeId = saveGeneratorMusicMode(action.slice(5), localStorage);
    if (!musicModeRuntimeEnabled) setMusicModeRuntime(true);
    applySelectedMusicMode(activeMusicModeId, { source: 'midi' });
    return true;
  }
  if (action === 'build-now') { activeMusicModeId = saveGeneratorMusicMode('build', localStorage); if (!musicModeRuntimeEnabled) setMusicModeRuntime(true); applySelectedMusicMode(activeMusicModeId, { source: 'midi-build' }); return true; }
  if (action === 'drop-now') { activeMusicModeId = saveGeneratorMusicMode('drop', localStorage); if (!musicModeRuntimeEnabled) setMusicModeRuntime(true); applySelectedMusicMode(activeMusicModeId, { source: 'midi-drop' }); return true; }
  if (action.startsWith('morph:')) {
    const targetId = action.slice(6);
    sceneMorphConfig = saveGeneratorSceneMorphConfig({ ...sceneMorphConfig, targetId, durationBeats: targetId.includes('drop') ? 8 : 16, timeMode: 'beats', curve: targetId.includes('drop') ? 'ease-out' : 'smooth' }, localStorage);
    renderSceneMorphPanel('midi-target');
    armSelectedSceneMorph();
    return true;
  }
  if (action.startsWith('safe-scene:')) {
    applySelectedSafeScene(action.slice(11), { source: 'midi' });
    return true;
  }
  if (action === 'blackout') { publishBlackoutFrame('midi-blackout'); return true; }
  if (action === 'panic-release') { publishBlackoutFrame('midi-panic'); setMode('off', { force: true }); return true; }
  if (action === 'live-toggle') { setMode(mode === 'live' ? 'off' : 'live'); return true; }
  if (action === 'preview-toggle') { setMode(mode === 'preview' ? 'off' : 'preview'); return true; }
  if (action === 'journey-start') { startJourney(); return true; }
  if (action === 'journey-stop') { stopJourney('midi-stop'); return true; }
  if (action === 'beat-tap') { tapBeatIntelligence(); return true; }
  if (action === 'beat-phrase-reset') { resetBeatPhrase(); return true; }
  if (action === 'beat-drop-mark') { markBeatDrop(); return true; }
  if (action === 'small-mutation') { smallMutation(); return true; }
  return false;
}

function handleMidiMessage(event) {
  const message = normalizeMidiMessage(event.data || []);
  midiRuntime = { ...midiRuntime, messageCount: Number(midiRuntime.messageCount || 0) + 1, lastMessage: message, error: '' };
  if (midiConfig.learnAction) {
    const learned = learnGeneratorMidiMapping(midiConfig, midiConfig.learnAction, message);
    if (learned.ok) {
      midiConfig = saveGeneratorMidiConfig(learned.config, localStorage);
      midiRuntime = { ...midiRuntime, learnedCount: Number(midiRuntime.learnedCount || 0) + 1, mappedCount: Number(midiRuntime.mappedCount || 0) + 1, lastAction: learned.mapping.action };
      log(`MIDI learn: ${formatGeneratorMidiMessage(message)} â†’ ${learned.mapping.action}`);
    } else {
      midiRuntime = { ...midiRuntime, ignoredCount: Number(midiRuntime.ignoredCount || 0) + 1, lastAction: `learn-failed:${learned.reason}` };
    }
    renderMidiPanel('message');
    return;
  }
  const mapped = findGeneratorMidiAction(message, midiConfig);
  if (!mapped.ok) {
    midiRuntime = { ...midiRuntime, ignoredCount: Number(midiRuntime.ignoredCount || 0) + 1, lastAction: mapped.reason };
    renderMidiPanel('ignored');
    return;
  }
  const handled = applyMidiAction(mapped.action, mapped.value, message);
  midiRuntime = {
    ...midiRuntime,
    mappedCount: Number(midiRuntime.mappedCount || 0) + (handled ? 1 : 0),
    ignoredCount: Number(midiRuntime.ignoredCount || 0) + (handled ? 0 : 1),
    lastAction: handled ? mapped.action : `unhandled:${mapped.action}`
  };
  renderMidiPanel('message');
}

async function copyMidiReport() {
  const text = formatGeneratorMidiReport(midiRuntime, midiConfig);
  await copyReportText(text, 'MIDI report zkopírovaný do schránky.', 'MIDI report nejde zkopírovat automaticky; vypisuju do Live logu.');
}
function liveTestLog(message) {
  const line = `[${new Date().toLocaleTimeString()}] ${message}`;
  if (liveTestLogNode) liveTestLogNode.textContent = `${line}\n${String(liveTestLogNode.textContent || '').split('\n').slice(0, 8).join('\n')}`;
}

function renderLiveTestPanel(diagnostics = null) {
  if (!liveTestChainNode) return;
  const view = buildGeneratorLivePanelView(diagnostics || lastLiveTestSnapshot || {});
  if (liveTestStageNode) {
    liveTestStageNode.textContent = view.headline || view.summary?.stage || 'UNKNOWN';
    liveTestStageNode.className = view.summary?.ok ? 'ok' : 'warn';
  }
  if (liveTestVerdictNode) liveTestVerdictNode.textContent = view.verdict || '--';
  if (liveTestNextNode) liveTestNextNode.textContent = view.next || '--';
  liveTestChainNode.innerHTML = view.rows.map((row) => `
    <article class="generator-live-step ${row.ok ? 'ok' : 'warn'}">
      <header><span>${row.label}</span><strong>${row.value}</strong></header>
      <small>${row.detail}</small>
    </article>
  `).join('');
}

function renderOutputTruthPanel(diagnostics = null) {
  const sourceDiagnostics = diagnostics || lastLiveTestSnapshot || {};
  let view;
  try {
    view = buildGeneratorOutputTruthView(sourceDiagnostics);
  } catch (error) {
    if (outputTruthBadgeNode) {
      outputTruthBadgeNode.textContent = 'PANEL ERROR';
      outputTruthBadgeNode.className = 'warn';
    }
    if (outputTruthCardsNode) outputTruthCardsNode.textContent = String(error?.message || error || 'output-truth-error');
    return null;
  }
  if (outputTruthBadgeNode) {
    outputTruthBadgeNode.textContent = view.headline || 'OUTPUT TRUTH';
    outputTruthBadgeNode.className = view.ok ? 'ok' : 'warn';
  }
  if (outputTruthCardsNode) {
    outputTruthCardsNode.innerHTML = view.cards.map((card) => `
      <article class="generator-output-card ${card.ok ? 'ok' : 'warn'}">
        <span>${card.label}</span>
        <strong>${card.value}</strong>
        <small>${card.detail}</small>
      </article>
    `).join('');
  }
  if (outputTruthRoutesNode) {
    outputTruthRoutesNode.innerHTML = view.routes.map((row) => `
      <article class="generator-route-row ${row.ok ? 'ok' : 'warn'}">
        <strong>${row.label}</strong>
        <small>${row.detail}</small>
      </article>
    `).join('');
  }
  if (outputTruthHintsNode) {
    outputTruthHintsNode.innerHTML = view.hints.map((hint) => `<li class="${hint.level || 'warn'}">${hint.text}</li>`).join('');
  }
  return view;
}

async function refreshOutputTruthPanel(reason = 'manual') {
  const diagnostics = await refreshLiveTestPanel(reason === 'auto' ? 'output-auto' : 'output-truth');
  const view = renderOutputTruthPanel(diagnostics || lastLiveTestSnapshot);
  if (reason === 'manual') liveTestLog(`Output Truth refresh: ${view?.truth?.state || 'unknown'}`);
  return view;
}

async function copyOutputTruthReport() {
  const view = renderOutputTruthPanel(lastLiveTestSnapshot) || buildGeneratorOutputTruthView(lastLiveTestSnapshot || {});
  const text = view.text || formatGeneratorOutputTruthText(view);
  await copyReportText(text, 'Output Truth report zkopírovaný do schránky.', 'Output Truth report nejde zkopírovat automaticky; report je v panelu/logu.');
}
async function refreshLiveTestPanel(reason = 'manual') {
  if (liveTestBusy) return lastLiveTestSnapshot;
  liveTestBusy = true;
  try {
    const diagnostics = await collectGeneratorLiveDiagnostics({ fetchImpl: fetch, storage: localStorage });
    lastLiveTestSnapshot = diagnostics;
    renderLiveTestPanel(diagnostics);
    renderOutputTruthPanel(diagnostics);
    renderLiveStabilityPanel(diagnostics, reason === 'manual' ? 'manual' : 'auto');
    if (reason === 'manual') liveTestLog(`Chain refresh: ${diagnostics.summary.stage}`);
    return diagnostics;
  } catch (error) {
    const message = String(error?.message || error || 'live-test-refresh-failed');
    liveTestLog(`Chain refresh error: ${message}`);
    if (liveTestStageNode) {
      liveTestStageNode.textContent = 'PANEL ERROR';
      liveTestStageNode.className = 'warn';
    }
    if (liveTestVerdictNode) liveTestVerdictNode.textContent = message;
    return null;
  } finally {
    liveTestBusy = false;
  }
}

async function runMasterSelfTest() {
  liveTestLog('MASTER self-test posĂ­lĂˇm do server mirroru...');
  const result = await runGeneratorMasterSelfTest({ fetchImpl: fetch, stripCount: patch.height || 8, pixelsPerStrip: patch.width || 300 });
  if (result?.ok) liveTestLog(`MASTER self-test OK Â· frame #${result.frameId || result.latest?.frameId || '?'}`);
  else liveTestLog(`MASTER self-test ERROR Â· ${result?.error || result?.reason || 'unknown'}`);
  await refreshLiveTestPanel('self-test');
}

function renderBridgeStatus() {
  const snap = latestBridgeSnapshot || liveBridge.snapshot();
  latestBridgeSnapshot = snap;
  if (bridgeStatusNode) bridgeStatusNode.textContent = snap.active ? 'LIVE MASTER' : (mode === 'preview' ? 'PREVIEW' : 'RELEASED');
  if (serverStatusNode) serverStatusNode.textContent = snap.active ? `${snap.serverSent || 0} sent / ${snap.serverErrors || 0} err` : 'idle';
  if (frameBusStatusNode) frameBusStatusNode.textContent = snap.lastFrameBusId ? `#${snap.lastFrameBusId}` : '--';
  if (sentStatusNode) sentStatusNode.textContent = snap.active ? `${snap.publishedLocal || 0} local` : '--';
  renderLiveStabilityPanel(lastLiveTestSnapshot, 'bridge');
}

function renderStabilityAnalysis(analysis) {
  if (stabilityBadgeNode) {
    stabilityBadgeNode.textContent = analysis.headline || analysis.state || 'STABILITY';
    stabilityBadgeNode.className = analysis.ok ? 'ok' : 'warn';
  }
  if (stabilityVerdictNode) stabilityVerdictNode.textContent = analysis.verdict || '--';
  if (stabilityNextNode) stabilityNextNode.textContent = analysis.next || '--';
  if (stabilityCardsNode) {
    stabilityCardsNode.innerHTML = analysis.cards.map((card) => `
      <article class="generator-stability-card ${card.ok ? 'ok' : 'warn'}">
        <span>${card.label}</span>
        <strong>${card.value}</strong>
        <small>${card.detail}</small>
      </article>
    `).join('');
  }
  if (stabilityHintsNode) {
    stabilityHintsNode.innerHTML = analysis.hints.map((hint) => `<li class="${hint.level || 'warn'}">${hint.text}</li>`).join('') || '<li class="ok">Žádná aktivní live varování.</li>';
  }
}

function renderStaticUiState() {
  modeBadge && (modeBadge.textContent = mode.toUpperCase());
  writer && (writer.textContent = mode === 'live' ? 'generator master' : (mode === 'preview' ? 'preview only' : 'released'));
  patchName && (patchName.textContent = patch.name || 'Generator Patch');
  setValueIfIdle(presetNameNode, patch.name || 'Generator Patch');
  $('generatorOff')?.classList.toggle('active', mode === 'off');
  $('generatorPreview')?.classList.toggle('active', mode === 'preview');
  $('generatorLive')?.classList.toggle('active', mode === 'live');
  $('generatorLive') && ($('generatorLive').textContent = mode === 'live' ? 'LIVE ON' : 'LIVE MASTER');
}

function renderStaticUi() {
  renderStaticUiState();
  renderBridgeStatus();
  updateTransitionStatus('static');
}

function smallMutation() {
  const shift = (value, amount = 0.08) => Math.max(0, Math.min(1, Number(value || 0) + (Math.random() * 2 - 1) * amount));
  const nextValues = {
    energy: shift(patch.energy, 0.06),
    density: shift(patch.density, 0.05),
    speed: shift(patch.speed, 0.04),
    colorShift: shift(patch.colorShift, 0.12),
    feedback: shift(patch.feedback, 0.05),
    warp: shift(patch.warp, 0.07),
    pulse: shift(patch.pulse, 0.05),
    shimmer: shift(patch.shimmer, 0.08)
  };
  patch = normalizeGeneratorPatch({ ...patch, ...nextValues, macros: patchValuesToMacros({ ...patch, ...nextValues }) });
  curves = normalizeGeneratorCurves({ ...curves, lanes: curves.lanes.map((lane) => nextValues[lane.id] == null ? lane : { ...lane, value: nextValues[lane.id] }) });
  resetCurveRuntime();
  renderMacros();
  renderControls();
  renderStaticUi();
  saveAll();
  log('Small mutation applied. Jen malĂ© zmÄ›ny, bez brutĂˇlnĂ­ho random pĹ™eskoku.');
}

function resetPatch() {
  graph = normalizeGeneratorGraph(createDefaultGeneratorGraph());
  curves = createDefaultGeneratorCurves();
  patch = normalizeGeneratorPatch({ ...GENERATOR_DEFAULT_PATCH, modules: graphToModuleFlags(graph), graph, macros: patchValuesToMacros(GENERATOR_DEFAULT_PATCH) });
  activePresetId = '';
  rememberActiveGeneratorPreset('');
  resetCurveRuntime();
  saveAll();
  renderModules();
  renderNodeFlow();
  renderMacros();
  renderControls();
  renderStaticUi();
  activeMusicModeId = saveGeneratorMusicMode('manual', localStorage);
  lastMusicModeMeta = { id: activeMusicModeId, enabled: musicModeRuntimeEnabled, phrasePct: 0, accent: 0 };
  renderMusicModePanel('reset');
  renderPresetBank();
  log('Patch reset.');
}

function draw(now) {
  if (now - lastSettingsFpsPollAt > 1000) {
    refreshLiveFpsFromSettings('draw-poll');
    lastSettingsFpsPollAt = now;
  }
  const time = now / 1000;
  const baseBpm = Number(patch.bpm || 145) || 145;
  const beat = time * baseBpm / 60;
  const curveTargets = evaluateGeneratorCurves(curves, time, { bpm: baseBpm, beat });
  const curveValues = smoothGeneratorCurveValues(curves, curveTargets, curveRuntime, time);
  const beatIntel = applyGeneratorBeatIntelligence(beatIntelRuntime, beatIntelConfig, curveValues, { enabled: beatIntelConfig.enabled, bpm: baseBpm, beat, time });
  beatIntelRuntime = beatIntel.runtime;
  lastBeatIntelMeta = beatIntel.meta;
  if (now - lastBeatIntelSnapshotAt > 500) {
    writeGeneratorBeatSnapshot(beatIntelRuntime, beatIntel.meta, localStorage);
    lastBeatIntelSnapshotAt = now;
  }
  const musicRuntime = applyGeneratorMusicModeRuntimeValues(activeMusicModeId, beatIntel.values, { enabled: musicModeRuntimeEnabled, bpm: baseBpm, beat, time, beatIntelligence: beatIntel.meta });
  lastMusicModeMeta = musicRuntime.meta || lastMusicModeMeta;
  graph = normalizeGeneratorGraph(graph);
  let renderGraph = graph;
  let livePatch = normalizeGeneratorPatch({ ...patch, ...musicRuntime.values, musicMode: activeMusicModeId, beatContext: beatIntel.meta, modules: graphToModuleFlags(graph), graph });
  if (sceneMorphRuntime.active) {
    const morphResult = applyGeneratorSceneMorph(sceneMorphRuntime, { patch: livePatch, graph: renderGraph, curves }, {
      time,
      now,
      beat,
      storage: localStorage,
      writeSnapshot: now - lastSceneMorphSnapshotAt > 500
    });
    sceneMorphRuntime = morphResult.runtime;
    if (now - lastSceneMorphSnapshotAt > 500) lastSceneMorphSnapshotAt = now;
    if (morphResult.state?.graph) renderGraph = normalizeGeneratorGraph(morphResult.state.graph);
    if (morphResult.state?.patch) livePatch = normalizeGeneratorPatch({ ...morphResult.state.patch, beatContext: beatIntel.meta, modules: graphToModuleFlags(renderGraph), graph: renderGraph });
    if (morphResult.done) {
      commitSceneMorphState(morphResult.state, morphResult.target);
      log(`Scene morph dokonÄŤenĂ˝: ${morphResult.target?.name || sceneMorphConfig.targetId}.`);
    }
    renderSceneMorphPanel('draw');
  }
  if (journeyRuntime.active) {
    const tick = tickGeneratorJourney(journeyRuntime, journeyConfig, {
      beat,
      sceneMorphActive: sceneMorphRuntime.active === true,
      sceneMorphDone: sceneMorphRuntime.done === true
    });
    journeyRuntime = tick.runtime;
    if (tick.action?.type === 'arm-morph') handleJourneyAction(tick.action, beat, time, 'draw');
    if (tick.action?.type === 'done') log(`Journey DONE: ${journeyConfig.name}.`);
    if (now - lastJourneySnapshotAt > 500) {
      writeGeneratorJourneySnapshot(journeyRuntime, localStorage);
      renderJourneyPanel('snapshot');
      lastJourneySnapshotAt = now;
    }
  }
  if (mode === 'preview' || mode === 'live') {
    let releaseCompleteAfterPublish = '';
    const fieldRendered = renderActiveFieldTestFrame(time);
    let rendered = fieldRendered;
    let liveRendered = null;
    if (!rendered) {
      const renderStarted = performance.now();
      rendered = renderGeneratorFrame({ patch: livePatch, graph: renderGraph, time, bpm: livePatch.bpm, beat });
      rendered.meta.renderMs = Math.max(0, performance.now() - renderStarted);
      liveRendered = rendered;
    } else if (mode === 'live' && activeFieldTest?.publish !== true) {
      const renderStarted = performance.now();
      liveRendered = renderGeneratorFrame({ patch: livePatch, graph: renderGraph, time, bpm: livePatch.bpm, beat });
      liveRendered.meta.renderMs = Math.max(0, performance.now() - renderStarted);
    } else {
      liveRendered = rendered;
    }
    if (mode === 'live' && liveRendered) {
      const transitionResult = applyGeneratorTransitionFrame(liveRendered, transitionRuntime, now, { storage: localStorage });
      liveRendered = transitionResult.rendered || liveRendered;
      transitionRuntime = transitionResult.runtime || transitionRuntime;
      if (!fieldRendered || activeFieldTest?.publish === true) rendered = liveRendered;
      if (transitionResult.done && pendingReleaseMode) {
        releaseCompleteAfterPublish = pendingReleaseMode === 'preview' ? 'preview' : 'off';
      }
      updateTransitionStatus('draw');
    }
    paintGeneratorFrameToCanvas(canvas, rendered);
    frames += 1;
    beatNode && (beatNode.textContent = (liveRendered?.meta?.beat ?? rendered.meta.beat).toFixed(2));
    if (mode === 'live') {
      const publishFieldTest = fieldRendered && activeFieldTest?.publish === true;
      const publishFrame = publishFieldTest ? rendered : liveRendered;
      const publishStarted = performance.now();
      const contextPatch = publishFieldTest ? { name: `FIELD TEST Â· ${rendered.meta.fieldTestName || rendered.meta.fieldTestType || 'frame'}` } : livePatch;
      const result = liveBridge.publish(publishFrame, { patch: contextPatch, bpm: livePatch.bpm, beat: publishFrame.meta.beat, renderMs: publishFrame.meta.renderMs });
      const publishMs = Number(result?.publishMs ?? (performance.now() - publishStarted));
      if (result?.snapshot && !result.skipped) latestBridgeSnapshot = result.snapshot;
      liveMetrics = updateGeneratorLiveMetrics(liveMetrics, { renderMs: publishFrame.meta.renderMs, publishMs, bridge: latestBridgeSnapshot });
      if (fieldRendered) {
        lastFieldTestReport = buildGeneratorFieldTestReport(activeFieldTest?.options || {}, publishFieldTest
          ? { live: true, ok: result?.ok, skipped: result?.skipped, reason: result?.reason }
          : { live: false, skipped: true, reason: 'preview-test-live-output-kept-on-generator' });
      }
      if (now - lastLivePublishAt > 500) {
        renderBridgeStatus();
        renderOperatorMetrics();
        renderLiveStabilityPanel(lastLiveTestSnapshot, 'live');
        lastLivePublishAt = now;
      }
      if (releaseCompleteAfterPublish) {
        const finalMode = releaseCompleteAfterPublish;
        pendingReleaseMode = '';
        latestBridgeSnapshot = liveBridge.stop(`release-fade-complete-${finalMode}`);
        mode = finalMode;
        transitionRuntime = createGeneratorTransitionRuntime({ width: patch.width, height: patch.height, curve: transitionConfig.curve });
        saveAll();
        log(`Release fade dokonÄŤenĂ˝, Generator ${finalMode === 'preview' ? 'zĹŻstĂˇvĂˇ v preview' : 'uvolnil Performance output'}.`);
        renderStaticUi();
        updateTransitionStatus('release-done');
      }
    } else if (now - lastHeartbeatAt > 750) {
      publishGeneratorPreviewHeartbeat({ fps: Math.round(lastFps), patch: fieldRendered ? 'FIELD TEST PREVIEW' : livePatch.name, graph: fieldRendered ? { label: rendered.meta.fieldTestName || 'field-test' } : summarizeGeneratorGraph(graph), frameSize: `${rendered.width}x${rendered.height}` });
      lastHeartbeatAt = now;
    }
  }
  pollShowOsBridge(now);
  if (now - lastLiveTestPollAt > 1600) {
    lastLiveTestPollAt = now;
    refreshLiveTestPanel('auto').catch(() => {});
  }
  if (now - lastFpsAt > 500) {
    lastFps = frames * 1000 / Math.max(1, now - lastFpsAt);
    fpsBadge && (fpsBadge.textContent = (mode === 'preview' || mode === 'live') ? String(Math.round(lastFps)) : '--');
    if (now - lastStabilityRenderAt > 1000) {
      renderLiveStabilityPanel(lastLiveTestSnapshot, 'fps');
      renderMusicModePanel('fps');
      renderBeatIntelligencePanel('fps');
      lastStabilityRenderAt = now;
    }
    frames = 0;
    lastFpsAt = now;
  }
  raf = requestAnimationFrame(draw);
}

function setupGeneratorShellControls() {
  $('generatorOff')?.addEventListener('click', () => setMode('off'));
  $('generatorPreview')?.addEventListener('click', () => setMode('preview'));
  $('generatorLive')?.addEventListener('click', () => setMode(mode === 'live' ? 'off' : 'live'));
  $('generatorRandomSmall')?.addEventListener('click', smallMutation);
  $('generatorReset')?.addEventListener('click', resetPatch);
  $('generatorSave')?.addEventListener('click', () => { saveAll(); log('Patch saved to localStorage.'); });
  $('generatorRelease')?.addEventListener('click', () => setMode('off'));
  $('generatorApplySafeScene')?.addEventListener('click', applySelectedSafeScene);
  $('generatorBlackoutFrame')?.addEventListener('click', () => publishBlackoutFrame('manual-blackout'));
  $('generatorPanicRelease')?.addEventListener('click', panicRelease);
  liveFpsSelectNode?.addEventListener('change', () => setLiveFps(liveFpsSelectNode.value));
  window.addEventListener?.('storage', (event) => {
    const key = String(event?.key || '');
    if (!key || key === 'led-engine-settings-v1' || key === 'budilightArtNetMasterMirrorFps22EJ') refreshLiveFpsFromSettings('storage');
  });
  $('generatorSavePresetAs')?.addEventListener('click', saveCurrentPreset);
  $('generatorLoadPreset')?.addEventListener('click', () => applyPreset(findGeneratorPreset(presetBank, presetSelectNode?.value || activePresetId)));
  $('generatorDeletePreset')?.addEventListener('click', deleteSelectedPreset);
  $('generatorApplyShowOs')?.addEventListener('click', () => { applyShowOsBridge('manual', { influence: 0.86 }); refreshLiveTestPanel('manual').catch(() => {}); });
  $('generatorShowOsAuto')?.addEventListener('click', () => setShowOsAutoFollow(!showOsAutoFollow));
  $('generatorShowOsIgnore')?.addEventListener('click', () => { lastShowOsSignature = showOsPayloadSignature(readShowOsBridgePayload()); updateShowOsStatus('IGNORED ONCE', 'Aktuální payload je přeskočený, další nový payload může znovu dorazit.'); });
  $('generatorOpenSettings')?.addEventListener('click', () => { location.href = 'settings.html'; });
  $('generatorOpenShowOs')?.addEventListener('click', () => { location.href = 'show-os.html'; });
  $('generatorOpenMapping')?.addEventListener('click', () => { location.href = 'mapping.html'; });
}

function setupGeneratorMonitorControls() {
  bindAsyncClick($('generatorLiveTestRefresh'), () => refreshLiveTestPanel('manual'));
  bindAsyncClick($('generatorMasterSelfTest'), runMasterSelfTest, (error) => liveTestLog(`MASTER self-test failed: ${error?.message || error}`));
  bindAsyncClick($('generatorOutputTruthRefresh'), () => refreshOutputTruthPanel('manual'), (error) => liveTestLog(`Output Truth error: ${error?.message || error}`));
  bindAsyncClick($('generatorOutputTruthCopy'), copyOutputTruthReport, (error) => liveTestLog(`Copy Output Truth error: ${error?.message || error}`));
  $('generatorStabilityRefresh')?.addEventListener('click', () => renderLiveStabilityPanel(lastLiveTestSnapshot, 'manual'));
  bindAsyncClick($('generatorStabilityCopy'), copyLiveStabilityReport, (error) => liveTestLog(`Copy Stability error: ${error?.message || error}`));
  bindAsyncClick(transitionReportNode, copyTransitionReport, (error) => liveTestLog(`Copy Transition error: ${error?.message || error}`));
  bindAsyncClick(musicModeReportNode, copyMusicModeReport, (error) => log(`Music report error: ${error?.message || error}`));
  bindAsyncClick($('generatorBeatIntelCopy'), copyBeatIntelligenceReport, (error) => log(`Beat report error: ${error?.message || error}`));
  bindAsyncClick(sceneMorphReportNode, copySceneMorphReport, (error) => log(`Scene morph report error: ${error?.message || error}`));
  bindAsyncClick(journeyReportNode, copyJourneyReport, (error) => log(`Journey report error: ${error?.message || error}`));
  bindAsyncClick(midiConnectNode, () => connectMidi('manual'), (error) => log(`MIDI connect error: ${error?.message || error}`));
  bindAsyncClick(midiReportNode, copyMidiReport, (error) => log(`MIDI report error: ${error?.message || error}`));
  bindAsyncClick($('generatorFieldTestCopy'), copyFieldTestReport, (error) => log(`Field test copy error: ${error?.message || error}`));
}

function setupGeneratorFormControls() {
  transitionTakeoverNode?.addEventListener('change', () => updateTransitionConfig({ takeoverMs: Number(transitionTakeoverNode.value || 0) }));
  transitionReleaseNode?.addEventListener('change', () => updateTransitionConfig({ releaseMs: Number(transitionReleaseNode.value || 0) }));
  transitionCurveNode?.addEventListener('change', () => updateTransitionConfig({ curve: transitionCurveNode.value || 'smooth' }));
  $('generatorApplyMusicMode')?.addEventListener('click', () => applySelectedMusicMode());
  musicModeRuntimeNode?.addEventListener('click', () => setMusicModeRuntime(!musicModeRuntimeEnabled));
  $('generatorDropNow')?.addEventListener('click', () => applySelectedMusicMode('drop'));
  $('generatorBuildNow')?.addEventListener('click', () => applySelectedMusicMode('build'));
  beatIntelEnabledNode?.addEventListener('click', toggleBeatIntelligence);
  $('generatorBeatTap')?.addEventListener('click', tapBeatIntelligence);
  $('generatorBeatPhraseReset')?.addEventListener('click', resetBeatPhrase);
  $('generatorBeatDropMark')?.addEventListener('click', markBeatDrop);
  beatIntelPhraseBeatsNode?.addEventListener('change', () => updateBeatIntelligenceConfig({ phraseBeats: Number(beatIntelPhraseBeatsNode.value || beatIntelConfig.phraseBeats) }));
  beatIntelAccentAmountNode?.addEventListener('input', () => updateBeatIntelligenceConfig({ accentAmount: Number(beatIntelAccentAmountNode.value || beatIntelConfig.accentAmount) }));
  beatIntelDropHoldNode?.addEventListener('change', () => updateBeatIntelligenceConfig({ dropHoldBeats: Number(beatIntelDropHoldNode.value || beatIntelConfig.dropHoldBeats) }));
  $('generatorSceneMorphArm')?.addEventListener('click', armSelectedSceneMorph);
  $('generatorSceneMorphCancel')?.addEventListener('click', () => cancelSceneMorph('operator-cancel'));
  sceneMorphTargetNode?.addEventListener('change', () => updateSceneMorphConfig({ targetId: sceneMorphTargetNode.value }));
  sceneMorphDurationNode?.addEventListener('change', () => updateSceneMorphConfig());
  sceneMorphTimeModeNode?.addEventListener('change', () => updateSceneMorphConfig({ timeMode: sceneMorphTimeModeNode.value }));
  sceneMorphCurveNode?.addEventListener('change', () => updateSceneMorphConfig({ curve: sceneMorphCurveNode.value }));
  sceneMorphCommitNode?.addEventListener('change', () => updateSceneMorphConfig({ commitOnDone: sceneMorphCommitNode.checked }));
  $('generatorJourneyLoad')?.addEventListener('click', loadSelectedJourney);
  $('generatorJourneyStart')?.addEventListener('click', startJourney);
  $('generatorJourneyStop')?.addEventListener('click', () => stopJourney('operator-stop'));
  journeySelectNode?.addEventListener('change', loadSelectedJourney);
  journeyLoopNode?.addEventListener('change', () => updateJourneyConfig({ loop: journeyLoopNode.checked }));
  journeyAutoPreviewNode?.addEventListener('change', () => updateJourneyConfig({ autoPreview: journeyAutoPreviewNode.checked }));
  journeyCommitNode?.addEventListener('change', () => updateJourneyConfig({ commitOnStepDone: journeyCommitNode.checked }));
  midiRefreshNode?.addEventListener('click', () => { attachMidiInput(); renderMidiPanel('refresh'); });
  midiEnableNode?.addEventListener('click', () => setMidiEnabled(!midiConfig.enabled));
  midiInputSelectNode?.addEventListener('change', () => {
    midiConfig = saveGeneratorMidiConfig({ ...midiConfig, inputId: midiInputSelectNode.value || 'auto' }, localStorage);
    attachMidiInput();
  });
  midiLearnNode?.addEventListener('click', () => {
    const action = midiLearnActionNode?.value || 'macro:0';
    midiConfig = saveGeneratorMidiConfig({ ...midiConfig, learnAction: midiConfig.learnAction ? '' : action }, localStorage);
    renderMidiPanel('learn');
    log(midiConfig.learnAction ? `MIDI learn armed pro ${midiConfig.learnAction}. Pohní ovladačem nebo zmáčkni pad.` : 'MIDI learn vypnutý.');
  });
  midiResetNode?.addEventListener('click', () => {
    midiConfig = resetGeneratorMidiMappings(localStorage);
    renderMidiPanel('reset');
    log('MIDI mapování resetované na APC/generic defaults.');
  });
  presetSelectNode?.addEventListener('change', () => {
    activePresetId = presetSelectNode.value || '';
    rememberActiveGeneratorPreset(activePresetId);
  });
  presetNameNode?.addEventListener('change', () => {
    const name = String(presetNameNode.value || '').trim();
    if (name) {
      patch = normalizeGeneratorPatch({ ...patch, name });
      saveAll();
      renderStaticUi();
    }
  });
  menuBtn?.addEventListener('click', () => centerMenu?.classList.toggle('open'));
  menuFullscreen?.addEventListener('click', async () => { await toggleFullscreen(); syncFullscreenButtonLabel(menuFullscreen); });
  document.querySelectorAll('[data-href]').forEach((button) => button.addEventListener('click', () => {
    const href = button.dataset.href;
    if (href) location.href = href;
  }));
  document.querySelectorAll('[data-nav-href]').forEach((button) => button.addEventListener('click', () => {
    const href = button.dataset.navHref;
    if (href) location.href = href;
  }));
}

function bind() {
  setupGeneratorShellControls();
  setupGeneratorMonitorControls();
  setupGeneratorFormControls();
}

function setupNodeGraphControls() {
  populateNodeCatalog();
  nodeAddNode?.addEventListener('click', addSelectedNode);
  nodeClearSoloNode?.addEventListener('click', clearNodeSolo);
  nodeCopyReportNode?.addEventListener('click', copyNodeGraphReport);
}

function boot() {
  if (mode === 'live') mode = 'off';
  curves = normalizeGeneratorCurves(curves);
  updatePatchMacrosFromValues();
  renderPresetBank();
  renderSafeSceneBank();
  renderFieldTestControls();
  renderMusicModePanel('boot');
  renderBeatIntelligencePanel('boot');
  renderSceneMorphPanel('boot');
  renderJourneyPanel('boot');
  renderMidiPanel('boot');
  setupNodeGraphControls();
  refreshLiveFpsFromSettings('boot');
  refreshLiveFpsFromServer('boot').catch(() => {});
  renderLiveFpsUi();
  renderModules();
  renderNodeFlow();
  renderMacros();
  renderControls();
  renderStaticUi();
  bind();
  applyFullscreenPreference(localStorage.getItem('led-fullscreen-preferred-v1') === 'true');
  syncFullscreenButtonLabel(menuFullscreen);
  updateShowOsStatus(showOsAutoFollow ? 'AUTO ARMED' : 'READY', 'SHOW OS bridge mĹŻĹľe Ĺ™Ă­dit makra, kĹ™ivky a node graph pĹ™es APPLY nebo AUTO FOLLOW.');
  log(`${STEP_VERSION} ready. Bridge ${GENERATOR_BRIDGE_VERSION}. Presets ${GENERATOR_PRESETS_VERSION}. Graph ${GENERATOR_GRAPH_VERSION}. ShowOS ${GENERATOR_SHOWOS_BRIDGE_VERSION}. LiveTest ${GENERATOR_LIVE_TEST_PANEL_VERSION}. LiveOps ${GENERATOR_LIVE_OPS_VERSION}. OutputTruth ${GENERATOR_OUTPUT_TRUTH_PANEL_VERSION}. FieldTests ${GENERATOR_FIELD_TEST_VERSION}. SettingsFps ${GENERATOR_SETTINGS_FPS_VERSION}. Stability ${GENERATOR_LIVE_STABILITY_VERSION}. Transition ${GENERATOR_TRANSITION_VERSION}. MusicModes ${GENERATOR_MUSIC_MODES_VERSION}. SceneMorph ${GENERATOR_SCENE_MORPH_VERSION}. Journey ${GENERATOR_JOURNEY_TIMELINE_VERSION}. MIDI ${GENERATOR_MIDI_APC_VERSION}.`);
  log('Node graph: source â†’ modifier â†’ color â†’ fx â†’ output. KaĹľdĂ˝ blok mĂˇ enable, mix, intensity a poĹ™adĂ­.');
  renderLiveTestPanel();
  renderOutputTruthPanel();
  renderLiveStabilityPanel(null, 'boot');
  updateTransitionStatus('boot');
  refreshLiveTestPanel('boot').catch(() => {});
  try { window.parent?.postMessage({ type: 'led-ui-ready', detail: { page: 'generator', version: 'STEP38U' } }, '*'); } catch {}
  raf = requestAnimationFrame(draw);
}

window.addEventListener('storage', (event) => {
  if (!showOsAutoFollow) return;
  if (event?.key === 'budilight.performance.bridge.pro' || event?.key === 'budilight.showos.intent') applyShowOsBridge('storage', { influence: 0.40 });
});

window.addEventListener('beforeunload', () => {
  try { liveBridge.stop('page-unload'); } catch {}
  cancelAnimationFrame(raf);
});
boot();


