export const OUTPUT_FRAME_PIPELINE_STAGES = Object.freeze([
  "Shader",
  "Layers",
  "FX",
  "Master",
  "Limiter",
  "FrameBuffer RGB",
  "Mapping",
  "Output"
]);

export const OUTPUT_FRAME_PIPELINE_VERSION = "output-frame-pipeline-v1";

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function createOutputFrameTelemetry(input = {}) {
  const renderTime = num(input.renderTime ?? input.renderMs);
  const sendTime = num(input.sendTime ?? input.sendMs);
  const timestamp = num(input.timestamp, Date.now());
  return Object.freeze({
    version: OUTPUT_FRAME_PIPELINE_VERSION,
    stages: OUTPUT_FRAME_PIPELINE_STAGES,
    frameId: num(input.frameId),
    timestamp,
    fps: num(input.fps),
    dropCounter: num(input.dropCounter),
    renderTime,
    sendTime,
    totalTime: renderTime + sendTime,
    byteLength: num(input.byteLength ?? input.frame?.byteLength),
    outputMode: String(input.outputMode || input.transport || "unknown")
  });
}

export function validateOutputFramePipelineStages(stages = OUTPUT_FRAME_PIPELINE_STAGES) {
  const list = Array.isArray(stages) ? stages : [];
  const missing = OUTPUT_FRAME_PIPELINE_STAGES.filter((stage) => !list.includes(stage));
  const orderOk = OUTPUT_FRAME_PIPELINE_STAGES.every((stage, index) => list[index] === stage);
  return Object.freeze({
    ok: missing.length === 0 && orderOk,
    orderOk,
    missing: Object.freeze(missing),
    expected: OUTPUT_FRAME_PIPELINE_STAGES,
    actual: Object.freeze([...list])
  });
}
