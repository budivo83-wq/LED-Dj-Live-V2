(function(){
  const VERSION = "13BU-CJ-fps-state-rescue";
  const SETTINGS_KEY = "led-engine-settings-v1";
  const SERIAL_KEY = "led-engine-serial-v1";
  const STATE_KEY = "led-engine-state-v3";
  const FLAGS_KEY = "led-engine-feature-flags-v1";
  const RESCUE_KEY = "led-engine-fps-rescue-13bu-cj";
  const SAFE_SERIAL = { enabled: false, fps: 60, protocol: "aa_len_rgb", baudRate: 1000000, simpleAaPixels: 160, aaPixels: 160 };
  const SAFE_SETTINGS = { fps: 60, outputMode: "preview", blxEnabled: false, blxTransport: "serial", runtimePreset: "normal-pc", adaptiveFpsMode: "off", adaptiveApplyMode: "soft-ui", raspiMode: false, ledStartOff: true };
  const SAFE_FLAGS = { useNewCentralState:false, useNewFramePipeline:false, useNewMapping:false, useNewOutput:false, useNewPreview:false, useNewEvents:false, useNewTelemetry:false };
  function json(k){ try { return JSON.parse(localStorage.getItem(k) || "null") || {}; } catch { return {}; } }
  function put(k,v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
  function clamp(n,min,max,fb){ n = Number(n); return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : fb; }
  function sanitizeSoft(){
    const s = json(SETTINGS_KEY);
    const serial = json(SERIAL_KEY);
    const state = json(STATE_KEY);
    let changed = false;
    const nextSettings = { ...s };
    nextSettings.fps = clamp(nextSettings.fps, 1, 120, SAFE_SETTINGS.fps);
    if (nextSettings.raspiMode === true && String(nextSettings.runtimePreset || "").startsWith("normal")) nextSettings.runtimePreset = "raspi-stable";
    if (nextSettings.raspiMode !== true) {
      nextSettings.raspiMode = false;
      nextSettings.runtimePreset = "normal-pc";
      nextSettings.adaptiveFpsMode = "off";
    }
    if (!["off","cpu","serial","auto"].includes(String(nextSettings.adaptiveFpsMode || "off").toLowerCase())) nextSettings.adaptiveFpsMode = "off";
    if (!["preview","artnet","sacn","wifi","espnow"].includes(String(nextSettings.outputMode || "preview"))) nextSettings.outputMode = "preview";
    changed = changed || JSON.stringify(nextSettings) !== JSON.stringify(s);
    if (changed) put(SETTINGS_KEY, nextSettings);

    const nextSerial = { ...serial };
    nextSerial.fps = clamp(nextSerial.fps, 1, 60, SAFE_SERIAL.fps);
    nextSerial.protocol = "aa_len_rgb";
    nextSerial.simpleAaPixels = clamp(nextSerial.simpleAaPixels || nextSerial.aaPixels, 1, 2400, 160);
    nextSerial.aaPixels = nextSerial.simpleAaPixels;
    nextSerial.baudRate = clamp(nextSerial.baudRate, 9600, 3000000, SAFE_SERIAL.baudRate);
    if (JSON.stringify(nextSerial) !== JSON.stringify(serial)) put(SERIAL_KEY, nextSerial);

    if (state && typeof state === "object") {
      const nextState = { ...state };
      if (nextState.settings && typeof nextState.settings === "object") nextState.settings = { ...nextState.settings, fps: clamp(nextState.settings.fps, 1, 120, 60) };
      if (JSON.stringify(nextState) !== JSON.stringify(state)) put(STATE_KEY, nextState);
    }
  }
  function hardReset(){
    put(SETTINGS_KEY, SAFE_SETTINGS);
    put(SERIAL_KEY, SAFE_SERIAL);
    put(FLAGS_KEY, SAFE_FLAGS);
    try { localStorage.removeItem("led-engine-controlled-arm-intent-v1"); } catch {}
    try { localStorage.removeItem("led-engine-raspi-live-health-resume-13bu"); } catch {}
    try { sessionStorage.clear(); } catch {}
    try { localStorage.setItem(RESCUE_KEY, JSON.stringify({ version: VERSION, at: new Date().toISOString(), mode: "hard" })); } catch {}
    location.reload();
  }
  try { sanitizeSoft(); } catch {}
  window.LED_DJ_FPS_RESCUE_13BU_CJ = { version: VERSION, sanitizeSoft, hardReset };
})();
