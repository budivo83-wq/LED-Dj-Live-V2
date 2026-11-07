// Small pure helpers shared by render, UI and storage code.

export function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

export function clamp(value) {
  return Math.max(0, Math.min(255, Number(value) || 0));
}

export function clampInt(value, min, max, fallback) {
  const number = Number.parseInt(value, 10);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

export function numberValue(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? clamp01(number) : fallback;
}

export function bpmValue(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 120;
  return Math.max(40, Math.min(220, Math.round(number * 2) / 2));
}

export function gammaValue(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 2.2;
  return Math.max(1, Math.min(3.5, Math.round(number * 10) / 10));
}

export function contrastValue(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 1.35;
  return Math.max(0.5, Math.min(2.5, Math.round(number * 20) / 20));
}

export function transitionSecondsValue(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 1.5;
  return Math.max(0.1, Math.min(20, Math.round(number * 10) / 10));
}

export function clampResetId(value) {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

export function beatStartedAtValue(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : Date.now();
}

export function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

export function randomParam() {
  return Math.round((0.12 + Math.random() * 0.82) * 100) / 100;
}

export function mixColor(a, b, amount) {
  return a.map((value, index) => value * (1 - amount) + b[index] * amount);
}

export function easeInOut(value) {
  return value * value * (3 - 2 * value);
}
