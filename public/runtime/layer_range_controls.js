export function bindLayerRangeControlsRuntime({
  sliders,
  state,
  bindParamSlider,
  bindMasterSlider
}) {
  bindParamSlider(sliders.l1_p1, state.l1.params, 0);
  bindParamSlider(sliders.l1_p2, state.l1.params, 1);
  bindParamSlider(sliders.l1_p3, state.l1.params, 2);
  bindParamSlider(sliders.l1_p4, state.l1.params, 3);
  bindMasterSlider(sliders.l1_master, state.l1);

  bindParamSlider(sliders.l2_p1, state.l2.params, 0);
  bindParamSlider(sliders.l2_p2, state.l2.params, 1);
  bindParamSlider(sliders.l2_p3, state.l2.params, 2);
  bindParamSlider(sliders.l2_p4, state.l2.params, 3);
  bindMasterSlider(sliders.l2_master, state.l2);
}
