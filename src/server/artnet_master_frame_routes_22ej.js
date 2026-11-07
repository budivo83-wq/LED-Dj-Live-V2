import { STEP22EJ_ARTNET_MASTER_FRAME_VERSION, artnetMasterFrameStore22EJ } from '../output/artnet_master_frame_store_22ej.js';

export const STEP22EL_ARTNET_MASTER_BRIDGE_MONITOR_VERSION = 'STEP22EL_MASTER_BRIDGE_MONITOR';

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function ageLabel(ms) {
  if (ms == null) return 'none';
  if (ms <= 1500) return 'fresh';
  if (ms <= 5000) return 'warm';
  return 'stale';
}

function diagnoseBridge(masterStatus = {}, liveStatus = {}) {
  const running = liveStatus?.running === true;
  const source = liveStatus?.lastSummary?.frameSource || liveStatus?.lastSummary?.visualPattern || liveStatus?.options?.visualPattern || 'unknown';
  const socketReady = liveStatus?.network?.socketReady === true;
  const lastSent = liveStatus?.lastSendResult?.sent === true;
  const lastReason = liveStatus?.lastSendResult?.reason || '-';
  const masterHasFrame = masterStatus?.hasFrame === true;
  const masterFresh = masterStatus?.fresh === true;
  const masterAgeMs = masterStatus?.ageMs ?? null;

  let stage = 'IDLE';
  let ok = false;
  let verdict = 'SAFE LIVE není spuštěný.';
  let next = 'Nastav IP/bind, dej Připravit socket a pak SAFE MASTER LIVE.';

  if (running && source === 'master-framebus' && masterFresh && socketReady && lastSent) {
    stage = 'GREEN'; ok = true;
    verdict = 'Performance MASTER frame teče do server mirroru a ArtNet sender odesílá UDP packety.';
    next = 'Teď kontroluj reálný node / OLA / WLED/ArtNet receiver. Když LED nesvítí, problém je až mimo aplikaci: IP, universe, node mapping nebo kabel/síť.';
  } else if (!masterHasFrame) {
    stage = 'NO_MASTER_FRAME';
    verdict = 'Server mirror zatím nedostal žádný MASTER frame.';
    next = 'Otevři Performance index.html, zapni MASTER mirror, nebo použij MASTER self-test frame pro oddělení problému.';
  } else if (!masterFresh) {
    stage = 'MASTER_STALE';
    verdict = `MASTER frame existuje, ale je starý (${masterAgeMs} ms).`;
    next = 'Obnov Performance index.html a zkontroluj, že mirror zůstává zapnutý. Pro ArtNet cestu můžeš použít self-test.';
  } else if (running && source !== 'master-framebus') {
    stage = 'FALLBACK_SOURCE';
    verdict = `Sender běží, ale aktuální zdroj není reálný MASTER framebus (${source}).`;
    next = 'Přepni Source na MASTER / Performance a spusť znovu, nebo nejdřív potvrď výstup přes test chase.';
  } else if (running && !socketReady) {
    stage = 'SOCKET_WAIT';
    verdict = 'SAFE LIVE běží, ale UDP socket ještě není ready.';
    next = 'Dej Připravit socket, případně změň Bind IP na auto nebo správnou síťovku.';
  } else if (running && !lastSent) {
    stage = 'NOT_SENT';
    verdict = `Sender běží, ale poslední frame nebyl odeslán (${lastReason}).`;
    next = 'Zkontroluj ERR, target IP, bind IP a jestli se nezasekl předchozí UDP batch.';
  } else if (!running && masterFresh) {
    stage = 'READY_TO_START';
    ok = true;
    verdict = 'MASTER frame je čerstvý. ArtNet sender ještě neběží.';
    next = 'Můžeš dát SAFE MASTER LIVE.';
  }

  return Object.freeze({ ok, stage, verdict, next, source, socketReady, lastSent, lastReason, masterAge: ageLabel(masterAgeMs) });
}

function buildPatchReport(patch = null) {
  const routes = Array.isArray(patch?.routes) ? patch.routes : [];
  if (!routes.length) {
    return {
      ok: false,
      hasPatch: false,
      summary: 'No Art-Net patch published on server yet.',
      strips: [],
      universes: []
    };
  }
  const stripMap = new Map();
  const universeMap = new Map();
  for (const route of routes) {
    const stripIndex = Number(route.stripIndex || 0);
    const strip = stripMap.get(stripIndex) || { stripIndex, pixels: 0, universes: [] };
    strip.pixels += Number(route.pixelCount || 0);
    strip.universes.push(`U${route.universe}:${route.startAddress}-${route.startAddress + route.pixelCount - 1}`);
    stripMap.set(stripIndex, strip);

    const universe = Number(route.universe || 0);
    const target = String(route.outputIp || route.targetIp || route.host || '').trim() || 'default';
    const targetPort = Number(route.targetPort || route.port || 6454) || 6454;
    const universeKey = `${target}:${targetPort}:${universe}`;
    const uni = universeMap.get(universeKey) || { universe, target, targetPort, pixels: 0, strips: new Set(), ranges: [] };
    uni.pixels += Number(route.pixelCount || 0);
    uni.strips.add(stripIndex);
    uni.ranges.push(`S${stripIndex}:${route.startAddress}-${route.startAddress + route.pixelCount - 1}`);
    universeMap.set(universeKey, uni);
  }
  const strips = [...stripMap.values()]
    .sort((a, b) => a.stripIndex - b.stripIndex)
    .map((row) => ({
      ...row,
      universes: row.universes.join(' | '),
      summary: `S${row.stripIndex} · ${row.pixels}px · ${row.universes.join(' | ')}`
    }));
  const universes = [...universeMap.values()]
    .sort((a, b) => a.universe - b.universe)
    .map((row) => ({
      universe: row.universe,
      pixels: row.pixels,
      stripCount: row.strips.size,
      strips: [...row.strips].sort((a, b) => a - b),
      ranges: row.ranges.join(' | '),
      target: row.target,
      targetPort: row.targetPort,
      summary: `${row.target || 'default'}:${row.targetPort || 6454} · U${row.universe} · ${row.pixels}px · strips ${([...row.strips].sort((a, b) => a - b)).join(', ')} · ${row.ranges.join(' | ')}`
    }));
  return {
    ok: true,
    hasPatch: true,
    width: patch.width,
    height: patch.height,
    routeCount: routes.length,
    summary: `${strips.length} strips · ${universes.length} universes · ${routes.length} route parts`,
    strips,
    universes
  };
}

export function registerArtNetMasterFrameRoutes22EJ(app, { expressRef, store = artnetMasterFrameStore22EJ, liveSender22DQ = null } = {}) {
  const rawParser = expressRef?.raw?.({ type: 'application/octet-stream', limit: '16mb' });
  const jsonParser = expressRef?.json?.({ limit: '16mb' });

  app.get('/api/artnet/master-mirror/status', (_req, res) => {
    try { res.json(store.status()); }
    catch (error) { res.status(500).json({ ok: false, version: STEP22EJ_ARTNET_MASTER_FRAME_VERSION, error: error.message }); }
  });

  app.post('/api/artnet/master-mirror/patch', jsonParser, (req, res) => {
    try {
      const body = req.body || {};
      const result = store.publishPatch({
        ...body,
        artnetPatch: body.artnetPatch || body.patch || body
      });
      res.json(result);
    } catch (error) {
      res.status(400).json({ ok: false, version: STEP22EJ_ARTNET_MASTER_FRAME_VERSION, error: error.message });
    }
  });

  app.get('/api/artnet/master-mirror/patch-report', (_req, res) => {
    try {
      const patch = store.getLatestPatch?.() || null;
      res.json({
        ok: true,
        version: STEP22EJ_ARTNET_MASTER_FRAME_VERSION,
        patch: patch ? {
          version: patch.version,
          source: patch.source,
          width: patch.width,
          height: patch.height,
          totalPixels: patch.totalPixels,
          publishedAt: patch.publishedAt
        } : null,
        report: buildPatchReport(patch)
      });
    } catch (error) {
      res.status(500).json({ ok: false, version: STEP22EJ_ARTNET_MASTER_FRAME_VERSION, error: error.message });
    }
  });

  // STEP22LD: binary read endpoint for External preview.
  // This lets preview consumer consume the same server MASTER frame mirror as
  // Performance/ArtNet output instead of drawing an independent fake preview.
  app.get('/api/artnet/master-mirror/frame-bin', (req, res) => {
    try {
      const q = req.query || {};
      const latest = store.getLatest({
        maxAgeMs: clampInt(q.maxAgeMs, 50, 30000, 5000),
        stripCount: q.stripCount,
        pixelsPerStrip: q.pixelsPerStrip
      });
      if (!latest) {
        res.status(404).json({ ok: false, version: STEP22EJ_ARTNET_MASTER_FRAME_VERSION, error: 'NO_FRESH_MASTER_FRAME', status: store.status() });
        return;
      }
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-LED-Frame-Id', String(latest.frameId || 0));
      res.setHeader('X-LED-Source', String(latest.source || 'master-framebus'));
      res.setHeader('X-LED-Width', String(latest.width || latest.pixelsPerStrip || 300));
      res.setHeader('X-LED-Height', String(latest.height || latest.stripCount || 8));
      res.setHeader('X-LED-Strip-Count', String(latest.stripCount || 8));
      res.setHeader('X-LED-Pixels-Per-Strip', String(latest.pixelsPerStrip || 300));
      res.setHeader('X-LED-Age-Ms', String(latest.ageMs || 0));
      res.setHeader('X-LED-Published-At', String(latest.publishedAt || latest.wallClock || Date.now()));
      res.end(Buffer.from(latest.frame));
    } catch (error) {
      res.status(500).json({ ok: false, version: STEP22EJ_ARTNET_MASTER_FRAME_VERSION, error: error.message });
    }
  });

  app.get('/api/artnet/master-bridge/monitor', (_req, res) => {
    try {
      const master = store.status();
      const live = liveSender22DQ?.status ? liveSender22DQ.status() : null;
      res.json({
        ok: true,
        version: STEP22EL_ARTNET_MASTER_BRIDGE_MONITOR_VERSION,
        at: Date.now(),
        master,
        live,
        diagnosis: diagnoseBridge(master, live || {})
      });
    } catch (error) {
      res.status(500).json({ ok: false, version: STEP22EL_ARTNET_MASTER_BRIDGE_MONITOR_VERSION, error: error.message });
    }
  });

  app.post('/api/artnet/master-mirror/frame-bin', rawParser, (req, res) => {
    try {
      const q = req.query || {};
      const frame = req.body instanceof Uint8Array ? req.body : new Uint8Array(req.body || []);
      const publishResult = store.publish({
        frame,
        source: q.source || 'performance-framebus-artnet-binary',
        frameId: clampInt(q.frameId, 0, 2147483647, 0),
        stripCount: clampInt(q.stripCount ?? q.height, 1, 64, 8),
        pixelsPerStrip: clampInt(q.pixelsPerStrip ?? q.width, 1, 1000, 300),
        width: clampInt(q.width, 1, 65535, 300),
        height: clampInt(q.height, 1, 65535, 8),
        format: q.format || 'rgb8',
        colorOrder: q.colorOrder || 'rgb'
      });
      if (publishResult?.dropped === true || publishResult?.accepted === false) {
        res.setHeader('X-LED-Master-Frame-Dropped', String(publishResult.reason || 'dropped'));
        res.status(202).end();
        return;
      }
      try { liveSender22DQ?.sendLatestMasterEvent?.({ frameId: clampInt(q.frameId, 0, 2147483647, 0), publishResult }); } catch {}
      res.status(204).end();
    } catch (error) {
      res.status(400).json({ ok: false, version: STEP22EJ_ARTNET_MASTER_FRAME_VERSION, error: error.message });
    }
  });

  app.post('/api/artnet/master-mirror/frame', jsonParser, (req, res) => {
    try {
      const body = req.body || {};
      const src = Array.isArray(body.rgb) ? body.rgb : (Array.isArray(body.frame) ? body.frame : []);
      const result = store.publish({
        frame: new Uint8Array(src.map((v) => Math.max(0, Math.min(255, Number(v) || 0)))),
        source: body.source || 'performance-framebus-artnet-json',
        frameId: clampInt(body.frameId, 0, 2147483647, 0),
        stripCount: clampInt(body.stripCount ?? body.height, 1, 64, 8),
        pixelsPerStrip: clampInt(body.pixelsPerStrip ?? body.width, 1, 1000, 300),
        width: clampInt(body.width, 1, 65535, 300),
        height: clampInt(body.height, 1, 65535, 8),
        format: body.format || 'rgb8',
        colorOrder: body.colorOrder || 'rgb'
      });
      res.json(result);
    } catch (error) {
      res.status(400).json({ ok: false, version: STEP22EJ_ARTNET_MASTER_FRAME_VERSION, error: error.message });
    }
  });

  app.post('/api/artnet/master-mirror/self-test', jsonParser, (req, res) => {
    try {
      const body = req.body || {};
      const stripCount = clampInt(body.stripCount ?? body.height, 1, 64, 8);
      const pixelsPerStrip = clampInt(body.pixelsPerStrip ?? body.width, 1, 1000, 300);
      const frame = new Uint8Array(stripCount * pixelsPerStrip * 3);
      const now = Date.now();
      for (let y = 0; y < stripCount; y += 1) {
        for (let x = 0; x < pixelsPerStrip; x += 1) {
          const i = (y * pixelsPerStrip + x) * 3;
          const phase = (x * 37 + y * 3 + Math.floor(now / 120)) & 255;
          frame[i] = phase;
          frame[i + 1] = (255 - phase);
          frame[i + 2] = ((x % 2) ? 220 : 40);
        }
      }
      const result = store.publish({
        frame,
        source: 'master-mirror-self-test-step22ek',
        frameId: clampInt(body.frameId, 0, 2147483647, Math.floor(now / 1000)),
        stripCount,
        pixelsPerStrip,
        format: 'rgb8',
        colorOrder: 'rgb'
      });
      res.json({ ...result, selfTest: true, note: 'MASTER mirror self-test frame published into server store. It does not require Performance page.' });
    } catch (error) {
      res.status(400).json({ ok: false, version: STEP22EJ_ARTNET_MASTER_FRAME_VERSION, error: error.message });
    }
  });
}
