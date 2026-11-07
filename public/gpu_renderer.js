import { gpuCatalog } from "./shader_anim_engine.js?v=20260512r1";
const EMPTY_MANUAL_COLORS = new Float32Array(9);
const DEFAULT_PARAMS = new Float32Array([0.5, 0.5, 0.5, 0.5]);
const FAILED_SHADER = Symbol("FAILED_SHADER");
const SCENE_SHADER_BANK_SIZE = 10;
const shaderProgramCacheByGl = new WeakMap();
const shaderStats = {
  cacheHits: 0,
  cacheMisses: 0,
  compileCount: 0,
  compileFailures: 0,
  totalCompileMs: 0,
  lastCompileMs: 0,
  lastCompileAt: 0
};

export function getGpuShaderStats() {
  const avgCompileMs = shaderStats.compileCount > 0 ? (shaderStats.totalCompileMs / shaderStats.compileCount) : 0;
  return {
    ...shaderStats,
    avgCompileMs
  };
}

export function resetGpuShaderStats() {
  shaderStats.cacheHits = 0;
  shaderStats.cacheMisses = 0;
  shaderStats.compileCount = 0;
  shaderStats.compileFailures = 0;
  shaderStats.totalCompileMs = 0;
  shaderStats.lastCompileMs = 0;
  shaderStats.lastCompileAt = 0;
}

export function createLedRenderer(canvas, cellSize, options = {}) {
  if (options?.force2d) return createCanvas2dRenderer(canvas, cellSize);
  const glRenderer = createWebGlRenderer(canvas, cellSize, options);
  if (glRenderer) return glRenderer;
  return createCanvas2dRenderer(canvas, cellSize, options);
}

function cacheForGl(gl) {
  let cache = shaderProgramCacheByGl.get(gl);
  if (!cache) {
    cache = new Map();
    shaderProgramCacheByGl.set(gl, cache);
  }
  return cache;
}

function getCachedShader(gl, shaderId, compileFn, options = {}) {
  const { compileIfMissing = true, localCache = null } = options;
  const globalCache = cacheForGl(gl);

  const localHit = localCache?.get(shaderId);
  if (localHit !== undefined) {
    shaderStats.cacheHits += 1;
    return localHit === FAILED_SHADER ? null : localHit;
  }

  const globalHit = globalCache.get(shaderId);
  if (globalHit !== undefined) {
    shaderStats.cacheHits += 1;
    if (localCache) localCache.set(shaderId, globalHit);
    return globalHit === FAILED_SHADER ? null : globalHit;
  }

  if (!compileIfMissing) return null;
  shaderStats.cacheMisses += 1;

  const compiled = compileFn?.();
  const cachedValue = compiled || FAILED_SHADER;
  globalCache.set(shaderId, cachedValue);
  if (localCache) localCache.set(shaderId, cachedValue);
  return compiled || null;
}

const layerPreviewRenderers = new WeakMap();

export function renderShaderLayerCanvas(targetCanvas, gpu, options) {
  if (!targetCanvas || !gpu?.code || !gpu?.functionName) return false;
  const context = targetCanvas.getContext("2d");
  if (!context) return false;

  let renderer = layerPreviewRenderers.get(targetCanvas);
  if (!renderer) {
    renderer = createLayerShaderRenderer();
    if (!renderer) return false;
    layerPreviewRenderers.set(targetCanvas, renderer);
  }

  if (!renderer.draw(gpu, targetCanvas.width, targetCanvas.height, options)) return false;
  context.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
  context.drawImage(renderer.canvas, 0, 0, targetCanvas.width, targetCanvas.height);
  return true;
}

export function createShaderSceneRenderer(canvas) {
  const gl = canvas.getContext("webgl", {
    alpha: false,
    antialias: false,
    depth: false,
    preserveDrawingBuffer: false,
    stencil: false
  }) || canvas.getContext("experimental-webgl", {
    alpha: false,
    antialias: false,
    depth: false,
    preserveDrawingBuffer: false,
    stencil: false
  });

  if (!gl) return null;

  const positionBuffer = gl.createBuffer();
  const uvBuffer = gl.createBuffer();
  const programs = new Map();
  const frameTexture = gl.createTexture();
  const frameProgram = createProgram(gl, `
    attribute vec2 a_position;
    attribute vec2 a_uv;
    varying vec2 v_uv;

    void main() {
      gl_Position = vec4(a_position, 0.0, 1.0);
      v_uv = a_uv;
    }
  `, `
    precision mediump float;
    varying vec2 v_uv;
    uniform sampler2D u_frame;

    void main() {
      gl_FragColor = texture2D(u_frame, v_uv);
    }
  `);
  const frameLocations = frameProgram ? {
    position: gl.getAttribLocation(frameProgram, "a_position"),
    uv: gl.getAttribLocation(frameProgram, "a_uv"),
    frame: gl.getUniformLocation(frameProgram, "u_frame")
  } : null;
  const positions = new Float32Array([-1, 1, 1, 1, -1, -1, -1, -1, 1, 1, 1, -1]);
  const uvs = new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]);

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.STATIC_DRAW);
  if (frameTexture) {
    gl.bindTexture(gl.TEXTURE_2D, frameTexture);
    // STEP37ED: when shader preview falls back to the low-resolution master
    // LED buffer during live output, LINEAR filtering smears the 30x10 pixels
    // across the large preview. Use nearest-neighbour for that frame texture so
    // the monitor stays crisp; real GPU shader-scene rendering remains full-res.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }
  gl.disable(gl.DEPTH_TEST);
  gl.disable(gl.BLEND);

  let lastWidth = 0;
  let lastHeight = 0;

  return {
    kind: "webgl",
    resize(width, height) {
      if (width === lastWidth && height === lastHeight) return;
      lastWidth = width;
      lastHeight = height;
      canvas.width = Math.max(1, width);
      canvas.height = Math.max(1, height);
      gl.viewport(0, 0, canvas.width, canvas.height);
    },
    drawShaderScene(scene) {
      if (canvas.width !== lastWidth || canvas.height !== lastHeight) {
        gl.viewport(0, 0, canvas.width, canvas.height);
      }
      if (!scene?.enabled) {
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        return true;
      }

      const shader = shaderForScene(gl, programs, scene);
      if (!shader) return false;

      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(shader.program);

      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.enableVertexAttribArray(shader.locations.position);
      gl.vertexAttribPointer(shader.locations.position, 2, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
      gl.enableVertexAttribArray(shader.locations.uv);
      gl.vertexAttribPointer(shader.locations.uv, 2, gl.FLOAT, false, 0, 0);

      setUniforms(gl, shader.uniforms, scene);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      return true;
    },
    draw(frame, matrixWidth, matrixHeight, enabled) {
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      if (!enabled || !frame?.length || !frameLocations || !frameTexture) return;

      gl.bindTexture(gl.TEXTURE_2D, frameTexture);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGB,
        Math.max(1, matrixWidth),
        Math.max(1, matrixHeight),
        0,
        gl.RGB,
        gl.UNSIGNED_BYTE,
        frame
      );

      gl.useProgram(frameProgram);
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.enableVertexAttribArray(frameLocations.position);
      gl.vertexAttribPointer(frameLocations.position, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
      gl.enableVertexAttribArray(frameLocations.uv);
      gl.vertexAttribPointer(frameLocations.uv, 2, gl.FLOAT, false, 0, 0);
      gl.uniform1i(frameLocations.frame, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    },
    canDrawShaderScene(scene) {
      if (!scene?.enabled) return false;
      return Boolean(shaderForScene(gl, programs, scene, false));
    },
    warmupShaderScene(scene) {
      if (!scene?.enabled) return false;
      const shader = shaderForScene(gl, programs, scene, true);
      if (!shader) return false;
      gl.useProgram(shader.program);
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.enableVertexAttribArray(shader.locations.position);
      gl.vertexAttribPointer(shader.locations.position, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
      gl.enableVertexAttribArray(shader.locations.uv);
      gl.vertexAttribPointer(shader.locations.uv, 2, gl.FLOAT, false, 0, 0);
      setUniforms(gl, shader.uniforms, scene);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      return true;
    }
  };
}

export function shaderPaletteId(file) {
  return paletteId(file);
}

export function warmupLayerPreviewShaders(onProgress) {
  const renderer = createLayerShaderRenderer();
  if (!renderer) return Promise.resolve();
  const catalog = gpuCatalog() || {};
  const list = Object.values(catalog).filter((gpu) => gpu?.code && gpu?.functionName);
  if (!list.length) return Promise.resolve();
  let index = 0;
  onProgress?.(0, list.length);

  return new Promise((resolve) => {
    const step = (deadline) => {
      let count = 0;
      while (index < list.length) {
        const timeLeft = typeof deadline?.timeRemaining === "function" ? deadline.timeRemaining() : 8;
        if (count > 0 && timeLeft < 3) break;
        renderer.draw(list[index], 16, 16, {
          time: 0,
          beat: 0,
          params: DEFAULT_PARAMS,
          paletteFile: "neon",
          manualPalette: null,
          flip: false,
          mirrorX: false,
          mirrorY: false
        });
        index += 1;
        count += 1;
        onProgress?.(index, list.length);
        if (count >= 1) break;
      }
      if (index < list.length) {
        if ("requestIdleCallback" in window) requestIdleCallback(step, { timeout: 120 });
        else setTimeout(() => step({ timeRemaining: () => 8 }), 16);
        return;
      }
      resolve();
    };

    if ("requestIdleCallback" in window) requestIdleCallback(step, { timeout: 120 });
    else setTimeout(() => step({ timeRemaining: () => 8 }), 16);
  });
}

function createWebGlRenderer(canvas, cellSize, options = {}) {
  const gl = canvas.getContext("webgl", {
    alpha: false,
    antialias: false,
    depth: false,
    preserveDrawingBuffer: false,
    stencil: false
  }) || canvas.getContext("experimental-webgl", {
    alpha: false,
    antialias: false,
    depth: false,
    preserveDrawingBuffer: false,
    stencil: false
  });

  if (!gl) return null;

  const program = createProgram(gl, `
    attribute vec2 a_position;
    attribute vec3 a_color;
    varying vec3 v_color;

    void main() {
      gl_Position = vec4(a_position, 0.0, 1.0);
      v_color = a_color;
    }
  `, `
    precision mediump float;
    varying vec3 v_color;

    void main() {
      gl_FragColor = vec4(v_color, 1.0);
    }
  `);

  if (!program) return null;

  const positionBuffer = gl.createBuffer();
  const uvBuffer = gl.createBuffer();
  const colorBuffer = gl.createBuffer();
  const positionLocation = gl.getAttribLocation(program, "a_position");
  const colorLocation = gl.getAttribLocation(program, "a_color");
  const shaderPrograms = new Map();

  let lastWidth = 0;
  let lastHeight = 0;
  let lastMatrixWidth = 0;
  let lastMatrixHeight = 0;
  let vertexCount = 0;
  let colorData = new Float32Array(0);

  gl.useProgram(program);
  gl.disable(gl.DEPTH_TEST);
  gl.disable(gl.BLEND);

  return {
    kind: "webgl",
    resize(width, height, matrixWidth, matrixHeight) {
      if (
        width === lastWidth &&
        height === lastHeight &&
        matrixWidth === lastMatrixWidth &&
        matrixHeight === lastMatrixHeight
      ) {
        return;
      }

      lastWidth = width;
      lastHeight = height;
      lastMatrixWidth = matrixWidth;
      lastMatrixHeight = matrixHeight;
      gl.viewport(0, 0, width, height);

      const positions = buildLedPositions(width, height, matrixWidth, matrixHeight, cellSize, { flipY: options.flipY });
      const uvs = buildLedUvs(matrixWidth, matrixHeight);
      vertexCount = positions.length / 2;
      colorData = new Float32Array(vertexCount * 3);

      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, colorData.byteLength, gl.DYNAMIC_DRAW);
    },
    draw(frame, matrixWidth, matrixHeight, enabled) {
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      if (!enabled || !frame?.length || !vertexCount) return;

      let colorOffset = 0;
      for (let i = 0; i < matrixWidth * matrixHeight; i += 1) {
        const r = frame[i * 3] / 255;
        const g = frame[i * 3 + 1] / 255;
        const b = frame[i * 3 + 2] / 255;
        for (let v = 0; v < 6; v += 1) {
          colorData[colorOffset] = r;
          colorData[colorOffset + 1] = g;
          colorData[colorOffset + 2] = b;
          colorOffset += 3;
        }
      }

      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, colorData);
      gl.enableVertexAttribArray(colorLocation);
      gl.vertexAttribPointer(colorLocation, 3, gl.FLOAT, false, 0, 0);

      gl.drawArrays(gl.TRIANGLES, 0, vertexCount);
    },
    drawShaderScene(scene) {
      if (!scene?.enabled || !vertexCount) {
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        return true;
      }

      const shader = shaderForScene(gl, shaderPrograms, scene);
      if (!shader) return false;

      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(shader.program);

      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.enableVertexAttribArray(shader.locations.position);
      gl.vertexAttribPointer(shader.locations.position, 2, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
      gl.enableVertexAttribArray(shader.locations.uv);
      gl.vertexAttribPointer(shader.locations.uv, 2, gl.FLOAT, false, 0, 0);

      setUniforms(gl, shader.uniforms, scene);
      gl.drawArrays(gl.TRIANGLES, 0, vertexCount);
      return true;
    },
    canDrawShaderScene(scene) {
      if (!scene?.enabled || !vertexCount) return false;
      return Boolean(shaderForScene(gl, shaderPrograms, scene, false));
    },
    warmupShaderScene(scene) {
      if (!scene?.enabled) return false;
      const shader = shaderForScene(gl, shaderPrograms, scene, true);
      if (!shader || !vertexCount) return Boolean(shader);

      // One offscreen-style draw call right after compile/load to avoid first-use GPU hitch.
      gl.useProgram(shader.program);
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.enableVertexAttribArray(shader.locations.position);
      gl.vertexAttribPointer(shader.locations.position, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
      gl.enableVertexAttribArray(shader.locations.uv);
      gl.vertexAttribPointer(shader.locations.uv, 2, gl.FLOAT, false, 0, 0);
      setUniforms(gl, shader.uniforms, scene);
      gl.drawArrays(gl.TRIANGLES, 0, vertexCount);
      return true;
    }
  };
}

function createCanvas2dRenderer(canvas, cellSize, options = {}) {
  const context = canvas.getContext("2d");
  return {
    kind: "2d",
    resize() {},
    drawShaderScene() {
      return false;
    },
    draw(frame, matrixWidth, matrixHeight, enabled) {
      context.clearRect(0, 0, canvas.width, canvas.height);
      if (!enabled || !frame?.length) return;

      for (let y = 0; y < matrixHeight; y += 1) {
        for (let x = 0; x < matrixWidth; x += 1) {
          const sourceY = options.flipY ? matrixHeight - 1 - y : y;
          const offset = (sourceY * matrixWidth + x) * 3;
          context.fillStyle = `rgb(${frame[offset]},${frame[offset + 1]},${frame[offset + 2]})`;
          context.fillRect(x * cellSize + 1, y * cellSize + 1, cellSize - 2, cellSize - 2);
        }
      }
    }
  };
}

function createLayerShaderRenderer() {
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl", {
    alpha: false,
    antialias: false,
    depth: false,
    preserveDrawingBuffer: false,
    stencil: false
  });
  if (!gl) return null;

  const positionBuffer = gl.createBuffer();
  const uvBuffer = gl.createBuffer();
  const programs = new Map();
  const positions = new Float32Array([-1, 1, 1, 1, -1, -1, -1, -1, 1, 1, 1, -1]);
  const uvs = new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]);

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.STATIC_DRAW);
  gl.disable(gl.DEPTH_TEST);
  gl.disable(gl.BLEND);

  return {
    canvas,
    draw(gpu, width, height, options) {
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;
      gl.viewport(0, 0, width, height);

      const shader = layerShaderForGpu(gl, programs, gpu);
      if (!shader) return false;

      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(shader.program);

      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.enableVertexAttribArray(shader.locations.position);
      gl.vertexAttribPointer(shader.locations.position, 2, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
      gl.enableVertexAttribArray(shader.locations.uv);
      gl.vertexAttribPointer(shader.locations.uv, 2, gl.FLOAT, false, 0, 0);

      gl.uniform2f(shader.uniforms.u_resolution, width, height);
      gl.uniform1f(shader.uniforms.u_time, options?.time ?? 0);
      gl.uniform1f(shader.uniforms.u_beat, options?.beat ?? 0);
      gl.uniform4fv(shader.uniforms.u_params, options?.params ?? DEFAULT_PARAMS);
      gl.uniform1i(shader.uniforms.u_palette, paletteId(options?.paletteFile));
      gl.uniform1i(shader.uniforms.u_manualEnabled, options?.manualPalette?.enabled ? 1 : 0);
      gl.uniform1i(shader.uniforms.u_manualCount, options?.manualPalette?.count ?? 0);
      gl.uniform3fv(shader.uniforms.u_manualColors, options?.manualPalette?.colors ?? EMPTY_MANUAL_COLORS);
      gl.uniform2f(shader.uniforms.u_mirror, options?.mirrorX ? 1 : 0, options?.mirrorY ? 1 : 0);
      gl.uniform1f(shader.uniforms.u_flip, options?.flip ? 1 : 0);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
      return true;
    }
  };
}

function layerShaderForGpu(gl, cache, gpu) {
  const key = `${gpu.functionName}::${hashString(gpu.code || "")}`;
  return getCachedShader(gl, `layer:${key}`, () => {
    const program = createProgram(gl, `
    attribute vec2 a_position;
    attribute vec2 a_uv;
    varying vec2 v_uv;

    void main() {
      gl_Position = vec4(a_position, 0.0, 1.0);
      v_uv = a_uv;
    }
  `, `
    precision highp float;
    varying vec2 v_uv;

    uniform vec2 u_resolution;
    uniform float u_time;
    uniform float u_beat;
    uniform vec4 u_params;
    uniform int u_palette;
    uniform int u_manualEnabled;
    uniform int u_manualCount;
    uniform vec3 u_manualColors[3];
    uniform vec2 u_mirror;
    uniform float u_flip;

    ${shaderHelpers()}
    ${gpu.code}

    void main() {
      vec2 uv = layerUv(v_uv, u_mirror, u_flip);
      float value = clamp(${gpu.functionName}(uv, u_time, u_params), 0.0, 1.0);
      gl_FragColor = vec4(resolvePaletteColor(u_palette, u_manualEnabled, u_manualCount, u_manualColors, value), 1.0);
    }
  `);
    if (!program) return null;

    return {
      program,
      locations: {
        position: gl.getAttribLocation(program, "a_position"),
        uv: gl.getAttribLocation(program, "a_uv")
      },
      uniforms: {
        u_resolution: gl.getUniformLocation(program, "u_resolution"),
        u_time: gl.getUniformLocation(program, "u_time"),
        u_beat: gl.getUniformLocation(program, "u_beat"),
        u_params: gl.getUniformLocation(program, "u_params"),
        u_palette: gl.getUniformLocation(program, "u_palette"),
        u_manualEnabled: gl.getUniformLocation(program, "u_manualEnabled"),
        u_manualCount: gl.getUniformLocation(program, "u_manualCount"),
        u_manualColors: gl.getUniformLocation(program, "u_manualColors[0]"),
        u_mirror: gl.getUniformLocation(program, "u_mirror"),
        u_flip: gl.getUniformLocation(program, "u_flip")
      }
    };
  }, { localCache: cache });
}

function buildLedUvs(matrixWidth, matrixHeight) {
  const uvs = new Float32Array(matrixWidth * matrixHeight * 6 * 2);
  let offset = 0;

  for (let y = 0; y < matrixHeight; y += 1) {
    for (let x = 0; x < matrixWidth; x += 1) {
      const u = matrixWidth <= 1 ? 0 : x / (matrixWidth - 1);
      const v = matrixHeight <= 1 ? 0 : y / (matrixHeight - 1);
      for (let i = 0; i < 6; i += 1) {
        uvs[offset++] = u;
        uvs[offset++] = v;
      }
    }
  }

  return uvs;
}

const GPU_LIBRARY = buildGpuLibrary();

function buildGpuLibrary() {
  const catalog = gpuCatalog() || {};
  const idByName = new Map();
  const entries = [];
  let nextId = 1;

  for (const gpu of Object.values(catalog)) {
    const name = gpu?.functionName;
    const code = gpu?.code;
    if (!name || !code || idByName.has(name)) continue;
    const id = nextId++;
    idByName.set(name, id);
    entries.push({ id, name, code });
  }

  return {
    idByName,
    entries
  };
}

function sceneAnimId(gpu) {
  return GPU_LIBRARY.idByName.get(gpu?.functionName) || 0;
}

function sceneAnimBank(gpu) {
  const id = sceneAnimId(gpu);
  return id > 0 ? Math.floor((id - 1) / SCENE_SHADER_BANK_SIZE) : -1;
}

export function gpuSceneBankId(gpu) {
  return sceneAnimBank(gpu);
}

function shaderForScene(gl, cache, scene, compileIfMissing = true) {
  const key = sceneShaderKey(scene);
  return getCachedShader(gl, `scene:${key}`, () => {
    const vertexSource = `
    attribute vec2 a_position;
    attribute vec2 a_uv;
    varying vec2 v_uv;

    void main() {
      gl_Position = vec4(a_position, 0.0, 1.0);
      v_uv = a_uv;
    }
  `;

    const fragmentSource = buildSceneFragmentSource(scene);
    const program = createProgram(gl, vertexSource, fragmentSource);
    if (!program) return null;

    return {
      program,
      locations: {
        position: gl.getAttribLocation(program, "a_position"),
        uv: gl.getAttribLocation(program, "a_uv")
      },
      uniforms: collectSceneUniforms(gl, program)
    };
  }, { compileIfMissing, localCache: cache });
}

function sceneShaderKey(scene) {
  return [
    "scene-bank",
    sceneAnimBank(scene?.layers?.[0]?.gpu),
    sceneAnimBank(scene?.layers?.[1]?.gpu),
    sceneAnimBank(scene?.layers?.[0]?.transition?.gpu),
    sceneAnimBank(scene?.layers?.[1]?.transition?.gpu)
  ].join("|");
}

function buildSceneGpuLibrary(scene) {
  const banks = new Set([
    sceneAnimBank(scene?.layers?.[0]?.gpu),
    sceneAnimBank(scene?.layers?.[1]?.gpu),
    sceneAnimBank(scene?.layers?.[0]?.transition?.gpu),
    sceneAnimBank(scene?.layers?.[1]?.transition?.gpu)
  ]);
  banks.delete(-1);

  const entries = GPU_LIBRARY.entries.filter((entry) => banks.has(Math.floor((entry.id - 1) / SCENE_SHADER_BANK_SIZE)));
  const selectorLines = ["float evalGpuAnim(int animId, vec2 uv, float t, vec4 p) {"];
  for (const entry of entries) {
    selectorLines.push(`  if (animId == ${entry.id}) return ${entry.name}(uv, t, p);`);
  }
  selectorLines.push("  return 0.0;");
  selectorLines.push("}");

  return {
    code: entries.map((entry) => entry.code).join("\n"),
    selector: selectorLines.join("\n")
  };
}

function buildSceneFragmentSource(scene) {
  const library = buildSceneGpuLibrary(scene);
  return `
    precision highp float;
    varying vec2 v_uv;

    uniform vec2 u_matrix;
    uniform float u_time;
    uniform float u_beat;
    uniform float u_cross;
    uniform float u_master;
    uniform float u_gamma;
    uniform float u_brightnessLimit;
    uniform int u_blendMode;
    uniform int u_previousBlendMode;
    uniform float u_blendTransition;

    uniform vec4 u_l1Params;
    uniform vec4 u_l2Params;
    uniform float u_l1Time;
    uniform float u_l2Time;
    uniform float u_l1Master;
    uniform float u_l2Master;
    uniform float u_l1Visibility;
    uniform float u_l2Visibility;
    uniform float u_l1Mix;
    uniform float u_l2Mix;
    uniform int u_l1Palette;
    uniform int u_l2Palette;
    uniform int u_l1ManualEnabled;
    uniform int u_l2ManualEnabled;
    uniform int u_l1ManualCount;
    uniform int u_l2ManualCount;
    uniform vec3 u_l1ManualColors[3];
    uniform vec3 u_l2ManualColors[3];
    uniform vec2 u_l1Mirror;
    uniform vec2 u_l2Mirror;
    uniform float u_l1Flip;
    uniform float u_l2Flip;
    uniform int u_l1AnimId;
    uniform int u_l2AnimId;
    uniform vec4 u_l1PrevParams;
    uniform vec4 u_l2PrevParams;
    uniform float u_l1PrevTime;
    uniform float u_l2PrevTime;
    uniform int u_l1PrevAnimId;
    uniform int u_l2PrevAnimId;
    uniform int u_l1PrevPalette;
    uniform int u_l2PrevPalette;
    uniform int u_l1PrevManualEnabled;
    uniform int u_l2PrevManualEnabled;
    uniform int u_l1PrevManualCount;
    uniform int u_l2PrevManualCount;
    uniform vec3 u_l1PrevManualColors[3];
    uniform vec3 u_l2PrevManualColors[3];
    uniform vec2 u_l1PrevMirror;
    uniform vec2 u_l2PrevMirror;
    uniform float u_l1PrevFlip;
    uniform float u_l2PrevFlip;
    uniform float u_l1Transition;
    uniform float u_l2Transition;

    uniform int u_fx1Mode;
    uniform int u_fx2Mode;
    uniform int u_fxMasterMode;
    uniform float u_fx1Amount;
    uniform float u_fx2Amount;
    uniform float u_fxMasterAmount;
    uniform float u_fx1Rate;
    uniform float u_fx2Rate;
    uniform float u_fxMasterRate;

    ${shaderHelpers()}
    ${library.code}
    ${library.selector}

    void main() {
      vec2 cell = floor(v_uv * max(vec2(1.0), u_matrix - 1.0) + 0.5);
      vec2 uv1 = layerUv(v_uv, u_l1Mirror, u_l1Flip);
      vec2 uv2 = layerUv(v_uv, u_l2Mirror, u_l2Flip);
      vec2 uv1Prev = layerUv(v_uv, u_l1PrevMirror, u_l1PrevFlip);
      vec2 uv2Prev = layerUv(v_uv, u_l2PrevMirror, u_l2PrevFlip);

      float l1Value = clamp(evalGpuAnim(u_l1AnimId, uv1, u_l1Time, u_l1Params), 0.0, 1.0);
      float l2Value = clamp(evalGpuAnim(u_l2AnimId, uv2, u_l2Time, u_l2Params), 0.0, 1.0);
      float l1PrevValue = clamp(evalGpuAnim(u_l1PrevAnimId, uv1Prev, u_l1PrevTime, u_l1PrevParams), 0.0, 1.0);
      float l2PrevValue = clamp(evalGpuAnim(u_l2PrevAnimId, uv2Prev, u_l2PrevTime, u_l2PrevParams), 0.0, 1.0);
      float l1Mix = u_l1Visibility * u_l1Mix * u_l1Master;
      float l2Mix = u_l2Visibility * u_l2Mix * u_l2Master;

      vec3 l1Raw = mix(
        resolvePaletteColor(u_l1PrevPalette, u_l1PrevManualEnabled, u_l1PrevManualCount, u_l1PrevManualColors, l1PrevValue),
        resolvePaletteColor(u_l1Palette, u_l1ManualEnabled, u_l1ManualCount, u_l1ManualColors, l1Value),
        u_l1Transition
      );
      vec3 l2Raw = mix(
        resolvePaletteColor(u_l2PrevPalette, u_l2PrevManualEnabled, u_l2PrevManualCount, u_l2PrevManualColors, l2PrevValue),
        resolvePaletteColor(u_l2Palette, u_l2ManualEnabled, u_l2ManualCount, u_l2ManualColors, l2Value),
        u_l2Transition
      );
      vec3 l1Color = applyFx(l1Raw * l1Mix, u_fx1Mode, u_fx1Amount, u_fx1Rate, cell, 0.0);
      vec3 l2Color = applyFx(l2Raw * l2Mix, u_fx2Mode, u_fx2Amount, u_fx2Rate, cell, 1.0);
      vec3 blended = mix(
        u_previousBlendMode == 0 ? saturatingAdd(l1Color, l2Color) : blendColors(l1Color, l2Color, u_previousBlendMode),
        u_blendMode == 0 ? saturatingAdd(l1Color, l2Color) : blendColors(l1Color, l2Color, u_blendMode),
        u_blendTransition
      );
      vec3 color = applyFx(blended, u_fxMasterMode, u_fxMasterAmount, u_fxMasterRate, cell, 2.0);
      color = pow(clamp(color * u_master * u_brightnessLimit, 0.0, 1.0), vec3(u_gamma));
      gl_FragColor = vec4(color, 1.0);
    }
  `;
}

function shaderHelpers() {
  return `
    const float PI = 3.141592653589793;
    const float TAU = 6.283185307179586;

    vec2 layerUv(vec2 uv, vec2 mirror, float flip) {
      vec2 nextUv = uv;
      if (mirror.x > 0.5) nextUv.x = nextUv.x < 0.5 ? nextUv.x * 2.0 : (1.0 - nextUv.x) * 2.0;
      if (mirror.y > 0.5) nextUv.y = nextUv.y < 0.5 ? nextUv.y * 2.0 : (1.0 - nextUv.y) * 2.0;
      if (flip > 0.5) nextUv = vec2(1.0 - nextUv.x, 1.0 - nextUv.y);
      return nextUv;
    }

    float hash21(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    float noise2(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
        mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
        u.y
      );
    }

    float fbm(vec2 p) {
      float v = 0.0;
      float a = 0.5;
      for (int i = 0; i < 5; i++) {
        v += noise2(p) * a;
        p = mat2(1.6, 1.2, -1.2, 1.6) * p;
        a *= 0.5;
      }
      return v;
    }

    vec3 sinePalette(float v, float freq, vec3 phase) {
      return sin(vec3(v * TAU * freq) + phase) * 0.498 + 0.502;
    }

    vec3 stopMix(float v, vec4 a, vec4 b) {
      float t = clamp((v - a.x) / max(0.0001, b.x - a.x), 0.0, 1.0);
      vec3 color = mix(a.yzw, b.yzw, t);
      float high = max(max(color.r, color.g), color.b);
      return color / (high <= 1.0 ? 1.0 : 255.0);
    }

    vec3 stops3(float v, vec4 a, vec4 b, vec4 c) {
      if (v <= b.x) return stopMix(v, a, b);
      return stopMix(v, b, c);
    }

    vec3 stops4(float v, vec4 a, vec4 b, vec4 c, vec4 d) {
      if (v <= b.x) return stopMix(v, a, b);
      if (v <= c.x) return stopMix(v, b, c);
      return stopMix(v, c, d);
    }

    vec3 paletteColor(int id, float v) {
      v = clamp(v, 0.0, 1.0);
      if (id == 1) return stops4(v, vec4(0.0, 0.047, 0.078, 0.235), vec4(0.35, 0.0, 0.706, 0.549), vec4(0.7, 0.471, 0.314, 1.0), vec4(1.0, 0.941, 1.0, 0.824));
      if (id == 2) return sinePalette(v, 1.5, vec3(0.0, 2.1, 4.2));
      if (id == 3) return stops3(v, vec4(0.0, 0.0, 0.031, 0.11), vec4(0.45, 0.0, 0.275, 0.588), vec4(1.0, 0.314, 0.863, 1.0));
      if (id == 4) return vec3(1.0, v * v * 0.706, v * v * v * 0.235);
      if (id == 5) return stops4(v, vec4(0.0, 0.078, 0.0, 0.0), vec4(0.35, 0.824, 0.118, 0.0), vec4(0.75, 1.0, 0.627, 0.078), vec4(1.0, 1.0, 0.961, 0.706));
      if (id == 6) return stops4(v, vec4(0.0, 0.0, 0.0, 0.0), vec4(0.35, 0.588, 0.0, 0.0), vec4(0.7, 1.0, 0.275, 0.0), vec4(1.0, 1.0, 0.863, 0.275));
      if (id == 7) return vec3(pow(v, 0.5), v * v * 0.627, pow(v, 4.0));
      if (id == 8) return sinePalette(v, 1.0, vec3(0.0, 2.0, 4.0));
      if (id == 9) return vec3(v * 0.706 + 0.118, 0.902 + v * 0.098, 1.0);
      if (id == 10) return vec3(0.784 * v, 0.196 * v, v);
      if (id == 11) return sinePalette(v, 1.0, vec3(0.0, 2.09, 4.18));
      if (id == 12) return stops3(v, vec4(0.0, 0.216, 0.0, 0.471), vec4(0.45, 1.0, 0.314, 0.0), vec4(1.0, 1.0, 0.961, 0.353));
      if (id == 13) return stops3(v, vec4(0.0, 0.0, 0.078, 0.0), vec4(0.45, 0.314, 1.0, 0.0), vec4(1.0, 0.863, 1.0, 0.314));
      if (id == 14) return stops3(v, vec4(0.0, 0.0, 0.078, 0.314), vec4(0.5, 0.157, 0.863, 1.0), vec4(1.0, 0.961, 1.0, 1.0));
      if (id == 15) return stops3(v, vec4(0.0, 1.0, 0.0, 0.235), vec4(0.5, 0.0, 1.0, 0.314), vec4(1.0, 0.157, 0.314, 1.0));
      if (id == 16) return stops3(v, vec4(0.0, 0.176, 0.0, 0.314), vec4(0.5, 0.627, 0.235, 1.0), vec4(1.0, 1.0, 0.824, 0.314));
      if (id == 17) return stops4(v, vec4(0.0, 0.0, 0.063, 0.275), vec4(0.35, 0.118, 0.745, 1.0), vec4(0.7, 1.0, 0.471, 0.471), vec4(1.0, 1.0, 0.961, 0.706));
      if (id == 18) return stops4(v, vec4(0.0, 0.02, 0.0, 0.071), vec4(0.35, 0.275, 0.0, 1.0), vec4(0.68, 1.0, 0.0, 0.824), vec4(1.0, 0.706, 1.0, 0.157));
      if (id == 19) return stops4(v, vec4(0.0, 0.047, 0.165, 0.188), vec4(0.42, 0.0, 0.706, 0.667), vec4(0.72, 0.902, 0.627, 0.216), vec4(1.0, 1.0, 0.922, 0.588));
      if (id == 20) return stops4(v, vec4(0.0, 0.157, 0.0, 0.071), vec4(0.4, 0.863, 0.078, 0.275), vec4(0.74, 0.118, 1.0, 0.745), vec4(1.0, 0.961, 1.0, 0.922));
      if (id == 21) return stops4(v, vec4(0.0, 0.0, 0.059, 0.353), vec4(0.45, 0.078, 0.353, 1.0), vec4(0.74, 1.0, 0.686, 0.078), vec4(1.0, 1.0, 0.961, 0.667));
      if (id == 22) return stops4(v, vec4(0.0, 0.0, 0.157, 0.353), vec4(0.36, 0.0, 0.824, 0.745), vec4(0.66, 1.0, 0.353, 0.373), vec4(1.0, 1.0, 0.824, 0.471));
      if (id == 23) return stops4(v, vec4(0.0, 0.0, 0.039, 0.078), vec4(0.38, 0.0, 1.0, 0.333), vec4(0.68, 0.078, 0.863, 1.0), vec4(1.0, 0.961, 1.0, 0.157));
      if (id == 24) return stops4(v, vec4(0.0, 0.086, 0.047, 0.11), vec4(0.42, 0.529, 0.275, 0.412), vec4(0.72, 0.922, 0.51, 0.51), vec4(1.0, 1.0, 0.863, 0.745));
      if (id == 25) return stops4(v, vec4(0.0, 0.0, 0.071, 0.031), vec4(0.38, 0.0, 0.745, 0.392), vec4(0.7, 0.824, 0.0, 0.275), vec4(1.0, 1.0, 0.725, 0.471));
      if (id == 26) return stops4(v, vec4(0.0, 0.016, 0.031, 0.094), vec4(0.45, 0.188, 0.282, 0.51), vec4(0.74, 0.588, 0.725, 1.0), vec4(1.0, 0.941, 0.973, 1.0));
      if (id == 27) return stops3(v, vec4(0.0, 0.078, 0.0, 0.314), vec4(0.45, 1.0, 0.0, 0.706), vec4(1.0, 0.0, 0.941, 1.0));
      if (id == 28) return stops4(v, vec4(0.0, 0.137, 0.047, 0.024), vec4(0.35, 0.824, 0.431, 0.157), vec4(0.7, 1.0, 0.745, 0.471), vec4(1.0, 0.471, 0.725, 1.0));
      if (id == 29) return stops4(v, vec4(0.0, 0.024, 0.055, 0.141), vec4(0.32, 0.0, 0.627, 1.0), vec4(0.6, 1.0, 0.471, 0.157), vec4(1.0, 1.0, 0.961, 0.863));
      if (id == 30) return stops4(v, vec4(0.0, 0.0, 0.078, 0.039), vec4(0.4, 0.0, 0.863, 0.549), vec4(0.72, 1.0, 0.431, 0.353), vec4(1.0, 1.0, 0.922, 0.706));
      if (id == 31) return stops4(v, vec4(0.0, 0.0, 0.059, 0.141), vec4(0.35, 0.0, 0.549, 0.745), vec4(0.7, 0.0, 0.941, 0.667), vec4(1.0, 0.745, 1.0, 0.863));
      if (id == 32) return stops4(v, vec4(0.0, 0.0, 0.031, 0.071), vec4(0.4, 0.047, 0.275, 0.549), vec4(0.75, 0.314, 0.627, 0.863), vec4(1.0, 0.824, 0.941, 1.0));
      if (id == 33) return stops4(v, vec4(0.0, 0.031, 0.0, 0.125), vec4(0.34, 1.0, 0.0, 0.549), vec4(0.66, 0.0, 1.0, 0.667), vec4(1.0, 1.0, 0.961, 0.314));
      if (id == 34) return stops4(v, vec4(0.0, 0.11, 0.039, 0.063), vec4(0.42, 0.706, 0.353, 0.471), vec4(0.74, 1.0, 0.706, 0.627), vec4(1.0, 1.0, 0.922, 0.804));
      if (id == 35) return stops4(v, vec4(0.0, 0.118, 0.0, 0.0), vec4(0.34, 1.0, 0.235, 0.0), vec4(0.68, 1.0, 0.824, 0.157), vec4(1.0, 1.0, 0.98, 0.745));
      if (id == 36) return stops4(v, vec4(0.0, 0.047, 0.0, 0.11), vec4(0.38, 0.353, 0.0, 0.824), vec4(0.7, 0.863, 0.0, 1.0), vec4(1.0, 1.0, 0.745, 1.0));
      if (id == 37) return stops4(v, vec4(0.0, 0.016, 0.031, 0.078), vec4(0.3, 0.0, 1.0, 1.0), vec4(0.62, 0.353, 0.118, 1.0), vec4(1.0, 0.961, 1.0, 1.0));
      return sinePalette(v, 1.0, vec3(0.0, 2.0, 4.0));
    }

    vec3 saturatingAdd(vec3 a, vec3 b) {
      return min(a + b, vec3(1.0));
    }

    vec3 manualPaletteColor(int count, vec3 colors[3], float v) {
      if (count <= 1) return colors[0];
      if (count == 2) return mix(colors[0], colors[1], clamp(v, 0.0, 1.0));
      float position = clamp(v, 0.0, 1.0) * 2.0;
      if (position < 1.0) return mix(colors[0], colors[1], position);
      return mix(colors[1], colors[2], position - 1.0);
    }

    vec3 resolvePaletteColor(int palette, int manualEnabled, int manualCount, vec3 manualColors[3], float v) {
      if (manualEnabled == 1) return manualPaletteColor(manualCount, manualColors, v);
      return paletteColor(palette, v);
    }

    vec3 blendColors(vec3 a, vec3 b, int mode) {
      if (mode == 1) return 1.0 - (1.0 - a) * (1.0 - b);
      if (mode == 2) return a * b;
      if (mode == 3) return (a + b) * 0.5;
      if (mode == 4) return max(a, b);
      if (mode == 5) return abs(a - b);
      if (mode == 6) return mix(2.0 * a * b, 1.0 - 2.0 * (1.0 - a) * (1.0 - b), step(0.5, a));
      if (mode == 7) return min(a, b);
      if (mode == 8) return max(vec3(0.0), a - b);
      if (mode == 9) {
        float luma = dot(b, vec3(0.2126, 0.7152, 0.0722));
        return mix(a, b, luma);
      }
      if (mode == 10) return floor(u_beat * 4.0) - floor(floor(u_beat * 4.0) / 2.0) * 2.0 < 1.0 ? a : b;
      if (mode == 11) return floor(u_beat) - floor(floor(u_beat) / 2.0) * 2.0 < 1.0 ? a : b;
      if (mode == 12) return min(vec3(1.0), a + b * 0.7);
      if (mode == 13) {
        return mix(a - (1.0 - 2.0 * b) * a * (1.0 - a), a + (2.0 * b - 1.0) * (sqrt(max(a, 0.0)) - a), step(0.5, b));
      }
      if (mode == 14) return min(vec3(1.0), a / max(vec3(0.001), 1.0 - b));
      return min(a + b, vec3(1.0));
    }

    vec3 applyFx(vec3 color, int mode, float rawAmount, float rate, vec2 cell, float phaseOffset) {
      if (mode == 0 || rawAmount <= 0.0) return color;
      float speed = 0.5 + rate * 3.0;
      float amount = clamp(rawAmount * 1.35, 0.0, 1.0);
      float factor = 1.0;
      if (mode == 1) factor = 1.0 - amount * 0.55 + max(0.0, sin(u_beat * speed + phaseOffset)) * amount * 0.75;
      else if (mode == 2) factor = sin(u_beat * speed * 4.0) > 0.2 ? 1.0 : 1.0 - amount;
      else if (mode == 3) factor = 1.0 - amount * 0.35 + max(0.0, sin((cell.x * 12.9898 + cell.y * 78.233 + u_beat * speed * 8.0) * 0.35)) * amount * 0.55;
      else if (mode == 4) factor = sin(cell.x * 39.17 + cell.y * 17.41 + floor(u_beat * speed * 12.0) * 3.91) > 0.72 ? 1.0 + amount * 1.8 : 1.0 - amount * 0.18;
      else if (mode == 5) factor = floor(u_beat * speed * 2.0 + phaseOffset) - floor(floor(u_beat * speed * 2.0 + phaseOffset) / 2.0) * 2.0 < 1.0 ? 1.0 : 1.0 - amount;
      else if (mode == 6) factor = 1.0 - amount * 0.35 + (sin(cell.x * 0.55 + cell.y * 0.3 - u_beat * speed * 2.0) * 0.5 + 0.5) * amount * 0.85;
      else if (mode == 7) return floor(color * (16.0 - amount * 13.0)) / max(2.0, 16.0 - amount * 13.0);
      else if (mode == 8) return mix(color, 1.0 - color, amount);
      else if (mode == 9) factor = floor(u_beat * speed * 6.0 + phaseOffset) - floor(floor(u_beat * speed * 6.0 + phaseOffset) / 3.0) * 3.0 < 1.0 ? 1.0 : 1.0 - amount;
      else if (mode == 10) factor = floor(u_beat * speed + phaseOffset) - floor(floor(u_beat * speed + phaseOffset) / 2.0) * 2.0 < 1.0 ? 1.0 : 1.0 - amount;
      else if (mode == 11) return mix(color, color.brg, amount * 0.8);
      return color * factor;
    }
  `;
}

function collectSceneUniforms(gl, program) {
  const names = [
    "u_matrix", "u_time", "u_beat", "u_cross", "u_master", "u_gamma", "u_brightnessLimit", "u_blendMode",
    "u_previousBlendMode", "u_blendTransition",
    "u_l1Params", "u_l2Params", "u_l1Time", "u_l2Time", "u_l1Master", "u_l2Master", "u_l1Visibility", "u_l2Visibility",
    "u_l1Mix", "u_l2Mix", "u_l1Palette", "u_l2Palette", "u_l1Mirror", "u_l2Mirror", "u_l1Flip", "u_l2Flip", "u_fx1Mode", "u_fx2Mode", "u_fxMasterMode",
    "u_l1AnimId", "u_l2AnimId", "u_l1PrevAnimId", "u_l2PrevAnimId",
    "u_l1ManualEnabled", "u_l2ManualEnabled", "u_l1ManualCount", "u_l2ManualCount", "u_l1ManualColors", "u_l2ManualColors",
    "u_l1PrevParams", "u_l2PrevParams", "u_l1PrevTime", "u_l2PrevTime", "u_l1PrevPalette", "u_l2PrevPalette",
    "u_l1PrevManualEnabled", "u_l2PrevManualEnabled", "u_l1PrevManualCount", "u_l2PrevManualCount", "u_l1PrevManualColors", "u_l2PrevManualColors",
    "u_l1PrevMirror", "u_l2PrevMirror", "u_l1PrevFlip", "u_l2PrevFlip", "u_l1Transition", "u_l2Transition",
    "u_fx1Amount", "u_fx2Amount", "u_fxMasterAmount", "u_fx1Rate", "u_fx2Rate", "u_fxMasterRate"
  ];
  return Object.fromEntries(names.map((name) => [name, gl.getUniformLocation(program, name)]));
}

function setUniforms(gl, uniforms, scene) {
  const l1 = scene.layers[0];
  const l2 = scene.layers[1];
  const l1Previous = l1.transition || l1;
  const l2Previous = l2.transition || l2;
  const blendTransition = scene.blendTransition || null;
  gl.uniform2f(uniforms.u_matrix, scene.width, scene.height);
  gl.uniform1f(uniforms.u_time, scene.time);
  gl.uniform1f(uniforms.u_beat, scene.beat);
  gl.uniform1f(uniforms.u_cross, scene.cross);
  gl.uniform1f(uniforms.u_master, scene.master);
  gl.uniform1f(uniforms.u_gamma, scene.gamma);
  gl.uniform1f(uniforms.u_brightnessLimit, scene.brightnessLimit);
  gl.uniform1i(uniforms.u_blendMode, blendModeId(scene.blendMode));
  gl.uniform1i(uniforms.u_previousBlendMode, blendModeId(blendTransition?.mode || scene.blendMode));
  gl.uniform1f(uniforms.u_blendTransition, blendTransition?.progress ?? 1);
  gl.uniform4fv(uniforms.u_l1Params, l1.params);
  gl.uniform4fv(uniforms.u_l2Params, l2.params);
  gl.uniform1f(uniforms.u_l1Time, l1.time);
  gl.uniform1f(uniforms.u_l2Time, l2.time);
  gl.uniform1f(uniforms.u_l1Master, l1.master);
  gl.uniform1f(uniforms.u_l2Master, l2.master);
  gl.uniform1f(uniforms.u_l1Visibility, l1.visibility);
  gl.uniform1f(uniforms.u_l2Visibility, l2.visibility);
  gl.uniform1f(uniforms.u_l1Mix, l1.mix);
  gl.uniform1f(uniforms.u_l2Mix, l2.mix);
  gl.uniform1i(uniforms.u_l1Palette, paletteId(l1.paletteFile));
  gl.uniform1i(uniforms.u_l2Palette, paletteId(l2.paletteFile));
  gl.uniform1i(uniforms.u_l1ManualEnabled, l1.manualPalette?.enabled ? 1 : 0);
  gl.uniform1i(uniforms.u_l2ManualEnabled, l2.manualPalette?.enabled ? 1 : 0);
  gl.uniform1i(uniforms.u_l1ManualCount, l1.manualPalette?.count ?? 0);
  gl.uniform1i(uniforms.u_l2ManualCount, l2.manualPalette?.count ?? 0);
  gl.uniform3fv(uniforms.u_l1ManualColors, l1.manualPalette?.colors ?? EMPTY_MANUAL_COLORS);
  gl.uniform3fv(uniforms.u_l2ManualColors, l2.manualPalette?.colors ?? EMPTY_MANUAL_COLORS);
  gl.uniform2f(uniforms.u_l1Mirror, l1.mirrorX ? 1 : 0, l1.mirrorY ? 1 : 0);
  gl.uniform2f(uniforms.u_l2Mirror, l2.mirrorX ? 1 : 0, l2.mirrorY ? 1 : 0);
  gl.uniform1f(uniforms.u_l1Flip, l1.flip ? 1 : 0);
  gl.uniform1f(uniforms.u_l2Flip, l2.flip ? 1 : 0);
  gl.uniform1i(uniforms.u_l1AnimId, sceneAnimId(l1.gpu));
  gl.uniform1i(uniforms.u_l2AnimId, sceneAnimId(l2.gpu));
  gl.uniform4fv(uniforms.u_l1PrevParams, l1Previous.params);
  gl.uniform4fv(uniforms.u_l2PrevParams, l2Previous.params);
  gl.uniform1f(uniforms.u_l1PrevTime, l1Previous.time);
  gl.uniform1f(uniforms.u_l2PrevTime, l2Previous.time);
  gl.uniform1i(uniforms.u_l1PrevAnimId, sceneAnimId(l1Previous.gpu));
  gl.uniform1i(uniforms.u_l2PrevAnimId, sceneAnimId(l2Previous.gpu));
  gl.uniform1i(uniforms.u_l1PrevPalette, paletteId(l1Previous.paletteFile));
  gl.uniform1i(uniforms.u_l2PrevPalette, paletteId(l2Previous.paletteFile));
  gl.uniform1i(uniforms.u_l1PrevManualEnabled, l1Previous.manualPalette?.enabled ? 1 : 0);
  gl.uniform1i(uniforms.u_l2PrevManualEnabled, l2Previous.manualPalette?.enabled ? 1 : 0);
  gl.uniform1i(uniforms.u_l1PrevManualCount, l1Previous.manualPalette?.count ?? 0);
  gl.uniform1i(uniforms.u_l2PrevManualCount, l2Previous.manualPalette?.count ?? 0);
  gl.uniform3fv(uniforms.u_l1PrevManualColors, l1Previous.manualPalette?.colors ?? EMPTY_MANUAL_COLORS);
  gl.uniform3fv(uniforms.u_l2PrevManualColors, l2Previous.manualPalette?.colors ?? EMPTY_MANUAL_COLORS);
  gl.uniform2f(uniforms.u_l1PrevMirror, l1Previous.mirrorX ? 1 : 0, l1Previous.mirrorY ? 1 : 0);
  gl.uniform2f(uniforms.u_l2PrevMirror, l2Previous.mirrorX ? 1 : 0, l2Previous.mirrorY ? 1 : 0);
  gl.uniform1f(uniforms.u_l1PrevFlip, l1Previous.flip ? 1 : 0);
  gl.uniform1f(uniforms.u_l2PrevFlip, l2Previous.flip ? 1 : 0);
  gl.uniform1f(uniforms.u_l1Transition, l1.transition?.progress ?? 1);
  gl.uniform1f(uniforms.u_l2Transition, l2.transition?.progress ?? 1);
  setFxUniforms(gl, uniforms, "u_fx1", scene.fx1);
  setFxUniforms(gl, uniforms, "u_fx2", scene.fx2);
  setFxUniforms(gl, uniforms, "u_fxMaster", scene.fxMaster);
}

function setFxUniforms(gl, uniforms, prefix, fx) {
  gl.uniform1i(uniforms[`${prefix}Mode`], fxModeId(fx));
  gl.uniform1f(uniforms[`${prefix}Amount`], fx?.amount ?? 0);
  gl.uniform1f(uniforms[`${prefix}Rate`], fx?.rate ?? 0.5);
}

function paletteId(file) {
  const name = String(file || "").replace(/\.js$/i, "").toLowerCase();
  return {
    aurora: 1,
    candy: 2,
    deep_ocean: 3,
    ember: 4,
    fire: 5,
    lava: 6,
    magma: 7,
    neon: 8,
    neonlight: 9,
    purple_fire: 10,
    rainbow: 11,
    sunset: 12,
    toxic: 13,
    ice: 14,
    laser_rgb: 15,
    gold_violet: 16,
    arctic_sunrise: 17,
    blacklight: 18,
    brass_teal: 19,
    cherry_mint: 20,
    cobalt_gold: 21,
    coral_reef: 22,
    cyber_lime: 23,
    dusty_rose: 24,
    emerald_ruby: 25,
    moonlit: 26,
    synthvawe: 27,
    synthwave: 27,
    desert_sky: 28,
    ember_ice: 29,
    mint_heat: 30,
    ocean_glow: 31,
    polar_night: 32,
    retro_arcade: 33,
    rose_gold: 34,
    solar_flare: 35,
    ultraviolet: 36,
    voltage: 37
  }[name] ?? 0;
}

function blendModeId(mode) {
  return {
    screen: 1,
    multiply: 2,
    mix: 3,
    max: 4,
    difference: 5,
    overlay: 6,
    darken: 7,
    subtract: 8,
    lumaMask: 9,
    strobeGate: 10,
    beatCut: 11,
    glitchMix: 12,
    softlight: 13,
    colorDodge: 14
  }[mode] ?? 0;
}

function fxModeId(fx) {
  if (!fx?.flash || fx.mode === "none" || fx.amount <= 0) return 0;
  return {
    pulse: 1,
    strobe: 2,
    shimmer: 3,
    spark: 4,
    gate: 5,
    wave: 6,
    crush: 7,
    invert: 8,
    strobeGate: 9,
    beatCut: 10,
    glitchMix: 11
  }[fx.mode] ?? 0;
}

function buildLedPositions(width, height, matrixWidth, matrixHeight, cellSize, options = {}) {
  const positions = new Float32Array(matrixWidth * matrixHeight * 6 * 2);
  let offset = 0;

  for (let y = 0; y < matrixHeight; y += 1) {
    const displayY = options.flipY ? matrixHeight - 1 - y : y;
    for (let x = 0; x < matrixWidth; x += 1) {
      const left = toClipX(x * cellSize + 1, width);
      const right = toClipX((x + 1) * cellSize - 1, width);
      const top = toClipY(displayY * cellSize + 1, height);
      const bottom = toClipY((displayY + 1) * cellSize - 1, height);

      offset = writeQuad(positions, offset, left, top, right, bottom);
    }
  }

  return positions;
}

function writeQuad(target, offset, left, top, right, bottom) {
  target[offset++] = left;
  target[offset++] = top;
  target[offset++] = right;
  target[offset++] = top;
  target[offset++] = left;
  target[offset++] = bottom;
  target[offset++] = left;
  target[offset++] = bottom;
  target[offset++] = right;
  target[offset++] = top;
  target[offset++] = right;
  target[offset++] = bottom;
  return offset;
}

function toClipX(value, width) {
  return (value / width) * 2 - 1;
}

function toClipY(value, height) {
  return 1 - (value / height) * 2;
}

function createProgram(gl, vertexSource, fragmentSource) {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  if (!vertexShader || !fragmentShader) return null;

  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn("Cannot link WebGL LED renderer", gl.getProgramInfoLog(program));
    return null;
  }

  return program;
}

function compileShader(gl, type, source) {
  const startedAt = performance.now();
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  const elapsed = Math.max(0, performance.now() - startedAt);
  shaderStats.compileCount += 1;
  shaderStats.totalCompileMs += elapsed;
  shaderStats.lastCompileMs = elapsed;
  shaderStats.lastCompileAt = performance.now();

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    shaderStats.compileFailures += 1;
    console.warn("Cannot compile WebGL LED shader", gl.getShaderInfoLog(shader));
    return null;
  }

  return shader;
}

function hashString(str) {
  let hash = 2166136261;
  for (let index = 0; index < str.length; index += 1) {
    hash ^= str.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}
