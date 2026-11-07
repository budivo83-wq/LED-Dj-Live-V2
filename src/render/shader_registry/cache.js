/**
 * In-memory shader program cache skeleton.
 * Stores compile metadata and program handles (opaque for now).
 */
export function createShaderProgramCache(maxPrograms = 256) {
  const cap = Math.max(16, Number(maxPrograms) || 256);
  const map = new Map();

  function touch(id, value) {
    if (map.has(id)) map.delete(id);
    map.set(id, value);
    if (map.size > cap) {
      const oldestKey = map.keys().next().value;
      map.delete(oldestKey);
    }
  }

  return {
    set(id, entry) {
      touch(String(id), entry);
    },
    get(id) {
      const key = String(id);
      const value = map.get(key);
      if (!value) return null;
      touch(key, value);
      return value;
    },
    has(id) {
      return map.has(String(id));
    },
    delete(id) {
      return map.delete(String(id));
    },
    clear() {
      map.clear();
    },
    size() {
      return map.size;
    },
    keys() {
      return Array.from(map.keys());
    }
  };
}
