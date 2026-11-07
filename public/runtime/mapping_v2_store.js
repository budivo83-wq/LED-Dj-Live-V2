import { createDefaultMappingV2, migrateLegacyMappingToV2, normalizeMappingV2, compileMappingV2 } from './mapping_v2.js';

export const MAPPING_V2_STORAGE_KEY = 'led-engine-mapping-v2';
export const LEGACY_MAPPING_STORAGE_KEY = 'led-engine-mapping-v1';
const mappingStorageCache = new WeakMap();

function storageCacheEntry(storage) {
  if (!storage || (typeof storage !== 'object' && typeof storage !== 'function')) return null;
  let entry = mappingStorageCache.get(storage);
  if (!entry) {
    entry = {
      v2Raw: null,
      v2Mapping: null,
      v2Compiled: null,
      legacyRaw: null,
      legacyMapping: null,
      legacyCompiled: null
    };
    mappingStorageCache.set(storage, entry);
  }
  return entry;
}

export function loadMappingV2(storage = globalThis.localStorage) {
  return loadMappingBundle(storage).mapping;
}

export function loadCompiledMappingV2(storage = globalThis.localStorage) {
  return loadMappingBundle(storage).compiled;
}

export function saveMappingV2(mapping, storage = globalThis.localStorage) {
  const normalized = normalizeMappingV2(mapping);
  const compiled = compileMappingV2(normalized);
  const payload = {
    ...normalized,
    compiled,
    savedAt: new Date().toISOString()
  };
  storage?.setItem?.(MAPPING_V2_STORAGE_KEY, JSON.stringify(payload));
  const cache = storageCacheEntry(storage);
  if (cache) {
    cache.v2Raw = JSON.stringify(payload);
    cache.v2Mapping = normalized;
    cache.v2Compiled = compiled;
    cache.legacyRaw = null;
    cache.legacyMapping = null;
    cache.legacyCompiled = null;
  }
  return payload;
}

export function exportMappingV2Document(mapping) {
  const normalized = normalizeMappingV2(mapping);
  const compiled = compileMappingV2(normalized);
  return {
    schema: 'led-dj-live.mapping.v2',
    exportedAt: new Date().toISOString(),
    mapping: normalized,
    compiled,
    safety: {
      liveOutputApply: true,
      note: 'Mapping V2 export from active editor. Runtime compatibility is provided through led-engine-mapping-v1 legacy export on save.'
    }
  };
}

export function parseMappingV2Document(text) {
  const parsed = typeof text === 'string' ? JSON.parse(text) : text;
  const candidate = parsed?.mapping || parsed?.mappingV2 || parsed;
  return normalizeMappingV2(candidate);
}

export function createMappingPreset(name, options = {}) {
  const key = String(name || '').toLowerCase().trim();
  if (key === '8x300' || key === 'ceiling-8x300') return createDefaultMappingV2({ count: 8, pixelsPerStrip: 300, columns: 4, rowGap: 20, ...options });
  if (key === '4x300') return createDefaultMappingV2({ count: 4, pixelsPerStrip: 300, columns: 4, rowGap: 20, ...options });
  if (key === '2x300') return createDefaultMappingV2({ count: 2, pixelsPerStrip: 300, columns: 2, rowGap: 20, ...options });
  if (key === '8x144') return createDefaultMappingV2({ count: 8, pixelsPerStrip: 144, columns: 4, rowGap: 20, ...options });
  return createDefaultMappingV2(options);
}

function readJson(storage, key) {
  try {
    const raw = storage?.getItem?.(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function loadMappingBundle(storage = globalThis.localStorage) {
  const cache = storageCacheEntry(storage);
  const v2Raw = readRaw(storage, MAPPING_V2_STORAGE_KEY);
  if (v2Raw) {
    if (cache?.v2Raw === v2Raw && cache?.v2Mapping && cache?.v2Compiled) {
      return { mapping: cache.v2Mapping, compiled: cache.v2Compiled };
    }
    const v2 = readJsonFromRaw(v2Raw);
    if (v2?.segments || v2?.mappingV2?.segments) {
      const normalized = normalizeMappingV2(v2.mappingV2 || v2);
      const compiled = compileMappingV2(normalized);
      if (cache) {
        cache.v2Raw = v2Raw;
        cache.v2Mapping = normalized;
        cache.v2Compiled = compiled;
        cache.legacyRaw = null;
        cache.legacyMapping = null;
        cache.legacyCompiled = null;
      }
      return { mapping: normalized, compiled };
    }
  }

  const legacyRaw = readRaw(storage, LEGACY_MAPPING_STORAGE_KEY);
  if (legacyRaw) {
    if (cache?.legacyRaw === legacyRaw && cache?.legacyMapping && cache?.legacyCompiled) {
      return { mapping: cache.legacyMapping, compiled: cache.legacyCompiled };
    }
    const legacy = readJsonFromRaw(legacyRaw);
    if (legacy?.mappingV2?.segments || legacy?.segments || legacy?.strips) {
      const normalized = migrateLegacyMappingToV2(legacy.mappingV2 || legacy);
      const compiled = compileMappingV2(normalized);
      if (cache) {
        cache.legacyRaw = legacyRaw;
        cache.legacyMapping = normalized;
        cache.legacyCompiled = compiled;
        cache.v2Raw = null;
        cache.v2Mapping = null;
        cache.v2Compiled = null;
      }
      return { mapping: normalized, compiled };
    }
  }

  const fallback = createDefaultMappingV2({ count: 8, pixelsPerStrip: 300, columns: 4 });
  const compiled = compileMappingV2(fallback);
  return { mapping: fallback, compiled };
}

function readRaw(storage, key) {
  try {
    return storage?.getItem?.(key) || null;
  } catch {
    return null;
  }
}

function readJsonFromRaw(raw) {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
