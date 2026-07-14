import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';

const GROUPS = {
  core: [
    'check',
    'check:layers',
    'audit:imports',
    'test:contracts',
    'test:shell-runner-output-contract',
    'test:artnet-settings-boundary',
    'test:artnet-server-boundary',
    'test:artnet-live-source-policy',
    'test:serial-zero-copy-write',
    'test:ui-staged-boundary',
    'test:migration-flags',
  ],
  frame: [
    'test:frame-bus',
    'test:frame-authority-producer-ledger',
    'test:frame-authority-policy-gate',
    'test:frame-authority-output-policy',
    'test:render-path-audit',
    'test:frame-authority-meta-passthrough',
    'test:frame-authority-composed-api',
    'test:frame-authority-output-read-boundary',
    'test:frame-authority-consumer-ledger',
    'test:frame-authority-consumer-subscribe-ledger',
    'test:frame-authority-telemetry-snapshot',
    'test:frame-authority-consumer-contracts',
    'test:frame-authority-raw-consumer-audit',
  ],
  startup: [
    'test:startup-shell',
    'test:shell-navigation-scheduler-13v',
    'test:shell-boot-diagnostics-13w',
    'test:shell-boot-fallbacks-13x',
    'test:shell-message-contract-13y',
    'test:shell-telemetry-relay-13z',
    'test:shell-server-smoke-13aa',
    'test:app-collapse-facade-13ab',
    'test:startup-animation-boot',
    'test:startup-animation-lists',
    'test:module-list-loader-fallback-401',
    'test:master-preview-contract',
    'test:panel-binding-contract',
    'test:app-visual-value-helpers',
    'test:app-runtime-context',
  ],
  shadertoy: [
    'test:shadertoy-page-v2-13bu-as',
  ],
  performance: [
    'test:performance-css-refactor',
    'test:performance-css-token-contract',
  ],
  telemetry: [
    'test:telemetry-bus',
    'test:telemetry-debug-panel',
    'test:telemetry-health',
    'test:telemetry-history',
    'test:telemetry-prew-debug-tab',
    'test:telemetry-timeline',
    'test:telemetry-debug-live-source',
    'test:telemetry-debug-fallback-source',
    'test:telemetry-debug-baseline-refresh',
    'test:telemetry-debug-unconditional-refresh',
    'test:runtime-source-trace',
  ],
  output: [
    'test:preview-fps-contract',
    'test:preview-budget-pressure-contract',
    'test:live-output-driver-bridge-plan',
    'test:output-route-registry',
    'test:output-owned-render',
    'test:output-autostart',
    'test:output-server-replay',
  ],
  gallery: [
    'test:animation-gallery-readonly',
    'test:animation-library-manifest',
    'test:animation-layer-assignment',
    'test:animation-code-editor-import',
    'test:animation-gallery-workspace-tabs',
    'test:animation-layer-menu-order',
    'test:animation-metadata-editor',
    'test:animation-library-management',
    'test:animation-editor-validation',
    'test:animation-gallery-thumbnails-preview',
    'test:animation-gallery-selector-palettes',
    'test:animation-editor-mainlike-layout',
    'test:animation-gallery-selector-draft',
    'test:animation-gallery-albums-menu',
    'test:animation-gallery-favorites-guard',
    'test:animation-gallery-selector-card-split',
    'test:animation-gallery-view-filters',
    'test:animation-editor-layout-polish',
    'test:animation-editor-layout-repair',
    'test:animation-editor-table-space',
    'test:animation-editor-hard-reset',
    'test:animation-gallery-details-card-contract',
    'test:animation-editor-picker-custom',
  ],
  mapping: [
    'test:mapping-v2-contract',
  ],
  preflight11p: [
    'test:next-engine-live-executor-preflight',
    'test:next-engine-live-frame-mirror-validation',
    'test:next-engine-live-controlled-arm-phase',
  ],
};

const ALL_GROUPS = Object.keys(GROUPS);
const DEFAULT_TIMEOUT_MS = Number.parseInt(process.env.QA_STEP_TIMEOUT_MS || '180000', 10);
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const availableScripts = new Set(Object.keys(packageJson.scripts || {}));

function parseRequestedGroups(argv) {
  const groupArg = argv.find((arg) => arg.startsWith('--group='));
  if (!groupArg) return ALL_GROUPS;
  const requested = groupArg.slice('--group='.length).split(',').map((x) => x.trim()).filter(Boolean);
  const unknown = requested.filter((name) => !GROUPS[name]);
  if (unknown.length) {
    console.error(`[qa] Unknown group(s): ${unknown.join(', ')}`);
    console.error(`[qa] Available groups: ${ALL_GROUPS.join(', ')}`);
    process.exit(2);
  }
  return requested;
}

function runNpmScript(scriptName) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const command = process.platform === 'win32' ? 'cmd.exe' : 'npm';
    const args = process.platform === 'win32'
      ? ['/d', '/s', '/c', 'npm', 'run', scriptName]
      : ['run', scriptName];
    const child = spawn(command, args, {
      cwd: process.cwd(),
      stdio: 'inherit',
      env: process.env,
    });

    const timer = setTimeout(() => {
      console.error(`\n[qa] TIMEOUT after ${DEFAULT_TIMEOUT_MS}ms: npm run ${scriptName}`);
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGKILL'), 3000).unref();
    }, DEFAULT_TIMEOUT_MS);

    child.on('close', (code, signal) => {
      clearTimeout(timer);
      const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
      resolve({ scriptName, code, signal, elapsed });
    });
  });
}

const selectedGroups = parseRequestedGroups(process.argv.slice(2));
const failures = [];
const startedAt = Date.now();

console.log(`[qa] Running groups: ${selectedGroups.join(', ')}`);
console.log(`[qa] Per-script timeout: ${DEFAULT_TIMEOUT_MS}ms`);

for (const groupName of selectedGroups) {
  const scripts = GROUPS[groupName].filter((scriptName) => availableScripts.has(scriptName));
  const skipped = GROUPS[groupName].filter((scriptName) => !availableScripts.has(scriptName));
  console.log(`\n[qa] === ${groupName} (${scripts.length}) ===`);
  if (skipped.length) {
    console.log(`[qa] skipping unavailable scripts: ${skipped.join(', ')}`);
  }
  if (!scripts.length) {
    console.log(`[qa] no available scripts in group ${groupName}, skipping`);
    continue;
  }
  for (const scriptName of scripts) {
    console.log(`\n[qa] -> npm run ${scriptName}`);
    const result = await runNpmScript(scriptName);
    if (result.code !== 0) {
      failures.push(result);
      console.error(`[qa] FAILED ${scriptName} code=${result.code} signal=${result.signal || '-'} elapsed=${result.elapsed}s`);
      break;
    }
    console.log(`[qa] OK ${scriptName} elapsed=${result.elapsed}s`);
  }
  if (failures.length) break;
}

const elapsedTotal = ((Date.now() - startedAt) / 1000).toFixed(1);
if (failures.length) {
  console.error(`\n[qa] FAILED after ${elapsedTotal}s`);
  for (const failure of failures) {
    console.error(`[qa] - ${failure.scriptName} code=${failure.code} signal=${failure.signal || '-'} elapsed=${failure.elapsed}s`);
  }
  process.exit(1);
}

console.log(`\n[qa] PASS after ${elapsedTotal}s`);
