const DEFAULT_ARTNET_ALIASES = Object.freeze(["udp", "network", "art-net"]);

export function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

export function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

export function normalizeTransport(value, {
  defaultValue = "serial",
  aliases = DEFAULT_ARTNET_ALIASES,
  unknownToDefault = false
} = {}) {
  const t = String(value || defaultValue).trim().toLowerCase();
  if (aliases.includes(t)) return "artnet";
  if (unknownToDefault && t !== "serial" && t !== "artnet") return defaultValue;
  return t;
}

