const API = '/api/show-control/22jq';
let cfg = null;

const $ = (id) => document.getElementById(id);
const limitKeys = ['energy', 'chaos', 'density', 'motion'];
const featureLabels = {
  worldTravel: 'World Travel', timelineRewrite: 'Timeline Rewrite', discovery: 'Discovery', legendaryWorlds: 'Legendary Worlds', megaEvents: 'Mega Events', genesisEvents: 'Genesis Events', autonomousEvolution: 'Autonomous Evolution', economySimulation: 'Economy Simulation', diplomacySimulation: 'Diplomacy Simulation', consciousnessSimulation: 'Consciousness Simulation'
};

async function api(path, options = {}) {
  const res = await fetch(API + path, options);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function setMode(mode) {
  cfg.authority.mode = mode;
  if (mode !== 'AUTO_LIMITED') cfg.authority.directorCanApply = false;
  render();
}

function collect() {
  cfg.authority.operatorLock = $('operatorLock').checked;
  cfg.authority.directorCanRecommend = $('directorCanRecommend').checked;
  cfg.authority.directorCanApply = $('directorCanApply').checked && cfg.authority.mode === 'AUTO_LIMITED';
  cfg.scale.rigClass = $('rigClass').value;
  cfg.scale.stripCount = Number($('stripCount').value);
  cfg.scale.pixelsPerStrip = Number($('pixelsPerStrip').value);
  cfg.scale.targetFps = Number($('targetFps').value);
  cfg.scale.venueSize = $('venueSize').value;
  cfg.scale.runtimeHours = Number($('runtimeHours').value);
  for (const key of limitKeys) {
    cfg.limits[key].min = Number($(`${key}Min`).value);
    cfg.limits[key].max = Number($(`${key}Max`).value);
    cfg.limits[key].slewPerMinute = Number($(`${key}Slew`).value);
  }
  cfg.limits.brightness.max = Number($('brightnessMax').value);
  cfg.limits.brightness.emergencyMax = Number($('brightnessEmergencyMax').value);
  for (const key of Object.keys(cfg.features)) cfg.features[key] = $(`feature_${key}`).checked;
}

function render() {
  document.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('active', b.dataset.mode === cfg.authority.mode));
  $('operatorLock').checked = !!cfg.authority.operatorLock;
  $('directorCanRecommend').checked = cfg.authority.directorCanRecommend !== false;
  $('directorCanApply').checked = !!cfg.authority.directorCanApply;
  $('directorCanApply').disabled = cfg.authority.mode !== 'AUTO_LIMITED';
  $('authorityVerdict').textContent = cfg.authority.mode === 'MANUAL'
    ? 'MANUAL: Director pouze radí. Operátor drží plnou kontrolu.'
    : cfg.authority.mode === 'ASSIST'
      ? 'ASSIST: Director připravuje návrhy, ale změny zůstávají pod kontrolou operátora.'
      : 'AUTO_LIMITED: Director může měnit show, ale jen uvnitř limitů a feature gates.';

  $('rigClass').value = cfg.scale.rigClass || '';
  $('stripCount').value = cfg.scale.stripCount || 8;
  $('pixelsPerStrip').value = cfg.scale.pixelsPerStrip || 300;
  $('targetFps').value = cfg.scale.targetFps || 60;
  $('venueSize').value = cfg.scale.venueSize || 'club';
  $('runtimeHours').value = cfg.scale.runtimeHours || 12;

  $('presetGrid').innerHTML = (cfg.profiles || []).map((p) => `<button class="preset ${p.id === cfg.activePresetId ? 'active' : ''}" data-preset="${p.id}">${p.name}<small>${p.description}</small></button>`).join('');
  $('presetGrid').querySelectorAll('[data-preset]').forEach((b) => b.onclick = () => applyPreset(b.dataset.preset));

  $('limitGrid').innerHTML = limitKeys.map((key) => {
    const l = cfg.limits[key] || { min: 0, max: 100, slewPerMinute: 12 };
    return `<div class="limit-card"><strong>${key.toUpperCase()}</strong><label>Min<input id="${key}Min" type="number" min="0" max="100" value="${l.min}"></label><label>Max<input id="${key}Max" type="number" min="0" max="100" value="${l.max}"></label><label>Slew / min<input id="${key}Slew" type="number" min="1" max="100" value="${l.slewPerMinute}"></label></div>`;
  }).join('') + `<div class="limit-card"><strong>BRIGHTNESS</strong><label>Max<input id="brightnessMax" type="number" min="0" max="1" step="0.01" value="${cfg.limits.brightness.max}"></label><label>Emergency Max<input id="brightnessEmergencyMax" type="number" min="0" max="1" step="0.01" value="${cfg.limits.brightness.emergencyMax}"></label></div>`;

  $('featureGrid').innerHTML = Object.keys(cfg.features).map((key) => `<label class="toggle-line"><input id="feature_${key}" type="checkbox" ${cfg.features[key] ? 'checked' : ''}> ${featureLabels[key] || key}</label>`).join('');
  updateBridgePreview();
}

function updateBridgePreview() {
  const payload = {
    source: 'STEP22JQ_CONTROL_PRESET_MATRIX_UI_PREVIEW',
    authorityMode: cfg.authority.mode,
    operatorLock: cfg.authority.operatorLock,
    directorCanApply: cfg.authority.directorCanApply,
    scale: cfg.scale,
    limits: cfg.limits,
    features: cfg.features,
    activePresetId: cfg.activePresetId
  };
  $('bridgePreview').textContent = JSON.stringify(payload, null, 2);
}

async function applyPreset(presetId) {
  const data = await api('/apply-preset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ presetId }) });
  cfg = data.config;
  render();
}

async function save() {
  collect();
  const data = await api('/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ config: cfg }) });
  cfg = data.config;
  render();
}

async function load() {
  const data = await api('/config');
  cfg = data.config;
  render();
}

document.querySelectorAll('[data-mode]').forEach((b) => b.onclick = () => setMode(b.dataset.mode));
$('saveBtn').onclick = save;
$('refreshBtn').onclick = load;
['operatorLock', 'directorCanRecommend', 'directorCanApply'].forEach((id) => $(id).addEventListener('change', () => { collect(); updateBridgePreview(); }));
document.addEventListener('input', (ev) => { if (cfg && ev.target.closest('.card')) { try { collect(); updateBridgePreview(); } catch {} } });
load().catch((err) => { $('bridgePreview').textContent = String(err); });
