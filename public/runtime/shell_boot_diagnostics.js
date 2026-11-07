export function formatReadyDetail(detail) {
  if (!detail || typeof detail !== "object") return "";
  const gpu = detail.gpuReady === undefined ? "gpu=?" : `gpu=${detail.gpuReady ? "1" : "0"}`;
  const at = Number.isFinite(Number(detail.at)) ? `at=${Math.round(Number(detail.at))}` : "";
  return [gpu, at].filter(Boolean).join(" ");
}

export function formatBootScopeStatus({ ready, loaded, bootDegraded, degradedReasons, scope }) {
  if (ready) {
    return bootDegraded && Array.isArray(degradedReasons) && degradedReasons.some((reason) => reason.startsWith(`${scope}:`))
      ? "ready fallback"
      : "ready";
  }
  return loaded ? "loaded, waiting ready" : "loading iframe";
}

export function renderBootDiagLog(entries) {
  return (Array.isArray(entries) ? entries : []).slice(-5).map((entry) => {
    const detail = entry.detail ? ` — ${escapeHtml(entry.detail)}` : "";
    return `<div>${entry.at}ms ${escapeHtml(entry.scope)}:${escapeHtml(entry.event)}${detail}</div>`;
  }).join("");
}

export function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;"
  }[char]));
}
