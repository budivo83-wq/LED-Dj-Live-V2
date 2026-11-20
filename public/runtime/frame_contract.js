// Shared frame contract.
//
// This module is deliberately side-effect free. It is the first migration
// seam for the larger runtime refactor: producers, the frame authority and
// transports can agree on dimensions and byte validation without importing
// UI, storage, timers or output implementations.

export const FRAME_CONTRACT_VERSION = "1.0.0";

export function normalizeFrameDimensions(dimensions = {}) {
  const width = Math.max(0, Math.round(Number(dimensions?.width || 0)));
  const height = Math.max(0, Math.round(Number(dimensions?.height || 0)));
  return { width, height };
}

export function expectedFrameByteLength(dimensions = {}) {
  const normalized = normalizeFrameDimensions(dimensions);
  return Math.max(0, normalized.width * normalized.height * 3);
}

export function isValidFrameBytes(frame, dimensions = {}) {
  return frame instanceof Uint8Array
    && frame.byteLength === expectedFrameByteLength(dimensions);
}

export function normalizeFrameSource(source, fallback = "unknown") {
  if (typeof source !== "string" || !source.trim()) return fallback;
  return source.trim();
}

// Accept both the legacy Uint8Array API and an authoritative frame packet.
// Keeping this compatibility rule here lets consumers migrate independently.
export function normalizeFrameInput(input) {
  const legacyBytes = input instanceof Uint8Array;
  const frame = legacyBytes ? input : input?.frame;
  if (!(frame instanceof Uint8Array) || frame.byteLength === 0) return null;
  return {
    frame,
    frameId: Number.isFinite(input?.frameId) ? input.frameId : 0,
    timestamp: Number.isFinite(input?.timestamp) ? input.timestamp : 0,
    source: normalizeFrameSource(input?.source, "unknown"),
    legacyBytes
  };
}
