// Startup overlay controller. The rendering preload can legitimately spend
// seconds on one step, so the overlay always keeps independent motion alive.

export function createStartupOverlay() {
  document.body.classList.add("startup-pending");

  const root = document.createElement("div");
  root.className = "startup-overlay";
  root.innerHTML = `
    <div class="startup-card">
      <div class="startup-step">Initializing...</div>
      <div class="startup-bar"><span class="startup-fill"></span></div>
      <div class="startup-meta">
        <span class="startup-percent">0%</span>
        <span class="startup-time">0 ms</span>
      </div>
      <div class="startup-activity" aria-label="Program pracuje">
        <span></span><span></span><span></span><span></span>
      </div>
    </div>
  `;
  document.body.appendChild(root);

  return {
    root,
    step: root.querySelector(".startup-step"),
    fill: root.querySelector(".startup-fill"),
    percent: root.querySelector(".startup-percent"),
    time: root.querySelector(".startup-time")
  };
}

export function updateStartupOverlay(overlay, startedAt, percent, label) {
  if (!overlay?.root) return;
  const clamped = Math.max(0, Math.min(100, Number(percent) || 0));
  if (overlay.step) overlay.step.textContent = label;
  if (overlay.fill) overlay.fill.style.width = `${clamped}%`;
  if (overlay.percent) overlay.percent.textContent = `${Math.round(clamped)}%`;
  if (overlay.time) overlay.time.textContent = `${Math.round(performance.now() - startedAt)} ms`;
}

export function closeStartupOverlay(overlay, options = {}) {
  if (!overlay?.root) return;

  overlay.root.classList.add("done");

  if (!options.greetingEnabled) {
    document.body.classList.remove("startup-pending");
    document.body.classList.add("startup-ready");
    window.setTimeout(() => overlay.root.remove(), 500);
    return;
  }

  const greeting = document.createElement("div");
  greeting.className = "startup-greeting";
  greeting.textContent = options.greetingText || "vítej borče";
  document.body.appendChild(greeting);

  window.setTimeout(() => overlay.root.remove(), 500);
  window.setTimeout(() => greeting.classList.add("visible"), 520);
  window.setTimeout(() => greeting.classList.add("leaving"), 1800);
  window.setTimeout(() => {
    greeting.remove();
    document.body.classList.remove("startup-pending");
    document.body.classList.add("startup-ready");
  }, 2300);
}
