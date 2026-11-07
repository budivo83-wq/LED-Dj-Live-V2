import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

const requiredFiles = [
  "public/shell.html",
  "public/shell.js",
  "public/output-runner.html",
  "public/output_runner.js",
  "public/runtime/shell_message_contract.js",
];

const requiredPatterns = [
  {
    file: "public/shell.html",
    pattern: /<iframe id="runnerFrame"/,
    note: "shell must host hidden runner iframe",
  },
  {
    file: "public/shell.js",
    pattern: /output-runner\.html\?rev=\$\{runnerFrameNonce\}/,
    note: "shell must be able to reload runner with cache-busting revision",
  },
  {
    file: "public/shell.js",
    pattern: /classification\.action === SHELL_MESSAGE_ACTIONS\.RUNNER_HEARTBEAT/,
    note: "shell must handle runner heartbeat telemetry",
  },
  {
    file: "public/shell.js",
    pattern: /recoverRunner\("heartbeat-timeout"\)/,
    note: "shell watchdog must recover from missing runner heartbeat",
  },
  {
    file: "public/shell.js",
    pattern: /recoverRunner\("frame-stall"\)/,
    note: "shell watchdog must recover from stale output frames",
  },
  {
    file: "public/output_runner.js",
    pattern: /const RUNNER_SRC = "index\.html\?headless=1";/,
    note: "output runner must boot headless performance owner",
  },
  {
    file: "public/output_runner.js",
    pattern: /type: "led-runner-heartbeat"/,
    note: "output runner must emit heartbeat telemetry to shell",
  },
  {
    file: "public/output_runner.js",
    pattern: /message\.type === "led-power" \|\| message\.type === "led-state-sync"/,
    note: "output runner must forward power and state sync messages",
  },
  {
    file: "public/runtime/shell_message_contract.js",
    pattern: /RUNNER_HEARTBEAT: "runner:heartbeat"/,
    note: "shell message contract must classify runner heartbeat",
  },
  {
    file: "public/runtime/shell_message_contract.js",
    pattern: /message\.type === "led-runner-heartbeat"/,
    note: "shell message contract must recognize heartbeat event type",
  },
];

const failures = [];

for (const file of requiredFiles) {
  if (!existsSync(join(root, file))) failures.push(`${file} missing`);
}

for (const entry of requiredPatterns) {
  const full = join(root, entry.file);
  if (!existsSync(full)) {
    failures.push(`${entry.file} missing (${entry.note})`);
    continue;
  }
  const source = readFileSync(full, "utf8");
  if (!entry.pattern.test(source)) failures.push(`${entry.file} contract failed: ${entry.note}`);
}

if (failures.length) {
  console.error("Shell runner output contract failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Shell runner output contract passed (${requiredFiles.length} files, ${requiredPatterns.length} assertions).`);
