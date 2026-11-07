// Dynamic import cache. Animation/palette modules are frequently reused during
// switching and thumbnail generation, so every import path is de-duplicated.

const FOLDER_ALIASES = {
  l2_anims: "l1_anims",
  l2_palettes: "l1_palettes"
};
const ANIMATION_LIBRARY_SYNC_KEY = "led-animation-library-sync-v1";

function sourceMapForList(list) {
  if (!list || typeof list !== "object") return null;
  const sourceByFile = list.sourceByFile;
  return sourceByFile && typeof sourceByFile === "object" ? sourceByFile : null;
}

function readAnimationLibraryRevision() {
  try {
    const raw = globalThis.localStorage?.getItem?.(ANIMATION_LIBRARY_SYNC_KEY) || "";
    if (!raw) return "";
    const parsed = JSON.parse(raw);
    return String(parsed?.revision || parsed?.at || "").trim();
  } catch {
    return "";
  }
}

function applyCacheBust(path) {
  const cleanPath = String(path || "").trim();
  if (!cleanPath) return "";
  if (!cleanPath.startsWith("user_anims/")) return cleanPath;
  const revision = readAnimationLibraryRevision();
  if (!revision) return cleanPath;
  const separator = cleanPath.includes("?") ? "&" : "?";
  return `${cleanPath}${separator}rev=${encodeURIComponent(revision)}`;
}

export function canonicalModulePath(path) {
  if (!path || path.endsWith("/")) return path;
  const [folder, ...rest] = path.split("/");
  return `${FOLDER_ALIASES[folder] || folder}/${rest.join("/")}`;
}

export function createModuleLoader() {
  const cache = new Map();

  async function loadModule(path) {
    const canonicalPath = canonicalModulePath(path);
    if (!canonicalPath || canonicalPath.endsWith("/")) return null;
    if (cache.has(canonicalPath)) return cache.get(canonicalPath);

    const promise = import(`../${canonicalPath}`).catch((error) => {
      console.warn(`Cannot load module: ${canonicalPath}`, error);
      cache.delete(canonicalPath);
      return null;
    });
    cache.set(canonicalPath, promise);
    return promise;
  }

  function hasModule(path) {
    return cache.has(canonicalModulePath(path));
  }

  return { loadModule, hasModule };
}

export function resolveModulePath(folder, file, list = null) {
  const cleanFile = String(file || "").trim();
  if (!cleanFile) return "";
  const mappedSource = sourceMapForList(list)?.[cleanFile];
  if (mappedSource) return applyCacheBust(canonicalModulePath(String(mappedSource)));
  return applyCacheBust(canonicalModulePath(`${folder}/${cleanFile}`));
}

export function pathsForFolder(folder, files) {
  return (files || []).map((file) => resolveModulePath(folder, file, files)).filter(Boolean);
}
