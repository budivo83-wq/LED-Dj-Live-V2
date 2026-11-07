(() => {
  "use strict";

  const STORAGE_KEY = "budilightCenterStageOrderStep37J";
  const LEGACY_KEYS = ["budilightCenterMixOrderStep37G"];
  const BLOCKS = [
    { id: "previewPanel", selector: "#previewPanel", label: "PREVIEW" },
    { id: "mixCoreBlock", selector: ".mix-core", label: "MIX / CROSS" },
    { id: "masterFxBlock", selector: ".master-fx-shell", label: "MASTER FX" },
    { id: "perfPadsPanel", selector: "#perfPadsPanel", label: "PADS" },
    { id: "quickStepAutoPanel", selector: "#quickStepAutoPanel", label: "STEP SEQ" }
  ];

  const defaultOrder = () => BLOCKS.map((block) => block.id);

  function safeJson(raw, fallback) {
    try {
      const parsed = JSON.parse(raw || "null");
      return parsed || fallback;
    } catch {
      return fallback;
    }
  }

  function normalizeOrder(saved) {
    const allowed = new Set(defaultOrder());
    const order = Array.isArray(saved) ? saved.filter((id) => allowed.has(id)) : [];
    for (const id of defaultOrder()) if (!order.includes(id)) order.push(id);
    return order;
  }

  function readOrder() {
    const current = safeJson(localStorage.getItem(STORAGE_KEY), null);
    if (Array.isArray(current)) return normalizeOrder(current);
    for (const key of LEGACY_KEYS) {
      const legacy = safeJson(localStorage.getItem(key), null);
      if (Array.isArray(legacy)) return normalizeOrder(legacy);
    }
    return defaultOrder();
  }

  function saveOrder(container) {
    const order = [...container.querySelectorAll(":scope > [data-center-block-id]")]
      .map((node) => node.dataset.centerBlockId)
      .filter(Boolean);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(order)); } catch {}
  }

  function ensureHandle(block, label) {
    let handle = block.querySelector(":scope > .center-block-drag-handle");
    if (handle) return handle;
    handle = document.createElement("button");
    handle.type = "button";
    handle.className = "center-block-drag-handle";
    handle.title = "Přetáhni celý blok nahoru/dolů ve středovém panelu";
    handle.setAttribute("aria-label", `Přesunout blok ${label}`);
    handle.textContent = "↕";
    block.prepend(handle);
    return handle;
  }

  function collectBlocks(stage) {
    const blockMap = new Map();
    for (const block of BLOCKS) {
      const node = stage.querySelector(block.selector) || document.querySelector(block.selector);
      if (!node) continue;
      node.dataset.centerBlockId = block.id;
      node.dataset.centerBlockLabel = block.label;
      node.classList.add("center-sortable-block");
      ensureHandle(node, block.label);
      blockMap.set(block.id, node);
    }
    return blockMap;
  }

  function flattenIntoStage(stage, blockMap) {
    const order = readOrder();
    for (const id of order) {
      const node = blockMap.get(id);
      if (node) stage.appendChild(node);
    }
    document.querySelectorAll(".performance-strip").forEach((strip) => {
      if (!strip.querySelector("[data-center-block-id]")) strip.classList.add("center-sortable-empty-strip");
    });
  }

  function insertionTarget(container, y, dragged) {
    const candidates = [...container.querySelectorAll(":scope > [data-center-block-id]")]
      .filter((node) => node !== dragged && !node.classList.contains("center-block-dragging"));
    let closest = null;
    let closestOffset = Number.NEGATIVE_INFINITY;
    for (const node of candidates) {
      const rect = node.getBoundingClientRect();
      const offset = y - rect.top - rect.height / 2;
      if (offset < 0 && offset > closestOffset) {
        closestOffset = offset;
        closest = node;
      }
    }
    return closest;
  }

  function moveDragged(container, dragged, clientY) {
    const before = insertionTarget(container, clientY, dragged);
    if (before) container.insertBefore(dragged, before);
    else container.appendChild(dragged);
  }

  function bindPointerDrag(container) {
    let dragged = null;
    let pointerId = null;
    let startY = 0;
    let active = false;

    const cleanup = () => {
      if (!dragged) return;
      dragged.classList.remove("center-block-dragging");
      document.body.classList.remove("center-block-drag-active");
      saveOrder(container);
      dragged = null;
      pointerId = null;
      active = false;
    };

    container.addEventListener("pointerdown", (event) => {
      const handle = event.target.closest?.(".center-block-drag-handle");
      if (!handle || !container.contains(handle)) return;
      const block = handle.closest("[data-center-block-id]");
      if (!block) return;
      event.preventDefault();
      dragged = block;
      pointerId = event.pointerId;
      startY = event.clientY;
      active = false;
      try { handle.setPointerCapture(pointerId); } catch {}
    });

    container.addEventListener("pointermove", (event) => {
      if (!dragged || event.pointerId !== pointerId) return;
      event.preventDefault();
      if (!active && Math.abs(event.clientY - startY) >= 3) {
        active = true;
        dragged.classList.add("center-block-dragging");
        document.body.classList.add("center-block-drag-active");
      }
      if (active) moveDragged(container, dragged, event.clientY);
    });

    container.addEventListener("pointerup", (event) => {
      if (pointerId !== event.pointerId) return;
      event.preventDefault();
      cleanup();
    });
    container.addEventListener("pointercancel", cleanup);
  }

  function bindHtmlDrag(container) {
    let dragged = null;
    container.querySelectorAll(".center-block-drag-handle").forEach((handle) => {
      handle.draggable = true;
    });
    container.addEventListener("dragstart", (event) => {
      const handle = event.target.closest?.(".center-block-drag-handle");
      if (!handle || !container.contains(handle)) return;
      dragged = handle.closest("[data-center-block-id]");
      if (!dragged) return;
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", dragged.dataset.centerBlockId || "");
      requestAnimationFrame(() => dragged?.classList.add("center-block-dragging"));
    });
    container.addEventListener("dragover", (event) => {
      if (!dragged) return;
      event.preventDefault();
      moveDragged(container, dragged, event.clientY);
    });
    const finish = () => {
      if (!dragged) return;
      dragged.classList.remove("center-block-dragging");
      saveOrder(container);
      dragged = null;
    };
    container.addEventListener("drop", (event) => { event.preventDefault(); finish(); });
    container.addEventListener("dragend", finish);
  }

  function init() {
    const stage = document.querySelector(".center-stage");
    if (!stage || stage.dataset.centerSortReady === "2") return;
    const blockMap = collectBlocks(stage);
    if (blockMap.size < 2) return;
    stage.dataset.centerSortReady = "2";
    stage.classList.add("center-sortable-ready", "center-stage-sortable-ready");
    flattenIntoStage(stage, blockMap);
    bindPointerDrag(stage);
    bindHtmlDrag(stage);
    saveOrder(stage);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
