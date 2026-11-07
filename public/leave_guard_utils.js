function isDirtyText(value) {
  return String(value || "").toLowerCase().includes("dirty");
}

export function hasUnsavedGalleryChanges(state) {
  return Boolean(state?.albumDraftDirty || state?.selectorDraftDirty || isDirtyText(state?.shadertoyStatusText));
}

export function buildUnsavedGallerySummary(state) {
  const parts = [];
  if (state?.albumDraftDirty) parts.push("albums/favorites");
  if (state?.selectorDraftDirty) parts.push(`${String(state?.selectorLayer || "").toUpperCase()} selector`);
  if (isDirtyText(state?.shadertoyStatusText)) parts.push("shadertoy draft");
  return parts.length ? parts.join(" + ") : "none";
}
