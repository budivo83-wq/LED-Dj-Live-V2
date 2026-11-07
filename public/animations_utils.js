export function prettyName(file) {
  return String(file || "").replace(/\.js$/i, "").replace(/_/g, " ");
}

export function tagsFor(file, mod) {
  const name = String(file || "").toLowerCase();
  const tags = ["L1", "L2"];
  if (name.includes("shader") || mod?.gpu) tags.push("Shader");
  else tags.push("CPU");
  if (mod?.meta?.name) tags.push("Meta");
  if (String(file || "").includes("user_anims/") || mod?.origin === "user") tags.push("User");
  return tags;
}

export function normalizeTags(tags) {
  return [...new Set(String(tags || "")
    .split(",")
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean))];
}

export function clamp01(v) {
  return Math.max(0, Math.min(1, Number.isFinite(Number(v)) ? Number(v) : 0));
}

export function heatColor(v) {
  const x = clamp01(v);
  const r = Math.pow(x, 0.45) * 255;
  const g = Math.pow(Math.max(0, 1 - Math.abs(x - 0.58) / 0.58), 1.35) * 210;
  const b = Math.pow(1 - x, 1.8) * 120 + Math.pow(Math.max(0, x - 0.78) / 0.22, 1.4) * 90;
  return [r, g, b];
}

export function colorToRgb(color) {
  if (Array.isArray(color)) {
    const values = [color[0] ?? 0, color[1] ?? 0, color[2] ?? 0];
    const max = Math.max(...values.map((v) => Math.abs(Number(v) || 0)));
    const scale = max <= 1.0001 ? 255 : 1;
    return values.map((v) => Math.max(0, Math.min(255, Math.round((Number(v) || 0) * scale))));
  }
  if (typeof color === "number") return heatColor(color).map((v) => Math.round(v));
  if (color && typeof color === "object") {
    if ("r" in color || "g" in color || "b" in color) {
      const values = [color.r ?? 0, color.g ?? 0, color.b ?? 0];
      const max = Math.max(...values.map((v) => Math.abs(Number(v) || 0)));
      const scale = max <= 1.0001 ? 255 : 1;
      return values.map((v) => Math.max(0, Math.min(255, Math.round((Number(v) || 0) * scale))));
    }
    if ("v" in color || "value" in color || "intensity" in color) {
      return heatColor(color.v ?? color.value ?? color.intensity).map((v) => Math.round(v));
    }
  }
  return [0, 0, 0];
}

export function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
}

export function canonicalTag(tag) {
  const raw = String(tag || "").trim();
  if (!raw) return "";
  const lower = raw.toLowerCase();
  const known = { l1: "L1", l2: "L2", cpu: "CPU", shader: "Shader", user: "User", meta: "Meta", archived: "Archived", builtin: "Builtin" };
  return known[lower] || raw.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

export function filterKey(tag) {
  return String(tag || "").trim().toLowerCase();
}
