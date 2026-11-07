const SETTINGS_KEY = "led-engine-settings-v1";

export const defaultBackgrounds = [
  { id: "default", label: "DEFAULT", image: "bg.png" }
];

const defaultBackgroundMap = new Map(defaultBackgrounds.map((item) => [item.id, item]));
const backgroundModes = new Set(["dark", "light", "custom", ...defaultBackgroundMap.keys()]);

export const appearanceDefaults = {
  theme: "dark",
  backgroundMode: "default",
  backgroundImage: ""
};

export function loadAppearanceSettings() {
  try {
    return sanitizeAppearance(JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {});
  } catch {
    return { ...appearanceDefaults };
  }
}

export function sanitizeAppearance(settings) {
  const next = { ...appearanceDefaults, ...(settings || {}) };
  if (!backgroundModes.has(next.backgroundMode)) next.backgroundMode = "default";
  next.theme = next.backgroundMode === "light" ? "light" : "dark";
  if (typeof next.backgroundImage !== "string") next.backgroundImage = "";
  return next;
}

export function applyAppearance(settings = loadAppearanceSettings()) {
  const next = sanitizeAppearance(settings);
  document.documentElement.dataset.theme = next.theme;
  document.body.classList.toggle("theme-light", next.theme === "light");
  const defaultBackground = defaultBackgroundMap.get(next.backgroundMode);
  const customBackground = next.backgroundMode === "custom" && next.backgroundImage ? next.backgroundImage : "";
  const background = defaultBackground ? `./${defaultBackground.image}` : customBackground;
  document.body.classList.toggle("has-image-bg", Boolean(background));
  document.body.style.setProperty("--image-bg", background ? `url("${cssUrl(background)}")` : "none");
}

export function bindAppearanceStorage() {
  window.addEventListener("storage", (event) => {
    if (event.key === SETTINGS_KEY) applyAppearance();
  });
}

function cssUrl(value) {
  return String(value).replaceAll("\\", "\\\\").replaceAll("\"", "\\\"");
}
