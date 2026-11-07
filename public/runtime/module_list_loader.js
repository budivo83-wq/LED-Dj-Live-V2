import { getLocalModuleFiles } from "./local_module_manifest.js";

function isAnimFolder(folder) {
  return folder === "l1_anims" || folder === "l2_anims";
}

function layerForFolder(folder) {
  return folder === "l2_anims" ? "l2" : "l1";
}

function createModuleList(files, sourceByFile = {}) {
  const list = [...files];
  Object.defineProperty(list, "sourceByFile", {
    value: { ...sourceByFile },
    enumerable: false,
    configurable: true,
    writable: true
  });
  return list;
}

function normalizeFileList(payload, folder) {
  if (Array.isArray(payload)) {
    const files = payload.map((file) => String(file || "").trim()).filter(Boolean);
    const sourceByFile = {};
    files.forEach((file) => {
      sourceByFile[file] = `${folder}/${file}`;
    });
    return createModuleList(files, sourceByFile);
  }
  if (!payload?.ok || !Array.isArray(payload.items)) return createModuleList([]);
  const files = [];
  const sourceByFile = {};
  payload.items.forEach((item) => {
    const file = String(item?.file || String(item?.source || "").split("/").pop() || "").trim();
    if (!file) return;
    files.push(file);
    sourceByFile[file] = String(item?.source || `${folder}/${file}`).trim();
  });
  return createModuleList(files, sourceByFile);
}

const LOCAL_DEFAULT_FILES = Object.freeze({
  l1_anims: ["shader_nebula.js"],
  l2_anims: ["shader_nebula.js"],
  l1_palettes: ["rainbow.js"],
  l2_palettes: ["rainbow.js"]
});

function fallbackFilesForFolder(folder) {
  const manifestFiles = getLocalModuleFiles(folder);
  if (manifestFiles.length) return manifestFiles;
  return Array.isArray(LOCAL_DEFAULT_FILES[folder]) ? [...LOCAL_DEFAULT_FILES[folder]] : [];
}

function fillSelectOptions(select, files, cleanModuleName) {
  if (!select || typeof select.replaceChildren !== "function") return;
  select.replaceChildren();
  files.forEach((file) => {
    const option = document.createElement("option");
    option.value = file;
    option.textContent = cleanModuleName(file);
    select.appendChild(option);
  });
}

export async function loadModuleList({ folder, select, cleanModuleName, fetchImpl = fetch }) {
  const urls = isAnimFolder(folder)
    ? [`/api/animations/list?layer=${layerForFolder(folder)}`, `/api/list/${folder}`]
    : [`/api/list/${folder}`];

  for (const url of urls) {
    try {
      const res = await fetchImpl(url);
      if (res.status === 401) {
        console.warn(`Unauthorized while loading list from ${url}`);
        continue;
      }
      if (!res.ok) {
        console.warn(`Cannot load list from ${url}: HTTP ${res.status}`);
        continue;
      }
      const payload = await res.json();
      const files = normalizeFileList(payload, folder);
      if (!Array.isArray(files) || files.length === 0) {
        console.warn(`Empty list payload from ${url}`);
        continue;
      }

      fillSelectOptions(select, files, cleanModuleName);

      return files;
    } catch (error) {
      console.warn(`Cannot load list from ${url}`, error);
    }
  }

  const fallbackFiles = fallbackFilesForFolder(folder);
  if (fallbackFiles.length) {
    console.warn(`Falling back to local defaults for ${folder}`);
    const normalizedFallback = normalizeFileList(fallbackFiles, folder);
    fillSelectOptions(select, normalizedFallback, cleanModuleName);
    return normalizedFallback;
  }

  console.warn(`Cannot load list: ${folder}`);
  return [];
}
