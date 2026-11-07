# Shader Registry + Preload Cache (Skeleton)

Bod 6 zavadi oddelenou shader registry vrstvu v `src/render/shader_registry`.

## Soubory

- `constants.js` - defaults + fallback ID
- `cache.js` - LRU-like in-memory program cache
- `queue.js` - bounded preload queue
- `registry.js` - orchestrace register/compile/preload/switch/fallback

## API

- `createShaderRegistry(options)`
  - `register(def)`
  - `registerMany(list)`
  - `preloadAll(compiler)`
  - `drainPreload(compiler)`
  - `activate(id, compiler)`
  - `getActiveProgram()`
  - `getStats()`

## Chovani

1. Pri nevalidnim/failed shader switchi se aktivuje fallback shader.
2. Preload bezi v batchich (`warmupBatchSize`), ne vse naraz.
3. Statistiky (`cacheHits`, `cacheMisses`, `compileCount`, `avgCompileMs`) jsou pripravene pro debug napojeni.

## Poznamka

Jde o bezpecny migration skeleton. Produkcni `public/gpu_renderer.js` zatim neni prepnuty na tuto vrstvu.
