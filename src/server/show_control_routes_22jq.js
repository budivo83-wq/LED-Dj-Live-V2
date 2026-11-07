import fs from 'node:fs';
import path from 'node:path';

const FILE_NAME = 'control-authority-pro-22jq.json';

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return null; }
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function clamp(n, min, max) {
  const v = Number(n);
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}

function normalizeConfig(input = {}) {
  const cfg = structuredClone(input);
  cfg.updatedAt = new Date().toISOString();
  cfg.authority = cfg.authority || {};
  cfg.scale = cfg.scale || {};
  cfg.limits = cfg.limits || {};
  cfg.features = cfg.features || {};
  cfg.authority.mode = ['MANUAL', 'ASSIST', 'AUTO_LIMITED'].includes(cfg.authority.mode) ? cfg.authority.mode : 'ASSIST';
  cfg.authority.operatorLock = cfg.authority.operatorLock !== false;
  cfg.authority.directorCanApply = cfg.authority.mode === 'AUTO_LIMITED' ? !!cfg.authority.directorCanApply : false;
  cfg.scale.stripCount = clamp(cfg.scale.stripCount ?? 8, 1, 64);
  cfg.scale.pixelsPerStrip = clamp(cfg.scale.pixelsPerStrip ?? 300, 1, 1200);
  cfg.scale.targetFps = clamp(cfg.scale.targetFps ?? 60, 1, 120);
  cfg.scale.runtimeHours = clamp(cfg.scale.runtimeHours ?? 12, 1, 168);
  for (const key of ['energy', 'chaos', 'density', 'motion']) {
    const lim = cfg.limits[key] || {};
    const min = clamp(lim.min ?? 0, 0, 100);
    const max = clamp(lim.max ?? 100, min, 100);
    cfg.limits[key] = { min, max, slewPerMinute: clamp(lim.slewPerMinute ?? 12, 1, 100) };
  }
  const b = cfg.limits.brightness || {};
  cfg.limits.brightness = {
    min: clamp(b.min ?? 0, 0, 1),
    max: clamp(b.max ?? 0.7, 0, 1),
    emergencyMax: clamp(b.emergencyMax ?? 0.35, 0, 1)
  };
  return cfg;
}

export function registerShowControlRoutes22JQ(app, { expressRef, rootDir = process.cwd() } = {}) {
  const jsonParser = expressRef?.json?.({ limit: '512kb' });
  const dataFile = path.join(rootDir, 'data', FILE_NAME);

  app.get('/api/show-control/22jq/config', (_req, res) => {
    const cfg = readJson(dataFile);
    if (!cfg) return res.status(404).json({ ok: false, error: 'missing_control_authority_pro_config' });
    res.json({ ok: true, config: cfg });
  });

  app.post('/api/show-control/22jq/config', jsonParser, (req, res) => {
    const next = normalizeConfig(req.body?.config || req.body || {});
    writeJson(dataFile, next);
    res.json({ ok: true, config: next });
  });

  app.post('/api/show-control/22jq/apply-preset', jsonParser, (req, res) => {
    const cfg = readJson(dataFile);
    if (!cfg) return res.status(404).json({ ok: false, error: 'missing_control_authority_pro_config' });
    const preset = (cfg.profiles || []).find((p) => p.id === req.body?.presetId);
    if (!preset) return res.status(404).json({ ok: false, error: 'preset_not_found' });
    cfg.activePresetId = preset.id;
    cfg.authority.mode = preset.authorityMode || cfg.authority.mode;
    cfg.authority.directorCanApply = cfg.authority.mode === 'AUTO_LIMITED';
    cfg.limits.energy.max = preset.energyMax;
    cfg.limits.chaos.max = preset.chaosMax;
    cfg.limits.density.max = preset.densityMax;
    cfg.limits.motion.max = preset.motionMax;
    cfg.limits.brightness.max = preset.brightnessMax;
    const next = normalizeConfig(cfg);
    writeJson(dataFile, next);
    res.json({ ok: true, applied: preset, config: next });
  });

  app.get('/api/show-control/22jq/bridge-payload', (_req, res) => {
    const cfg = normalizeConfig(readJson(dataFile) || {});
    res.json({
      ok: true,
      payload: {
        source: 'STEP22JQ_CONTROL_PRESET_MATRIX',
        authorityMode: cfg.authority.mode,
        operatorLock: cfg.authority.operatorLock,
        directorCanApply: cfg.authority.directorCanApply,
        scale: cfg.scale,
        limits: cfg.limits,
        features: cfg.features,
        activePresetId: cfg.activePresetId,
        safety: {
          brightnessMax: cfg.limits.brightness.max,
          chaosMax: cfg.limits.chaos.max,
          emergencyBrightnessMax: cfg.limits.brightness.emergencyMax
        }
      }
    });
  });
}
