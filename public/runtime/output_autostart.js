// Restores live output intent after a full app/server restart.
// Keep this tiny and side-effect free outside init: settings.js owns the UI,
// this bridge only makes the runtime honor the persisted OUTPUT ON choice.

function safeParseStorage(storageRef, key, fallback = {}) {
  try {
    const parsed = JSON.parse(storageRef?.getItem?.(key) || "{}");
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function boolValue(value) {
  return value === true || value === "true";
}


function normalizeSerialProtocol(value) {
  const protocol = String(value || "aa_len_rgb").toLowerCase();
  return protocol === "aa_len_rgb" ? protocol : "aa_len_rgb";
}

function clampInt(value, min, max, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

async function openSerialPort(fetchRef, path, baudRate) {
  if (!path) return { ok: false, skipped: true, reason: "missing serial path" };
  const response = await fetchRef("/api/serial/open", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, baudRate })
  });
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  return {
    ok: response.ok && body?.open !== false && body?.ok !== false,
    status: response.status,
    body
  };
}

export function restoreOutputAutostart({
  storageRef = globalThis.localStorage,
  fetchRef = globalThis.fetch?.bind(globalThis),
  settingsKey,
  serialKey,
  settings,
  serialSettings,
  setSerialSettings,
  telemetryBus,
  windowRef = globalThis.window,
  logger = console
} = {}) {
  if (!storageRef || !settingsKey || !serialKey) return { started: false, reason: "missing storage keys" };

  const storedSettings = safeParseStorage(storageRef, settingsKey);
  const storedSerial = safeParseStorage(storageRef, serialKey);
  const serialEnabled = boolValue(storedSerial.enabled);
  const blxEnabled = boolValue(storedSettings.blxEnabled);
  const blxTransport = storedSettings.blxTransport === "net" ? "net" : "serial";

  const normalizedSerial = {
    ...(serialSettings || {}),
    enabled: serialEnabled,
    path: String(storedSerial.path || serialSettings?.path || ""),
    baudRate: clampInt(storedSerial.baudRate ?? serialSettings?.baudRate, 9600, 3000000, 115200),
    fps: clampInt(storedSerial.fps ?? serialSettings?.fps, 1, 120, 30),
    protocol: normalizeSerialProtocol(storedSerial.protocol ?? serialSettings?.protocol),
    packetFormat: "aa_len_rgb",
    packetLabel: "0xAA + LEN16_PIXELS_LE + RGB",
    simpleAaPixels: clampInt(storedSerial.simpleAaPixels ?? storedSerial.aaPixels ?? serialSettings?.simpleAaPixels ?? serialSettings?.aaPixels, 1, 2400, 160),
    aaPixels: clampInt(storedSerial.aaPixels ?? storedSerial.simpleAaPixels ?? serialSettings?.aaPixels ?? serialSettings?.simpleAaPixels, 1, 2400, 160),
    brightness: clampInt(storedSerial.brightness ?? storedSerial.testBrightness ?? serialSettings?.brightness ?? serialSettings?.testBrightness, 0, 255, 20),
    testBrightness: clampInt(storedSerial.testBrightness ?? storedSerial.brightness ?? serialSettings?.testBrightness ?? serialSettings?.brightness, 0, 255, 20)
  };
  setSerialSettings?.(normalizedSerial);

  if (settings) {
    settings.blxEnabled = blxEnabled;
    settings.blxTransport = blxTransport;
    settings.blxSerialPort = String(storedSettings.blxSerialPort || settings.blxSerialPort || "");
    settings.blxSerialBaud = clampInt(storedSettings.blxSerialBaud ?? settings.blxSerialBaud, 9600, 3000000, 1000000);
  }

  const wantsSerialPort = serialEnabled || (blxEnabled && blxTransport === "serial");
  const activePath = blxEnabled && blxTransport === "serial"
    ? String(storedSettings.blxSerialPort || "")
    : normalizedSerial.path;
  const activeBaud = blxEnabled && blxTransport === "serial"
    ? clampInt(storedSettings.blxSerialBaud, 9600, 3000000, 1000000)
    : normalizedSerial.baudRate;

  const result = {
    started: serialEnabled || blxEnabled,
    serialEnabled,
    blxEnabled,
    blxTransport,
    wantsSerialPort,
    path: activePath,
    baudRate: activeBaud,
    opened: false,
    reason: serialEnabled || blxEnabled ? "restore requested" : "no persisted output enabled"
  };

  windowRef.__ledOutputAutostart = result;
  telemetryBus?.recordOutputMetric?.({ outputAutostart: result });

  if (!wantsSerialPort || typeof fetchRef !== "function") return result;

  // Fire-and-report: the render loop must not wait for serial enumeration/opening.
  openSerialPort(fetchRef, activePath, activeBaud)
    .then((openResult) => {
      result.opened = Boolean(openResult.ok);
      result.openResult = openResult;
      result.reason = result.opened ? "serial reopened" : (openResult.reason || "serial reopen failed");
      windowRef.__ledOutputAutostart = result;
      telemetryBus?.recordOutputMetric?.({ outputAutostart: result });
      if (!result.opened) logger?.warn?.("LED output autostart did not reopen serial", result);
    })
    .catch((error) => {
      result.opened = false;
      result.reason = error?.message || "serial reopen error";
      windowRef.__ledOutputAutostart = result;
      telemetryBus?.recordOutputMetric?.({ outputAutostart: result });
      logger?.warn?.("LED output autostart failed", error);
    });

  return result;
}
