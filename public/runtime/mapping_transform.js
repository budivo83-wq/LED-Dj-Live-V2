export function routeMatchesMode(route, mode, fallbackWhenUnrouted = false) {
  const normalizedRoute = String(route || "none").toLowerCase();
  const normalizedMode = String(mode || "preview").toLowerCase();
  if (normalizedRoute === "none") return Boolean(fallbackWhenUnrouted);

  // User-facing "serial" means the physical serial cable.
  // It must therefore also pass when the app is using the BLX serial protocol.
  if (normalizedRoute === "serial") return normalizedMode === "serial" || normalizedMode === "preview" || normalizedMode === "wifi" || normalizedMode === "espnow";
  if (normalizedRoute === "blx") return normalizedMode === "blx_serial" || normalizedMode === "blx_net";
  if (normalizedRoute === "artnet") return normalizedMode === "artnet";
  if (normalizedRoute === "sacn") return normalizedMode === "sacn";
  if (normalizedRoute === "dmx") return normalizedMode === "dmx";
  return false;
}

export function hasExplicitOutputRoutes(routes = []) {
  return routes.some((route) => {
    const normalized = String(route || "none").toLowerCase();
    return normalized !== "" && normalized !== "none";
  });
}


export function shouldUseLegacySerialPayload(rows = {}, mode = "preview") {
  const normalizedMode = String(mode || "preview").toLowerCase();
  if (normalizedMode !== "blx_serial") return false;
  const routes = Array.isArray(rows?.route) ? rows.route : [];
  const normalizedRoutes = routes.map((route) => String(route || "none").toLowerCase());
  const hasSerial = normalizedRoutes.includes("serial");
  const hasBlx = normalizedRoutes.includes("blx");
  return hasSerial && !hasBlx;
}


export function effectiveSerialRoutingMode(rows = {}, mode = "preview") {
  return shouldUseLegacySerialPayload(rows, mode) ? "serial" : String(mode || "preview").toLowerCase();
}

export function buildSerialFrame(frame, width, height, rows, mode) {
  const serialFrame = new Uint8Array(frame.length);
  const reversedRows = rows?.reversed || [];
  const enabledRows = rows?.enabled || [];
  const brightnessRows = rows?.brightness || [];
  const pixelLimitRows = rows?.pixelLimit || [];
  const outputRouteRows = rows?.route || [];
  const colorOrderRows = rows?.colorOrder || [];
  const fallbackWhenUnrouted = !hasExplicitOutputRoutes(outputRouteRows);

  for (let y = 0; y < height; y += 1) {
    const route = String(outputRouteRows[y] || "none").toLowerCase();
    const routeAllowed = routeMatchesMode(route, mode, fallbackWhenUnrouted);
    const rowEnabled = enabledRows[y] !== false;
    const rowBrightness = Number.isFinite(brightnessRows[y]) ? Math.max(0, Math.min(1, brightnessRows[y])) : 1;
    const pixelLimit = Number.isFinite(pixelLimitRows[y]) ? Math.max(0, Math.min(width, pixelLimitRows[y])) : width;
    const reversed = Boolean(reversedRows[y]);
    for (let x = 0; x < width; x += 1) {
      const sourceX = reversed ? width - 1 - x : x;
      const srcOffset = (y * width + sourceX) * 3;
      const dstOffset = (y * width + x) * 3;
      if (!routeAllowed || !rowEnabled || x >= pixelLimit) {
        serialFrame[dstOffset] = 0;
        serialFrame[dstOffset + 1] = 0;
        serialFrame[dstOffset + 2] = 0;
        continue;
      }
      const ordered = applyColorOrder(
        frame[srcOffset] || 0,
        frame[srcOffset + 1] || 0,
        frame[srcOffset + 2] || 0,
        colorOrderRows[y]
      );
      serialFrame[dstOffset] = Math.max(0, Math.min(255, Math.round(ordered[0] * rowBrightness)));
      serialFrame[dstOffset + 1] = Math.max(0, Math.min(255, Math.round(ordered[1] * rowBrightness)));
      serialFrame[dstOffset + 2] = Math.max(0, Math.min(255, Math.round(ordered[2] * rowBrightness)));
    }
  }

  return serialFrame;
}


function applyColorOrder(r, g, b, order = "RGB") {
  const channels = { R: r, G: g, B: b };
  const normalized = String(order || "RGB").toUpperCase();
  if (!/^[RGB]{3}$/.test(normalized)) return [r, g, b];
  return [
    channels[normalized[0]] ?? r,
    channels[normalized[1]] ?? g,
    channels[normalized[2]] ?? b
  ];
}

export function buildSegmentedFrameForMode(frame, width, height, rows, mode) {
  const pixelLimitRows = rows?.pixelLimit || [];
  const outputRouteRows = rows?.route || [];
  const selectedRows = [];
  const fallbackWhenUnrouted = !hasExplicitOutputRoutes(outputRouteRows);
  let maxPixels = 0;
  let totalPixels = 0;

  for (let y = 0; y < height; y += 1) {
    const route = String(outputRouteRows[y] || "none").toLowerCase();
    if (!routeMatchesMode(route, mode, fallbackWhenUnrouted)) continue;
    const limit = Number.isFinite(pixelLimitRows[y]) ? Math.max(1, Math.min(width, pixelLimitRows[y])) : width;
    selectedRows.push({ y, limit });
    maxPixels = Math.max(maxPixels, limit);
    totalPixels += limit;
  }

  const segments = [];
  const raw = new Uint8Array(totalPixels * 3);
  let rawCursor = 0;
  for (let i = 0; i < selectedRows.length; i += 1) {
    const row = selectedRows[i];
    const pixels = new Uint8Array(row.limit * 3);
    let cursor = 0;
    for (let x = 0; x < row.limit; x += 1) {
      const offset = (row.y * width + x) * 3;
      const r = frame[offset] || 0;
      const g = frame[offset + 1] || 0;
      const b = frame[offset + 2] || 0;
      pixels[cursor++] = r;
      pixels[cursor++] = g;
      pixels[cursor++] = b;
      raw[rawCursor++] = r;
      raw[rawCursor++] = g;
      raw[rawCursor++] = b;
    }
    segments.push({ segmentId: i, pixels });
  }
  return { segments, raw, maxPixels, pixels: totalPixels };
}

export function buildRoutedFrameForMode(frame, width, height, rows, mode) {
  const pixelLimitRows = rows?.pixelLimit || [];
  const outputRouteRows = rows?.route || [];
  const selectedRows = [];
  const fallbackWhenUnrouted = !hasExplicitOutputRoutes(outputRouteRows);
  let ledsPerStrip = 0;

  for (let y = 0; y < height; y += 1) {
    const route = String(outputRouteRows[y] || "none").toLowerCase();
    if (!routeMatchesMode(route, mode, fallbackWhenUnrouted)) continue;
    const limit = Number.isFinite(pixelLimitRows[y]) ? Math.max(1, Math.min(width, pixelLimitRows[y])) : width;
    ledsPerStrip = Math.max(ledsPerStrip, limit);
    selectedRows.push({ y, limit });
  }

  if (!selectedRows.length || ledsPerStrip <= 0) {
    return { data: new Uint8Array(0), strips: 0, ledsPerStrip: 0 };
  }

  const data = new Uint8Array(selectedRows.length * ledsPerStrip * 3);
  let cursor = 0;
  for (const row of selectedRows) {
    for (let x = 0; x < ledsPerStrip; x += 1) {
      const offset = (row.y * width + x) * 3;
      if (x < row.limit) {
        data[cursor++] = frame[offset] || 0;
        data[cursor++] = frame[offset + 1] || 0;
        data[cursor++] = frame[offset + 2] || 0;
      } else {
        data[cursor++] = 0;
        data[cursor++] = 0;
        data[cursor++] = 0;
      }
    }
  }
  return { data, strips: selectedRows.length, ledsPerStrip };
}

export function wrapBlxNetTransportPacket(packet, targetIp, port) {
  const targetBytes = new TextEncoder().encode(targetIp);
  const targetLen = Math.min(255, targetBytes.length);
  const payload = new Uint8Array(7 + targetLen + packet.length + 2);
  payload[0] = 66;
  payload[1] = 76;
  payload[2] = 88;
  payload[3] = 2;
  payload[4] = packet.length & 255;
  payload[5] = (packet.length >> 8) & 255;
  payload[6] = targetLen;
  if (targetLen > 0) payload.set(targetBytes.subarray(0, targetLen), 7);
  const frameOffset = 7 + targetLen;
  payload.set(packet, frameOffset);
  payload[payload.length - 2] = port & 255;
  payload[payload.length - 1] = (port >> 8) & 255;
  return payload;
}

export function clampPort(value) {
  const port = Number.parseInt(value, 10);
  if (!Number.isFinite(port)) return 7777;
  return Math.max(1, Math.min(65535, port));
}
