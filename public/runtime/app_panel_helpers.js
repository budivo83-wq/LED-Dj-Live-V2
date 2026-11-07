export function applyShaderInspectorCollapsedRuntime({ controls, collapsed }) {
  if (!controls?.shaderInspector) return;
  controls.shaderInspector.classList.toggle("is-collapsed", Boolean(collapsed));
  if (controls.shaderInspectorToggle) {
    controls.shaderInspectorToggle.textContent = collapsed ? "▼" : "▲";
    controls.shaderInspectorToggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
  }
}

export function applyPreviewCollapsedRuntime({ controls, collapsed }) {
  const previewPanel = controls?.previewPanel;
  if (!previewPanel) return;
  previewPanel.classList.toggle("is-collapsed", Boolean(collapsed));
  if (controls.previewCollapseToggle) {
    controls.previewCollapseToggle.textContent = collapsed ? "▼" : "▲";
    controls.previewCollapseToggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
  }
}

export function shaderCodeTextRuntime(gpu) {
  const raw = String(gpu?.code || "").trim();
  if (!raw) return "No GPU shader code";
  return raw;
}
