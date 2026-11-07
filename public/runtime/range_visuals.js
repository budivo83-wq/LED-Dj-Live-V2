export function createRangeVisualsRuntime({
  controls,
  sliders,
  state,
  clamp01
}) {
  function applyRangeVisual(slider) {
    if (!slider) return;
    const min = Number(slider.min || 0);
    const max = Number(slider.max || 1);
    const value = Number(slider.value || 0);
    const span = Math.max(0.0001, max - min);
    const ratio = clamp01((value - min) / span);

    slider.style.setProperty("--value", `${ratio}`);

    const knob = slider.closest(".knob-param");
    if (knob) {
      knob.dataset.value = value.toFixed(2);
      slider.style.setProperty("--knob-color", slider.closest(".l2-zone") ? "var(--mag)" : "var(--cyan)");
    }
  }

  function refreshRangeVisuals() {
    const ranges = [
      controls.master,
      controls.cross,
      controls.bpm,
      sliders.l1_p1,
      sliders.l1_p2,
      sliders.l1_p3,
      sliders.l1_p4,
      sliders.l1_master,
      sliders.l2_p1,
      sliders.l2_p2,
      sliders.l2_p3,
      sliders.l2_p4,
      sliders.l2_master,
      sliders.fx1_amount,
      sliders.fx1_rate,
      sliders.fx2_amount,
      sliders.fx2_rate,
      sliders.fxm_amount,
      sliders.fxm_rate,
      sliders.fxm2_amount,
      sliders.fxm2_rate
    ];

    ranges.forEach(applyRangeVisual);
  }

  function syncMasterValue() {
    if (!controls.masterValue) return;
    controls.masterValue.textContent = `${Math.round(state.master * 100)}%`;
  }

  return {
    applyRangeVisual,
    refreshRangeVisuals,
    syncMasterValue
  };
}
