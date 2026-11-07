export function saveEditorDraft(storage, key, payload) {
  try {
    storage?.setItem?.(key, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function loadEditorDraft(storage, key) {
  try {
    const raw = storage?.getItem?.(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function saveShadertoyDraft(storage, key, code) {
  try {
    storage?.setItem?.(key, JSON.stringify({
      code: code || "",
      at: Date.now()
    }));
    return true;
  } catch {
    return false;
  }
}

export function loadShadertoyDraft(storage, key) {
  try {
    const raw = storage?.getItem?.(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}
