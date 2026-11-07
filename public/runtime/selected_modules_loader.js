import { getLocalModuleFiles } from "./local_module_manifest.js";
import { resolveModulePath } from "../core/module_loader.js";

function chooseValidFile(folder, desired, list) {
  const candidates = [];
  if (desired) candidates.push(String(desired));
  if (Array.isArray(list)) candidates.push(...list);
  candidates.push(...getLocalModuleFiles(folder));
  candidates.push(folder.includes("palette") ? "rainbow.js" : "shader_nebula.js");
  const seen = new Set();
  for (const item of candidates) {
    const file = String(item || "").trim();
    if (!file || seen.has(file)) continue;
    seen.add(file);
    return file;
  }
  return folder.includes("palette") ? "rainbow.js" : "shader_nebula.js";
}

async function loadWithRecovery({ folder, file, list, loadModule }) {
  const candidates = [];
  const add = (value) => {
    const v = String(value || "").trim();
    if (v && !candidates.includes(v)) candidates.push(v);
  };
  add(file);
  (Array.isArray(list) ? list : []).forEach(add);
  getLocalModuleFiles(folder).forEach(add);
  add(folder.includes("palette") ? "rainbow.js" : "shader_nebula.js");
  for (const candidate of candidates) {
    const mod = await loadModule(resolveModulePath(folder, candidate, list));
    if (mod) return { file: candidate, mod };
  }
  return { file: candidates[0] || "", mod: null };
}

export async function loadSelectedModulesRuntime({
  state,
  modules,
  loadModule,
  lists,
  rememberShaderModuleWarmup,
  warmupCurrentShaderScene
} = {}) {
  if (!state || !modules || typeof loadModule !== "function") {
    throw new Error("loadSelectedModulesRuntime requires state, modules and loadModule");
  }

  state.l1.animFile = chooseValidFile("l1_anims", state.l1.animFile, lists?.l1Anims);
  state.l1.paletteFile = chooseValidFile("l1_palettes", state.l1.paletteFile, lists?.l1Palettes);
  state.l2.animFile = chooseValidFile("l2_anims", state.l2.animFile, lists?.l2Anims);
  state.l2.paletteFile = chooseValidFile("l2_palettes", state.l2.paletteFile, lists?.l2Palettes);

  const [l1Anim, l1Palette, l2Anim, l2Palette] = await Promise.all([
    loadWithRecovery({ folder: "l1_anims", file: state.l1.animFile, list: lists?.l1Anims, loadModule }),
    loadWithRecovery({ folder: "l1_palettes", file: state.l1.paletteFile, list: lists?.l1Palettes, loadModule }),
    loadWithRecovery({ folder: "l2_anims", file: state.l2.animFile, list: lists?.l2Anims, loadModule }),
    loadWithRecovery({ folder: "l2_palettes", file: state.l2.paletteFile, list: lists?.l2Palettes, loadModule })
  ]);

  state.l1.animFile = l1Anim.file || state.l1.animFile;
  state.l1.paletteFile = l1Palette.file || state.l1.paletteFile;
  state.l2.animFile = l2Anim.file || state.l2.animFile;
  state.l2.paletteFile = l2Palette.file || state.l2.paletteFile;

  modules.l1.anim = l1Anim.mod;
  modules.l1.palette = l1Palette.mod;
  modules.l2.anim = l2Anim.mod;
  modules.l2.palette = l2Palette.mod;

  try {
    globalThis.__ledModuleRecovery = {
      l1Anim: state.l1.animFile,
      l1Palette: state.l1.paletteFile,
      l2Anim: state.l2.animFile,
      l2Palette: state.l2.paletteFile,
      ok: Boolean(modules.l1.anim && modules.l1.palette && modules.l2.anim && modules.l2.palette),
      updatedAt: performance.now()
    };
  } catch {
    // diagnostics only
  }

  if (typeof rememberShaderModuleWarmup === "function") {
    rememberShaderModuleWarmup("l1", "l1_anims", lists?.l1Anims || [], state.l1.animFile);
    rememberShaderModuleWarmup("l2", "l2_anims", lists?.l2Anims || [], state.l2.animFile);
  }

  if (typeof warmupCurrentShaderScene === "function") {
    // Do not compile/warm a shader scene synchronously in the animation switch path.
    // The live output frame must resume first; warmup can run one tick later.
    setTimeout(() => {
      try { warmupCurrentShaderScene(); } catch (error) { console.warn("Deferred shader scene warmup failed", error); }
    }, 80);
  }
}
