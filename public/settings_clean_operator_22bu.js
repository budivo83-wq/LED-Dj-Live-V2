(() => {
  let shellViewActive37BQ = true;
  try {
    window.addEventListener('message', (event) => {
      const data = event?.data || {};
      if (data?.type === 'led-shell-view-active') shellViewActive37BQ = data.active !== false;
    });
  } catch {}
  const status = () => document.getElementById("settingsCleanStatus22BU");
  let lastStatusText37DC = "";
  function setStatus(text) {
    const el = status();
    const next = text || "CLEAN SETTINGS READY";
    if (el && lastStatusText37DC !== next) {
      el.textContent = next;
      lastStatusText37DC = next;
    }
  }

  function clickTarget(id) {
    const target = document.getElementById(id);
    if (!target) {
      setStatus(`Nelze najít původní ovládání: #${id}`);
      return;
    }
    target.click();
    const label = target.textContent ? target.textContent.trim() : id;
    setStatus(`Spuštěno: ${label}`);
  }

  function mirrorStatus() {
    const parts = [];
    const serial = document.getElementById("serialStatus")?.textContent?.trim();
    const raw = document.getElementById("rawSerialMessage")?.textContent?.trim();
    const live = document.getElementById("rawSerialLiveStats")?.textContent?.trim();
    const artnet = document.getElementById("artnetStageSummary")?.textContent?.trim();
    if (serial) parts.push(`SERIAL: ${serial}`);
    if (raw) parts.push(`RAW: ${raw}`);
    if (live) parts.push(live);
    if (artnet) parts.push(artnet);
    if (parts.length) setStatus(parts.join("\n"));
  }

  window.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-proxy-click]").forEach((button) => {
      button.addEventListener("click", () => clickTarget(button.dataset.proxyClick));
    });
    const tick37DC = () => { if (shellViewActive37BQ) mirrorStatus(); };
    try {
      const loops = window.__budilightRuntimeLoopRegistry37CE;
      if (loops && typeof loops.adaptiveInterval === "function") {
        loops.adaptiveInterval("settings-clean:mirror-status", tick37DC, 1400, { group: "settings", liveFactor: 2.5, hiddenFactor: 5, maxMs: 8000 });
      } else {
        setInterval(tick37DC, 1400);
      }
    } catch { try { setInterval(tick37DC, 1400); } catch {} }
    setStatus("CLEAN SETTINGS READY — vyber port/baud níž a používej hlavně tento horní panel.");
  });
})();
