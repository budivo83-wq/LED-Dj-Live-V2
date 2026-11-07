import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, dirname, normalize } from "node:path";

const SRC_ROOT = normalize("src");
const PUBLIC_ROOT = normalize("public");

const RULES = [
  {
    from: /^src[\\/]ui[\\/]/,
    deny: [/^src[\\/]render[\\/]/, /^src[\\/]output[\\/]/, /^src[\\/]mapping[\\/]/],
    note: "UI must not import render/output/mapping internals directly."
  },
  {
    from: /^src[\\/]render[\\/]/,
    deny: [/^src[\\/]output[\\/]/],
    note: "Render must not import output internals."
  },
  {
    from: /^src[\\/]core[\\/]/,
    deny: [/^src[\\/]ui[\\/]/, /^src[\\/]output[\\/]/],
    note: "Core must stay independent of UI/output internals."
  }
];

function collectJsFiles(path, acc = []) {
  const stat = statSync(path);
  if (stat.isDirectory()) {
    for (const entry of readdirSync(path)) collectJsFiles(join(path, entry), acc);
    return acc;
  }
  if (path.endsWith(".js") || path.endsWith(".mjs")) acc.push(normalize(path));
  return acc;
}

function parseImports(code) {
  const regex = /(?:import\s+[^'";]+from\s+|import\s*\()\s*['"]([^'"]+)['"]/g;
  const list = [];
  let m;
  while ((m = regex.exec(code))) list.push(m[1]);
  return list;
}

function resolveImport(fromFile, spec) {
  if (!spec.startsWith(".")) return null;
  const base = normalize(join(dirname(fromFile), spec));
  if (base.startsWith(SRC_ROOT)) return base;
  return null;
}

function resolveAnyImport(fromFile, spec) {
  if (!spec.startsWith(".")) return null;
  return normalize(join(dirname(fromFile), spec));
}

const srcFiles = collectJsFiles(SRC_ROOT);
const publicFiles = collectJsFiles(PUBLIC_ROOT);
const violations = [];
const bridgeAllowlist = new Set([
  normalize("public/runtime/src_bridge.js")
]);

for (const file of srcFiles) {
  const code = readFileSync(file, "utf8");
  const imports = parseImports(code);
  for (const spec of imports) {
    const resolved = resolveImport(file, spec);
    if (resolved) {
      for (const rule of RULES) {
        if (!rule.from.test(file)) continue;
        for (const denied of rule.deny) {
          if (denied.test(resolved)) {
            violations.push({ file, spec, resolved, note: rule.note });
          }
        }
      }
    }
    const anyResolved = resolveAnyImport(file, spec);
    if (anyResolved?.startsWith(PUBLIC_ROOT)) {
      violations.push({
        file,
        spec,
        resolved: anyResolved,
        note: "src/ must not import public/ directly."
      });
    }
  }
}

for (const file of publicFiles) {
  const code = readFileSync(file, "utf8");
  const imports = parseImports(code);
  for (const spec of imports) {
    const resolved = resolveAnyImport(file, spec);
    if (!resolved) continue;
    if (resolved.startsWith(SRC_ROOT) && !bridgeAllowlist.has(file)) {
      violations.push({
        file,
        spec,
        resolved,
        note: "public/ must not import src/ directly outside runtime src_bridge."
      });
    }
  }
}

if (violations.length) {
  console.error("Layer import guard failed:");
  for (const v of violations) {
    console.error(`- ${relative(".", v.file)} imports ${v.spec} -> ${relative(".", v.resolved)} | ${v.note}`);
  }
  process.exit(1);
}

console.log(`Layer import guard passed (${srcFiles.length} src files, ${publicFiles.length} public files).`);
