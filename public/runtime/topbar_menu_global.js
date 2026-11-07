import { syncFullscreenButtonLabel } from "../fullscreen.js";
import { requestShellNavigation } from "./shell_child_navigation.js";

const menuBtn = document.getElementById("menuBtn");
const centerMenuStrip = document.getElementById("centerMenuStrip");
const fullscreenBtn = document.getElementById("menuFullscreenBtn");

function closeMenu() {
  centerMenuStrip?.classList.remove("open");
  menuBtn?.classList.remove("active");
}

menuBtn?.addEventListener("click", () => {
  centerMenuStrip?.classList.toggle("open");
  menuBtn.classList.toggle("active", Boolean(centerMenuStrip?.classList.contains("open")));
});

document.querySelectorAll("#centerMenuStrip [data-href]").forEach((button) => {
  button.addEventListener("click", (event) => {
    const href = button.getAttribute("data-href");
    if (!href) return;
    event.preventDefault();
    requestShellNavigation(href, { mainReturnFast: button.dataset?.mainReturnFast === "1" });
    closeMenu();
  });
});

fullscreenBtn?.addEventListener("click", async () => {
  if (!document.fullscreenElement) {
    await document.documentElement.requestFullscreen?.();
  } else {
    await document.exitFullscreen?.();
  }
  syncFullscreenButtonLabel(fullscreenBtn, document);
});

document.addEventListener("fullscreenchange", () => syncFullscreenButtonLabel(fullscreenBtn, document));
document.addEventListener("click", (event) => {
  if (!centerMenuStrip?.classList.contains("open")) return;
  const target = event.target;
  if (target?.closest?.("#centerMenuStrip") || target?.closest?.("#menuBtn")) return;
  closeMenu();
});

syncFullscreenButtonLabel(fullscreenBtn, document);
