export const MAPPING_V2_TEST_OUTPUT_KEY = "led-engine-mapping-v2-test-output";

export function createDefaultMappingTestOutput() {
  return {
    schema: "mapping-v2-test-output",
    armed: false,
    pattern: "off",
    selectedIndex: 0,
    color: "#00d9ff",
    speed: 1,
    updatedAt: 0
  };
}

export function normalizeMappingTestOutput(input = {}) {
  const pattern = normalizePattern(input.pattern);
  return {
    schema: "mapping-v2-test-output",
    armed: Boolean(input.armed) && pattern !== "off",
    pattern,
    selectedIndex: clampInt(input.selectedIndex, 0, 4095, 0),
    color: normalizeColorHex(input.color || input.calibrationColor || "#00d9ff"),
    speed: clampNum(input.speed ?? input.calibrationSpeed, 0, 8, 1),
    updatedAt: Number.isFinite(Number(input.updatedAt)) ? Number(input.updatedAt) : Date.now()
  };
}

export function readMappingTestOutput(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem?.(MAPPING_V2_TEST_OUTPUT_KEY);
    return normalizeMappingTestOutput(raw ? JSON.parse(raw) : null);
  } catch {
    return createDefaultMappingTestOutput();
  }
}

export function writeMappingTestOutput(next, storage = globalThis.localStorage) {
  const normalized = normalizeMappingTestOutput({ ...next, updatedAt: Date.now() });
  try { storage?.setItem?.(MAPPING_V2_TEST_OUTPUT_KEY, JSON.stringify(normalized)); } catch {}
  return normalized;
}

export function clearMappingTestOutput(storage = globalThis.localStorage) {
  const normalized = createDefaultMappingTestOutput();
  try { storage?.setItem?.(MAPPING_V2_TEST_OUTPUT_KEY, JSON.stringify(normalized)); } catch {}
  return normalized;
}

export function applyMappingOutputTestFrame(frame, width, height, rows = {}, test = {}, now = performanceNow()) {
  const normalized = normalizeMappingTestOutput(test);
  if (!normalized.armed || normalized.pattern === "off") return frame;
  const w = Math.max(1, Number(width) | 0);
  const h = Math.max(1, Number(height) | 0);
  const out = new Uint8Array(frame.length);
  const enabledRows = rows.enabled || [];
  const pixelLimitRows = rows.pixelLimit || [];
  const routeRows = rows.route || [];
  const base = hexToRgb(normalized.color);
  const t = (Number(now) || 0) / 1000;

  for (let y = 0; y < h; y += 1) {
    const rowEnabled = enabledRows[y] !== false;
    const route = String(routeRows[y] || "none").toLowerCase();
    const activeRoute = route !== "none";
    const limit = Number.isFinite(pixelLimitRows[y]) ? Math.max(0, Math.min(w, pixelLimitRows[y])) : w;
    for (let x = 0; x < w; x += 1) {
      const off = (y * w + x) * 3;
      if (!rowEnabled || !activeRoute || x >= limit) {
        out[off] = 0; out[off + 1] = 0; out[off + 2] = 0;
        continue;
      }
      const rgb = colorForPattern(normalized, x, y, w, h, base, t);
      out[off] = rgb[0]; out[off + 1] = rgb[1]; out[off + 2] = rgb[2];
    }
  }
  return out;
}

function colorForPattern(test, x, y, width, height, base, t) {
  if (test.pattern === "selected") {
    return y === test.selectedIndex ? base : [0, 0, 0];
  }
  if (test.pattern === "solid") return base;
  if (test.pattern === "address") {
    const v = width <= 1 ? 255 : Math.round((x / (width - 1)) * 255);
    return [v, Math.round(255 - v * 0.45), Math.round(64 + v * 0.25)];
  }
  if (test.pattern === "universe") {
    const hue = (y * 53) % 360;
    return hsvToRgb(hue, 0.92, 1);
  }
  if (test.pattern === "rgb") {
    const zone = x % 3;
    if (zone === 0) return [255, 0, 0];
    if (zone === 1) return [0, 255, 0];
    return [0, 0, 255];
  }
  if (test.pattern === "chase") {
    const speed = Math.max(0, test.speed || 1);
    const pos = ((t * speed * 18) | 0) % Math.max(1, width);
    const d = Math.abs(x - pos);
    const glow = Math.max(0, 1 - d / 10);
    return [Math.round(base[0] * glow), Math.round(base[1] * glow), Math.round(base[2] * glow)];
  }
  return base;
}

function normalizePattern(value) {
  const pattern = String(value || "off").toLowerCase();
  return ["off", "selected", "solid", "address", "universe", "rgb", "chase"].includes(pattern) ? pattern : "off";
}

function normalizeColorHex(value) {
  const text = String(value || "#00d9ff").trim();
  return /^#[0-9a-f]{6}$/i.test(text) ? text.toLowerCase() : "#00d9ff";
}

function hexToRgb(hex) {
  const color = normalizeColorHex(hex).slice(1);
  return [0, 2, 4].map((i) => Number.parseInt(color.slice(i, i + 2), 16));
}

function hsvToRgb(h, s, v) {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

function clampInt(value, min, max, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function clampNum(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function performanceNow() {
  try { return performance.now(); } catch { return Date.now(); }
}
