import fs from "fs";
import path from "path";

const root = process.cwd();
const PUBLIC_DIR = path.join(root, "public");
const SRC_DIR = path.join(root, "src");
const JS_EXTS = [".js", ".mjs", ".cjs"];
const ROOT_HTMLS = [
  "public/shell.html",
  "public/index.html",
  "public/animations.html",
  "public/generator.html",
  "public/login.html",
  "public/mapping.html",
  "public/settings.html",
  "public/shorts.html",
  "public/preview3d.html",
  "public/shadertoy.html",
  "public/output-runner.html",
  "public/live-input.html",
  "public/show-os.html",
  "public/control-authority-pro.html"
];

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
      continue;
    }
    if (!entry.isFile()) continue;
    if (entry.name.endsWith(".js") || entry.name.endsWith(".html")) {
      out.push(path.relative(root, full).replace(/\\/g, "/"));
    }
  }
  return out;
}

function resolve(fromFile, spec) {
  const cleaned = String(spec).split("?")[0].split("#")[0];
  let resolved = path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), cleaned));
  const candidates = [
    resolved,
    ...JS_EXTS.map((ext) => `${resolved}${ext}`),
    path.posix.join(resolved, "index.js"),
    path.posix.join(resolved, "index.mjs"),
    path.posix.join(resolved, "index.cjs")
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(root, candidate))) return candidate;
  }
  return null;
}

const importRe = /(?:import\s+(?:[^'"]*?from\s+)?|export\s+[^'"]*?from\s+|new\s+Worker\s*\(\s*new\s+URL\s*\(\s*)['"]([^'"]+)['"]/g;
const workerUrlRe = /new\s+Worker\s*\(\s*new\s+URL\s*\(\s*['"]([^'"]+)['"]/g;

const files = walk(PUBLIC_DIR).concat(walk(SRC_DIR));
const existingRoots = ROOT_HTMLS.filter((file) => fs.existsSync(path.join(root, file)));
const reachable = new Set(existingRoots);
const queue = [...existingRoots];

function mark(file) {
  if (!reachable.has(file) && fs.existsSync(path.join(root, file))) {
    reachable.add(file);
    queue.push(file);
  }
}

for (const html of existingRoots) {
  const content = fs.readFileSync(path.join(root, html), "utf8");
  for (const match of content.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)) {
    const spec = match[1];
    if (/^(https?:|data:|\/\/)/i.test(spec)) continue;
    const resolved = resolve(html, spec);
    if (resolved) mark(resolved);
  }
}

while (queue.length) {
  const file = queue.shift();
  if (!file.endsWith(".js")) continue;
  const content = fs.readFileSync(path.join(root, file), "utf8");

  for (const match of content.matchAll(importRe)) {
    const spec = match[1];
    if (/^(https?:|data:|\/\/)/i.test(spec)) continue;
    const resolved = resolve(file, spec);
    if (resolved) mark(resolved);
  }

  for (const match of content.matchAll(workerUrlRe)) {
    const spec = match[1];
    if (/^(https?:|data:|\/\/)/i.test(spec)) continue;
    const resolved = resolve(file, spec);
    if (resolved) mark(resolved);
  }
}

if (reachable.has("public/core/module_loader.js")) {
  for (const dir of ["public/l1_anims", "public/l1_palettes"]) {
    if (!fs.existsSync(path.join(root, dir))) continue;
    for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(".js")) continue;
      mark(path.posix.join(dir, entry.name));
    }
  }
}

while (queue.length) {
  const file = queue.shift();
  if (!file.endsWith(".js")) continue;
  const content = fs.readFileSync(path.join(root, file), "utf8");

  for (const match of content.matchAll(importRe)) {
    const spec = match[1];
    if (/^(https?:|data:|\/\/)/i.test(spec)) continue;
    const resolved = resolve(file, spec);
    if (resolved) mark(resolved);
  }

  for (const match of content.matchAll(workerUrlRe)) {
    const spec = match[1];
    if (/^(https?:|data:|\/\/)/i.test(spec)) continue;
    const resolved = resolve(file, spec);
    if (resolved) mark(resolved);
  }
}

const staged = files.filter((file) => file.startsWith("src/") && file.endsWith(".js"));
const dead = files.filter((file) => file.startsWith("public/") && file.endsWith(".js") && !reachable.has(file));
const live = [...reachable].filter((file) => file.endsWith(".js")).sort();

console.log(JSON.stringify({
  roots: ROOT_HTMLS,
  existingRoots,
  liveCount: live.length,
  stagedCount: staged.length,
  deadCount: dead.length,
  staged,
  dead,
  live
}, null, 2));
