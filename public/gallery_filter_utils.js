export function buildDynamicFilterTags(library, canonicalTag, filterKey) {
  const seen = new Map();
  for (const item of library || []) {
    for (const tag of item.tags || []) {
      const label = canonicalTag(tag);
      const key = filterKey(label);
      if (!key) continue;
      seen.set(key, label);
    }
  }
  const priority = ["shader", "cpu", "l1", "l2", "user", "meta", "archived"];
  return [...seen.entries()].sort((a, b) => {
    const pa = priority.indexOf(a[0]);
    const pb = priority.indexOf(b[0]);
    if (pa !== -1 || pb !== -1) return (pa === -1 ? 999 : pa) - (pb === -1 ? 999 : pb);
    return a[1].localeCompare(b[1], "cs", { sensitivity: "base" });
  }).map(([key, label]) => ({ key, label }));
}

export function reconcileActiveFilters(currentFilters, availableKeys) {
  const current = new Set(currentFilters || []);
  const available = new Set(availableKeys || []);
  const next = new Set([...current].filter((key) => key === "all" || available.has(key)));
  if (!next.size) next.add("all");
  return next;
}

export function toggleFilterSet(currentFilters, key, filterKey) {
  const normalized = filterKey(key || "all");
  const next = new Set(currentFilters || []);
  if (normalized === "all") return new Set(["all"]);
  next.delete("all");
  if (next.has(normalized)) next.delete(normalized);
  else next.add(normalized);
  if (!next.size) next.add("all");
  return next;
}
