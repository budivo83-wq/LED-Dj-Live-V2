import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createMigrationRuntime, mergeFeatureFlags, shouldPreferNextRuntime } from "../src/migration/index.js";

const root = process.cwd();

const removedFiles = [
  "public/sequencer.html",
  "public/sequencer.css",
  "public/sequencer.js",
  "public/runtime/sequencer_runtime.js"
];

const requiredFiles = [
  "public/runtime/local_module_manifest.js",
  "docs/STEP22LH_SEQUENCER_PAGE_PURGE.md"
];

const requiredAnyOf = [
  [
    "archive/old_root_notes_artnet_cleanup_2026-06-07/START_HERE_STEP22LI_ANIMATION_RECOVERY.txt",
    "START_HERE_STEP22LI_ANIMATION_RECOVERY.txt"
  ],
  [
    "archive/old_root_notes_artnet_cleanup_2026-06-07/START_HERE_STEP22LJ_ANIMATION_BOOT_REPAIR.txt",
    "START_HERE_STEP22LJ_ANIMATION_BOOT_REPAIR.txt"
  ]
];

const sourceChecks = [
  {
    file: "public/app.js",
    forbidden: /buildTopSeqGrid/,
    note: "startup must not reference removed sequencer symbol"
  },
  {
    file: "public/runtime/startup_sequence.js",
    required: /loadSelectedModules/,
    note: "startup sequence must still own module boot flow"
  },
  {
    file: "public/runtime/selected_modules_loader.js",
    required: /getLocalModuleFiles/,
    note: "selected module loader must keep local manifest recovery"
  },
  {
    file: "public/runtime/local_module_manifest.js",
    required: /LOCAL_MODULE_MANIFEST/,
    note: "local module manifest export must exist"
  }
];

const failures = [];

for (const file of removedFiles) {
  if (existsSync(join(root, file))) failures.push(`${file} should remain removed after sequencer purge`);
}

for (const file of requiredFiles) {
  if (!existsSync(join(root, file))) failures.push(`${file} missing`);
}

for (const variants of requiredAnyOf) {
  const found = variants.some((file) => existsSync(join(root, file)));
  if (!found) failures.push(`${variants.join(" or ")} missing`);
}

const defaultFlags = mergeFeatureFlags();
const nextFlags = mergeFeatureFlags({ useNewOutput: true });
const legacy = { name: "legacy" };
const next = { name: "next" };
const legacyOnlyRuntime = createMigrationRuntime({ legacy, next: null, flags: nextFlags });
const nextRuntime = createMigrationRuntime({ legacy, next, flags: nextFlags });
const legacyRuntime = createMigrationRuntime({ legacy, next, flags: defaultFlags });

if (shouldPreferNextRuntime(defaultFlags)) failures.push("default flags must not prefer the next runtime");
if (!shouldPreferNextRuntime(nextFlags)) failures.push("enabling a migration flag must prefer the next runtime");
if (legacyOnlyRuntime.getActive() !== "legacy") failures.push("next runtime must stay legacy when no next instance exists");
if (nextRuntime.getActive() !== "next") failures.push("next runtime must activate when a migration flag is enabled");
if (legacyRuntime.getActive() !== "legacy") failures.push("default flags must keep the legacy runtime active");

for (const check of sourceChecks) {
  const full = join(root, check.file);
  if (!existsSync(full)) {
    failures.push(`${check.file} missing (${check.note})`);
    continue;
  }
  const source = readFileSync(full, "utf8");
  if (check.required && !check.required.test(source)) failures.push(`${check.file} contract failed: ${check.note}`);
  if (check.forbidden && check.forbidden.test(source)) failures.push(`${check.file} contract failed: ${check.note}`);
}

if (failures.length) {
  console.error("Migration flag guard failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Migration flag guard passed (${removedFiles.length} removals, ${requiredFiles.length} required files, ${sourceChecks.length} source checks).`);
