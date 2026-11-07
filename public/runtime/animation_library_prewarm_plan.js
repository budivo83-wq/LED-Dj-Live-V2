// STEP37DU: manifest-driven animation prewarm helper.
// Safe to use from future Performance/Show OS pages: it only fetches a compact
// plan and lets the caller decide when/where to import or compile modules.
export async function fetchAnimationPrewarmPlan({ layer = 'all', limit = 80 } = {}) {
  const url = `/api/animations/prewarm-plan?layer=${encodeURIComponent(layer)}&limit=${encodeURIComponent(limit)}`;
  const res = await fetch(url);
  const payload = await res.json().catch(() => ({}));
  if (!res.ok || !payload?.ok) throw new Error(payload?.error || `Prewarm plan failed: ${res.status}`);
  return payload.items || [];
}

export function buildNeighborPrewarmList(items, activeFileOrId, radius = 1) {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return [];
  const index = Math.max(0, list.findIndex((item) => item.file === activeFileOrId || item.id === activeFileOrId || item.source === activeFileOrId));
  const out = [];
  for (let offset = -radius; offset <= radius; offset += 1) {
    const item = list[(index + offset + list.length) % list.length];
    if (item?.source && !out.some((entry) => entry.source === item.source)) out.push(item);
  }
  return out.sort((a, b) => (b.priority - a.priority) || a.name.localeCompare(b.name));
}
