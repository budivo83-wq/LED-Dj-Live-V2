import { buildStep22DqLivePlan } from './artnet_sync_live_sender_22dq.js';

export const STEP22DR_ARTNET_PREFLIGHT_VERSION = 'STEP22DR_ARTNET_OPERATOR_PREFLIGHT';

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function isValidIpv4(ip) {
  const parts = String(ip || '').trim().split('.');
  if (parts.length !== 4) return false;
  return parts.every((p) => /^\d+$/.test(p) && Number(p) >= 0 && Number(p) <= 255);
}

function warning(code, message, severity = 'warn') {
  return Object.freeze({ code, message, severity });
}

export function buildStep22DrPreflight(options = {}) {
  const outputIp = String(options.outputIp || options.host || '2.1.1.30').trim();
  const fps = clampInt(options.fps, 1, 120, 60);
  const stripCount = clampInt(options.stripCount, 1, 64, 8);
  const pixelsPerStrip = clampInt(options.pixelsPerStrip, 1, 1000, 300);
  const pixelsPerUniverse = clampInt(options.pixelsPerUniverse, 1, 170, 170);
  const universeStart = clampInt(options.universeStart, 0, 32767, 0);
  const port = clampInt(options.port, 1, 65535, 6454);
  const plan = buildStep22DqLivePlan({
    ...options,
    outputIp,
    fps,
    stripCount,
    pixelsPerStrip,
    pixelsPerUniverse,
    universeStart,
    port
  });
  const warnings = [];
  if (!isValidIpv4(outputIp)) warnings.push(warning('BAD_IP', 'Cílová IP nevypadá jako platná IPv4 adresa.', 'error'));
  if (outputIp === '0.0.0.0' || outputIp === '255.255.255.255') warnings.push(warning('UNSAFE_IP', 'Nepoužívej 0.0.0.0 ani broadcast jako první live test.', 'error'));
  if (fps > 60) warnings.push(warning('HIGH_FPS', 'FPS je nad 60. Pro klubový live výstup začni raději 30/40/60.', 'warn'));
  if (plan.artnet.budget.payloadMbitPerSecond > 20) warnings.push(warning('HIGH_NETWORK_LOAD', 'ArtNet payload je vysoký. Zkontroluj kabelovou síť a nepoužívej slabou Wi-Fi.', 'warn'));
  if (pixelsPerUniverse > 170) warnings.push(warning('UNIVERSE_OVERFLOW', 'DMX universe nemůže nést více než 170 RGB pixelů.', 'error'));
  if (plan.artnet.map.universeCount > 32) warnings.push(warning('MANY_UNIVERSES', 'Počet universů je vysoký, ověř node mapping a síť.', 'warn'));
  const errorCount = warnings.filter((w) => w.severity === 'error').length;
  return Object.freeze({
    ok: errorCount === 0,
    version: STEP22DR_ARTNET_PREFLIGHT_VERSION,
    mode: 'artnet-operator-preflight',
    readyForDryRun: true,
    readyForUdpArmed: errorCount === 0,
    target: Object.freeze({ outputIp, port }),
    config: Object.freeze({ fps, stripCount, pixelsPerStrip, pixelsPerUniverse, universeStart }),
    summary: Object.freeze({
      universes: plan.artnet.map.universeCount,
      universeRange: `${plan.artnet.map.universes[0]?.universe ?? universeStart}-${plan.artnet.map.universes.at(-1)?.universe ?? universeStart}`,
      packetsPerFrame: plan.artnet.budget.packetsPerFrame,
      packetsPerSecond: plan.artnet.budget.packetsPerSecond,
      payloadMbitPerSecond: plan.artnet.budget.payloadMbitPerSecond,
      artSync: plan.artnet.budget.artSync
    }),
    warnings,
    nextSteps: Object.freeze([
      '1) Nejdřív spusť DRY RUN a sleduj frame/packet counters.',
      '2) Pak nastav IP nodu/Teensy/ArtNet receiveru.',
      '3) Teprve potom použij UDP ARMED START.',
      '4) Pokud LED nesedí, řeš universe start/range a strip směr v mappingu, ne shader.'
    ])
  });
}
