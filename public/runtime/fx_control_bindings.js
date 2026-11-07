export function bindFxControlBindingsRuntime({ fxControls, sliders, bindFx }) {
  bindFx("fx1", fxControls.fx1_mode, sliders.fx1_amount, sliders.fx1_rate, fxControls.fx1_flash, fxControls.fx1_hold);
  bindFx("fx2", fxControls.fx2_mode, sliders.fx2_amount, sliders.fx2_rate, fxControls.fx2_flash, fxControls.fx2_hold);
  bindFx("fxMaster", fxControls.fxm_mode, sliders.fxm_amount, sliders.fxm_rate, fxControls.fxm_flash, fxControls.fxm_hold);
  bindFx("fxMaster2", fxControls.fxm2_mode, sliders.fxm2_amount, sliders.fxm2_rate, fxControls.fxm2_flash, fxControls.fxm2_hold);
}
