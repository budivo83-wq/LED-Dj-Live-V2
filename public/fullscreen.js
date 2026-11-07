const SETTINGS_KEY = "led-engine-settings-v1";

export function resolveFullscreenDocument(documentRef = document) {
  try {
    const topDocument = window?.top?.document;
    if (topDocument?.documentElement) return topDocument;
  } catch {
    // Ignore cross-origin or denied access.
  }
  return documentRef;
}

export function readFullscreenPreferred() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}")?.fullscreenPreferred === true;
  } catch {
    return false;
  }
}

export function saveFullscreenPreferred(value) {
  try {
    const current = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    current.fullscreenPreferred = value === true;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(current));
  } catch {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ fullscreenPreferred: value === true }));
  }
}

export async function toggleFullscreen(documentRef = document) {
  const fullscreenDocument = resolveFullscreenDocument(documentRef);
  try {
    if (fullscreenDocument.fullscreenElement) {
      await fullscreenDocument.exitFullscreen();
      saveFullscreenPreferred(false);
      return false;
    }
    await fullscreenDocument.documentElement.requestFullscreen();
    saveFullscreenPreferred(true);
    return true;
  } catch (error) {
    console.warn("Fullscreen toggle failed", error);
    return Boolean(fullscreenDocument.fullscreenElement);
  }
}

export async function applyFullscreenPreference(preferred, documentRef = document) {
  const fullscreenDocument = resolveFullscreenDocument(documentRef);
  const wants = preferred === true;
  saveFullscreenPreferred(wants);
  if (wants && !fullscreenDocument.fullscreenElement) {
    try {
      await fullscreenDocument.documentElement.requestFullscreen();
    } catch (error) {
      console.warn("Applying fullscreen preference failed", error);
    }
    return;
  }
  if (!wants && fullscreenDocument.fullscreenElement) {
    try {
      await fullscreenDocument.exitFullscreen();
    } catch (error) {
      console.warn("Exiting fullscreen failed", error);
    }
  }
}

export function syncFullscreenButtonLabel(button, documentRef = document) {
  if (!button) return;
  const fullscreenDocument = resolveFullscreenDocument(documentRef);
  const on = Boolean(fullscreenDocument.fullscreenElement);
  button.textContent = on ? "FULLSCREEN ON" : "FULLSCREEN OFF";
  button.classList.toggle("active", on);
}
