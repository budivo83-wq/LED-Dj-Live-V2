export function freezeList(values = []) {
  return Object.freeze([...(Array.isArray(values) ? values : [])]);
}

export function freezeUniqueList(values = [], limit = 16) {
  const seen = new Set();
  const out = [];
  for (const value of Array.isArray(values) ? values : []) {
    const key = String(value ?? "").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
    if (out.length >= limit) break;
  }
  return Object.freeze(out);
}
