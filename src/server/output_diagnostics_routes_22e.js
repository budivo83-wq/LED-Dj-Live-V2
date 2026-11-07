import { createFrameInspector22E, inspectRawSerialPacket } from '../output/frame_inspector_22e.js';

function getManager(context = {}) {
  return context.outputManager22C || context.outputManager || null;
}

function getInspector(context = {}) {
  return context.frameInspector22E || context.frameInspector || null;
}

function requireDiagnosticsDeps(context = {}) {
  const manager = getManager(context);
  const inspector = getInspector(context);
  if (!manager || !inspector) {
    const error = new Error('AUTHORITATIVE_OUTPUT_DIAGNOSTICS_UNAVAILABLE');
    error.statusCode = 503;
    throw error;
  }
  return { manager, inspector };
}

export function registerOutputDiagnosticsRoutes22E(app, context = {}) {
  const jsonParser = context.expressRef?.json?.({ limit: '256kb' });

  app.get('/api/output-diagnostics/22e', (_req, res) => {
    try {
      const { manager, inspector } = requireDiagnosticsDeps(context);
      const managerStatus = typeof manager.getStatus === 'function' ? manager.getStatus() : {};
      res.json(inspector.getSnapshot(managerStatus));
    } catch (error) {
      res.status(error.statusCode || 400).json({ ok: false, error: String(error?.message || error) });
    }
  });

  app.post('/api/output-diagnostics/22e/inspect-packet', jsonParser, (req, res) => {
    try {
      const expectedPixels = req.body?.expectedPixels ?? req.body?.pixels ?? 160;
      const bytes = normalizePacketBytes(req.body?.packet ?? req.body?.bytes ?? req.body?.data ?? []);
      res.json({ ok: true, inspection: inspectRawSerialPacket(Buffer.from(bytes), expectedPixels) });
    } catch (error) {
      res.status(400).json({ ok: false, error: String(error?.message || error) });
    }
  });
}

function normalizePacketBytes(value) {
  if (Array.isArray(value)) return value.map((item) => Number(item) & 0xff);
  if (typeof value === 'string') {
    return value.trim().split(/[\s,]+/).filter(Boolean).map((token) => Number.parseInt(token.replace(/^0x/i, ''), 16) & 0xff);
  }
  return [];
}
