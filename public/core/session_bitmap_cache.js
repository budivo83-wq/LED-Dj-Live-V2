function canUseSessionStorage() {
  try {
    return typeof sessionStorage !== "undefined";
  } catch {
    return false;
  }
}

function bytesToBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    let part = "";
    for (let i = 0; i < chunk.length; i += 1) part += String.fromCharCode(chunk[i]);
    binary += part;
  }
  return btoa(binary);
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8ClampedArray(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function imageDataFromBytes(width, height, bytes, documentRef = document) {
  if (typeof ImageData === "function") {
    return new ImageData(bytes, width, height);
  }
  const context = documentRef.createElement("canvas").getContext("2d");
  if (!context) return null;
  const image = context.createImageData(width, height);
  image.data.set(bytes);
  return image;
}

export function createSessionBitmapCache(prefix, options = {}) {
  const {
    maxEntries = 48,
    maxBytes = 2_500_000,
    documentRef = document
  } = options;
  const manifestKey = `${prefix}:manifest`;
  const storagePrefix = `${prefix}:item:`;

  function readManifest() {
    if (!canUseSessionStorage()) return { order: [], sizes: {}, bytes: 0 };
    try {
      const raw = sessionStorage.getItem(manifestKey);
      if (!raw) return { order: [], sizes: {}, bytes: 0 };
      const parsed = JSON.parse(raw);
      return {
        order: Array.isArray(parsed?.order) ? parsed.order : [],
        sizes: parsed?.sizes && typeof parsed.sizes === "object" ? parsed.sizes : {},
        bytes: Number.isFinite(parsed?.bytes) ? parsed.bytes : 0
      };
    } catch {
      return { order: [], sizes: {}, bytes: 0 };
    }
  }

  function writeManifest(manifest) {
    if (!canUseSessionStorage()) return;
    try {
      sessionStorage.setItem(manifestKey, JSON.stringify(manifest));
    } catch {
      // ignore persistence failures
    }
  }

  function removeEntry(key, manifest) {
    if (!canUseSessionStorage()) return manifest;
    const size = manifest.sizes[key] || 0;
    manifest.bytes = Math.max(0, manifest.bytes - size);
    manifest.order = manifest.order.filter((entry) => entry !== key);
    delete manifest.sizes[key];
    try {
      sessionStorage.removeItem(`${storagePrefix}${key}`);
    } catch {
      // ignore removal failures
    }
    return manifest;
  }

  function ensureLimits(manifest) {
    while (manifest.order.length > maxEntries || manifest.bytes > maxBytes) {
      const oldest = manifest.order[manifest.order.length - 1];
      if (!oldest) break;
      removeEntry(oldest, manifest);
    }
    return manifest;
  }

  function touch(key, size, manifest) {
    manifest.order = manifest.order.filter((entry) => entry !== key);
    manifest.order.unshift(key);
    manifest.sizes[key] = size;
    manifest.bytes = Object.values(manifest.sizes).reduce((sum, value) => sum + (Number(value) || 0), 0);
    return ensureLimits(manifest);
  }

  function read(key) {
    if (!canUseSessionStorage()) return null;
    try {
      const raw = sessionStorage.getItem(`${storagePrefix}${key}`);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed?.w || !parsed?.h || !parsed?.d) return null;
      const bytes = base64ToBytes(parsed.d);
      if (bytes.length !== parsed.w * parsed.h * 4) return null;
      const image = imageDataFromBytes(parsed.w, parsed.h, bytes, documentRef);
      if (!image) return null;
      const manifest = readManifest();
      touch(key, raw.length, manifest);
      writeManifest(manifest);
      return image;
    } catch {
      return null;
    }
  }

  function write(key, imageData) {
    if (!canUseSessionStorage() || !imageData?.data?.length) return false;
    const payload = {
      w: imageData.width,
      h: imageData.height,
      d: bytesToBase64(imageData.data)
    };
    const raw = JSON.stringify(payload);
    let manifest = readManifest();
    manifest = touch(key, raw.length, manifest);
    try {
      sessionStorage.setItem(`${storagePrefix}${key}`, raw);
      writeManifest(manifest);
      return true;
    } catch {
      while (manifest.order.length) {
        const oldest = manifest.order[manifest.order.length - 1];
        if (!oldest || oldest === key) break;
        removeEntry(oldest, manifest);
        try {
          sessionStorage.setItem(`${storagePrefix}${key}`, raw);
          writeManifest(manifest);
          return true;
        } catch {
          continue;
        }
      }
      removeEntry(key, manifest);
      writeManifest(manifest);
      return false;
    }
  }

  function has(key) {
    if (!canUseSessionStorage()) return false;
    try {
      return sessionStorage.getItem(`${storagePrefix}${key}`) !== null;
    } catch {
      return false;
    }
  }

  function clear() {
    if (!canUseSessionStorage()) return;
    const manifest = readManifest();
    for (const key of manifest.order) {
      try {
        sessionStorage.removeItem(`${storagePrefix}${key}`);
      } catch {
        // ignore
      }
    }
    try {
      sessionStorage.removeItem(manifestKey);
    } catch {
      // ignore
    }
  }

  return {
    read,
    write,
    has,
    clear
  };
}
