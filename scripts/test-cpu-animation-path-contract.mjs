import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const pipeline = readFileSync(join(root, "public", "runtime", "render_pipeline.js"), "utf8");
const switcher = readFileSync(join(root, "public", "runtime", "layer_module_switcher.js"), "utf8");
const listLoader = readFileSync(join(root, "public", "runtime", "module_list_loader.js"), "utf8");
const warmup = readFileSync(join(root, "public", "runtime", "module_warmup.js"), "utf8");

const failures = [];
const expect = (pattern, note) => {
  if (!pattern.test(pipeline) && !pattern.test(switcher) && !pattern.test(listLoader) && !pattern.test(warmup)) {
    failures.push(note);
  }
};

if (!/const cpuRendered = renderCpuFrame\(\);/.test(pipeline)) {
  failures.push("fresh frame rendering must fall back to the CPU compositor");
}
if (!/return cpuRendered;/.test(pipeline)) {
  failures.push("CPU-rendered frames must be returned to preview/output consumers");
}
if (/Rejected non-GPU animation/.test(switcher) || /GPU-only/.test(switcher)) {
  failures.push("animation switching must not reject CPU-only modules");
}
if (/never merge those back into the live selector/.test(listLoader)) {
  failures.push("animation lists must not hide CPU modules from the selector");
}
if (!/if \(!modules\.l1\.anim\?\.render \|\| !modules\.l2\.anim\?\.render\)/.test(warmup)) {
  failures.push("CPU prewarm must remain available for active CPU animations");
}

if (failures.length) {
  console.error("CPU animation path contract failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("CPU animation path contract passed.");
