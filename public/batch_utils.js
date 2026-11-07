export function collectBatchIds(batchSelectedIds, library) {
  return [...batchSelectedIds].filter((id) => library.some((item) => item.id === id && item.id !== "__editor_preview"));
}

export function orderValueForItem(item, layer = "") {
  if (!item) return Number.MAX_SAFE_INTEGER;
  if (layer === "l1" || layer === "l2") return Number(item.layerOrder?.[layer] ?? Number.MAX_SAFE_INTEGER);
  return Number(item.order ?? Number.MAX_SAFE_INTEGER);
}

export function collectMovableBatchItems(batchSelectedIds, library, layer = "", hasLayer) {
  const ids = [...batchSelectedIds].filter((id) => {
    const item = library.find((entry) => entry.id === id);
    if (!item || item.id === "__editor_preview" || item.archived) return false;
    if (!layer) return true;
    return hasLayer(item, layer);
  });
  return ids.map((id) => library.find((entry) => entry.id === id)).filter(Boolean);
}

export function sortBatchItemsForMove(items, layer = "", direction = "up") {
  const next = [...items].sort((a, b) => orderValueForItem(a, layer) - orderValueForItem(b, layer));
  if (direction === "down") next.reverse();
  return next;
}
