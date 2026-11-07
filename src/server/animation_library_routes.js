import fs from "fs";
import path from "path";
import { LOCAL_MODULE_MANIFEST } from "./local_module_manifest.js";
import { freezeUniqueList } from "./live_output_common.js";

const VALID_LAYERS = new Set(["l1", "l2"]);

function toTitle(file) {
  return String(file || "")
    .replace(/\.js$/i, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function uniqueLayers(values) {
  return freezeUniqueList((Array.isArray(values) ? values : [])
    .map((value) => String(value || "").trim().toLowerCase())
    .filter((value) => VALID_LAYERS.has(value)));
}

function slugifyName(value) {
  const slug = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\.js$/i, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_ -]+/g, "")
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
  return slug || `user_anim_${Date.now()}`;
}

function validateUserAnimationCode(code) {
  const text = String(code || "");
  if (!text.trim()) return "Code is empty.";
  if (text.length > 150_000) return "Code is too large.";
  if (!/export\s+function\s+render\s*\(/.test(text) && !/export\s+const\s+render\s*=/.test(text)) {
    return "Animation must export render(x, y, t, p).";
  }
  const blocked = [
    /from\s+["']node:/,
    /from\s+["']fs["']/,
    /from\s+["']child_process["']/,
    /\bfetch\s*\(/,
    /\bWebSocket\s*\(/,
    /\blocalStorage\b/,
    /\bsessionStorage\b/,
    /\bdocument\b/,
    /\bwindow\b/
  ];
  if (blocked.some((re) => re.test(text))) return "Code contains browser/server side-effect API that is not allowed in the gallery import step.";
  return null;
}


function analyzeUserAnimationCode(code) {
  const text = String(code || "");
  const errors = [];
  const warnings = [];
  const info = [];
  const validationError = validateUserAnimationCode(text);
  if (validationError) errors.push(validationError);
  const hasRenderFunction = /export\s+function\s+render\s*\(([^)]*)\)/.exec(text);
  const hasRenderConst = /export\s+const\s+render\s*=\s*(?:\(([^)]*)\)|([^=]+?)=>)/.exec(text);
  const args = (hasRenderFunction?.[1] || hasRenderConst?.[1] || "")
    .split(",")
    .map((arg) => arg.trim())
    .filter(Boolean);
  if (args.length && args.length < 4) warnings.push("render() má méně než 4 argumenty. Doporučený podpis je render(x, y, t, p).");
  if (!/export\s+const\s+meta\s*=/.test(text)) warnings.push("Chybí export const meta. Galerie pak nepozná názvy parametrů a popis.");
  if (/Math\.random\s*\(/.test(text)) warnings.push("Math.random() může způsobit blikání mezi preview/output snímky. Lepší je deterministický šum z x/y/t.");
  if (/Date\.now\s*\(|performance\.now\s*\(/.test(text)) warnings.push("Animace by neměla číst vlastní čas. Používej parametr t, aby šel render synchronizovat.");
  if (/new\s+(Array|Uint8Array|Float32Array)\s*\(/.test(text)) warnings.push("Animace alokuje pole uvnitř modulu. Pokud se to děje v render(), může to zvyšovat GC jitter.");
  const lineCount = text.split(/\r?\n/).length;
  const byteCount = Buffer.byteLength(text, "utf8");
  info.push(`${lineCount} lines`);
  info.push(`${byteCount} bytes`);
  if (/export\s+const\s+gpu\s*=\s*true/.test(text)) info.push("gpu flag detected");
  const metaParams = /params\s*:\s*\[([^\]]*)\]/m.exec(text);
  if (metaParams) {
    const params = metaParams[1].split(",").map((value) => value.replace(/["'`]/g, "").trim()).filter(Boolean);
    if (params.length) info.push(`params: ${params.join(", ")}`);
  }
  return { ok: errors.length === 0, errors, warnings, info };
}


function extractMetaParamsFromCode(code) {
  const text = String(code || "");
  const metaParams = /params\s*:\s*\[([^\]]*)\]/m.exec(text);
  if (!metaParams) return [];
  return metaParams[1]
    .split(",")
    .map((value) => value.replace(/["'`]/g, "").trim())
    .filter(Boolean)
    .slice(0, 8);
}

function extractMetaNameFromCode(code) {
  const text = String(code || "");
  const match = /name\s*:\s*["'`]([^"'`]+)["'`]/m.exec(text);
  return String(match?.[1] || "").trim().slice(0, 80);
}

function normalizeLayerOrder(value, fallbackOrder = 0) {
  const raw = value && typeof value === "object" ? value : {};
  const layerOrder = {};
  for (const layer of VALID_LAYERS) {
    const n = Number(raw[layer]);
    if (Number.isFinite(n)) layerOrder[layer] = n;
  }
  for (const layer of VALID_LAYERS) {
    if (!Number.isFinite(Number(layerOrder[layer]))) layerOrder[layer] = fallbackOrder;
  }
  return layerOrder;
}


function normalizePrewarm(value) {
  const raw = value && typeof value === "object" ? value : {};
  const priority = Number(raw.priority);
  const samplePoints = Number(raw.samplePoints);
  return {
    priority: Number.isFinite(priority) ? Math.max(0, Math.min(100, Math.round(priority))) : 40,
    mode: String(raw.mode || "idle-neighbor").trim().slice(0, 48) || "idle-neighbor",
    samplePoints: Number.isFinite(samplePoints) ? Math.max(8, Math.min(256, Math.round(samplePoints))) : 48,
    warmOnSelect: raw.warmOnSelect !== false,
    warmNeighbors: raw.warmNeighbors !== false
  };
}

function normalizeGallery(value) {
  const raw = value && typeof value === "object" ? value : {};
    return {
      savable: raw.savable !== false,
      favoriteable: raw.favoriteable !== false,
      thumbnail: String(raw.thumbnail || "runtime").trim().slice(0, 48) || "runtime",
      albumIds: Array.isArray(raw.albumIds)
      ? freezeUniqueList(raw.albumIds.map((id) => String(id || "").trim()).filter(Boolean), 32)
      : []
    };
}

function normalizeTags(tags) {
  return freezeUniqueList((Array.isArray(tags) ? tags : String(tags || "").split(","))
    .map((tag) => String(tag || "").trim().toLowerCase())
    .filter(Boolean));
}

function normalizeItem(item, index = 0) {
  const file = String(item?.file || "").trim();
  const source = String(item?.source || (file ? `l1_anims/${file}` : "")).trim();
  const id = String(item?.id || `builtin:${file.replace(/\.js$/i, "") || index}`).trim();
  const hasEnabledFor = Object.prototype.hasOwnProperty.call(item || {}, "enabledFor");
  const enabledFor = hasEnabledFor ? uniqueLayers(item?.enabledFor) : ["l1", "l2"];
  const tags = normalizeTags(item?.tags);
  const order = Number.isFinite(Number(item?.order)) ? Number(item.order) : index;
  const params = Array.isArray(item?.params) ? item.params.map((param) => String(param || "").trim()).filter(Boolean).slice(0, 8) : [];
  return {
    id,
    name: String(item?.name || toTitle(file || id)).trim(),
    description: String(item?.description || "").trim(),
    file,
    source,
    kind: String(item?.kind || "module").trim() || "module",
    origin: String(item?.origin || "builtin").trim() || "builtin",
    enabledFor,
    tags,
    params,
    order,
    layerOrder: normalizeLayerOrder(item?.layerOrder, order),
    prewarm: normalizePrewarm(item?.prewarm),
    gallery: normalizeGallery(item?.gallery),
    readonly: item?.readonly !== false,
    archived: item?.archived === true
  };
}

function buildFallbackLibrary(publicDir) {
  const files = Array.isArray(LOCAL_MODULE_MANIFEST?.l1_anims) ? [...LOCAL_MODULE_MANIFEST.l1_anims] : [];
  return {
    version: 1,
    source: "fallback-manifest",
    items: files.map((file, index) => normalizeItem({
      id: `builtin:${file.replace(/\.js$/i, "")}`,
      name: toTitle(file),
      file,
      source: `l1_anims/${file}`,
      kind: "module",
      origin: "builtin",
      enabledFor: ["l1", "l2"],
      tags: ["builtin", "shader", "gpu", "l1", "l2"],
      order: index,
      readonly: true
    }, index))
  };
}

function sortItems(items) {
  return [...items].sort((a, b) => (a.order - b.order) || a.name.localeCompare(b.name));
}

function sortItemsForLayer(items, layer) {
  const normalizedLayer = String(layer || "").toLowerCase();
  if (!VALID_LAYERS.has(normalizedLayer)) return sortItems(items);
  return [...items].sort((a, b) => {
    const ao = Number(a.layerOrder?.[normalizedLayer]);
    const bo = Number(b.layerOrder?.[normalizedLayer]);
    const av = Number.isFinite(ao) ? ao : a.order;
    const bv = Number.isFinite(bo) ? bo : b.order;
    return (av - bv) || (a.order - b.order) || a.name.localeCompare(b.name);
  });
}

function normalizeAllLayerOrders(items) {
  const sortedGlobal = sortItems(items).map((item, index) => ({ ...item, order: index }));
  for (const layer of VALID_LAYERS) {
    sortItemsForLayer(sortedGlobal.filter((item) => item.enabledFor.includes(layer)), layer)
      .forEach((item, index) => {
        item.layerOrder = { ...(item.layerOrder || {}), [layer]: index };
      });
  }
  return sortedGlobal;
}

function readLibrary({ publicDir, libraryFile }) {
  let raw = null;
  try {
    raw = JSON.parse(fs.readFileSync(libraryFile, "utf8"));
  } catch {
    return buildFallbackLibrary(publicDir);
  }
  const items = Array.isArray(raw?.items) ? raw.items.map(normalizeItem) : [];
  return {
    version: Math.max(2, Number(raw?.version || 2)),
    schema: String(raw?.schema || "animation-library-v2"),
    source: "manifest",
    updatedAt: raw?.updatedAt || null,
    items: sortItems(items)
  };
}

function writeLibrary({ libraryFile, library }) {
  fs.mkdirSync(path.dirname(libraryFile), { recursive: true });
  const normalized = {
    version: Math.max(2, Number(library?.version || 2)),
    schema: String(library?.schema || "animation-library-v2"),
    updatedAt: new Date().toISOString(),
    items: normalizeAllLayerOrders((library?.items || []).map(normalizeItem))
  };
  const tempFile = `${libraryFile}.tmp`;
  fs.writeFileSync(tempFile, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  fs.renameSync(tempFile, libraryFile);
  return { ...normalized, source: "manifest" };
}

function findItem(library, id) {
  return library.items.find((item) => item.id === id || item.file === id);
}

function resolvePublicSource(publicDir, source) {
  const base = path.resolve(publicDir || path.join(process.cwd(), "public"));
  const cleanSource = String(source || "").replace(/^\/+/, "");
  const target = path.resolve(base, cleanSource);
  if (!target.startsWith(`${base}${path.sep}`) && target !== base) return null;
  if (!target.endsWith(".js")) return null;
  return target;
}

function cloneName(name) {
  const base = String(name || "Animation").trim().replace(/\s+copy(?:\s+\d+)?$/i, "");
  return `${base} copy`;
}

function layerTagsFor(enabledFor) {
  return enabledFor.map((layer) => layer.toLowerCase());
}

function syncLayerTags(item) {
  const baseTags = (item.tags || []).filter((tag) => !VALID_LAYERS.has(String(tag).toLowerCase()));
  item.tags = normalizeTags([...baseTags, ...layerTagsFor(item.enabledFor)]);
  return item;
}

function applyEditableMetadata(item, input) {
  const name = String(input?.name || "").trim();
  if (name) item.name = name.slice(0, 80);
  item.description = String(input?.description || "").trim().slice(0, 500);
  item.kind = String(input?.kind || item.kind || "module").trim().toLowerCase().slice(0, 32) || "module";
  item.origin = String(input?.origin || item.origin || "builtin").trim().toLowerCase().slice(0, 32) || "builtin";
  const protectedTags = layerTagsFor(item.enabledFor);
  const nextTags = normalizeTags(input?.tags).filter((tag) => !VALID_LAYERS.has(tag));
  item.tags = normalizeTags([...nextTags, ...protectedTags]);
  item.params = Array.isArray(input?.params)
    ? input.params.map((param) => String(param || "").trim()).filter(Boolean).slice(0, 8)
    : String(input?.params || "").split(",").map((param) => param.trim()).filter(Boolean).slice(0, 8);
  if (input?.prewarm && typeof input.prewarm === "object") item.prewarm = normalizePrewarm({ ...(item.prewarm || {}), ...input.prewarm });
  if (input?.gallery && typeof input.gallery === "object") item.gallery = normalizeGallery({ ...(item.gallery || {}), ...input.gallery });
  return item;
}

function jsonError(res, status, message) {
  return res.status(status).json({ ok: false, error: message });
}

export function registerAnimationLibraryRoutes(app, { publicDir, libraryFile } = {}) {
  const resolvedFile = libraryFile || path.join(process.cwd(), "data", "animation-library.json");
  const userAnimDir = path.join(publicDir || path.join(process.cwd(), "public"), "user_anims");

  app.get("/api/animations/library", (req, res) => {
    const library = readLibrary({ publicDir, libraryFile: resolvedFile });
    res.json({ ok: true, ...library });
  });

  app.get("/api/animations/list", (req, res) => {
    const layer = String(req.query.layer || "").toLowerCase();
    const library = readLibrary({ publicDir, libraryFile: resolvedFile });
    const activeItems = library.items.filter((item) => !item.archived);
    const items = layer
      ? sortItemsForLayer(activeItems.filter((item) => item.enabledFor.map((x) => String(x).toLowerCase()).includes(layer)), layer)
      : sortItems(activeItems);
    res.json({ ok: true, source: library.source, layer: layer || null, items });
  });

  app.post("/api/animations/enable-layer", (req, res) => {
    const id = String(req.body?.id || "").trim();
    const layer = String(req.body?.layer || "").trim().toLowerCase();
    if (!id) return jsonError(res, 400, "Missing animation id.");
    if (!VALID_LAYERS.has(layer)) return jsonError(res, 400, "Invalid layer.");
    const library = readLibrary({ publicDir, libraryFile: resolvedFile });
    if (library.source !== "manifest") return jsonError(res, 409, "Animation manifest is not writable.");
    const item = findItem(library, id);
    if (!item) return jsonError(res, 404, "Animation not found.");
    item.enabledFor = freezeUniqueList([...item.enabledFor, layer]);
    const currentLayerItems = library.items.filter((entry) => entry.enabledFor.includes(layer));
    item.layerOrder = { ...(item.layerOrder || {}), [layer]: Number.isFinite(Number(item.layerOrder?.[layer])) ? Number(item.layerOrder[layer]) : currentLayerItems.length };
    syncLayerTags(item);
    const updated = writeLibrary({ libraryFile: resolvedFile, library });
    res.json({ ok: true, item, updatedAt: updated.updatedAt });
  });

  app.post("/api/animations/disable-layer", (req, res) => {
    const id = String(req.body?.id || "").trim();
    const layer = String(req.body?.layer || "").trim().toLowerCase();
    if (!id) return jsonError(res, 400, "Missing animation id.");
    if (!VALID_LAYERS.has(layer)) return jsonError(res, 400, "Invalid layer.");
    const library = readLibrary({ publicDir, libraryFile: resolvedFile });
    if (library.source !== "manifest") return jsonError(res, 409, "Animation manifest is not writable.");
    const item = findItem(library, id);
    if (!item) return jsonError(res, 404, "Animation not found.");
    item.enabledFor = item.enabledFor.filter((value) => value !== layer);
    syncLayerTags(item);
    const updated = writeLibrary({ libraryFile: resolvedFile, library });
    res.json({ ok: true, item, updatedAt: updated.updatedAt });
  });


  app.post("/api/animations/update-metadata", (req, res) => {
    const id = String(req.body?.id || "").trim();
    if (!id) return jsonError(res, 400, "Missing animation id.");
    const library = readLibrary({ publicDir, libraryFile: resolvedFile });
    if (library.source !== "manifest") return jsonError(res, 409, "Animation manifest is not writable.");
    const item = findItem(library, id);
    if (!item) return jsonError(res, 404, "Animation not found.");
    applyEditableMetadata(item, req.body);
    const updated = writeLibrary({ libraryFile: resolvedFile, library });
    res.json({ ok: true, item: findItem(updated, id), updatedAt: updated.updatedAt });
  });

  app.post("/api/animations/validate-code", (req, res) => {
    const code = String(req.body?.code || "");
    res.json({ ok: true, report: analyzeUserAnimationCode(code) });
  });

  app.post("/api/animations/save-code", (req, res) => {
    const name = String(req.body?.name || "").trim();
    const code = String(req.body?.code || "");
    const validationError = validateUserAnimationCode(code);
    if (validationError) return jsonError(res, 400, validationError);

    const library = readLibrary({ publicDir, libraryFile: resolvedFile });
    if (library.source !== "manifest") return jsonError(res, 409, "Animation manifest is not writable.");

    const baseSlug = slugifyName(name || req.body?.file || "user_anim");
    let slug = baseSlug;
    let suffix = 2;
    const usedIds = new Set(library.items.map((item) => item.id));
    const usedFiles = new Set(library.items.map((item) => item.file));
    while (usedIds.has(`user:${slug}`) || usedFiles.has(`${slug}.js`) || fs.existsSync(path.join(userAnimDir, `${slug}.js`))) {
      slug = `${baseSlug}_${suffix++}`;
    }

    fs.mkdirSync(userAnimDir, { recursive: true });
    const file = `${slug}.js`;
    const source = `user_anims/${file}`;
    const body = `${code.trim()}\n`;
    const targetFile = path.join(userAnimDir, file);
    fs.writeFileSync(`${targetFile}.tmp`, body, "utf8");
    fs.renameSync(`${targetFile}.tmp`, targetFile);

    const requestedTags = normalizeTags(req.body?.tags).filter((tag) => !VALID_LAYERS.has(tag));
    const item = normalizeItem({
      id: `user:${slug}`,
      name: name || extractMetaNameFromCode(code) || toTitle(file),
      file,
      source,
      kind: "module",
      origin: "user",
      enabledFor: [],
      tags: normalizeTags(["user", "cpu", ...requestedTags]),
      params: extractMetaParamsFromCode(code),
      order: library.items.length,
      readonly: false
    }, library.items.length);

    library.items.push(item);
    const updated = writeLibrary({ libraryFile: resolvedFile, library });
    res.json({ ok: true, item, updatedAt: updated.updatedAt });
  });



  app.post("/api/animations/update-code", (req, res) => {
    const id = String(req.body?.id || "").trim();
    const name = String(req.body?.name || "").trim();
    const code = String(req.body?.code || "");
    if (!id) return jsonError(res, 400, "Missing animation id.");
    const validationError = validateUserAnimationCode(code);
    if (validationError) return jsonError(res, 400, validationError);

    const library = readLibrary({ publicDir, libraryFile: resolvedFile });
    if (library.source !== "manifest") return jsonError(res, 409, "Animation manifest is not writable.");
    const item = findItem(library, id);
    if (!item) return jsonError(res, 404, "Animation not found.");
    if (item.readonly || item.origin !== "user") return jsonError(res, 403, "Only user animations can be overwritten. Save builtin animations as a new copy.");

    const targetFile = resolvePublicSource(publicDir, item.source || `user_anims/${item.file}`);
    if (!targetFile || !targetFile.includes(`${path.sep}user_anims${path.sep}`)) return jsonError(res, 403, "Only files inside public/user_anims can be overwritten.");
    fs.mkdirSync(path.dirname(targetFile), { recursive: true });
    fs.writeFileSync(`${targetFile}.tmp`, `${code.trim()}
`, "utf8");
    fs.renameSync(`${targetFile}.tmp`, targetFile);

    if (name) item.name = name.slice(0, 80);
    const requestedTags = normalizeTags(req.body?.tags).filter((tag) => !VALID_LAYERS.has(tag));
    item.tags = normalizeTags(["user", "cpu", ...requestedTags, ...layerTagsFor(item.enabledFor)]);
    item.params = extractMetaParamsFromCode(code);
    item.readonly = false;
    item.origin = "user";
    const updated = writeLibrary({ libraryFile: resolvedFile, library });
    res.json({ ok: true, item: findItem(updated, id), updatedAt: updated.updatedAt });
  });


  app.post("/api/animations/save-from-gallery", (req, res) => {
    const id = String(req.body?.id || "").trim();
    const nameOverride = String(req.body?.name || "").trim();
    if (!id) return jsonError(res, 400, "Missing animation id.");
    const library = readLibrary({ publicDir, libraryFile: resolvedFile });
    if (library.source !== "manifest") return jsonError(res, 409, "Animation manifest is not writable.");
    const sourceItem = findItem(library, id);
    if (!sourceItem) return jsonError(res, 404, "Animation not found.");

    const sourceFile = resolvePublicSource(publicDir, sourceItem.source || `l1_anims/${sourceItem.file}`);
    if (!sourceFile || !fs.existsSync(sourceFile)) return jsonError(res, 404, "Animation source file not found.");
    const sourceCode = fs.readFileSync(sourceFile, "utf8");
    const validationError = validateUserAnimationCode(sourceCode);
    if (validationError) return jsonError(res, 400, `Source cannot be saved from gallery: ${validationError}`);

    const baseName = nameOverride || cloneName(sourceItem.name || sourceItem.file || "Gallery animation");
    const baseSlug = slugifyName(baseName);
    let slug = baseSlug;
    let suffix = 2;
    const usedIds = new Set(library.items.map((item) => item.id));
    const usedFiles = new Set(library.items.map((item) => item.file));
    while (usedIds.has(`gallery:${slug}`) || usedFiles.has(`${slug}.js`) || fs.existsSync(path.join(userAnimDir, `${slug}.js`))) {
      slug = `${baseSlug}_${suffix++}`;
    }

    fs.mkdirSync(userAnimDir, { recursive: true });
    const file = `${slug}.js`;
    const targetFile = path.join(userAnimDir, file);
    fs.writeFileSync(`${targetFile}.tmp`, `${sourceCode.trim()}
`, "utf8");
    fs.renameSync(`${targetFile}.tmp`, targetFile);

    const copy = normalizeItem({
      ...sourceItem,
      id: `gallery:${slug}`,
      name: baseName,
      file,
      source: `user_anims/${file}`,
      origin: "gallery",
      readonly: false,
      order: library.items.length,
      layerOrder: normalizeLayerOrder({}, library.items.length),
      tags: normalizeTags([...(sourceItem.tags || []).filter((tag) => String(tag).toLowerCase() !== "builtin"), "gallery", "saved", "user"]),
      prewarm: normalizePrewarm({ ...(sourceItem.prewarm || {}), priority: Math.max(70, Number(sourceItem.prewarm?.priority || 40)), warmOnSelect: true, warmNeighbors: true }),
      gallery: normalizeGallery({ ...(sourceItem.gallery || {}), savable: true, favoriteable: true, albumIds: ["custom", "saved-from-gallery", ...(sourceItem.gallery?.albumIds || [])] })
    }, library.items.length);

    library.items.push(copy);
    const updated = writeLibrary({ libraryFile: resolvedFile, library });
    res.json({ ok: true, item: findItem(updated, copy.id), updatedAt: updated.updatedAt });
  });

  app.get("/api/animations/prewarm-plan", (req, res) => {
    const layer = String(req.query?.layer || "all").toLowerCase();
    const limit = Math.max(1, Math.min(200, Number(req.query?.limit || 80)));
    const library = readLibrary({ publicDir, libraryFile: resolvedFile });
    const items = library.items
      .filter((item) => !item.archived)
      .filter((item) => layer === "all" || item.enabledFor.includes(layer))
      .map((item) => ({
        id: item.id,
        name: item.name,
        file: item.file,
        source: item.source || `l1_anims/${item.file}`,
        enabledFor: item.enabledFor,
        priority: Number(item.prewarm?.priority || 40),
        mode: item.prewarm?.mode || "idle-neighbor",
        samplePoints: Number(item.prewarm?.samplePoints || 48),
        warmOnSelect: item.prewarm?.warmOnSelect !== false,
        warmNeighbors: item.prewarm?.warmNeighbors !== false,
        order: item.order
      }))
      .sort((a, b) => (b.priority - a.priority) || (a.order - b.order) || a.name.localeCompare(b.name))
      .slice(0, limit);
    res.json({ ok: true, layer, count: items.length, items, updatedAt: library.updatedAt || null });
  });

  app.post("/api/animations/prewarm-hint", (req, res) => {
    const id = String(req.body?.id || "").trim();
    const library = readLibrary({ publicDir, libraryFile: resolvedFile });
    const item = findItem(library, id);
    if (!item) return jsonError(res, 404, "Animation not found.");
    item.prewarm = normalizePrewarm({ ...(item.prewarm || {}), ...(req.body?.prewarm || {}) });
    const updated = writeLibrary({ libraryFile: resolvedFile, library });
    res.json({ ok: true, item: findItem(updated, id), updatedAt: updated.updatedAt });
  });

  app.post("/api/animations/duplicate", (req, res) => {
    const id = String(req.body?.id || "").trim();
    const nameOverride = String(req.body?.name || "").trim();
    if (!id) return jsonError(res, 400, "Missing animation id.");
    const library = readLibrary({ publicDir, libraryFile: resolvedFile });
    if (library.source !== "manifest") return jsonError(res, 409, "Animation manifest is not writable.");
    const sourceItem = findItem(library, id);
    if (!sourceItem) return jsonError(res, 404, "Animation not found.");
    const sourceFile = resolvePublicSource(publicDir, sourceItem.source || `l1_anims/${sourceItem.file}`);
    if (!sourceFile || !fs.existsSync(sourceFile)) return jsonError(res, 404, "Animation source file not found.");

    const sourceCode = fs.readFileSync(sourceFile, "utf8");
    const validationError = validateUserAnimationCode(sourceCode);
    if (validationError) return jsonError(res, 400, `Source cannot be duplicated: ${validationError}`);

    const baseSlug = slugifyName(nameOverride || cloneName(sourceItem.name));
    let slug = baseSlug;
    let suffix = 2;
    const usedIds = new Set(library.items.map((item) => item.id));
    const usedFiles = new Set(library.items.map((item) => item.file));
    while (usedIds.has(`user:${slug}`) || usedFiles.has(`${slug}.js`) || fs.existsSync(path.join(userAnimDir, `${slug}.js`))) {
      slug = `${baseSlug}_${suffix++}`;
    }

    fs.mkdirSync(userAnimDir, { recursive: true });
    const file = `${slug}.js`;
    const targetFile = path.join(userAnimDir, file);
    fs.writeFileSync(`${targetFile}.tmp`, `${sourceCode.trim()}\n`, "utf8");
    fs.renameSync(`${targetFile}.tmp`, targetFile);

    const item = normalizeItem({
      id: `user:${slug}`,
      name: nameOverride || cloneName(sourceItem.name),
      description: sourceItem.description ? `${sourceItem.description}\n\nDuplicated from ${sourceItem.name}.` : `Duplicated from ${sourceItem.name}.`,
      file,
      source: `user_anims/${file}`,
      kind: sourceItem.kind || "module",
      origin: "user",
      enabledFor: [],
      tags: normalizeTags([...(sourceItem.tags || []).filter((tag) => !VALID_LAYERS.has(String(tag).toLowerCase())), "user", "duplicate"]),
      params: sourceItem.params || [],
      prewarm: normalizePrewarm(sourceItem.prewarm),
      gallery: normalizeGallery(sourceItem.gallery),
      order: library.items.length,
      readonly: false
    }, library.items.length);
    library.items.push(item);
    const updated = writeLibrary({ libraryFile: resolvedFile, library });
    res.json({ ok: true, item: findItem(updated, item.id), updatedAt: updated.updatedAt });
  });

  app.post("/api/animations/set-archived", (req, res) => {
    const id = String(req.body?.id || "").trim();
    const archived = req.body?.archived === true;
    if (!id) return jsonError(res, 400, "Missing animation id.");
    const library = readLibrary({ publicDir, libraryFile: resolvedFile });
    if (library.source !== "manifest") return jsonError(res, 409, "Animation manifest is not writable.");
    const item = findItem(library, id);
    if (!item) return jsonError(res, 404, "Animation not found.");
    item.archived = archived;
    if (archived) {
      item.enabledFor = [];
      syncLayerTags(item);
      item.tags = normalizeTags([...(item.tags || []), "archived"]);
    } else {
      item.tags = normalizeTags((item.tags || []).filter((tag) => String(tag).toLowerCase() !== "archived"));
    }
    const updated = writeLibrary({ libraryFile: resolvedFile, library });
    res.json({ ok: true, item: findItem(updated, id), updatedAt: updated.updatedAt });
  });


  app.post("/api/animations/save-selector", (req, res) => {
    const layer = String(req.body?.layer || "").trim().toLowerCase();
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map((id) => String(id || "").trim()).filter(Boolean) : [];
    if (!VALID_LAYERS.has(layer)) return jsonError(res, 400, "Invalid layer.");
    const library = readLibrary({ publicDir, libraryFile: resolvedFile });
    if (library.source !== "manifest") return jsonError(res, 409, "Animation manifest is not writable.");

    const seen = new Set();
    const cleanIds = [];
    for (const id of ids) {
      if (seen.has(id)) continue;
      const item = findItem(library, id);
      if (!item) return jsonError(res, 404, `Animation not found: ${id}`);
      if (item.archived) return jsonError(res, 400, `Archived animation cannot be in selector: ${id}`);
      seen.add(id);
      cleanIds.push(id);
    }

    for (const item of library.items) {
      const inSelector = cleanIds.includes(item.id) || cleanIds.includes(item.file);
      if (inSelector) {
        item.enabledFor = freezeUniqueList([...item.enabledFor, layer]);
        item.layerOrder = { ...(item.layerOrder || {}), [layer]: cleanIds.findIndex((id) => id === item.id || id === item.file) };
      } else {
        item.enabledFor = item.enabledFor.filter((value) => value !== layer);
      }
      syncLayerTags(item);
    }

    const updated = writeLibrary({ libraryFile: resolvedFile, library });
    const items = sortItemsForLayer(updated.items.filter((item) => item.enabledFor.includes(layer) && !item.archived), layer);
    res.json({ ok: true, layer, items, updatedAt: updated.updatedAt });
  });

  app.post("/api/animations/reorder", (req, res) => {
    const id = String(req.body?.id || "").trim();
    const direction = String(req.body?.direction || "").trim().toLowerCase();
    const layer = String(req.body?.layer || "").trim().toLowerCase();
    if (!id) return jsonError(res, 400, "Missing animation id.");
    if (!["up", "down"].includes(direction)) return jsonError(res, 400, "Invalid direction.");
    if (layer && !VALID_LAYERS.has(layer)) return jsonError(res, 400, "Invalid layer.");
    const library = readLibrary({ publicDir, libraryFile: resolvedFile });
    if (library.source !== "manifest") return jsonError(res, 409, "Animation manifest is not writable.");

    if (layer) {
      const itemsForLayer = sortItemsForLayer(library.items.filter((item) => item.enabledFor.includes(layer)), layer);
      const index = itemsForLayer.findIndex((item) => item.id === id || item.file === id);
      if (index < 0) return jsonError(res, 404, "Animation is not enabled for this layer.");
      const target = direction === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= itemsForLayer.length) {
        return res.json({ ok: true, unchanged: true, item: itemsForLayer[index], updatedAt: library.updatedAt });
      }
      [itemsForLayer[index], itemsForLayer[target]] = [itemsForLayer[target], itemsForLayer[index]];
      itemsForLayer.forEach((item, order) => {
        item.layerOrder = { ...(item.layerOrder || {}), [layer]: order };
      });
      const updated = writeLibrary({ libraryFile: resolvedFile, library });
      return res.json({ ok: true, layer, item: findItem(updated, id), updatedAt: updated.updatedAt });
    }

    const items = sortItems(library.items);
    const index = items.findIndex((item) => item.id === id || item.file === id);
    if (index < 0) return jsonError(res, 404, "Animation not found.");
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= items.length) {
      return res.json({ ok: true, unchanged: true, item: items[index], updatedAt: library.updatedAt });
    }
    [items[index], items[target]] = [items[target], items[index]];
    library.items = items;
    const updated = writeLibrary({ libraryFile: resolvedFile, library });
    res.json({ ok: true, item: findItem(updated, id), updatedAt: updated.updatedAt });
  });
}
