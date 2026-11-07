export function initShaderInspectorToggleRuntime({
  controls,
  storageKey,
  getCollapsed,
  setCollapsed,
  storage = localStorage
}) {
  const apply = () => {
    const collapsed = !!getCollapsed?.();
    if (!controls?.shaderInspector) return;
    controls.shaderInspector.classList.toggle("is-collapsed", collapsed);
    if (controls.shaderInspectorToggle) {
      controls.shaderInspectorToggle.textContent = collapsed ? "▼" : "▲";
      controls.shaderInspectorToggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
    }
  };

  try {
    setCollapsed?.(storage.getItem(storageKey) === "1");
  } catch {
    setCollapsed?.(false);
  }
  apply();

  const toggle = controls?.shaderInspectorToggle;
  if (!toggle || toggle.dataset.shaderInspectorCollapseBound === "1") return;
  toggle.dataset.shaderInspectorCollapseBound = "1";
  toggle.addEventListener("click", () => {
    const next = !getCollapsed?.();
    setCollapsed?.(next);
    apply();
    try {
      storage.setItem(storageKey, next ? "1" : "0");
    } catch {
      // ignore storage failures
    }
  });
}

export function initPreviewCollapseToggleRuntime({
  controls,
  storageKey,
  getCollapsed,
  setCollapsed,
  storage = localStorage
}) {
  const apply = () => {
    const collapsed = !!getCollapsed?.();
    const previewPanel = controls?.previewPanel;
    if (!previewPanel) return;
    previewPanel.classList.toggle("is-collapsed", collapsed);
    if (controls.previewCollapseToggle) {
      controls.previewCollapseToggle.textContent = collapsed ? "▼" : "▲";
      controls.previewCollapseToggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
    }
  };

  try {
    setCollapsed?.(storage.getItem(storageKey) === "1");
  } catch {
    setCollapsed?.(false);
  }
  apply();

  const toggle = controls?.previewCollapseToggle;
  if (!toggle || toggle.dataset.previewCollapseBound === "1") return;
  toggle.dataset.previewCollapseBound = "1";
  toggle.addEventListener("click", () => {
    const next = !getCollapsed?.();
    setCollapsed?.(next);
    apply();
    try {
      storage.setItem(storageKey, next ? "1" : "0");
    } catch {
      // ignore storage failures
    }
  });
}

export function initFxPanelTogglesRuntime({ controls, storageKey, storage = localStorage }) {
  let stored = {};
  try {
    stored = JSON.parse(storage.getItem(storageKey) || "{}") || {};
  } catch {
    stored = {};
  }

  const persist = () => {
    try {
      storage.setItem(storageKey, JSON.stringify(stored));
    } catch {
      // ignore storage failures
    }
  };

  const entries = [
    { key: "l1", panel: controls?.l1FxPanel, toggle: controls?.l1FxToggle },
    { key: "l2", panel: controls?.l2FxPanel, toggle: controls?.l2FxToggle }
  ];

  const apply = () => {
    entries.forEach((entry) => {
      if (!entry.panel || !entry.toggle) return;
      const collapsed = stored[entry.key] === true;
      entry.panel.classList.toggle("is-collapsed", collapsed);
      entry.toggle.textContent = collapsed ? "▼" : "▲";
      entry.toggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
    });
  };

  apply();
  entries.forEach((entry) => {
    if (!entry.toggle || entry.toggle.dataset.fxPanelCollapseBound === "1") return;
    entry.toggle.dataset.fxPanelCollapseBound = "1";
    entry.toggle.addEventListener("click", () => {
      stored[entry.key] = !(stored[entry.key] === true);
      apply();
      persist();
    });
  });

  initMasterFxToggleRuntime({ controls, storageKey, stored, persist });
}

export function initMasterFxToggleRuntime({ controls, stored = {}, persist = () => {} }) {
  const panel = controls?.mFxPanel;
  const toggle = controls?.mFxToggle;
  if (!panel || !toggle) return;
  const shell = panel.closest(".master-fx-shell");
  const header = panel.querySelector("h3");

  const apply = () => {
    const collapsed = stored.m === true;
    panel.classList.toggle("is-collapsed", collapsed);
    shell?.classList.toggle("is-collapsed-shell", collapsed);
    toggle.textContent = collapsed ? "▼" : "▲";
    toggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
  };

  const onToggle = (event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    stored.m = !(stored.m === true);
    apply();
    persist();
  };

  if (toggle.dataset.fxCollapseBound !== "1") {
    toggle.dataset.fxCollapseBound = "1";
    toggle.addEventListener("click", onToggle);
    toggle.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") onToggle(event);
    });
  }
  if (header && header.dataset.fxHeaderCollapseBound !== "1") {
    header.dataset.fxHeaderCollapseBound = "1";
    header.addEventListener("click", (event) => {
      if (event.target === toggle) return;
      onToggle(event);
    });
  }

  apply();
}

export function initManualPaletteTogglesRuntime({
  layerButtons,
  manualPaletteCollapsed,
  storageKey,
  storage = localStorage
}) {
  let stored = {};
  try {
    stored = JSON.parse(storage.getItem(storageKey) || "{}") || {};
  } catch {
    stored = {};
  }

  const entries = [
    { key: "l1", panel: layerButtons?.l1_manual_palette, toggle: layerButtons?.l1_manual_palette_collapse },
    { key: "l2", panel: layerButtons?.l2_manual_palette, toggle: layerButtons?.l2_manual_palette_collapse }
  ];

  const apply = () => {
    entries.forEach((entry) => {
      if (!entry.panel || !entry.toggle) return;
      const collapsed = stored[entry.key] === true;
      if (manualPaletteCollapsed) manualPaletteCollapsed[entry.key] = collapsed;
      entry.panel.classList.toggle("is-collapsed", collapsed);
      entry.toggle.textContent = collapsed ? "▼" : "▲";
      entry.toggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
    });
  };

  apply();
  const toggleEntry = (entry) => {
    stored[entry.key] = !(stored[entry.key] === true);
    apply();
    try {
      storage.setItem(storageKey, JSON.stringify(stored));
    } catch {
      // ignore storage failures
    }
  };

  entries.forEach((entry) => {
    const header = entry.panel?.querySelector("h3");
    const onToggleClick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggleEntry(entry);
    };

    if (entry.toggle && entry.toggle.dataset.manualPaletteCollapseBound !== "1") {
      entry.toggle.dataset.manualPaletteCollapseBound = "1";
      entry.toggle.addEventListener("click", onToggleClick);
    }

    if (header && header.dataset.manualPaletteHeaderCollapseBound !== "1") {
      header.dataset.manualPaletteHeaderCollapseBound = "1";
      header.addEventListener("click", (event) => {
        if (event.target === entry.toggle) return;
        onToggleClick(event);
      });
    }
  });
}

export function initPerfPadsToggleRuntime({ controls, storageKey, storage = localStorage }) {
  const panel = controls?.perfPadsPanel;
  const toggle = controls?.perfPadsToggle;
  if (!panel || !toggle) return;
  const header = panel.querySelector("h3");

  let collapsed = false;
  try {
    collapsed = storage.getItem(storageKey) === "1";
  } catch {
    collapsed = false;
  }

  const apply = () => {
    panel.classList.toggle("is-collapsed", collapsed);
    toggle.textContent = collapsed ? "▼" : "▲";
    toggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
  };

  const onToggle = (event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    collapsed = !collapsed;
    apply();
    try {
      storage.setItem(storageKey, collapsed ? "1" : "0");
    } catch {
      // ignore storage failures
    }
  };

  if (toggle.dataset.perfPadsCollapseBound !== "1") {
    toggle.dataset.perfPadsCollapseBound = "1";
    toggle.addEventListener("click", onToggle);
  }
  if (header && header.dataset.perfPadsHeaderCollapseBound !== "1") {
    header.dataset.perfPadsHeaderCollapseBound = "1";
    header.addEventListener("click", (event) => {
      if (event.target === toggle) return;
      onToggle(event);
    });
  }

  apply();
}
