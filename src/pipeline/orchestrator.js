/**
 * Frame pipeline orchestrator (skeleton)
 * Stages: UPDATE -> RENDER -> MAP -> OUTPUT -> PREVIEW
 */

/**
 * @typedef {import('../core/engine_api.js').createCoreEngineApi} CoreFactory
 * @typedef {import('../render/render_api.js').createRenderEngineApi} RenderFactory
 * @typedef {import('../mapping/mapping_api.js').createMappingEngineApi} MappingFactory
 * @typedef {import('../output/output_api.js').createOutputEngineApi} OutputFactory
 * @typedef {import('../preview/preview_api.js').createPreviewEngineApi} PreviewFactory
 */

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function createRingBuffer(size) {
  const cap = clampInt(size, 2, 8, 3);
  const queue = [];
  return {
    capacity: cap,
    push(item) {
      if (queue.length >= cap) queue.shift();
      queue.push(item);
    },
    shift() {
      return queue.shift();
    },
    get size() {
      return queue.length;
    }
  };
}

/**
 * @param {Object} deps
 * @param {ReturnType<import('../state/central_state.js').createCentralState>} deps.central
 * @param {ReturnType<import('../core/engine_api.js').createCoreEngineApi>} deps.core
 * @param {ReturnType<import('../render/render_api.js').createRenderEngineApi>} deps.render
 * @param {ReturnType<import('../mapping/mapping_api.js').createMappingEngineApi>} deps.mapping
 * @param {ReturnType<import('../output/output_api.js').createOutputEngineApi>} deps.output
 * @param {ReturnType<import('../preview/preview_api.js').createPreviewEngineApi>} deps.preview
 * @param {ReturnType<import('../events/event_engine.js').createEventEngine>} [deps.events]
 * @param {ReturnType<import('../debug/debug_engine.js').createDebugEngine>} [deps.debug]
 * @param {number} [deps.bufferSize]
 */
export function createFramePipelineOrchestrator(deps) {
  const central = deps.central;
  const core = deps.core;
  const render = deps.render;
  const mapping = deps.mapping;
  const output = deps.output;
  const preview = deps.preview;
  const events = deps.events || null;
  const debug = deps.debug || null;

  const outputQueue = createRingBuffer(deps.bufferSize || 3);

  let running = false;
  let frame = 0;
  let lastNow = 0;
  let rafId = 0;

  function tick(now) {
    if (!running) return;
    const dt = lastNow > 0 ? Math.max(0, now - lastNow) : 0;
    lastNow = now;
    frame += 1;

    // UPDATE
    central.actions.tickFrame(now, dt);
    core.tick({ now, dt, frame });
    events?.tick(now, Number(central.store.getState()?.runtime?.bpm || 120));

    // RENDER
    const state = central.store.getState();
    const snapshot = central.selectors.pipelineSnapshot(state);
    const renderStartedAt = performance.now();
    const renderedFrame = render.render(snapshot);
    debug?.telemetry?.markRenderMs(performance.now() - renderStartedAt);

    // MAP
    const mapStartedAt = performance.now();
    const mapped = mapping.map(renderedFrame, state.mapping);
    debug?.telemetry?.markMapMs(performance.now() - mapStartedAt);

    // OUTPUT enqueue only; no render-thread waiting on transport.
    outputQueue.push({ mapped, outputState: state.output });

    // PREVIEW is read-only consumer with independent FPS throttling.
    const previewStartedAt = performance.now();
    preview.present(renderedFrame, state.ui, mapped);
    debug?.telemetry?.markPreview(performance.now() - previewStartedAt);
    const previewStatus = preview.getStatus?.();
    if (previewStatus) {
      central.actions.setUi({
        previewLastMode: previewStatus.lastMode,
        previewPresented: previewStatus.presented
      });
    }

    // OUTPUT drain one packet batch per tick (bounded work).
    const next = outputQueue.shift();
    if (next) {
      output.push(next.mapped, next.outputState);
      const outStatus = output.getStatus?.() || {};
      central.actions.setOutput({ queueDepth: outputQueue.size, ...outStatus });
      debug?.telemetry?.markOutput(outStatus);
    } else {
      central.actions.setOutput({ queueDepth: 0 });
      debug?.telemetry?.markOutput({ queueDepth: 0 });
    }
    debug?.telemetry?.markFrame();
    if (outputQueue.size >= outputQueue.capacity) debug?.telemetry?.markDropped(1);
    if (typeof render.getShaderStats === "function") {
      debug?.telemetry?.markShader(render.getShaderStats() || {});
    }

    rafId = requestAnimationFrame(tick);
  }

  return {
    start() {
      if (running) return;
      running = true;
      lastNow = 0;
      rafId = requestAnimationFrame(tick);
    },
    stop() {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
    },
    isRunning() {
      return running;
    },
    getDebugState() {
      return {
        frame,
        queueDepth: outputQueue.size,
        queueCapacity: outputQueue.capacity
      };
    }
  };
}
