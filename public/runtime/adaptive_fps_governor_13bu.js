/* STEP 13BU: Adaptive FPS Governor Foundation
   Diagnostics-first governor:
   - reads FrameBus gates + lag compare + output pressure
   - computes recommended load level
   - exposes window.__ledAdaptiveGovernor
   - does NOT force render/output FPS yet
   - safe foundation for later controlled application
*/
(function(){
  const VERSION = "13BU-K-runtime-debug-governor-visibility";

  function isShellViewOnly(){
    try {
      const params = new URLSearchParams(location.search || '');
      return params.get('shellView') === '1' && params.get('headless') !== '1';
    } catch {
      return false;
    }
  }
  let level = 0; // 0 normal, 1 light reduce, 2 medium, 3 heavy
  let lastReason = "init";
  let lastChangedAt = performance.now();
  let lastEvalAt = 0;
  let stableOkSince = 0;
  const history = [];
  const softState = {
    version: "13BU-E",
    active: false,
    appliedLevel: 0,
    recommendations: null,
    updatedAt: 0
  };
  let lastSoftDispatchAt = 0;
  let lastSoftDispatchKey = "";
  let lastStatsDispatchAt = 0;
  let lastStatsDispatchKey = "";

  const guard = {
    version: "13BU-E",
    minLevelHoldMsNormal: 2500,
    minLevelHoldMsRaspi: 4500,
    recoveryHoldMsNormal: 4500,
    recoveryHoldMsRaspi: 7500,
    maxStepUpPerEval: 1,
    maxStepDownPerRecovery: 1,
    lastBlockedReason: "none",
    blockedCount: 0
  };

  function now(){ return performance.now(); }
  function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }
  function shouldDispatch(kind, key, minIntervalMs){
    const t = now();
    if(kind === "soft"){
      if(key === lastSoftDispatchKey && t - lastSoftDispatchAt < minIntervalMs) return false;
      lastSoftDispatchKey = key;
      lastSoftDispatchAt = t;
      return true;
    }
    if(key === lastStatsDispatchKey && t - lastStatsDispatchAt < minIntervalMs) return false;
    lastStatsDispatchKey = key;
    lastStatsDispatchAt = t;
    return true;
  }
  function settings(){
    try { return JSON.parse(localStorage.getItem("led-engine-settings-v1") || "{}") || {}; }
    catch { return {}; }
  }
  function runtimeMode(){
    const profile = window.RUNTIME_PROFILE || {};
    const s = settings();
    const authority = window.__ledRuntimeModeAuthority?.get?.() || {};
    const mode = String(authority.mode || profile.mode || (profile.raspi ? "raspi-safe" : "normal")).toLowerCase();
    const raspi = mode !== "normal";
    const adaptive = String(profile.adaptiveFpsMode || s.adaptiveFpsMode || "off").toLowerCase();
    return { profile, raspi, adaptive, mode };
  }

  function applyMode(){
    const mode = runtimeMode();
    const s = settings();
    // Modes:
    // observe  = compute only, no application
    // soft-ui  = preview/shader/thumb/debug soft apply; output unchanged
    // protect-output = reserved for future; currently treated as soft-ui
    const raw = String(s.adaptiveApplyMode || mode.profile.adaptiveApplyMode || "soft-ui").toLowerCase();
    if(["observe", "soft-ui", "protect-output"].includes(raw)) return raw;
    return "soft-ui";
  }

  function canApplySoftUi(modeName){
    return modeName === "soft-ui" || modeName === "protect-output";
  }

  function canProtectOutput(modeName){
    // 13BU-F only declares the mode. It does not protect/block output yet.
    return false;
  }

  function scoreInputs(){
    const fb = window.__ledFrameBusStats || window.__ledFrameBus?.getStats?.() || {};
    const lag = window.__ledFrameBusLagCompare || {};
    const out = window.__ledOutputPipelineStats || {};
    const gate = window.__ledOutputConsumerGate || {};
    const thumb = window.__ledThumbQueueStats || {};
    let score = 0;
    const reasons = [];

    const gateStatus = String(gate.gateStatus || fb.gates?.status || fb.health || "").toUpperCase();
    const lagSeverity = String(lag.severity || "").toUpperCase();
    const outHealth = String(out.health || "").toUpperCase();
    const outPressure = String(out.pressure || "").toUpperCase();

    if(gateStatus === "ERROR") { score += 4; reasons.push("gate-error"); }
    else if(gateStatus === "WARN") { score += 2; reasons.push("gate-warn"); }

    if(lagSeverity === "ERROR") { score += 4; reasons.push(`lag-error:${lag.bottleneck || "unknown"}`); }
    else if(lagSeverity === "WARN") { score += 2; reasons.push(`lag-warn:${lag.bottleneck || "unknown"}`); }

    if(outHealth === "ERROR" || outHealth === "PRESSURE") { score += 3; reasons.push(`output-${outHealth.toLowerCase()}`); }
    if(outPressure === "HIGH") { score += 3; reasons.push("output-pressure-high"); }
    else if(outPressure === "MED") { score += 1; reasons.push("output-pressure-med"); }

    if(Number(out.droppedFps || 0) > 5) { score += 3; reasons.push("dropfps-high"); }
    else if(Number(out.droppedFps || 0) > 0.5) { score += 1; reasons.push("dropfps-med"); }

    if(Number(thumb.queueLength || 0) > 48) { score += 2; reasons.push("thumb-queue"); }

    const frameAge = Number(fb.lastFrameAgeMs || 0);
    if(frameAge > 1500) { score += 4; reasons.push("frame-stale"); }
    else if(frameAge > 350) { score += 2; reasons.push("frame-warn"); }

    return { score, reasons, fb, lag, out, gate, thumb, gateStatus, lagSeverity, outHealth, outPressure };
  }

  function levelFromScore(score){
    if(score >= 8) return 3;
    if(score >= 5) return 2;
    if(score >= 2) return 1;
    return 0;
  }

  function recommendations(baseProfile, raspi, lvl){
    const basePreview = Number(baseProfile.previewFps || (raspi ? 24 : 30));
    const baseShader = Number(baseProfile.shaderPreviewFps || (raspi ? 18 : 30));
    const baseGallery = Number(baseProfile.galleryFps || (raspi ? 12 : 18));
    const baseThumb = Number(baseProfile.thumbnailFps || (raspi ? 8 : 12));
    const factors = [1, 0.75, 0.55, 0.38];
    const f = factors[clamp(lvl,0,3)] || 1;
    return {
      level: lvl,
      previewFps: Math.max(8, Math.round(basePreview * f)),
      shaderPreviewFps: Math.max(6, Math.round(baseShader * f)),
      galleryFps: Math.max(4, Math.round(baseGallery * f)),
      thumbnailFps: Math.max(2, Math.round(baseThumb * f)),
      debugRefreshMs: Math.round(Number(baseProfile.debugRefreshMs || (raspi ? 1000 : 350)) * (lvl ? 1 + lvl * 0.45 : 1)),
      uiRefreshMs: Math.round(Number(baseProfile.uiRefreshMs || (raspi ? 250 : 100)) * (lvl ? 1 + lvl * 0.25 : 1))
    };
  }

  function applySoftRecommendations(stats) {
    const mode = runtimeMode();
    const modeName = applyMode();
    const allow = stats.enabled && mode.mode !== "normal" && mode.adaptive !== "off" && canApplySoftUi(modeName);
    const rec = allow ? stats.recommendations : recommendations(mode.profile || {}, mode.raspi, 0);
    softState.active = allow && Number(stats.level || 0) > 0;
    softState.appliedLevel = allow ? Number(stats.level || 0) : 0;
    softState.applyMode = modeName;
    softState.outputProtected = canProtectOutput(modeName);
    softState.recommendations = rec;
    softState.updatedAt = now();

    window.__ledAdaptiveSoftState = { ...softState, runtimeProfileRevision: mode.profile?.runtimeProfileRevision || 0, runtimePreset: mode.profile?.runtimePreset || (mode.raspi ? "raspi-safe" : "normal") };

    // Do not alter serial/output FPS here. This is UI/render load guidance only.
    const eventDetail = {
      ...window.__ledAdaptiveSoftState,
      applyMode: modeName,
      outputProtected: canProtectOutput(modeName),
      note: modeName === "observe" ? "observe only; no FPS applied" : "soft guidance only; output FPS unchanged"
    };
    try {
      const dispatchKey = [
        Number(eventDetail?.active ? 1 : 0),
        Number(eventDetail?.appliedLevel || 0),
        Number(eventDetail?.recommendations?.previewFps || 0),
        Number(eventDetail?.recommendations?.shaderPreviewFps || 0),
        Number(eventDetail?.recommendations?.thumbnailFps || 0),
        String(eventDetail?.applyMode || "")
      ].join("|");
      if (shouldDispatch("soft", dispatchKey, Math.max(500, Number(mode.profile?.adaptiveSoftDispatchMs || 1000)))) {
        window.dispatchEvent(new CustomEvent("led-adaptive-soft-state", { detail: eventDetail }));
      }
    } catch {}

    return eventDetail;
  }

  function evaluate(force=false){
    const t = now();
    if(!force && t - lastEvalAt < 500) return window.__ledAdaptiveGovernorStats;
    lastEvalAt = t;

    const mode = runtimeMode();
    const input = scoreInputs();
    const enabled = mode.mode !== "normal" && mode.adaptive !== "off";
    const targetLevel = enabled ? levelFromScore(input.score) : 0;

    // 13BU-E guarded hysteresis:
    // - level can rise quickly, but only one step per evaluation
    // - level can fall only after stable OK hold time
    // - prevents fast oscillation when pressure flickers
    const levelAgeMs = t - Number(lastChangedAt || 0);
    const minLevelHoldMs = mode.raspi ? guard.minLevelHoldMsRaspi : guard.minLevelHoldMsNormal;
    const recoveryHoldMs = mode.raspi ? guard.recoveryHoldMsRaspi : guard.recoveryHoldMsNormal;

    if(targetLevel > level) {
      const nextLevel = Math.min(targetLevel, level + guard.maxStepUpPerEval);
      level = nextLevel;
      lastReason = input.reasons.join(",") || "pressure";
      lastChangedAt = t;
      stableOkSince = 0;
      guard.lastBlockedReason = "none";
    } else if(targetLevel < level) {
      if(input.score === 0) {
        if(!stableOkSince) stableOkSince = t;
        const stableFor = t - stableOkSince;
        if(stableFor > recoveryHoldMs && levelAgeMs > minLevelHoldMs) {
          level = Math.max(0, level - guard.maxStepDownPerRecovery);
          lastReason = "stable-recovery-guarded";
          lastChangedAt = t;
          stableOkSince = t;
          guard.lastBlockedReason = "none";
        } else {
          guard.blockedCount += 1;
          guard.lastBlockedReason = `recovery-hold stable=${Math.round(stableFor)}ms levelAge=${Math.round(levelAgeMs)}ms`;
        }
      } else {
        stableOkSince = 0;
        guard.blockedCount += 1;
        guard.lastBlockedReason = "target-lower-but-pressure-still-present";
      }
    } else if(input.score === 0 && !stableOkSince) {
      stableOkSince = t;
      guard.lastBlockedReason = "none";
    }

    const rec = recommendations(mode.profile || {}, mode.raspi, level);
    const stats = {
      version: VERSION,
      enabled,
      mode: String(mode.mode || (mode.raspi ? "raspi-safe" : "normal")).toUpperCase(),
      runtimePreset: mode.profile.runtimePreset || (mode.raspi ? "raspi-safe" : "normal"),
      adaptiveMode: mode.adaptive,
      applyMode: applyMode(),
      level,
      targetLevel,
      score: input.score,
      reasons: input.reasons,
      lastReason,
      changedAgoMs: Math.round(t - lastChangedAt),
      stableOkForMs: stableOkSince ? Math.round(t - stableOkSince) : 0,
      guard: {
        ...guard,
        lastBlockedReason: guard.lastBlockedReason,
        blockedCount: guard.blockedCount,
        levelAgeMs: Math.round(t - Number(lastChangedAt || t))
      },
      recommendations: rec,
      observed: {
        gateStatus: input.gateStatus,
        lagSeverity: input.lagSeverity,
        bottleneck: input.lag?.bottleneck || "none",
        outputHealth: input.outHealth,
        outputPressure: input.outPressure,
        droppedFps: Number(input.out?.droppedFps || 0),
        frameAgeMs: Number(input.fb?.lastFrameAgeMs || 0),
        thumbQueue: Number(input.thumb?.queueLength || 0)
      },
      note: "soft guidance active; output FPS unchanged"
    };

    const soft = applySoftRecommendations(stats);
    stats.soft = soft;

    history.push({ at: Date.now(), level, score: input.score, reasons: input.reasons.slice(0,4), rec });
    while(history.length > 80) history.shift();

    window.__ledAdaptiveGovernorStats = stats;
    try {
      const dispatchKey = [
        Number(stats.level || 0),
        Number(stats.targetLevel || 0),
        Number(stats.score || 0),
        String(stats.observed?.gateStatus || ""),
        String(stats.observed?.outputPressure || ""),
        String(stats.observed?.outputHealth || ""),
        String(stats.lastReason || "")
      ].join("|");
      if (shouldDispatch("stats", dispatchKey, Math.max(500, Number(mode.profile?.adaptiveStatsDispatchMs || 1000)))) {
        window.dispatchEvent(new CustomEvent("led-adaptive-governor-stats", { detail: stats }));
      }
    } catch {}
    return stats;
  }

  window.__ledAdaptiveGovernor = {
    version: VERSION,
    evaluate,
    getStats: () => evaluate(true),
    getHistory: () => history.slice(),
    getSoftState: () => ({ ...softState }),
    reset: () => {
      level = 0;
      lastReason = "manual-reset";
      lastChangedAt = now();
      stableOkSince = 0;
      guard.lastBlockedReason = "manual-reset";
      guard.blockedCount = 0;
      history.length = 0;
      return evaluate(true);
    }
  };

  if (isShellViewOnly()) {
    const passive = {
      version: VERSION + "-SHELL_VIEW_PASSIVE_37BJ",
      level: 0,
      reason: "hidden-runner-owns-output-governor",
      updatedAt: now(),
      shellViewPassive: true
    };
    try { window.__ledAdaptiveGovernorStats = passive; } catch {}
    return;
  }
  window.addEventListener("led-framebus-stats", () => evaluate());
  window.addEventListener("led-output-consumer-gate", () => evaluate());
  window.addEventListener("led-output-pipeline-stats", () => evaluate());
  document.addEventListener("DOMContentLoaded", () => {
    evaluate(true);
    // STEP37DG: FPS governor evaluation is control-plane housekeeping, not the
    // physical output scheduler. Run it via the shared adaptive registry so it
    // backs off while live output is active or the shell view is hidden.
    try {
      const loops = window.__budilightRuntimeLoopRegistry37CE;
      if (loops && typeof loops.adaptiveInterval === "function") {
        loops.adaptiveInterval("adaptive-fps:evaluate", () => evaluate(), 1000, {
          group: "fps-governor",
          liveFactor: 2,
          hiddenFactor: 5,
          maxMs: 8000
        });
      } else {
        setInterval(() => evaluate(), 1000);
      }
    } catch {
      try { setInterval(() => evaluate(), 1000); } catch {}
    }
  });
})();
