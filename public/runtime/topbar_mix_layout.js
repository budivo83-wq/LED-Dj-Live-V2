export function createTopbarMixLayoutRuntime({
  documentRef = document,
  storageRef = localStorage,
  controls,
  settings,
  storageKey = "led-engine-mix-core-collapsed-v1"
} = {}) {
  let collapsed = storageRef?.getItem?.(storageKey) === "1";

  function getPlacementMode() {
    return settings?.crossfaderPlacement === "topbar" ? "topbar" : "normal";
  }

  function applyTopbarMixLayout() {
    const mixCore = controls?.mixCore;
    const mixSlot = documentRef?.getElementById?.("mixCrossSlot");
    const blendRow = mixCore?.querySelector?.(".blend-row");
    const transition = mixCore?.querySelector?.(".transition-control");
    if (!mixCore || !mixSlot || !blendRow || !transition) return;

    const isTopbar = getPlacementMode() === "topbar";
    if (!isTopbar) {
      mixCore.style.display = "";
      mixCore.style.width = "";
      mixCore.style.margin = "";
      mixCore.style.padding = "";
      mixCore.style.gridTemplateColumns = "";
      mixCore.style.gridTemplateAreas = "";
      mixCore.style.gap = "";
      mixSlot.style.display = "";
      blendRow.style.gridTemplateColumns = "";
      transition.style.gridTemplateColumns = "";
      return;
    }

    mixSlot.style.display = "none";
    if (collapsed) {
      mixCore.style.display = "none";
      return;
    }

    mixCore.style.display = "grid";
    mixCore.style.width = "min(100%, 520px)";
    mixCore.style.margin = "4px auto 0";
    mixCore.style.padding = "6px 8px";
    mixCore.style.gridTemplateColumns = "minmax(0, 1fr) minmax(118px, 0.72fr)";
    mixCore.style.gridTemplateAreas = "\"blend transition\"";
    mixCore.style.gap = "6px";
    blendRow.style.gridTemplateColumns = "minmax(0, 1fr) 24px 24px 24px";
    transition.style.gridTemplateColumns = "minmax(84px, 1fr) 62px";
  }

  function applyCollapseState() {
    const toggle = controls?.mixCollapseToggle;
    const mixCore = controls?.mixCore;
    if (!toggle || !mixCore) return;

    mixCore.classList.toggle("is-collapsed", collapsed);
    toggle.textContent = collapsed ? "▼" : "▲";
    toggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
    storageRef?.setItem?.(storageKey, collapsed ? "1" : "0");
    applyTopbarMixLayout();
  }

  function initMixCoreCollapse() {
    const toggle = controls?.mixCollapseToggle;
    const mixCore = controls?.mixCore;
    if (!toggle || !mixCore) return;

    if (toggle.dataset.mixCoreCollapseBound !== "1") {
      toggle.addEventListener("click", () => {
        collapsed = !collapsed;
        applyCollapseState();
      });
      toggle.dataset.mixCoreCollapseBound = "1";
    }

    applyCollapseState();
  }

  function applyCrossfaderPlacement() {
    const mode = getPlacementMode();
    documentRef?.body?.setAttribute("data-crossfader-placement", mode);

    const wrap = controls?.cross?.closest?.(".crossfader-wrap");
    const topbarSlot = documentRef?.getElementById?.("topbarCrossSlot");
    const mixSlot = documentRef?.getElementById?.("mixCrossSlot");
    const target = mode === "topbar" ? topbarSlot : mixSlot;
    if (!wrap || !target || wrap.parentElement === target) {
      applyTopbarMixLayout();
      return;
    }

    target.appendChild(wrap);
    applyTopbarMixLayout();
  }

  return {
    initMixCoreCollapse,
    applyTopbarMixLayout,
    applyCrossfaderPlacement,
    get collapsed() {
      return collapsed;
    }
  };
}
