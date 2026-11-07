import { SHADER_FALLBACK_ID, SHADER_REGISTRY_DEFAULTS } from './constants.js';
import { createShaderProgramCache } from './cache.js';
import { createShaderCompileQueue } from './queue.js';

/**
 * Shader registry skeleton.
 * - register shader descriptors
 * - precompile into cache
 * - switch active shader by id
 * - fallback on compile/switch failure
 */
export function createShaderRegistry(options = {}) {
  const maxPrograms = Number(options.maxPrograms || SHADER_REGISTRY_DEFAULTS.maxPrograms);
  const batchSize = Number(options.warmupBatchSize || SHADER_REGISTRY_DEFAULTS.warmupBatchSize);

  const descriptors = new Map();
  const cache = createShaderProgramCache(maxPrograms);
  const queue = createShaderCompileQueue(batchSize);

  let activeShaderId = SHADER_FALLBACK_ID;
  let lastCompileMs = 0;
  let compileCount = 0;
  let compileFailures = 0;
  let cacheHits = 0;
  let cacheMisses = 0;

  descriptors.set(SHADER_FALLBACK_ID, {
    id: SHADER_FALLBACK_ID,
    kind: 'fallback',
    source: null
  });
  cache.set(SHADER_FALLBACK_ID, {
    id: SHADER_FALLBACK_ID,
    program: null,
    compiledAt: performance.now(),
    compileMs: 0,
    ok: true
  });

  function register(def) {
    const id = String(def?.id || '').trim();
    if (!id) throw new Error('Shader id is required');
    descriptors.set(id, { ...def, id });
  }

  function registerMany(list) {
    for (const item of list || []) register(item);
  }

  function compileOne(id, compiler) {
    const shaderId = String(id);
    const desc = descriptors.get(shaderId);
    if (!desc) return null;

    const cached = cache.get(shaderId);
    if (cached?.ok) {
      cacheHits += 1;
      return cached;
    }

    cacheMisses += 1;
    const startedAt = performance.now();
    try {
      const program = compiler ? compiler(desc) : { placeholder: true, id: shaderId };
      const compileMs = Math.max(0, performance.now() - startedAt);
      lastCompileMs = compileMs;
      compileCount += 1;
      const entry = {
        id: shaderId,
        program,
        compiledAt: performance.now(),
        compileMs,
        ok: true
      };
      cache.set(shaderId, entry);
      return entry;
    } catch (error) {
      compileFailures += 1;
      cache.set(shaderId, {
        id: shaderId,
        program: null,
        compiledAt: performance.now(),
        compileMs: Math.max(0, performance.now() - startedAt),
        ok: false,
        error: String(error?.message || error || 'compile_failed')
      });
      return null;
    }
  }

  function preloadAll(compiler) {
    for (const id of descriptors.keys()) {
      if (id === SHADER_FALLBACK_ID) continue;
      queue.enqueue(id);
    }
    return drainPreload(compiler);
  }

  function drainPreload(compiler) {
    return queue.drainBatch((id) => {
      compileOne(id, compiler);
    });
  }

  function activate(id, compiler) {
    const shaderId = String(id || SHADER_FALLBACK_ID);
    const entry = compileOne(shaderId, compiler);
    if (entry?.ok) {
      activeShaderId = shaderId;
      return shaderId;
    }
    activeShaderId = SHADER_FALLBACK_ID;
    return SHADER_FALLBACK_ID;
  }

  function getActiveProgram() {
    const entry = cache.get(activeShaderId) || cache.get(SHADER_FALLBACK_ID);
    return entry?.program || null;
  }

  function getStats() {
    const avgCompileMs = compileCount > 0 ? (cache.keys()
      .map((id) => cache.get(id))
      .filter((entry) => entry && Number.isFinite(entry.compileMs))
      .reduce((sum, entry) => sum + Number(entry.compileMs || 0), 0) / compileCount) : 0;

    return {
      activeShaderId,
      compileCount,
      compileFailures,
      lastCompileMs,
      avgCompileMs,
      cacheHits,
      cacheMisses,
      cachedPrograms: cache.size(),
      preloadQueue: queue.size()
    };
  }

  return {
    register,
    registerMany,
    preloadAll,
    drainPreload,
    activate,
    getActiveProgram,
    getStats,
    listShaders() {
      return Array.from(descriptors.keys());
    },
    clearCache() {
      cache.clear();
      cache.set(SHADER_FALLBACK_ID, {
        id: SHADER_FALLBACK_ID,
        program: null,
        compiledAt: performance.now(),
        compileMs: 0,
        ok: true
      });
      activeShaderId = SHADER_FALLBACK_ID;
    }
  };
}
