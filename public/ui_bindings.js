export function createUiBindings(deps) {
  const {
    controls,
    state,
    tapBpm,
    syncControls,
    commitState,
    randomizeSingleFile,
    resetBeat,
    setMasterFlash,
    numberValue,
    applyRangeVisual,
    stepFile,
    byId,
    randomizeLayerParams,
    bindCheckbox,
    layerButtons,
    normalizeManualPaletteActive,
    colorFromWheelEvent,
    cloneLayerState,
    startLayerTransition,
    captureLayerModules,
    getPreviewMode,
    setPreviewMode,
    cyclePixelPreviewMode,
    cycleShaderPreviewMode,
    documentRef = document
  } = deps;

  function bindPerformancePads() {
    controls.perfPadTap?.addEventListener("click", tapBpm);

    controls.perfPadSync?.addEventListener("click", () => {
      try {
        if (window.BudiQuickStepAutomator?.syncBeat) {
          window.BudiQuickStepAutomator.syncBeat();
          return;
        }
      } catch {}
      try { window.syncBeatToNearestDownbeat?.(16); } catch {}
    });

    controls.perfPadBeatReset?.addEventListener("click", () => {
      resetBeat();
      try { window.BudiQuickStepAutomator?.resetBeat?.(); } catch {}
    });

    const setBpmRatio = (ratio) => {
      const current = Number(state.bpm) || 120;
      state.bpm = Math.max(20, Math.min(300, Math.round(current * ratio * 10) / 10));
      syncControls();
      commitState();
    };
    controls.perfPadHalfSpeed?.addEventListener("click", () => setBpmRatio(0.5));
    controls.perfPadDoubleSpeed?.addEventListener("click", () => setBpmRatio(2));

    let dropPadBusyUntil = 0;
    let dropPadCommitTimer = 0;
    let dropPadInFlight = false;
    const randomizeLayerParamsLiveSafe = (layer) => {
      const layerState = state?.[layer];
      if (!layerState?.params) return;
      let previousModules = null;
      let previousState = null;
      try { previousModules = captureLayerModules?.(layer); } catch {}
      try { previousState = cloneLayerState?.(layerState); } catch {}
      for (let index = 0; index < layerState.params.length; index += 1) {
        // Same musical range as core randomParam without forcing syncControls/commitState.
        layerState.params[index] = Math.round((0.12 + Math.random() * 0.76) * 100) / 100;
      }
      if (previousModules && previousState) {
        try { startLayerTransition?.(layer, previousModules, previousState); } catch {}
      }
    };

    controls.perfPadDrop?.addEventListener("click", () => {
      // STEP37DY: DROP is intentionally non-stackable. Repeated taps used to queue
      // several L1/L2 dynamic imports and deferred warmups; the UI then looked OK
      // for a moment and froze for many seconds. Extra presses during the guard
      // window are ignored instead of queued.
      const now = performance.now();
      if (dropPadInFlight || now < dropPadBusyUntil) return;
      dropPadInFlight = true;
      dropPadBusyUntil = now + 1150;
      controls.perfPadDrop.classList.add("active");
      window.setTimeout(() => controls.perfPadDrop?.classList.remove("active"), 160);

      const fireSwitch = (layer, listKey, delayMs) => {
        window.setTimeout(() => {
          try {
            randomizeSingleFile(layer, "animFile", listKey, `${layer}_anims`, "anim", {
              warmup: false,
              coalesce: true,
              dropIfBusy: true,
              debounceMs: 0,
              ui: false,
              commit: false,
              commitDelayMs: 0
            });
          } catch (error) {
            console.warn("DROP randomize failed", layer, error);
          }
        }, delayMs);
      };

      fireSwitch("l1", "l1Anims", 0);
      fireSwitch("l2", "l2Anims", 24);

      try {
        requestAnimationFrame(() => {
          try { randomizeLayerParamsLiveSafe("l1"); } catch {}
          try { randomizeLayerParamsLiveSafe("l2"); } catch {}
          if (dropPadCommitTimer) window.clearTimeout(dropPadCommitTimer);
          dropPadCommitTimer = window.setTimeout(() => {
            dropPadCommitTimer = 0;
            try { commitState(); } catch {}
          }, 700);
        });
      } catch {
        try { randomizeLayerParamsLiveSafe("l1"); randomizeLayerParamsLiveSafe("l2"); } catch {}
      }
      window.setTimeout(() => { dropPadInFlight = false; }, 1150);
    });

    function publishBlackFrame() {
      try {
        const stats = window.__ledFrameBus?.getStats?.() || window.__ledFrameBusStats || {};
        const width = Math.max(1, Number(stats.width || 300) || 300);
        const height = Math.max(1, Number(stats.height || 8) || 8);
        const frame = new Uint8Array(width * height * 3);
        const frameId = Number(window.__budilightBlackoutFrameId || 0) + 1;
        window.__budilightBlackoutFrameId = frameId;
        window.__ledFrameBus?.publishFrame?.({
          frame,
          width,
          height,
          frameId,
          source: "performance-pad-blackout",
          producer: "performance-pads",
          colorOrder: "rgb",
          format: "rgb8",
          meta: { outputEnabled: true, blackout: true, reason: "pad-blackout" }
        });
      } catch {}
      try {
        fetch("/api/artnet/sync-live/blackout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source: "performance-pad-blackout", reason: "pad-blackout", force: true })
        }).catch(() => {});
      } catch {}
    }

    function setFxFlash(key, active) {
      if (!state[key]) return;
      if (state[key].flash === active) return;
      state[key].flash = active;
      syncControls();
      commitState();
    }

    function bindMomentaryPad(button, onDown, onUp = null) {
      button?.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        button.classList.add("active");
        onDown?.();
      });
      ["pointerup", "pointercancel", "pointerleave"].forEach((eventName) => {
        button?.addEventListener(eventName, () => {
          button.classList.remove("active");
          onUp?.();
        });
      });
    }

    function triggerPadAction(action) {
      if (action === "tapBpm") return tapBpm();
      if (action === "perfPadSync") return controls.perfPadSync?.click();
      if (action === "perfPadBeatReset") return controls.perfPadBeatReset?.click();
      if (action === "perfPadHalfSpeed") return controls.perfPadHalfSpeed?.click();
      if (action === "perfPadDoubleSpeed") return controls.perfPadDoubleSpeed?.click();
      if (action === "perfPadDrop") return controls.perfPadDrop?.click();
      if (action === "perfPadBlackout") {
        publishBlackFrame();
        return;
      }
      const flashMap = { perfPadL1Fx: "fx1", perfPadL2Fx: "fx2", perfPadMasterFx1: "fxMaster", perfPadMasterFx2: "fxMaster2" };
      const key = flashMap[action];
      if (key) {
        setFxFlash(key, true);
        window.setTimeout(() => setFxFlash(key, false), 120);
      }
    }
    window.__budilightTriggerPadAction = triggerPadAction;

    bindMomentaryPad(controls.perfPadBlackout, () => {
      // Momentary blackout: publish a black frame only, never switch LED/output off.
      publishBlackFrame();
    });
    bindMomentaryPad(controls.perfPadL1Fx, () => setFxFlash("fx1", true), () => setFxFlash("fx1", false));
    bindMomentaryPad(controls.perfPadL2Fx, () => setFxFlash("fx2", true), () => setFxFlash("fx2", false));
    bindMomentaryPad(controls.perfPadStrobe, () => setMasterFlash(true), () => setMasterFlash(false));
    bindMomentaryPad(controls.perfPadMasterFx2, () => setFxFlash("fxMaster2", true), () => setFxFlash("fxMaster2", false));
  }

  function bindPreviewTabs() {
    let lastNonDebugPreviewMode = "pixel";
    let shaderPreviewZoomed = false;
    const applyShaderPreviewZoomClass = () => {
      documentRef?.body?.classList?.toggle("shader-preview-zoom-1to1", shaderPreviewZoomed);
    };
    const notifyPreviewModeChanged = (reason, previousMode) => {
      try {
        window.dispatchEvent(new CustomEvent("led-preview-mode-changed", {
          detail: {
            reason,
            previousMode: String(previousMode || "pixel"),
            mode: String(getPreviewMode?.() || "pixel"),
            datasetMode: String(documentRef?.body?.dataset?.previewMode || "")
          }
        }));
      } catch {}
    };

    // STEP37AS: preview navigation must be a UI-only fast path while physical
    // output is running. Persisting/committing this tiny tab state can wake the
    // websocket/state-store pipeline and steal time from the output frame.
    const liveOutputActiveForPreviewNav = () => {
      try {
        const lock = window.__budilightOutputLock37AP;
        if (lock?.active === true) return true;
      } catch {}
      try {
        const mirror = window.__budilightArtnetMasterFramebusMirror22EJ || window.__artnetMasterFramebusMirror22EJ;
        if (mirror?.enabled === true || mirror?.state?.enabled === true) return true;
      } catch {}
      try {
        const serial = window.__budilightLiveSerialAppMirror22CR || window.__liveSerialAppMirror22CR;
        if (serial?.state?.enabled === true || serial?.enabled === true) return true;
      } catch {}
      return false;
    };

    let previewSyncPending = false;
    const schedulePreviewUiSync = () => {
      if (previewSyncPending) return;
      previewSyncPending = true;
      const run = () => {
        previewSyncPending = false;
        try { syncControls(); } catch {}
      };
      try { requestAnimationFrame(run); } catch { setTimeout(run, 0); }
    };

    const maybeCommitPreviewMode = () => {
      if (liveOutputActiveForPreviewNav()) {
        try {
          window.__budilightPreviewNavFastPath37AS = {
            version: "STEP37AS",
            skippedCommits: Number(window.__budilightPreviewNavFastPath37AS?.skippedCommits || 0) + 1,
            lastAt: Date.now(),
            reason: "live-output-ui-only"
          };
        } catch {}
        return;
      }
      try { commitState(); } catch {}
    };
    (controls.previewTabs || []).forEach((button) => {
      if (!button || button.dataset.previewTabBound === "1") return;
      button.dataset.previewTabBound = "1";
      button.addEventListener("click", () => {
        const mode = getPreviewMode?.() || "pixel";
        let shouldCommit = true;
        let changedReason = "preview-tab";
        if (button.id === "previewTabPixel") {
          shaderPreviewZoomed = false;
          applyShaderPreviewZoomClass();
          if (mode === "pixel") {
            cyclePixelPreviewMode?.();
            changedReason = "pixel-size-cycle";
          } else {
            setPreviewMode?.("pixel");
            changedReason = "pixel-select";
          }
          lastNonDebugPreviewMode = "pixel";
          schedulePreviewUiSync();
          maybeCommitPreviewMode();
          notifyPreviewModeChanged(changedReason, mode);
          return;
        }

        if (button.id === "previewTabStage") {
          shaderPreviewZoomed = false;
          applyShaderPreviewZoomClass();
          setPreviewMode?.("stage");
          lastNonDebugPreviewMode = "stage";
          changedReason = "stage-select";
        }
        if (button.id === "previewTabShader") {
          // STEP37Z: SHADER tab behaves like PIXEL. First click selects shader,
          // repeated clicks toggle BIG/SMALL and force canvas resize/repaint.
          shaderPreviewZoomed = false;
          applyShaderPreviewZoomClass();
          if (mode === "shader") {
            cycleShaderPreviewMode?.();
            changedReason = "shader-size-cycle";
          } else {
            setPreviewMode?.("shader");
            changedReason = "shader-select";
          }
          lastNonDebugPreviewMode = "shader";
        }
        if (button.id === "previewTabDebug") {
          if (mode === "debug") {
            setPreviewMode?.(lastNonDebugPreviewMode || "pixel");
            changedReason = "debug-close";
          } else {
            lastNonDebugPreviewMode = mode === "debug" ? (lastNonDebugPreviewMode || "pixel") : mode;
            setPreviewMode?.("debug");
            changedReason = "debug-open";
            // STEP 13BH: force one immediate DEBUG render. The regular interval
            // can be slowed by RasPi/adaptive profile, but clicking DEBUG should
            // populate the panel immediately in NORMAL mode too.
            setTimeout(() => window.dispatchEvent(new CustomEvent("led-debug-force-refresh")), 0);
          }
        }
        schedulePreviewUiSync();
        notifyPreviewModeChanged(changedReason, mode);
        if (shouldCommit) maybeCommitPreviewMode();
      });
    });
  }

  function commitLiveParam(reason = "live-param", options = {}) {
    try {
      commitState({
        transport: "command",
        commandKind: "live-param",
        volatile: options.persist === true ? false : true,
        persist: options.persist === true,
        reason
      });
    } catch {
      try { commitState(); } catch {}
    }
  }

  function commitStatePatch(reason = "state-patch") {
    try {
      commitState({
        transport: "command",
        commandKind: "state-patch",
        persist: true,
        volatile: false,
        reason
      });
    } catch {
      try { commitState(); } catch {}
    }
  }

  function bindParamSlider(slider, target, index) {
    if (!slider) return;
    let dirty = false;
    slider.addEventListener("input", (event) => {
      target[index] = numberValue(event.target.value, 0.5);
      applyRangeVisual(event.target);
      dirty = true;
      commitLiveParam("layer-param-slider");
    });
    const flush = () => {
      if (!dirty) return;
      dirty = false;
      commitStatePatch("layer-param-slider-final");
    };
    slider.addEventListener("change", flush);
    ["pointerup", "pointercancel", "touchend", "mouseup", "keyup", "blur"].forEach((eventName) => {
      slider.addEventListener(eventName, flush);
    });
  }

  function bindMasterSlider(slider, target) {
    if (!slider) return;

    // STEP22MN: master faders are performance controls. During a drag they must
    // update the live in-memory state immediately, but they must not force a full
    // state commit on every single input event. On touch/mobile this produced
    // visible level stepping/cukání because persistence + sync work competed with
    // the render/output loop. Commit only when the gesture is finished.
    let dirty = false;
    const applyValue = (event) => {
      target.master = numberValue(event.target.value, 1);
      applyRangeVisual(event.target);
      dirty = true;
      commitLiveParam("master-slider-live");
    };
    const flushCommit = () => {
      if (!dirty) return;
      dirty = false;
      commitStatePatch("master-slider-final");
    };

    slider.addEventListener("input", applyValue);
    slider.addEventListener("change", flushCommit);
    ["pointerup", "pointercancel", "touchend", "mouseup", "keyup", "blur"].forEach((eventName) => {
      slider.addEventListener(eventName, flushCommit);
    });
  }

  function bindStepper(prefix, layer, stateKey, listKey, folder, moduleKey) {
    byId(`${prefix}_prev`).addEventListener("click", () => stepFile(layer, stateKey, listKey, folder, moduleKey, -1, { warmup: false, coalesce: true, debounceMs: 40 }));
    byId(`${prefix}_next`).addEventListener("click", () => stepFile(layer, stateKey, listKey, folder, moduleKey, 1, { warmup: false, coalesce: true, debounceMs: 40 }));
    byId(`${prefix}_reset`).addEventListener("click", () => randomizeSingleFile(layer, stateKey, listKey, folder, moduleKey, { warmup: false, coalesce: true, debounceMs: 60 }));
  }

  function bindLayerTools(layer) {
    byId(`${layer}_params_random`)?.addEventListener("click", () => randomizeLayerParams(layer));
    bindCheckbox(`${layer}_reverse`, state[layer], "reverse");
    bindCheckbox(`${layer}_mirror_x`, state[layer], "mirrorX");
    bindCheckbox(`${layer}_mirror_y`, state[layer], "mirrorY");
  }

  function bindFx(key, mode, amount, rate, flash, hold) {
    mode.addEventListener("change", (event) => {
      state[key].mode = event.target.value;
      commitStatePatch(`${key}-mode`);
    });
    amount.addEventListener("input", (event) => {
      state[key].amount = numberValue(event.target.value, 0);
      applyRangeVisual(event.target);
      commitLiveParam(`${key}-amount`);
    });
    amount.addEventListener("change", () => commitStatePatch(`${key}-amount-final`));
    rate.addEventListener("input", (event) => {
      state[key].rate = numberValue(event.target.value, 0.5);
      applyRangeVisual(event.target);
      commitLiveParam(`${key}-rate`);
    });
    rate.addEventListener("change", () => commitStatePatch(`${key}-rate-final`));
    flash.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      state[key].flash = true;
      syncControls();
      commitLiveParam(`${key}-flash-on`);
    });
    ["pointerup", "pointercancel", "pointerleave"].forEach((eventName) => {
      flash.addEventListener(eventName, () => {
        state[key].flash = false;
        syncControls();
        commitLiveParam(`${key}-flash-off`);
      });
    });

    hold?.addEventListener("click", () => {
      state[key].hold = !state[key].hold;
      syncControls();
      commitState();
    });
  }

  function bindLayerButtons(layer) {
    layerButtons[`${layer}_toggle`].addEventListener("click", () => {
      state[layer].enabled = !state[layer].enabled;
      syncControls();
      commitState();
    });

    layerButtons[`${layer}_beatsync`].addEventListener("click", () => {
      state[layer].beatSync = !state[layer].beatSync;
      syncControls();
      commitState();
    });

    bindMomentaryLayerButton(layer, "blackout");
    bindMomentaryLayerButton(layer, "flash");

    layerButtons[`${layer}_preview_toggle`]?.addEventListener("click", () => {
      state[layer].previewOn = !state[layer].previewOn;
      syncControls();
      commitState();
    });

    layerButtons[`${layer}_raw_preview`]?.addEventListener("click", () => {
      state[layer].previewOn = !state[layer].previewOn;
      syncControls();
      commitState();
    });
  }

  function bindManualPalette(layer) {
    const toggle = layerButtons[`${layer}_manual_palette_toggle`];
    const wheel = layerButtons[`${layer}_manual_palette_wheel`];
    const picker = wheel?.closest(".manual-palette-picker");
    if (!toggle || !wheel) return;

    toggle.addEventListener("click", () => {
      const previousState = cloneLayerState(state[layer]);
      const palette = state[layer].manualPalette;
      palette.enabled = !palette.enabled;
      startLayerTransition(layer, captureLayerModules(layer), previousState);
      syncControls();
      commitState();
    });

    const pickFromWheel = (event) => {
      const color = colorFromWheelEvent(wheel, event);
      const palette = state[layer].manualPalette;
      palette.colors[palette.selected] = color || "#000000";
      syncControls();
      commitState();
    };

    wheel.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      wheel.setPointerCapture?.(event.pointerId);
      pickFromWheel(event);
    });
    wheel.addEventListener("pointermove", (event) => {
      if (event.buttons) pickFromWheel(event);
    });

    picker?.addEventListener("pointerdown", (event) => {
      if (event.target === wheel) return;
      const palette = state[layer].manualPalette;
      palette.colors[palette.selected] = "#000000";
      syncControls();
      commitState();
    });

    for (let index = 0; index < 3; index += 1) {
      layerButtons[`${layer}_manual_palette_slot_${index}`]?.addEventListener("click", () => {
        const palette = state[layer].manualPalette;
        palette.selected = index;
        const active = normalizeManualPaletteActive(palette);
        active[index] = !active[index];
        palette.active = active;
        syncControls();
        commitState();
      });
    }
  }

  function bindMomentaryLayerButton(layer, key) {
    const button = layerButtons[`${layer}_${key}`];
    const setActive = (active) => {
      state[layer][key] = active;
      syncControls();
      commitState();
    };

    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      button.setPointerCapture?.(event.pointerId);
      setActive(true);
    });
    button.addEventListener("pointerup", () => setActive(false));
    button.addEventListener("pointercancel", () => setActive(false));
    button.addEventListener("pointerleave", (event) => {
      if (event.buttons) setActive(false);
    });
  }

  return {
    bindPerformancePads,
    bindPreviewTabs,
    bindParamSlider,
    bindMasterSlider,
    bindStepper,
    bindLayerTools,
    bindFx,
    bindLayerButtons,
    bindManualPalette
  };
}
