import { clamp01 } from "../core/math.js";

export function initDirectRangeControlRuntime(documentRef = document) {
  const ranges = Array.from(documentRef.querySelectorAll('input[type="range"]'));
  ranges.forEach((slider) => {
    if (slider.dataset.directRangeControlBound === "1") return;
    slider.dataset.directRangeControlBound = "1";
    slider.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      if (!Number.isFinite(slider.minAsNumber) || !Number.isFinite(slider.maxAsNumber)) return;
      const rect = slider.getBoundingClientRect();
      if (rect.width <= 0) return;
      const pointerId = event.pointerId;
      slider.setPointerCapture?.(pointerId);
      const isKnob = slider.closest(".knob-param");
      const startValue = Number(slider.value);
      const startY = event.clientY;
      const updateFromPointer = (clientX) => {
        const min = slider.minAsNumber;
        const max = slider.maxAsNumber;
        const step = Number(slider.step);
        const ratio = clamp01((clientX - rect.left) / rect.width);
        let next = min + ratio * (max - min);
        if (Number.isFinite(step) && step > 0) {
          next = Math.round((next - min) / step) * step + min;
        }
        next = Math.max(min, Math.min(max, next));
        slider.value = String(next);
        slider.dispatchEvent(new Event("input", { bubbles: true }));
      };
      const updateKnobFromVerticalDrag = (clientY) => {
        const min = slider.minAsNumber;
        const max = slider.maxAsNumber;
        const span = max - min;
        const step = Number(slider.step);
        const deltaY = startY - clientY;
        const speed = span / 220;
        let next = startValue + deltaY * speed;
        if (Number.isFinite(step) && step > 0) {
          next = Math.round((next - min) / step) * step + min;
        }
        next = Math.max(min, Math.min(max, next));
        slider.value = String(next);
        slider.dispatchEvent(new Event("input", { bubbles: true }));
      };
      if (isKnob) updateKnobFromVerticalDrag(event.clientY);
      else updateFromPointer(event.clientX);
      const onMove = (moveEvent) => {
        if (isKnob) updateKnobFromVerticalDrag(moveEvent.clientY);
        else updateFromPointer(moveEvent.clientX);
      };
      const onEnd = () => {
        slider.removeEventListener("pointermove", onMove);
        slider.removeEventListener("pointerup", onEnd);
        slider.removeEventListener("pointercancel", onEnd);
      };
      slider.addEventListener("pointermove", onMove);
      slider.addEventListener("pointerup", onEnd);
      slider.addEventListener("pointercancel", onEnd);
    });
  });
}
