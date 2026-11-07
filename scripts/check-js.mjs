import { spawn } from "node:child_process";
import { cpus } from "node:os";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const full = process.argv.includes("--full");
const roots = full
  ? ["server.js", "public", "src", "scripts"]
  : ["server.js", "public", "src/server", "src/output", "scripts"];
const ignoredDirectories = new Set(["node_modules", ".git", "archive"]);
const files = [];

function collect(targetPath) {
  if (!existsSync(targetPath)) return;
  const stat = statSync(targetPath);
  if (stat.isDirectory()) {
    const name = targetPath.split(/[\\/]/).pop();
    if (ignoredDirectories.has(name)) return;
    for (const entry of readdirSync(targetPath)) collect(join(targetPath, entry));
    return;
  }
  if (targetPath.endsWith(".js") || targetPath.endsWith(".mjs")) files.push(targetPath);
}

for (const root of roots) collect(root);

const uniqueFiles = Array.from(new Set(files)).sort();
const maxWorkersArg = process.argv.find((arg) => arg.startsWith("--workers="));
const parsedWorkers = Number(maxWorkersArg?.split("=")[1] || 0);
const workerCount = Math.max(1, Math.min(
  uniqueFiles.length || 1,
  Number.isFinite(parsedWorkers) && parsedWorkers > 0 ? Math.trunc(parsedWorkers) : Math.max(2, Math.min(8, cpus().length || 4))
));

let nextIndex = 0;
let failed = false;
const failures = [];
const startedAt = Date.now();

function checkFile(file) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ["--check", file], { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    child.stdout.on("data", (chunk) => { out += chunk.toString(); });
    child.stderr.on("data", (chunk) => { err += chunk.toString(); });
    child.on("close", (status) => {
      if (status !== 0) failures.push({ file, status, out, err });
      resolve(status === 0);
    });
    child.on("error", (error) => {
      failures.push({ file, status: -1, out, err: error.message });
      resolve(false);
    });
  });
}

async function worker() {
  while (nextIndex < uniqueFiles.length) {
    const index = nextIndex;
    nextIndex += 1;
    const ok = await checkFile(uniqueFiles[index]);
    if (!ok) failed = true;
  }
}

await Promise.all(Array.from({ length: workerCount }, () => worker()));

for (const item of failures) {
  console.error(`\n[check-js] ${item.file} failed with status ${item.status}`);
  if (item.out) process.stdout.write(item.out);
  if (item.err) process.stderr.write(item.err);
}

if (failed) process.exit(1);
const elapsed = Date.now() - startedAt;
console.log(`Checked ${uniqueFiles.length} JavaScript files${full ? " (full)" : " (active live set)"} with ${workerCount} workers in ${elapsed} ms.`);
