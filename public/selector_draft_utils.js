export function swapSelectorItems(items, fromId, toId) {
  if (!Array.isArray(items) || !fromId || !toId || fromId === toId) {
    return { items: Array.isArray(items) ? items : [], changed: false };
  }
  const next = [...items];
  const fromIndex = next.findIndex((item) => item.id === fromId);
  const toIndex = next.findIndex((item) => item.id === toId);
  if (fromIndex < 0 || toIndex < 0) return { items: next, changed: false };
  [next[fromIndex], next[toIndex]] = [next[toIndex], next[fromIndex]];
  return { items: next, changed: true };
}

export function removeSelectorItemById(items, id) {
  if (!Array.isArray(items) || !id) return { items: Array.isArray(items) ? items : [], changed: false };
  const next = items.filter((item) => item.id !== id);
  return { items: next, changed: next.length !== items.length };
}

export function reorderSelectorItems(items, id, direction) {
  if (!Array.isArray(items) || !id) return { items: Array.isArray(items) ? items : [], changed: false };
  const next = [...items];
  const index = next.findIndex((item) => item.id === id);
  if (index < 0) return { items: next, changed: false };
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= next.length) return { items: next, changed: false };
  [next[index], next[target]] = [next[target], next[index]];
  return { items: next, changed: true };
}
