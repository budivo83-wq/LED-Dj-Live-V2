const DEFAULT_SHADER = `// Shadertoy kompatibilni draft
// Podporovano: mainImage, iResolution, iTime, iTimeDelta, iFrame, iMouse,
// iChannel0..3, iChannelResolution, iDate, iSampleRate.

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec2 p = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
  float t = iTime;
  float rings = sin(length(p) * 28.0 - t * 5.0);
  vec3 col = 0.5 + 0.5 * cos(t + uv.xyx * 6.283 + vec3(0.0, 2.0, 4.0));
  col *= 0.45 + 0.55 * rings;
  fragColor = vec4(col, 1.0);
}`;

const STORAGE_SOURCE = 'leddj.shadertoy.v3.source';
const STORAGE_NAME = 'leddj.shadertoy.v3.name';
const LEGACY_STORAGE_SOURCE = 'leddj.shadertoy.v2.source';
const LEGACY_STORAGE_NAME = 'leddj.shadertoy.v2.name';

const sourceInput = document.getElementById('shaderSourceInput');
const canvas = document.getElementById('shaderPreviewCanvas');
const statusMini = document.getElementById('shaderStatusMini');
const resolutionMini = document.getElementById('shaderResolutionMini');
const editorStatus = document.getElementById('shaderEditorStatus');
const previewStatus = document.getElementById('shaderPreviewStatus');
const draftStatus = document.getElementById('shaderDraftStatus');
const errorPanel = document.getElementById('shaderErrorPanel');
const compileState = document.getElementById('shaderCompileState');
const compileInfo = document.getElementById('shaderCompileInfo');
const mouseInfo = document.getElementById('shaderMouseInfo');
const speedInput = document.getElementById('shaderSpeedInput');
const zoomInput = document.getElementById('shaderZoomInput');
const qualityInput = document.getElementById('shaderQualityInput');
const nameInput = document.getElementById('shaderNameInput');
const importFile = document.getElementById('shaderImportFile');

let gl = null;
let glMode = 'webgl2';
let program = null;
let vertexBuffer = null;
let texturesReady = false;
let channelVariant = null;
let uniforms = {};
let raf = 0;
let startedAt = performance.now();
let lastDrawAt = startedAt;
let running = false;
let frame = 0;
let mouse = { x: 0, y: 0, down: 0, clickX: 0, clickY: 0 };
let fallbackTextures = { tex2D: [], cube: null };

// STEP37BU: Shadertoy is kept alive by the shell cache. Suspend GPU draw work
// while the iframe is not the active shell page; resume instantly on return.
const shaderShellView37BU = (() => {
  try { return new URLSearchParams(location.search || '').get('shellView') === '1' || (window.top && window.top !== window); }
  catch { return false; }
})();
let shaderShellActive37BU = !shaderShellView37BU;
let shaderInactiveWakeTimer37BU = 0;
const shaderFrameGate37BU = window.__budilightShaderFrameGate37BU = window.__budilightShaderFrameGate37BU || {
  version: '37BU',
  active: shaderShellActive37BU,
  skippedFrames: 0,
  lastActiveChangeAt: performance.now(),
  lastInactiveWakeAt: 0
};
function isShaderWorkActive37BU() {
  return !shaderShellView37BU || shaderShellActive37BU !== false;
}
function scheduleShaderInactiveWake37BU() {
  if (shaderInactiveWakeTimer37BU) return;
  shaderInactiveWakeTimer37BU = setTimeout(() => {
    shaderInactiveWakeTimer37BU = 0;
    shaderFrameGate37BU.lastInactiveWakeAt = performance.now();
    if (running && isShaderWorkActive37BU()) raf = requestAnimationFrame(draw);
    else if (running) scheduleShaderInactiveWake37BU();
  }, document.hidden ? 900 : 650);
}
try {
  window.addEventListener('message', (event) => {
    const data = event?.data;
    if (!data || data.type !== 'led-shell-view-active') return;
    const nextActive = data.active !== false;
    if (shaderShellActive37BU === nextActive) return;
    shaderShellActive37BU = nextActive;
    shaderFrameGate37BU.active = nextActive;
    shaderFrameGate37BU.lastActiveChangeAt = performance.now();
    document.documentElement?.classList?.toggle('shader-shell-inactive-37bu', !nextActive);
    document.body?.classList?.toggle('shader-shell-inactive-37bu', !nextActive);
    if (nextActive && running) {
      clearTimeout(shaderInactiveWakeTimer37BU);
      shaderInactiveWakeTimer37BU = 0;
      lastDrawAt = performance.now();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(draw);
    }
  });
} catch {}

if (sourceInput) sourceInput.value = localStorage.getItem(STORAGE_SOURCE) || localStorage.getItem(LEGACY_STORAGE_SOURCE) || DEFAULT_SHADER;
if (nameInput) nameInput.value = localStorage.getItem(STORAGE_NAME) || localStorage.getItem(LEGACY_STORAGE_NAME) || '';
syncStatus('IDLE', 'draft ready');
updateResolutionLabel();

function syncStatus(shortText, detailText) {
  if (statusMini) statusMini.textContent = shortText || 'IDLE';
  if (editorStatus) editorStatus.textContent = detailText || shortText || 'idle';
  if (draftStatus) draftStatus.textContent = detailText || shortText || 'local draft';
}

function setPreviewState(text) {
  if (previewStatus) previewStatus.textContent = text;
  if (compileState) compileState.textContent = text;
}

function showError(message) {
  if (!errorPanel) return;
  if (!message) {
    errorPanel.hidden = true;
    errorPanel.textContent = '';
    return;
  }
  errorPanel.hidden = false;
  errorPanel.textContent = String(message).slice(0, 6000);
}

function stripVersionAndPrecision(source) {
  return String(source || '')
    .replace(/^\s*#version\s+\d+\s+es\s*$/gm, '')
    .replace(/^\s*precision\s+(lowp|mediump|highp)\s+(float|int|sampler2D|samplerCube)\s*;\s*$/gm, '');
}

function hasMainImage(source) {
  return /void\s+mainImage\s*\(/.test(source || '');
}

function looksLikeCubeChannel(source, index) {
  const s = String(source || '');
  const channel = `iChannel${index}`;
  if (new RegExp(`texture(?:Lod)?\\s*\\(\\s*${channel}\\s*,\\s*(?:normalize\\s*\\()?(?:reflect|refract)`, 'm').test(s)) return true;
  if (new RegExp(`texture(?:Lod)?\\s*\\(\\s*${channel}\\s*,\\s*rd\\b`, 'm').test(s)) return true;
  if (new RegExp(`texture(?:Lod)?\\s*\\(\\s*${channel}\\s*,\\s*reflRay\\b`, 'm').test(s)) return true;
  if (new RegExp(`texture(?:Lod)?\\s*\\(\\s*${channel}\\s*,\\s*refrRay\\b`, 'm').test(s)) return true;
  return false;
}

function makeVariant(source, forcedCubeChannels = null) {
  const cube = [0, 1, 2, 3].map((i) => forcedCubeChannels ? forcedCubeChannels.includes(i) : looksLikeCubeChannel(source, i));
  return { cube, key: cube.map(Boolean).join('') };
}

function shaderHeaderWebGL2(variant) {
  const channelUniforms = [0, 1, 2, 3].map((i) => `uniform ${variant.cube[i] ? 'samplerCube' : 'sampler2D'} iChannel${i};`).join('\n');
  return `#version 300 es
precision highp float;
precision highp int;
uniform vec3 iResolution;
uniform float iTime;
uniform float iTimeDelta;
uniform int iFrame;
uniform vec4 iMouse;
uniform vec4 iDate;
uniform float iSampleRate;
uniform vec3 iChannelResolution[4];
${channelUniforms}
out vec4 leddjFragColor;
`;
}

function shaderFooterWebGL2(source) {
  if (hasMainImage(source)) {
    return `
void main() {
  vec4 color = vec4(0.0, 0.0, 0.0, 1.0);
  mainImage(color, gl_FragCoord.xy);
  leddjFragColor = color;
}`;
  }
  return `
void main() {
  leddjFragColor = vec4(0.0, 0.0, 0.0, 1.0);
}`;
}

function shaderFragmentWebGL2(userSource, variant) {
  const body = stripVersionAndPrecision(userSource);
  return `${shaderHeaderWebGL2(variant)}\n${body}\n${shaderFooterWebGL2(body)}`;
}

function shaderFragmentWebGL1(userSource) {
  let body = stripVersionAndPrecision(userSource)
    .replace(/\btexture\s*\(/g, 'texture2D(')
    .replace(/\btextureLod\s*\(([^,]+),([^,]+),[^\)]*\)/g, 'texture2D($1,$2)');
  return `precision highp float;
precision highp int;
uniform vec3 iResolution;
uniform float iTime;
uniform float iTimeDelta;
uniform int iFrame;
uniform vec4 iMouse;
uniform vec4 iDate;
uniform float iSampleRate;
uniform vec3 iChannelResolution[4];
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform sampler2D iChannel2;
uniform sampler2D iChannel3;
${body}
${hasMainImage(body) ? `void main(){ vec4 color = vec4(0.0,0.0,0.0,1.0); mainImage(color, gl_FragCoord.xy); gl_FragColor = color; }` : `void main(){ gl_FragColor = vec4(0.0,0.0,0.0,1.0); }`}`;
}

function vertexSource() {
  if (glMode === 'webgl2') return `#version 300 es
in vec2 p;
void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;
  return 'attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }';
}

function initGL() {
  if (!canvas) throw new Error('Preview canvas nenalezen.');
  if (gl) return;
  gl = canvas.getContext('webgl2', { alpha: false, antialias: true, preserveDrawingBuffer: false });
  glMode = gl ? 'webgl2' : 'webgl1';
  if (!gl) gl = canvas.getContext('webgl', { alpha: false, antialias: true, preserveDrawingBuffer: false });
  if (!gl) throw new Error('WebGL neni dostupny. Zkus Chrome/Edge s HW akceleraci.');
  if (glMode === 'webgl1') {
    gl.getExtension('OES_standard_derivatives');
    gl.getExtension('EXT_shader_texture_lod');
  }
  createFallbackTextures();
}

function createProgram() {
  initGL();
  const source = sourceInput?.value || '';
  const attempts = glMode === 'webgl2'
    ? [makeVariant(source), makeVariant(source, [0]), makeVariant(source, []), makeVariant(source, [0, 1, 2, 3])]
    : [null];
  let lastError = null;
  for (const variant of attempts) {
    try {
      const vert = compile(gl.VERTEX_SHADER, vertexSource());
      const fragSource = glMode === 'webgl2' ? shaderFragmentWebGL2(source, variant) : shaderFragmentWebGL1(source);
      const frag = compile(gl.FRAGMENT_SHADER, fragSource);
      const nextProgram = gl.createProgram();
      gl.attachShader(nextProgram, vert);
      gl.attachShader(nextProgram, frag);
      gl.linkProgram(nextProgram);
      gl.deleteShader(vert);
      gl.deleteShader(frag);
      if (!gl.getProgramParameter(nextProgram, gl.LINK_STATUS)) {
        const msg = gl.getProgramInfoLog(nextProgram) || 'Program link failed.';
        gl.deleteProgram(nextProgram);
        throw new Error(msg);
      }
      if (program) gl.deleteProgram(program);
      program = nextProgram;
      channelVariant = variant || makeVariant('', []);
      bindFullscreenBuffer();
      cacheUniforms();
      bindChannels();
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('Shader compile failed.');
}

function compile(type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader) || 'Shader compile failed.';
    gl.deleteShader(shader);
    throw new Error(cleanShaderLog(info));
  }
  return shader;
}

function cleanShaderLog(log) {
  return String(log || '')
    .replace(/ERROR:\s*0:(\d+)/g, 'GLSL line $1')
    .replace(/\u0000/g, '')
    .trim();
}

function bindFullscreenBuffer() {
  vertexBuffer = vertexBuffer || gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
  const pos = gl.getAttribLocation(program, 'p');
  if (pos >= 0) {
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
  }
}

function cacheUniforms() {
  uniforms = {
    iResolution: gl.getUniformLocation(program, 'iResolution'),
    iTime: gl.getUniformLocation(program, 'iTime'),
    iTimeDelta: gl.getUniformLocation(program, 'iTimeDelta'),
    iFrame: gl.getUniformLocation(program, 'iFrame'),
    iMouse: gl.getUniformLocation(program, 'iMouse'),
    iDate: gl.getUniformLocation(program, 'iDate'),
    iSampleRate: gl.getUniformLocation(program, 'iSampleRate'),
    iChannelResolution: gl.getUniformLocation(program, 'iChannelResolution'),
    iChannel: [0, 1, 2, 3].map((i) => gl.getUniformLocation(program, `iChannel${i}`))
  };
}

function createFallbackTextures() {
  if (texturesReady) return;
  fallbackTextures.tex2D = [0, 1, 2, 3].map((i) => createNoiseTexture2D(128, 128, i * 97 + 11));
  fallbackTextures.cube = createCubeTexture(64);
  texturesReady = true;
}

function seededNoise(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return (s & 255) / 255;
  };
}

function createNoiseTexture2D(w, h, seed) {
  const rnd = seededNoise(seed);
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const n = Math.floor(rnd() * 255);
      const fx = Math.floor((x / Math.max(1, w - 1)) * 255);
      const fy = Math.floor((y / Math.max(1, h - 1)) * 255);
      data[i + 0] = (n * 0.70 + fx * 0.30) & 255;
      data[i + 1] = (n * 0.65 + fy * 0.35) & 255;
      data[i + 2] = (n * 0.80 + ((fx + fy) >> 1) * 0.20) & 255;
      data[i + 3] = 255;
    }
  }
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  gl.generateMipmap(gl.TEXTURE_2D);
  return { tex, w, h, type: '2d' };
}

function createCubeTexture(size) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_CUBE_MAP, tex);
  const faces = [
    gl.TEXTURE_CUBE_MAP_POSITIVE_X, gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
    gl.TEXTURE_CUBE_MAP_POSITIVE_Y, gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
    gl.TEXTURE_CUBE_MAP_POSITIVE_Z, gl.TEXTURE_CUBE_MAP_NEGATIVE_Z
  ];
  faces.forEach((face, faceIndex) => {
    const data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        const u = x / Math.max(1, size - 1);
        const v = y / Math.max(1, size - 1);
        data[i + 0] = Math.floor(35 + 180 * Math.abs(Math.sin(u * Math.PI + faceIndex)));
        data[i + 1] = Math.floor(45 + 160 * Math.abs(Math.sin(v * Math.PI + faceIndex * 0.7)));
        data[i + 2] = Math.floor(80 + 145 * Math.abs(Math.sin((u + v) * Math.PI + faceIndex * 0.31)));
        data[i + 3] = 255;
      }
    }
    gl.texImage2D(face, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
  });
  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
  return { tex, w: size, h: size, type: 'cube' };
}

function bindChannels() {
  gl.useProgram(program);
  [0, 1, 2, 3].forEach((i) => {
    if (!uniforms.iChannel[i]) return;
    gl.activeTexture(gl.TEXTURE0 + i);
    if (glMode === 'webgl2' && channelVariant?.cube?.[i]) {
      gl.bindTexture(gl.TEXTURE_CUBE_MAP, fallbackTextures.cube.tex);
    } else {
      gl.bindTexture(gl.TEXTURE_2D, fallbackTextures.tex2D[i].tex);
    }
    gl.uniform1i(uniforms.iChannel[i], i);
  });
}

function runPreview() {
  try {
    createProgram();
    showError('');
    running = true;
    frame = 0;
    startedAt = performance.now();
    lastDrawAt = startedAt;
    syncStatus('RUN', `preview running / ${glMode}${channelVariant?.cube?.some(Boolean) ? ' / cube channel' : ''}`);
    setPreviewState('running');
    if (compileInfo) compileInfo.textContent = 'compiled OK';
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(draw);
  } catch (error) {
    running = false;
    syncStatus('ERR', 'compile error');
    setPreviewState('error');
    const message = error?.message || 'compile failed';
    if (compileInfo) compileInfo.textContent = message.slice(0, 180);
    showError(message);
  }
}

function stopPreview() {
  running = false;
  cancelAnimationFrame(raf);
  syncStatus('STOP', 'preview stopped');
  setPreviewState('stopped');
}

function draw(now) {
  if (!running || !gl || !program) return;
  if (document.hidden || !isShaderWorkActive37BU()) {
    shaderFrameGate37BU.skippedFrames += 1;
    cancelAnimationFrame(raf);
    scheduleShaderInactiveWake37BU();
    return;
  }
  const quality = Number(qualityInput?.value || 0.75);
  const width = Math.max(160, Math.floor((canvas.clientWidth || 640) * quality));
  const height = Math.max(90, Math.floor((canvas.clientHeight || 360) * quality));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
    updateResolutionLabel();
  }
  const speed = Number(speedInput?.value || 1);
  const t = ((now - startedAt) / 1000) * speed;
  const dt = Math.max(0, Math.min(0.25, (now - lastDrawAt) / 1000)) * speed;
  lastDrawAt = now;

  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.useProgram(program);
  bindChannels();
  if (uniforms.iResolution) gl.uniform3f(uniforms.iResolution, canvas.width, canvas.height, Number(zoomInput?.value || 1));
  if (uniforms.iTime) gl.uniform1f(uniforms.iTime, t);
  if (uniforms.iTimeDelta) gl.uniform1f(uniforms.iTimeDelta, dt || 1 / 60);
  if (uniforms.iFrame) gl.uniform1i(uniforms.iFrame, frame++);
  if (uniforms.iMouse) gl.uniform4f(uniforms.iMouse, mouse.x, mouse.y, mouse.down ? mouse.clickX : -Math.abs(mouse.clickX), mouse.down ? mouse.clickY : -Math.abs(mouse.clickY));
  if (uniforms.iDate) {
    const d = new Date();
    const seconds = d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds() + d.getMilliseconds() / 1000;
    gl.uniform4f(uniforms.iDate, d.getFullYear(), d.getMonth() + 1, d.getDate(), seconds);
  }
  if (uniforms.iSampleRate) gl.uniform1f(uniforms.iSampleRate, 44100);
  if (uniforms.iChannelResolution) {
    const arr = new Float32Array([
      fallbackTextures.tex2D[0].w, fallbackTextures.tex2D[0].h, 1,
      fallbackTextures.tex2D[1].w, fallbackTextures.tex2D[1].h, 1,
      fallbackTextures.tex2D[2].w, fallbackTextures.tex2D[2].h, 1,
      fallbackTextures.tex2D[3].w, fallbackTextures.tex2D[3].h, 1
    ]);
    gl.uniform3fv(uniforms.iChannelResolution, arr);
  }
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  raf = requestAnimationFrame(draw);
}

function updateResolutionLabel() {
  if (resolutionMini && canvas) resolutionMini.textContent = `${canvas.width}×${canvas.height}`;
}

function saveDraft() {
  localStorage.setItem(STORAGE_SOURCE, sourceInput?.value || '');
  localStorage.setItem(STORAGE_NAME, nameInput?.value || '');
  syncStatus('SAVE', 'draft saved');
}

function downloadText(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function bridgeModule() {
  const src = JSON.stringify(sourceInput?.value || '');
  return `// Shadertoy bridge draft - zdroj zustava ulozeny pro dalsi import\nexport const meta = { name: ${JSON.stringify(nameInput?.value || 'Shadertoy draft')}, tags: ['shadertoy', 'shader'] };\nexport const source = ${src};\nexport function render(x, y, t, p) {\n  const r = 0.5 + 0.5 * Math.sin(t + x * 8.0);\n  const g = 0.5 + 0.5 * Math.sin(t + y * 8.0 + 2.0);\n  const b = 0.5 + 0.5 * Math.sin(t + (x + y) * 5.0 + 4.0);\n  return [r, g, b, 1];\n}\n`;
}

document.getElementById('shaderCompileBtn')?.addEventListener('click', runPreview);
document.getElementById('shaderRunBtn')?.addEventListener('click', runPreview);
document.getElementById('shaderPreviewToggleBtn')?.addEventListener('click', () => running ? stopPreview() : runPreview());
document.getElementById('shaderStopBtn')?.addEventListener('click', stopPreview);
document.getElementById('shaderValidateBtn')?.addEventListener('click', runPreview);
document.getElementById('shaderSaveBtn')?.addEventListener('click', saveDraft);
document.getElementById('shaderResetBtn')?.addEventListener('click', () => { if (sourceInput) sourceInput.value = DEFAULT_SHADER; syncStatus('RESET', 'default shader loaded'); });
document.getElementById('shaderImportBtn')?.addEventListener('click', () => importFile?.click());
document.getElementById('shaderExportBtn')?.addEventListener('click', () => downloadText(`${nameInput?.value || 'shadertoy-draft'}.glsl`, sourceInput?.value || ''));
document.getElementById('shaderCopyBridgeBtn')?.addEventListener('click', async () => {
  await navigator.clipboard?.writeText(bridgeModule());
  syncStatus('COPY', 'bridge copied');
});
document.getElementById('shaderSendEditorBtn')?.addEventListener('click', () => {
  localStorage.setItem('leddj.editor.importDraft.v1', bridgeModule());
  syncStatus('EDITOR', 'bridge ulozen pro editor');
});

importFile?.addEventListener('change', async () => {
  const file = importFile.files?.[0];
  if (!file) return;
  if (sourceInput) sourceInput.value = await file.text();
  syncStatus('IMPORT', file.name);
  importFile.value = '';
});

sourceInput?.addEventListener('input', () => syncStatus('EDIT', 'draft dirty'));
nameInput?.addEventListener('input', saveDraft);
canvas?.addEventListener('mousemove', (event) => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = (event.clientX - rect.left) / rect.width * canvas.width;
  mouse.y = (rect.bottom - event.clientY) / rect.height * canvas.height;
  if (mouseInfo) mouseInfo.textContent = `${mouse.x.toFixed(0)} / ${mouse.y.toFixed(0)}`;
});
canvas?.addEventListener('mousedown', () => { mouse.down = 1; mouse.clickX = mouse.x; mouse.clickY = mouse.y; });
canvas?.addEventListener('mouseup', () => { mouse.down = 0; });
canvas?.addEventListener('mouseleave', () => { mouse.down = 0; });

window.addEventListener('beforeunload', saveDraft);
