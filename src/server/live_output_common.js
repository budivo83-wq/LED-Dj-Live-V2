const DEFAULT_ARTNET_ALIASES = Object.freeze(["udp", "network", "art-net"]);
const DEFAULT_PATTERN_SET = Object.freeze(["blackout", "red", "green", "blue", "white-low", "single-pixel-chase"]);

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

export function normalizePattern(value, {
  defaultValue = "single-pixel-chase",
  allowed = DEFAULT_PATTERN_SET,
  unknownValue = defaultValue
} = {}) {
  const pattern = String(value || defaultValue).trim().toLowerCase();
  return allowed.includes(pattern) ? pattern : unknownValue;
}

export function normalizeLiveOutputRequest(request = {}, options = {}) {
  const defaultTransportKind = options.defaultTransportKind || "serial";
  const defaultPattern = options.defaultPattern || "single-pixel-chase";
  const defaultSource = options.defaultSource || "";
  const transportKind = normalizeTransport(request.transportKind || request.transport || request.outputMode, {
    defaultValue: defaultTransportKind,
    aliases: options.transportAliases || DEFAULT_ARTNET_ALIASES,
    unknownToDefault: options.unknownTransportToDefault === true
  });
  const pattern = normalizePattern(request.pattern || request.testPattern, {
    defaultValue: defaultPattern,
    allowed: options.patternAllowed || DEFAULT_PATTERN_SET,
    unknownValue: options.unknownPatternValue || defaultPattern
  });
  const physical = Boolean(request.physical || request.real || request.dryRun === false);
  return Object.freeze({
    requested: Boolean(options.requested ?? request.requested ?? request.start ?? request.commit),
    commit: Boolean(options.commit ?? request.commit ?? request.writeNow),
    dryRun: options.dryRun ?? request.dryRun !== false,
    physical,
    transportKind,
    pattern,
    pixels: clampInt(request.pixels ?? request.pixelCount, 1, options.maxPixels || 150, options.defaultPixels || 30),
    frames: clampInt(request.frames ?? request.frameCount, 1, options.maxFrames || 8, options.defaultFrames || (physical ? 1 : 4)),
    brightness: clampNumber(request.brightness, 0, options.maxBrightness || 0.08, options.defaultBrightness || 0.03),
    serialPath: String(request.serialPath || request.path || request.portName || options.defaultSerialPath || ""),
    baudRate: clampInt(request.baudRate, options.minBaudRate || 9600, options.maxBaudRate || 3000000, options.defaultBaudRate || 115200),
    serialProtocol: String(request.serialProtocol || request.protocol || options.defaultSerialProtocol || process.env.LED_SERIAL_PROTOCOL || "blx-v2").trim().toLowerCase(),
    host: String(request.host || request.ip || request.target?.host || request.target?.ip || options.defaultHost || "127.0.0.1"),
    artnetPort: clampInt(request.artnetPort || request.target?.port || request.port, 1, 65535, options.defaultArtnetPort || 6454),
    universe: clampInt(request.universe, 0, options.maxUniverse || 32767, options.defaultUniverse || 0),
    seq: clampInt(request.seq ?? request.sequence, 0, options.maxSeq || 65535, options.defaultSeq || 1),
    frameId: clampInt(request.frameId, 1, options.maxFrameId || 0xffffffff, options.defaultFrameId || 1),
    armToken: request.armToken ? String(request.armToken) : null,
    token: String(request.fullLiveToken || request.token || options.defaultToken || ""),
    fullLiveToken: request.fullLiveToken || request.token ? String(request.fullLiveToken || request.token) : (options.defaultFullLiveToken ?? null),
    operatorConfirmed: Boolean(options.operatorConfirmed ?? request.operatorConfirmed),
    confirmation: String((options.confirmation ?? request.confirmation) || ""),
    mappingDigest: String(request.mappingDigest || options.defaultMappingDigest || ""),
    transportPlanDigest: String(request.transportPlanDigest || request.routeDigest || options.defaultTransportPlanDigest || options.defaultMappingDigest || ""),
    source: String(options.defaultSource || request.source || defaultSource)
  });
}
